'use strict';
/**
 * Features Routes — handles all 20 new features:
 * Q&A, Collections, Bundles, Subscriptions, Seasonal Alerts,
 * Leaderboard, Flash Sales (buyer), Reorder, Cooperative
 */
const router = require('express').Router();
const prisma  = require('../config/prisma');
const { protect, restrictTo, optionalAuth } = require('../middleware/auth.middleware');
const { AppError } = require('../middleware/errorHandler');

// ─── 1. FLASH SALES (active — for buyers) ────────────────────────────────────
router.get('/flash-sales/active', async (req, res, next) => {
  try {
    const now = new Date();
    const sales = await prisma.campaign.findMany({
      where: { type: 'FLASH_SALE', isActive: true, startsAt: { lte: now }, endsAt: { gte: now } },
      orderBy: { endsAt: 'asc' },
    }).catch(() => []);
    res.json({ success: true, data: sales });
  } catch (err) { next(err); }
});

// ─── 3. PRODUCT Q&A ──────────────────────────────────────────────────────────
router.get('/qa/:productId', optionalAuth, async (req, res, next) => {
  try {
    const qa = await prisma.productQA.findMany({
      where: { productId: req.params.productId, isPublic: true },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: { product: { select: { sellerId: true } } },
    });
    res.json({ success: true, data: qa });
  } catch (err) { next(err); }
});

router.post('/qa/:productId', protect, async (req, res, next) => {
  try {
    const { question } = req.body;
    if (!question?.trim()) throw new AppError('Question is required.', 400);
    const qa = await prisma.productQA.create({
      data: { productId: req.params.productId, userId: req.user.id, question: question.trim() },
    });
    res.status(201).json({ success: true, data: qa });
  } catch (err) { next(err); }
});

router.post('/qa/:id/answer', protect, async (req, res, next) => {
  try {
    const { answer } = req.body;
    if (!answer?.trim()) throw new AppError('Answer is required.', 400);
    const qa = await prisma.productQA.findUnique({ where: { id: req.params.id }, include: { product: true } });
    if (!qa) throw new AppError('Question not found.', 404);
    // Only the seller of the product can answer
    const seller = await prisma.seller.findUnique({ where: { userId: req.user.id } });
    if (!seller || seller.id !== qa.product.sellerId) throw new AppError('Only the seller can answer.', 403);
    const updated = await prisma.productQA.update({
      where: { id: req.params.id },
      data: { answer: answer.trim(), answeredBy: seller.id, answeredAt: new Date() },
    });
    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
});

// ─── 4. SELLER COLLECTIONS ───────────────────────────────────────────────────
router.get('/collections/:storeSlug', async (req, res, next) => {
  try {
    const seller = await prisma.seller.findUnique({ where: { storeSlug: req.params.storeSlug } });
    if (!seller) throw new AppError('Store not found.', 404);
    const collections = await prisma.sellerCollection.findMany({
      where: { sellerId: seller.id, isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
    // Fetch products for each collection
    const withProducts = await Promise.all(collections.map(async col => {
      const products = await prisma.product.findMany({
        where: { id: { in: col.productIds }, status: 'ACTIVE' },
        include: { seller: { select: { storeName: true } }, category: { select: { name: true, emoji: true } } },
      });
      return { ...col, products };
    }));
    res.json({ success: true, data: withProducts });
  } catch (err) { next(err); }
});

router.post('/collections', protect, restrictTo('SELLER', 'ADMIN'), async (req, res, next) => {
  try {
    const { name, description, emoji, productIds } = req.body;
    if (!name) throw new AppError('Collection name is required.', 400);
    const seller = await prisma.seller.findUnique({ where: { userId: req.user.id } });
    if (!seller) throw new AppError('Seller not found.', 404);
    const col = await prisma.sellerCollection.create({
      data: { sellerId: seller.id, name, description, emoji, productIds: productIds || [] },
    });
    res.status(201).json({ success: true, data: col });
  } catch (err) { next(err); }
});

router.get('/collections/my', protect, restrictTo('SELLER', 'ADMIN'), async (req, res, next) => {
  try {
    const seller = await prisma.seller.findUnique({ where: { userId: req.user.id } });
    if (!seller) throw new AppError('Seller not found.', 404);
    const cols = await prisma.sellerCollection.findMany({
      where: { sellerId: seller.id },
      orderBy: { sortOrder: 'asc' },
    });
    res.json({ success: true, data: cols });
  } catch (err) { next(err); }
});

router.patch('/collections/:id', protect, restrictTo('SELLER', 'ADMIN'), async (req, res, next) => {
  try {
    const seller = await prisma.seller.findUnique({ where: { userId: req.user.id } });
    const col = await prisma.sellerCollection.findFirst({ where: { id: req.params.id, sellerId: seller?.id } });
    if (!col) throw new AppError('Collection not found.', 404);
    const updated = await prisma.sellerCollection.update({ where: { id: req.params.id }, data: req.body });
    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
});

router.delete('/collections/:id', protect, restrictTo('SELLER', 'ADMIN'), async (req, res, next) => {
  try {
    const seller = await prisma.seller.findUnique({ where: { userId: req.user.id } });
    await prisma.sellerCollection.deleteMany({ where: { id: req.params.id, sellerId: seller?.id } });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ─── 5. REORDER ──────────────────────────────────────────────────────────────
router.post('/reorder/:orderId', protect, async (req, res, next) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: req.params.orderId },
      include: { items: true },
    });
    if (!order || order.userId !== req.user.id) throw new AppError('Order not found.', 404);
    // Add all items back to cart
    for (const item of order.items) {
      const product = await prisma.product.findUnique({ where: { id: item.productId } });
      if (!product || product.status !== 'ACTIVE') continue;
      await prisma.cartItem.upsert({
        where: { userId_productId: { userId: req.user.id, productId: item.productId } },
        update: { quantity: { increment: item.quantity } },
        create: { userId: req.user.id, productId: item.productId, quantity: item.quantity },
      });
    }
    res.json({ success: true, message: 'Items added to cart!' });
  } catch (err) { next(err); }
});

// ─── 12. PRODUCT BUNDLES ─────────────────────────────────────────────────────
router.get('/bundles', optionalAuth, async (req, res, next) => {
  try {
    const { sellerId } = req.query;
    const where = { isActive: true, ...(sellerId && { sellerId }) };
    const bundles = await prisma.productBundle.findMany({
      where, orderBy: { createdAt: 'desc' }, take: 20,
    });
    // Attach product details
    const withProducts = await Promise.all(bundles.map(async b => {
      const products = await prisma.product.findMany({
        where: { id: { in: b.productIds }, status: 'ACTIVE' },
        select: { id: true, name: true, price: true, images: true, unit: true },
      });
      return { ...b, products };
    }));
    res.json({ success: true, data: withProducts });
  } catch (err) { next(err); }
});

router.post('/bundles', protect, restrictTo('SELLER', 'ADMIN'), async (req, res, next) => {
  try {
    const { name, description, productIds, quantities, bundlePrice, comparePrice } = req.body;
    if (!name || !productIds?.length || !bundlePrice) throw new AppError('name, productIds and bundlePrice required.', 400);
    const seller = await prisma.seller.findUnique({ where: { userId: req.user.id } });
    if (!seller) throw new AppError('Seller not found.', 404);
    const bundle = await prisma.productBundle.create({
      data: { sellerId: seller.id, name, description, productIds, quantities: quantities || {}, bundlePrice, comparePrice },
    });
    res.status(201).json({ success: true, data: bundle });
  } catch (err) { next(err); }
});

router.get('/bundles/my', protect, restrictTo('SELLER', 'ADMIN'), async (req, res, next) => {
  try {
    const seller = await prisma.seller.findUnique({ where: { userId: req.user.id } });
    if (!seller) throw new AppError('Seller not found.', 404);
    const bundles = await prisma.productBundle.findMany({ where: { sellerId: seller.id }, orderBy: { createdAt: 'desc' } });
    res.json({ success: true, data: bundles });
  } catch (err) { next(err); }
});

router.patch('/bundles/:id', protect, restrictTo('SELLER', 'ADMIN'), async (req, res, next) => {
  try {
    const seller = await prisma.seller.findUnique({ where: { userId: req.user.id } });
    const bundle = await prisma.productBundle.findFirst({ where: { id: req.params.id, sellerId: seller?.id } });
    if (!bundle) throw new AppError('Bundle not found.', 404);
    const updated = await prisma.productBundle.update({ where: { id: req.params.id }, data: req.body });
    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
});

router.delete('/bundles/:id', protect, restrictTo('SELLER', 'ADMIN'), async (req, res, next) => {
  try {
    const seller = await prisma.seller.findUnique({ where: { userId: req.user.id } });
    await prisma.productBundle.deleteMany({ where: { id: req.params.id, sellerId: seller?.id } });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ─── 14. SUBSCRIPTIONS (Auto-Reorder) ────────────────────────────────────────
router.get('/subscriptions', protect, async (req, res, next) => {
  try {
    const subs = await prisma.subscription.findMany({
      where: { userId: req.user.id, isActive: true },
      orderBy: { nextOrderAt: 'asc' },
    });
    // Attach product details
    const withProducts = await Promise.all(subs.map(async s => {
      const product = await prisma.product.findUnique({
        where: { id: s.productId },
        select: { id: true, name: true, price: true, images: true, unit: true, slug: true },
      });
      return { ...s, product };
    }));
    res.json({ success: true, data: withProducts });
  } catch (err) { next(err); }
});

router.post('/subscriptions', protect, async (req, res, next) => {
  try {
    const { productId, quantity, frequency, addressId, paymentMethod } = req.body;
    if (!productId || !quantity || !frequency) throw new AppError('productId, quantity and frequency required.', 400);
    const FREQ_DAYS = { WEEKLY: 7, BIWEEKLY: 14, MONTHLY: 30 };
    const days = FREQ_DAYS[frequency];
    if (!days) throw new AppError('frequency must be WEEKLY, BIWEEKLY or MONTHLY.', 400);
    const nextOrderAt = new Date(Date.now() + days * 24 * 3600 * 1000);
    const sub = await prisma.subscription.upsert({
      where: { id: `${req.user.id}-${productId}` },
      update: { quantity, frequency, nextOrderAt, isActive: true, addressId, paymentMethod },
      create: { userId: req.user.id, productId, quantity, frequency, nextOrderAt, addressId, paymentMethod: paymentMethod || 'CASH_ON_DELIVERY' },
    }).catch(() => prisma.subscription.create({
      data: { userId: req.user.id, productId, quantity, frequency, nextOrderAt, addressId, paymentMethod: paymentMethod || 'CASH_ON_DELIVERY' },
    }));
    res.status(201).json({ success: true, data: sub, message: `Subscribed! Next delivery in ${days} days.` });
  } catch (err) { next(err); }
});

router.delete('/subscriptions/:id', protect, async (req, res, next) => {
  try {
    await prisma.subscription.updateMany({
      where: { id: req.params.id, userId: req.user.id },
      data: { isActive: false },
    });
    res.json({ success: true, message: 'Subscription cancelled.' });
  } catch (err) { next(err); }
});

// ─── 15. SELLER LEADERBOARD (public) ─────────────────────────────────────────
router.get('/leaderboard', async (req, res, next) => {
  try {
    const { period = '30' } = req.query;
    const since = new Date(Date.now() - parseInt(period) * 24 * 3600 * 1000);
    const sellers = await prisma.seller.findMany({
      where: { status: 'VERIFIED' },
      include: {
        products: {
          include: {
            orderItems: {
              where: { order: { createdAt: { gte: since }, status: { in: ['CONFIRMED','DELIVERED'] } } },
              select: { totalPrice: true },
            },
          },
        },
        _count: { select: { products: true } },
      },
      take: 50,
    });
    const ranked = sellers.map(s => ({
      id: s.id, storeName: s.storeName, storeSlug: s.storeSlug,
      logo: s.logo, city: s.city, rating: s.rating,
      revenue: s.products.flatMap(p => p.orderItems).reduce((sum, i) => sum + i.totalPrice, 0),
      orders: s.products.flatMap(p => p.orderItems).length,
      productCount: s._count.products,
    })).sort((a, b) => b.revenue - a.revenue).slice(0, 20)
      .map((s, i) => ({
        ...s,
        rank: i + 1,
        badge: i === 0 ? '🥇 #1 Seller' : i === 1 ? '🥈 #2 Seller' : i === 2 ? '🥉 #3 Seller' : `#${i + 1}`,
      }));
    res.json({ success: true, data: ranked });
  } catch (err) { next(err); }
});

// ─── 20. SEASONAL ALERTS ─────────────────────────────────────────────────────
router.get('/seasonal-alerts', protect, async (req, res, next) => {
  try {
    const alerts = await prisma.seasonalAlert.findMany({
      where: { userId: req.user.id, isActive: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: alerts });
  } catch (err) { next(err); }
});

router.post('/seasonal-alerts', protect, async (req, res, next) => {
  try {
    const { keyword, categoryId } = req.body;
    if (!keyword?.trim()) throw new AppError('keyword is required.', 400);
    const alert = await prisma.seasonalAlert.upsert({
      where: { userId_keyword: { userId: req.user.id, keyword: keyword.toLowerCase().trim() } },
      update: { isActive: true, categoryId },
      create: { userId: req.user.id, keyword: keyword.toLowerCase().trim(), categoryId, isActive: true },
    });
    res.status(201).json({ success: true, data: alert, message: `You'll be notified when ${keyword} is available!` });
  } catch (err) { next(err); }
});

router.delete('/seasonal-alerts/:id', protect, async (req, res, next) => {
  try {
    await prisma.seasonalAlert.updateMany({
      where: { id: req.params.id, userId: req.user.id },
      data: { isActive: false },
    });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ─── 19. COOPERATIVE MEMBERS ─────────────────────────────────────────────────
router.get('/cooperative/members', protect, restrictTo('SELLER', 'ADMIN'), async (req, res, next) => {
  try {
    const seller = await prisma.seller.findUnique({ where: { userId: req.user.id } });
    if (!seller) throw new AppError('Seller not found.', 404);
    const members = await prisma.cooperativeMember.findMany({
      where: { sellerId: seller.id },
      include: { user: { select: { id: true, name: true, email: true, phone: true, avatar: true } } },
    }).catch(() => []);
    res.json({ success: true, data: members });
  } catch (err) { next(err); }
});

router.post('/cooperative/invite', protect, restrictTo('SELLER', 'ADMIN'), async (req, res, next) => {
  try {
    const { phone, email } = req.body;
    const seller = await prisma.seller.findUnique({ where: { userId: req.user.id } });
    if (!seller) throw new AppError('Seller not found.', 404);
    const user = await prisma.user.findFirst({ where: { OR: [phone ? { phone } : {}, email ? { email } : {}] } });
    if (!user) throw new AppError('User not found. They must register first.', 404);
    const member = await prisma.cooperativeMember.upsert({
      where: { sellerId_userId: { sellerId: seller.id, userId: user.id } },
      update: {},
      create: { sellerId: seller.id, userId: user.id, role: 'MEMBER' },
    }).catch(() => null);
    res.status(201).json({ success: true, data: member, message: 'Member added to cooperative.' });
  } catch (err) { next(err); }
});

router.delete('/cooperative/members/:userId', protect, restrictTo('SELLER', 'ADMIN'), async (req, res, next) => {
  try {
    const seller = await prisma.seller.findUnique({ where: { userId: req.user.id } });
    await prisma.cooperativeMember.deleteMany({ where: { sellerId: seller?.id, userId: req.params.userId } });
    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;
