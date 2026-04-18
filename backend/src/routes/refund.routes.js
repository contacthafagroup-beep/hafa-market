const router = require('express').Router();
const ctrl   = require('../controllers/refund.controller');
const { protect, restrictTo } = require('../middleware/auth.middleware');
const { refundLimiter } = require('../config/rateLimiter');

// ===== WALLET =====
router.get('/wallet',              protect, ctrl.getWallet);
router.post('/wallet/pay',         protect, ctrl.payWithWallet);

// ===== BUYER =====
router.post('/request',            protect, refundLimiter, ctrl.requestRefund);
router.get('/my',                  protect, ctrl.getMyRefunds);

// ===== ADMIN =====
router.get('/all',                 protect, restrictTo('ADMIN'), ctrl.getAllRefunds);
router.post('/process',            protect, restrictTo('ADMIN'), ctrl.processRefund);

module.exports = router;
