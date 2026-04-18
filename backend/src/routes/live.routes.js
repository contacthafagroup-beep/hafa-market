'use strict';
/**
 * Live Commerce Routes — dedicated file for all live-related endpoints
 * Mounted at /api/v1/live
 *
 * Covers:
 *  - Seller follow/unfollow
 *  - Live session management (CRUD, start, end)
 *  - Live chat history
 *  - Pinned products
 *  - Session analytics
 *  - Session highlights (Groq AI)
 *  - Personalized recommendations
 */
const router  = require('express').Router();
const prisma  = require('../config/prisma');
const { protect, restrictTo, optionalAuth } = require('../middleware/auth.middleware');
const { AppError } = require('../middleware/errorHandler');
const { createNotification } = require('../services/notification.service');
const { getIO } = require('../socket');
const { getRedis, isAvailable } = require('../config/redis');
const logger  = require('../config/logger');

// ── SELLER FOLLOW / UNFOLLOW ──────────────────────────────────────────────────

// POST /live/sellers/:sellerId/follow
router.post('/sellers/:sellerId/follow', protect, async (req, res, next) => {
  try {
    const { sellerId } = req.params;
    const userId = req.user.id;

    // Upsert — idempotent
    await prisma.$queryRaw`
      INSERT INTO seller_follows ("userId", "sellerId", "createdAt")
      VALUES (${userId}, ${sellerId}, NOW())
      ON CONFLICT ("userId", "sellerId") DO NOTHING
    `;

    // Count followers
    const [{ count }] = await prisma.$queryRaw`
      SELECT COUNT(*) as count FROM seller_follows WHERE "sellerId" = ${sellerId}
    `;

    res.json({ success: true, following: true, followerCount: Number(count) });
  } catch (err) { next(err); }
});

// DELETE /live/sellers/:sellerId/follow
router.delete('/sellers/:sellerId/follow', protect, async (req, res, next) => {
  try {
    const { sellerId } = req.params;
    await prisma.$queryRaw`
      DELETE FROM seller_follows WHERE "userId" = ${req.user.id} AND "sellerId" = ${sellerId}
    `;
    const [{ count }] = await prisma.$queryRaw`
      SELECT COUNT(*) as count FROM seller_follows WHERE "sellerId" = ${sellerId}
    `;
    res.json({ success: true, following: false, followerCount: Number(count) });
  } catch (err) { next(err); }
});

// GET /live/sellers/:sellerId/follow — check if current user follows
router.get('/sellers/:sellerId/follow', optionalAuth, async (req, res, next) => {
  try {
    const { sellerId } = req.params;
    const [{ count: followerCount }] = await prisma.$queryRaw`
      SELECT COUNT(*) as count FROM seller_follows WHERE "sellerId" = ${sellerId}
    `;
    if (!req.user) return res.json({ success: true, following: false, followerCount: Number(followerCount) });

    const rows = await prisma.$queryRaw`
      SELECT 1 FROM seller_follows WHERE "userId" = ${req.user.id} AND "sellerId" = ${sellerId}
    `;
    res.json({ success: true, following: rows.length > 0, followerCount: Number(followerCount) });
  } catch (err) { next(err); }
});

// GET /live/sellers/:sellerId/followers — list followers (admin/seller only)
router.get('/sellers/:sellerId/followers', protect, async (req, res, next) => {
  try {
    const followers = await prisma.$queryRaw`
      SELECT sf."userId", u.name, u.avatar, sf."createdAt"
      FROM seller_follows sf
      JOIN users u ON u.id = sf."userId"
      WHERE sf."sellerId" = ${req.params.sellerId}
      ORDER BY sf."createdAt" DESC
      LIMIT 100
    `;
    res.json({ success: true, data: followers });
  } catch (err) { next(err); }
});

// ── LIVE SESSION MANAGEMENT ───────────────────────────────────────────────────

// GET /live — list LIVE + SCHEDULED sessions with seller info
router.get('/', optionalAuth, async (req, res, next) => {
  try {
    const sessions = await prisma.liveSession.findMany({
      where: { status: { in: ['LIVE', 'SCHEDULED'] } },
      orderBy: [{ status: 'asc' }, { viewerCount: 'desc' }, { scheduledAt: 'asc' }],
      take: 20,
    });

    // Attach seller info
    const withSeller = await Promise.all(sessions.map(async s => {
      const seller = await prisma.seller.findUnique({
        where: { id: s.sellerId },
        select: { storeName: true, storeSlug: true, logo: true, rating: true, city: true },
      }).catch(() => null);
      return { ...s, seller };
    }));

    // If user is logged in, check which sellers they follow
    let followedSellerIds = [];
    if (req.user) {
      const follows = await prisma.$queryRaw`
        SELECT "sellerId" FROM seller_follows WHERE "userId" = ${req.user.id}
      `;
      followedSellerIds = follows.map(f => f.sellerId);
    }

    const result = withSeller.map(s => ({
      ...s,
      isFollowing: followedSellerIds.includes(s.sellerId),
    }));

    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

// GET /live/recommended — personalized live recommendations
router.get('/recommended', optionalAuth, async (req, res, next) => {
  try {
    const userId = req.user?.id;
    const liveSessions = await prisma.liveSession.findMany({
      where: { status: 'LIVE' },
      take: 20,
    });

    if (!liveSessions.length) return res.json({ success: true, data: [] });

    // Score each session
    let userCategoryIds = [];
    let followedSellerIds = [];

    if (userId) {
      // Get user's top categories from order history
      const orderItems = await prisma.orderItem.findMany({
        where: { order: { userId } },
        include: { product: { select: { categoryId: true } } },
        take: 20,
        orderBy: { order: { createdAt: 'desc' } },
      });
      userCategoryIds = [...new Set(orderItems.map(i => i.product.categoryId))];

      // Get followed sellers
      const follows = await prisma.$queryRaw`
        SELECT "sellerId" FROM seller_follows WHERE "userId" = ${userId}
      `;
      followedSellerIds = follows.map(f => f.sellerId);
    }

    // Score: followed seller = +50, viewer count = +viewerCount, category match = +20
    const scored = await Promise.all(liveSessions.map(async s => {
      let score = s.viewerCount;
      if (followedSellerIds.includes(s.sellerId)) score += 50;

      // Check if session products match user categories
      if (userCategoryIds.length && s.productIds?.length) {
        const products = await prisma.product.findMany({
          where: { id: { in: s.productIds }, categoryId: { in: userCategoryIds } },
          select: { id: true },
        });
        score += products.length * 20;
      }

      const seller = await prisma.seller.findUnique({
        where: { id: s.sellerId },
        select: { storeName: true, storeSlug: true, logo: true, rating: true },
      }).catch(() => null);

      return { ...s, seller, score, isFollowing: followedSellerIds.includes(s.sellerId) };
    }));

    scored.sort((a, b) => b.score - a.score);
    res.json({ success: true, data: scored });
  } catch (err) { next(err); }
});

// POST /live — create session + notify followers
router.post('/', protect, restrictTo('SELLER', 'ADMIN'), async (req, res, next) => {
  try {
    const { title, description, scheduledAt, productIds, streamUrl } = req.body;
    if (!title) throw new AppError('title required.', 400);

    const seller = await prisma.seller.findUnique({ where: { userId: req.user.id } });
    if (!seller) throw new AppError('Seller not found.', 404);

    const session = await prisma.liveSession.create({
      data: {
        sellerId: seller.id, title, description,
        streamUrl: streamUrl || null,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        productIds: productIds || [],
      },
    });

    // If scheduled, queue a reminder job
    if (scheduledAt) {
      const { dispatchOrder } = require('../jobs/queues');
      const reminderTime = new Date(scheduledAt).getTime() - 15 * 60 * 1000; // 15 min before
      const delay = reminderTime - Date.now();
      if (delay > 0) {
        await dispatchOrder('LIVE_SESSION_REMINDER', {
          type: 'LIVE_SESSION_REMINDER',
          sessionId: session.id,
          sellerId: seller.id,
          sellerName: seller.storeName,
          title,
          scheduledAt,
        }, { delay }).catch(() => {});
      }
    }

    res.status(201).json({ success: true, data: session });
  } catch (err) { next(err); }
});

// PATCH /live/:id/start — go live + notify all followers instantly
router.patch('/:id/start', protect, restrictTo('SELLER', 'ADMIN'), async (req, res, next) => {
  try {
    const { streamUrl } = req.body;
    const session = await prisma.liveSession.update({
      where: { id: req.params.id },
      data: { status: 'LIVE', startedAt: new Date(), ...(streamUrl && { streamUrl }) },
    });

    // Get seller info
    const seller = await prisma.seller.findUnique({
      where: { id: session.sellerId },
      select: { storeName: true, storeSlug: true },
    });

    // Notify all followers in parallel (fire-and-forget)
    notifyFollowersLive(session.sellerId, seller?.storeName || 'A seller', session.id, session.title)
      .catch(err => logger.warn('Live notification failed:', err.message));

    res.json({ success: true, data: { ...session, seller } });
  } catch (err) { next(err); }
});

// PATCH /live/:id/end — end stream + generate AI highlights
router.patch('/:id/end', protect, restrictTo('SELLER', 'ADMIN'), async (req, res, next) => {
  try {
    const session = await prisma.liveSession.update({
      where: { id: req.params.id },
      data: { status: 'ENDED', endedAt: new Date() },
    });

    // Generate AI highlights in background (non-blocking)
    generateSessionHighlights(session.id, session.title).catch(() => {});

    res.json({ success: true, data: session });
  } catch (err) { next(err); }
});

// POST /live/:id/view
router.post('/:id/view', optionalAuth, async (req, res, next) => {
  try {
    await prisma.liveSession.update({
      where: { id: req.params.id },
      data: { viewerCount: { increment: 1 } },
    });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ── LIVE CHAT ─────────────────────────────────────────────────────────────────

// GET /live/:id/messages — chat history
router.get('/:id/messages', async (req, res, next) => {
  try {
    const messages = await prisma.$queryRaw`
      SELECT * FROM live_messages
      WHERE "sessionId" = ${req.params.id}
      ORDER BY "createdAt" ASC
      LIMIT 100
    `;
    res.json({ success: true, data: messages });
  } catch (err) { next(err); }
});

// GET /live/:id/questions — unanswered Q&A
router.get('/:id/questions', async (req, res, next) => {
  try {
    const questions = await prisma.$queryRaw`
      SELECT * FROM live_messages
      WHERE "sessionId" = ${req.params.id}
        AND "isQuestion" = true
      ORDER BY "createdAt" ASC
      LIMIT 50
    `;
    res.json({ success: true, data: questions });
  } catch (err) { next(err); }
});

// ── PINNED PRODUCTS ───────────────────────────────────────────────────────────

// GET /live/:id/pinned
router.get('/:id/pinned', async (req, res, next) => {
  try {
    const pinned = await prisma.$queryRaw`
      SELECT lp.*, p.name, p.price, p.images, p.unit, p.stock, p.slug
      FROM live_pinned_products lp
      JOIN products p ON p.id = lp."productId"
      WHERE lp."sessionId" = ${req.params.id} AND lp."isPinned" = true
        AND (lp."endsAt" IS NULL OR lp."endsAt" > NOW())
      ORDER BY lp."sortOrder" ASC
    `;
    res.json({ success: true, data: pinned });
  } catch (err) { next(err); }
});

// POST /live/:id/pin — REST fallback for product pinning
router.post('/:id/pin', protect, restrictTo('SELLER', 'ADMIN'), async (req, res, next) => {
  try {
    const { productId, specialPrice, limitedStock, durationSeconds } = req.body;
    if (!productId) throw new AppError('productId required.', 400);

    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, name: true, price: true, images: true, unit: true, stock: true, slug: true },
    });
    if (!product) throw new AppError('Product not found.', 404);

    const endsAt = durationSeconds ? new Date(Date.now() + durationSeconds * 1000) : null;
    const pinId  = require('crypto').randomUUID();

    await prisma.$queryRaw`
      INSERT INTO live_pinned_products (id, "sessionId", "productId", "specialPrice", "limitedStock", "endsAt", "isPinned")
      VALUES (${pinId}, ${req.params.id}, ${productId}, ${specialPrice || null}, ${limitedStock || null}, ${endsAt}, true)
    `;

    // Broadcast via socket
    const io = getIO();
    if (io) {
      io.to(`live:${req.params.id}`).emit('live:product_pinned', {
        pinId, sessionId: req.params.id, ...product,
        specialPrice: specialPrice || product.price,
        originalPrice: product.price,
        limitedStock: limitedStock || product.stock,
        endsAt: endsAt?.toISOString(),
        discount: specialPrice ? Math.round((1 - specialPrice / product.price) * 100) : 0,
      });
    }

    // Reserve stock in Redis for live deal
    if (limitedStock && isAvailable()) {
      const redis = getRedis();
      await redis.set(`live:stock:${pinId}`, limitedStock, { EX: durationSeconds || 3600 });
    }

    res.status(201).json({ success: true, data: { pinId } });
  } catch (err) { next(err); }
});

// POST /live/:id/buy — atomic stock decrement via Redis for live purchases
router.post('/:id/buy', protect, async (req, res, next) => {
  try {
    const { pinId, quantity = 1 } = req.body;
    if (!pinId) throw new AppError('pinId required.', 400);

    // Atomic Redis decrement — prevents overselling
    if (isAvailable()) {
      const redis = getRedis();
      const stockKey = `live:stock:${pinId}`;
      const remaining = await redis.decrBy(stockKey, quantity);
      if (remaining < 0) {
        // Rollback
        await redis.incrBy(stockKey, quantity);
        throw new AppError('Sorry, this item just sold out!', 409);
      }

      // Broadcast updated stock to all viewers
      const io = getIO();
      if (io) {
        const sessionId = req.params.id;
        io.to(`live:${sessionId}`).emit('live:stock_update', {
          pinId, remaining: Math.max(0, remaining),
        });
      }
    }

    res.json({ success: true, message: 'Stock reserved. Complete checkout to confirm.' });
  } catch (err) { next(err); }
});

// ── SESSION ANALYTICS ─────────────────────────────────────────────────────────

// GET /live/:id/analytics
router.get('/:id/analytics', protect, restrictTo('SELLER', 'ADMIN'), async (req, res, next) => {
  try {
    const session = await prisma.liveSession.findUnique({ where: { id: req.params.id } });
    if (!session) throw new AppError('Session not found.', 404);

    const [msgResult, questionResult] = await Promise.all([
      prisma.$queryRaw`SELECT COUNT(*) as count FROM live_messages WHERE "sessionId" = ${req.params.id}`,
      prisma.$queryRaw`SELECT COUNT(*) as count FROM live_messages WHERE "sessionId" = ${req.params.id} AND "isQuestion" = true`,
    ]);

    const duration = session.startedAt && session.endedAt
      ? Math.round((new Date(session.endedAt).getTime() - new Date(session.startedAt).getTime()) / 60000)
      : session.startedAt
        ? Math.round((Date.now() - new Date(session.startedAt).getTime()) / 60000)
        : null;

    // Get pinned products performance
    const pinnedProducts = await prisma.$queryRaw`
      SELECT lp."productId", p.name, lp."specialPrice", lp."limitedStock", lp."createdAt"
      FROM live_pinned_products lp
      JOIN products p ON p.id = lp."productId"
      WHERE lp."sessionId" = ${req.params.id}
      ORDER BY lp."createdAt" ASC
    `;

    res.json({
      success: true,
      data: {
        sessionId: req.params.id,
        title: session.title,
        status: session.status,
        peakViewers: session.peakViewers,
        currentViewers: session.viewerCount,
        totalMessages: Number((msgResult)[0]?.count || 0),
        totalQuestions: Number((questionResult)[0]?.count || 0),
        durationMinutes: duration,
        startedAt: session.startedAt,
        endedAt: session.endedAt,
        pinnedProducts,
        engagementRate: session.peakViewers > 0
          ? Math.round((Number((msgResult)[0]?.count || 0) / session.peakViewers) * 100)
          : 0,
      },
    });
  } catch (err) { next(err); }
});

// GET /live/:id/highlights — AI-generated session summary
router.get('/:id/highlights', async (req, res, next) => {
  try {
    // Check Redis cache first
    if (isAvailable()) {
      const cached = await getRedis().get(`live:highlights:${req.params.id}`).catch(() => null);
      if (cached) return res.json({ success: true, data: JSON.parse(cached) });
    }

    const highlights = await generateSessionHighlights(req.params.id, '');
    res.json({ success: true, data: highlights });
  } catch (err) { next(err); }
});

// ── HELPER FUNCTIONS ──────────────────────────────────────────────────────────

// Notify all followers when seller goes live
async function notifyFollowersLive(sellerId, sellerName, sessionId, sessionTitle) {
  const followers = await prisma.$queryRaw`
    SELECT sf."userId", u."fcmToken", u."telegramChatId", u.name
    FROM seller_follows sf
    JOIN users u ON u.id = sf."userId"
    WHERE sf."sellerId" = ${sellerId}
    LIMIT 500
  `;

  const liveUrl = `${process.env.CLIENT_URL || 'http://localhost:3000'}/live`;

  await Promise.allSettled(followers.map(async (follower) => {
    // In-app notification
    await createNotification(
      follower.userId,
      'PROMO',
      `🔴 ${sellerName} is LIVE now!`,
      `${sessionTitle} — Watch and shop live deals`,
      { sessionId, type: 'LIVE_STARTED', url: liveUrl }
    );

    // Telegram notification
    if (follower.telegramChatId) {
      const telegramSvc = require('./telegram.service').getBot?.();
      if (telegramSvc) {
        await telegramSvc.sendMessage(
          follower.telegramChatId,
          `🔴 *${sellerName} is LIVE now!*\n\n📺 ${sessionTitle}\n\nWatch and buy live deals:`,
          {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [[{ text: '▶️ Watch Live', url: liveUrl }]],
            },
          }
        ).catch(() => {});
      }
    }
  }));

  logger.info(`[Live] Notified ${followers.length} followers for seller ${sellerId}`);
}

// Generate AI highlights from chat + orders after stream ends
async function generateSessionHighlights(sessionId, sessionTitle) {
  try {
    // Get top messages and questions
    const messages = await prisma.$queryRaw`
      SELECT content, "isQuestion", "userName", type
      FROM live_messages
      WHERE "sessionId" = ${sessionId}
      ORDER BY "createdAt" ASC
      LIMIT 50
    `;

    const questions = messages.filter(m => m.isQuestion).map(m => m.content);
    const chatSample = messages.filter(m => !m.isQuestion).slice(0, 20).map(m => m.content).join('. ');

    if (!questions.length && !chatSample) {
      return { summary: null, topQuestions: [], keyMoments: [] };
    }

    let summary = null;
    let topQuestions = questions.slice(0, 5);

    // Use Groq to generate summary
    if (process.env.GROQ_API_KEY) {
      try {
        const Groq = require('groq-sdk');
        const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

        const prompt = `You are summarizing a live commerce session on Hafa Market (Ethiopian agricultural marketplace).

Session: "${sessionTitle}"
Chat sample: "${chatSample.slice(0, 500)}"
Top questions from viewers: ${questions.slice(0, 5).join('; ')}

Generate a JSON response with:
1. "summary": 2-sentence summary of what happened in the live session
2. "topQuestions": array of the 3 most important viewer questions
3. "keyMoments": array of 3 key moments/highlights from the session
4. "amharicSummary": 1-sentence summary in Amharic

Reply with ONLY valid JSON.`;

        const completion = await groq.chat.completions.create({
          model: process.env.GROQ_MODEL || 'llama-3.1-8b-instant',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 400,
          temperature: 0.3,
        });

        const raw = completion.choices[0].message.content.trim();
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          summary = parsed.summary;
          topQuestions = parsed.topQuestions || topQuestions;

          const result = {
            summary: parsed.summary,
            amharicSummary: parsed.amharicSummary,
            topQuestions: parsed.topQuestions || [],
            keyMoments: parsed.keyMoments || [],
            generatedAt: new Date().toISOString(),
          };

          // Cache in Redis for 24h
          if (isAvailable()) {
            await getRedis().set(
              `live:highlights:${sessionId}`,
              JSON.stringify(result),
              { EX: 86400 }
            ).catch(() => {});
          }

          return result;
        }
      } catch (groqErr) {
        logger.warn('Groq highlights generation failed:', groqErr.message);
      }
    }

    return {
      summary: `Live session with ${messages.length} chat messages and ${questions.length} viewer questions.`,
      topQuestions,
      keyMoments: [],
      generatedAt: new Date().toISOString(),
    };
  } catch (err) {
    logger.warn('generateSessionHighlights failed:', err.message);
    return { summary: null, topQuestions: [], keyMoments: [] };
  }
}

module.exports = router;

// ─────────────────────────────────────────────────────────────────────────────
// LIVE AUCTION ENDPOINTS (Whatnot-style)
// ─────────────────────────────────────────────────────────────────────────────

// POST /live/:id/auction/start — seller starts an auction for a product
router.post('/:id/auction/start', protect, restrictTo('SELLER', 'ADMIN'), async (req, res, next) => {
  try {
    const { productId, startPrice, durationSecs = 60, minIncrement = 5 } = req.body;
    if (!productId || !startPrice) throw new AppError('productId and startPrice required.', 400);

    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, name: true, price: true, images: true, unit: true, stock: true, slug: true, nameAm: true },
    });
    if (!product) throw new AppError('Product not found.', 404);

    const endsAt = new Date(Date.now() + durationSecs * 1000);
    const auctionId = require('crypto').randomUUID();

    await prisma.$queryRaw`
      INSERT INTO live_auctions (id, "sessionId", "productId", "startPrice", "currentPrice", "minIncrement", "durationSecs", "endsAt", status)
      VALUES (${auctionId}, ${req.params.id}, ${productId}, ${startPrice}, ${startPrice}, ${minIncrement}, ${durationSecs}, ${endsAt}, 'ACTIVE')
    `;

    // Broadcast to all viewers
    const io = getIO();
    if (io) {
      io.to(`live:${req.params.id}`).emit('live:auction_started', {
        auctionId,
        sessionId: req.params.id,
        product,
        startPrice,
        currentPrice: startPrice,
        minIncrement,
        endsAt: endsAt.toISOString(),
        durationSecs,
        leaderId: null,
        leaderName: null,
        bidCount: 0,
      });
    }

    // Auto-end auction when timer expires
    setTimeout(async () => {
      try {
        const rows = await prisma.$queryRaw`
          SELECT * FROM live_auctions WHERE id = ${auctionId} AND status = 'ACTIVE'
        `;
        if (!rows.length) return;
        const auction = rows[0];

        await prisma.$queryRaw`
          UPDATE live_auctions
          SET status = 'ENDED', "winnerId" = ${auction.leaderId}, "winnerName" = ${auction.leaderName}, "finalPrice" = ${auction.currentPrice}
          WHERE id = ${auctionId}
        `;

        const io2 = getIO();
        if (io2) {
          io2.to(`live:${req.params.id}`).emit('live:auction_ended', {
            auctionId,
            sessionId: req.params.id,
            winnerId: auction.leaderId,
            winnerName: auction.leaderName,
            finalPrice: auction.currentPrice,
            productId,
            productName: product.name,
          });
        }

        logger.info(`[Auction] ${auctionId} ended. Winner: ${auction.leaderName} @ ETB ${auction.currentPrice}`);
      } catch (err) {
        logger.warn('[Auction] Auto-end failed:', err.message);
      }
    }, durationSecs * 1000);

    res.status(201).json({ success: true, data: { auctionId, endsAt } });
  } catch (err) { next(err); }
});

// POST /live/:id/auction/:auctionId/bid — place a bid
router.post('/:id/auction/:auctionId/bid', protect, async (req, res, next) => {
  try {
    const { amount } = req.body;
    const { id: sessionId, auctionId } = req.params;
    if (!amount) throw new AppError('amount required.', 400);

    // Get current auction state
    const rows = await prisma.$queryRaw`
      SELECT * FROM live_auctions WHERE id = ${auctionId} AND status = 'ACTIVE'
    `;
    if (!rows.length) throw new AppError('Auction not found or already ended.', 404);
    const auction = rows[0];

    if (new Date(auction.endsAt) < new Date()) throw new AppError('Auction has ended.', 400);
    if (amount < auction.currentPrice + auction.minIncrement) {
      throw new AppError(`Minimum bid is ETB ${(auction.currentPrice + auction.minIncrement).toFixed(0)}`, 400);
    }

    const user = await prisma.user.findUnique({ where: { id: req.user.id }, select: { name: true } });
    const bidId = require('crypto').randomUUID();

    // Record bid
    await prisma.$queryRaw`
      INSERT INTO auction_bids (id, "sessionId", "productId", "auctionId", "userId", "userName", amount)
      VALUES (${bidId}, ${sessionId}, ${auction.productId}, ${auctionId}, ${req.user.id}, ${user.name}, ${amount})
    `;

    // Update auction current price + leader
    await prisma.$queryRaw`
      UPDATE live_auctions
      SET "currentPrice" = ${amount}, "leaderId" = ${req.user.id}, "leaderName" = ${user.name}
      WHERE id = ${auctionId}
    `;

    // Broadcast new bid to all viewers
    const io = getIO();
    if (io) {
      io.to(`live:${sessionId}`).emit('live:auction_bid', {
        auctionId,
        sessionId,
        bidId,
        userId: req.user.id,
        userName: user.name,
        amount,
        isYou: false, // client overrides this
      });
    }

    res.json({ success: true, data: { bidId, amount, leaderId: req.user.id, leaderName: user.name } });
  } catch (err) { next(err); }
});

// GET /live/:id/auction/active — get current active auction
router.get('/:id/auction/active', async (req, res, next) => {
  try {
    const rows = await prisma.$queryRaw`
      SELECT la.*, p.name, p.images, p.unit, p."nameAm",
        (SELECT COUNT(*) FROM auction_bids WHERE "auctionId" = la.id) as "bidCount"
      FROM live_auctions la
      JOIN products p ON p.id = la."productId"
      WHERE la."sessionId" = ${req.params.id} AND la.status = 'ACTIVE'
      ORDER BY la."createdAt" DESC
      LIMIT 1
    `;
    res.json({ success: true, data: rows[0] || null });
  } catch (err) { next(err); }
});

// POST /live/:id/auction/:auctionId/checkout — winner places order after winning
router.post('/:id/auction/:auctionId/checkout', protect, async (req, res, next) => {
  try {
    const { addressId, paymentMethod = 'CASH_ON_DELIVERY' } = req.body;
    const { auctionId } = req.params;

    const rows = await prisma.$queryRaw`
      SELECT * FROM live_auctions WHERE id = ${auctionId} AND status = 'ENDED' AND "winnerId" = ${req.user.id}
    `;
    if (!rows.length) throw new AppError('You did not win this auction.', 403);
    const auction = rows[0];

    // Create order at winning price
    const order = await prisma.order.create({
      data: {
        userId: req.user.id,
        addressId,
        subtotal: auction.finalPrice,
        deliveryFee: auction.finalPrice >= 50 ? 0 : 3.99,
        discount: 0,
        total: auction.finalPrice + (auction.finalPrice >= 50 ? 0 : 3.99),
        notes: `Won live auction ${auctionId}`,
        items: {
          create: [{
            productId: auction.productId,
            productName: 'Auction item',
            quantity: 1,
            unitPrice: auction.finalPrice,
            totalPrice: auction.finalPrice,
            unit: 'piece',
          }],
        },
        payment: { create: { amount: auction.finalPrice, method: paymentMethod, status: 'PENDING' } },
        delivery: { create: { status: 'PENDING' } },
        statusHistory: { create: { status: 'PENDING', note: 'Placed via live auction' } },
      },
    });

    res.status(201).json({ success: true, data: order });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────────────────────
// GROUP BUY ENDPOINTS (Pinduoduo-style)
// ─────────────────────────────────────────────────────────────────────────────

// POST /live/:id/groupbuy/start — seller starts a group buy
router.post('/:id/groupbuy/start', protect, restrictTo('SELLER', 'ADMIN'), async (req, res, next) => {
  try {
    const { productId, basePrice, tiers, durationMins = 30 } = req.body;
    // tiers example: [{ qty: 5, price: 60 }, { qty: 10, price: 50 }, { qty: 20, price: 40 }]
    if (!productId || !basePrice || !tiers?.length) {
      throw new AppError('productId, basePrice and tiers required.', 400);
    }

    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, name: true, price: true, images: true, unit: true, stock: true, slug: true, nameAm: true },
    });
    if (!product) throw new AppError('Product not found.', 404);

    const sortedTiers = [...tiers].sort((a, b) => a.qty - b.qty);
    const endsAt = durationMins ? new Date(Date.now() + durationMins * 60 * 1000) : null;
    const groupBuyId = require('crypto').randomUUID();

    await prisma.$queryRaw`
      INSERT INTO group_buy_sessions (id, "sessionId", "productId", "basePrice", tiers, "currentQty", "currentPrice", status, "endsAt")
      VALUES (${groupBuyId}, ${req.params.id}, ${productId}, ${basePrice}, ${JSON.stringify(sortedTiers)}::jsonb, 0, ${basePrice}, 'OPEN', ${endsAt})
    `;

    const io = getIO();
    if (io) {
      io.to(`live:${req.params.id}`).emit('live:groupbuy_started', {
        groupBuyId,
        sessionId: req.params.id,
        product,
        basePrice,
        currentPrice: basePrice,
        tiers: sortedTiers,
        currentQty: 0,
        endsAt: endsAt?.toISOString(),
        nextTier: sortedTiers[0] || null,
      });
    }

    res.status(201).json({ success: true, data: { groupBuyId, endsAt } });
  } catch (err) { next(err); }
});

// POST /live/:id/groupbuy/:groupBuyId/join — buyer joins group buy
router.post('/:id/groupbuy/:groupBuyId/join', protect, async (req, res, next) => {
  try {
    const { quantity = 1 } = req.body;
    const { id: sessionId, groupBuyId } = req.params;

    const rows = await prisma.$queryRaw`
      SELECT * FROM group_buy_sessions WHERE id = ${groupBuyId} AND status = 'OPEN'
    `;
    if (!rows.length) throw new AppError('Group buy not found or closed.', 404);
    const gb = rows[0];

    if (gb.endsAt && new Date(gb.endsAt) < new Date()) throw new AppError('Group buy has expired.', 400);

    const user = await prisma.user.findUnique({ where: { id: req.user.id }, select: { name: true } });

    // Upsert participant
    const participantId = require('crypto').randomUUID();
    await prisma.$queryRaw`
      INSERT INTO group_buy_participants (id, "groupBuyId", "userId", "userName", quantity, "priceLocked")
      VALUES (${participantId}, ${groupBuyId}, ${req.user.id}, ${user.name}, ${quantity}, ${gb.currentPrice})
      ON CONFLICT ("groupBuyId", "userId") DO UPDATE SET quantity = ${quantity}
    `;

    // Recalculate total qty
    const [{ total }] = await prisma.$queryRaw`
      SELECT SUM(quantity) as total FROM group_buy_participants WHERE "groupBuyId" = ${groupBuyId}
    `;
    const newQty = Number(total);

    // Find new price tier
    const tiers = gb.tiers;
    let newPrice = gb.basePrice;
    for (const tier of tiers) {
      if (newQty >= tier.qty) newPrice = tier.price;
    }

    // Update group buy
    await prisma.$queryRaw`
      UPDATE group_buy_sessions SET "currentQty" = ${newQty}, "currentPrice" = ${newPrice} WHERE id = ${groupBuyId}
    `;

    // Find next tier
    const nextTier = tiers.find((t) => t.qty > newQty) || null;

    // Broadcast update to all viewers
    const io = getIO();
    if (io) {
      io.to(`live:${sessionId}`).emit('live:groupbuy_update', {
        groupBuyId,
        sessionId,
        currentQty: newQty,
        currentPrice: newPrice,
        nextTier,
        latestJoiner: user.name,
        priceDropped: newPrice < gb.currentPrice,
      });
    }

    res.json({
      success: true,
      data: {
        groupBuyId,
        currentQty: newQty,
        currentPrice: newPrice,
        priceLocked: newPrice,
        nextTier,
      },
    });
  } catch (err) { next(err); }
});

// GET /live/:id/groupbuy/active — get active group buys in session
router.get('/:id/groupbuy/active', async (req, res, next) => {
  try {
    const rows = await prisma.$queryRaw`
      SELECT gb.*, p.name, p.images, p.unit, p."nameAm",
        (SELECT COUNT(*) FROM group_buy_participants WHERE "groupBuyId" = gb.id) as "participantCount"
      FROM group_buy_sessions gb
      JOIN products p ON p.id = gb."productId"
      WHERE gb."sessionId" = ${req.params.id} AND gb.status = 'OPEN'
        AND (gb."endsAt" IS NULL OR gb."endsAt" > NOW())
      ORDER BY gb."createdAt" DESC
    `;
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

// POST /live/:id/groupbuy/:groupBuyId/checkout — participant places order
router.post('/:id/groupbuy/:groupBuyId/checkout', protect, async (req, res, next) => {
  try {
    const { addressId, paymentMethod = 'CASH_ON_DELIVERY' } = req.body;
    const { groupBuyId } = req.params;

    // Get participant's locked price
    const parts = await prisma.$queryRaw`
      SELECT * FROM group_buy_participants WHERE "groupBuyId" = ${groupBuyId} AND "userId" = ${req.user.id}
    `;
    if (!parts.length) throw new AppError('You have not joined this group buy.', 403);
    const participant = parts[0];

    const gb = await prisma.$queryRaw`SELECT * FROM group_buy_sessions WHERE id = ${groupBuyId}`;
    if (!gb.length) throw new AppError('Group buy not found.', 404);

    const finalPrice = gb[0].currentPrice; // use current (best) price
    const qty = participant.quantity;

    const order = await prisma.order.create({
      data: {
        userId: req.user.id,
        addressId,
        subtotal: finalPrice * qty,
        deliveryFee: finalPrice * qty >= 50 ? 0 : 3.99,
        discount: 0,
        total: finalPrice * qty + (finalPrice * qty >= 50 ? 0 : 3.99),
        notes: `Group buy order — ${qty} units @ ETB ${finalPrice}`,
        items: {
          create: [{
            productId: gb[0].productId,
            productName: 'Group buy item',
            quantity: qty,
            unitPrice: finalPrice,
            totalPrice: finalPrice * qty,
            unit: 'piece',
          }],
        },
        payment: { create: { amount: finalPrice * qty, method: paymentMethod, status: 'PENDING' } },
        delivery: { create: { status: 'PENDING' } },
        statusHistory: { create: { status: 'PENDING', note: 'Placed via live group buy' } },
      },
    });

    // Mark participant as ordered
    await prisma.$queryRaw`
      UPDATE group_buy_participants SET "orderId" = ${order.id} WHERE id = ${participant.id}
    `;

    res.status(201).json({ success: true, data: order });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────────────────────
// LIVE BULK PURCHASE ENDPOINTS
// One buyer, multiple units, quantity-based discounts
// ─────────────────────────────────────────────────────────────────────────────

// POST /live/:id/bulk/start — seller creates a bulk deal
router.post('/:id/bulk/start', protect, restrictTo('SELLER', 'ADMIN'), async (req, res, next) => {
  try {
    const { productId, basePrice, tiers, maxQty, durationMins = 0 } = req.body;
    // tiers: [{ minQty: 5, discount: 10 }, { minQty: 10, discount: 20 }, { minQty: 20, discount: 30 }]
    if (!productId || !basePrice || !tiers?.length) {
      throw new AppError('productId, basePrice and tiers required.', 400);
    }

    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, name: true, price: true, images: true, unit: true, stock: true, slug: true, nameAm: true },
    });
    if (!product) throw new AppError('Product not found.', 404);

    // Compute price for each tier
    const sortedTiers = [...tiers]
      .sort((a, b) => a.minQty - b.minQty)
      .map(t => ({
        minQty: t.minQty,
        discount: t.discount,
        price: parseFloat((basePrice * (1 - t.discount / 100)).toFixed(2)),
      }));

    const endsAt = durationMins > 0 ? new Date(Date.now() + durationMins * 60 * 1000) : null;
    const bulkId = require('crypto').randomUUID();

    await prisma.$queryRaw`
      INSERT INTO live_bulk_deals (id, "sessionId", "productId", "basePrice", tiers, "maxQty", status, "endsAt")
      VALUES (${bulkId}, ${req.params.id}, ${productId}, ${basePrice}, ${JSON.stringify(sortedTiers)}::jsonb, ${maxQty || null}, 'ACTIVE', ${endsAt})
    `;

    const io = getIO();
    if (io) {
      io.to(`live:${req.params.id}`).emit('live:bulk_started', {
        bulkId,
        sessionId: req.params.id,
        product,
        basePrice,
        tiers: sortedTiers,
        maxQty: maxQty || null,
        totalSold: 0,
        endsAt: endsAt?.toISOString(),
      });
    }

    res.status(201).json({ success: true, data: { bulkId, tiers: sortedTiers, endsAt } });
  } catch (err) { next(err); }
});

// GET /live/:id/bulk/active — get active bulk deals
router.get('/:id/bulk/active', async (req, res, next) => {
  try {
    const rows = await prisma.$queryRaw`
      SELECT bd.*, p.name, p.images, p.unit, p."nameAm", p.stock
      FROM live_bulk_deals bd
      JOIN products p ON p.id = bd."productId"
      WHERE bd."sessionId" = ${req.params.id}
        AND bd.status = 'ACTIVE'
        AND (bd."endsAt" IS NULL OR bd."endsAt" > NOW())
      ORDER BY bd."createdAt" DESC
    `;
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

// POST /live/:id/bulk/:bulkId/order — buyer places a bulk order
router.post('/:id/bulk/:bulkId/order', protect, async (req, res, next) => {
  try {
    const { quantity, addressId, paymentMethod = 'CASH_ON_DELIVERY' } = req.body;
    const { id: sessionId, bulkId } = req.params;

    if (!quantity || quantity < 1) throw new AppError('quantity required.', 400);
    if (!addressId) throw new AppError('addressId required.', 400);

    // Get bulk deal
    const rows = await prisma.$queryRaw`
      SELECT bd.*, p.name, p.unit, p.stock
      FROM live_bulk_deals bd
      JOIN products p ON p.id = bd."productId"
      WHERE bd.id = ${bulkId} AND bd.status = 'ACTIVE'
        AND (bd."endsAt" IS NULL OR bd."endsAt" > NOW())
    `;
    if (!rows.length) throw new AppError('Bulk deal not found or expired.', 404);
    const deal = rows[0];

    // Check max qty per buyer
    if (deal.maxQty && quantity > deal.maxQty) {
      throw new AppError(`Maximum ${deal.maxQty} ${deal.unit} per buyer.`, 400);
    }

    // Check stock
    if (deal.stock < quantity) {
      throw new AppError(`Only ${deal.stock} ${deal.unit} available.`, 400);
    }

    // Find applicable tier price
    const tiers = deal.tiers;
    let unitPrice = deal.basePrice;
    let appliedDiscount = 0;
    for (const tier of tiers) {
      if (quantity >= tier.minQty) {
        unitPrice = tier.price;
        appliedDiscount = tier.discount;
      }
    }

    const subtotal = unitPrice * quantity;
    const deliveryFee = subtotal >= 50 ? 0 : 3.99;
    const total = subtotal + deliveryFee;

    // Create order using existing order system
    const order = await prisma.order.create({
      data: {
        userId: req.user.id,
        addressId,
        subtotal,
        deliveryFee,
        discount: (deal.basePrice - unitPrice) * quantity, // show savings
        total,
        notes: `Live bulk order — ${quantity} ${deal.unit} @ ETB ${unitPrice} (${appliedDiscount}% off)`,
        items: {
          create: [{
            productId: deal.productId,
            productName: deal.name,
            quantity,
            unitPrice,
            totalPrice: subtotal,
            unit: deal.unit,
          }],
        },
        payment: { create: { amount: total, method: paymentMethod, status: 'PENDING' } },
        delivery: { create: { status: 'PENDING' } },
        statusHistory: { create: { status: 'PENDING', note: `Live bulk order — ${appliedDiscount}% discount applied` } },
      },
    });

    // Update total sold on the deal
    await prisma.$queryRaw`
      UPDATE live_bulk_deals SET "totalSold" = "totalSold" + ${quantity} WHERE id = ${bulkId}
    `;

    // Broadcast social proof + updated sold count
    const io = getIO();
    if (io) {
      const user = await prisma.user.findUnique({ where: { id: req.user.id }, select: { name: true } });
      io.to(`live:${sessionId}`).emit('live:bulk_order', {
        bulkId,
        sessionId,
        buyerName: user?.name?.split(' ')[0] || 'Someone',
        quantity,
        unitPrice,
        discount: appliedDiscount,
        unit: deal.unit,
        productName: deal.name,
        newTotalSold: deal.totalSold + quantity,
      });
    }

    res.status(201).json({
      success: true,
      data: {
        orderId: order.id,
        quantity,
        unitPrice,
        discount: appliedDiscount,
        subtotal,
        deliveryFee,
        total,
        savings: (deal.basePrice - unitPrice) * quantity,
      },
    });
  } catch (err) { next(err); }
});

// PATCH /live/:id/bulk/:bulkId/end — seller ends a bulk deal
router.patch('/:id/bulk/:bulkId/end', protect, restrictTo('SELLER', 'ADMIN'), async (req, res, next) => {
  try {
    await prisma.$queryRaw`
      UPDATE live_bulk_deals SET status = 'ENDED' WHERE id = ${req.params.bulkId}
    `;
    const io = getIO();
    if (io) {
      io.to(`live:${req.params.id}`).emit('live:bulk_ended', {
        bulkId: req.params.bulkId,
        sessionId: req.params.id,
      });
    }
    res.json({ success: true });
  } catch (err) { next(err); }
});
