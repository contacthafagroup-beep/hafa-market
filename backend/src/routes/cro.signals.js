/**
 * CRO Signals — Conversion Rate Optimization
 * GET /products/:id/cro
 *
 * Returns real-time urgency signals for a product:
 *   - viewersNow   : people viewing this page right now (Redis counter, 5-min window)
 *   - ordersToday  : number of times ordered in the last 24h
 *   - stockLevel   : current stock + urgency tier
 *   - priceDrop    : % drop vs comparePrice
 *   - flashEndsAt  : active flash sale expiry (if any)
 *   - recentBuyers : first-name initials of last 3 buyers (social proof)
 */

const router = require('express').Router({ mergeParams: true });
const prisma  = require('../config/prisma');
const { getRedis, isAvailable } = require('../config/redis');
const { getIO } = require('../socket');

// TTL for the viewer window (seconds)
const VIEWER_TTL = 300; // 5 minutes

router.get('/', async (req, res, next) => {
  try {
    const { id } = req.params;

    // ── 1. Viewer count via Redis ──────────────────────────────────────────
    let viewersNow = 1;
    if (isAvailable()) {
      const redis = getRedis();
      const viewKey = `cro:viewers:${id}`;
      // Increment and set expiry atomically
      const count = await redis.incr(viewKey);
      await redis.expire(viewKey, VIEWER_TTL);
      viewersNow = count;

      // Broadcast updated viewer count to all clients on this product page
      const io = getIO();
      if (io) {
        io.to(`product:${id}`).emit('cro:viewers', { productId: id, count: viewersNow });
      }
    }

    // ── 2. Orders in last 24h + recent buyer names ─────────────────────────
    const since24h = new Date(Date.now() - 24 * 3600 * 1000);
    const [ordersToday, recentOrders, product] = await Promise.all([
      prisma.orderItem.count({
        where: { productId: id, order: { createdAt: { gte: since24h }, status: { not: 'CANCELLED' } } },
      }),
      prisma.orderItem.findMany({
        where: { productId: id, order: { createdAt: { gte: since24h }, status: { not: 'CANCELLED' } } },
        take: 3,
        orderBy: { order: { createdAt: 'desc' } },
        include: { order: { include: { user: { select: { name: true } } } } },
      }),
      prisma.product.findUnique({
        where: { id },
        select: { stock: true, price: true, comparePrice: true, unit: true },
      }),
    ]);

    if (!product) return res.json({ success: true, data: null });

    // ── 3. Stock urgency tier ──────────────────────────────────────────────
    const stock = product.stock;
    const stockTier =
      stock === 0   ? 'OUT'      :
      stock <= 3    ? 'CRITICAL' : // "Only 3 left!"
      stock <= 10   ? 'LOW'      : // "Only 10 left"
      stock <= 25   ? 'MEDIUM'   : // subtle nudge
                      'AMPLE';

    // ── 4. Price drop signal ───────────────────────────────────────────────
    const priceDrop = product.comparePrice && product.comparePrice > product.price
      ? Math.round((1 - product.price / product.comparePrice) * 100)
      : 0;

    // ── 5. Recent buyer social proof (first name only, privacy-safe) ───────
    const recentBuyers = recentOrders
      .map(o => o.order?.user?.name?.split(' ')[0])
      .filter(Boolean)
      .slice(0, 3);

    // ── 6. Active flash sale ───────────────────────────────────────────────
    let flashEndsAt = null;
    try {
      const now = new Date();
      const flash = await prisma.campaign.findFirst({
        where: {
          type: 'FLASH_SALE',
          isActive: true,
          startsAt: { lte: now },
          endsAt:   { gte: now },
        },
        select: { endsAt: true },
      });
      if (flash) flashEndsAt = flash.endsAt;
    } catch { /* campaigns table may not exist in all envs */ }

    res.json({
      success: true,
      data: {
        viewersNow,
        ordersToday,
        recentBuyers,
        stock,
        stockTier,
        unit: product.unit,
        priceDrop,
        flashEndsAt,
      },
    });
  } catch (err) { next(err); }
});

// ── Decrement viewer count when user leaves ────────────────────────────────
// Called by the frontend on page unload via navigator.sendBeacon
router.post('/leave', async (req, res) => {
  const { id } = req.params;
  if (isAvailable()) {
    const redis = getRedis();
    const viewKey = `cro:viewers:${id}`;
    const current = await redis.get(viewKey).catch(() => null);
    if (current && parseInt(current) > 1) {
      await redis.decr(viewKey).catch(() => {});
      const io = getIO();
      if (io) {
        const updated = Math.max(1, parseInt(current) - 1);
        io.to(`product:${id}`).emit('cro:viewers', { productId: id, count: updated });
      }
    }
  }
  res.status(204).end();
});

module.exports = router;
