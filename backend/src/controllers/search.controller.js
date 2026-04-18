'use strict';
const prisma  = require('../config/prisma');
const { setCache, getCache, getRedis, isAvailable, TTL, KEYS } = require('../config/redis');
const { searchProducts } = require('../config/typesense');
const logger  = require('../config/logger');
const intentGraph = require('../services/intentGraph.service');

// ═══════════════════════════════════════════════════════════════════════════
// ETHIOPIAN INTENT GRAPH — delegated to self-learning service
// See: backend/src/services/intentGraph.service.js
// Layer 1: ~80 seed entries (instant)
// Layer 2: DB learned entries (fast, grows with usage)
// Layer 3: Groq AI (unlimited, saves to DB for next time)
// ═══════════════════════════════════════════════════════════════════════════

// Wrapper — resolveEthiopianIntent is now async (DB + AI)
async function resolveEthiopianIntent(query) {
  return intentGraph.resolveIntent(query);
}

// ═══════════════════════════════════════════════════════════════════════════
// UPGRADE 1: CVR-WEIGHTED RANKING
// Track views → add_to_cart → purchase funnel per product
// CVR = purchases / views (last 30 days)
// Amazon A10: CVR is the dominant ranking signal
// ═══════════════════════════════════════════════════════════════════════════

async function getCVRScores() {
  const cacheKey = 'search:cvr:scores';
  const cached = await getCache(cacheKey);
  if (cached) return cached;

  const since = new Date(Date.now() - 30 * 24 * 3600 * 1000);

  // Get view counts per product
  const [views, cartAdds, purchases] = await Promise.all([
    // Product views
    prisma.analyticsEvent.groupBy({
      by: ['productId'],
      _count: { productId: true },
      where: { type: 'PRODUCT_VIEW', productId: { not: null }, createdAt: { gte: since } },
    }).catch(() => []),

    // Add to cart events
    prisma.analyticsEvent.groupBy({
      by: ['productId'],
      _count: { productId: true },
      where: { type: 'ADD_TO_CART', productId: { not: null }, createdAt: { gte: since } },
    }).catch(() => []),

    // Actual purchases (order items)
    prisma.orderItem.groupBy({
      by: ['productId'],
      _count: { productId: true },
      where: { order: { createdAt: { gte: since }, status: { in: ['CONFIRMED', 'DELIVERED'] } } },
    }).catch(() => []),
  ]);

  // Build maps
  const viewMap = {};
  views.forEach(v => { viewMap[v.productId] = v._count.productId; });

  const cartMap = {};
  cartAdds.forEach(c => { cartMap[c.productId] = c._count.productId; });

  const purchaseMap = {};
  purchases.forEach(p => { purchaseMap[p.productId] = p._count.productId; });

  // Compute CVR scores
  // CVR = purchases / views (0-1)
  // Cart-to-purchase rate also factored in
  const cvrScores = {};
  const allProductIds = new Set([
    ...Object.keys(viewMap),
    ...Object.keys(cartMap),
    ...Object.keys(purchaseMap),
  ]);

  allProductIds.forEach(productId => {
    const viewCount = viewMap[productId] || 0;
    const cartCount = cartMap[productId] || 0;
    const purchaseCount = purchaseMap[productId] || 0;

    if (viewCount === 0 && purchaseCount === 0) return;

    // CVR formula (Amazon A10 inspired):
    // - Purchase CVR: purchases / views (most important)
    // - Cart CVR: cart_adds / views (secondary signal)
    // - Minimum 5 views to avoid noise from single-view products
    const minViews = 5;
    const effectiveViews = Math.max(viewCount, minViews);

    const purchaseCVR = purchaseCount / effectiveViews;
    const cartCVR = cartCount / effectiveViews;

    // Weighted CVR score (purchase = 3x cart)
    cvrScores[productId] = (purchaseCVR * 3) + (cartCVR * 1);
  });

  await setCache(cacheKey, cvrScores, 1800); // cache 30min
  return cvrScores;
}

// ═══════════════════════════════════════════════════════════════════════════
// UPGRADE 3: EXTERNAL TRAFFIC SIGNAL TRACKING
// Amazon A10 rewards products that bring external traffic
// Track UTM sources, referrers, and social media clicks
// ═══════════════════════════════════════════════════════════════════════════

async function getExternalTrafficScores() {
  const cacheKey = 'search:external:traffic';
  const cached = await getCache(cacheKey);
  if (cached) return cached;

  const since = new Date(Date.now() - 30 * 24 * 3600 * 1000);

  // External traffic = visits with utm_source or social referrer
  const externalEvents = await prisma.analyticsEvent.groupBy({
    by: ['productId'],
    _count: { productId: true },
    where: {
      type: 'PRODUCT_VIEW',
      productId: { not: null },
      createdAt: { gte: since },
      // External traffic markers stored in meta JSON
      meta: {
        path: ['source'],
        not: null,
      },
    },
  }).catch(() => []);

  const scores = {};
  externalEvents.forEach(e => {
    if (e.productId) {
      // External traffic = significant ranking boost (A10 principle)
      scores[e.productId] = Math.min((e._count.productId || 0) * 0.5, 20);
    }
  });

  await setCache(cacheKey, scores, 3600); // cache 1hr
  return scores;
}

// ═══════════════════════════════════════════════════════════════════════════
// LAYER 1 — QUERY UNDERSTANDING (Semantic AI)
// Uses Groq to interpret intent, not just keywords
// "cheap food for hotel" → { intent: 'bulk', categories: ['vegetables','grains','oil'], priceSignal: 'low' }
// ═══════════════════════════════════════════════════════════════════════════

// Ethiopian synonym dictionary (fast path — no AI needed for known terms)
const SYNONYMS = {
  'teff':'ጤፍ tef injera', 'ጤፍ':'teff tef', 'tomato':'tomatoes ቲማቲም timatim',
  'ቲማቲም':'tomato tomatoes', 'onion':'onions ሽንኩርት', 'ሽንኩርት':'onion onions',
  'coffee':'ቡና buna kaffa', 'ቡና':'coffee buna', 'honey':'ማር mar', 'ማር':'honey',
  'wheat':'ስንዴ sinde flour', 'ስንዴ':'wheat', 'potato':'potatoes ድንች dinich',
  'ድንች':'potato potatoes', 'cabbage':'ጎመን gomen', 'ጎመን':'cabbage',
  'carrot':'carrots ካሮት', 'egg':'eggs እንቁላል enqulal', 'እንቁላል':'egg eggs',
  'milk':'ወተት wetet', 'ወተት':'milk', 'beef':'meat ሥጋ siga', 'ሥጋ':'beef meat',
  'cheap':'affordable budget ርካሽ', 'organic':'natural ኦርጋኒክ fresh',
  'bulk':'wholesale ጅምላ', 'ጅምላ':'bulk wholesale',
  'rice':'ሩዝ ruz', 'ሩዝ':'rice', 'lentil':'lentils ምስር misir', 'ምስር':'lentil lentils',
  'pepper':'peppers ቃሪያ', 'ቃሪያ':'pepper peppers', 'garlic':'ነጭ ሽንኩርት',
  'hotel':'restaurant cafe bulk wholesale', 'restaurant':'bulk wholesale food',
  'cafe':'coffee bulk wholesale', 'party':'bulk event catering',
  'breakfast':'eggs milk bread', 'lunch':'vegetables meat rice',
  // Afaan Oromo synonyms
  'buna':'coffee roasted coffee', 'aannan':'milk dairy',
  'dhadhaa':'butter ghee', 'damma':'honey', 'foon':'meat beef lamb',
  'lukkuu':'chicken poultry', 'hanqaaquu':'eggs', 'baaqelaa':'beans legumes',
  'xaafii':'teff injera', 'garbuu':'barley', 'masaraa':'maize corn',
  'qamadii':'wheat flour', 'dinnicha':'potato potatoes', 'aanmoo':'onion onions',
  'toomaatoo':'tomato tomatoes', 'qocaa':'cabbage', 'qaaroota':'carrot carrots',
  'atara':'chickpeas shiro', 'mudhii':'honey', 'karraa':'butter ghee',
}

function expandQuery(query) {
  const words = query.toLowerCase().split(/\s+/);
  const expanded = new Set(words);
  words.forEach(w => { if (SYNONYMS[w]) SYNONYMS[w].split(' ').forEach(s => expanded.add(s)); });
  // Note: intent graph expansion happens in interpretQueryWithAI (async)
  return Array.from(expanded).join(' ');
}

// AI semantic interpretation — only for complex multi-word queries
async function interpretQueryWithAI(query) {
  // FAST PATH: Check Ethiopian intent graph first (seed → DB → AI)
  const ethiopianIntent = await resolveEthiopianIntent(query);
  if (ethiopianIntent) {
    return {
      searchTerms: ethiopianIntent.terms,
      intent: ethiopianIntent.intent,
      priceSignal: ethiopianIntent.intent === 'cheap' ? 'low' : null,
      minQty: ethiopianIntent.intent === 'bulk' ? 5 : null,
      boost: ethiopianIntent.boost,
      source: ethiopianIntent.source || 'intent_graph',
    };
  }

  // Only use AI for queries that look like natural language (3+ words, no exact product match)
  if (query.split(' ').length < 3) return null;

  const cacheKey = `search:ai:${query.toLowerCase().slice(0, 80)}`;
  const cached = await getCache(cacheKey);
  if (cached) return cached;

  try {
    const Groq = require('groq-sdk');
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const completion = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [{
        role: 'system',
        content: `You are a search query interpreter for an Ethiopian agricultural marketplace.
Given a search query, extract:
1. searchTerms: array of product names to search for (max 5)
2. intent: one of "bulk", "cheap", "organic", "fresh", "specific"
3. priceSignal: "low", "high", or null
4. minQty: minimum quantity if mentioned (number or null)

Respond ONLY with valid JSON. Example:
{"searchTerms":["tomatoes","onions","cabbage"],"intent":"bulk","priceSignal":"low","minQty":10}`,
      }, {
        role: 'user',
        content: query,
      }],
      max_tokens: 100,
      temperature: 0.1,
    });

    const text = completion.choices[0].message.content.trim();
    const parsed = JSON.parse(text);
    await setCache(cacheKey, parsed, 3600); // cache 1hr — same query = same interpretation
    return parsed;
  } catch (err) {
    logger.debug('AI query interpretation failed (non-critical):', err.message);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// LAYER 2 — PURCHASE-BASED RANKING (Revenue signal, not just clicks)
// purchases >> clicks because purchases = actual revenue
// ═══════════════════════════════════════════════════════════════════════════

async function getPurchaseScores(query) {
  const cacheKey = `search:purchases:${query.toLowerCase().slice(0, 50)}`;
  const cached = await getCache(cacheKey);
  if (cached) return cached;

  // Find products purchased after searching for this query
  const since = new Date(Date.now() - 30 * 24 * 3600 * 1000); // 30 days
  const clicks = await prisma.searchClick.findMany({
    where: { query: { contains: query.toLowerCase().split(' ')[0], mode: 'insensitive' }, createdAt: { gte: since } },
    select: { productId: true, userId: true, createdAt: true },
  });

  if (!clicks.length) { await setCache(cacheKey, {}, 1800); return {}; }

  // For each click, check if user purchased within 24hrs
  const scores = {};
  const userClickMap = {};
  clicks.forEach(c => {
    if (c.userId) {
      if (!userClickMap[c.userId]) userClickMap[c.userId] = [];
      userClickMap[c.userId].push({ productId: c.productId, clickedAt: c.createdAt });
    }
  });

  const userIds = Object.keys(userClickMap);
  if (userIds.length > 0) {
    const orders = await prisma.order.findMany({
      where: { userId: { in: userIds }, createdAt: { gte: since }, status: { in: ['CONFIRMED','DELIVERED'] } },
      include: { items: { select: { productId: true } } },
    });

    orders.forEach(order => {
      const userClicks = userClickMap[order.userId] || [];
      order.items.forEach(item => {
        const wasClicked = userClicks.some(c =>
          c.productId === item.productId &&
          new Date(order.createdAt) - new Date(c.clickedAt) < 24 * 3600 * 1000
        );
        if (wasClicked) {
          scores[item.productId] = (scores[item.productId] || 0) + 5; // purchase = 5x click weight
        }
      });
    });
  }

  await setCache(cacheKey, scores, 1800); // cache 30min
  return scores;
}

// ═══════════════════════════════════════════════════════════════════════════
// LAYER 3 — COLD START FIX (New products get a temporary boost)
// New products have no clicks/purchases → they'd never rank
// Solution: time-decay boost for products < 14 days old
// ═══════════════════════════════════════════════════════════════════════════

function getColdStartBoost(product) {
  const ageMs = Date.now() - new Date(product.createdAt).getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);

  if (ageDays <= 3)  return 15; // brand new — strong boost
  if (ageDays <= 7)  return 10; // 1 week old
  if (ageDays <= 14) return 5;  // 2 weeks old
  return 0; // established product — no boost
}

// ═══════════════════════════════════════════════════════════════════════════
// LAYER 4 — SESSION-BASED CONTEXT (What is the user looking for RIGHT NOW?)
// If user searched "vegetables" then "onion" → boost vegetable-related items
// ═══════════════════════════════════════════════════════════════════════════

async function getSessionContext(sessionId) {
  if (!sessionId || !isAvailable()) return { recentCategories: [], recentProducts: [] };
  try {
    const key = `session:search:${sessionId}`;
    const raw = await getRedis().lRange(key, 0, 9); // last 10 searches
    const recentSearches = raw.map(r => { try { return JSON.parse(r); } catch { return null; } }).filter(Boolean);
    const recentCategories = [...new Set(recentSearches.flatMap(s => s.categories || []))];
    const recentProducts   = [...new Set(recentSearches.flatMap(s => s.productIds || []))];
    return { recentCategories, recentProducts };
  } catch { return { recentCategories: [], recentProducts: [] }; }
}

async function saveSessionSearch(sessionId, query, productIds, categories) {
  if (!sessionId || !isAvailable()) return;
  try {
    const key = `session:search:${sessionId}`;
    await getRedis().lPush(key, JSON.stringify({ query, productIds: productIds.slice(0, 5), categories }));
    await getRedis().lTrim(key, 0, 9);   // keep last 10
    await getRedis().expire(key, 3600);  // 1hr session
  } catch {}
}

// ═══════════════════════════════════════════════════════════════════════════
// LAYER 5 — SPONSORED PRODUCTS (Revenue machine 💰)
// Sellers pay to appear at top of search results
// CPC model: deduct from seller wallet on click
// ═══════════════════════════════════════════════════════════════════════════

async function getSponsoredProducts(query, limit = 2) {
  try {
    const now = new Date();
    // Find active ads for search placement matching this query
    const ads = await prisma.ad.findMany({
      where: {
        status: 'ACTIVE',
        placement: { in: ['SEARCH_TOP', 'HOMEPAGE'] },
        startsAt: { lte: now },
        OR: [{ endsAt: null }, { endsAt: { gte: now } }],
      },
      orderBy: { bidPerClick: 'desc' }, // highest bidder wins
      take: limit * 3, // fetch more, filter by budget
      include: {
        product: {
          include: {
            seller:   { select: { storeName: true, storeSlug: true, rating: true } },
            category: { select: { name: true, slug: true, emoji: true } },
          },
        },
      },
    }).catch(() => []);

    // Filter: must have budget remaining AND product must be relevant
    const queryWords = query.toLowerCase().split(' ');
    const relevant = ads.filter(ad => {
      if (!ad.product || ad.product.status !== 'ACTIVE') return false;
      if (ad.spent >= ad.budget) return false; // budget exhausted
      // Check relevance: product name/category contains any query word
      const productText = (ad.product.name + ' ' + (ad.product.description || '')).toLowerCase();
      return queryWords.some(w => w.length > 2 && productText.includes(w));
    }).slice(0, limit);

    return relevant.map(ad => ({ ...ad.product, _sponsored: true, _adId: ad.id, _bidPerClick: ad.bidPerClick }));
  } catch (err) {
    logger.debug('Sponsored products fetch failed:', err.message);
    return [];
  }
}

// Track impressions for returned sponsored products (fire-and-forget)
async function trackAdImpressions(adIds) {
  if (!adIds.length) return;
  try {
    await prisma.ad.updateMany({
      where: { id: { in: adIds } },
      data: { impressions: { increment: 1 } },
    });
  } catch {}
}

async function recordAdClick(adId, userId, ip) {
  try {
    const ad = await prisma.ad.findUnique({ where: { id: adId } });
    if (!ad) return;

    await prisma.$transaction([
      prisma.ad.update({ where: { id: adId }, data: { clicks: { increment: 1 }, spent: { increment: ad.bidPerClick } } }),
      prisma.adClick.create({ data: { adId, userId: userId || null, ipAddress: ip || '0.0.0.0' } }),
    ]);

    // Pause ad if budget exhausted
    const updated = await prisma.ad.findUnique({ where: { id: adId } });
    if (updated && updated.spent >= updated.budget) {
      await prisma.ad.update({ where: { id: adId }, data: { status: 'PAUSED' } });
      logger.info(`Ad ${adId} paused — budget exhausted`);
    }
  } catch (err) {
    logger.debug('Ad click record failed:', err.message);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// EXISTING HELPERS (click scores, trending, user prefs)
// ═══════════════════════════════════════════════════════════════════════════

const CLICK_SCORE_TTL = 7 * 24 * 3600;

async function incrClickScore(query, productId) {
  if (!isAvailable()) return;
  try {
    const key = `search:clicks:${query.toLowerCase().slice(0, 50)}`;
    await getRedis().zIncrBy(key, 1, productId);
    await getRedis().expire(key, CLICK_SCORE_TTL);
  } catch {}
}

async function getClickScores(query) {
  if (!isAvailable()) return {};
  try {
    const key = `search:clicks:${query.toLowerCase().slice(0, 50)}`;
    const members = await getRedis().zRangeWithScores(key, 0, -1);
    const scores = {};
    members.forEach(m => { scores[m.value] = m.score; });
    return scores;
  } catch { return {}; }
}

async function getUserPreferences(userId) {
  if (!userId) return { categories: [] };
  const cacheKey = `user:prefs:${userId}`;
  const cached = await getCache(cacheKey);
  if (cached) return cached;

  const [orders, views] = await Promise.all([
    prisma.order.findMany({ where: { userId, status: { in: ['DELIVERED','CONFIRMED'] } }, take: 20, orderBy: { createdAt: 'desc' }, include: { items: { include: { product: { select: { categoryId: true } } } } } }),
    prisma.productView.findMany({ where: { userId }, take: 30, orderBy: { createdAt: 'desc' }, include: { product: { select: { categoryId: true } } } }).catch(() => []),
  ]);

  const catScores = {};
  orders.forEach(o => o.items.forEach(i => { const c = i.product?.categoryId; if (c) catScores[c] = (catScores[c] || 0) + 3; }));
  views.forEach(v => { const c = v.product?.categoryId; if (c) catScores[c] = (catScores[c] || 0) + 1; });
  const topCategories = Object.entries(catScores).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id]) => id);

  const prefs = { categories: topCategories };
  await setCache(cacheKey, prefs, 3600);
  return prefs;
}

async function getTrendingScores() {
  const cacheKey = 'search:trending:scores';
  const cached = await getCache(cacheKey);
  if (cached) return cached;

  const since = new Date(Date.now() - 48 * 3600 * 1000);
  const [clicks, orders] = await Promise.all([
    prisma.searchClick.groupBy({ by: ['productId'], _count: { productId: true }, where: { createdAt: { gte: since } }, orderBy: { _count: { productId: 'desc' } }, take: 50 }),
    prisma.orderItem.groupBy({ by: ['productId'], _count: { productId: true }, where: { order: { createdAt: { gte: since } } }, orderBy: { _count: { productId: 'desc' } }, take: 50 }),
  ]);

  const scores = {};
  clicks.forEach(c => { scores[c.productId] = (scores[c.productId] || 0) + c._count.productId; });
  orders.forEach(o => { scores[o.productId] = (scores[o.productId] || 0) + o._count.productId * 3; });

  await setCache(cacheKey, scores, 1800);
  return scores;
}

// ── Seller trust scores (Fix 2: quality gate for cold start) ─────────────────
async function getSellerTrustScores() {
  const cacheKey = 'search:seller:trust';
  const cached = await getCache(cacheKey);
  if (cached) return cached;

  // Composite trust score: rating + fulfillment rate + dispute rate
  const sellers = await prisma.seller.findMany({
    where: { status: 'VERIFIED' },
    select: { id: true, rating: true, totalSales: true },
  });

  const scores = {};
  sellers.forEach(s => {
    // Normalize rating 0-5 → 0-1, weight by sales volume
    const ratingScore  = (s.rating || 0) / 5;
    const volumeBonus  = Math.min((s.totalSales || 0) / 100, 0.2); // max +0.2 for high volume
    scores[s.id] = Math.min(ratingScore + volumeBonus, 1.0);
  });

  await setCache(cacheKey, scores, 3600); // cache 1hr
  return scores;
}

// ── Exploration factor helpers ────────────────────────────────────────────────
// Fixes applied:
//   1. Exploration factor — prevents popular products dominating forever
//   2. Quality gate — cold start boost gated by min rating + seller trust
//   3. Score normalization — prevents any single signal from dominating
//   4. Performance — all signals pre-fetched in parallel, no blocking calls
// ═══════════════════════════════════════════════════════════════════════════

// Exploration factor: inject random products to prevent popularity lock-in
// ~10% of results are "explored" — gives new/niche products a chance
function shouldExplore(productId, seed) {
  // Deterministic pseudo-random based on product ID + daily seed
  // Same product gets same treatment within a day (consistent UX)
  const hash = (productId + seed).split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return (hash % 10) === 0; // 10% exploration rate
}

// Normalize a score map to 0-1 range to prevent signal dominance
function normalizeScores(scoreMap) {
  const values = Object.values(scoreMap);
  if (!values.length) return scoreMap;
  const max = Math.max(...values, 1);
  const normalized = {};
  Object.keys(scoreMap).forEach(k => { normalized[k] = scoreMap[k] / max; });
  return normalized;
}

function reRankResults(products, { clickScores, purchaseScores, trendingScores, userPrefs, sessionCtx, aiIntent, sellerTrustScores = {}, cvrScores = {}, externalTrafficScores = {} }) {
  // Daily seed for exploration consistency
  const dailySeed = new Date().toISOString().slice(0, 10);

  // Normalize all score maps to 0-1 range (Fix 3: prevents dominance)
  const normClicks    = normalizeScores(clickScores);
  const normPurchases = normalizeScores(purchaseScores);
  const normTrending  = normalizeScores(trendingScores);
  const normCVR       = normalizeScores(cvrScores);          // UPGRADE 1: CVR
  const normExternal  = normalizeScores(externalTrafficScores); // UPGRADE 3: External traffic

  return products
    .map(p => {
      // ── Fix 2: Quality gate — cold start boost only for quality products ──
      const meetsQualityBar = (p.rating || 0) >= 3.5 || (p.reviewCount || 0) === 0; // new products (0 reviews) pass
      const sellerTrust     = sellerTrustScores[p.sellerId] || 0.5; // 0-1, default 0.5
      const qualityMultiplier = meetsQualityBar ? (0.7 + sellerTrust * 0.3) : 0.3; // low quality = 30% score

      let score = 0;

      // ── Fix 1: Exploration factor — 10% of products get a random boost ──
      if (shouldExplore(p.id, dailySeed)) {
        score += 8; // exploration boost — gives non-popular products a chance
      }

      // ── UPGRADE 1: CVR Signal (Amazon A10 dominant factor, max 60) ──
      // CVR beats raw sales volume — a product converting 20% of viewers
      // ranks higher than one with more total sales but lower CVR
      score += (normCVR[p.id] || 0) * 60;

      // ── UPGRADE 3: External traffic signal (A10 principle, max 25) ──
      // Products bringing external traffic (social media, WhatsApp, Telegram)
      // get a significant organic ranking boost
      score += (normExternal[p.id] || 0) * 25;

      // ── Purchase signal (normalized, max 50) ──
      score += (normPurchases[p.id] || 0) * 50;

      // ── Click signal (normalized, max 20) ──
      score += (normClicks[p.id] || 0) * 20;

      // ── Trending (normalized, max 15) ──
      score += (normTrending[p.id] || 0) * 15;

      // ── UPGRADE 2: Ethiopian intent graph boost ──
      if (aiIntent) {
        // Intent graph boost (from COSMO-equivalent)
        if (aiIntent.boost) score += aiIntent.boost * 0.5;

        if (aiIntent.intent === 'bulk'    && (p.minOrder || 1) >= 5)                    score += 10;
        if (aiIntent.intent === 'cheap'   && p.comparePrice && p.price < p.comparePrice) score += 8;
        if (aiIntent.intent === 'organic' && p.isOrganic)                               score += 8;
        if (aiIntent.intent === 'fresh'   && p.isOrganic)                               score += 6;
        if (aiIntent.intent === 'fasting' && !['meat','chicken','beef','lamb'].some(m => p.name.toLowerCase().includes(m))) score += 8;
        if (aiIntent.intent === 'holiday') score += 5; // all products get a small boost during holidays
        if (aiIntent.priceSignal === 'low' && p.price < 50)                             score += 5;
        if (aiIntent.searchTerms?.some(t => p.name.toLowerCase().includes(t.toLowerCase()))) score += 12;
        // Amharic name match bonus
        if (aiIntent.searchTerms?.some(t => (p.nameAm || '').toLowerCase().includes(t.toLowerCase()))) score += 8;
      }

      // ── User personalization ──
      if (userPrefs.categories.includes(p.categoryId)) {
        score += Math.max(10 - userPrefs.categories.indexOf(p.categoryId) * 2, 2);
      }

      // ── Session context ──
      if (sessionCtx.recentCategories.includes(p.categoryId)) score += 8;
      if (sessionCtx.recentProducts.includes(p.id))           score += 5;

      // ── Fix 2: Cold start — gated by quality ──
      const coldBoost = getColdStartBoost(p);
      score += coldBoost * qualityMultiplier; // quality gate applied here

      // ── Quality signals ──
      score += Math.min((p.rating || 0) * 2, 10);
      score += Math.min((p.reviewCount || 0) * 0.1, 5);
      score += p.isOrganic ? 3 : 0;

      // ── Fix 2: Seller trust multiplier ──
      score *= qualityMultiplier;

      // ── Stock penalty ──
      if ((p.stock || 0) === 0)    score -= 100;
      else if ((p.stock || 0) < 5) score -= 5;

      return { ...p, _score: score };
    })
    .sort((a, b) => b._score - a._score)
    .map(({ _score, ...p }) => p);
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN SEARCH ENDPOINT
// ═══════════════════════════════════════════════════════════════════════════

exports.search = async (req, res, next) => {
  try {
    const { q, category, minPrice, maxPrice, sort = 'relevance', page = 1, limit = 20, isOrganic, sessionId, city } = req.query;
    if (!q || q.trim().length < 1) return res.json({ success: true, data: { products: [], sellers: [], categories: [], total: 0, sponsored: [] } });

    const query      = q.trim();
    const expanded   = expandQuery(query);
    const userId     = req.user?.id;
    const isFirstPage = parseInt(page) === 1;
    const doIntelligence = sort === 'relevance' && isFirstPage;

    // ── Parallel fetch all intelligence signals (Fix 4: all async, no blocking) ──
    const [clickScores, purchaseScores, trendingScores, userPrefs, sessionCtx, aiIntent, sponsored, sellerTrustScores, cvrScores, externalTrafficScores] = await Promise.all([
      doIntelligence ? getClickScores(query)                    : Promise.resolve({}),
      doIntelligence ? getPurchaseScores(query)                 : Promise.resolve({}),
      doIntelligence ? getTrendingScores()                      : Promise.resolve({}),
      doIntelligence && userId ? getUserPreferences(userId)     : Promise.resolve({ categories: [] }),
      doIntelligence && sessionId ? getSessionContext(sessionId): Promise.resolve({ recentCategories: [], recentProducts: [] }),
      doIntelligence ? interpretQueryWithAI(query)              : Promise.resolve(null),
      doIntelligence ? getSponsoredProducts(query, 2)           : Promise.resolve([]),
      doIntelligence ? getSellerTrustScores()                   : Promise.resolve({}),
      doIntelligence ? getCVRScores()                           : Promise.resolve({}),
      doIntelligence ? getExternalTrafficScores()               : Promise.resolve({}),
    ]);

    // ── Build search terms (AI-enhanced or synonym-expanded) ──
    let searchTerms = expanded;
    if (aiIntent?.searchTerms?.length) {
      searchTerms = [...new Set([...expanded.split(' '), ...aiIntent.searchTerms])].join(' ');
    }

    // ── Typesense search ──
    const tsResult = await searchProducts(searchTerms, {
      category, minPrice, maxPrice, isOrganic: isOrganic === 'true',
      sort: sort === 'price-asc' ? 'price:asc' : sort === 'price-desc' ? 'price:desc' : undefined,
      page: parseInt(page), limit: parseInt(limit),
    });

    let products, total;

    if (tsResult) {
      const ids = tsResult.data.map(d => d.id);
      const fullProducts = await prisma.product.findMany({
        where: { id: { in: ids } },
        include: { seller: { select: { storeName: true, storeSlug: true, rating: true } }, category: { select: { name: true, slug: true, emoji: true } } },
      });
      const ordered = ids.map(id => fullProducts.find(p => p.id === id)).filter(Boolean);
      products = doIntelligence
        ? reRankResults(ordered, { clickScores, purchaseScores, trendingScores, userPrefs, sessionCtx, aiIntent, sellerTrustScores, cvrScores, externalTrafficScores })
        : ordered;
      total = tsResult.total;
    } else {
      // DB fallback
      const skip  = (parseInt(page) - 1) * parseInt(limit);
      const terms = searchTerms.split(' ').slice(0, 6);
      const where = {
        status: 'ACTIVE',
        OR: terms.flatMap(term => [
          { name:        { contains: term, mode: 'insensitive' } },
          { nameAm:      { contains: term, mode: 'insensitive' } },
          { description: { contains: term, mode: 'insensitive' } },
          { tags:        { has: term.toLowerCase() } },
        ]),
      };
      if (category)             where.category = { slug: category };
      if (isOrganic === 'true') where.isOrganic = true;
      if (minPrice || maxPrice) { where.price = {}; if (minPrice) where.price.gte = parseFloat(minPrice); if (maxPrice) where.price.lte = parseFloat(maxPrice); }
      const orderBy = sort === 'price-asc' ? { price: 'asc' } : sort === 'price-desc' ? { price: 'desc' } : sort === 'rating' ? { rating: 'desc' } : { soldCount: 'desc' };
      [products, total] = await Promise.all([
        prisma.product.findMany({ where, skip, take: parseInt(limit), orderBy, include: { seller: { select: { storeName: true, storeSlug: true, rating: true } }, category: { select: { name: true, slug: true, emoji: true } } } }),
        prisma.product.count({ where }),
      ]);
      if (doIntelligence) {
        products = reRankResults(products, { clickScores, purchaseScores, trendingScores, userPrefs, sessionCtx, aiIntent, sellerTrustScores, cvrScores, externalTrafficScores });
      }
    }

    // ── Save session context for next search ──
    if (sessionId && products.length) {
      const topCats = [...new Set(products.slice(0, 5).map(p => p.categoryId).filter(Boolean))];
      saveSessionSearch(sessionId, query, products.slice(0, 5).map(p => p.id), topCats).catch(() => {});
    }

    // ── Sellers + categories ──
    const [sellers, categories] = await Promise.all([
      prisma.seller.findMany({ where: { status: 'VERIFIED', storeName: { contains: query, mode: 'insensitive' } }, take: 5, select: { id: true, storeName: true, storeSlug: true, logo: true, city: true, rating: true } }),
      prisma.category.findMany({ where: { isActive: true, name: { contains: query, mode: 'insensitive' } }, take: 5, select: { id: true, name: true, slug: true, emoji: true } }),
    ]);

    // ── Log search ──
    prisma.searchLog.create({ data: { userId, query, results: total } }).catch(() => {});

    // ── Track ad impressions (fire-and-forget) ──
    if (sponsored.length) {
      trackAdImpressions(sponsored.map((s) => s._adId).filter(Boolean)).catch(() => {});
    }

    res.json({
      success: true,
      data: {
        products,
        sponsored,                                          // Layer 5: paid results
        sellers, categories, total,
        aiIntent: aiIntent ? {
          intent: aiIntent.intent,
          priceSignal: aiIntent.priceSignal,
          source: aiIntent.source || 'ai',                 // 'intent_graph' or 'ai'
          terms: aiIntent.searchTerms?.slice(0, 3),        // show matched terms
        } : undefined,
        expandedQuery: expanded !== query ? expanded : undefined,
        pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) },
      },
    });
  } catch (err) { next(err); }
};

// ═══════════════════════════════════════════════════════════════════════════
// CLICK TRACKING — feeds the feedback loop
// ═══════════════════════════════════════════════════════════════════════════

exports.trackClick = async (req, res, next) => {
  try {
    const { query, productId, position, sessionId, city, adId } = req.body;
    if (!query || !productId) return res.json({ success: false });

    const userId = req.user?.id;

    // If sponsored click — record ad click + deduct budget
    if (adId) {
      recordAdClick(adId, userId, req.ip).catch(() => {});
    }

    // Increment Redis click score
    await incrClickScore(query, productId);

    // Persist to DB
    prisma.searchClick.create({
      data: { query: query.toLowerCase(), productId, userId, position: parseInt(position) || 1, sessionId, city },
    }).catch(() => {});

    // Invalidate trending cache
    if (isAvailable()) getRedis().del('search:trending:scores').catch(() => {});

    res.json({ success: true });
  } catch (err) { next(err); }
};

// ═══════════════════════════════════════════════════════════════════════════
// AUTOCOMPLETE — personalized
// ═══════════════════════════════════════════════════════════════════════════

exports.autocomplete = async (req, res, next) => {
  try {
    const { q } = req.query;
    if (!q || q.length < 2) return res.json({ success: true, data: [] });

    const userId   = req.user?.id;
    const cacheKey = `autocomplete:${q.toLowerCase()}:${userId || 'anon'}`;
    const cached   = await getCache(cacheKey);
    if (cached) return res.json(cached);

    const products = await prisma.product.findMany({
      where: { status: 'ACTIVE', OR: [{ name: { contains: q, mode: 'insensitive' } }, { nameAm: { contains: q, mode: 'insensitive' } }] },
      take: 12, select: { id: true, name: true, slug: true, price: true, unit: true, images: true, categoryId: true, soldCount: true, category: { select: { emoji: true } } },
      orderBy: { soldCount: 'desc' },
    });

    let sorted = products;
    if (userId && products.length > 3) {
      const prefs = await getUserPreferences(userId);
      if (prefs.categories.length) {
        sorted = [
          ...products.filter(p => prefs.categories.includes(p.categoryId)),
          ...products.filter(p => !prefs.categories.includes(p.categoryId)),
        ].slice(0, 8);
      }
    }

    const result = { success: true, data: sorted.slice(0, 8) };
    await setCache(cacheKey, result, TTL.AUTOCOMPLETE || 300);
    res.json(result);
  } catch (err) { next(err); }
};

// ═══════════════════════════════════════════════════════════════════════════
// TRENDING SEARCHES
// ═══════════════════════════════════════════════════════════════════════════

exports.getTrending = async (req, res, next) => {
  try {
    const cacheKey = KEYS.trending ? KEYS.trending() : 'search:trending';
    const cached   = await getCache(cacheKey);
    if (cached) return res.json(cached);

    const trending = await prisma.searchLog.groupBy({
      by: ['query'], _count: { query: true },
      orderBy: { _count: { query: 'desc' } }, take: 10,
      where: { createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
    });

    const result = { success: true, data: trending.map(t => ({ query: t.query, count: t._count.query })) };
    await setCache(cacheKey, result, TTL.TRENDING || 600);
    res.json(result);
  } catch (err) { next(err); }
};

// ═══════════════════════════════════════════════════════════════════════════
// SEARCH ANALYTICS (admin)
// ═══════════════════════════════════════════════════════════════════════════

exports.getSearchAnalytics = async (req, res, next) => {
  try {
    const { days = 7 } = req.query;
    const since = new Date(Date.now() - parseInt(days) * 24 * 3600 * 1000);

    const [topQueries, zeroResults, topClicked, ctrData] = await Promise.all([
      prisma.searchLog.groupBy({ by: ['query'], _count: { query: true }, _avg: { results: true }, where: { createdAt: { gte: since } }, orderBy: { _count: { query: 'desc' } }, take: 20 }),
      prisma.searchLog.groupBy({ by: ['query'], _count: { query: true }, where: { createdAt: { gte: since }, results: 0 }, orderBy: { _count: { query: 'desc' } }, take: 10 }),
      prisma.searchClick.groupBy({ by: ['productId'], _count: { productId: true }, where: { createdAt: { gte: since } }, orderBy: { _count: { productId: 'desc' } }, take: 10 }),
      prisma.searchClick.groupBy({ by: ['query'], _count: { query: true }, where: { createdAt: { gte: since } }, orderBy: { _count: { query: 'desc' } }, take: 20 }),
    ]);

    const productIds = topClicked.map(c => c.productId);
    const products   = await prisma.product.findMany({ where: { id: { in: productIds } }, select: { id: true, name: true, price: true } });
    const enriched   = topClicked.map(c => ({ ...c, product: products.find(p => p.id === c.productId) }));

    const searchCounts = {};
    topQueries.forEach(q => { searchCounts[q.query] = q._count.query; });
    const clickCounts = {};
    ctrData.forEach(c => { clickCounts[c.query] = c._count.query; });
    const ctrByQuery = Object.keys(searchCounts).map(q => ({
      query: q, searches: searchCounts[q], clicks: clickCounts[q] || 0,
      ctr: clickCounts[q] ? ((clickCounts[q] / searchCounts[q]) * 100).toFixed(1) + '%' : '0%',
    })).sort((a, b) => b.searches - a.searches);

    res.json({
      success: true,
      data: {
        topQueries:  topQueries.map(q => ({ query: q.query, count: q._count.query, avgResults: Math.round(q._avg.results || 0) })),
        zeroResults: zeroResults.map(q => ({ query: q.query, count: q._count.query })),
        topClicked:  enriched,
        ctrByQuery:  ctrByQuery.slice(0, 15),
        period:      `${days} days`,
      },
    });
  } catch (err) { next(err); }
};

// ═══════════════════════════════════════════════════════════════════════════
// UPGRADE 3: EXTERNAL TRAFFIC TRACKING ENDPOINT
// Called when a user arrives from an external source (social media, WhatsApp, Telegram)
// Stores the source in analytics events for ranking boost
// ═══════════════════════════════════════════════════════════════════════════

exports.trackExternalTraffic = async (req, res, next) => {
  try {
    const { productId, source, medium, campaign, referrer } = req.body;
    if (!productId) return res.json({ success: false });

    const userId = req.user?.id;

    // Validate source is actually external (not internal navigation)
    const externalSources = ['whatsapp', 'telegram', 'facebook', 'instagram', 'twitter', 'tiktok', 'email', 'sms', 'direct_link', 'social', 'referral'];
    const isExternal = externalSources.some(s =>
      (source || '').toLowerCase().includes(s) ||
      (referrer || '').toLowerCase().includes(s) ||
      (medium || '').toLowerCase().includes(s)
    );

    if (!isExternal && !source) return res.json({ success: false, message: 'Not an external source' });

    // Track as analytics event with source metadata
    await prisma.analyticsEvent.create({
      data: {
        type: 'PRODUCT_VIEW',
        userId: userId || null,
        productId,
        meta: {
          source: source || 'external',
          medium: medium || 'social',
          campaign: campaign || null,
          referrer: referrer || null,
          isExternal: true,
        },
      },
    }).catch(() => {});

    // Invalidate external traffic cache so ranking updates
    if (isAvailable()) {
      getRedis().del('search:external:traffic').catch(() => {});
    }

    res.json({ success: true });
  } catch (err) { next(err); }
};

// ═══════════════════════════════════════════════════════════════════════════
// INTENT GRAPH ENDPOINT — expose for frontend use
// Frontend can use this to show "Did you mean?" suggestions
// and to pre-populate search with seasonal/holiday context
// ═══════════════════════════════════════════════════════════════════════════

exports.getIntentGraph = async (req, res, next) => {
  try {
    const { q } = req.query;

    if (q) {
      // Return intent for a specific query (uses all 3 layers)
      const intent = await intentGraph.resolveIntent(q);
      return res.json({ success: true, data: intent });
    }

    // Return graph stats + current seasonal intents
    const stats = await intentGraph.getGraphStats();
    const currentMonth = new Date().getMonth() + 1;
    const seasonalMap = {
      1: ['ጥምቀት', 'timkat'], 4: ['ፋሲካ', 'fasika'],
      9: ['ዓዲስ ዓመት', 'enkutatash'], 10: ['irreechaa', 'irrecha'],
      12: ['ገና', 'gena'],
    };
    const seasonalKeys = seasonalMap[currentMonth] || [];
    const seasonalIntents = seasonalKeys.map(key => ({
      key, ...intentGraph.SEED[key],
    })).filter(Boolean);

    res.json({
      success: true,
      data: {
        ...stats,
        currentMonth,
        seasonalIntents,
        languages: ['Amharic (አማርኛ)', 'Afaan Oromo', 'Tigrinya', 'English', 'Mixed'],
        description: 'Self-learning intent graph. Starts with seed data, grows with every new query via Groq AI.',
      },
    });
  } catch (err) { next(err); }
};
