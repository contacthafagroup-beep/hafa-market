const router = require('express').Router();
const ctrl   = require('../controllers/bankTransfer.controller');
const { protect, restrictTo } = require('../middleware/auth.middleware');
const { proofUploadLimiter, paymentInitLimiter } = require('../config/rateLimiter');

/**
 * @swagger
 * tags:
 *   name: BankTransfer
 *   description: Manual bank transfer and Chapa bank transfer payments
 */

// ===== PUBLIC =====
/**
 * @swagger
 * /bank-transfers/accounts:
 *   get:
 *     tags: [BankTransfer]
 *     summary: Get Hafa Market bank accounts for manual transfer
 *     parameters:
 *       - in: query
 *         name: currency
 *         schema: { type: string, enum: [ETB, KES, USD] }
 *         description: Filter by currency
 *     responses:
 *       200:
 *         description: List of bank accounts with transfer instructions
 */
router.get('/accounts',          ctrl.getBankAccounts);
router.get('/chapa-banks',       ctrl.getChapabanks);
router.get('/status/:referenceCode', protect, ctrl.getTransferStatus);

// ===== BUYER =====
router.use(protect);

/**
 * @swagger
 * /bank-transfers/initiate:
 *   post:
 *     tags: [BankTransfer]
 *     summary: Initiate a manual bank transfer for an order
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [orderId, bankCode]
 *             properties:
 *               orderId:  { type: string, format: uuid }
 *               bankCode: { type: string, example: CBE }
 *               currency: { type: string, example: ETB }
 *     responses:
 *       200:
 *         description: Bank details and reference code returned
 */
router.post('/initiate',         paymentInitLimiter, ctrl.initiateBankTransfer);

/**
 * @swagger
 * /bank-transfers/submit-proof:
 *   post:
 *     tags: [BankTransfer]
 *     summary: Submit transfer receipt/proof for verification
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [referenceCode]
 *             properties:
 *               referenceCode: { type: string }
 *               senderName:    { type: string }
 *               senderAccount: { type: string }
 *               transferDate:  { type: string, format: date }
 *               proofImageUrl: { type: string, format: uri }
 *               notes:         { type: string }
 *     responses:
 *       200:
 *         description: Proof submitted, pending admin verification
 */
router.post('/submit-proof',     proofUploadLimiter, ctrl.submitTransferProof);
router.post('/chapa-bank',       paymentInitLimiter, ctrl.initiateChapaBank);

// ===== ADMIN =====
router.get('/pending',           restrictTo('ADMIN'), ctrl.getPendingTransfers);

/**
 * @swagger
 * /bank-transfers/verify:
 *   post:
 *     tags: [BankTransfer]
 *     summary: Admin approves or rejects a bank transfer
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [referenceCode, action]
 *             properties:
 *               referenceCode: { type: string }
 *               action:        { type: string, enum: [approve, reject] }
 *               notes:         { type: string }
 *     responses:
 *       200:
 *         description: Transfer approved or rejected
 */
router.post('/verify',           restrictTo('ADMIN'), ctrl.verifyTransfer);
router.post('/expire',           restrictTo('ADMIN'), ctrl.expireTransfers);

module.exports = router;
