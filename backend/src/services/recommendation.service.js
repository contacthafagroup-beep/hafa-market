'use strict';
const prisma  = require('../config/prisma');
const { setCache, getCache } = require('../config/redis');
const logger  = require('../config/logger');

// ═══════════════════════════════════════════════════════════════════════════
// HAFA MARKET RECOMMENDATION ENGINE
// 4 algorithms working together:
//   1. Collaborative filtering — "users like you also bought"
//   2. Co-occurrence matrix   — "frequently bought together"
//   3. Content-based          — "similar products"
//   4. Trending in your city  — "popular near you"
// ═══════════════════════════════════════════════════════════════════════════

// ── Algorithm 1: Collaborative Filtering ─────────────────────────────────────
// Find users with similar purchase history → recommend what they bought
async function collaborativeFilter(userId, limit = 10) {
  const cacheKey = `rec:collab:${userId}`;
  const cached = await getCache(cacheKey);
  if (cached) return cached;

  try {
    // Get this user's purchased products
    const myOrders = await prisma.order.findMany({
      where: { userId, status: { in: ['DELIVERED','CONFIRMED'] } },
      include: { items: { select: { productId: true } } },
      take: 20, orderBy: { createdAt: 'desc' },
    });
    const myProductIds = [...new Set(myOrders.flatMap(o => o.items.map(i => i.productId)))];
    if (!myProductIds.length) return [];

    // Find other users who bought the same products
    const similarUsers = await prisma.orderItem.findMany({
      where: { productId: { in: myProductIds }, order: { userId: { not: userId }, status: { in: ['DELIVERED','CONFIRMED'] } } },
      select: { order: { select: { userId: true } } },
      take: 200,
    });
    const similarUserIds = [...new Set(similarUsers.map(s => s.order.userId))].slice(0, 50);
    if (!similarUserIds.length) return [];

    // Find what those similar users bought that I haven't
    const theirPurchases = await prisma.orderItem.findMany({
      where: {
        order: { userId: { in: similarUserIds }, status: { in: ['DELIVERED','CONFIRMED'] } },
        productId: { notIn: myProductIds },
      },
      select: { productId: true },
    });

    // Score by frequency (how many similar users bought it)
    const freq = {};
    theirPurchases.forEach(p => { freq[p.productId] = (freq[p.productId] || 0) + 1; });
    const topIds = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, limit).map(([id]) => id);

    const products = await prisma.product.findMany({
      where: { id: { in: topIds }, status: 'ACTIVE' },
      include: { seller: { select: { storeName: true } }, category: { select: { name: true, emoji: true } } },
    });

    const result = topIds.map(id => products.find(p => p.id === id)).filter(Boolean);
    await setCache(cacheKey, result, 3600); // cache 1hr
    return result;
  } catch (err) {
    logger.debug('Collaborative filter error:', err.message);
    return [];
  }
}

// ── Algorithm 2: Co-occurrence Matrix ────────────────────────────────────────
// "Customers who bought X also bought Y"
// Built from order history — products that appear together in orders
async function getFrequentlyBoughtTogether(productId, limit = 6) {
  const cacheKey = `rec:cooccur:${productId}`;
  const cached = await getCache(cacheKey);
  if (cached) return cached;

  try {
    // Find all orders containing this product
    const orders = await prisma.orderItem.findMany({
      where: { productId, order: { status: { in: ['DELIVERED','CONFIRMED'] } } },
      select: { orderId: true },
      take: 200,
    });
    const orderIds = orders.map(o => o.orderId);
    if (!orderIds.length) return [];

    // Find other products in those orders
    const coItems = await prisma.orderItem.findMany({
      where: { orderId: { in: orderIds }, productId: { not: productId } },
      select: { productId: true },
    });

    // Score by co-occurrence frequency
    const freq = {};
    coItems.forEach(i => { freq[i.productId] = (freq[i.productId] || 0) + 1; });
    const topIds = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, limit).map(([id]) => id);

    const products = await prisma.product.findMany({
      where: { id: { in: topIds }, status: 'ACTIVE' },
      include: { seller: { select: { storeName: true } }, category: { select: { name: true, emoji: true } } },
    });

    const result = topIds.map(id => products.find(p => p.id === id)).filter(Boolean);
    await setCache(cacheKey, result, 3600);
    return result;
  } catch (err) {
    logger.debug('Co-occurrence error:', err.message);
    return [];
  }
}

// ── Algorithm 3: Content-Based Filtering ─────────────────────────────────────
// "Similar products" — same category, similar price range, high rating
async function getSimilarProducts(productId, limit = 8) {
  const cacheKey = `rec:similar:${productId}`;
  const cached = await getCache(cacheKey);
  if (cached) return cached;

  try {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { categoryId: true, price: true, tags: true, isOrganic: true },
    });
    if (!product) return [];

    const priceRange = product.price * 0.5; // ±50% price range

    const similar = await prisma.product.findMany({
      where: {
        id: { not: productId },
        status: 'ACTIVE',
        categoryId: product.categoryId,
        price: { gte: product.price - priceRange, lte: product.price + priceRange },
      },
      orderBy: [{ rating: 'desc' }, { soldCount: 'desc' }],
      take: limit,
      include: { seller: { select: { storeName: true } }, category: { select: { name: true, emoji: true } } },
    });

    await setCache(cacheKey, similar, 1800);
    return similar;
  } catch (err) {
    logger.debug('Similar products error:', err.message);
    return [];
  }
}

// ── Algorithm 4: Trending in Your City ───────────────────────────────────────
// "Popular near you" — what people in the same city are buying
async function getTrendingInCity(city, categoryId, limit = 8) {
  const cacheKey = `rec:city:${city || 'all'}:${categoryId || 'all'}`;
  const cached = await getCache(cacheKey);
  if (cached) return cached;

  try {
    const since = new Date(Date.now() - 7 * 24 * 3600 * 1000); // 7 days

    // Find orders from this city
    const cityOrders = await prisma.order.findMany({
      where: {
        createdAt: { gte: since },
        status: { in: ['DELIVERED','CONFIRMED'] },
        ...(city ? { address: { city: { contains: city, mode: 'insensitive' } } } : {}),
      },
      include: { items: { select: { productId: true } } },
      take: 500,
    });

    const freq = {};
    cityOrders.forEach(o => o.items.forEach(i => { freq[i.productId] = (freq[i.productId] || 0) + 1; }));
    const topIds = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, limit * 2).map(([id]) => id);

    const where = { id: { in: topIds }, status: 'ACTIVE' };
    if (categoryId) where.categoryId = categoryId;

    const products = await prisma.product.findMany({
      where, take: limit,
      include: { seller: { select: { storeName: true, city: true } }, category: { select: { name: true, emoji: true } } },
    });

    const result = topIds.map(id => products.find(p => p.id === id)).filter(Boolean).slice(0, limit);
    await setCache(cacheKey, result, 1800); // cache 30min
    return result;
  } catch (err) {
    logger.debug('City trending error:', err.message);
    return [];
  }
}

// ── Algorithm 5: "Because you viewed X" (session-based) ──────────────────────
async function getBecauseYouViewed(userId, limit = 6) {
  const cacheKey = `rec:viewed:${userId}`;
  const cached = await getCache(cacheKey);
  if (cached) return cached;

  try {
    const recentViews = await prisma.productView.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { productId: true },
    });
    if (!recentViews.length) return [];

    const viewedIds = recentViews.map(v => v.productId);
    const viewedProducts = await prisma.product.findMany({
      where: { id: { in: viewedIds } },
      select: { categoryId: true, price: true },
    });

    // Get similar products to recently viewed
    const categoryIds = [...new Set(viewedProducts.map(p => p.categoryId))];
    const avgPrice    = viewedProducts.reduce((s, p) => s + p.price, 0) / viewedProducts.length;

    const similar = await prisma.product.findMany({
      where: {
        id: { notIn: viewedIds },
        status: 'ACTIVE',
        categoryId: { in: categoryIds },
        price: { gte: avgPrice * 0.5, lte: avgPrice * 2 },
      },
      orderBy: [{ rating: 'desc' }, { soldCount: 'desc' }],
      take: limit,
      include: { seller: { select: { storeName: true } }, category: { select: { name: true, emoji: true } } },
    });

    await setCache(cacheKey, similar, 900); // cache 15min (more dynamic)
    return similar;
  } catch (err) {
    logger.debug('Because you viewed error:', err.message);
    return [];
  }
}

// ── Master recommendation function ───────────────────────────────────────────
// Combines all algorithms based on context
async function getRecommendations(userId, context, options = {}) {
  const { productId, city, categoryId, limit = 10 } = options;

  const cacheKey = `rec:master:${userId || 'anon'}:${context}:${productId || ''}:${city || ''}`;
  const cached = await getCache(cacheKey);
  if (cached) return cached;

  let results = [];

  switch (context) {
    case 'homepage': {
      // Mix: collaborative + trending in city + because you viewed
      const [collab, cityTrending, viewed] = await Promise.all([
        userId ? collaborativeFilter(userId, 6) : Promise.resolve([]),
        getTrendingInCity(city, null, 6),
        userId ? getBecauseYouViewed(userId, 4) : Promise.resolve([]),
      ]);
      // Deduplicate and merge
      const seen = new Set();
      const merged = [...collab, ...viewed, ...cityTrending].filter(p => {
        if (seen.has(p.id)) return false;
        seen.add(p.id); return true;
      });
      results = merged.slice(0, limit);
      break;
    }

    case 'product': {
      // Mix: frequently bought together + similar products
      const [together, similar] = await Promise.all([
        productId ? getFrequentlyBoughtTogether(productId, 4) : Promise.resolve([]),
        productId ? getSimilarProducts(productId, 6) : Promise.resolve([]),
      ]);
      const seen = new Set([productId]);
      results = [...together, ...similar].filter(p => {
        if (seen.has(p.id)) return false;
        seen.add(p.id); return true;
      }).slice(0, limit);
      break;
    }

    case 'cart': {
      // Based on what's in cart — find complementary products
      const [collab, cityTrending] = await Promise.all([
        userId ? collaborativeFilter(userId, 6) : Promise.resolve([]),
        getTrendingInCity(city, categoryId, 4),
      ]);
      const seen = new Set();
      results = [...collab, ...cityTrending].filter(p => {
        if (seen.has(p.id)) return false;
        seen.add(p.id); return true;
      }).slice(0, limit);
      break;
    }

    case 'category': {
      results = await getTrendingInCity(city, categoryId, limit);
      break;
    }

    default:
      results = await getTrendingInCity(city, null, limit);
  }

  // Add recommendation reason for UI display
  const withReason = results.map((p, i) => ({
    ...p,
    _reason: context === 'product' && i < 4 ? 'Frequently bought together' :
             context === 'product' ? 'Similar products' :
             context === 'homepage' && i < 4 ? 'Based on your history' :
             'Trending near you',
  }));

  await setCache(cacheKey, withReason, 900); // cache 15min
  return withReason;
}

module.exports = {
  getRecommendations,
  collaborativeFilter,
  getFrequentlyBoughtTogether,
  getSimilarProducts,
  getTrendingInCity,
  getBecauseYouViewed,
};
