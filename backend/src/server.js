const app = require('./app');
const { createServer } = require('http');
const { initSocket } = require('./socket');
const { connectRedis } = require('./config/redis');
const { initQueues, scheduleRecurringJobs } = require('./jobs/queues');
const { initWorkers, closeWorkers } = require('./jobs/workers');
const { initTelegramBot } = require('./services/telegram.service');
const { initTypesense } = require('./config/typesense');
const logger = require('./config/logger');
const prisma = require('./config/prisma');

const PORT = process.env.PORT || 5001;
const httpServer = createServer(app);

initSocket(httpServer);

// ===== FIREBASE ADMIN INIT =====
function initFirebaseAdmin() {
  try {
    if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_PRIVATE_KEY || !process.env.FIREBASE_CLIENT_EMAIL) {
      logger.warn('Firebase Admin: missing env vars — push notifications disabled');
      return;
    }
    const admin = require('firebase-admin');
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId:   process.env.FIREBASE_PROJECT_ID,
          privateKey:  process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        }),
      });
      logger.info('✅ Firebase Admin initialized');
    }
  } catch (err) {
    logger.warn(`Firebase Admin init failed (non-critical): ${err.message}`);
  }
}

async function start() {
  try {
    initFirebaseAdmin();
    connectRedis().catch(() => {});
    initQueues();
    initWorkers();
    scheduleRecurringJobs().catch(() => {});
    setTimeout(() => initTelegramBot(prisma), 2000);
    initTypesense(prisma).catch(() => {});
    httpServer.listen(PORT, () => {
      logger.info(`🚀 Hafa Market API running on port ${PORT} [${process.env.NODE_ENV}]`);
    });
  } catch (err) {
    logger.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();

process.on('SIGTERM', async () => {
  logger.info('SIGTERM received. Shutting down gracefully...');
  await closeWorkers();
  httpServer.close(() => process.exit(0));
});
