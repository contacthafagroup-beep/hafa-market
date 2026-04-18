const prisma = require('../config/prisma');
const { AppError } = require('../middleware/errorHandler');
const { createNotification } = require('../services/notification.service');
const { audit, AUDIT_ACTIONS } = require('../services/audit.service');
const emailService = require('../services/email.service');
const { sendOrderNotification, sendSellerNotification } = require('../services/telegram.service');
const { reserveStock, confirmReservation } = require('../services/inventory.service');

/**
 * Request hedging: if the primary promise exceeds P80 latency (hedgeMs),
 * fire a second identical request and use whichever resolves first.
 * Inspired by Amazon's latency tail-cutting technique.
 */
function hedgedQuery(queryFn, hedgeMs = 80) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const settle = (fn, val) => {
      if (!settled) { settled = true; fn(val); }
    };
    // Primary request
    queryFn().then(v => settle(resolve, v)).catch(e => settle(reject, e));
    // Hedge: fire duplicate after hedgeMs if primary hasn't resolved
    setTimeout(() => {
      if (!settled) queryFn().then(v => settle(resolve, v)).catch(() => {});
    }, hedgeMs);
  });
}

exports.createOrder = async (req, res, next) => {
  try {
    const { addressId, items, promoCode, notes, paymentMethod, deliverySlot, redeemPoints,
            guestName, guestPhone, guestEmail, guestAddress } = req.body;
    if (!items?.length) throw new AppError('Order must have at least one item.', 400);

    // ── Address resolution ─────────────────────────────────────────────────
    let resolvedAddressId = addressId;

    if (!addressId && guestAddress) {
      // Guest checkout — create a temporary address record
      const guestUser = req.user; // guest users are still authenticated via a temp session or we use a placeholder
      const newAddr = await prisma.address.create({
        data: {
          userId: req.user.id,
          label: 'Guest',
          fullName: guestName || 'Guest',
          phone: guestPhone || '',
          street: guestAddress,
          city: 'Hossana',
          region: 'Hadiya Zone',
          country: 'Ethiopia',
          isDefault: false,
        },
      });
      resolvedAddressId = newAddr.id;
    }

    if (!resolvedAddressId) throw new AppError('Delivery address is required.', 400);

    const address = await prisma.address.findUnique({ where: { id: resolvedAddressId } });
    if (!address || address.userId !== req.user.id) throw new AppError('Invalid delivery address.', 400);

    // Validate products & calculate totals (hedged queries cut P99 latency)
    let subtotal = 0;
    const orderItems = [];
    for (const item of items) {
      const product = await hedgedQuery(
        () => prisma.product.findUnique({ where: { id: item.productId } })
      );
      if (!product || product.status !== 'ACTIVE') throw new AppError(`Product ${item.productId} is unavailable.`, 400);
      if (product.stock < item.quantity) throw new AppError(`Insufficient stock for ${product.name}.`, 400);
      const totalPrice = product.price * item.quantity;
      subtotal += totalPrice;
      orderItems.push({ productId: product.id, productName: product.name,
        productImg: product.images[0] || null, quantity: item.quantity,
        unitPrice: product.price, totalPrice, unit: product.unit });
    }

    // Reserve stock in Redis (prevents race conditions on concurrent orders)
    await reserveStock(req.user.id, items).catch(() => {}); // non-blocking if Redis unavailable

    // Promo code
    let discount = 0;
    if (promoCode) {
      const promo = await prisma.promoCode.findUnique({ where: { code: promoCode.toUpperCase() } });
      if (promo && promo.isActive && (!promo.expiresAt || promo.expiresAt > new Date())
          && subtotal >= promo.minOrderAmount && (!promo.maxUses || promo.usedCount < promo.maxUses)) {
        discount = promo.discountType === 'PERCENTAGE'
          ? (subtotal * promo.discountValue) / 100
          : promo.discountValue;
        await prisma.promoCode.update({ where: { id: promo.id }, data: { usedCount: { increment: 1 } } });
      }
    }

    // Loyalty points redemption
    let pointsDiscount = 0;
    if (redeemPoints) {
      const userRecord = await prisma.user.findUnique({ where: { id: req.user.id }, select: { loyaltyPoints: true } });
      const pts = userRecord?.loyaltyPoints || 0;
      if (pts >= 100) {
        pointsDiscount = Math.min(pts * 0.1, subtotal * 0.2); // 0.1 ETB per point, max 20% of subtotal
        const pointsUsed = Math.ceil(pointsDiscount / 0.1);
        await prisma.user.update({ where: { id: req.user.id }, data: { loyaltyPoints: { decrement: pointsUsed } } });
        discount += pointsDiscount;
      }
    }

    const deliveryFee = subtotal >= 50 ? 0 : 3.99;
    const total = subtotal - discount + deliveryFee;

    // Create order in transaction
    const order = await prisma.$transaction(async (tx) => {
      const newOrder = await tx.order.create({
        data: { userId: req.user.id, addressId: resolvedAddressId, subtotal, deliveryFee, discount, total,
                promoCode: promoCode?.toUpperCase(), notes,
                items: { create: orderItems },
                statusHistory: { create: { status: 'PENDING', note: 'Order placed by customer' } },
                payment: { create: { amount: total, method: paymentMethod || 'CASH_ON_DELIVERY', status: 'PENDING' } },
                delivery: { create: { status: 'PENDING' } },
                ...(deliverySlot && { deliverySlot }),
        },
        include: { items: true, payment: true, delivery: true },
      });

      // Deduct stock
      for (const item of items) {
        await tx.product.update({ where: { id: item.productId },
          data: { stock: { decrement: item.quantity }, soldCount: { increment: item.quantity } } });
      }

      // Clear cart
      await tx.cartItem.deleteMany({ where: { userId: req.user.id,
        productId: { in: items.map(i => i.productId) } } });

      return newOrder;
    });

    // ── Fire all post-order side effects in parallel (Amazon-style event-driven checkout) ──
    const sellerIds = [...new Set(orderItems.map(i => i.productId))];

    await Promise.allSettled([
      // 1. Buyer notification
      createNotification(
        req.user.id, 'ORDER_PLACED',
        'Order Placed! 🎉',
        `Your order #${order.id.slice(-8).toUpperCase()} has been placed successfully.`,
        { orderId: order.id }
      ),

      // 2. Seller Telegram notifications
      prisma.seller.findMany({
        where: { products: { some: { id: { in: sellerIds } } } },
        include: { user: { select: { telegramChatId: true } } },
      }).then(sellers =>
        Promise.allSettled(
          sellers
            .filter(s => s.user?.telegramChatId)
            .map(s => sendSellerNotification(
              s.user.telegramChatId,
              { ...order, items: orderItems, payment: { method: paymentMethod } }
            ))
        )
      ),

      // 3. Audit log
      audit(AUDIT_ACTIONS.ORDER_PLACED, {
        userId: req.user.id, targetId: order.id, targetType: 'Order',
        meta: { total: order.total, items: items.length, paymentMethod },
      }),

      // 4. Loyalty points reward (1 point per ETB spent)
      prisma.user.update({
        where: { id: req.user.id },
        data: { loyaltyPoints: { increment: Math.floor(order.total) } },
      }),

      // 5. Social feed event — "Tilahun bought Teff 2kg"
      (async () => {
        try {
          const firstItem = orderItems[0];
          if (!firstItem) return;
          const product = await prisma.product.findUnique({
            where: { id: firstItem.productId },
            select: { sellerId: true },
          });
          const eventId = require('crypto').randomUUID();
          await prisma.$queryRaw`
            INSERT INTO social_feed_events (id, "userId", type, "productId", "sellerId", meta)
            VALUES (${eventId}, ${req.user.id}, 'PURCHASE', ${firstItem.productId}, ${product?.sellerId || null},
              ${JSON.stringify({ orderId: order.id, productName: firstItem.productName, quantity: firstItem.quantity, unit: firstItem.unit })}::jsonb)
          `;
        } catch {}
      })(),

      // 6. Check referral conversion — if buyer came via a share link
      (async () => {
        try {
          const refCode = req.headers['x-referral-code'] || req.body.referralCode;
          if (refCode) {
            await fetch(`${process.env.CLIENT_URL?.replace('3000', '5001') || 'http://localhost:5001'}/api/v1/social/share/convert/${refCode}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': req.headers.authorization || '' },
              body: JSON.stringify({ orderId: order.id }),
            }).catch(() => {});
          }
        } catch {}
      })(),
    ]);

    res.status(201).json({ success: true, data: order });
  } catch (err) { next(err); }
};

exports.getOrders = async (req, res, next) => {
  try {
    const { page=1, limit=10, status } = req.query;
    const where = { userId: req.user.id };
    if (status) where.status = status;
    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where, skip: (parseInt(page)-1)*parseInt(limit), take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
        include: { items: { include: { product: { select: { images:true } } } },
                   payment: true, delivery: true, address: true },
      }),
      prisma.order.count({ where }),
    ]);
    res.json({ success:true, data:orders,
      pagination: { page:parseInt(page), limit:parseInt(limit), total, pages:Math.ceil(total/parseInt(limit)) } });
  } catch(err) { next(err); }
};

exports.getOrder = async (req, res, next) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: { items:true, payment:true, delivery:true, address:true, statusHistory:{ orderBy:{ createdAt:'asc' } } },
    });
    if (!order) throw new AppError('Order not found.', 404);
    if (order.userId !== req.user.id && req.user.role !== 'ADMIN') throw new AppError('Not authorized.', 403);
    res.json({ success:true, data:order });
  } catch(err) { next(err); }
};

exports.cancelOrder = async (req, res, next) => {
  try {
    const { reason } = req.body;
    const order = await prisma.order.findUnique({ where: { id: req.params.id } });
    if (!order) throw new AppError('Order not found.', 404);
    if (order.userId !== req.user.id) throw new AppError('Not authorized.', 403);
    if (!['PENDING','CONFIRMED'].includes(order.status)) throw new AppError('Order cannot be cancelled at this stage.', 400);

    await prisma.order.update({ where: { id: order.id },
      data: { status:'CANCELLED', cancelledAt: new Date(), cancelReason: reason,
              statusHistory: { create: { status:'CANCELLED', note: reason || 'Cancelled by customer' } } } });

    await createNotification(req.user.id, 'ORDER_CANCELLED',
      'Order Cancelled', `Order #${order.id.slice(-8).toUpperCase()} has been cancelled.`, { orderId: order.id });

    res.json({ success:true, message:'Order cancelled successfully.' });
  } catch(err) { next(err); }
};

exports.updateOrderStatus = async (req, res, next) => {
  try {
    const { status, note } = req.body;
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: { user: { select: { id:true, name:true, email:true } }, address: true },
    });
    if (!order) throw new AppError('Order not found.', 404);

    const updated = await prisma.order.update({ where: { id: order.id },
      data: { status, ...(status==='DELIVERED' && { deliveredAt: new Date() }),
              statusHistory: { create: { status, note } } } });

    audit(AUDIT_ACTIONS[`ORDER_${status}`] || 'ORDER_STATUS_UPDATED', {
      userId: req.user.id, targetId: order.id, targetType: 'Order',
      before: { status: order.status }, after: { status }, meta: { note },
    });

    const notifMap = {
      CONFIRMED:        ['ORDER_CONFIRMED',  'Order Confirmed ✅',       'Your order has been confirmed and is being prepared.'],
      SHIPPED:          ['ORDER_SHIPPED',    'Order Shipped 🚚',          'Your order is on its way!'],
      OUT_FOR_DELIVERY: ['ORDER_SHIPPED',    'Out for Delivery 🛵',       'Your order is out for delivery. Expect it soon!'],
      DELIVERED:        ['ORDER_DELIVERED',  'Order Delivered 📦',        'Your order has been delivered. Enjoy!'],
      CANCELLED:        ['ORDER_CANCELLED',  'Order Cancelled ❌',        `Your order has been cancelled. ${note || ''}`],
    };
    if (notifMap[status]) {
      await createNotification(order.userId, ...notifMap[status], { orderId: order.id });
    }

    // Send email for key status changes
    if (status === 'DELIVERED' && order.user?.email) {
      emailService.sendOrderDelivered(order.user, { ...order, id: order.id }).catch(() => {});
    }
    if (status === 'SHIPPED' && order.user?.email) {
      emailService.sendEmail({
        to: order.user.email,
        subject: `Your order #${order.id.slice(-8).toUpperCase()} has been shipped! 🚚`,
        template: 'orderShipped',
        data: {
          name: order.user.name,
          orderId: order.id.slice(-8).toUpperCase(),
          address: order.address ? `${order.address.street}, ${order.address.city}` : '',
        },
      }).catch(() => {});
    }

    // Telegram notification
    if (order.user?.telegramChatId) {
      sendOrderNotification(order.user.telegramChatId, { ...updated, delivery: order.delivery }).catch(() => {});
    }

    res.json({ success:true, data:updated });
  } catch(err) { next(err); }
};

// ===== VALIDATE PROMO CODE =====
exports.validatePromo = async (req, res, next) => {
  try {
    const { code, orderTotal } = req.body;
    if (!code) throw new AppError('Promo code is required.', 400);

    const promo = await prisma.promoCode.findUnique({ where: { code: code.toUpperCase() } });
    if (!promo) throw new AppError('Invalid promo code.', 400);
    if (!promo.isActive) throw new AppError('This promo code is no longer active.', 400);
    if (promo.expiresAt && new Date(promo.expiresAt) < new Date()) throw new AppError('This promo code has expired.', 400);
    if (promo.maxUses && promo.usedCount >= promo.maxUses) throw new AppError('This promo code has reached its usage limit.', 400);
    if (promo.minOrderAmount && orderTotal < promo.minOrderAmount) {
      throw new AppError(`Minimum order amount of $${promo.minOrderAmount} required for this code.`, 400);
    }

    let discount = 0;
    if (promo.discountType === 'PERCENTAGE') {
      discount = (orderTotal * promo.discountValue) / 100;
      if (promo.maxDiscount) discount = Math.min(discount, promo.maxDiscount);
    } else {
      discount = Math.min(promo.discountValue, orderTotal);
    }

    res.json({
      success: true,
      data: {
        code: promo.code,
        discount: parseFloat(discount.toFixed(2)),
        message: `Code "${promo.code}" applied! You save $${discount.toFixed(2)}`,
      },
    });
  } catch (err) { next(err); }
};
