'use strict';
const prisma  = require('../config/prisma');
const { AppError } = require('../middleware/errorHandler');
const logger  = require('../config/logger');
const { logPaymentEvent } = require('../services/payment.service');
const { audit, AUDIT_ACTIONS } = require('../services/audit.service');
const { createNotification } = require('../services/notification.service');
const { dispatchEmail } = require('../jobs/queues');

// ===== REFUND ELIGIBILITY WINDOW =====
const REFUND_WINDOW_DAYS = 7;

// ===== REQUEST REFUND (buyer) =====
exports.requestRefund = async (req, res, next) => {
  try {
    const { orderId, reason, amount } = req.body;

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { payment: true, user: { select: { id:true, name:true, email:true } } },
    });
    if (!order)                        throw new AppError('Order not found.', 404);
    if (order.userId !== req.user.id)  throw new AppError('Not authorized.', 403);

    // Eligibility checks
    if (!['DELIVERED','CONFIRMED','PROCESSING'].includes(order.status)) {
      throw new AppError(`Order status "${order.status}" is not eligible for refund.`, 400);
    }
    if (!order.payment || order.payment.status !== 'PAID') {
      throw new AppError('Only paid orders can be refunded.', 400);
    }

    // Refund window check
    const paidAt   = order.payment.paidAt || order.createdAt;
    const daysSince = (Date.now() - new Date(paidAt).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSince > REFUND_WINDOW_DAYS) {
      throw new AppError(`Refund window has expired (${REFUND_WINDOW_DAYS} days). Please contact support.`, 400);
    }

    // Check no existing pending refund
    const existing = await prisma.refund.findFirst({
      where: { orderId, status: { in: ['PENDING','APPROVED','PROCESSING'] } },
    });
    if (existing) throw new AppError('A refund request already exists for this order.', 409);

    const refundAmount = amount && amount <= order.payment.amount ? parseFloat(amount) : order.payment.amount;

    const refund = await prisma.refund.create({
      data: {
        paymentId: order.payment.id,
        orderId,
        userId:    req.user.id,
        amount:    refundAmount,
        reason,
        method:    order.payment.method,
        status:    'PENDING',
      },
    });

    await logPaymentEvent(order.payment.id, 'REFUND_REQUESTED', 'PAID',
      { refundId: refund.id, amount: refundAmount, reason }, req.ip);

    // Notify admin
    createNotification(req.user.id, 'SYSTEM', 'Refund Request Submitted 📋',
      `Your refund request for order #${orderId.slice(-8).toUpperCase()} has been submitted. We will review it within 1–2 business days.`,
      { orderId, refundId: refund.id }).catch(() => {});

    logger.info(`Refund requested: order=${orderId} amount=${refundAmount} by user=${req.user.id}`);

    res.status(201).json({
      success: true,
      message: 'Refund request submitted. We will review it within 1–2 business days.',
      data: { refundId: refund.id, amount: refundAmount, status: 'PENDING' },
    });
  } catch (err) { next(err); }
};

// ===== GET MY REFUNDS (buyer) =====
exports.getMyRefunds = async (req, res, next) => {
  try {
    const refunds = await prisma.refund.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: refunds });
  } catch (err) { next(err); }
};

// ===== ADMIN: GET ALL REFUNDS =====
exports.getAllRefunds = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const where = status ? { status } : {};
    const [refunds, total] = await Promise.all([
      prisma.refund.findMany({
        where, skip: (parseInt(page)-1)*parseInt(limit), take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
      }),
      prisma.refund.count({ where }),
    ]);

    // Enrich with order + user + payment data
    const enriched = await Promise.all(refunds.map(async (r) => {
      const order = await prisma.order.findUnique({
        where: { id: r.orderId },
        include: {
          user:    { select: { name:true, email:true, phone:true } },
          payment: { select: { method:true, transactionId:true, mpesaCode:true, chapaRef:true } },
        },
      });
      return { ...r, order };
    }));

    res.json({ success:true, data:enriched,
      pagination: { page:parseInt(page), limit:parseInt(limit), total, pages:Math.ceil(total/parseInt(limit)) } });
  } catch (err) { next(err); }
};

// ===== ADMIN: PROCESS REFUND =====
exports.processRefund = async (req, res, next) => {
  try {
    const { refundId, action, notes } = req.body;
    if (!['approve','reject'].includes(action)) throw new AppError('Action must be "approve" or "reject".', 400);

    const refund = await prisma.refund.findUnique({ where: { id: refundId } });
    if (!refund) throw new AppError('Refund not found.', 404);
    if (!['PENDING','APPROVED'].includes(refund.status)) {
      throw new AppError(`Refund is already ${refund.status}.`, 400);
    }

    const order = await prisma.order.findUnique({
      where: { id: refund.orderId },
      include: {
        payment: true,
        user: { select: { id:true, name:true, email:true } },
      },
    });
    if (!order) throw new AppError('Order not found.', 404);

    const user    = order.user;
    const payment = order.payment;

    if (action === 'reject') {
      await prisma.refund.update({
        where: { id: refundId },
        data: { status: 'REJECTED', processedBy: req.user.id, processedAt: new Date(), notes },
      });

      createNotification(user.id, 'SYSTEM', 'Refund Request Rejected ❌',
        `Your refund request for order #${refund.orderId.slice(-8).toUpperCase()} was rejected. Reason: ${notes || 'Contact support for details.'}`,
        { orderId: refund.orderId }).catch(() => {});

      await logPaymentEvent(payment.id, 'REFUND_REJECTED', 'PAID',
        { refundId, adminId: req.user.id, notes }, req.ip);

      audit('REFUND_REJECTED', { userId: req.user.id, targetId: refundId, targetType: 'Refund',
        meta: { orderId: refund.orderId, amount: refund.amount, notes } });

      return res.json({ success: true, message: 'Refund rejected. Buyer notified.' });
    }

    // ===== APPROVE & PROCESS =====
    await prisma.refund.update({
      where: { id: refundId },
      data: { status: 'PROCESSING', processedBy: req.user.id, processedAt: new Date(), notes },
    });

    let refundRef = null;
    let walletCredited = false;
    let refundError = null;

    // ===== GATEWAY REFUND =====
    try {
      switch (payment.method) {
        case 'CARD': {
          if (payment.transactionId) {
            const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
            const stripeRefund = await stripe.refunds.create({
              payment_intent: payment.transactionId,
              amount: Math.round(refund.amount * 100),
              reason: 'requested_by_customer',
            });
            refundRef = stripeRefund.id;
          }
          break;
        }
        case 'FLUTTERWAVE': {
          if (payment.transactionId) {
            const res = await fetch(`https://api.flutterwave.com/v3/transactions/${payment.transactionId}/refund`, {
              method: 'POST',
              headers: { Authorization: `Bearer ${process.env.FLW_SECRET_KEY}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ amount: refund.amount }),
            });
            const data = await res.json();
            if (data.status === 'success') refundRef = data.data?.id ? String(data.data.id) : 'FLW-REFUND';
          }
          break;
        }
        case 'CHAPA':
        case 'CHAPA_BANK':
        case 'TELEBIRR':
        case 'CBE_BIRR': {
          // Chapa refunds via their API
          if (payment.chapaRef && process.env.CHAPA_SECRET_KEY) {
            const res = await fetch('https://api.chapa.co/v1/refund', {
              method: 'POST',
              headers: { Authorization: `Bearer ${process.env.CHAPA_SECRET_KEY}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ tx_ref: payment.chapaRef, amount: refund.amount }),
            });
            const data = await res.json();
            if (data.status === 'success') refundRef = data.data?.refund_id || 'CHAPA-REFUND';
          }
          break;
        }
        case 'MPESA': {
          // M-Pesa refunds via B2C reversal — credit wallet as fallback
          walletCredited = true;
          break;
        }
        case 'BANK_TRANSFER': {
          // Manual bank refund — credit wallet, admin handles bank transfer
          walletCredited = true;
          break;
        }
        case 'CASH_ON_DELIVERY':
        case 'PAYMENT_ON_DELIVERY': {
          // Cash refund — credit wallet
          walletCredited = true;
          break;
        }
        default:
          walletCredited = true;
      }
    } catch (err) {
      logger.error(`Gateway refund failed for ${refundId}: ${err.message}`);
      refundError = err.message;
      walletCredited = true; // fallback to wallet
    }

    // ===== CREDIT WALLET (fallback or primary) =====
    if (walletCredited) {
      await creditWallet(user.id, refund.amount, payment.currency || 'USD',
        `Refund for order #${refund.orderId.slice(-8).toUpperCase()}`, refundId);
    }

    // ===== FINALIZE =====
    await prisma.$transaction([
      prisma.refund.update({
        where: { id: refundId },
        data: {
          status:        'COMPLETED',
          refundRef:     refundRef || `WALLET-${Date.now()}`,
          walletCredited,
          notes:         notes || (walletCredited ? 'Refunded to wallet' : 'Gateway refund processed'),
        },
      }),
      prisma.payment.update({
        where: { id: payment.id },
        data: { status: 'REFUNDED' },
      }),
      prisma.order.update({
        where: { id: refund.orderId },
        data: { status: 'REFUNDED',
                statusHistory: { create: { status: 'REFUNDED',
                  note: `Refund processed. Amount: $${refund.amount}. ${walletCredited ? 'Credited to wallet.' : 'Gateway refund.'}` } } },
      }),
    ]);

    await logPaymentEvent(payment.id, 'REFUND_COMPLETED', 'REFUNDED',
      { refundId, amount: refund.amount, walletCredited, refundRef, refundError }, req.ip);

    // Notify buyer
    const refundMsg = walletCredited
      ? `$${refund.amount.toFixed(2)} has been credited to your Hafa Market wallet.`
      : `$${refund.amount.toFixed(2)} will be returned to your original payment method within 3–5 business days.`;

    createNotification(user.id, 'PAYMENT_SUCCESS', 'Refund Approved ✅',
      `Your refund for order #${refund.orderId.slice(-8).toUpperCase()} has been approved. ${refundMsg}`,
      { orderId: refund.orderId, refundId }).catch(() => {});

    dispatchEmail('REFUND_APPROVED', {
      type: 'REFUND_APPROVED',
      data: { name: user.name, email: user.email, amount: refund.amount,
              orderId: refund.orderId.slice(-8).toUpperCase(), walletCredited, refundMsg },
    }).catch(() => {});

    audit(AUDIT_ACTIONS.ORDER_REFUNDED || 'REFUND_APPROVED', {
      userId: req.user.id, targetId: refundId, targetType: 'Refund',
      meta: { orderId: refund.orderId, amount: refund.amount, walletCredited, refundRef },
    });

    logger.info(`✅ Refund COMPLETED: ${refundId} | order=${refund.orderId} | amount=${refund.amount} | wallet=${walletCredited}`);

    res.json({
      success: true,
      message: `Refund of $${refund.amount.toFixed(2)} processed successfully.`,
      data: { refundId, amount: refund.amount, walletCredited, refundRef, status: 'COMPLETED' },
    });
  } catch (err) { next(err); }
};

// ===== WALLET CREDIT HELPER =====
async function creditWallet(userId, amount, currency, description, refId) {
  const wallet = await prisma.wallet.upsert({
    where: { userId },
    update: { balance: { increment: amount } },
    create: { userId, balance: amount, currency },
  });

  await prisma.walletTransaction.create({
    data: {
      walletId:    wallet.id,
      type:        'CREDIT',
      amount,
      balance:     wallet.balance,
      description,
      refId,
    },
  });

  logger.info(`Wallet credited: user=${userId} amount=${amount} balance=${wallet.balance}`);
  return wallet;
}

// ===== GET WALLET =====
exports.getWallet = async (req, res, next) => {
  try {
    const wallet = await prisma.wallet.findUnique({
      where: { userId: req.user.id },
      include: {
        transactions: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
    });

    if (!wallet) {
      return res.json({ success: true, data: { balance: 0, currency: 'USD', transactions: [] } });
    }
    res.json({ success: true, data: wallet });
  } catch (err) { next(err); }
};

// ===== USE WALLET BALANCE AT CHECKOUT =====
exports.payWithWallet = async (req, res, next) => {
  try {
    const { orderId } = req.body;

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { payment: true },
    });
    if (!order)                        throw new AppError('Order not found.', 404);
    if (order.userId !== req.user.id)  throw new AppError('Not authorized.', 403);
    if (order.payment?.status === 'PAID') throw new AppError('Order already paid.', 409);

    const wallet = await prisma.wallet.findUnique({ where: { userId: req.user.id } });
    if (!wallet || wallet.balance < order.total) {
      throw new AppError(`Insufficient wallet balance. Available: $${wallet?.balance?.toFixed(2) || '0.00'}, Required: $${order.total.toFixed(2)}`, 400);
    }

    await prisma.$transaction([
      prisma.wallet.update({
        where: { userId: req.user.id },
        data: { balance: { decrement: order.total } },
      }),
      prisma.walletTransaction.create({
        data: {
          walletId:    wallet.id,
          type:        'DEBIT',
          amount:      order.total,
          balance:     wallet.balance - order.total,
          description: `Payment for order #${orderId.slice(-8).toUpperCase()}`,
          refId:       orderId,
        },
      }),
      prisma.payment.update({
        where: { orderId },
        data: { method: 'CARD', status: 'PAID', paidAt: new Date(),
                transactionId: `WALLET-${Date.now()}` },
      }),
      prisma.order.update({
        where: { id: orderId },
        data: { status: 'CONFIRMED',
                statusHistory: { create: { status: 'CONFIRMED', note: 'Paid with wallet balance' } } },
      }),
    ]);

    res.json({
      success: true,
      message: `$${order.total.toFixed(2)} deducted from wallet. Order confirmed!`,
      data: { orderId, amountPaid: order.total, newBalance: wallet.balance - order.total },
    });
  } catch (err) { next(err); }
};
