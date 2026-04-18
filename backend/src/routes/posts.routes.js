'use strict';
/**
 * Social Commerce Posts — /api/v1/posts
 *
 * Sellers post videos/images with tagged products.
 * Feed ranked purely by commerce signals (clicks, cart adds, purchases).
 * No likes, no follows — only buying signals matter.
 */
const router  = require('express').Router();
const prisma  = require('../config/prisma');
const { protect, restrictTo, optionalAuth } = require('../middleware/auth.middleware');
const { AppError } = require('../middleware/errorHandler');
const { getRedis, isAvailable } = require('../config/redis');
const logger  = require('../config/logger');
const crypto  = require('crypto');

// ─────────────────────────────────────────────────────────────────────────────
// FEED — ranked infinite scroll
// ─────────────────────────────────────────────────────────────────────────────

// GET /posts/feed — main social commerce feed
router.get('/feed', optionalAuth, async (req, res, next) => {
  try {
    const { cursor, limit = 10 } = req.query;
    const userId = req.user?.id;
    const take = Math.min(parseInt(limit), 20);

    // Get user's top categories for personalization (cached 1h)
    let userCategoryIds = [];
    if (userId) {
      const cacheKey = `feed:cats:${userId}`;
      if (isAvailable()) {
        const cached = await getRedis().get(cacheKey).catch(() => null);
        if (cached) {
          userCategoryIds = JSON.parse(cached);
        } else {
          const orderItems = await prisma.orderItem.findMany({
            where: { order: { userId } },
            include: { product: { select: { categoryId: true } } },
            take: 20,
            orderBy: { order: { createdAt: 'desc' } },
          });
          userCategoryIds = [...new Set(orderItems.map(i => i.product.categoryId))];
          await getRedis().set(cacheKey, JSON.stringify(userCategoryIds), { EX: 3600 }).catch(() => {});
        }
      }
    }

    // Get seen post IDs from Redis (prevent repeat content in 24h)
    let seenIds = [];
    if (userId && isAvailable()) {
      const seenKey = `feed:seen:${userId}`;
      const seenRaw = await getRedis().sMembers(seenKey).catch(() => []);
      seenIds = seenRaw;
    }

    // Build cursor condition
    const cursorCondition = cursor
      ? `AND sp."createdAt" < '${new Date(parseInt(cursor)).toISOString()}'`
      : '';

    const seenCondition = seenIds.length > 0
      ? `AND sp.id NOT IN (${seenIds.map(id => `'${id}'`).join(',')})`
      : '';

    // Fetch posts with products and seller info
    const posts = await prisma.$queryRaw`
      SELECT
        sp.*,
        s."storeName" as "sellerName",
        s."storeSlug" as "sellerSlug",
        s.logo as "sellerLogo",
        s.city as "sellerCity",
        s.rating as "sellerRating"
      FROM social_posts sp
      JOIN sellers s ON s.id = sp."sellerId"
      WHERE sp.status = 'ACTIVE'
        ${seenIds.length > 0 ? prisma.$raw`AND sp.id != ALL(${seenIds}::text[])` : prisma.$raw``}
      ORDER BY sp.score DESC, sp."createdAt" DESC
      LIMIT ${take + 1}
    `;

    // Simpler approach without raw interpolation issues
    const allPosts = await prisma.$queryRaw`
      SELECT
        sp.*,
        s."storeName" as "sellerName",
        s."storeSlug" as "sellerSlug",
        s.logo as "sellerLogo",
        s.city as "sellerCity",
        s.rating as "sellerRating"
      FROM social_posts sp
      JOIN sellers s ON s.id = sp."sellerId"
      WHERE sp.status = 'ACTIVE'
      ORDER BY sp.score DESC, sp."createdAt" DESC
      LIMIT ${take + 1}
    `;

    // Filter seen in JS (simpler than SQL array)
    const seenSet = new Set(seenIds);
    const filtered = allPosts.filter(p => !seenSet.has(p.id)).slice(0, take + 1);

    const hasMore = filtered.length > take;
    const result = filtered.slice(0, take);

    // Attach tagged products to each post
    const enriched = await Promise.all(result.map(async (post) => {
      const taggedProducts = await prisma.$queryRaw`
        SELECT pp.*, p.name, p.price, p.images, p.unit, p.stock, p.slug,
          p."nameAm", p."comparePrice", p."isOrganic"
        FROM post_products pp
        JOIN products p ON p.id = pp."productId"
        WHERE pp."postId" = ${post.id} AND p.status = 'ACTIVE'
        ORDER BY pp."sortOrder" ASC
      `;

      // Category affinity boost (personalization)
      const categoryBoost = userCategoryIds.length > 0
        ? taggedProducts.some((tp) => userCategoryIds.includes(tp.categoryId)) ? 1 : 0
        : 0;

      return { ...post, products: taggedProducts, categoryBoost };
    }));

    // Sort: category-boosted posts first, then by score
    enriched.sort((a, b) => {
      if (a.categoryBoost !== b.categoryBoost) return b.categoryBoost - a.categoryBoost;
      return b.score - a.score;
    });

    // Mark as seen in Redis
    if (userId && isAvailable() && result.length > 0) {
      const seenKey = `feed:seen:${userId}`;
      await getRedis().sAdd(seenKey, result.map(p => p.id)).catch(() => {});
      await getRedis().expire(seenKey, 86400).catch(() => {}); // 24h TTL
    }

    const nextCursor = hasMore && result.length > 0
      ? new Date(result[result.length - 1].createdAt).getTime().toString()
      : null;

    res.json({
      success: true,
      data: enriched,
      nextCursor,
      hasMore,
    });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST INTERACTIONS — feed ranking signals
// ─────────────────────────────────────────────────────────────────────────────

// POST /posts/:id/interact — record view/click/cart_add/purchase
router.post('/:id/interact', optionalAuth, async (req, res, next) => {
  try {
    const { type } = req.body; // VIEW | CLICK | CART_ADD | PURCHASE
    if (!['VIEW', 'CLICK', 'CART_ADD', 'PURCHASE'].includes(type)) {
      return res.json({ success: false });
    }

    const interactionId = crypto.randomUUID();
    await prisma.$queryRaw`
      INSERT INTO post_interactions (id, "postId", "userId", type)
      VALUES (${interactionId}, ${req.params.id}, ${req.user?.id || null}, ${type})
    `;

    // Update post stats + recalculate score
    const weights = { VIEW: 0.1, CLICK: 2, CART_ADD: 5, PURCHASE: 10 };
    const weight = weights[type] || 0;

    await prisma.$queryRaw`
      UPDATE social_posts
      SET
        views     = CASE WHEN ${type} = 'VIEW'     THEN views + 1     ELSE views     END,
        clicks    = CASE WHEN ${type} = 'CLICK'    THEN clicks + 1    ELSE clicks    END,
        "cartAdds"  = CASE WHEN ${type} = 'CART_ADD' THEN "cartAdds" + 1  ELSE "cartAdds"  END,
        purchases = CASE WHEN ${type} = 'PURCHASE' THEN purchases + 1 ELSE purchases END,
        score     = score + ${weight},
        "updatedAt" = NOW()
      WHERE id = ${req.params.id}
    `;

    res.json({ success: true });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST CRUD — seller creates/manages posts
// ─────────────────────────────────────────────────────────────────────────────

// GET /posts — list all active posts (public)
router.get('/', optionalAuth, async (req, res, next) => {
  try {
    const { sellerId, limit = 20, cursor } = req.query;
    const where = sellerId ? `AND sp."sellerId" = '${sellerId}'` : '';

    const posts = await prisma.$queryRaw`
      SELECT sp.*, s."storeName" as "sellerName", s."storeSlug" as "sellerSlug", s.logo as "sellerLogo"
      FROM social_posts sp
      JOIN sellers s ON s.id = sp."sellerId"
      WHERE sp.status = 'ACTIVE'
      ORDER BY sp."createdAt" DESC
      LIMIT ${parseInt(limit)}
    `;

    const enriched = await Promise.all(posts.map(async (post) => {
      const products = await prisma.$queryRaw`
        SELECT pp.*, p.name, p.price, p.images, p.unit, p.stock, p.slug, p."nameAm"
        FROM post_products pp
        JOIN products p ON p.id = pp."productId"
        WHERE pp."postId" = ${post.id}
        ORDER BY pp."sortOrder" ASC
      `;
      return { ...post, products };
    }));

    res.json({ success: true, data: enriched });
  } catch (err) { next(err); }
});

// GET /posts/:id — single post with products
router.get('/:id', optionalAuth, async (req, res, next) => {
  try {
    const posts = await prisma.$queryRaw`
      SELECT sp.*, s."storeName" as "sellerName", s."storeSlug" as "sellerSlug",
        s.logo as "sellerLogo", s.city as "sellerCity", s.rating as "sellerRating",
        s.id as "sellerDbId"
      FROM social_posts sp
      JOIN sellers s ON s.id = sp."sellerId"
      WHERE sp.id = ${req.params.id} AND sp.status = 'ACTIVE'
    `;
    if (!posts.length) throw new AppError('Post not found.', 404);
    const post = posts[0];

    const products = await prisma.$queryRaw`
      SELECT pp.*, p.name, p.price, p.images, p.unit, p.stock, p.slug,
        p."nameAm", p."comparePrice", p."isOrganic", p.description
      FROM post_products pp
      JOIN products p ON p.id = pp."productId"
      WHERE pp."postId" = ${post.id}
      ORDER BY pp."sortOrder" ASC
    `;

    // Record view
    const interactionId = crypto.randomUUID();
    prisma.$queryRaw`
      INSERT INTO post_interactions (id, "postId", "userId", type)
      VALUES (${interactionId}, ${post.id}, ${req.user?.id || null}, 'VIEW')
    `.catch(() => {});
    prisma.$queryRaw`
      UPDATE social_posts SET views = views + 1, score = score + 0.1 WHERE id = ${post.id}
    `.catch(() => {});

    res.json({ success: true, data: { ...post, products } });
  } catch (err) { next(err); }
});

// POST /posts — seller creates a post
router.post('/', protect, restrictTo('SELLER', 'ADMIN'), async (req, res, next) => {
  try {
    const { mediaUrl, thumbnailUrl, type = 'IMAGE', caption, captionAm, products = [] } = req.body;
    if (!mediaUrl || !thumbnailUrl) throw new AppError('mediaUrl and thumbnailUrl required.', 400);
    if (!products.length) throw new AppError('At least one product must be tagged.', 400);

    const seller = await prisma.seller.findUnique({ where: { userId: req.user.id } });
    if (!seller) throw new AppError('Seller not found.', 404);

    // Verify all products belong to this seller
    const productIds = products.map((p) => p.productId);
    const ownedProducts = await prisma.product.findMany({
      where: { id: { in: productIds }, sellerId: seller.id, status: 'ACTIVE' },
      select: { id: true },
    });
    if (ownedProducts.length !== productIds.length) {
      throw new AppError('One or more products not found or not yours.', 400);
    }

    const postId = crypto.randomUUID();

    await prisma.$queryRaw`
      INSERT INTO social_posts (id, "sellerId", type, "mediaUrl", "thumbnailUrl", caption, "captionAm")
      VALUES (${postId}, ${seller.id}, ${type}, ${mediaUrl}, ${thumbnailUrl}, ${caption || null}, ${captionAm || null})
    `;

    // Tag products
    for (let i = 0; i < products.length; i++) {
      const p = products[i];
      const tagId = crypto.randomUUID();
      await prisma.$queryRaw`
        INSERT INTO post_products (id, "postId", "productId", "tagX", "tagY", "sortOrder")
        VALUES (${tagId}, ${postId}, ${p.productId}, ${p.tagX || null}, ${p.tagY || null}, ${i})
      `;
    }

    // Record social feed event
    const eventId = crypto.randomUUID();
    prisma.$queryRaw`
      INSERT INTO social_feed_events (id, "userId", type, "sellerId", meta)
      VALUES (${eventId}, ${req.user.id}, 'POST_CREATED', ${seller.id}, ${JSON.stringify({ postId, productCount: products.length })}::jsonb)
    `.catch(() => {});

    res.status(201).json({ success: true, data: { postId } });
  } catch (err) { next(err); }
});

// PATCH /posts/:id — seller updates a post
router.patch('/:id', protect, restrictTo('SELLER', 'ADMIN'), async (req, res, next) => {
  try {
    const { caption, captionAm, status } = req.body;
    const seller = await prisma.seller.findUnique({ where: { userId: req.user.id } });

    const posts = await prisma.$queryRaw`
      SELECT * FROM social_posts WHERE id = ${req.params.id} AND "sellerId" = ${seller?.id}
    `;
    if (!posts.length) throw new AppError('Post not found.', 404);

    await prisma.$queryRaw`
      UPDATE social_posts
      SET
        caption = COALESCE(${caption || null}, caption),
        "captionAm" = COALESCE(${captionAm || null}, "captionAm"),
        status = COALESCE(${status || null}, status),
        "updatedAt" = NOW()
      WHERE id = ${req.params.id}
    `;

    res.json({ success: true });
  } catch (err) { next(err); }
});

// DELETE /posts/:id — seller deletes a post
router.delete('/:id', protect, restrictTo('SELLER', 'ADMIN'), async (req, res, next) => {
  try {
    const seller = await prisma.seller.findUnique({ where: { userId: req.user.id } });
    await prisma.$queryRaw`
      UPDATE social_posts SET status = 'DELETED' WHERE id = ${req.params.id} AND "sellerId" = ${seller?.id}
    `;
    res.json({ success: true });
  } catch (err) { next(err); }
});

// GET /posts/seller/mine — seller's own posts with analytics
router.get('/seller/mine', protect, restrictTo('SELLER', 'ADMIN'), async (req, res, next) => {
  try {
    const seller = await prisma.seller.findUnique({ where: { userId: req.user.id } });
    if (!seller) throw new AppError('Seller not found.', 404);

    const posts = await prisma.$queryRaw`
      SELECT sp.*
      FROM social_posts sp
      WHERE sp."sellerId" = ${seller.id} AND sp.status != 'DELETED'
      ORDER BY sp."createdAt" DESC
      LIMIT 50
    `;

    const enriched = await Promise.all(posts.map(async (post) => {
      const products = await prisma.$queryRaw`
        SELECT pp."productId", p.name, p.images, p.price, p.unit
        FROM post_products pp
        JOIN products p ON p.id = pp."productId"
        WHERE pp."postId" = ${post.id}
      `;
      return { ...post, products };
    }));

    res.json({ success: true, data: enriched });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────────────────────
// SCORE REFRESH — called by BullMQ job every 30 minutes
// ─────────────────────────────────────────────────────────────────────────────
async function refreshPostScores() {
  try {
    // Recalculate scores with time decay
    await prisma.$queryRaw`
      UPDATE social_posts
      SET score = (
        purchases * 10 +
        "cartAdds" * 5 +
        clicks * 2 +
        views * 0.1 +
        CASE
          WHEN EXTRACT(EPOCH FROM (NOW() - "createdAt")) / 3600 < 1  THEN 20
          WHEN EXTRACT(EPOCH FROM (NOW() - "createdAt")) / 3600 < 6  THEN 10
          WHEN EXTRACT(EPOCH FROM (NOW() - "createdAt")) / 3600 < 24 THEN 5
          ELSE 0
        END
      )
      WHERE status = 'ACTIVE'
    `;
    logger.info('[Posts] Scores refreshed');
  } catch (err) {
    logger.warn('[Posts] Score refresh failed:', err.message);
  }
}

module.exports = router;
module.exports.refreshPostScores = refreshPostScores;
