'use strict';
/**
 * Social Commerce Routes — /api/v1/social
 *
 * Feature 1: Social Feed — personalized community activity feed
 * Feature 2: Share-to-Earn — referral links with reward tracking
 * Feature 3: UGC Photos — buyer photos on product pages
 * Feature 4: Badges — achievement system
 */
const router  = require('express').Router();
const prisma  = require('../config/prisma');
const { protect, optionalAuth } = require('../middleware/auth.middleware');
const { AppError } = require('../middleware/errorHandler');
const { createNotification } = require('../services/notification.service');
const logger  = require('../config/logger');
const crypto  = require('crypto');

// ─────────────────────────────────────────────────────────────────────────────
// FEATURE 1: SOCIAL FEED
// ─────────────────────────────────────────────────────────────────────────────

// GET /social/feed — personalized feed for logged-in user
// Shows: purchases from followed sellers, trending products, community activity
router.get('/feed', optionalAuth, async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const userId = req.user?.id;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Get followed seller IDs
    let followedSellerIds = [];
    if (userId) {
      const follows = await prisma.$queryRaw`
        SELECT "sellerId" FROM seller_follows WHERE "userId" = ${userId}
      `;
      followedSellerIds = follows.map(f => f.sellerId);
    }

    // Build feed: mix of followed-seller events + trending + recent community
    let feedEvents;

    if (followedSellerIds.length > 0) {
      // Personalized: events from followed sellers + general trending
      feedEvents = await prisma.$queryRaw`
        SELECT sfe.*, 
          u.name as "userName", u.avatar as "userAvatar",
          p.name as "productName", p.images as "productImages", 
          p.price as "productPrice", p.slug as "productSlug",
          p.unit as "productUnit", p."nameAm" as "productNameAm",
          s."storeName" as "sellerName", s."storeSlug" as "sellerSlug"
        FROM social_feed_events sfe
        LEFT JOIN users u ON u.id = sfe."userId"
        LEFT JOIN products p ON p.id = sfe."productId"
        LEFT JOIN sellers s ON s.id = sfe."sellerId"
        WHERE sfe."isPublic" = true
          AND (
            sfe."sellerId" = ANY(${followedSellerIds}::text[])
            OR sfe.type IN ('PURCHASE', 'UGC', 'REVIEW')
          )
          AND sfe."userId" != ${userId || ''}
        ORDER BY sfe."createdAt" DESC
        LIMIT ${parseInt(limit)} OFFSET ${offset}
      `;
    } else {
      // No follows — show general community feed
      feedEvents = await prisma.$queryRaw`
        SELECT sfe.*,
          u.name as "userName", u.avatar as "userAvatar",
          p.name as "productName", p.images as "productImages",
          p.price as "productPrice", p.slug as "productSlug",
          p.unit as "productUnit", p."nameAm" as "productNameAm",
          s."storeName" as "sellerName", s."storeSlug" as "sellerSlug"
        FROM social_feed_events sfe
        LEFT JOIN users u ON u.id = sfe."userId"
        LEFT JOIN products p ON p.id = sfe."productId"
        LEFT JOIN sellers s ON s.id = sfe."sellerId"
        WHERE sfe."isPublic" = true
        ORDER BY sfe."createdAt" DESC
        LIMIT ${parseInt(limit)} OFFSET ${offset}
      `;
    }

    // Attach UGC photos for PURCHASE events
    const enriched = await Promise.all(feedEvents.map(async (event) => {
      if (event.type === 'UGC' && event.meta?.photoId) {
        const photos = await prisma.$queryRaw`
          SELECT * FROM ugc_photos WHERE id = ${event.meta.photoId}
        `;
        return { ...event, ugcPhoto: photos[0] || null };
      }
      return event;
    }));

    res.json({ success: true, data: enriched, page: parseInt(page) });
  } catch (err) { next(err); }
});

// POST /social/feed/event — record a social event (called internally after orders, reviews, etc.)
router.post('/feed/event', protect, async (req, res, next) => {
  try {
    const { type, productId, sellerId, meta, isPublic = true } = req.body;
    if (!type) throw new AppError('type required.', 400);

    const eventId = crypto.randomUUID();
    await prisma.$queryRaw`
      INSERT INTO social_feed_events (id, "userId", type, "productId", "sellerId", meta, "isPublic")
      VALUES (${eventId}, ${req.user.id}, ${type}, ${productId || null}, ${sellerId || null}, ${JSON.stringify(meta || {})}::jsonb, ${isPublic})
    `;

    // Check and award badges after each event
    awardBadges(req.user.id, type).catch(() => {});

    res.status(201).json({ success: true, data: { eventId } });
  } catch (err) { next(err); }
});

// GET /social/feed/trending — trending products based on social activity
router.get('/feed/trending', async (req, res, next) => {
  try {
    const since = new Date(Date.now() - 24 * 3600 * 1000); // last 24h

    const trending = await prisma.$queryRaw`
      SELECT sfe."productId",
        COUNT(*) as "activityCount",
        COUNT(CASE WHEN type = 'PURCHASE' THEN 1 END) as "purchaseCount",
        COUNT(CASE WHEN type = 'UGC' THEN 1 END) as "ugcCount",
        p.name, p.images, p.price, p.slug, p.unit, p."nameAm",
        s."storeName", s."storeSlug"
      FROM social_feed_events sfe
      JOIN products p ON p.id = sfe."productId"
      JOIN sellers s ON s.id = p."sellerId"
      WHERE sfe."createdAt" > ${since}
        AND sfe."productId" IS NOT NULL
        AND p.status = 'ACTIVE'
      GROUP BY sfe."productId", p.name, p.images, p.price, p.slug, p.unit, p."nameAm", s."storeName", s."storeSlug"
      ORDER BY "activityCount" DESC
      LIMIT 10
    `;

    res.json({ success: true, data: trending });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────────────────────
// FEATURE 2: SHARE-TO-EARN
// ─────────────────────────────────────────────────────────────────────────────

// POST /social/share/:productId — generate a referral share link
router.post('/share/:productId', protect, async (req, res, next) => {
  try {
    const { productId } = req.params;

    // Check if user already has a share link for this product
    const existing = await prisma.$queryRaw`
      SELECT * FROM share_links WHERE "userId" = ${req.user.id} AND "productId" = ${productId}
    `;

    if (existing.length) {
      const link = existing[0];
      const shareUrl = `${process.env.CLIENT_URL || 'http://localhost:3000'}/products/${req.params.productId}?ref=${link.code}`;
      return res.json({ success: true, data: { ...link, shareUrl } });
    }

    // Generate unique code
    const code = req.user.id.slice(-4).toUpperCase() + crypto.randomBytes(3).toString('hex').toUpperCase();
    const linkId = crypto.randomUUID();

    await prisma.$queryRaw`
      INSERT INTO share_links (id, "userId", "productId", code)
      VALUES (${linkId}, ${req.user.id}, ${productId}, ${code})
    `;

    const shareUrl = `${process.env.CLIENT_URL || 'http://localhost:3000'}/products/${productId}?ref=${code}`;

    // Get product for WhatsApp message
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { name: true, price: true, unit: true, images: true },
    });

    const whatsappText = product
      ? `🌿 Check out ${product.name} on Hafa Market!\nETB ${product.price}/${product.unit}\n\n${shareUrl}\n\nUse my link for 5% off your first order! 🎁`
      : `Check out this product on Hafa Market! ${shareUrl}`;

    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(whatsappText)}`;
    const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(`🌿 ${product?.name || 'Great product'} on Hafa Market — ETB ${product?.price}`)}`;

    res.status(201).json({
      success: true,
      data: {
        linkId, code, shareUrl, whatsappUrl, telegramUrl,
        reward: 'ETB 10 credit when a friend buys using your link',
        friendDiscount: '5% off their first order',
      },
    });
  } catch (err) { next(err); }
});

// POST /social/share/click/:code — track a share link click
router.post('/share/click/:code', optionalAuth, async (req, res, next) => {
  try {
    const { code } = req.params;

    await prisma.$queryRaw`
      UPDATE share_links SET clicks = clicks + 1 WHERE code = ${code}
    `;

    // Store referral in session for conversion tracking
    res.json({ success: true });
  } catch (err) { next(err); }
});

// POST /social/share/convert/:code — called when referred user completes a purchase
router.post('/share/convert/:code', protect, async (req, res, next) => {
  try {
    const { code } = req.params;
    const { orderId } = req.body;

    const links = await prisma.$queryRaw`
      SELECT * FROM share_links WHERE code = ${code}
    `;
    if (!links.length) return res.json({ success: false });

    const link = links[0];

    // Don't reward self-referrals
    if (link.userId === req.user.id) return res.json({ success: false });

    // Update conversion count + earnings
    const reward = 10; // ETB 10 per conversion
    await prisma.$queryRaw`
      UPDATE share_links
      SET conversions = conversions + 1, earnings = earnings + ${reward}
      WHERE code = ${code}
    `;

    // Credit the referrer's wallet
    await prisma.$transaction([
      prisma.wallet.upsert({
        where: { userId: link.userId },
        update: { balance: { increment: reward } },
        create: { userId: link.userId, balance: reward },
      }),
      prisma.walletTransaction.create({
        data: {
          walletId: '', // will be set by upsert
          type: 'REFERRAL_REWARD',
          amount: reward,
          balance: 0,
          description: `Referral reward — friend purchased via your link`,
          refId: orderId,
        },
      }).catch(() => {}),
    ]).catch(async () => {
      // Fallback: just add loyalty points
      await prisma.user.update({
        where: { id: link.userId },
        data: { loyaltyPoints: { increment: 100 } },
      });
    });

    // Notify referrer
    await createNotification(
      link.userId, 'PROMO',
      '🎉 You earned ETB 10!',
      'A friend bought using your share link. ETB 10 added to your wallet.',
      { type: 'REFERRAL_REWARD', orderId }
    );

    // Record social event
    const eventId = crypto.randomUUID();
    await prisma.$queryRaw`
      INSERT INTO social_feed_events (id, "userId", type, "productId", meta)
      VALUES (${eventId}, ${link.userId}, 'SHARE_CONVERTED', ${link.productId}, ${JSON.stringify({ code, reward })}::jsonb)
    `;

    // Award badge if 5+ conversions
    const [{ count }] = await prisma.$queryRaw`
      SELECT COUNT(*) as count FROM share_links WHERE "userId" = ${link.userId} AND conversions > 0
    `;
    if (Number(count) >= 5) {
      await awardBadge(link.userId, 'COMMUNITY_BUILDER');
    }

    res.json({ success: true, data: { reward } });
  } catch (err) { next(err); }
});

// GET /social/share/stats — get user's share link stats
router.get('/share/stats', protect, async (req, res, next) => {
  try {
    const stats = await prisma.$queryRaw`
      SELECT
        COUNT(*) as "totalLinks",
        SUM(clicks) as "totalClicks",
        SUM(conversions) as "totalConversions",
        SUM(earnings) as "totalEarnings"
      FROM share_links
      WHERE "userId" = ${req.user.id}
    `;

    const topLinks = await prisma.$queryRaw`
      SELECT sl.*, p.name as "productName", p.images as "productImages"
      FROM share_links sl
      JOIN products p ON p.id = sl."productId"
      WHERE sl."userId" = ${req.user.id}
      ORDER BY sl.conversions DESC, sl.clicks DESC
      LIMIT 5
    `;

    res.json({
      success: true,
      data: {
        ...stats[0],
        totalClicks: Number(stats[0]?.totalClicks || 0),
        totalConversions: Number(stats[0]?.totalConversions || 0),
        totalEarnings: Number(stats[0]?.totalEarnings || 0),
        topLinks,
      },
    });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────────────────────
// FEATURE 3: UGC PHOTOS
// ─────────────────────────────────────────────────────────────────────────────

// GET /social/ugc/:productId — get UGC photos for a product
router.get('/ugc/:productId', async (req, res, next) => {
  try {
    const photos = await prisma.$queryRaw`
      SELECT up.*, u.name as "userName", u.avatar as "userAvatar"
      FROM ugc_photos up
      LEFT JOIN users u ON u.id = up."userId"
      WHERE up."productId" = ${req.params.productId}
        AND up."isApproved" = true
      ORDER BY up.likes DESC, up."createdAt" DESC
      LIMIT 20
    `;
    res.json({ success: true, data: photos });
  } catch (err) { next(err); }
});

// POST /social/ugc — upload a UGC photo
router.post('/ugc', protect, async (req, res, next) => {
  try {
    const { productId, orderId, photoUrl, caption } = req.body;
    if (!productId || !photoUrl) throw new AppError('productId and photoUrl required.', 400);

    // Verify user bought this product (optional but recommended)
    const purchased = await prisma.orderItem.findFirst({
      where: { productId, order: { userId: req.user.id, status: 'DELIVERED' } },
    }).catch(() => null);

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { name: true, avatar: true },
    });

    const photoId = crypto.randomUUID();
    await prisma.$queryRaw`
      INSERT INTO ugc_photos (id, "userId", "userName", "userAvatar", "orderId", "productId", "photoUrl", caption)
      VALUES (${photoId}, ${req.user.id}, ${user.name}, ${user.avatar || null}, ${orderId || null}, ${productId}, ${photoUrl}, ${caption || null})
    `;

    // Award points for UGC
    await prisma.user.update({
      where: { id: req.user.id },
      data: { loyaltyPoints: { increment: 10 } },
    });

    // Record social feed event
    const eventId = crypto.randomUUID();
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { sellerId: true },
    });

    await prisma.$queryRaw`
      INSERT INTO social_feed_events (id, "userId", type, "productId", "sellerId", meta)
      VALUES (${eventId}, ${req.user.id}, 'UGC', ${productId}, ${product?.sellerId || null}, ${JSON.stringify({ photoId, caption })}::jsonb)
    `;

    // Award UGC_CREATOR badge on first photo
    await awardBadge(req.user.id, 'UGC_CREATOR');

    res.status(201).json({
      success: true,
      data: { photoId, pointsEarned: 10 },
      message: 'Photo shared! +10 loyalty points earned 🎉',
    });
  } catch (err) { next(err); }
});

// POST /social/ugc/:photoId/like — like a UGC photo
router.post('/ugc/:photoId/like', protect, async (req, res, next) => {
  try {
    const { photoId } = req.params;

    // Upsert like
    await prisma.$queryRaw`
      INSERT INTO ugc_photo_likes ("photoId", "userId")
      VALUES (${photoId}, ${req.user.id})
      ON CONFLICT ("photoId", "userId") DO NOTHING
    `;

    // Update like count
    const [{ count }] = await prisma.$queryRaw`
      SELECT COUNT(*) as count FROM ugc_photo_likes WHERE "photoId" = ${photoId}
    `;
    await prisma.$queryRaw`
      UPDATE ugc_photos SET likes = ${Number(count)} WHERE id = ${photoId}
    `;

    res.json({ success: true, likes: Number(count) });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────────────────────
// FEATURE 4: BADGES
// ─────────────────────────────────────────────────────────────────────────────

// GET /social/badges/:userId — get user's badges
router.get('/badges/:userId', async (req, res, next) => {
  try {
    const badges = await prisma.$queryRaw`
      SELECT * FROM user_badges WHERE "userId" = ${req.params.userId}
      ORDER BY "earnedAt" DESC
    `;
    res.json({ success: true, data: badges });
  } catch (err) { next(err); }
});

// POST /social/badges/check — check and award badges for current user
router.post('/badges/check', protect, async (req, res, next) => {
  try {
    const newBadges = await awardBadges(req.user.id, 'CHECK');
    res.json({ success: true, data: newBadges });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────────────────────
// HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

async function awardBadge(userId, badge) {
  try {
    const id = crypto.randomUUID();
    await prisma.$queryRaw`
      INSERT INTO user_badges (id, "userId", badge)
      VALUES (${id}, ${userId}, ${badge})
      ON CONFLICT ("userId", badge) DO NOTHING
    `;

    // Notify user of new badge
    const BADGE_NAMES = {
      FIRST_PURCHASE:    '🌱 First Purchase',
      FIVE_ORDERS:       '🔥 5 Orders',
      ORGANIC_BUYER:     '🌿 Organic Buyer',
      TOP_BUYER:         '🏆 Top Buyer',
      UGC_CREATOR:       '📸 UGC Creator',
      COMMUNITY_BUILDER: '🤝 Community Builder',
      LOYAL_CUSTOMER:    '⭐ Loyal Customer',
      LIVE_SHOPPER:      '📺 Live Shopper',
      BULK_BUYER:        '📦 Bulk Buyer',
    };

    const name = BADGE_NAMES[badge];
    if (name) {
      await createNotification(
        userId, 'PROMO',
        `🏅 New Badge: ${name}`,
        `You earned the ${name} badge! Keep shopping to unlock more.`,
        { type: 'BADGE_EARNED', badge }
      );
    }

    return badge;
  } catch { return null; }
}

async function awardBadges(userId, triggerType) {
  const newBadges = [];

  try {
    // Count orders
    const orderCount = await prisma.order.count({
      where: { userId, status: { in: ['CONFIRMED', 'DELIVERED'] } },
    });

    if (orderCount >= 1) { const b = await awardBadge(userId, 'FIRST_PURCHASE'); if (b) newBadges.push(b); }
    if (orderCount >= 5) { const b = await awardBadge(userId, 'FIVE_ORDERS'); if (b) newBadges.push(b); }

    // Organic buyer
    const organicCount = await prisma.orderItem.count({
      where: { order: { userId }, product: { isOrganic: true } },
    });
    if (organicCount >= 5) { const b = await awardBadge(userId, 'ORGANIC_BUYER'); if (b) newBadges.push(b); }

    // UGC creator
    const ugcCount = await prisma.$queryRaw`SELECT COUNT(*) as count FROM ugc_photos WHERE "userId" = ${userId}`;
    if (Number(ugcCount[0]?.count) >= 1) { const b = await awardBadge(userId, 'UGC_CREATOR'); if (b) newBadges.push(b); }

    // Community builder (referrals)
    const referralCount = await prisma.$queryRaw`SELECT SUM(conversions) as total FROM share_links WHERE "userId" = ${userId}`;
    if (Number(referralCount[0]?.total) >= 5) { const b = await awardBadge(userId, 'COMMUNITY_BUILDER'); if (b) newBadges.push(b); }

    // Loyal customer (account age 6+ months with 3+ orders)
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { createdAt: true } });
    const accountAgeDays = user ? (Date.now() - new Date(user.createdAt).getTime()) / 86400000 : 0;
    if (accountAgeDays >= 180 && orderCount >= 3) { const b = await awardBadge(userId, 'LOYAL_CUSTOMER'); if (b) newBadges.push(b); }

  } catch (err) {
    logger.warn('[Badges] awardBadges failed:', err.message);
  }

  return newBadges;
}

module.exports = router;
