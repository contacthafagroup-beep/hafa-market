'use strict';
const prisma = require('../config/prisma');
const logger = require('../config/logger');

// ===== AUDIT LOG ACTIONS =====
const AUDIT_ACTIONS = {
  // Auth
  USER_REGISTER:        'USER_REGISTER',
  USER_LOGIN:           'USER_LOGIN',
  USER_LOGOUT:          'USER_LOGOUT',
  USER_DEACTIVATED:     'USER_DEACTIVATED',
  USER_ACTIVATED:       'USER_ACTIVATED',
  PASSWORD_CHANGED:     'PASSWORD_CHANGED',
  // Products
  PRODUCT_CREATED:      'PRODUCT_CREATED',
  PRODUCT_UPDATED:      'PRODUCT_UPDATED',
  PRODUCT_DELETED:      'PRODUCT_DELETED',
  PRODUCT_APPROVED:     'PRODUCT_APPROVED',
  PRODUCT_REJECTED:     'PRODUCT_REJECTED',
  // Orders
  ORDER_PLACED:         'ORDER_PLACED',
  ORDER_CONFIRMED:      'ORDER_CONFIRMED',
  ORDER_SHIPPED:        'ORDER_SHIPPED',
  ORDER_DELIVERED:      'ORDER_DELIVERED',
  ORDER_CANCELLED:      'ORDER_CANCELLED',
  ORDER_REFUNDED:       'ORDER_REFUNDED',
  // Payments
  PAYMENT_INITIATED:    'PAYMENT_INITIATED',
  PAYMENT_SUCCESS:      'PAYMENT_SUCCESS',
  PAYMENT_FAILED:       'PAYMENT_FAILED',
  PAYOUT_REQUESTED:     'PAYOUT_REQUESTED',
  PAYOUT_PROCESSED:     'PAYOUT_PROCESSED',
  // Sellers
  SELLER_REGISTERED:    'SELLER_REGISTERED',
  SELLER_VERIFIED:      'SELLER_VERIFIED',
  SELLER_SUSPENDED:     'SELLER_SUSPENDED',
  // Admin
  ADMIN_LOGIN:          'ADMIN_LOGIN',
  ADMIN_USER_UPDATED:   'ADMIN_USER_UPDATED',
  ADMIN_CACHE_FLUSHED:  'ADMIN_CACHE_FLUSHED',
  ADMIN_PAYOUT_PROCESSED:'ADMIN_PAYOUT_PROCESSED',
};

/**
 * Write an audit log entry.
 * Fire-and-forget — never throws, never blocks the request.
 */
async function audit(action, { userId, targetId, targetType, before, after, meta, ip, userAgent } = {}) {
  try {
    await prisma.auditLog.create({
      data: {
        action,
        userId:     userId     || null,
        targetId:   targetId   || null,
        targetType: targetType || null,
        before:     before     ? JSON.parse(JSON.stringify(before)) : undefined,
        after:      after      ? JSON.parse(JSON.stringify(after))  : undefined,
        meta:       meta       ? JSON.parse(JSON.stringify(meta))   : undefined,
        ip:         ip         || null,
        userAgent:  userAgent  || null,
      },
    });
  } catch (err) {
    // Never crash the app over audit logging
    logger.error(`Audit log failed [${action}]: ${err.message}`);
  }
}

/**
 * Express middleware — attaches audit helper to req.audit()
 */
function auditMiddleware(req, res, next) {
  req.audit = (action, opts = {}) => audit(action, {
    userId:    req.user?.id,
    ip:        req.ip || req.connection?.remoteAddress,
    userAgent: req.headers['user-agent'],
    ...opts,
  });
  next();
}

module.exports = { audit, auditMiddleware, AUDIT_ACTIONS };
