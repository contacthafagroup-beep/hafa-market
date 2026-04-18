'use strict';
const router = require('express').Router();
const prisma  = require('../config/prisma');
const { protect, restrictTo, optionalAuth } = require('../middleware/auth.middleware');
const { AppError } = require('../middleware/errorHandler');

// ─── 1. ABANDONED CART RECOVERY ──────────────────────────────────────────────
router.post('/cart/abandon', protect, async (req, res, next) => {
  try {
    const items = await prisma.cartItem.findMany({
      where: { userId: req.user.id },
      include: { product: { select: { id:true, name:true, price:true, images:true, unit:true, slug:true } } },
    });
    if (!items.length) return res.json({ success: true });
    await prisma.abandonedCart.upsert({
      where: { id: req.user.id },
      update: { items, isActive: true, sentAt: null },
      create: { id: req.user.id, userId: req.user.id, items, isActive: true },
    }).catch(() => prisma.abandonedCart.create({ data: { userId: req.user.id, items, isActive: true } }));
    res.json({ success: true });
  } catch (err) { next(err); }
});

router.get('/cart/recover/:token', async (req, res, next) => {
  try {
    const cart = await prisma.abandonedCart.findUnique({ where: { recoveryToken: req.params.token } });
    if (!cart || !cart.isActive) return res.redirect(process.env.CLIENT_URL + '/cart');
    await prisma.abandonedCart.update({ where: { id: cart.id }, data: { recoveredAt: new Date(), isActive: false } });
    res.redirect(process.env.CLIENT_URL + '/cart?recovered=1');
  } catch (err) { next(err); }
});

// ─── 2. BNPL ─────────────────────────────────────────────────────────────────
router.post('/bnpl/create', protect, async (req, res, next) => {
  try {
    const { orderId, installments = 2 } = req.body;
    if (![2, 3, 4].includes(installments)) throw new AppError('Installments must be 2, 3, or 4.', 400);
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order || order.userId !== req.user.id) throw new AppError('Order not found.', 404);
    const installmentAmount = order.total / installments;
    const plan = await prisma.bNPLPlan.create({
      data: {
        orderId, userId: req.user.id, totalAmount: order.total, installments,
        nextDueAt: new Date(Date.now() + 30 * 24 * 3600 * 1000),
        payments: {
          create: Array.from({ length: installments }, (_, i) => ({
            amount: installmentAmount,
            dueAt: new Date(Date.now() + (i + 1) * 30 * 24 * 3600 * 1000),
            status: i === 0 ? 'PENDING' : 'PENDING',
          })),
        },
      },
      include: { payments: true },
    });
    res.status(201).json({ success: true, data: plan, message: `Pay ETB ${installmentAmount.toFixed(2)} x ${installments} installments` });
  } catch (err) { next(err); }
});

router.get('/bnpl/my', protect, async (req, res, next) => {
  try {
    const plans = await prisma.bNPLPlan.findMany({
      where: { userId: req.user.id },
      include: { payments: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: plans });
  } catch (err) { next(err); }
});

// ─── 6. PICKUP STATIONS ──────────────────────────────────────────────────────
router.get('/pickup-stations', async (req, res, next) => {
  try {
    const { city } = req.query;
    const stations = await prisma.pickupStation.findMany({
      where: { isActive: true, ...(city && { city: { contains: city, mode: 'insensitive' } }) },
      orderBy: { name: 'asc' },
    });
    res.json({ success: true, data: stations });
  } catch (err) { next(err); }
});

router.post('/pickup-stations', protect, restrictTo('ADMIN'), async (req, res, next) => {
  try {
    const station = await prisma.pickupStation.create({ data: req.body });
    res.status(201).json({ success: true, data: station });
  } catch (err) { next(err); }
});

router.patch('/pickup-stations/:id', protect, restrictTo('ADMIN'), async (req, res, next) => {
  try {
    const station = await prisma.pickupStation.update({ where: { id: req.params.id }, data: req.body });
    res.json({ success: true, data: station });
  } catch (err) { next(err); }
});

router.delete('/pickup-stations/:id', protect, restrictTo('ADMIN'), async (req, res, next) => {
  try {
    await prisma.pickupStation.update({ where: { id: req.params.id }, data: { isActive: false } });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ─── 8. SELLER TIER SYSTEM ───────────────────────────────────────────────────
router.get('/seller-tier/:sellerId', async (req, res, next) => {
  try {
    const tier = await prisma.sellerTier.findUnique({ where: { sellerId: req.params.sellerId } });
    const seller = await prisma.seller.findUnique({ where: { id: req.params.sellerId }, select: { rating: true, totalSales: true } });
    if (!seller) throw new AppError('Seller not found.', 404);
    const score = (seller.rating / 5) * 50 + Math.min(seller.totalSales / 100, 50);
    const tierName = score >= 90 ? 'PLATINUM' : score >= 70 ? 'GOLD' : score >= 40 ? 'SILVER' : 'BRONZE';
    const tierBadge = { PLATINUM: '💎 Platinum', GOLD: '🥇 Gold', SILVER: '🥈 Silver', BRONZE: '🥉 Bronze' };
    res.json({ success: true, data: { tier: tierName, badge: tierBadge[tierName], score: Math.round(score), benefits: getTierBenefits(tierName) } });
  } catch (err) { next(err); }
});

function getTierBenefits(tier) {
  const benefits = {
    BRONZE: ['Basic seller tools', 'Standard support'],
    SILVER: ['Priority listing', 'Reduced commission (4%)', 'Email support'],
    GOLD: ['Top search placement', 'Reduced commission (3%)', 'Priority support', 'Featured in homepage'],
    PLATINUM: ['#1 search placement', 'Lowest commission (2%)', 'Dedicated account manager', 'Featured banner ads'],
  };
  return benefits[tier] || benefits.BRONZE;
}

// ─── 11. AFFILIATE PROGRAM ───────────────────────────────────────────────────
router.post('/affiliate/join', protect, async (req, res, next) => {
  try {
    const existing = await prisma.affiliate.findUnique({ where: { userId: req.user.id } });
    if (existing) return res.json({ success: true, data: existing });
    const code = req.user.id.slice(-6).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase();
    const affiliate = await prisma.affiliate.create({
      data: { userId: req.user.id, code, commission: 0.03 },
    });
    res.status(201).json({ success: true, data: affiliate, message: 'Welcome to the Hafa Market Affiliate Program!' });
  } catch (err) { next(err); }
});

router.get('/affiliate/my', protect, async (req, res, next) => {
  try {
    const affiliate = await prisma.affiliate.findUnique({
      where: { userId: req.user.id },
      include: { clicks: { orderBy: { createdAt: 'desc' }, take: 20 } },
    });
    if (!affiliate) return res.json({ success: true, data: null });
    const link = (process.env.CLIENT_URL || 'https://hafamarket.com') + '?ref=' + affiliate.code;
    res.json({ success: true, data: { ...affiliate, link } });
  } catch (err) { next(err); }
});

router.get('/affiliate/track/:code', optionalAuth, async (req, res, next) => {
  try {
    const affiliate = await prisma.affiliate.findUnique({ where: { code: req.params.code } });
    if (affiliate) {
      await prisma.affiliate.update({ where: { id: affiliate.id }, data: { totalClicks: { increment: 1 } } });
      await prisma.affiliateClick.create({ data: { affiliateId: affiliate.id } });
    }
    res.redirect((process.env.CLIENT_URL || 'https://hafamarket.com') + '/products');
  } catch (err) { next(err); }
});

// ─── 12. COMPETITOR INTELLIGENCE ─────────────────────────────────────────────
router.get('/seller-intelligence/:productId', protect, restrictTo('SELLER', 'ADMIN'), async (req, res, next) => {
  try {
    const product = await prisma.product.findUnique({
      where: { id: req.params.productId },
      include: { category: true },
    });
    if (!product) throw new AppError('Product not found.', 404);
    const competitors = await prisma.product.findMany({
      where: {
        categoryId: product.categoryId,
        status: 'ACTIVE',
        id: { not: product.id },
      },
      orderBy: { soldCount: 'desc' },
      take: 10,
      select: { id: true, name: true, price: true, rating: true, soldCount: true, seller: { select: { storeName: true } } },
    });
    const avgPrice = competitors.length ? competitors.reduce((s, c) => s + c.price, 0) / competitors.length : product.price;
    const priceRank = competitors.filter(c => c.price < product.price).length + 1;
    const suggestion = product.price > avgPrice * 1.1 ? 'Consider lowering price to be more competitive'
                     : product.price < avgPrice * 0.9 ? 'You have a price advantage — consider slight increase'
                     : 'Your price is competitive';
    res.json({
      success: true,
      data: {
        yourPrice: product.price,
        avgCompetitorPrice: Math.round(avgPrice * 100) / 100,
        priceRank: `#${priceRank} of ${competitors.length + 1}`,
        suggestion,
        competitors: competitors.slice(0, 5),
      },
    });
  } catch (err) { next(err); }
});

// ─── 13. DYNAMIC PRICING SUGGESTIONS ─────────────────────────────────────────
router.get('/pricing-suggestion/:productId', protect, restrictTo('SELLER', 'ADMIN'), async (req, res, next) => {
  try {
    const product = await prisma.product.findUnique({ where: { id: req.params.productId }, include: { category: true } });
    if (!product) throw new AppError('Product not found.', 404);
    const since = new Date(Date.now() - 7 * 24 * 3600 * 1000);
    const [recentSales, categoryAvg, searchDemand] = await Promise.all([
      prisma.orderItem.aggregate({ where: { productId: product.id, order: { createdAt: { gte: since } } }, _sum: { quantity: true }, _count: { id: true } }),
      prisma.product.aggregate({ where: { categoryId: product.categoryId, status: 'ACTIVE' }, _avg: { price: true } }),
      prisma.searchLog.count({ where: { query: { contains: product.name.split(' ')[0], mode: 'insensitive' }, createdAt: { gte: since } } }),
    ]);
    const salesVelocity = recentSales._count.id || 0;
    const avgCategoryPrice = categoryAvg._avg.price || product.price;
    let suggestedPrice = product.price;
    let reason = 'Price is optimal';
    if (salesVelocity > 10 && product.stock < 20) { suggestedPrice = product.price * 1.1; reason = 'High demand + low stock — increase price'; }
    else if (salesVelocity < 2 && product.price > avgCategoryPrice) { suggestedPrice = avgCategoryPrice * 0.95; reason = 'Low sales — reduce to category average'; }
    else if (searchDemand > 50) { suggestedPrice = product.price * 1.05; reason = 'High search demand — slight increase possible'; }
    res.json({ success: true, data: { currentPrice: product.price, suggestedPrice: Math.round(suggestedPrice * 100) / 100, reason, salesVelocity, searchDemand } });
  } catch (err) { next(err); }
});

// ─── 14. DAILY CHECK-IN ───────────────────────────────────────────────────────
router.post('/checkin', protect, async (req, res, next) => {
  try {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const existing = await prisma.dailyCheckIn.findUnique({ where: { userId: req.user.id } });
    if (existing) {
      const lastDate = new Date(existing.lastDate); lastDate.setHours(0, 0, 0, 0);
      const diffDays = Math.floor((today.getTime() - lastDate.getTime()) / 86400000);
      if (diffDays === 0) return res.json({ success: true, data: existing, message: 'Already checked in today!' });
      const newStreak = diffDays === 1 ? existing.streak + 1 : 1;
      const points = Math.min(newStreak * 5, 50);
      const updated = await prisma.dailyCheckIn.update({
        where: { userId: req.user.id },
        data: { streak: newStreak, lastDate: new Date(), totalDays: { increment: 1 } },
      });
      await prisma.user.update({ where: { id: req.user.id }, data: { loyaltyPoints: { increment: points } } });
      return res.json({ success: true, data: updated, pointsEarned: points, message: `Day ${newStreak} streak! +${points} points` });
    }
    const checkin = await prisma.dailyCheckIn.create({ data: { userId: req.user.id } });
    await prisma.user.update({ where: { id: req.user.id }, data: { loyaltyPoints: { increment: 5 } } });
    res.status(201).json({ success: true, data: checkin, pointsEarned: 5, message: 'First check-in! +5 points' });
  } catch (err) { next(err); }
});

router.get('/checkin/status', protect, async (req, res, next) => {
  try {
    const checkin = await prisma.dailyCheckIn.findUnique({ where: { userId: req.user.id } });
    if (!checkin) return res.json({ success: true, data: { canCheckIn: true, streak: 0 } });
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const lastDate = new Date(checkin.lastDate); lastDate.setHours(0, 0, 0, 0);
    const canCheckIn = today.getTime() > lastDate.getTime();
    res.json({ success: true, data: { ...checkin, canCheckIn, nextPoints: Math.min((checkin.streak + 1) * 5, 50) } });
  } catch (err) { next(err); }
});

// ─── 15. WISHLIST SHARING ─────────────────────────────────────────────────────
router.get('/wishlists/shared/:token', async (req, res, next) => {
  try {
    const list = await prisma.sharedWishlist.findUnique({ where: { shareToken: req.params.token } });
    if (!list || !list.isPublic) throw new AppError('Wishlist not found.', 404);
    const products = await prisma.product.findMany({
      where: { id: { in: list.productIds }, status: 'ACTIVE' },
      include: { seller: { select: { storeName: true } }, category: { select: { name: true, emoji: true } } },
    });
    res.json({ success: true, data: { ...list, products } });
  } catch (err) { next(err); }
});

router.post('/wishlists/share', protect, async (req, res, next) => {
  try {
    const { name, description, productIds } = req.body;
    if (!name || !productIds?.length) throw new AppError('name and productIds required.', 400);
    const list = await prisma.sharedWishlist.create({
      data: { userId: req.user.id, name, description, productIds },
    });
    const link = (process.env.CLIENT_URL || 'https://hafamarket.com') + '/wishlist/' + list.shareToken;
    res.status(201).json({ success: true, data: { ...list, link } });
  } catch (err) { next(err); }
});

router.get('/wishlists/my', protect, async (req, res, next) => {
  try {
    const lists = await prisma.sharedWishlist.findMany({ where: { userId: req.user.id }, orderBy: { createdAt: 'desc' } });
    res.json({ success: true, data: lists });
  } catch (err) { next(err); }
});

// ─── 16. FARMER DIRECT ───────────────────────────────────────────────────────
router.get('/farmer-direct', async (req, res, next) => {
  try {
    const { category, city } = req.query;
    const sellers = await prisma.seller.findMany({
      where: {
        status: 'VERIFIED',
        ...(city && { city: { contains: city, mode: 'insensitive' } }),
      },
      include: {
        products: {
          where: { status: 'ACTIVE', ...(category && { category: { slug: category } }) },
          take: 4,
          orderBy: { soldCount: 'desc' },
          include: { category: { select: { name: true, emoji: true } } },
        },
        _count: { select: { products: true } },
      },
      take: 20,
    });
    const farmerDirect = sellers.filter(s => s.products.length > 0).map(s => ({
      id: s.id, storeName: s.storeName, storeSlug: s.storeSlug,
      logo: s.logo, city: s.city, rating: s.rating,
      description: s.description, products: s.products,
      productCount: s._count.products,
      isFarmerDirect: true,
    }));
    res.json({ success: true, data: farmerDirect });
  } catch (err) { next(err); }
});

// ─── 17. FRESHNESS / HARVEST DATE ────────────────────────────────────────────
router.patch('/products/:id/freshness', protect, restrictTo('SELLER', 'ADMIN'), async (req, res, next) => {
  try {
    const { harvestDate, freshnessGuarantee } = req.body;
    const seller = await prisma.seller.findUnique({ where: { userId: req.user.id } });
    const product = await prisma.product.findFirst({ where: { id: req.params.id, sellerId: seller?.id } });
    if (!product) throw new AppError('Product not found.', 404);
    const updated = await prisma.product.update({
      where: { id: req.params.id },
      data: {
        ...(harvestDate && { season: harvestDate }),
        ...(freshnessGuarantee && { origin: freshnessGuarantee }),
      },
    });
    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
});

// ─── 18. COMMUNITY FORUM ─────────────────────────────────────────────────────
router.get('/forum', optionalAuth, async (req, res, next) => {
  try {
    const { category, page = 1, limit = 20 } = req.query;
    const where = { isPublished: true, ...(category && { category }) };
    const [posts, total] = await Promise.all([
      prisma.forumPost.findMany({
        where, skip: (parseInt(page)-1)*parseInt(limit), take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
        include: {
          _count: { select: { replies: true } },
          user: { select: { id: true, name: true, avatar: true } },
        },
      }),
      prisma.forumPost.count({ where }),
    ]);
    // Rename user -> author for frontend compatibility
    const postsWithAuthor = posts.map(({ user, ...p }) => ({ ...p, author: user }));
    res.json({ success: true, data: postsWithAuthor, pagination: { page: parseInt(page), total, pages: Math.ceil(total/parseInt(limit)) } });
  } catch (err) { next(err); }
});

router.post('/forum', protect, async (req, res, next) => {
  try {
    const { title, content, category, tags } = req.body;
    if (!title || !content) throw new AppError('title and content required.', 400);
    const post = await prisma.forumPost.create({
      data: { userId: req.user.id, title, content, category: category || 'GENERAL', tags: tags || [] },
    });
    res.status(201).json({ success: true, data: post });
  } catch (err) { next(err); }
});

router.get('/forum/:id', optionalAuth, async (req, res, next) => {
  try {
    const post = await prisma.forumPost.findUnique({
      where: { id: req.params.id },
      include: {
        replies: {
          orderBy: { createdAt: 'asc' },
          take: 50,
          include: { user: { select: { id: true, name: true, avatar: true } } },
        },
        user: { select: { id: true, name: true, avatar: true } },
      },
    });
    if (!post) throw new AppError('Post not found.', 404);
    await prisma.forumPost.update({ where: { id: req.params.id }, data: { views: { increment: 1 } } });
    // Rename user -> author for frontend compatibility
    const { user, replies, ...rest } = post;
    res.json({
      success: true,
      data: {
        ...rest,
        author: user,
        replies: replies.map(({ user: replyUser, ...r }) => ({ ...r, author: replyUser })),
      },
    });
  } catch (err) { next(err); }
});

router.post('/forum/:id/reply', protect, async (req, res, next) => {
  try {
    const { content } = req.body;
    if (!content) throw new AppError('content required.', 400);
    const reply = await prisma.forumReply.create({
      data: { postId: req.params.id, userId: req.user.id, content },
    });
    res.status(201).json({ success: true, data: reply });
  } catch (err) { next(err); }
});

router.post('/forum/:id/like', protect, async (req, res, next) => {
  try {
    await prisma.forumPost.update({ where: { id: req.params.id }, data: { likes: { increment: 1 } } });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ─── 19. MICRO INSURANCE ─────────────────────────────────────────────────────
router.post('/insurance/add', protect, async (req, res, next) => {
  try {
    const { orderId } = req.body;
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order || order.userId !== req.user.id) throw new AppError('Order not found.', 404);
    const insurance = await prisma.orderInsurance.upsert({
      where: { orderId },
      update: {},
      create: { orderId, userId: req.user.id, premium: 5, status: 'ACTIVE' },
    });
    res.status(201).json({ success: true, data: insurance, message: 'Order insured for ETB 5. Full refund if not delivered.' });
  } catch (err) { next(err); }
});

router.post('/insurance/claim/:orderId', protect, async (req, res, next) => {
  try {
    const { reason } = req.body;
    const insurance = await prisma.orderInsurance.findUnique({ where: { orderId: req.params.orderId } });
    if (!insurance || insurance.userId !== req.user.id) throw new AppError('Insurance not found.', 404);
    if (insurance.status !== 'ACTIVE') throw new AppError('Insurance already claimed or expired.', 400);
    await prisma.orderInsurance.update({
      where: { orderId: req.params.orderId },
      data: { status: 'CLAIMED', claimedAt: new Date(), claimReason: reason },
    });
    res.json({ success: true, message: 'Claim submitted. Refund will be processed within 24 hours.' });
  } catch (err) { next(err); }
});

// ─── 20. LIVE SESSIONS ───────────────────────────────────────────────────────
router.get('/live', async (req, res, next) => {
  try {
    const sessions = await prisma.liveSession.findMany({
      where: { status: { in: ['LIVE', 'SCHEDULED'] } },
      orderBy: [{ status: 'asc' }, { scheduledAt: 'asc' }],
      take: 20,
    });
    res.json({ success: true, data: sessions });
  } catch (err) { next(err); }
});

router.post('/live', protect, restrictTo('SELLER', 'ADMIN'), async (req, res, next) => {
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
    res.status(201).json({ success: true, data: session });
  } catch (err) { next(err); }
});

router.patch('/live/:id/start', protect, restrictTo('SELLER', 'ADMIN'), async (req, res, next) => {
  try {
    const { streamUrl } = req.body;
    const session = await prisma.liveSession.update({
      where: { id: req.params.id },
      data: {
        status: 'LIVE',
        startedAt: new Date(),
        ...(streamUrl && { streamUrl }),
      },
    });
    res.json({ success: true, data: session });
  } catch (err) { next(err); }
});

router.patch('/live/:id/end', protect, restrictTo('SELLER', 'ADMIN'), async (req, res, next) => {
  try {
    const session = await prisma.liveSession.update({
      where: { id: req.params.id },
      data: { status: 'ENDED', endedAt: new Date() },
    });
    res.json({ success: true, data: session });
  } catch (err) { next(err); }
});

router.post('/live/:id/view', optionalAuth, async (req, res, next) => {
  try {
    await prisma.liveSession.update({
      where: { id: req.params.id },
      data: { viewerCount: { increment: 1 } },
    });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ─── WHATSAPP COMMERCE (webhook handler) ─────────────────────────────────────
router.post('/whatsapp/webhook', async (req, res, next) => {
  try {
    const { Body, From } = req.body;
    if (!Body || !From) return res.send('OK');
    const phone = From.replace('whatsapp:', '');
    const message = Body.trim().toLowerCase();
    const { sendSMS } = require('../services/sms.service');
    if (message === 'hi' || message === 'hello' || message === 'start') {
      await sendSMS(phone, 'Welcome to Hafa Market! 🌿\n\nReply with:\n1. Search [product]\n2. Orders\n3. Deals\n\nExample: "Search tomatoes"').catch(() => {});
    } else if (message.startsWith('search ')) {
      const query = message.replace('search ', '');
      const products = await prisma.product.findMany({
        where: { status: 'ACTIVE', name: { contains: query, mode: 'insensitive' } },
        take: 3, orderBy: { soldCount: 'desc' },
      });
      const reply = products.length
        ? products.map(p => `${p.name} - ETB ${p.price}/${p.unit}`).join('\n') + '\n\nOrder at: hafamarket.com'
        : 'No products found for "' + query + '". Try another search.';
      await sendSMS(phone, reply).catch(() => {});
    }
    res.send('OK');
  } catch (err) { res.send('OK'); }
});

// ─── SELLER FINANCING ────────────────────────────────────────────────────────
router.get('/seller-financing/eligibility', protect, restrictTo('SELLER', 'ADMIN'), async (req, res, next) => {
  try {
    const seller = await prisma.seller.findUnique({ where: { userId: req.user.id } });
    if (!seller) throw new AppError('Seller not found.', 404);
    const since = new Date(Date.now() - 90 * 24 * 3600 * 1000); // 90 days
    const revenue = await prisma.orderItem.aggregate({
      where: { product: { sellerId: seller.id }, order: { createdAt: { gte: since }, status: { in: ['CONFIRMED','DELIVERED'] } } },
      _sum: { totalPrice: true },
    });
    const monthlyRevenue = (revenue._sum.totalPrice || 0) / 3;
    const maxLoan = monthlyRevenue * 2; // 2x monthly revenue
    const eligible = monthlyRevenue >= 1000; // min ETB 1000/month
    res.json({
      success: true,
      data: {
        eligible,
        monthlyRevenue: Math.round(monthlyRevenue),
        maxLoanAmount: Math.round(maxLoan),
        interestRate: 0, // 0% — Hafa Market charges commission instead
        repaymentModel: 'Automatic deduction from future sales (10% per order)',
        message: eligible
          ? `You qualify for up to ETB ${Math.round(maxLoan).toLocaleString()} financing`
          : 'Minimum ETB 1,000/month revenue required. Keep selling to qualify!',
      },
    });
  } catch (err) { next(err); }
});

router.post('/seller-financing/apply', protect, restrictTo('SELLER', 'ADMIN'), async (req, res, next) => {
  try {
    const { amount, purpose } = req.body;
    if (!amount || amount <= 0) throw new AppError('Amount is required.', 400);
    const seller = await prisma.seller.findUnique({ where: { userId: req.user.id } });
    if (!seller) throw new AppError('Seller not found.', 404);
    // Store as a payout request with negative amount (loan request)
    const loan = await prisma.payout.create({
      data: {
        sellerId: seller.id,
        amount: parseFloat(amount),
        method: 'SELLER_LOAN',
        accountRef: purpose || 'Working capital',
        status: 'PENDING',
        notes: `Loan application: ETB ${amount} for ${purpose || 'inventory'}`,
      },
    });
    res.status(201).json({
      success: true,
      data: loan,
      message: 'Loan application submitted! Our team will review within 24 hours.',
    });
  } catch (err) { next(err); }
});

// ─── LIVE CHAT REST ENDPOINTS ────────────────────────────────────────────────

// GET chat history for a session (last 100 messages)
router.get('/live/:id/messages', async (req, res, next) => {
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

// GET pinned products for a session
router.get('/live/:id/pinned', async (req, res, next) => {
  try {
    const pinned = await prisma.$queryRaw`
      SELECT lp.*, p.name, p.price, p.images, p.unit, p.stock, p.slug
      FROM live_pinned_products lp
      JOIN products p ON p.id = lp."productId"
      WHERE lp."sessionId" = ${req.params.id} AND lp."isPinned" = true
      ORDER BY lp."sortOrder" ASC
    `;
    res.json({ success: true, data: pinned });
  } catch (err) { next(err); }
});

// POST pin a product (REST fallback if socket not available)
router.post('/live/:id/pin', protect, restrictTo('SELLER', 'ADMIN'), async (req, res, next) => {
  try {
    const { productId, specialPrice, limitedStock, durationSeconds } = req.body;
    if (!productId) throw new AppError('productId required.', 400);
    const endsAt = durationSeconds ? new Date(Date.now() + durationSeconds * 1000) : null;
    const pinId = require('crypto').randomUUID();
    await prisma.$queryRaw`
      INSERT INTO live_pinned_products (id, "sessionId", "productId", "specialPrice", "limitedStock", "endsAt", "isPinned")
      VALUES (${pinId}, ${req.params.id}, ${productId}, ${specialPrice || null}, ${limitedStock || null}, ${endsAt}, true)
    `;
    // Also broadcast via socket
    const { getIO } = require('../socket');
    const io = getIO();
    if (io) {
      const product = await prisma.product.findUnique({
        where: { id: productId },
        select: { id: true, name: true, price: true, images: true, unit: true, stock: true, slug: true },
      });
      io.to(`live:${req.params.id}`).emit('live:product_pinned', {
        pinId, sessionId: req.params.id, product,
        specialPrice: specialPrice || product?.price,
        originalPrice: product?.price,
        limitedStock: limitedStock || product?.stock,
        endsAt: endsAt?.toISOString(),
        discount: specialPrice && product ? Math.round((1 - specialPrice / product.price) * 100) : 0,
      });
    }
    res.status(201).json({ success: true, data: { pinId } });
  } catch (err) { next(err); }
});

// GET live session analytics (for seller dashboard)
router.get('/live/:id/analytics', protect, restrictTo('SELLER', 'ADMIN'), async (req, res, next) => {
  try {
    const session = await prisma.liveSession.findUnique({ where: { id: req.params.id } });
    if (!session) throw new AppError('Session not found.', 404);
    const [msgCount, questionCount] = await Promise.all([
      prisma.$queryRaw`SELECT COUNT(*) as count FROM live_messages WHERE "sessionId" = ${req.params.id}`,
      prisma.$queryRaw`SELECT COUNT(*) as count FROM live_messages WHERE "sessionId" = ${req.params.id} AND "isQuestion" = true`,
    ]);
    const duration = session.startedAt && session.endedAt
      ? Math.round((new Date(session.endedAt) - new Date(session.startedAt)) / 60000)
      : null;
    res.json({
      success: true,
      data: {
        peakViewers: session.peakViewers,
        totalMessages: Number(msgCount[0]?.count || 0),
        totalQuestions: Number(questionCount[0]?.count || 0),
        durationMinutes: duration,
        status: session.status,
      },
    });
  } catch (err) { next(err); }
});

module.exports = router;
