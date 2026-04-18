const router = require('express').Router();
const ctrl = require('../controllers/payment.controller');
const { protect, restrictTo } = require('../middleware/auth.middleware');
const { mpesaIpWhitelist, flutterwaveSignature, stripeSignature, chapaWebhookMiddleware } = require('../middleware/webhook.middleware');
const { paymentInitLimiter, refundLimiter } = require('../config/rateLimiter');
const express = require('express');

// ===== WEBHOOKS (no auth, verified by signature/IP) =====
router.post('/stripe/webhook',      express.raw({ type: 'application/json' }), stripeSignature, ctrl.stripeWebhook);
router.post('/mpesa/callback',      mpesaIpWhitelist, ctrl.mpesaCallback);
router.post('/mpesa/b2c/result',    mpesaIpWhitelist, ctrl.mpesaB2cResult);
router.post('/flutterwave/webhook', flutterwaveSignature, ctrl.flutterwaveWebhook);
router.post('/chapa/webhook',       chapaWebhookMiddleware, ctrl.chapaWebhook);

// ===== CHAPA VERIFY (called after redirect) =====
router.get('/chapa/verify/:txRef',  ctrl.chapaVerify);

// ===== PROTECTED ROUTES =====
router.use(protect);
router.post('/initiate',                                    paymentInitLimiter, ctrl.initiatePayment);
router.post('/retry',                                       paymentInitLimiter, ctrl.retryPayment);
router.get('/status/:orderId',                              ctrl.getPaymentStatus);
router.post('/refund',              refundLimiter, restrictTo('ADMIN'),    ctrl.refundPayment);
router.post('/payout/request',      restrictTo('SELLER'),   ctrl.requestPayout);
router.post('/pod/collect',         restrictTo('DELIVERY_AGENT', 'ADMIN'), ctrl.collectPaymentOnDelivery);

module.exports = router;
