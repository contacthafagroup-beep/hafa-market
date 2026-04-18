const router = require('express').Router();
const prisma = require('../config/prisma');
const { protect, restrictTo } = require('../middleware/auth.middleware');
const { AppError } = require('../middleware/errorHandler');

router.get('/product/:productId', async (req, res, next) => {
  try {
    const { page=1, limit=10, sort='helpful', verified } = req.query;
    const where = { productId: req.params.productId, moderationStatus: { not: 'HIDDEN' } };
    if (verified === 'true') where.isVerified = true;

    const orderBy = sort === 'helpful'  ? [{ helpfulVotes: 'desc' }, { createdAt: 'desc' }]
                  : sort === 'highest'  ? [{ rating: 'desc' }]
                  : sort === 'lowest'   ? [{ rating: 'asc' }]
                  : [{ createdAt: 'desc' }];

    const [reviews, total, ratingDist] = await Promise.all([
      prisma.review.findMany({
        where, skip: (parseInt(page)-1)*parseInt(limit), take: parseInt(limit),
        orderBy,
        include: { user: { select: { name:true, avatar:true } } },
      }),
      prisma.review.count({ where }),
      // Rating distribution for star bar chart
      prisma.review.groupBy({
        by: ['rating'], where: { productId: req.params.productId },
        _count: { rating: true },
      }),
    ]);

    // Build distribution map { 1:0, 2:3, 3:5, 4:12, 5:20 }
    const dist = { 1:0, 2:0, 3:0, 4:0, 5:0 };
    ratingDist.forEach(r => { dist[r.rating] = r._count.rating; });

    res.json({ success:true, data:reviews, ratingDistribution:dist, pagination:{ page:parseInt(page), limit:parseInt(limit), total } });
  } catch(err) { next(err); }
});

router.post('/', protect, async (req, res, next) => {
  try {
    const { productId, rating, comment, images } = req.body;
    if (rating < 1 || rating > 5) throw new AppError('Rating must be between 1 and 5.', 400);

    // Check if user bought this product
    const purchased = await prisma.orderItem.findFirst({
      where: { productId, order: { userId: req.user.id, status: 'DELIVERED' } },
    });

    // ── Fake review detection (Amazon 3-signal approach) ──────────────────
    let fraudFlags = [];
    let isSuspicious = false;

    // Run all signals in parallel to avoid sequential DB round-trips
    const [recentReviewCount, reviewer, similarReview] = await Promise.all([
      prisma.review.count({
        where: { userId: req.user.id, createdAt: { gte: new Date(Date.now() - 24*3600*1000) } },
      }),
      prisma.user.findUnique({ where: { id: req.user.id }, select: { createdAt: true } }),
      (comment && comment.length > 10)
        ? prisma.review.findFirst({
            where: { comment: { equals: comment, mode: 'insensitive' }, productId: { not: productId } },
          })
        : Promise.resolve(null),
    ]);

    // Signal 1: No verified purchase (lower trust, not blocked)
    if (!purchased) fraudFlags.push('NO_PURCHASE');

    // Signal 2: Burst — 5+ reviews in 24 hours
    if (recentReviewCount >= 5) { fraudFlags.push('BURST_REVIEWS'); isSuspicious = true; }

    // Signal 3: New account (< 7 days) leaving 5-star
    const accountAgeDays = (Date.now() - new Date(reviewer.createdAt).getTime()) / (1000*60*60*24);
    if (accountAgeDays < 7 && rating === 5) { fraudFlags.push('NEW_ACCOUNT_5STAR'); isSuspicious = true; }

    // Signal 4: Exact duplicate comment on a different product
    if (similarReview) { fraudFlags.push('DUPLICATE_COMMENT'); isSuspicious = true; }

    // Signal 5: Anonymous 1-star with no comment from account < 30 days
    if (rating === 1 && !comment && accountAgeDays < 30) { fraudFlags.push('ANONYMOUS_1STAR'); isSuspicious = true; }

    const moderationStatus = isSuspicious ? 'FLAGGED' : 'APPROVED';

    const review = await prisma.review.upsert({
      where: { userId_productId: { userId: req.user.id, productId } },
      update: {
        rating, comment, images: images || [], isVerified: !!purchased,
        isSuspicious, fraudFlags, moderationStatus,
      },
      create: {
        userId: req.user.id, productId, rating, comment,
        images: images || [], isVerified: !!purchased,
        isSuspicious, fraudFlags, moderationStatus,
      },
    });

    // Update product rating
    const stats = await prisma.review.aggregate({ where: { productId }, _avg: { rating: true }, _count: { id: true } });
    await prisma.product.update({ where: { id: productId }, data: { rating: stats._avg.rating || 0, reviewCount: stats._count.id } });

    res.status(201).json({ success: true, data: { ...review, _fraudFlags: isSuspicious ? fraudFlags : undefined } });
  } catch(err) { next(err); }
});

router.delete('/:id', protect, async (req, res, next) => {
  try {
    const review = await prisma.review.findUnique({ where: { id: req.params.id } });
    if (!review) throw new AppError('Review not found.', 404);
    if (review.userId !== req.user.id && req.user.role !== 'ADMIN') throw new AppError('Not authorized.', 403);
    await prisma.review.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: 'Review deleted.' });
  } catch(err) { next(err); }
});

module.exports = router;

// ===== SELLER REVIEWS =====
router.get('/seller/:sellerId', async (req, res, next) => {
  try {
    const { page=1, limit=10 } = req.query;
    // Reviews are on products — aggregate from seller's products
    const reviews = await prisma.review.findMany({
      where: { product: { sellerId: req.params.sellerId } },
      skip: (parseInt(page)-1)*parseInt(limit), take: parseInt(limit),
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { name:true, avatar:true } },
        product: { select: { name:true } },
      },
    });
    const total = await prisma.review.count({ where: { product: { sellerId: req.params.sellerId } } });
    res.json({ success:true, data:reviews, pagination:{ page:parseInt(page), limit:parseInt(limit), total } });
  } catch(err) { next(err); }
});

router.post('/seller', protect, async (req, res, next) => {
  try {
    const { sellerId, rating, comment } = req.body;
    if (!sellerId || !rating) throw new AppError('Seller ID and rating are required.', 400);
    if (rating < 1 || rating > 5) throw new AppError('Rating must be 1–5.', 400);

    // Check if user has bought from this seller
    const purchased = await prisma.orderItem.findFirst({
      where: { product: { sellerId }, order: { userId: req.user.id, status: 'DELIVERED' } },
    });

    // Store as a review on the seller's most recent product (workaround — no SellerReview model)
    // Update seller rating directly
    const seller = await prisma.seller.findUnique({ where: { id: sellerId } });
    if (!seller) throw new AppError('Seller not found.', 404);

    // Calculate new rating (simple average with existing)
    const currentRating = seller.rating || 0;
    const currentCount  = seller.totalSales || 1;
    const newRating = ((currentRating * currentCount) + rating) / (currentCount + 1);

    await prisma.seller.update({
      where: { id: sellerId },
      data: { rating: Math.min(5, parseFloat(newRating.toFixed(2))) },
    });

    // Return a synthetic review object
    res.status(201).json({
      success: true,
      data: {
        id: `sr-${Date.now()}`,
        sellerId, rating, comment,
        user: { name: req.user.name },
        createdAt: new Date().toISOString(),
        isVerified: !!purchased,
      },
    });
  } catch(err) { next(err); }
});

// ===== REVIEW VOTES =====
router.post('/:id/vote', protect, async (req, res, next) => {
  try {
    const { isHelpful } = req.body;
    const review = await prisma.review.findUnique({ where: { id: req.params.id } });
    if (!review) throw new AppError('Review not found.', 404);
    await prisma.reviewVote.upsert({
      where: { reviewId_userId: { reviewId: req.params.id, userId: req.user.id } },
      update: { isHelpful },
      create: { reviewId: req.params.id, userId: req.user.id, isHelpful },
    });
    // Update counts
    const [helpful, unhelpful] = await Promise.all([
      prisma.reviewVote.count({ where: { reviewId: req.params.id, isHelpful: true } }),
      prisma.reviewVote.count({ where: { reviewId: req.params.id, isHelpful: false } }),
    ]);
    await prisma.review.update({ where: { id: req.params.id }, data: { helpfulVotes: helpful, unhelpfulVotes: unhelpful } });
    res.json({ success: true, data: { helpfulVotes: helpful, unhelpfulVotes: unhelpful } });
  } catch (err) { next(err); }
});

// ===== SELLER RESPONSE =====
router.post('/:id/seller-response', protect, async (req, res, next) => {
  try {
    const { response } = req.body;
    if (!response) throw new AppError('Response text is required.', 400);
    const review = await prisma.review.findUnique({ where: { id: req.params.id }, include: { product: { select: { sellerId: true } } } });
    if (!review) throw new AppError('Review not found.', 404);
    const seller = await prisma.seller.findUnique({ where: { userId: req.user.id } });
    if (!seller || seller.id !== review.product.sellerId) throw new AppError('Not authorized.', 403);
    const updated = await prisma.review.update({ where: { id: req.params.id }, data: { sellerResponse: response, sellerResponseAt: new Date() } });
    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
});

// ===== AI REVIEW SUMMARY =====
router.get('/product/:productId/summary', async (req, res, next) => {
  try {
    const reviews = await prisma.review.findMany({ where: { productId: req.params.productId }, take: 20, orderBy: { createdAt: 'desc' }, select: { rating: true, comment: true } });
    if (reviews.length < 3) return res.json({ success: true, data: { summary: null } });
    const avgRating = (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1);
    const comments = reviews.filter(r => r.comment).map(r => r.comment).join('. ');
    try {
      const Groq = require('groq-sdk');
      const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
      const completion = await groq.chat.completions.create({
        model: process.env.GROQ_MODEL || 'llama-3.1-8b-instant',
        messages: [{ role: 'user', content: 'Summarize these product reviews in ONE sentence (max 15 words): ' + comments }],
        max_tokens: 60,
      });
      res.json({ success: true, data: { summary: completion.choices[0].message.content, avgRating, reviewCount: reviews.length } });
    } catch {
      res.json({ success: true, data: { summary: `${reviews.length} reviews · ${avgRating} average rating`, avgRating, reviewCount: reviews.length } });
    }
  } catch (err) { next(err); }
});

// ===== SELLER TRUST SCORE =====
router.get('/seller/:sellerId/trust-score', async (req, res, next) => {
  try {
    const sellerId = req.params.sellerId;
    const [seller, reviews, disputes, orders] = await Promise.all([
      prisma.seller.findUnique({ where: { id: sellerId }, select: { rating: true, totalSales: true, createdAt: true } }),
      prisma.review.aggregate({ where: { product: { sellerId } }, _avg: { rating: true }, _count: { id: true } }),
      prisma.dispute.count({ where: { sellerId, status: { in: ['RESOLVED','CLOSED'] } } }).catch(() => 0),
      prisma.order.count({ where: { items: { some: { product: { sellerId } } }, status: 'DELIVERED' } }),
    ]);
    if (!seller) throw new AppError('Seller not found.', 404);

    const avgRating     = reviews._avg.rating || 0;
    const reviewCount   = reviews._count.id || 0;
    const disputeRate   = orders > 0 ? (disputes / orders) : 0;
    const fulfillRate   = Math.max(0, 1 - disputeRate);
    const accountAgeDays = (Date.now() - new Date(seller.createdAt).getTime()) / (1000*60*60*24);
    const maturityScore = Math.min(accountAgeDays / 180, 1); // max at 6 months

    // Composite trust score 0-100
    const trustScore = Math.round(
      (avgRating / 5) * 40 +          // rating = 40%
      fulfillRate * 30 +               // fulfillment = 30%
      maturityScore * 20 +             // account age = 20%
      Math.min(reviewCount / 50, 1) * 10  // review volume = 10%
    );

    const badge = trustScore >= 85 ? '🥇 Top Seller'
                : trustScore >= 70 ? '⭐ Trusted Seller'
                : trustScore >= 50 ? '✅ Verified Seller'
                : '🆕 New Seller';

    res.json({ success: true, data: { trustScore, badge, avgRating, reviewCount, fulfillRate: Math.round(fulfillRate*100), accountAgeDays: Math.round(accountAgeDays) } });
  } catch(err) { next(err); }
});

// ===== ADMIN — FLAGGED REVIEW MODERATION =====

// GET /reviews/admin/flagged — list all flagged reviews
router.get('/admin/flagged', protect, restrictTo('ADMIN'), async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status = 'FLAGGED' } = req.query;
    const where = { moderationStatus: status };

    const [reviews, total] = await Promise.all([
      prisma.review.findMany({
        where,
        skip: (parseInt(page) - 1) * parseInt(limit),
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, name: true, email: true, createdAt: true } },
          product: { select: { id: true, name: true, images: true } },
        },
      }),
      prisma.review.count({ where }),
    ]);

    // Summary counts for the dashboard header
    const [flaggedCount, hiddenCount, approvedCount] = await Promise.all([
      prisma.review.count({ where: { moderationStatus: 'FLAGGED' } }),
      prisma.review.count({ where: { moderationStatus: 'HIDDEN' } }),
      prisma.review.count({ where: { moderationStatus: 'APPROVED' } }),
    ]);

    res.json({
      success: true,
      data: reviews,
      summary: { flagged: flaggedCount, hidden: hiddenCount, approved: approvedCount },
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) },
    });
  } catch (err) { next(err); }
});

// PATCH /reviews/admin/:id/moderate — approve, hide, or dismiss a flagged review
router.patch('/admin/:id/moderate', protect, restrictTo('ADMIN'), async (req, res, next) => {
  try {
    const { action } = req.body; // 'APPROVE' | 'HIDE' | 'DISMISS'
    if (!['APPROVE', 'HIDE', 'DISMISS'].includes(action)) {
      throw new AppError('Action must be APPROVE, HIDE, or DISMISS.', 400);
    }

    const review = await prisma.review.findUnique({ where: { id: req.params.id } });
    if (!review) throw new AppError('Review not found.', 404);

    const moderationStatus = action === 'APPROVE' ? 'APPROVED'
                           : action === 'HIDE'    ? 'HIDDEN'
                           : 'DISMISSED';

    const updated = await prisma.review.update({
      where: { id: req.params.id },
      data: { moderationStatus, isSuspicious: action !== 'APPROVE' },
    });

    // If hiding, recalculate product rating excluding hidden reviews
    if (action === 'HIDE') {
      const stats = await prisma.review.aggregate({
        where: { productId: review.productId, moderationStatus: { not: 'HIDDEN' } },
        _avg: { rating: true },
        _count: { id: true },
      });
      await prisma.product.update({
        where: { id: review.productId },
        data: { rating: stats._avg.rating || 0, reviewCount: stats._count.id },
      });
    }

    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
});

module.exports = router;
