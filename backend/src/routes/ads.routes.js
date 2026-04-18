'use strict';
const router = require('express').Router();
const prisma  = require('../config/prisma');
const { protect, restrictTo } = require('../middleware/auth.middleware');
const { AppError } = require('../middleware/errorHandler');

// ── Seller: create ad ─────────────────────────────────────────────────────────
router.post('/', protect, restrictTo('SELLER','ADMIN'), async (req, res, next) => {
  try {
    const { productId, type, placement, budget, dailyBudget, bidPerClick, startsAt, endsAt } = req.body;
    if (!budget || !placement) throw new AppError('budget and placement are required.', 400);

    const seller = await prisma.seller.findUnique({ where: { userId: req.user.id } });
    if (!seller) throw new AppError('Seller profile not found.', 404);

    // Check seller wallet has enough balance
    const wallet = await prisma.wallet.findUnique({ where: { userId: req.user.id } });
    if (!wallet || wallet.balance < budget) {
      throw new AppError(`Insufficient wallet balance. Available: ETB ${wallet?.balance?.toFixed(2) || '0'}`, 400);
    }

    const ad = await prisma.ad.create({
      data: {
        sellerId: seller.id,
        productId: productId || null,
        type: type || 'SPONSORED_PRODUCT',
        placement,
        budget: parseFloat(budget),
        dailyBudget: parseFloat(dailyBudget) || 0,
        bidPerClick: parseFloat(bidPerClick) || 1,
        startsAt: startsAt ? new Date(startsAt) : new Date(),
        endsAt: endsAt ? new Date(endsAt) : null,
        status: 'ACTIVE',
      },
    });

    res.status(201).json({ success: true, data: ad, message: 'Ad campaign created!' });
  } catch (err) { next(err); }
});

// ── Seller: get my ads ────────────────────────────────────────────────────────
router.get('/my', protect, restrictTo('SELLER','ADMIN'), async (req, res, next) => {
  try {
    const seller = await prisma.seller.findUnique({ where: { userId: req.user.id } });
    if (!seller) throw new AppError('Seller not found.', 404);

    const ads = await prisma.ad.findMany({
      where: { sellerId: seller.id },
      orderBy: { createdAt: 'desc' },
      include: { product: { select: { name: true, images: true, price: true } } },
    });

    // Calculate CTR and ROAS for each ad
    const enriched = ads.map(ad => ({
      ...ad,
      ctr:  ad.impressions > 0 ? ((ad.clicks / ad.impressions) * 100).toFixed(1) + '%' : '0%',
      roas: ad.spent > 0 ? (ad.clicks * (ad.product?.price || 0) / ad.spent).toFixed(2) : '0',
      budgetUsed: ad.budget > 0 ? Math.round((ad.spent / ad.budget) * 100) : 0,
    }));

    res.json({ success: true, data: enriched });
  } catch (err) { next(err); }
});

// ── Seller: pause/resume ad ───────────────────────────────────────────────────
router.patch('/:id', protect, restrictTo('SELLER','ADMIN'), async (req, res, next) => {
  try {
    const seller = await prisma.seller.findUnique({ where: { userId: req.user.id } });
    const ad = await prisma.ad.findFirst({ where: { id: req.params.id, sellerId: seller?.id } });
    if (!ad) throw new AppError('Ad not found.', 404);

    const updated = await prisma.ad.update({ where: { id: req.params.id }, data: req.body });
    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
});

// ── Admin: get all ads ────────────────────────────────────────────────────────
router.get('/', protect, restrictTo('ADMIN'), async (req, res, next) => {
  try {
    const ads = await prisma.ad.findMany({
      orderBy: { createdAt: 'desc' }, take: 50,
      include: {
        seller:  { select: { storeName: true } },
        product: { select: { name: true, price: true } },
      },
    });
    res.json({ success: true, data: ads });
  } catch (err) { next(err); }
});

module.exports = router;
