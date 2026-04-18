const router = require('express').Router();
const ctrl = require('../controllers/order.controller');
const { protect, restrictTo } = require('../middleware/auth.middleware');
const validate = require('../middleware/validate');
const { createOrderSchema, cancelOrderSchema, updateStatusSchema } = require('../validators/order.validator');

router.use(protect);

/**
 * @swagger
 * /orders:
 *   post:
 *     tags: [Orders]
 *     summary: Place a new order
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [addressId, items, paymentMethod]
 *             properties:
 *               addressId:     { type: string, format: uuid }
 *               paymentMethod: { type: string, enum: [MPESA, CARD, FLUTTERWAVE, CASH_ON_DELIVERY, PAYPAL] }
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     productId: { type: string, format: uuid }
 *                     quantity:  { type: number }
 *               promoCode: { type: string, example: HAFA10 }
 *               notes:     { type: string }
 *     responses:
 *       201: { description: Order placed successfully }
 *       400: { $ref: '#/components/responses/ValidationError' }
 */
router.post('/',                                    validate(createOrderSchema), ctrl.createOrder);
router.post('/validate-promo',                      ctrl.validatePromo);

/**
 * @swagger
 * /orders:
 *   get:
 *     tags: [Orders]
 *     summary: Get current user's orders
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [PENDING, CONFIRMED, SHIPPED, DELIVERED, CANCELLED] }
 *     responses:
 *       200: { description: List of orders }
 */
router.get('/',                                     ctrl.getOrders);
router.get('/:id',                                  ctrl.getOrder);
router.patch('/:id/cancel',                         validate(cancelOrderSchema), ctrl.cancelOrder);
router.patch('/:id/status', restrictTo('ADMIN','DELIVERY_AGENT'), validate(updateStatusSchema), ctrl.updateOrderStatus);

module.exports = router;
