'use strict';
const crypto  = require('crypto');
const prisma  = require('../config/prisma');
const logger  = require('../config/logger');
const { getRedis, isAvailable } = require('../config/redis');
const { createNotification } = require('./notification.service');
const { dispatchEmail, dispatchOrder } = require('../jobs/queues');
const { audit, AUDIT_ACTIONS } = require('./audit.service');

// ===== PAYMENT EXPIRY =====
const PAYMENT_EXPIRY_MINUTES = {
  MPESA:               30,
  CHAPA:               60,
  TELEBIRR:            60,
  CBE_BIRR:            60,
  CHAPA_BANK:         1440,
  FLUTTERWAVE:         60,
  CARD:                60,
  BANK_TRANSFER:     1440,  // 24 hours
  CASH_ON_DELIVERY:  2880,  // 48 hours
  PAYMENT_ON_DELIVERY:2880,
  PAYPAL:              60,
};

// ===== LOG PAYMENT EVENT =====
async function logPaymentEvent(paymentId, event, status, data = {}, ip = null) {
  try {
    await prisma.paymentLog.create({
      data: { paymentId, event, status, data, ip },
    });
  } catch (err) {
    logger.warn(`PaymentLog write failed: ${err.message}`);
  }
}

// ===== IDEMPOTENCY KEY =====
// Generates a deterministic key from webhook payload to prevent double-processing
function makeIdempotencyKey(source, identifier) {
  return crypto.createHash('sha256').update(`${source}:${identifier}`).digest('hex');
}

// ===== REDIS IDEMPOTENCY LOCK =====
// Returns true if this is a NEW event (not seen before), false if duplicate
async function acquireIdempotencyLock(key, ttlSeconds = 86400) {
  if (!isAvailable()) {
    // Fallback: check DB for idempotency key
    const existing = await prisma.payment.findFirst({ where: { idempotencyKey: key } });
    return !existing; // true = new, false = duplicate
  }
  try {
    const redis  = getRedis();
    const lockKey = `idem:${key}`;
    // SET NX EX — atomic set-if-not-exists with expiry
    const result = await redis.set(lockKey, '1', { NX: true, EX: ttlSeconds });
    return result === 'OK'; // OK = acquired (new), null = already exists (duplicate)
  } catch (err) {
    logger.warn(`Idempotency lock error: ${err.message}`);
    return true; // fail open — allow processing
  }
}

// ===== MARK PAYMENT PAID (idempotent) =====
async function markPaid(paymentId, { transactionId, providerRef, note, method, ip } = {}) {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { order: { include: { user: { select: { id:true, name:true, email:true } } } } },
  });
  if (!payment) { logger.warn(`markPaid: payment ${paymentId} not found`); return null; }

  // ===== IDEMPOTENCY CHECK =====
  if (payment.status === 'PAID') {
    logger.info(`markPaid: ${paymentId} already PAID — idempotent skip`);
    await logPaymentEvent(paymentId, 'DUPLICATE_PAID_ATTEMPT', 'PAID', { transactionId, note }, ip);
    return payment;
  }

  // Check if payment is expired
  if (payment.expiresAt && payment.expiresAt < new Date()) {
    logger.warn(`markPaid: payment ${paymentId} is EXPIRED`);
    await markFailed(paymentId, { reason: 'Payment expired', code: 'EXPIRED', ip });
    throw new Error('Payment has expired. Please create a new order.');
  }

  // ===== ATOMIC TRANSACTION =====
  const updated = await prisma.$transaction(async (tx) => {
    // Re-read inside transaction to prevent race condition
    const fresh = await tx.payment.findUnique({ where: { id: paymentId } });
    if (fresh.status === 'PAID') return fresh; // double-check inside tx

    const p = await tx.payment.update({
      where: { id: paymentId },
      data: {
        status:       'PAID',
        paidAt:       new Date(),
        processedAt:  new Date(),
        ...(transactionId && { transactionId }),
        ...(providerRef   && { providerRef }),
        ...(method        && { method }),
      },
    });

    await tx.order.update({
      where: { id: payment.orderId },
      data: {
        status: 'CONFIRMED',
        statusHistory: { create: { status: 'CONFIRMED', note: note || 'Payment confirmed' } },
      },
    });

    return p;
  });

  // ===== SIDE EFFECTS (fire-and-forget) =====
  const user  = payment.order.user;
  const order = payment.order;

  await logPaymentEvent(paymentId, 'PAYMENT_CONFIRMED', 'PAID',
    { transactionId, method: updated.method, amount: payment.amount }, ip);

  createNotification(user.id, 'PAYMENT_SUCCESS', 'Payment Confirmed ✅',
    `Your payment of $${payment.amount.toFixed(2)} for order #${order.id.slice(-8).toUpperCase()} was successful.`,
    { orderId: order.id }).catch(() => {});

  dispatchEmail('ORDER_CONFIRMATION', {
    type: 'ORDER_CONFIRMATION',
    data: { name: user.name, email: user.email, orderId: order.id.slice(-8).toUpperCase(),
            total: order.total, address: '' },
  }).catch(() => {});

  dispatchOrder('LOYALTY_POINTS', { type: 'LOYALTY_POINTS', orderId: order.id }).catch(() => {});

  audit(AUDIT_ACTIONS.PAYMENT_SUCCESS, {
    userId: user.id, targetId: paymentId, targetType: 'Payment',
    meta: { method: updated.method, amount: payment.amount, transactionId },
  });

  logger.info(`✅ Payment PAID: ${paymentId} | order: ${payment.orderId} | method: ${updated.method} | tx: ${transactionId}`);
  return updated;
}

// ===== MARK PAYMENT FAILED (idempotent) =====
async function markFailed(paymentId, { reason, code, ip } = {}) {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { order: { include: { user: { select: { id:true, name:true } } } } },
  });
  if (!payment) { logger.warn(`markFailed: payment ${paymentId} not found`); return null; }
  if (payment.status === 'PAID') {
    logger.warn(`markFailed: ${paymentId} already PAID — ignoring failure`);
    return payment;
  }
  if (payment.status === 'FAILED') {
    logger.info(`markFailed: ${paymentId} already FAILED — idempotent skip`);
    return payment;
  }

  const updated = await prisma.payment.update({
    where: { id: paymentId },
    data: {
      status:        'FAILED',
      failureReason: reason || 'Payment failed',
      retryCount:    { increment: 1 },
    },
  });

  // Keep order PENDING so user can retry
  await prisma.order.update({
    where: { id: payment.orderId },
    data: { statusHistory: { create: { status: 'PENDING',
              note: `Payment failed: ${reason || 'Unknown reason'}` } } },
  });

  await logPaymentEvent(paymentId, 'PAYMENT_FAILED', 'FAILED', { reason, code }, ip);

  const user = payment.order.user;
  createNotification(user.id, 'PAYMENT_FAILED', 'Payment Failed ❌',
    `Your payment for order #${payment.orderId.slice(-8).toUpperCase()} failed. Please try again.`,
    { orderId: payment.orderId, retryUrl: `/orders/${payment.orderId}/pay` }).catch(() => {});

  audit('PAYMENT_FAILED', {
    userId: user.id, targetId: paymentId, targetType: 'Payment',
    meta: { reason, code, method: payment.method },
  });

  logger.warn(`❌ Payment FAILED: ${paymentId} | order: ${payment.orderId} | reason: ${reason}`);
  return updated;
}

// ===== EXPIRE STALE PAYMENTS (run via cron/job) =====
async function expireStalePayments() {
  const expired = await prisma.payment.findMany({
    where: { status: { in: ['PENDING'] }, expiresAt: { lt: new Date() } },
    include: { order: { select: { id:true, userId:true, items:true } } },
  });

  let count = 0;
  for (const payment of expired) {
    try {
      await prisma.$transaction(async (tx) => {
        await tx.payment.update({ where: { id: payment.id }, data: { status: 'FAILED', failureReason: 'Payment expired' } });
        await tx.order.update({ where: { id: payment.orderId },
          data: { status: 'CANCELLED', cancelReason: 'Payment timeout',
                  statusHistory: { create: { status: 'CANCELLED', note: 'Auto-cancelled: payment expired' } } } });
        // Restore stock
        for (const item of payment.order.items || []) {
          await tx.product.update({ where: { id: item.productId },
            data: { stock: { increment: item.quantity }, soldCount: { decrement: item.quantity } } });
        }
      });
      await logPaymentEvent(payment.id, 'PAYMENT_EXPIRED', 'FAILED', {});
      count++;
    } catch (err) {
      logger.error(`Failed to expire payment ${payment.id}: ${err.message}`);
    }
  }

  if (count > 0) logger.info(`Expired ${count} stale payments`);
  return count;
}

// ===== DOUBLE PAYMENT CHECK =====
async function checkDoublePayment(orderId) {
  const payment = await prisma.payment.findUnique({ where: { orderId } });
  if (!payment) return { safe: true };
  if (payment.status === 'PAID') return { safe: false, reason: 'Order already paid', payment };
  if (payment.expiresAt && payment.expiresAt < new Date()) {
    return { safe: false, reason: 'Payment session expired. Please retry.', expired: true };
  }
  return { safe: true, payment };
}

// ===== FIND BY PROVIDER REF =====
async function findByRef(field, value) {
  return prisma.payment.findFirst({ where: { [field]: value } });
}

// ===== SET PAYMENT EXPIRY =====
async function setPaymentExpiry(orderId, method) {
  const minutes = PAYMENT_EXPIRY_MINUTES[method] || 60;
  const expiresAt = new Date(Date.now() + minutes * 60 * 1000);
  await prisma.payment.update({ where: { orderId }, data: { expiresAt } });
  return expiresAt;
}

module.exports = {
  markPaid, markFailed, findByRef,
  makeIdempotencyKey, acquireIdempotencyLock,
  expireStalePayments, checkDoublePayment,
  setPaymentExpiry, logPaymentEvent,
};
