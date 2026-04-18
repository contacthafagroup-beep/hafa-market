const prisma = require('../config/prisma');
const { AppError } = require('../middleware/errorHandler');

// ===== REGISTER SELLER =====
exports.registerSeller = async (req, res, next) => {
  try {
    const existing = await prisma.seller.findUnique({ where: { userId: req.user.id } });
    if (existing) throw new AppError('You already have a seller account.', 409);

    const { storeName, description, phone, email, city, region, country, mpesaNumber, bankName, bankAccount } = req.body;
    const storeSlug = `${storeName.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`;

    const seller = await prisma.seller.create({
      data: { userId: req.user.id, storeName, storeSlug, description, phone, email,
              city, region, country: country || 'Ethiopia', mpesaNumber, bankName, bankAccount },
    });

    await prisma.user.update({ where: { id: req.user.id }, data: { role: 'SELLER' } });
    res.status(201).json({ success: true, data: seller, message: 'Seller application submitted. Pending review.' });
  } catch (err) { next(err); }
};

// ===== GET MY STORE =====
exports.getMyStore = async (req, res, next) => {
  try {
    const seller = await prisma.seller.findUnique({
      where: { userId: req.user.id },
      include: { products: { where: { status: 'ACTIVE' }, take: 10, orderBy: { createdAt: 'desc' } } },
    });
    if (!seller) throw new AppError('Seller account not found.', 404);
    res.json({ success: true, data: seller });
  } catch (err) { next(err); }
};

// ===== UPDATE STORE =====
exports.updateStore = async (req, res, next) => {
  try {
    const seller = await prisma.seller.findUnique({ where: { userId: req.user.id } });
    if (!seller) throw new AppError('Seller account not found.', 404);
    const updated = await prisma.seller.update({ where: { id: seller.id }, data: req.body });
    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
};

// ===== GET PUBLIC STORE =====
exports.getStore = async (req, res, next) => {
  try {
    const seller = await prisma.seller.findUnique({
      where: { storeSlug: req.params.slug },
      include: {
        user: { select: { name:true, avatar:true, createdAt:true } },
        products: { where: { status:'ACTIVE' }, orderBy: { soldCount:'desc' },
          include: { category: { select: { name:true, emoji:true } } } },
      },
    });
    if (!seller || seller.status !== 'VERIFIED') throw new AppError('Store not found.', 404);
    res.json({ success: true, data: seller });
  } catch (err) { next(err); }
};

// ===== SELLER ANALYTICS =====
exports.getAnalytics = async (req, res, next) => {
  try {
    const seller = await prisma.seller.findUnique({ where: { userId: req.user.id } });
    if (!seller) throw new AppError('Seller account not found.', 404);

    const now = new Date();
    const startOfMonth    = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfToday    = new Date(now.setHours(0,0,0,0));
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const [totalOrders, monthOrders, lastMonthOrders, todayOrders, topProducts, recentOrders, pendingPayouts, productViews, uniqueCustomers, repeatCustomers] = await Promise.all([
      prisma.orderItem.aggregate({ where: { product: { sellerId: seller.id } }, _sum: { totalPrice: true }, _count: { id: true } }),
      prisma.orderItem.aggregate({ where: { product: { sellerId: seller.id }, order: { createdAt: { gte: startOfMonth } } }, _sum: { totalPrice: true }, _count: { id: true } }),
      prisma.orderItem.aggregate({ where: { product: { sellerId: seller.id }, order: { createdAt: { gte: startOfLastMonth, lt: startOfMonth } } }, _sum: { totalPrice: true }, _count: { id: true } }),
      prisma.orderItem.aggregate({ where: { product: { sellerId: seller.id }, order: { createdAt: { gte: startOfToday } } }, _sum: { totalPrice: true }, _count: { id: true } }),
      prisma.product.findMany({ where: { sellerId: seller.id, status: 'ACTIVE' }, orderBy: { soldCount: 'desc' }, take: 5, select: { id:true, name:true, soldCount:true, price:true, images:true, stock:true } }),
      prisma.order.findMany({ where: { items: { some: { product: { sellerId: seller.id } } } }, orderBy: { createdAt: 'desc' }, take: 10, include: { items: { where: { product: { sellerId: seller.id } } }, user: { select: { name:true } } } }),
      prisma.payout.aggregate({ where: { sellerId: seller.id, status: 'PENDING' }, _sum: { amount: true } }),
      // Product views for conversion funnel
      prisma.productView.count({ where: { product: { sellerId: seller.id }, createdAt: { gte: startOfMonth } } }).catch(() => 0),
      // Unique customers this month
      prisma.order.findMany({ where: { items: { some: { product: { sellerId: seller.id } } }, createdAt: { gte: startOfMonth } }, select: { userId: true }, distinct: ['userId'] }).then(r => r.length).catch(() => 0),
      // Repeat customers (ordered more than once)
      prisma.order.groupBy({ by: ['userId'], where: { items: { some: { product: { sellerId: seller.id } } } }, having: { userId: { _count: { gt: 1 } } }, _count: { userId: true } }).then(r => r.length).catch(() => 0),
    ]);

    // Revenue growth MoM
    const monthRev     = monthOrders._sum.totalPrice || 0;
    const lastMonthRev = lastMonthOrders._sum.totalPrice || 0;
    const revenueGrowth = lastMonthRev > 0 ? ((monthRev - lastMonthRev) / lastMonthRev * 100).toFixed(1) : 0;

    // Conversion funnel: views → orders
    const monthOrderCount = monthOrders._count.id || 0;
    const conversionRate  = productViews > 0 ? ((monthOrderCount / productViews) * 100).toFixed(1) : '0';

    // Avg order value
    const avgOrderValue = monthOrderCount > 0 ? (monthRev / monthOrderCount).toFixed(2) : '0';

    // Repeat customer rate
    const repeatRate = uniqueCustomers > 0 ? ((repeatCustomers / uniqueCustomers) * 100).toFixed(1) : '0';

    res.json({
      success: true,
      data: {
        overview: {
          totalRevenue: seller.totalRevenue,
          totalSales: seller.totalSales || totalOrders._count.id,
          rating: seller.rating,
          pendingPayout: pendingPayouts._sum.amount || 0,
          revenueGrowth: parseFloat(revenueGrowth),
        },
        today:     { revenue: todayOrders._sum.totalPrice || 0, orders: todayOrders._count.id },
        thisMonth: { revenue: monthRev, orders: monthOrderCount },
        // Performance insights
        insights: {
          conversionRate,
          avgOrderValue,
          uniqueCustomers,
          repeatCustomers,
          repeatRate,
          productViews,
        },
        // Conversion funnel
        funnel: [
          { stage: 'Product Views', count: productViews },
          { stage: 'Orders',        count: monthOrderCount },
        ],
        topProducts,
        recentOrders,
      },
    });
  } catch (err) { next(err); }
};

// ===== SELLER ORDERS =====
exports.getSellerOrders = async (req, res, next) => {
  try {
    const seller = await prisma.seller.findUnique({ where: { userId: req.user.id } });
    if (!seller) throw new AppError('Seller account not found.', 404);

    const { page=1, limit=20, status } = req.query;
    const where = { items: { some: { product: { sellerId: seller.id } } } };
    if (status) where.status = status;

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where, skip: (parseInt(page)-1)*parseInt(limit), take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
        include: {
          items: { where: { product: { sellerId: seller.id } }, include: { product: { select: { name:true, images:true } } } },
          user: { select: { name:true, phone:true } },
          address: true, payment: true,
        },
      }),
      prisma.order.count({ where }),
    ]);

    res.json({ success:true, data:orders,
      pagination: { page:parseInt(page), limit:parseInt(limit), total, pages:Math.ceil(total/parseInt(limit)) } });
  } catch (err) { next(err); }
};

// ===== PAYOUTS =====
exports.getPayouts = async (req, res, next) => {
  try {
    const seller = await prisma.seller.findUnique({ where: { userId: req.user.id } });
    if (!seller) throw new AppError('Seller account not found.', 404);
    const payouts = await prisma.payout.findMany({
      where: { sellerId: seller.id }, orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: payouts });
  } catch (err) { next(err); }
};

// ===== GET MY PRODUCTS =====
exports.getMyProducts = async (req, res, next) => {
  try {
    const seller = await prisma.seller.findUnique({ where: { userId: req.user.id } });
    if (!seller) throw new AppError('Seller profile not found.', 404);
    const { page = 1, limit = 20, status } = req.query;
    const where = { sellerId: seller.id, ...(status ? { status } : {}) };
    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where, skip: (parseInt(page)-1)*parseInt(limit), take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
        include: { category: { select: { id:true, name:true, slug:true } } },
      }),
      prisma.product.count({ where }),
    ]);
    res.json({ success: true, data: products, pagination: { total, page: parseInt(page), pages: Math.ceil(total/parseInt(limit)) } });
  } catch (err) { next(err); }
};

// ===== CREATE PRODUCT =====
exports.createProduct = async (req, res, next) => {
  try {
    const seller = await prisma.seller.findUnique({ where: { userId: req.user.id } });
    if (!seller) throw new AppError('Seller profile not found.', 404);
    if (seller.status !== 'VERIFIED') throw new AppError('Your seller account must be verified to list products.', 403);

    const { name, nameAm, description, price, comparePrice, unit, minOrder, stock, categoryId, images, tags, isOrganic } = req.body;
    if (!name || !price || !unit || !categoryId) throw new AppError('Name, price, unit and category are required.', 400);

    const product = await prisma.product.create({
      data: {
        name, nameAm, description,
        price: parseFloat(price),
        comparePrice: comparePrice ? parseFloat(comparePrice) : null,
        unit, minOrder: parseInt(minOrder) || 1,
        stock: parseInt(stock) || 0,
        categoryId, sellerId: seller.id,
        images: images || [],
        tags: tags || [],
        isOrganic: isOrganic || false,
        status: 'PENDING_REVIEW',
        slug: `${name.toLowerCase().replace(/[^a-z0-9]+/g,'-')}-${Date.now()}`,
      },
      include: { category: { select: { name:true, slug:true } } },
    });
    res.status(201).json({ success: true, data: product, message: 'Product submitted for review.' });
  } catch (err) { next(err); }
};

// ===== UPDATE PRODUCT =====
exports.updateProduct = async (req, res, next) => {
  try {
    const seller = await prisma.seller.findUnique({ where: { userId: req.user.id } });
    if (!seller) throw new AppError('Seller profile not found.', 404);
    const product = await prisma.product.findFirst({ where: { id: req.params.id, sellerId: seller.id } });
    if (!product) throw new AppError('Product not found.', 404);

    const { name, nameAm, description, price, comparePrice, unit, minOrder, stock, categoryId, images, tags, isOrganic } = req.body;
    const updated = await prisma.product.update({
      where: { id: req.params.id },
      data: {
        ...(name && { name }),
        ...(nameAm !== undefined && { nameAm }),
        ...(description !== undefined && { description }),
        ...(price && { price: parseFloat(price) }),
        ...(comparePrice !== undefined && { comparePrice: comparePrice ? parseFloat(comparePrice) : null }),
        ...(unit && { unit }),
        ...(minOrder && { minOrder: parseInt(minOrder) }),
        ...(stock !== undefined && { stock: parseInt(stock) }),
        ...(categoryId && { categoryId }),
        ...(images && { images }),
        ...(tags && { tags }),
        ...(isOrganic !== undefined && { isOrganic }),
      },
      include: { category: { select: { name:true, slug:true } } },
    });

    // Broadcast real-time price/stock update to any viewers
    if (price !== undefined || stock !== undefined) {
      const { getIO } = require('../socket');
      const io = getIO();
      if (io) {
        io.emit('product:update', {
          productId: updated.id,
          price: updated.price,
          stock: updated.stock,
          comparePrice: updated.comparePrice,
        });
      }
    }

    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
};

// ===== DELETE PRODUCT =====
exports.deleteProduct = async (req, res, next) => {
  try {
    const seller = await prisma.seller.findUnique({ where: { userId: req.user.id } });
    if (!seller) throw new AppError('Seller profile not found.', 404);
    const product = await prisma.product.findFirst({ where: { id: req.params.id, sellerId: seller.id } });
    if (!product) throw new AppError('Product not found.', 404);
    await prisma.product.update({ where: { id: req.params.id }, data: { status: 'INACTIVE' } });
    res.json({ success: true, message: 'Product removed from listing.' });
  } catch (err) { next(err); }
};

// ===== UPDATE ORDER STATUS (seller accept/reject/process) =====
exports.updateOrderStatus = async (req, res, next) => {
  try {
    const seller = await prisma.seller.findUnique({ where: { userId: req.user.id } });
    if (!seller) throw new AppError('Seller profile not found.', 404);

    const { orderId } = req.params;
    const { status, note } = req.body;

    const ALLOWED = ['CONFIRMED', 'PROCESSING', 'SHIPPED', 'CANCELLED'];
    if (!ALLOWED.includes(status)) {
      throw new AppError(`Status must be one of: ${ALLOWED.join(', ')}`, 400);
    }

    // Verify this order contains seller's products
    const order = await prisma.order.findFirst({
      where: { id: orderId, items: { some: { product: { sellerId: seller.id } } } },
    });
    if (!order) throw new AppError('Order not found.', 404);

    const updated = await prisma.order.update({
      where: { id: orderId },
      data: {
        status,
        statusHistory: { create: { status, note: note || `Updated by seller` } },
      },
    });

    // Notify buyer
    const { createNotification } = require('../services/notification.service');
    createNotification(order.userId, 'ORDER', `Order ${status.replace(/_/g,' ')}`,
      `Your order #${orderId.slice(-8).toUpperCase()} has been ${status.toLowerCase()} by the seller.`,
      { orderId }).catch(() => {});

    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
};

// ===== UPDATE PAYOUT SETTINGS =====
exports.updatePayoutSettings = async (req, res, next) => {
  try {
    const seller = await prisma.seller.findUnique({ where: { userId: req.user.id } });
    if (!seller) throw new AppError('Seller profile not found.', 404);

    const { bankName, bankAccount, mpesaNumber, telebirrNumber } = req.body;
    const updated = await prisma.seller.update({
      where: { id: seller.id },
      data: {
        ...(bankName      !== undefined && { bankName }),
        ...(bankAccount   !== undefined && { bankAccount }),
        ...(mpesaNumber   !== undefined && { mpesaNumber }),
        ...(telebirrNumber !== undefined && { telebirrNumber }),
      },
    });
    res.json({ success: true, data: updated, message: 'Payout settings updated.' });
  } catch (err) { next(err); }
};

// ===== REQUEST PAYOUT =====
exports.requestPayout = async (req, res, next) => {
  try {
    const seller = await prisma.seller.findUnique({ where: { userId: req.user.id } });
    if (!seller) throw new AppError('Seller profile not found.', 404);

    const { amount, method, accountRef } = req.body;
    if (!amount || amount <= 0) throw new AppError('Invalid payout amount.', 400);
    if (!method) throw new AppError('Payment method is required.', 400);

    // Check available balance (totalRevenue - pending payouts)
    const pendingSum = await prisma.payout.aggregate({
      where: { sellerId: seller.id, status: 'PENDING' },
      _sum: { amount: true },
    });
    const pendingTotal = pendingSum._sum.amount || 0;
    const available = seller.totalRevenue - pendingTotal;

    if (amount > available) {
      throw new AppError(`Insufficient balance. Available: ${available.toFixed(2)} ETB`, 400);
    }

    const payout = await prisma.payout.create({
      data: {
        sellerId: seller.id,
        amount: parseFloat(amount),
        method,
        accountRef: accountRef || seller.bankAccount || seller.mpesaNumber || 'N/A',
        status: 'PENDING',
      },
    });

    res.status(201).json({ success: true, data: payout, message: 'Payout request submitted. Processing within 2–3 business days.' });
  } catch (err) { next(err); }
};
