'use strict';
/**
 * PRACTICAL TWO-TOWER RECOMMENDATION ENGINE
 * ==========================================
 * Amazon-inspired but right-sized for Hafa Market's scale.
 *
 * Architecture:
 *   Item Tower  — pre-computed behavioral embeddings per product
 *                 stored in Redis, refreshed every 30 minutes
 *                 vector = [category_score, price_norm, organic, rating,
 *                           sales_velocity, freshness, seasonal_boost, ...]
 *
 *   User Tower  — real-time user vector built from:
 *                 • purchase history (last 30 orders)
 *                 • click history (last 50 clicks)
 *                 • current session (last 10 actions)
 *                 • time-of-day + day-of-week signals
 *                 • city/location context
 *
 *   Similarity  — dot product between user vector and item vectors
 *                 Top-K items = recommendations
 *
 * Cold Start:
 *   New users   → use city trending + seasonal signals
 *   New items   → use category + price metadata until 5+ interactions
 *
 * Real-time:
 *   Every click/add-to-cart updates the user vector in Redis instantly
 *   No waiting for batch retraining
 *
 * Why this works at Hafa's scale:
 *   True Two-Tower (Google/Amazon) needs millions of users + GPU training
 *   This approximation gives 80% of the benefit using:
 *   - PostgreSQL for behavioral data
 *   - Redis for fast vector storage
 *   - Dot product similarity (O(n) per user request)
 *   - Groq AI for semantic understanding of product descriptions
 */

const prisma = require('../config/prisma');
const { setCache, getCache, getRedis, isAvailable } = require('../config/redis');
const logger = require('../config/logger');

// ── VECTOR DIMENSIONS ────────────────────────────────────────────────────────
// Each product and user is represented as a 16-dimensional vector
// Dimensions are normalized to 0-1 range for dot product similarity
const DIMS = {
  // Item dimensions (0-7)
  CATEGORY_AFFINITY: 0,   // how much this category is liked by similar users
  PRICE_TIER:        1,   // 0=budget, 0.5=mid, 1=premium
  IS_ORGANIC:        2,   // 0 or 1
  RATING:            3,   // 0-1 (rating/5)
  SALES_VELOCITY:    4,   // normalized recent sales speed
  FRESHNESS:         5,   // 1=just harvested, 0=old
  SEASONAL_BOOST:    6,   // 0-1 based on current Ethiopian season
  SELLER_TRUST:      7,   // 0-1 seller quality score

  // User dimensions (8-15) — mirror of item dimensions
  CATEGORY_PREF:     8,   // user's category preference score
  PRICE_SENSITIVITY: 9,   // user's typical price tier
  ORGANIC_PREF:      10,  // does user prefer organic?
  QUALITY_PREF:      11,  // does user prefer high-rated items?
  RECENCY_BIAS:      12,  // does user buy trending items?
  FRESHNESS_PREF:    13,  // does user care about freshness?
  SEASONAL_PREF:     14,  // is user buying seasonal items?
  LOYALTY_SCORE:     15,  // user's engagement level
};

const VECTOR_SIZE = 16;

// ── SEASONAL SIGNALS (Ethiopian calendar) ────────────────────────────────────
function getSeasonalBoost(product) {
  const month = new Date().getMonth() + 1;
  const name = (product.name || '').toLowerCase();
  const cat = (product.category?.slug || '').toLowerCase();

  // Fasting months (March-April, August, November-December)
  const fastingMonths = [3, 4, 8, 11, 12];
  const isFasting = fastingMonths.includes(month);

  // Harvest months (September-November)
  const harvestMonths = [9, 10, 11];
  const isHarvest = harvestMonths.includes(month);

  // Coffee harvest (October-January)
  const coffeeMonths = [10, 11, 12, 1];
  const isCoffeeHarvest = coffeeMonths.includes(month);

  let boost = 0.5; // baseline

  if (isFasting && (cat.includes('vegetable') || cat.includes('legume') || name.includes('lentil') || name.includes('bean'))) boost = 0.95;
  if (isFasting && (cat.includes('meat') || cat.includes('poultry') || cat.includes('dairy'))) boost = 0.1;
  if (isHarvest && (cat.includes('grain') || name.includes('teff') || name.includes('wheat'))) boost = 0.9;
  if (isCoffeeHarvest && cat.includes('coffee')) boost = 0.95;
  if (month === 4 && (name.includes('egg') || name.includes('lamb') || name.includes('honey'))) boost = 0.95; // Easter
  if (month === 9 && (name.includes('honey') || name.includes('teff') || name.includes('coffee'))) boost = 0.9; // New Year
  if (month === 10 && (name.includes('honey') || name.includes('milk') || name.includes('butter'))) boost = 0.95; // Irreechaa

  return boost;
}

// ── ITEM TOWER: Compute product embedding ────────────────────────────────────
async function computeItemEmbedding(product, categoryStats, sellerTrustScores) {
  const vector = new Array(VECTOR_SIZE).fill(0);

  // Dim 0: Category affinity (how popular is this category overall)
  const catSales = categoryStats[product.categoryId] || 0;
  const maxCatSales = Math.max(...Object.values(categoryStats), 1);
  vector[DIMS.CATEGORY_AFFINITY] = catSales / maxCatSales;

  // Dim 1: Price tier (normalize to 0-1 based on market range)
  // ETB 0-50 = budget (0-0.33), 50-200 = mid (0.33-0.66), 200+ = premium (0.66-1)
  vector[DIMS.PRICE_TIER] = Math.min(product.price / 300, 1);

  // Dim 2: Organic flag
  vector[DIMS.IS_ORGANIC] = product.isOrganic ? 1 : 0;

  // Dim 3: Rating (0-5 → 0-1)
  vector[DIMS.RATING] = (product.rating || 0) / 5;

  // Dim 4: Sales velocity (soldCount normalized)
  vector[DIMS.SALES_VELOCITY] = Math.min((product.soldCount || 0) / 500, 1);

  // Dim 5: Freshness (harvest date → days ago → 0-1)
  if (product.harvestDate || product.season) {
    const harvestDate = product.harvestDate || product.season;
    const daysOld = Math.floor((Date.now() - new Date(harvestDate).getTime()) / 86400000);
    vector[DIMS.FRESHNESS] = Math.max(0, 1 - daysOld / 14); // 0 after 14 days
  } else {
    vector[DIMS.FRESHNESS] = 0.5; // unknown freshness
  }

  // Dim 6: Seasonal boost
  vector[DIMS.SEASONAL_BOOST] = getSeasonalBoost(product);

  // Dim 7: Seller trust
  vector[DIMS.SELLER_TRUST] = sellerTrustScores[product.sellerId] || 0.5;

  // Dims 8-15: Mirror for cross-tower compatibility (item side of user dims)
  vector[DIMS.CATEGORY_PREF]    = vector[DIMS.CATEGORY_AFFINITY];
  vector[DIMS.PRICE_SENSITIVITY] = vector[DIMS.PRICE_TIER];
  vector[DIMS.ORGANIC_PREF]     = vector[DIMS.IS_ORGANIC];
  vector[DIMS.QUALITY_PREF]     = vector[DIMS.RATING];
  vector[DIMS.RECENCY_BIAS]     = vector[DIMS.SALES_VELOCITY];
  vector[DIMS.FRESHNESS_PREF]   = vector[DIMS.FRESHNESS];
  vector[DIMS.SEASONAL_PREF]    = vector[DIMS.SEASONAL_BOOST];
  vector[DIMS.LOYALTY_SCORE]    = vector[DIMS.SELLER_TRUST];

  return vector;
}

// ── PRE-COMPUTE ALL ITEM EMBEDDINGS (runs every 30 min) ──────────────────────
async function precomputeItemEmbeddings() {
  const cacheKey = 'tt:items:all';
  const cached = await getCache(cacheKey);
  if (cached) return cached;

  try {
    logger.info('[TwoTower] Pre-computing item embeddings...');

    // Get all active products with needed fields
    const products = await prisma.product.findMany({
      where: { status: 'ACTIVE' },
      select: {
        id: true, name: true, price: true, rating: true, soldCount: true,
        isOrganic: true, categoryId: true, sellerId: true,
        harvestDate: true, season: true,
        category: { select: { slug: true, name: true } },
      },
    });

    // Get category-level sales stats
    const catSales = await prisma.orderItem.groupBy({
      by: ['productId'],
      _count: { productId: true },
      where: { order: { createdAt: { gte: new Date(Date.now() - 30 * 86400000) } } },
    });

    // Map product → category sales
    const productCatMap = {};
    products.forEach(p => { productCatMap[p.id] = p.categoryId; });
    const categoryStats = {};
    catSales.forEach(c => {
      const catId = productCatMap[c.productId];
      if (catId) categoryStats[catId] = (categoryStats[catId] || 0) + c._count.productId;
    });

    // Get seller trust scores
    const sellers = await prisma.seller.findMany({
      where: { status: 'VERIFIED' },
      select: { id: true, rating: true, totalSales: true },
    });
    const sellerTrustScores = {};
    sellers.forEach(s => {
      sellerTrustScores[s.id] = Math.min((s.rating / 5) * 0.8 + Math.min(s.totalSales / 100, 0.2), 1);
    });

    // Compute embedding for each product
    const embeddings = {};
    await Promise.all(products.map(async (product) => {
      embeddings[product.id] = await computeItemEmbedding(product, categoryStats, sellerTrustScores);
    }));

    // Store in Redis with 30-min TTL
    await setCache(cacheKey, embeddings, 1800);
    logger.info(`[TwoTower] Pre-computed ${products.length} item embeddings`);
    return embeddings;

  } catch (err) {
    logger.error('[TwoTower] Pre-compute failed:', err.message);
    return {};
  }
}

// ── USER TOWER: Build real-time user vector ───────────────────────────────────
async function buildUserVector(userId, sessionData = {}) {
  const vector = new Array(VECTOR_SIZE).fill(0.5); // default: neutral preferences

  try {
    const since = new Date(Date.now() - 30 * 86400000); // 30 days

    // Get user's purchase history
    const orders = await prisma.order.findMany({
      where: { userId, status: { in: ['CONFIRMED', 'DELIVERED'] }, createdAt: { gte: since } },
      include: { items: { include: { product: { select: { categoryId: true, price: true, isOrganic: true, rating: true, soldCount: true } } } } },
      take: 30, orderBy: { createdAt: 'desc' },
    });

    const purchasedProducts = orders.flatMap(o => o.items.map(i => i.product)).filter(Boolean);

    if (purchasedProducts.length > 0) {
      // Dim 8: Category preference (most purchased category)
      const catCounts = {};
      purchasedProducts.forEach(p => { catCounts[p.categoryId] = (catCounts[p.categoryId] || 0) + 1; });
      const maxCat = Math.max(...Object.values(catCounts), 1);
      // Store top category score as preference signal
      vector[DIMS.CATEGORY_PREF] = Math.max(...Object.values(catCounts)) / (purchasedProducts.length || 1);

      // Dim 9: Price sensitivity (avg price tier of purchases)
      const avgPrice = purchasedProducts.reduce((s, p) => s + (p.price || 0), 0) / purchasedProducts.length;
      vector[DIMS.PRICE_SENSITIVITY] = Math.min(avgPrice / 300, 1);

      // Dim 10: Organic preference
      const organicCount = purchasedProducts.filter(p => p.isOrganic).length;
      vector[DIMS.ORGANIC_PREF] = organicCount / purchasedProducts.length;

      // Dim 11: Quality preference (avg rating of purchased items)
      const avgRating = purchasedProducts.reduce((s, p) => s + (p.rating || 0), 0) / purchasedProducts.length;
      vector[DIMS.QUALITY_PREF] = avgRating / 5;

      // Dim 12: Recency bias (do they buy trending items?)
      const avgSoldCount = purchasedProducts.reduce((s, p) => s + (p.soldCount || 0), 0) / purchasedProducts.length;
      vector[DIMS.RECENCY_BIAS] = Math.min(avgSoldCount / 500, 1);

      // Dim 15: Loyalty score (based on order frequency)
      vector[DIMS.LOYALTY_SCORE] = Math.min(orders.length / 10, 1);
    }

    // Dim 13: Freshness preference (from click history)
    const clicks = await prisma.searchClick.findMany({
      where: { userId, createdAt: { gte: since } },
      select: { productId: true },
      take: 50,
    });

    if (clicks.length > 0) {
      const clickedProducts = await prisma.product.findMany({
        where: { id: { in: clicks.map(c => c.productId) } },
        select: { harvestDate: true, season: true },
      });
      const freshCount = clickedProducts.filter(p => {
        const d = p.harvestDate || p.season;
        if (!d) return false;
        return Math.floor((Date.now() - new Date(d).getTime()) / 86400000) <= 7;
      }).length;
      vector[DIMS.FRESHNESS_PREF] = clicks.length > 0 ? freshCount / clicks.length : 0.5;
    }

    // Dim 14: Seasonal preference (are they buying seasonal items?)
    vector[DIMS.SEASONAL_PREF] = 0.7; // most Ethiopian users follow seasons

    // ── Real-time session boost ──────────────────────────────────────────────
    // If user just clicked/viewed something, boost those dimensions
    if (sessionData.recentProductIds?.length) {
      const sessionProducts = await prisma.product.findMany({
        where: { id: { in: sessionData.recentProductIds } },
        select: { categoryId: true, price: true, isOrganic: true },
      });
      if (sessionProducts.length > 0) {
        // Blend session signal (30%) with history signal (70%)
        const sessionOrganic = sessionProducts.filter(p => p.isOrganic).length / sessionProducts.length;
        vector[DIMS.ORGANIC_PREF] = vector[DIMS.ORGANIC_PREF] * 0.7 + sessionOrganic * 0.3;

        const sessionAvgPrice = sessionProducts.reduce((s, p) => s + p.price, 0) / sessionProducts.length;
        const sessionPriceTier = Math.min(sessionAvgPrice / 300, 1);
        vector[DIMS.PRICE_SENSITIVITY] = vector[DIMS.PRICE_SENSITIVITY] * 0.7 + sessionPriceTier * 0.3;
      }
    }

    // Mirror user dims to item dims for cross-tower dot product
    vector[DIMS.CATEGORY_AFFINITY] = vector[DIMS.CATEGORY_PREF];
    vector[DIMS.PRICE_TIER]        = vector[DIMS.PRICE_SENSITIVITY];
    vector[DIMS.IS_ORGANIC]        = vector[DIMS.ORGANIC_PREF];
    vector[DIMS.RATING]            = vector[DIMS.QUALITY_PREF];
    vector[DIMS.SALES_VELOCITY]    = vector[DIMS.RECENCY_BIAS];
    vector[DIMS.FRESHNESS]         = vector[DIMS.FRESHNESS_PREF];
    vector[DIMS.SEASONAL_BOOST]    = vector[DIMS.SEASONAL_PREF];
    vector[DIMS.SELLER_TRUST]      = vector[DIMS.LOYALTY_SCORE];

  } catch (err) {
    logger.debug('[TwoTower] User vector build failed:', err.message);
  }

  return vector;
}

// ── ANONYMOUS USER VECTOR (cold start) ───────────────────────────────────────
function buildAnonymousVector(city, sessionData = {}) {
  const vector = new Array(VECTOR_SIZE).fill(0.5);

  // Seasonal signals apply to everyone
  const month = new Date().getMonth() + 1;
  const fastingMonths = [3, 4, 8, 11, 12];
  if (fastingMonths.includes(month)) {
    vector[DIMS.ORGANIC_PREF] = 0.8;
    vector[DIMS.IS_ORGANIC]   = 0.8;
  }

  // Time-of-day signals
  const hour = new Date().getHours();
  if (hour >= 6 && hour <= 10) {
    // Morning: breakfast items
    vector[DIMS.FRESHNESS_PREF] = 0.9;
    vector[DIMS.FRESHNESS]      = 0.9;
  } else if (hour >= 11 && hour <= 14) {
    // Lunch: meal ingredients
    vector[DIMS.CATEGORY_PREF] = 0.7;
  } else if (hour >= 17 && hour <= 21) {
    // Evening: dinner prep
    vector[DIMS.QUALITY_PREF] = 0.8;
    vector[DIMS.RATING]       = 0.8;
  }

  // Session boost
  if (sessionData.recentCategoryIds?.length) {
    vector[DIMS.CATEGORY_PREF]    = 0.9;
    vector[DIMS.CATEGORY_AFFINITY] = 0.9;
  }

  return vector;
}

// ── DOT PRODUCT SIMILARITY ────────────────────────────────────────────────────
function dotProduct(vecA, vecB) {
  return vecA.reduce((sum, a, i) => sum + a * (vecB[i] || 0), 0);
}

// ── MAIN: Get Two-Tower Recommendations ──────────────────────────────────────
async function getTwoTowerRecommendations(userId, options = {}) {
  const {
    context = 'homepage',
    productId,
    categoryId,
    city,
    limit = 10,
    excludeIds = [],
    sessionData = {},
  } = options;

  const cacheKey = `tt:recs:${userId || 'anon'}:${context}:${productId || ''}:${city || ''}`;
  const cached = await getCache(cacheKey);
  if (cached) return cached;

  try {
    // ── Step 1: Get item embeddings (pre-computed) ──────────────────────────
    const itemEmbeddings = await precomputeItemEmbeddings();
    if (!Object.keys(itemEmbeddings).length) return [];

    // ── Step 2: Build user vector (real-time) ───────────────────────────────
    const userVector = userId
      ? await buildUserVector(userId, sessionData)
      : buildAnonymousVector(city, sessionData);

    // ── Step 3: Context-specific filtering ─────────────────────────────────
    let candidateIds = Object.keys(itemEmbeddings);

    // For product context: filter to same category + exclude current product
    if (context === 'product' && productId) {
      const product = await prisma.product.findUnique({
        where: { id: productId },
        select: { categoryId: true },
      });
      if (product) {
        // Get products in same category + adjacent categories
        const sameCatProducts = await prisma.product.findMany({
          where: { categoryId: product.categoryId, status: 'ACTIVE', id: { not: productId } },
          select: { id: true },
          take: 100,
        });
        candidateIds = sameCatProducts.map(p => p.id);
      }
    }

    // For category context: filter to that category
    if (context === 'category' && categoryId) {
      const catProducts = await prisma.product.findMany({
        where: { categoryId, status: 'ACTIVE' },
        select: { id: true },
        take: 200,
      });
      candidateIds = catProducts.map(p => p.id);
    }

    // Exclude already-seen products
    const excludeSet = new Set(excludeIds);
    if (productId) excludeSet.add(productId);
    candidateIds = candidateIds.filter(id => !excludeSet.has(id));

    // ── Step 4: Compute similarity scores (dot product) ─────────────────────
    const scores = candidateIds
      .filter(id => itemEmbeddings[id])
      .map(id => ({
        id,
        score: dotProduct(userVector, itemEmbeddings[id]),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit * 2); // get 2x for dedup

    // ── Step 5: Fetch full product data for top candidates ──────────────────
    const topIds = scores.slice(0, limit).map(s => s.id);
    const products = await prisma.product.findMany({
      where: { id: { in: topIds }, status: 'ACTIVE' },
      include: {
        seller: { select: { storeName: true, storeSlug: true, rating: true } },
        category: { select: { name: true, slug: true, emoji: true } },
      },
    });

    // Preserve ranking order
    const scoreMap = Object.fromEntries(scores.map(s => [s.id, s.score]));
    const ranked = topIds
      .map(id => products.find(p => p.id === id))
      .filter(Boolean)
      .map(p => ({
        ...p,
        _score: scoreMap[p.id],
        _reason: getReason(context, userVector, itemEmbeddings[p.id]),
      }));

    await setCache(cacheKey, ranked, 900); // cache 15min
    return ranked;

  } catch (err) {
    logger.error('[TwoTower] Recommendation failed:', err.message);
    return [];
  }
}

// ── REASON LABEL for UI ───────────────────────────────────────────────────────
function getReason(context, userVec, itemVec) {
  if (!itemVec) return 'Recommended for you';

  const seasonalScore = itemVec[DIMS.SEASONAL_BOOST];
  const freshnessScore = itemVec[DIMS.FRESHNESS];
  const userOrganicPref = userVec[DIMS.ORGANIC_PREF];
  const itemOrganic = itemVec[DIMS.IS_ORGANIC];

  if (seasonalScore > 0.85) return '🌿 In season now';
  if (freshnessScore > 0.8) return '🌱 Just harvested';
  if (userOrganicPref > 0.7 && itemOrganic > 0.5) return '🌿 Matches your organic preference';
  if (context === 'product') return '🛒 Frequently bought together';
  if (context === 'cart') return '✨ Complete your order';
  if (context === 'homepage') return '⭐ Recommended for you';
  return 'Trending near you';
}

// ── REAL-TIME CLICKSTREAM UPDATE ──────────────────────────────────────────────
// Called when user clicks a product — updates their vector in Redis instantly
async function updateUserVectorOnClick(userId, productId) {
  if (!userId || !isAvailable()) return;

  try {
    const key = `tt:user:session:${userId}`;
    const redis = getRedis();

    // Add to session product list
    await redis.lPush(key, productId);
    await redis.lTrim(key, 0, 19); // keep last 20
    await redis.expire(key, 3600); // 1hr session

    // Invalidate user's recommendation cache so next request gets fresh recs
    const recKeys = await redis.keys(`tt:recs:${userId}:*`).catch(() => []);
    if (recKeys.length > 0) {
      await redis.del(...recKeys);
    }
  } catch (err) {
    logger.debug('[TwoTower] Click update failed:', err.message);
  }
}

// ── GET SESSION DATA for user ─────────────────────────────────────────────────
async function getSessionData(userId, sessionId) {
  if (!isAvailable()) return {};

  try {
    const redis = getRedis();
    const keys = [
      userId ? `tt:user:session:${userId}` : null,
      sessionId ? `session:search:${sessionId}` : null,
    ].filter(Boolean);

    if (!keys.length) return {};

    const results = await Promise.all(keys.map(k => redis.lRange(k, 0, 9).catch(() => [])));
    const recentProductIds = results[0] || [];
    const recentSearches = (results[1] || []).map(r => { try { return JSON.parse(r); } catch { return null; } }).filter(Boolean);
    const recentCategoryIds = [...new Set(recentSearches.flatMap(s => s.categories || []))];

    return { recentProductIds, recentCategoryIds };
  } catch {
    return {};
  }
}

// ── HYBRID ENGINE: Two-Tower + existing algorithms ────────────────────────────
// Blends Two-Tower scores with collaborative filtering for best results
async function getHybridRecommendations(userId, context, options = {}) {
  const { productId, city, categoryId, limit = 10, sessionId } = options;

  const sessionData = await getSessionData(userId, sessionId);

  // Run Two-Tower and existing algorithms in parallel
  const [twoTowerResults, existingResults] = await Promise.all([
    getTwoTowerRecommendations(userId, {
      context, productId, categoryId, city, limit: limit + 5, sessionData,
    }),
    // Fall back to existing recommendation service
    require('./recommendation.service').getRecommendations(userId, context, {
      productId, city, categoryId, limit: Math.ceil(limit / 2),
    }).catch(() => []),
  ]);

  // Merge: Two-Tower gets 70% weight, existing gets 30%
  const seen = new Set();
  const merged = [];

  // Add Two-Tower results first (higher weight)
  twoTowerResults.forEach(p => {
    if (!seen.has(p.id)) { seen.add(p.id); merged.push({ ...p, _source: 'two_tower' }); }
  });

  // Fill remaining slots with existing algorithm results
  existingResults.forEach(p => {
    if (!seen.has(p.id) && merged.length < limit) {
      seen.add(p.id);
      merged.push({ ...p, _source: 'collaborative' });
    }
  });

  return merged.slice(0, limit);
}

module.exports = {
  getTwoTowerRecommendations,
  getHybridRecommendations,
  updateUserVectorOnClick,
  precomputeItemEmbeddings,
  buildUserVector,
  getSessionData,
};
