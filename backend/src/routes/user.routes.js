const router = require('express').Router();
const ctrl = require('../controllers/user.controller');
const { protect } = require('../middleware/auth.middleware');

router.use(protect);
router.get('/profile',                    ctrl.getProfile);
router.patch('/profile',                  ctrl.updateProfile);
router.get('/addresses',                  ctrl.getAddresses);
router.post('/addresses',                 ctrl.addAddress);
router.patch('/addresses/:id',            ctrl.updateAddress);
router.delete('/addresses/:id',           ctrl.deleteAddress);
router.patch('/addresses/:id/default',    ctrl.setDefaultAddress);
router.get('/wishlist',                   ctrl.getWishlist);
router.post('/wishlist/toggle',           ctrl.toggleWishlist);
router.get('/loyalty',                    ctrl.getLoyaltyPoints);
router.get('/notifications',              ctrl.getNotifications);
router.patch('/notifications/read-all',   ctrl.markNotificationsRead);

// Telegram account linking
router.post('/link-telegram', protect, async (req, res, next) => {
  try {
    const { telegramChatId } = req.body;
    if (!telegramChatId) return res.status(400).json({ success: false, message: 'telegramChatId required' });
    const prisma = require('../config/prisma');
    await prisma.user.update({ where: { id: req.user.id }, data: { telegramChatId: String(telegramChatId) } });
    res.json({ success: true, message: 'Telegram account linked!' });
  } catch (err) { next(err); }
});
router.post('/newsletter', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ success: false, message: 'Email required' });
  try {
    const prisma = require('../config/prisma');
    await prisma.searchLog.create({ data: { query: `newsletter:${email}`, results: 0 } });
  } catch {}
  res.json({ success: true, message: 'Subscribed! Welcome to Hafa Market.' });
});

// FCM token registration for push notifications
router.patch('/me/fcm-token', async (req, res, next) => {
  try {
    const { fcmToken } = req.body;
    if (!fcmToken) return res.status(400).json({ success: false, message: 'fcmToken required' });
    const prisma = require('../config/prisma');
    await prisma.user.update({ where: { id: req.user.id }, data: { fcmToken } });
    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;
