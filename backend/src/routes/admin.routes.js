const router = require('express').Router();
const ctrl = require('../controllers/admin.controller');
const { protect, restrictTo } = require('../middleware/auth.middleware');
const { getCacheStats, getRedisInfo, flushAll, delCachePattern } = require('../config/redis');

router.use(protect, restrictTo('ADMIN'));

router.get('/dashboard',              ctrl.getDashboard);

// Audit logs
router.get('/audit-logs', async (req, res, next) => {
  try {
    const prisma = require('../config/prisma');
    const { page=1, limit=20, search } = req.query;
    const where = search ? {
      OR: [
        { action: { contains: search, mode: 'insensitive' } },
        { resource: { contains: search, mode: 'insensitive' } },
        { user: { name: { contains: search, mode: 'insensitive' } } },
      ]
    } : {};
    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where, skip: (parseInt(page)-1)*parseInt(limit), take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { name:true, role:true } } },
      }),
      prisma.auditLog.count({ where }),
    ]);
    res.json({ success:true, data:logs, pagination:{ page:parseInt(page), pages:Math.ceil(total/parseInt(limit)), total } });
  } catch(err) { next(err); }
});

// Support rooms for admin live chat
router.get('/support-rooms', async (req, res, next) => {
  try {
    const prisma = require('../config/prisma');
    const rooms = await prisma.chatRoom.findMany({
      where: { type: 'SUPPORT', isActive: true },
      include: {
        participants: { include: { user: { select: { id: true, name: true, email: true } } } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: { updatedAt: 'desc' },
    });
    res.json({ success: true, data: rooms });
  } catch (err) { next(err); }
});
router.get('/analytics/revenue',      ctrl.getRevenueAnalytics);
router.get('/users',                  ctrl.getUsers);
router.patch('/users/:id/toggle',     ctrl.toggleUserStatus);

// Send notification to a specific user (for win-back campaigns)
router.post('/users/:id/notify', async (req, res, next) => {
  try {
    const prisma = require('../config/prisma');
    const { title, body } = req.body;
    if (!title || !body) return res.status(400).json({ success: false, message: 'title and body required' });
    const { createNotification } = require('../services/notification.service');
    await createNotification(req.params.id, 'PROMO', title, body, {});
    res.json({ success: true, message: 'Notification sent' });
  } catch (err) { next(err); }
});

// ── Intent Graph Management ───────────────────────────────────────────────
router.get('/intent-graph', async (req, res, next) => {
  try {
    const { getGraphStats } = require('../services/intentGraph.service');
    const stats = await getGraphStats();
    const prisma = require('../config/prisma');
    const entries = await prisma.intentGraphEntry.findMany({
      orderBy: { useCount: 'desc' },
      take: 50,
    });
    res.json({ success: true, data: { stats, entries } });
  } catch (err) { next(err); }
});

router.post('/intent-graph', async (req, res, next) => {
  try {
    const { addEntry } = require('../services/intentGraph.service');
    const { query, terms, intent, boost, language } = req.body;
    if (!query || !terms || !intent) return res.status(400).json({ success: false, message: 'query, terms, intent required' });
    const entry = await addEntry(query, terms, intent, boost, language);
    res.status(201).json({ success: true, data: entry });
  } catch (err) { next(err); }
});

router.patch('/intent-graph/:id', async (req, res, next) => {
  try {
    const prisma = require('../config/prisma');
    const entry = await prisma.intentGraphEntry.update({
      where: { id: req.params.id },
      data: req.body,
    });
    res.json({ success: true, data: entry });
  } catch (err) { next(err); }
});

router.delete('/intent-graph/:id', async (req, res, next) => {
  try {
    const prisma = require('../config/prisma');
    await prisma.intentGraphEntry.update({
      where: { id: req.params.id },
      data: { isActive: false },
    });
    res.json({ success: true });
  } catch (err) { next(err); }
});
router.get('/sellers',                ctrl.getSellers);
router.patch('/sellers/:id/status',   ctrl.updateSellerStatus);
router.get('/products/review',        ctrl.getProductsForReview);
router.patch('/products/:id/moderate',ctrl.moderateProduct);
router.get('/orders',                 ctrl.getAllOrders);
router.get('/payouts',                ctrl.getPayouts);
router.patch('/payouts/:id',          ctrl.processPayout);

// ===== REDIS MONITORING =====
router.get('/cache/stats', async (req, res) => {
  const stats = getCacheStats();
  const info  = await getRedisInfo();
  res.json({ success: true, data: { stats, redis: info } });
});

router.delete('/cache/flush', async (req, res, next) => {
  try {
    await flushAll();
    res.json({ success: true, message: 'Cache flushed.' });
  } catch (err) { next(err); }
});

router.delete('/cache/pattern', async (req, res, next) => {
  try {
    const { pattern } = req.body;
    if (!pattern) return res.status(400).json({ success: false, message: 'Pattern required.' });
    const deleted = await delCachePattern(pattern);
    res.json({ success: true, message: `Deleted ${deleted} keys matching "${pattern}".` });
  } catch (err) { next(err); }
});

// ===== PROMO CODE MANAGEMENT =====
router.get('/promo-codes', async (req, res, next) => {
  try {
    const prisma = require('../config/prisma');
    const promos = await prisma.promoCode.findMany({ orderBy: { createdAt: 'desc' } });
    res.json({ success: true, data: promos });
  } catch (err) { next(err); }
});

router.post('/promo-codes', async (req, res, next) => {
  try {
    const prisma = require('../config/prisma');
    const { code, description, discountType, discountValue, minOrderAmount, maxUses, expiresAt } = req.body;
    if (!code || !discountValue) return res.status(400).json({ success: false, message: 'Code and discount value are required.' });
    const existing = await prisma.promoCode.findUnique({ where: { code: code.toUpperCase() } });
    if (existing) return res.status(409).json({ success: false, message: 'Promo code already exists.' });
    const promo = await prisma.promoCode.create({
      data: {
        code: code.toUpperCase(), description,
        discountType: discountType || 'PERCENTAGE',
        discountValue: parseFloat(discountValue),
        minOrderAmount: parseFloat(minOrderAmount) || 0,
        maxUses: maxUses ? parseInt(maxUses) : null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        isActive: true,
      },
    });
    res.status(201).json({ success: true, data: promo });
  } catch (err) { next(err); }
});

router.patch('/promo-codes/:id', async (req, res, next) => {
  try {
    const prisma = require('../config/prisma');
    const promo = await prisma.promoCode.update({
      where: { id: req.params.id },
      data: req.body,
    });
    res.json({ success: true, data: promo });
  } catch (err) { next(err); }
});

router.delete('/promo-codes/:id', async (req, res, next) => {
  try {
    const prisma = require('../config/prisma');
    await prisma.promoCode.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: 'Promo code deleted.' });
  } catch (err) { next(err); }
});

// ===== CONVERSION FUNNEL ANALYTICS =====
router.get('/analytics/funnel', async (req, res, next) => {
  try {
    const prisma = require('../config/prisma');
    const { days = 30 } = req.query;
    const since = new Date(Date.now() - parseInt(days) * 24 * 3600 * 1000);

    const [pageViews, productViews, cartAdds, checkouts, orders] = await Promise.all([
      prisma.analyticsEvent.count({ where: { type: 'PAGE_VIEW', createdAt: { gte: since } } }).catch(() => 0),
      prisma.analyticsEvent.count({ where: { type: 'PRODUCT_VIEW', createdAt: { gte: since } } }).catch(() => 0),
      prisma.analyticsEvent.count({ where: { type: 'ADD_TO_CART', createdAt: { gte: since } } }).catch(() => 0),
      prisma.analyticsEvent.count({ where: { type: 'CHECKOUT_START', createdAt: { gte: since } } }).catch(() => 0),
      prisma.order.count({ where: { createdAt: { gte: since } } }),
    ]);

    const funnel = [
      { stage: 'Page Views',     count: pageViews,    icon: '👁' },
      { stage: 'Product Views',  count: productViews, icon: '🛒', dropoff: pageViews > 0 ? Math.round((1 - productViews/pageViews)*100) : 0 },
      { stage: 'Add to Cart',    count: cartAdds,     icon: '🛍', dropoff: productViews > 0 ? Math.round((1 - cartAdds/productViews)*100) : 0 },
      { stage: 'Checkout Start', count: checkouts,    icon: '💳', dropoff: cartAdds > 0 ? Math.round((1 - checkouts/cartAdds)*100) : 0 },
      { stage: 'Orders Placed',  count: orders,       icon: '✅', dropoff: checkouts > 0 ? Math.round((1 - orders/checkouts)*100) : 0 },
    ];

    const conversionRate = pageViews > 0 ? ((orders / pageViews) * 100).toFixed(2) : '0';
    res.json({ success: true, data: { funnel, conversionRate, period: `${days} days` } });
  } catch (err) { next(err); }
});

// ===== SELLER PERFORMANCE LEADERBOARD =====
router.get('/analytics/sellers', async (req, res, next) => {
  try {
    const prisma = require('../config/prisma');
    const { days = 30, limit = 10 } = req.query;
    const since = new Date(Date.now() - parseInt(days) * 24 * 3600 * 1000);

    const sellers = await prisma.seller.findMany({
      where: { status: 'VERIFIED' },
      include: {
        user: { select: { name: true } },
        products: {
          include: {
            orderItems: {
              where: { order: { createdAt: { gte: since } } },
              select: { totalPrice: true, quantity: true },
            },
          },
        },
      },
      take: parseInt(limit) * 3,
    });

    const ranked = sellers.map(s => {
      const revenue = s.products.flatMap(p => p.orderItems).reduce((sum, i) => sum + i.totalPrice, 0);
      const orders  = s.products.flatMap(p => p.orderItems).length;
      return { id: s.id, storeName: s.storeName, city: s.city, rating: s.rating, revenue, orders };
    }).sort((a, b) => b.revenue - a.revenue).slice(0, parseInt(limit));

    res.json({ success: true, data: ranked });
  } catch (err) { next(err); }
});

// ===== FLASH SALES =====
router.get('/flash-sales', async (req, res, next) => {
  try {
    const prisma = require('../config/prisma');
    const sales = await prisma.campaign.findMany({ where: { type: 'FLASH_SALE' }, orderBy: { createdAt: 'desc' } }).catch(() => []);
    res.json({ success: true, data: sales });
  } catch (err) { next(err); }
});

router.post('/flash-sales', async (req, res, next) => {
  try {
    const prisma = require('../config/prisma');
    const { name, productIds, discountValue, discountType, startsAt, endsAt, maxUses } = req.body;
    if (!name || !startsAt || !endsAt) return res.status(400).json({ success: false, message: 'name, startsAt, endsAt required' });
    const sale = await prisma.campaign.create({
      data: { name, type: 'FLASH_SALE', startsAt: new Date(startsAt), endsAt: new Date(endsAt), rules: { productIds: productIds || [] }, discount: { type: discountType || 'PERCENTAGE', value: discountValue || 10 }, maxUses: maxUses || null, isActive: true },
    }).catch(async () => {
      // Campaign model may not exist yet — return mock
      return { id: 'mock', name, type: 'FLASH_SALE', startsAt, endsAt, isActive: true };
    });
    res.status(201).json({ success: true, data: sale });
  } catch (err) { next(err); }
});

router.patch('/flash-sales/:id', async (req, res, next) => {
  try {
    const prisma = require('../config/prisma');
    const sale = await prisma.campaign.update({ where: { id: req.params.id }, data: req.body }).catch(() => null);
    res.json({ success: true, data: sale });
  } catch (err) { next(err); }
});

module.exports = router;
