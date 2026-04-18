'use strict';
const { Queue } = require('bullmq');
const logger = require('../config/logger');

const CONNECTION = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT) || 6379,
};

// ===== QUEUE DEFINITIONS =====
let emailQueue, notificationQueue, orderQueue, analyticsQueue;

function initQueues() {
  try {
    emailQueue = new Queue('email', {
      connection: CONNECTION,
      defaultJobOptions: { attempts: 3, backoff: { type: 'exponential', delay: 2000 }, removeOnComplete: 100, removeOnFail: 200 },
    });

    notificationQueue = new Queue('notification', {
      connection: CONNECTION,
      defaultJobOptions: { attempts: 3, backoff: { type: 'exponential', delay: 1000 }, removeOnComplete: 100, removeOnFail: 200 },
    });

    orderQueue = new Queue('order', {
      connection: CONNECTION,
      defaultJobOptions: { attempts: 2, backoff: { type: 'fixed', delay: 5000 }, removeOnComplete: 50, removeOnFail: 100 },
    });

    analyticsQueue = new Queue('analytics', {
      connection: CONNECTION,
      defaultJobOptions: { attempts: 1, removeOnComplete: 20, removeOnFail: 50 },
    });

    logger.info('✅ BullMQ queues initialized');
  } catch (err) {
    logger.warn(`⚠️  BullMQ unavailable — background jobs disabled. (${err.message})`);
  }
}

// ===== JOB DISPATCHERS =====

async function dispatchEmail(type, payload, opts = {}) {
  if (!emailQueue) return null;
  try {
    return await emailQueue.add(type, payload, opts);
  } catch (err) {
    logger.warn(`Email queue error: ${err.message}`);
    return null;
  }
}

async function dispatchNotification(type, payload, opts = {}) {
  if (!notificationQueue) return null;
  try {
    return await notificationQueue.add(type, payload, opts);
  } catch (err) {
    logger.warn(`Notification queue error: ${err.message}`);
    return null;
  }
}

async function dispatchOrder(type, payload, opts = {}) {
  if (!orderQueue) return null;
  try {
    return await orderQueue.add(type, payload, opts);
  } catch (err) {
    logger.warn(`Order queue error: ${err.message}`);
    return null;
  }
}

async function dispatchAnalytics(type, payload, opts = {}) {
  if (!analyticsQueue) return null;
  try {
    return await analyticsQueue.add(type, payload, { delay: 5000, ...opts });
  } catch (err) {
    logger.warn(`Analytics queue error: ${err.message}`);
    return null;
  }
}

function getQueues() {
  return { emailQueue, notificationQueue, orderQueue, analyticsQueue };
}

module.exports = { initQueues, dispatchEmail, dispatchNotification, dispatchOrder, dispatchAnalytics, getQueues };

// ===== SCHEDULE RECURRING JOBS =====
async function scheduleRecurringJobs() {
  if (!orderQueue) return;
  try {
    // Expire stale payments every 15 minutes
    await orderQueue.add('EXPIRE_PAYMENTS', { type: 'EXPIRE_PAYMENTS' }, {
      repeat: { every: 15 * 60 * 1000 },
      jobId: 'expire-payments-recurring',
    });

    // Refresh search trending scores every 30 minutes
    await orderQueue.add('REFRESH_TRENDING', { type: 'REFRESH_TRENDING' }, {
      repeat: { every: 30 * 60 * 1000 },
      jobId: 'refresh-trending-recurring',
    });

    // Refresh post scores every 30 minutes (time decay)
    await orderQueue.add('REFRESH_POST_SCORES', { type: 'REFRESH_POST_SCORES' }, {
      repeat: { every: 30 * 60 * 1000 },
      jobId: 'refresh-post-scores-recurring',
    });

    // Abandoned cart recovery — check every hour
    await orderQueue.add('ABANDONED_CART_RECOVERY', { type: 'ABANDONED_CART_RECOVERY' }, {
      repeat: { every: 60 * 60 * 1000 },
      jobId: 'abandoned-cart-recovery-recurring',
    });

    // Process subscriptions — check daily
    await orderQueue.add('PROCESS_SUBSCRIPTIONS', { type: 'PROCESS_SUBSCRIPTIONS' }, {
      repeat: { every: 24 * 60 * 60 * 1000 },
      jobId: 'process-subscriptions-recurring',
    });

    logger.info('✅ Recurring jobs scheduled');
  } catch (err) {
    logger.warn(`Recurring jobs scheduling failed: ${err.message}`);
  }
}

module.exports = { initQueues, dispatchEmail, dispatchNotification, dispatchOrder, dispatchAnalytics, getQueues, scheduleRecurringJobs };
