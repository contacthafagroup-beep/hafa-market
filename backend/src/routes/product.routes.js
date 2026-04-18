const router = require('express').Router();
const ctrl = require('../controllers/product.controller');
const { protect, restrictTo, optionalAuth } = require('../middleware/auth.middleware');
const validate = require('../middleware/validate');
const { createProductSchema, updateProductSchema, productQuerySchema } = require('../validators/product.validator');

/**
 * @swagger
 * /products:
 *   get:
 *     tags: [Products]
 *     summary: Get all products with filters
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, maximum: 100 }
 *       - in: query
 *         name: category
 *         schema: { type: string }
 *         description: Category slug (e.g. vegetables, fruits)
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: minPrice
 *         schema: { type: number }
 *       - in: query
 *         name: maxPrice
 *         schema: { type: number }
 *       - in: query
 *         name: sort
 *         schema: { type: string, enum: [createdAt, price, rating, soldCount] }
 *       - in: query
 *         name: isOrganic
 *         schema: { type: string, enum: [true, false] }
 *     responses:
 *       200:
 *         description: List of products with pagination
 */
router.get('/',          optionalAuth, validate(productQuerySchema, 'query'), ctrl.getProducts);

/**
 * @swagger
 * /products/featured:
 *   get:
 *     tags: [Products]
 *     summary: Get featured products (cached 10 min)
 *     responses:
 *       200: { description: Featured products list }
 */
router.get('/featured',  ctrl.getFeatured);

/**
 * @swagger
 * /products/{slug}:
 *   get:
 *     tags: [Products]
 *     summary: Get single product by slug
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Product details with reviews }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.get('/:slug',     optionalAuth, ctrl.getProduct);

/**
 * @swagger
 * /products:
 *   post:
 *     tags: [Products]
 *     summary: Create a new product (Seller only)
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, categoryId, price]
 *             properties:
 *               name:       { type: string }
 *               categoryId: { type: string, format: uuid }
 *               price:      { type: number }
 *               stock:      { type: number }
 *               unit:       { type: string, example: kg }
 *               isOrganic:  { type: boolean }
 *     responses:
 *       201: { description: Product created }
 *       400: { $ref: '#/components/responses/ValidationError' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 */
router.post('/',         protect, restrictTo('SELLER','ADMIN'), validate(createProductSchema), ctrl.createProduct);
router.patch('/:id',     protect, restrictTo('SELLER','ADMIN'), validate(updateProductSchema), ctrl.updateProduct);
router.delete('/:id',    protect, restrictTo('SELLER','ADMIN'), ctrl.deleteProduct);

// ===== VARIANTS =====
router.get('/:id/variants',    ctrl.getVariants);
router.post('/:id/variants',   protect, restrictTo('SELLER','ADMIN'), ctrl.addVariant);
router.patch('/variants/:vid', protect, restrictTo('SELLER','ADMIN'), ctrl.updateVariant);
router.delete('/variants/:vid',protect, restrictTo('SELLER','ADMIN'), ctrl.deleteVariant);

// ===== CRO SIGNALS — Conversion Rate Optimization =====
// Returns live urgency signals: viewers, orders today, stock level, price drop
router.get('/:id/cro', require('./cro.signals'));

module.exports = router;
