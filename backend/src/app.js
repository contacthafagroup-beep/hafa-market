require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');

const { errorHandler, notFound } = require('./middleware/errorHandler');
const { cacheStatsLogger } = require('./middleware/cache.middleware');
const { auditMiddleware } = require('./services/audit.service');
const { metricsMiddleware, metricsHandler } = require('./config/metrics');
const { apiLimiter, authLimiter, searchLimiter, uploadLimiter, paymentLimiter } = require('./config/rateLimiter');
const sanitize = require('./middleware/sanitize');
const logger = require('./config/logger');

// Route imports
const healthRoutes       = require('./routes/health.routes');
const authRoutes         = require('./routes/auth.routes');
const userRoutes         = require('./routes/user.routes');
const productRoutes      = require('./routes/product.routes');
const categoryRoutes     = require('./routes/category.routes');
const cartRoutes         = require('./routes/cart.routes');
const wishlistRoutes     = require('./routes/wishlist.routes');
const orderRoutes        = require('./routes/order.routes');
const paymentRoutes      = require('./routes/payment.routes');
const deliveryRoutes     = require('./routes/delivery.routes');
const sellerRoutes       = require('./routes/seller.routes');
const reviewRoutes       = require('./routes/review.routes');
const notificationRoutes = require('./routes/notification.routes');
const chatRoutes         = require('./routes/chat.routes');
const aiRoutes           = require('./routes/ai.routes');
const adminRoutes        = require('./routes/admin.routes');
const uploadRoutes       = require('./routes/upload.routes');
const blogRoutes         = require('./routes/blog.routes');
const bannerRoutes       = require('./routes/banner.routes');
const bankTransferRoutes = require('./routes/bankTransfer.routes');
const refundRoutes       = require('./routes/refund.routes');
const searchRoutes       = require('./routes/search.routes');
const bulkOrderRoutes    = require('./routes/bulkOrder.routes');
const disputeRoutes      = require('./routes/dispute.routes');
const kycRoutes          = require('./routes/kyc.routes');
const referralRoutes     = require('./routes/referral.routes');
const adsRoutes          = require('./routes/ads.routes');
const featuresRoutes     = require('./routes/features.routes');
const features2Routes    = require('./routes/features2.routes');
const invoiceRoutes      = require('./routes/invoice.routes');
const liveRoutes         = require('./routes/live.routes');
const socialRoutes       = require('./routes/social.routes');
const postsRoutes        = require('./routes/posts.routes');
const exportRoutes       = require('./routes/export.routes');

const app = express();

// ===== SECURITY HEADERS (Helmet) =====
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:  ["'self'"],
      scriptSrc:   ["'self'", "'unsafe-inline'", 'cdn.jsdelivr.net'],  // needed for Swagger UI
      styleSrc:    ["'self'", "'unsafe-inline'", 'cdn.jsdelivr.net'],
      imgSrc:      ["'self'", 'data:', 'https:'],
      connectSrc:  ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false, // needed for Swagger UI
}));

// ===== CORS =====
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:5173',
  process.env.CLIENT_URL,
  process.env.NGROK_URL,
  process.env.APP_URL,
  // Extra origins from env (comma-separated)
  ...(process.env.EXTRA_ORIGINS ? process.env.EXTRA_ORIGINS.split(',').map(o => o.trim()) : []),
].filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (mobile apps, curl, Postman)
    if (!origin) return cb(null, true);
    // Allow any ngrok domain
    if (origin.includes('.ngrok') || origin.includes('.ngrok-free')) return cb(null, true);
    if (allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization','X-Requested-With'],
}));

// ===== GENERAL MIDDLEWARE =====
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());
app.use(morgan('combined', { stream: { write: msg => logger.info(msg.trim()) } }));
app.use(cacheStatsLogger);
app.use(auditMiddleware);
app.use(metricsMiddleware);
app.use(sanitize);

// ===== HEALTH CHECKS (no rate limit, no auth) =====
app.use('/health', healthRoutes);

// ===== METRICS (Prometheus — restrict in production) =====
app.get('/metrics', (req, res, next) => {
  // In production, only allow internal/monitoring IPs
  if (process.env.NODE_ENV === 'production') {
    const allowed = (process.env.METRICS_ALLOWED_IPS || '127.0.0.1,::1').split(',');
    const clientIp = req.ip || req.connection.remoteAddress;
    if (!allowed.some(ip => clientIp.includes(ip.trim()))) {
      return res.status(403).json({ error: 'Metrics endpoint restricted.' });
    }
  }
  metricsHandler(req, res);
});

// ===== SWAGGER DOCS =====
const swaggerOptions = {
  customCss: '.swagger-ui .topbar { background: #2E7D32; } .swagger-ui .topbar-wrapper img { content: url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 100 30\'%3E%3Ctext y=\'25\' font-size=\'20\' fill=\'white\'%3E🌿 Hafa Market%3C/text%3E%3C/svg%3E"); }',
  customSiteTitle: 'Hafa Market API Docs',
  swaggerOptions: { persistAuthorization: true },
};
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, swaggerOptions));
app.get('/api-docs.json', (req, res) => res.json(swaggerSpec));

// ===== GLOBAL RATE LIMIT =====
app.use('/api/', apiLimiter);

// ===== API ROUTES =====
const API = '/api/v1';
app.use(`${API}/auth`,          authRoutes);       // has own authLimiter + otpLimiter
app.use(`${API}/users`,         userRoutes);
app.use(`${API}/products`,      productRoutes);
app.use(`${API}/categories`,    categoryRoutes);
app.use(`${API}/cart`,          cartRoutes);
app.use(`${API}/wishlist`,      wishlistRoutes);
app.use(`${API}/orders`,        orderRoutes);
app.use(`${API}/payments`,      paymentLimiter, paymentRoutes);
app.use(`${API}/delivery`,      deliveryRoutes);
app.use(`${API}/sellers`,       sellerRoutes);
app.use(`${API}/reviews`,       reviewRoutes);
app.use(`${API}/notifications`, notificationRoutes);
app.use(`${API}/chat`,          chatRoutes);
app.use(`${API}/ai`,            aiRoutes);
app.use(`${API}/admin`,         adminRoutes);
app.use(`${API}/upload`,        uploadLimiter, uploadRoutes);
app.use(`${API}/blog`,          blogRoutes);
app.use(`${API}/banners`,       bannerRoutes);
app.use(`${API}/bank-transfers`,bankTransferRoutes);
app.use(`${API}/refunds`,       refundRoutes);
app.use(`${API}/search`,        searchLimiter, searchRoutes);
app.use(`${API}/bulk-orders`,   bulkOrderRoutes);
app.use(`${API}/disputes`,      disputeRoutes);
app.use(`${API}/kyc`,           kycRoutes);
app.use(`${API}/referrals`,     referralRoutes);
app.use(`${API}/ads`,           adsRoutes);
app.use(`${API}/features`,      featuresRoutes);
app.use(`${API}/features`,      features2Routes);
app.use(`${API}/orders/:id/invoice`, invoiceRoutes);
app.use(`${API}/live`,          liveRoutes);
app.use(`${API}/social`,        socialRoutes);
app.use(`${API}/posts`,         postsRoutes);
app.use(`${API}/export`,        exportRoutes);

// ===== ANALYTICS EVENT TRACKING =====
app.post(`${API}/analytics/event`, apiLimiter, async (req, res) => {
  try {
    const { type, productId, sellerId, sessionId, meta, city, device } = req.body;
    if (!type) return res.json({ success: false });
    const prisma = require('./config/prisma');
    await prisma.analyticsEvent.create({
      data: { type, userId: req.user?.id, productId, sellerId, sessionId, meta, city, device },
    }).catch(() => {});
    res.json({ success: true });
  } catch { res.json({ success: false }); }
});

// ===== ERROR HANDLING =====
app.use(notFound);
app.use(errorHandler);

module.exports = app;
