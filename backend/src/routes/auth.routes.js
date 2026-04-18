const router = require('express').Router();
const ctrl = require('../controllers/auth.controller');
const { protect } = require('../middleware/auth.middleware');
const validate = require('../middleware/validate');
const { authLimiter, otpLimiter } = require('../config/rateLimiter');
const { registerSchema, loginSchema, otpSchema, verifyOtpSchema, changePasswordSchema } = require('../validators/auth.validator');

/**
 * @swagger
 * /auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Register a new user
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:     { type: string, example: Amina Hassan }
 *               email:    { type: string, format: email }
 *               phone:    { type: string, example: "+254700000000" }
 *               password: { type: string, example: "MyPass@123" }
 *               role:     { type: string, enum: [BUYER, SELLER] }
 *     responses:
 *       201:
 *         description: User registered successfully
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       409:
 *         description: Email or phone already exists
 */
router.post('/register', authLimiter, validate(registerSchema), ctrl.register);

/**
 * @swagger
 * /auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Login with email/phone and password
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:    { type: string, format: email }
 *               phone:    { type: string }
 *               password: { type: string }
 *     responses:
 *       200:
 *         description: Login successful, returns accessToken
 *       401:
 *         description: Invalid credentials
 */
router.post('/login',    authLimiter, validate(loginSchema),    ctrl.login);

/**
 * @swagger
 * /auth/refresh:
 *   post:
 *     tags: [Auth]
 *     summary: Refresh access token using refresh token cookie
 *     responses:
 *       200: { description: New access token issued }
 *       401: { description: Invalid or expired refresh token }
 */
router.post('/refresh',          ctrl.refreshToken);

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     tags: [Auth]
 *     summary: Logout and invalidate refresh token
 *     responses:
 *       200: { description: Logged out successfully }
 */
router.post('/logout',           ctrl.logout);

/**
 * @swagger
 * /auth/send-otp:
 *   post:
 *     tags: [Auth]
 *     summary: Send OTP to phone number
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [phone]
 *             properties:
 *               phone: { type: string, example: "+254700000000" }
 *     responses:
 *       200: { description: OTP sent }
 *       429: { $ref: '#/components/responses/TooManyRequests' }
 */
router.post('/send-otp',   otpLimiter, validate(otpSchema),       ctrl.sendOtp);
router.post('/verify-otp', otpLimiter, validate(verifyOtpSchema),  ctrl.verifyOtp);
router.post('/forgot-password', otpLimiter, ctrl.forgotPassword);
router.post('/reset-password',  otpLimiter, ctrl.resetPassword);
router.post('/google',          authLimiter, ctrl.googleAuth);
router.post('/phone',           otpLimiter, ctrl.phoneAuth);
router.post('/phone/verify',    otpLimiter, ctrl.verifyPhoneOtp);
router.post('/firebase-phone',  authLimiter, ctrl.firebasePhoneAuth);
router.post('/telegram-webapp', authLimiter, ctrl.telegramWebAppAuth);

/**
 * @swagger
 * /auth/me:
 *   get:
 *     tags: [Auth]
 *     summary: Get current authenticated user
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Current user data }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.get('/me',       protect, ctrl.getMe);
router.patch('/password', protect, validate(changePasswordSchema), ctrl.changePassword);

// Magic link
router.post('/magic-link',         authLimiter, ctrl.sendMagicLink);
router.get('/magic-link/verify',   ctrl.verifyMagicLink);

module.exports = router;
