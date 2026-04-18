'use strict';
const router = require('express').Router();
const prisma = require('../config/prisma');
const { protect } = require('../middleware/auth.middleware');

// Get my referral code
router.get('/my-code', protect, async (req, res, next) => {
  try {
    const code = req.user.id.slice(-6).toUpperCase();
    const referrals = await prisma.referral.findMany({ where: { referrerId: req.user.id }, orderBy: { createdAt: 'desc' } });
    const earned = referrals.filter(r => r.status === 'REWARDED').length * 50;
    res.json({ success: true, data: { code, referralLink: `${process.env.CLIENT_URL}/register?ref=${code}`, referrals: referrals.length, earned } });
  } catch (err) { next(err); }
});

// Apply referral code on register (called internally)
router.post('/apply', async (req, res, next) => {
  try {
    const { code, refereeId } = req.body;
    if (!code || !refereeId) return res.json({ success: false });
    // Find referrer by code (last 6 chars of their ID)
    const referrer = await prisma.user.findFirst({ where: { id: { endsWith: code.toLowerCase() } } });
    if (!referrer || referrer.id === refereeId) return res.json({ success: false });
    await prisma.referral.create({ data: { referrerId: referrer.id, refereeId, code, status: 'PENDING' } });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// Reward referral after first order
router.post('/reward/:refereeId', async (req, res, next) => {
  try {
    const referral = await prisma.referral.findFirst({ where: { refereeId: req.params.refereeId, status: 'PENDING' } });
    if (!referral) return res.json({ success: false });
    // Credit ETB 50 to both
    await Promise.all([
      prisma.wallet.upsert({ where: { userId: referral.referrerId }, update: { balance: { increment: 50 } }, create: { userId: referral.referrerId, balance: 50 } }),
      prisma.wallet.upsert({ where: { userId: referral.refereeId }, update: { balance: { increment: 50 } }, create: { userId: referral.refereeId, balance: 50 } }),
      prisma.referral.update({ where: { id: referral.id }, data: { status: 'REWARDED' } }),
    ]);
    res.json({ success: true, message: 'Both users credited ETB 50' });
  } catch (err) { next(err); }
});

module.exports = router;
