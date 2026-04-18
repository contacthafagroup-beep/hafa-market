const router = require('express').Router();
const prisma = require('../config/prisma');
const { protect } = require('../middleware/auth.middleware');
const { AppError } = require('../middleware/errorHandler');

router.use(protect);

router.get('/', async (req, res, next) => {
  try {
    const items = await prisma.cartItem.findMany({
      where: { userId: req.user.id },
      include: { product: { include: { seller: { select: { storeName: true } } } } },
    });
    res.json({ success: true, data: items });
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const { productId, quantity = 1 } = req.body;
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product || product.status !== 'ACTIVE') throw new AppError('Product unavailable.', 400);
    const item = await prisma.cartItem.upsert({
      where: { userId_productId: { userId: req.user.id, productId } },
      update: { quantity: { increment: quantity } },
      create: { userId: req.user.id, productId, quantity },
      include: { product: true },
    });
    res.json({ success: true, data: item });
  } catch (err) { next(err); }
});

// Sync endpoint — SET quantity absolutely (used by frontend cart sync)
router.post('/sync', async (req, res, next) => {
  try {
    const { productId, quantity } = req.body;
    if (!productId || quantity == null) throw new AppError('productId and quantity required.', 400);
    if (quantity <= 0) {
      await prisma.cartItem.deleteMany({ where: { userId: req.user.id, productId } });
      return res.json({ success: true });
    }
    const item = await prisma.cartItem.upsert({
      where: { userId_productId: { userId: req.user.id, productId } },
      update: { quantity },
      create: { userId: req.user.id, productId, quantity },
    });
    res.json({ success: true, data: item });
  } catch (err) { next(err); }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const { quantity } = req.body;
    if (quantity <= 0) {
      await prisma.cartItem.delete({ where: { id: req.params.id } });
      return res.json({ success: true, message: 'Item removed.' });
    }
    const item = await prisma.cartItem.update({ where: { id: req.params.id }, data: { quantity } });
    res.json({ success: true, data: item });
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    // Support both item ID and productId for frontend sync
    const deleted = await prisma.cartItem.deleteMany({
      where: {
        OR: [
          { id: req.params.id, userId: req.user.id },
          { productId: req.params.id, userId: req.user.id },
        ],
      },
    });
    res.json({ success: true, message: 'Item removed from cart.' });
  } catch (err) { next(err); }
});

router.delete('/', async (req, res, next) => {
  try {
    await prisma.cartItem.deleteMany({ where: { userId: req.user.id } });
    res.json({ success: true, message: 'Cart cleared.' });
  } catch (err) { next(err); }
});

module.exports = router;
