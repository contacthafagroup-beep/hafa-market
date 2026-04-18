const prisma = require('../config/prisma');
const { AppError } = require('../middleware/errorHandler');
const { audit, AUDIT_ACTIONS } = require('../services/audit.service');

// ===== DASHBOARD OVERVIEW =====
exports.getDashboard = async (req, res, next) => {
  try {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const [
      totalUsers, newUsersToday, totalSellers, pendingSellers,
      totalProducts, totalOrders, todayOrders, monthRevenue,
      lastMonthRevenue, pendingOrders, recentOrders, topProducts,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { createdAt: { gte: startOfToday } } }),
      prisma.seller.count({ where: { status: 'VERIFIED' } }),
      prisma.seller.count({ where: { status: 'PENDING' } }),
      prisma.product.count({ where: { status: 'ACTIVE' } }),
      prisma.order.count(),
      prisma.order.count({ where: { createdAt: { gte: startOfToday } } }),
      prisma.payment.aggregate({ where: { status:'PAID', paidAt:{ gte: startOfMonth } }, _sum:{ amount:true } }),
      prisma.payment.aggregate({ where: { status:'PAID', paidAt:{ gte: startOfLastMonth, lt: startOfMonth } }, _sum:{ amount:true } }),
      prisma.order.count({ where: { status: 'PENDING' } }),
      prisma.order.findMany({ take:10, orderBy:{ createdAt:'desc' },
        include: { user:{ select:{ name:true } }, payment:{ select:{ status:true, amount:true } } } }),
      prisma.product.findMany({ take:5, orderBy:{ soldCount:'desc' },
        select:{ id:true, name:true, soldCount:true, price:true, images:true } }),
    ]);

    const monthRev = monthRevenue._sum.amount || 0;
    const lastMonthRev = lastMonthRevenue._sum.amount || 0;
    const revenueGrowth = lastMonthRev > 0 ? ((monthRev - lastMonthRev) / lastMonthRev * 100).toFixed(1) : 0;

    res.json({
      success: true,
      data: {
        stats: { totalUsers, newUsersToday, totalSellers, pendingSellers,
                 totalProducts, totalOrders, todayOrders, pendingOrders,
                 monthRevenue: monthRev, revenueGrowth: parseFloat(revenueGrowth) },
        recentOrders,
        topProducts,
      },
    });
  } catch (err) { next(err); }
};

// ===== USER MANAGEMENT =====
exports.getUsers = async (req, res, next) => {
  try {
    const { page=1, limit=20, role, search, isActive } = req.query;
    const where = {};
    if (role) where.role = role;
    if (isActive !== undefined) where.isActive = isActive === 'true';
    if (search) where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
      { phone: { contains: search, mode: 'insensitive' } },
    ];

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where, skip: (parseInt(page)-1)*parseInt(limit), take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
        select: { id:true, name:true, email:true, phone:true, role:true, isActive:true,
                  isVerified:true, loyaltyPoints:true, createdAt:true,
                  _count: { select: { orders:true } } },
      }),
      prisma.user.count({ where }),
    ]);

    res.json({ success:true, data:users,
      pagination: { page:parseInt(page), limit:parseInt(limit), total, pages:Math.ceil(total/parseInt(limit)) } });
  } catch (err) { next(err); }
};

exports.toggleUserStatus = async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) throw new AppError('User not found.', 404);
    if (user.role === 'ADMIN') throw new AppError('Cannot deactivate admin accounts.', 403);
    const updated = await prisma.user.update({
      where: { id: req.params.id }, data: { isActive: !user.isActive },
    });
    audit(updated.isActive ? AUDIT_ACTIONS.USER_ACTIVATED : AUDIT_ACTIONS.USER_DEACTIVATED,
      { userId: req.user.id, targetId: user.id, targetType: 'User' });
    res.json({ success: true, message: `User ${updated.isActive ? 'activated' : 'deactivated'}.`, data: updated });
  } catch (err) { next(err); }
};

// ===== SELLER MANAGEMENT =====
exports.getSellers = async (req, res, next) => {
  try {
    const { page=1, limit=20, status } = req.query;
    const where = status ? { status } : {};
    const [sellers, total] = await Promise.all([
      prisma.seller.findMany({
        where, skip: (parseInt(page)-1)*parseInt(limit), take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { name:true, email:true, phone:true } },
                   _count: { select: { products:true } } },
      }),
      prisma.seller.count({ where }),
    ]);
    res.json({ success:true, data:sellers,
      pagination: { page:parseInt(page), limit:parseInt(limit), total, pages:Math.ceil(total/parseInt(limit)) } });
  } catch (err) { next(err); }
};

exports.updateSellerStatus = async (req, res, next) => {
  try {
    const { status, reason } = req.body;
    if (!['VERIFIED','SUSPENDED','PENDING'].includes(status)) throw new AppError('Invalid status.', 400);

    const seller = await prisma.seller.update({
      where: { id: req.params.id }, data: { status },
      include: { user: { select: { name:true, email:true } } },
    });

    // Send email notification to seller
    const emailService = require('../services/email.service');
    if (status === 'VERIFIED' && seller.user?.email) {
      emailService.sendSellerApproved(seller.user, seller).catch(() => {});
    } else if (status === 'SUSPENDED' && seller.user?.email) {
      emailService.sendSellerSuspended(seller.user, seller, reason).catch(() => {});
    }

    // Notify seller in-app
    const { createNotification } = require('../services/notification.service');
    createNotification(seller.userId, 'SYSTEM',
      status === 'VERIFIED' ? '🎉 Store Approved!' : '⚠️ Store Suspended',
      status === 'VERIFIED'
        ? `Your store "${seller.storeName}" has been verified and is now live!`
        : `Your store "${seller.storeName}" has been suspended. Reason: ${reason || 'Policy violation'}`,
      { sellerId: seller.id }
    ).catch(() => {});

    audit(AUDIT_ACTIONS[`SELLER_${status}`] || 'SELLER_STATUS_UPDATED',
      { userId: req.user.id, targetId: req.params.id, targetType: 'Seller',
        after: { status }, meta: { reason } });
    res.json({ success: true, data: seller, message: `Seller ${status.toLowerCase()}.` });
  } catch (err) { next(err); }
};

// ===== PRODUCT MODERATION =====
exports.getProductsForReview = async (req, res, next) => {
  try {
    const products = await prisma.product.findMany({
      where: { status: 'PENDING_REVIEW' },
      include: { seller: { select: { storeName:true } }, category: { select: { name:true } } },
      orderBy: { createdAt: 'asc' },
    });
    res.json({ success: true, data: products });
  } catch (err) { next(err); }
};

exports.moderateProduct = async (req, res, next) => {
  try {
    const { action, reason } = req.body;
    const status = action === 'approve' ? 'ACTIVE' : 'INACTIVE';
    const product = await prisma.product.update({ where: { id: req.params.id }, data: { status } });
    res.json({ success: true, data: product, message: `Product ${action}d.` });
  } catch (err) { next(err); }
};

// ===== ORDER MANAGEMENT =====
exports.getAllOrders = async (req, res, next) => {
  try {
    const { page=1, limit=20, status } = req.query;
    const where = status ? { status } : {};
    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where, skip: (parseInt(page)-1)*parseInt(limit), take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
        include: { user:{ select:{ name:true, phone:true } }, payment:true,
                   delivery:true, address:true, _count:{ select:{ items:true } } },
      }),
      prisma.order.count({ where }),
    ]);
    res.json({ success:true, data:orders,
      pagination: { page:parseInt(page), limit:parseInt(limit), total, pages:Math.ceil(total/parseInt(limit)) } });
  } catch (err) { next(err); }
};

// ===== PAYOUT MANAGEMENT =====
exports.getPayouts = async (req, res, next) => {
  try {
    const payouts = await prisma.payout.findMany({
      where: { status: 'PENDING' }, orderBy: { createdAt: 'asc' },
      include: { seller: { select: { storeName:true, mpesaNumber:true, bankAccount:true } } },
    });
    res.json({ success: true, data: payouts });
  } catch (err) { next(err); }
};

exports.processPayout = async (req, res, next) => {
  try {
    const { status, notes } = req.body;
    const payout = await prisma.payout.update({
      where: { id: req.params.id },
      data: { status, notes, processedAt: new Date() },
    });
    if (status === 'COMPLETED') {
      await prisma.seller.update({
        where: { id: payout.sellerId },
        data: { totalRevenue: { decrement: payout.amount } },
      });
    }
    res.json({ success: true, data: payout });
  } catch (err) { next(err); }
};

// ===== ANALYTICS =====
exports.getRevenueAnalytics = async (req, res, next) => {
  try {
    const { period = '30', days } = req.query;
    const d = parseInt(days || period);
    const startDate = new Date(Date.now() - d * 24 * 60 * 60 * 1000);

    const [payments, orderCount] = await Promise.all([
      prisma.payment.findMany({
        where: { status: 'PAID', paidAt: { gte: startDate } },
        select: { amount: true, paidAt: true },
        orderBy: { paidAt: 'asc' },
      }),
      prisma.order.count({ where: { createdAt: { gte: startDate } } }),
    ]);

    // Group by day
    const grouped = {};
    payments.forEach(p => {
      const day = p.paidAt.toISOString().split('T')[0];
      grouped[day] = (grouped[day] || 0) + p.amount;
    });

    const daily = Object.entries(grouped).map(([date, revenue]) => ({ date, revenue }));
    const total = payments.reduce((s, p) => s + p.amount, 0);

    res.json({ success: true, data: { daily, chartData: daily, total, orderCount, period: d } });
  } catch (err) { next(err); }
};

// ===== AUDIT LOGS =====
exports.getAuditLogs = async (req, res, next) => {
  try {
    const { page=1, limit=50, action, userId, targetType, from, to } = req.query;
    const where = {};
    if (action)     where.action     = { contains: action, mode: 'insensitive' };
    if (userId)     where.userId     = userId;
    if (targetType) where.targetType = targetType;
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to)   where.createdAt.lte = new Date(to);
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where, skip: (parseInt(page)-1)*parseInt(limit), take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { name: true, email: true, role: true } } },
      }),
      prisma.auditLog.count({ where }),
    ]);

    res.json({ success: true, data: logs,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total/parseInt(limit)) } });
  } catch (err) { next(err); }
};
