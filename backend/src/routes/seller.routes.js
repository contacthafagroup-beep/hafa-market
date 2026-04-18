const router = require('express').Router();
const ctrl = require('../controllers/seller.controller');
const { protect, restrictTo } = require('../middleware/auth.middleware');

router.get('/:slug', ctrl.getStore);

router.use(protect);
router.post('/register',  ctrl.registerSeller);
router.get('/me/store',   restrictTo('SELLER','ADMIN'), ctrl.getMyStore);
router.patch('/me/store', restrictTo('SELLER','ADMIN'), ctrl.updateStore);
router.get('/me/analytics', restrictTo('SELLER','ADMIN'), ctrl.getAnalytics);
router.get('/me/orders',    restrictTo('SELLER','ADMIN'), ctrl.getSellerOrders);
router.patch('/me/orders/:orderId/status', restrictTo('SELLER','ADMIN'), ctrl.updateOrderStatus);
router.get('/me/payouts',   restrictTo('SELLER','ADMIN'), ctrl.getPayouts);
router.post('/me/payouts',  restrictTo('SELLER','ADMIN'), ctrl.requestPayout);
router.patch('/me/payout-settings', restrictTo('SELLER','ADMIN'), ctrl.updatePayoutSettings);

// Seller product management
router.get('/me/products',        restrictTo('SELLER','ADMIN'), ctrl.getMyProducts);
router.post('/me/products',       restrictTo('SELLER','ADMIN'), ctrl.createProduct);
router.patch('/me/products/:id',  restrictTo('SELLER','ADMIN'), ctrl.updateProduct);
router.delete('/me/products/:id', restrictTo('SELLER','ADMIN'), ctrl.deleteProduct);

// Monthly revenue chart data (last 6 months)
router.get('/me/revenue-chart', restrictTo('SELLER','ADMIN'), async (req, res, next) => {
  try {
    const prisma = require('../config/prisma');
    const seller = await prisma.seller.findUnique({ where: { userId: req.user.id } });
    if (!seller) return res.json({ success: true, data: [] });

    const result = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setDate(1);
      d.setMonth(d.getMonth() - i);
      const start = new Date(d.getFullYear(), d.getMonth(), 1);
      const end   = new Date(d.getFullYear(), d.getMonth() + 1, 1);
      const agg = await prisma.orderItem.aggregate({
        where: { product: { sellerId: seller.id }, order: { createdAt: { gte: start, lt: end }, status: { in: ['CONFIRMED','DELIVERED'] } } },
        _sum: { totalPrice: true },
        _count: { id: true },
      });
      result.push({
        label: d.toLocaleDateString('en', { month: 'short' }),
        revenue: agg._sum.totalPrice || 0,
        orders: agg._count.id || 0,
      });
    }
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});
module.exports = router;
