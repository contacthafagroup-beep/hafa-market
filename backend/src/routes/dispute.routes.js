'use strict';
const router  = require('express').Router();
const prisma  = require('../config/prisma');
const { protect, restrictTo } = require('../middleware/auth.middleware');
const { AppError } = require('../middleware/errorHandler');
const { createNotification } = require('../services/notification.service');
const emailService = require('../services/email.service');

router.use(protect);

// ── Open dispute ──────────────────────────────────────────────────────────────
router.post('/', async (req, res, next) => {
  try {
    const { orderId, reason, description, evidence = [] } = req.body;
    if (!orderId || !reason || !description) throw new AppError('orderId, reason and description are required.', 400);

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: { include: { product: { select: { sellerId: true } } } } },
    });
    if (!order) throw new AppError('Order not found.', 404);
    if (order.userId !== req.user.id) throw new AppError('Not authorized.', 403);
    if (!['DELIVERED', 'CONFIRMED', 'PROCESSING'].includes(order.status)) {
      throw new AppError('Disputes can only be opened for confirmed or delivered orders.', 400);
    }

    const existing = await prisma.dispute.findUnique({ where: { orderId } });
    if (existing) throw new AppError('A dispute already exists for this order.', 409);

    const sellerId = order.items[0]?.product?.sellerId;
    if (!sellerId) throw new AppError('Cannot determine seller for this order.', 400);

    const deadline = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const dispute = await prisma.dispute.create({
      data: {
        orderId, buyerId: req.user.id, sellerId,
        reason, description, evidence,
        deadline,
        messages: { create: { senderId: req.user.id, role: 'BUYER', content: description, attachments: evidence } },
      },
    });

    // Notify seller
    const seller = await prisma.seller.findUnique({ where: { id: sellerId }, include: { user: { select: { id: true, email: true, name: true } } } });
    if (seller?.user) {
      createNotification(seller.user.id, 'SYSTEM', '⚠️ New Dispute Opened', `A buyer has opened a dispute for order #${orderId.slice(-8).toUpperCase()}. Please respond within 48 hours.`, { orderId, disputeId: dispute.id }).catch(() => {});
    }

    res.status(201).json({ success: true, data: dispute, message: 'Dispute opened. Seller has 48 hours to respond.' });
  } catch (err) { next(err); }
});

// ── Get my disputes ───────────────────────────────────────────────────────────
router.get('/my', async (req, res, next) => {
  try {
    const disputes = await prisma.dispute.findMany({
      where: { OR: [{ buyerId: req.user.id }, { sellerId: req.user.id }] },
      orderBy: { createdAt: 'desc' },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
    res.json({ success: true, data: disputes });
  } catch (err) { next(err); }
});

// ── Get single dispute ────────────────────────────────────────────────────────
router.get('/:id', async (req, res, next) => {
  try {
    const dispute = await prisma.dispute.findUnique({
      where: { id: req.params.id },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
    if (!dispute) throw new AppError('Dispute not found.', 404);
    if (dispute.buyerId !== req.user.id && dispute.sellerId !== req.user.id && req.user.role !== 'ADMIN') {
      throw new AppError('Not authorized.', 403);
    }
    res.json({ success: true, data: dispute });
  } catch (err) { next(err); }
});

// ── Add message to dispute ────────────────────────────────────────────────────
router.post('/:id/messages', async (req, res, next) => {
  try {
    const { content, attachments = [] } = req.body;
    if (!content) throw new AppError('Message content is required.', 400);

    const dispute = await prisma.dispute.findUnique({ where: { id: req.params.id } });
    if (!dispute) throw new AppError('Dispute not found.', 404);
    if (dispute.status === 'RESOLVED' || dispute.status === 'CLOSED') throw new AppError('Dispute is already closed.', 400);

    const role = req.user.role === 'ADMIN' ? 'ADMIN' : dispute.buyerId === req.user.id ? 'BUYER' : 'SELLER';

    const message = await prisma.disputeMessage.create({
      data: { disputeId: dispute.id, senderId: req.user.id, role, content, attachments },
    });

    // Update dispute status
    let newStatus = dispute.status;
    if (role === 'SELLER' && dispute.status === 'OPEN') newStatus = 'SELLER_RESPONDED';
    if (role === 'ADMIN') newStatus = 'ADMIN_REVIEW';
    if (newStatus !== dispute.status) await prisma.dispute.update({ where: { id: dispute.id }, data: { status: newStatus } });

    // Notify other party
    const notifyId = role === 'BUYER' ? dispute.sellerId : dispute.buyerId;
    const seller = await prisma.seller.findUnique({ where: { id: dispute.sellerId } });
    if (notifyId && seller) {
      createNotification(role === 'BUYER' ? seller.userId : dispute.buyerId, 'SYSTEM', '💬 New message in dispute', `New message on dispute for order #${dispute.orderId.slice(-8).toUpperCase()}`, { disputeId: dispute.id }).catch(() => {});
    }

    res.status(201).json({ success: true, data: message });
  } catch (err) { next(err); }
});

// ── Admin: resolve dispute ────────────────────────────────────────────────────
router.patch('/:id/resolve', restrictTo('ADMIN'), async (req, res, next) => {
  try {
    const { resolution, notes } = req.body;
    if (!resolution) throw new AppError('Resolution is required.', 400);

    const dispute = await prisma.dispute.update({
      where: { id: req.params.id },
      data: { status: 'RESOLVED', resolution, resolvedBy: req.user.id, resolvedAt: new Date(), notes },
    });

    // Execute resolution
    if (resolution === 'FULL_REFUND' || resolution === 'PARTIAL_REFUND') {
      // Trigger refund flow
      const order = await prisma.order.findUnique({ where: { id: dispute.orderId }, include: { payment: true } });
      if (order?.payment) {
        await prisma.refund.create({
          data: { paymentId: order.payment.id, orderId: dispute.orderId, userId: dispute.buyerId, amount: order.payment.amount, reason: 'Dispute resolved: ' + resolution, method: order.payment.method, status: 'APPROVED' },
        }).catch(() => {});
      }
    }

    // Notify both parties
    createNotification(dispute.buyerId, 'SYSTEM', '✅ Dispute Resolved', `Your dispute has been resolved: ${resolution.replace(/_/g, ' ')}`, { disputeId: dispute.id }).catch(() => {});
    const seller = await prisma.seller.findUnique({ where: { id: dispute.sellerId } });
    if (seller) createNotification(seller.userId, 'SYSTEM', '✅ Dispute Resolved', `Dispute resolved: ${resolution.replace(/_/g, ' ')}`, { disputeId: dispute.id }).catch(() => {});

    res.json({ success: true, data: dispute });
  } catch (err) { next(err); }
});

// ── Admin: get all disputes ───────────────────────────────────────────────────
router.get('/', restrictTo('ADMIN'), async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const where = status ? { status } : {};
    const [disputes, total] = await Promise.all([
      prisma.dispute.findMany({ where, skip: (parseInt(page)-1)*parseInt(limit), take: parseInt(limit), orderBy: { createdAt: 'desc' }, include: { messages: { take: 1, orderBy: { createdAt: 'desc' } } } }),
      prisma.dispute.count({ where }),
    ]);
    res.json({ success: true, data: disputes, pagination: { page: parseInt(page), total, pages: Math.ceil(total/parseInt(limit)) } });
  } catch (err) { next(err); }
});

module.exports = router;
