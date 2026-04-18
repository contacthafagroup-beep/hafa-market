'use strict';
const router = require('express').Router();
const prisma = require('../config/prisma');
const { protect, restrictTo } = require('../middleware/auth.middleware');
const { AppError } = require('../middleware/errorHandler');

router.use(protect);

// Submit KYC documents
router.post('/', restrictTo('SELLER'), async (req, res, next) => {
  try {
    const { fullName, nationalIdNo, nationalIdImage, businessLicense, taxId, bankStatement, selfieWithId } = req.body;
    if (!fullName || !nationalIdNo || !nationalIdImage) throw new AppError('Full name, national ID number and image are required.', 400);
    const seller = await prisma.seller.findUnique({ where: { userId: req.user.id } });
    if (!seller) throw new AppError('Seller profile not found.', 404);
    const kyc = await prisma.sellerKYC.upsert({
      where: { sellerId: seller.id },
      update: { fullName, nationalIdNo, nationalIdImage, businessLicense, taxId, bankStatement, selfieWithId, status: 'PENDING', rejectionReason: null },
      create: { sellerId: seller.id, fullName, nationalIdNo, nationalIdImage, businessLicense, taxId, bankStatement, selfieWithId },
    });
    res.status(201).json({ success: true, data: kyc, message: 'KYC submitted for review.' });
  } catch (err) { next(err); }
});

// Get my KYC status
router.get('/me', restrictTo('SELLER'), async (req, res, next) => {
  try {
    const seller = await prisma.seller.findUnique({ where: { userId: req.user.id } });
    if (!seller) throw new AppError('Seller not found.', 404);
    const kyc = await prisma.sellerKYC.findUnique({ where: { sellerId: seller.id } });
    res.json({ success: true, data: kyc });
  } catch (err) { next(err); }
});

// Admin: get all KYC submissions
router.get('/', restrictTo('ADMIN'), async (req, res, next) => {
  try {
    const { status } = req.query;
    const kycs = await prisma.sellerKYC.findMany({
      where: status ? { status } : {},
      orderBy: { createdAt: 'desc' },
      include: { seller: { select: { storeName: true, user: { select: { name: true, email: true } } } } },
    });
    res.json({ success: true, data: kycs });
  } catch (err) { next(err); }
});

// Admin: approve/reject KYC
router.patch('/:sellerId', restrictTo('ADMIN'), async (req, res, next) => {
  try {
    const { status, rejectionReason } = req.body;
    if (!['APPROVED', 'REJECTED'].includes(status)) throw new AppError('Status must be APPROVED or REJECTED.', 400);
    const kyc = await prisma.sellerKYC.update({
      where: { sellerId: req.params.sellerId },
      data: { status, rejectionReason, verifiedBy: req.user.id, verifiedAt: status === 'APPROVED' ? new Date() : null, expiresAt: status === 'APPROVED' ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) : null },
    });
    // Notify seller
    const seller = await prisma.seller.findUnique({ where: { id: req.params.sellerId }, include: { user: { select: { id: true } } } });
    if (seller?.user) {
      const { createNotification } = require('../services/notification.service');
      createNotification(seller.user.id, 'SYSTEM', status === 'APPROVED' ? '✅ KYC Approved!' : '❌ KYC Rejected', status === 'APPROVED' ? 'Your identity has been verified. You now have a Verified badge!' : 'KYC rejected: ' + (rejectionReason || 'Please resubmit'), {}).catch(() => {});
    }
    res.json({ success: true, data: kyc });
  } catch (err) { next(err); }
});

module.exports = router;
