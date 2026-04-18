'use strict';
const { Worker } = require('bullmq');
const logger = require('../config/logger');
const { sendEmail } = require('../services/email.service');
const { sendSMS } = require('../services/sms.service');
const { createNotification } = require('../services/notification.service');
const prisma = require('../config/prisma');

const CONNECTION = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT) || 6379,
};

let workers = [];

function initWorkers() {
  try {
    // ===== EMAIL WORKER =====
    const emailWorker = new Worker('email', async (job) => {
      const { type, data } = job.data;
      logger.info(`[EmailWorker] Processing job: ${type} (id: ${job.id})`);

      switch (type) {
        case 'ORDER_CONFIRMATION':
          await sendEmail({
            to: data.email,
            subject: `Order Confirmed #${data.orderId} — Hafa Market`,
            html: `<h2>Hi ${data.name},</h2>
                   <p>Your order <strong>#${data.orderId}</strong> has been confirmed!</p>
                   <p><strong>Total:</strong> $${data.total}</p>
                   <p>Track your order: <a href="${process.env.CLIENT_URL}/track/${data.orderId}">Click here</a></p>
                   <p>Thank you for shopping with Hafa Market 🌿</p>`,
          });
          break;

        case 'ORDER_DELIVERED':
          await sendEmail({
            to: data.email,
            subject: `Your order has been delivered! — Hafa Market`,
            html: `<h2>Hi ${data.name},</h2>
                   <p>Your order <strong>#${data.orderId}</strong> has been delivered. Enjoy! 📦</p>
                   <p>Please leave a review to help other buyers.</p>`,
          });
          break;

        case 'WELCOME':
          await sendEmail({
            to: data.email,
            subject: `Welcome to Hafa Market 🌿`,
            html: `<h2>Welcome, ${data.name}!</h2>
                   <p>You're now part of Africa's premier agricultural marketplace.</p>
                   <p>Use code <strong>HAFA10</strong> for 10% off your first order!</p>
                   <a href="${process.env.CLIENT_URL}" style="background:#2E7D32;color:#fff;padding:12px 24px;border-radius:50px;text-decoration:none">Start Shopping</a>`,
          });
          break;

        case 'PASSWORD_RESET':
          await sendEmail({
            to: data.email,
            subject: `Password Reset — Hafa Market`,
            html: `<h2>Hi ${data.name},</h2>
                   <p>Your OTP for password reset is: <strong style="font-size:24px">${data.otp}</strong></p>
                   <p>This code expires in 10 minutes.</p>`,
          });
          break;

        case 'SELLER_APPROVED':
          await sendEmail({
            to: data.email,
            subject: `Your seller account is approved! 🎉 — Hafa Market`,
            html: `<h2>Congratulations, ${data.name}!</h2>
                   <p>Your seller account <strong>${data.storeName}</strong> has been approved.</p>
                   <p>You can now list products and start selling to 50,000+ buyers!</p>`,
          });
          break;

        case 'REFUND_APPROVED':
          await sendEmail({
            to: data.email,
            subject: `Refund Approved ✅ — Order #${data.orderId} — Hafa Market`,
            html: `<h2>Hi ${data.name},</h2>
                   <p>Your refund of <strong>$${data.amount?.toFixed(2)}</strong> for order <strong>#${data.orderId}</strong> has been approved.</p>
                   <p>${data.walletCredited
                     ? '💚 The amount has been credited to your <strong>Hafa Market wallet</strong> and is available immediately.'
                     : '💳 The amount will be returned to your original payment method within <strong>3–5 business days</strong>.'}</p>
                   <p>Thank you for shopping with Hafa Market 🌿</p>`,
          });
          break;

        case 'BANK_TRANSFER_APPROVED':
          await sendEmail({
            to: data.email,
            subject: `Bank Transfer Verified ✅ — Order #${data.orderId} — Hafa Market`,
            html: `<h2>Hi ${data.name},</h2>
                   <p>Your bank transfer (Ref: <strong>${data.referenceCode}</strong>) has been verified.</p>
                   <p>Your order <strong>#${data.orderId}</strong> is now confirmed and being processed!</p>`,
          });
          break;

        default:
          logger.warn(`[EmailWorker] Unknown email type: ${type}`);
      }
    }, { connection: CONNECTION, concurrency: 5 });

    emailWorker.on('completed', (job) => logger.debug(`[EmailWorker] Job ${job.id} completed`));
    emailWorker.on('failed', (job, err) => logger.error(`[EmailWorker] Job ${job?.id} failed: ${err.message}`));

    // ===== NOTIFICATION WORKER =====
    const notifWorker = new Worker('notification', async (job) => {
      const { userId, type, title, body, data } = job.data;
      logger.info(`[NotifWorker] Sending ${type} to user ${userId}`);
      await createNotification(userId, type, title, body, data || {});
    }, { connection: CONNECTION, concurrency: 10 });

    notifWorker.on('failed', (job, err) => logger.error(`[NotifWorker] Job ${job?.id} failed: ${err.message}`));

    // ===== ORDER WORKER =====
    const orderWorker = new Worker('order', async (job) => {
      const { type, orderId } = job.data;
      logger.info(`[OrderWorker] Processing ${type} for order ${orderId}`);

      switch (type) {
        case 'AUTO_CANCEL_UNPAID': {
          const order = await prisma.order.findUnique({
            where: { id: orderId },
            include: { payment: true, user: { select: { name: true, email: true } } },
          });
          if (!order) break;
          if (order.status === 'PENDING' && order.payment?.status !== 'PAID') {
            await prisma.order.update({
              where: { id: orderId },
              data: { status: 'CANCELLED', cancelReason: 'Auto-cancelled: payment not received within 30 minutes',
                      statusHistory: { create: { status: 'CANCELLED', note: 'Auto-cancelled: payment timeout' } } },
            });
            // Restore stock
            const items = await prisma.orderItem.findMany({ where: { orderId } });
            for (const item of items) {
              await prisma.product.update({ where: { id: item.productId },
                data: { stock: { increment: item.quantity }, soldCount: { decrement: item.quantity } } });
            }
            logger.info(`[OrderWorker] Auto-cancelled unpaid order ${orderId}`);
          }
          break;
        }

        case 'LOYALTY_POINTS': {
          const order = await prisma.order.findUnique({ where: { id: orderId } });
          if (!order || order.status !== 'DELIVERED') break;
          const points = Math.floor(order.total * 10); // 10 points per $1
          await prisma.user.update({ where: { id: order.userId },
            data: { loyaltyPoints: { increment: points } } });
          logger.info(`[OrderWorker] Added ${points} loyalty points to user ${order.userId}`);
          break;
        }

        case 'EXPIRE_PAYMENTS': {
          const { expireStalePayments } = require('../services/payment.service');
          const count = await expireStalePayments();
          logger.info(`[OrderWorker] Expired ${count} stale payments`);
          break;
        }

        case 'REFRESH_TRENDING': {
          const { delCache } = require('../config/redis');
          await delCache('search:trending:scores').catch(() => {});
          await delCache('search:trending').catch(() => {});
          logger.info('[OrderWorker] Trending search cache refreshed');
          break;
        }

        case 'REFRESH_POST_SCORES': {
          const { refreshPostScores } = require('../routes/posts.routes');
          await refreshPostScores();
          break;
        }

        case 'LIVE_SESSION_REMINDER': {
          // Notify followers 15 minutes before a scheduled live session
          const { sessionId, sellerId, sellerName, title, scheduledAt } = job.data;
          const session = await prisma.liveSession.findUnique({ where: { id: sessionId } });
          if (!session || session.status !== 'SCHEDULED') break; // already started or cancelled

          const followers = await prisma.$queryRaw`
            SELECT sf."userId", u."telegramChatId"
            FROM seller_follows sf
            JOIN users u ON u.id = sf."userId"
            WHERE sf."sellerId" = ${sellerId}
            LIMIT 500
          `.catch(() => []);

          const liveUrl = `${process.env.CLIENT_URL || 'http://localhost:3000'}/live`;
          const { createNotification } = require('../services/notification.service');

          await Promise.allSettled(followers.map(async (f) => {
            // In-app notification
            await createNotification(
              f.userId, 'PROMO',
              `⏰ ${sellerName} goes LIVE in 15 minutes!`,
              `"${title}" — Set a reminder!`,
              { sessionId, type: 'LIVE_REMINDER', url: liveUrl }
            );

            // Telegram reminder
            if (f.telegramChatId) {
              const telegramSvc = require('../services/telegram.service');
              const bot = telegramSvc.getBot ? telegramSvc.getBot() : null;
              if (bot) {
                await bot.sendMessage(
                  f.telegramChatId,
                  `⏰ *${sellerName} goes LIVE in 15 minutes!*\n\n📺 "${title}"\n\nDon't miss live deals!`,
                  {
                    parse_mode: 'Markdown',
                    reply_markup: { inline_keyboard: [[{ text: '▶️ Watch Live', url: liveUrl }]] },
                  }
                ).catch(() => {});
              }
            }
          }));

          logger.info(`[OrderWorker] Sent live reminders for session ${sessionId} to ${followers.length} followers`);
          break;
        }

        case 'ABANDONED_CART_RECOVERY': {
          const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
          const abandoned = await prisma.abandonedCart.findMany({
            where: { isActive: true, sentAt: null, createdAt: { lte: oneHourAgo } },
            take: 50,
          }).catch(() => []);
          for (const cart of abandoned) {
            try {
              const user = await prisma.user.findUnique({ where: { id: cart.userId }, select: { telegramChatId: true, name: true } });
              const items = Array.isArray(cart.items) ? cart.items : [];
              if (!items.length) continue;
              const itemNames = items.slice(0, 3).map((i) => i.product?.name || 'item').join(', ');
              const recoveryUrl = (process.env.CLIENT_URL || 'https://hafamarket.com') + '/cart';
              if (user?.telegramChatId) {
                const telegramSvc = require('../services/telegram.service');
                const bot = telegramSvc.getBot ? telegramSvc.getBot() : null;
                if (bot) {
                  await bot.sendMessage(user.telegramChatId,
                    `🛒 *You left items in your cart!*\n\n${itemNames}\n\nComplete your order before they sell out!`,
                    { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: '🛒 Complete Order', url: recoveryUrl }]] } }
                  ).catch(() => {});
                }
              }
              await prisma.abandonedCart.update({ where: { id: cart.id }, data: { sentAt: new Date() } }).catch(() => {});
            } catch {}
          }
          logger.info(`[OrderWorker] Processed ${abandoned.length} abandoned carts`);
          break;
        }

        case 'PROCESS_SUBSCRIPTIONS': {
          const now = new Date();
          const dueSubs = await prisma.subscription.findMany({
            where: { isActive: true, nextOrderAt: { lte: now } }, take: 100,
          }).catch(() => []);
          for (const sub of dueSubs) {
            try {
              const product = await prisma.product.findUnique({ where: { id: sub.productId } });
              if (!product || product.status !== 'ACTIVE' || product.stock < sub.quantity) continue;
              const user = await prisma.user.findUnique({ where: { id: sub.userId }, include: { addresses: { where: { isDefault: true }, take: 1 } } });
              if (!user) continue;
              const address = sub.addressId
                ? await prisma.address.findUnique({ where: { id: sub.addressId } })
                : user.addresses[0];
              if (!address) continue;
              await prisma.order.create({
                data: {
                  userId: sub.userId, addressId: address.id,
                  subtotal: product.price * sub.quantity,
                  deliveryFee: product.price * sub.quantity >= 50 ? 0 : 3.99,
                  discount: 0,
                  total: product.price * sub.quantity + (product.price * sub.quantity >= 50 ? 0 : 3.99),
                  notes: 'Auto-order from subscription',
                  items: { create: [{ productId: sub.productId, productName: product.name, productImg: product.images[0] || null, quantity: sub.quantity, unitPrice: product.price, totalPrice: product.price * sub.quantity, unit: product.unit }] },
                  payment: { create: { amount: product.price * sub.quantity, method: sub.paymentMethod || 'CASH_ON_DELIVERY', status: 'PENDING' } },
                  delivery: { create: { status: 'PENDING' } },
                  statusHistory: { create: { status: 'PENDING', note: 'Auto-created from subscription' } },
                },
              });
              const FREQ_DAYS = { WEEKLY: 7, BIWEEKLY: 14, MONTHLY: 30 };
              const days = FREQ_DAYS[sub.frequency] || 30;
              await prisma.subscription.update({ where: { id: sub.id }, data: { nextOrderAt: new Date(Date.now() + days * 24 * 3600 * 1000) } });
            } catch (err) { logger.error(`Subscription ${sub.id} failed: ${err.message}`); }
          }
          logger.info(`[OrderWorker] Processed ${dueSubs.length} subscriptions`);
          break;
        }

        default:
          logger.warn(`[OrderWorker] Unknown job type: ${type}`);
      }
    }, { connection: CONNECTION, concurrency: 3 });

    orderWorker.on('failed', (job, err) => logger.error(`[OrderWorker] Job ${job?.id} failed: ${err.message}`));

    // ===== ANALYTICS WORKER =====
    const analyticsWorker = new Worker('analytics', async (job) => {
      const { type, data } = job.data;
      switch (type) {
        case 'PRODUCT_VIEW':
          await prisma.productView.create({ data: { productId: data.productId, userId: data.userId, ipAddress: data.ip } }).catch(() => {});
          break;
        case 'SEARCH_LOG':
          await prisma.searchLog.create({ data: { query: data.query, userId: data.userId, results: data.results || 0 } }).catch(() => {});
          break;
        default:
          break;
      }
    }, { connection: CONNECTION, concurrency: 20 });

    analyticsWorker.on('failed', (job, err) => logger.error(`[AnalyticsWorker] Job ${job?.id} failed: ${err.message}`));

    workers = [emailWorker, notifWorker, orderWorker, analyticsWorker];
    logger.info('✅ BullMQ workers started');

    // ── Pre-compute Two-Tower item embeddings every 30 minutes ──────────────
    // This is the "Item Tower" pre-computation — runs in background
    // so recommendations are always fast (no blocking on first request)
    const precomputeEmbeddings = async () => {
      try {
        const { precomputeItemEmbeddings } = require('../services/twoTower.service');
        await precomputeItemEmbeddings();
        logger.info('[TwoTower] Item embeddings refreshed');
      } catch (err) {
        logger.warn('[TwoTower] Pre-compute failed (non-critical):', err.message);
      }
    };

    // Run immediately on startup, then every 30 minutes
    setTimeout(precomputeEmbeddings, 5000); // 5s delay to let server fully start
    setInterval(precomputeEmbeddings, 30 * 60 * 1000); // every 30min

  } catch (err) {
    logger.warn(`⚠️  BullMQ workers unavailable — background processing disabled. (${err.message})`);
  }
}

async function closeWorkers() {
  await Promise.all(workers.map(w => w.close()));
  logger.info('BullMQ workers closed');
}

module.exports = { initWorkers, closeWorkers };
