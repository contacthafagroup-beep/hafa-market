'use strict';
const { createClient } = require('redis');
const logger = require('./logger');

// ===== STATE =====
let client = null;
let isConnected = false;
let reconnectAttempts = 0;
const MAX_RECONNECT = 10;

// ===== CACHE TTL CONSTANTS (seconds) =====
const TTL = {
  CATEGORIES:    3600,   // 1 hour  — rarely changes
  PRODUCT:        300,   // 5 min   — product detail
  PRODUCTS_LIST:  120,   // 2 min   — product listings
  FEATURED:       600,   // 10 min  — featured products
  SEARCH:          60,   // 1 min   — search results
  AUTOCOMPLETE:   300,   // 5 min   — autocomplete
  TRENDING:      3600,   // 1 hour  — trending searches
  SELLER_STORE:   300,   // 5 min   — seller public page
  BANNERS:       1800,   // 30 min  — homepage banners
  DELIVERY_ZONES:7200,   // 2 hours — delivery zones
  SESSION:       1800,   // 30 min  — user sessions
};

// ===== CACHE KEY PREFIXES =====
const KEYS = {
  category:      (id)   => `cat:${id}`,
  categories:    ()     => 'categories:all',
  product:       (slug) => `product:${slug}`,
  products:      (hash) => `products:${hash}`,
  featured:      ()     => 'products:featured',
  search:        (q)    => `search:${q}`,
  autocomplete:  (q)    => `autocomplete:${q}`,
  trending:      ()     => 'search:trending',
  seller:        (slug) => `seller:${slug}`,
  banners:       ()     => 'banners:active',
  deliveryZones: ()     => 'delivery:zones',
};

// ===== STATS TRACKING =====
const stats = { hits: 0, misses: 0, errors: 0, sets: 0, deletes: 0 };

// ===== CONNECT =====
async function connectRedis() {
  try {
    client = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      socket: {
        connectTimeout: 5000,
        reconnectStrategy: (attempts) => {
          reconnectAttempts = attempts;
          if (attempts > MAX_RECONNECT) {
            logger.warn(`⚠️  Redis: max reconnect attempts (${MAX_RECONNECT}) reached. Running without cache.`);
            isConnected = false;
            return false; // stop retrying
          }
          const delay = Math.min(attempts * 200, 3000);
          logger.info(`Redis reconnecting in ${delay}ms (attempt ${attempts})`);
          return delay;
        },
      },
    });

    client.on('connect',       () => { isConnected = true;  reconnectAttempts = 0; logger.info('✅ Redis connected'); });
    client.on('ready',         () => { isConnected = true;  logger.info('✅ Redis ready'); });
    client.on('error',         (err) => { isConnected = false; logger.warn(`Redis error: ${err.message}`); });
    client.on('end',           () => { isConnected = false; logger.warn('Redis connection closed'); });
    client.on('reconnecting',  () => logger.info('Redis reconnecting...'));

    await client.connect();
    isConnected = true;

    // Set memory policy to auto-evict least-recently-used keys when memory is full
    await client.configSet('maxmemory-policy', 'allkeys-lru').catch(() => {});
    await client.configSet('maxmemory', '256mb').catch(() => {});

  } catch (err) {
    isConnected = false;
    logger.warn(`⚠️  Redis unavailable — running without cache. (${err.message})`);
  }
}

// ===== SAFE WRAPPER =====
function isAvailable() {
  return isConnected && client !== null;
}

// ===== SET CACHE =====
async function setCache(key, value, ttlSeconds = TTL.PRODUCTS_LIST) {
  if (!isAvailable()) return false;
  try {
    await client.setEx(key, ttlSeconds, JSON.stringify(value));
    stats.sets++;
    return true;
  } catch (err) {
    stats.errors++;
    logger.warn(`Redis SET error [${key}]: ${err.message}`);
    return false;
  }
}

// ===== GET CACHE =====
async function getCache(key) {
  if (!isAvailable()) { stats.misses++; return null; }
  try {
    const data = await client.get(key);
    if (data) {
      stats.hits++;
      return JSON.parse(data);
    }
    stats.misses++;
    return null;
  } catch (err) {
    stats.errors++;
    stats.misses++;
    logger.warn(`Redis GET error [${key}]: ${err.message}`);
    return null;
  }
}

// ===== DELETE CACHE =====
async function delCache(key) {
  if (!isAvailable()) return false;
  try {
    await client.del(key);
    stats.deletes++;
    return true;
  } catch (err) {
    stats.errors++;
    logger.warn(`Redis DEL error [${key}]: ${err.message}`);
    return false;
  }
}

// ===== DELETE BY PATTERN =====
async function delCachePattern(pattern) {
  if (!isAvailable()) return 0;
  try {
    // Use SCAN instead of KEYS for production safety (non-blocking)
    let cursor = 0;
    let deleted = 0;
    do {
      const result = await client.scan(cursor, { MATCH: pattern, COUNT: 100 });
      cursor = result.cursor;
      if (result.keys.length) {
        await client.del(result.keys);
        deleted += result.keys.length;
      }
    } while (cursor !== 0);

    if (deleted > 0) {
      stats.deletes += deleted;
      logger.debug(`Redis: deleted ${deleted} keys matching "${pattern}"`);
    }
    return deleted;
  } catch (err) {
    stats.errors++;
    logger.warn(`Redis SCAN/DEL error [${pattern}]: ${err.message}`);
    return 0;
  }
}

// ===== INVALIDATE PRODUCT CACHE =====
async function invalidateProduct(slug) {
  await Promise.all([
    delCache(KEYS.product(slug)),
    delCachePattern('products:*'),
    delCache(KEYS.featured()),
  ]);
  logger.debug(`Cache invalidated for product: ${slug}`);
}

// ===== INVALIDATE CATEGORY CACHE =====
async function invalidateCategory() {
  await Promise.all([
    delCache(KEYS.categories()),
    delCachePattern('products:*'),
    delCache(KEYS.featured()),
  ]);
  logger.debug('Cache invalidated for categories');
}

// ===== INVALIDATE SELLER CACHE =====
async function invalidateSeller(slug) {
  await Promise.all([
    delCache(KEYS.seller(slug)),
    delCachePattern('products:*'),
  ]);
  logger.debug(`Cache invalidated for seller: ${slug}`);
}

// ===== GET CACHE STATS =====
function getCacheStats() {
  const total = stats.hits + stats.misses;
  const hitRate = total > 0 ? ((stats.hits / total) * 100).toFixed(1) : '0.0';
  return {
    ...stats,
    total,
    hitRate: `${hitRate}%`,
    connected: isConnected,
    reconnectAttempts,
  };
}

// ===== GET REDIS INFO =====
async function getRedisInfo() {
  if (!isAvailable()) return null;
  try {
    const info = await client.info('memory');
    const keyCount = await client.dbSize();
    const memMatch = info.match(/used_memory_human:(.+)/);
    return {
      memory: memMatch ? memMatch[1].trim() : 'unknown',
      keys: keyCount,
      connected: isConnected,
    };
  } catch (err) {
    return null;
  }
}

// ===== FLUSH ALL (dev only) =====
async function flushAll() {
  if (!isAvailable()) return false;
  if (process.env.NODE_ENV === 'production') {
    logger.error('flushAll() blocked in production!');
    return false;
  }
  await client.flushAll();
  Object.keys(stats).forEach(k => stats[k] = 0);
  logger.info('Redis cache flushed (dev)');
  return true;
}

// ===== GET CLIENT =====
function getRedis() { return client; }

module.exports = {
  connectRedis, getRedis, isAvailable,
  setCache, getCache, delCache, delCachePattern,
  invalidateProduct, invalidateCategory, invalidateSeller,
  getCacheStats, getRedisInfo, flushAll,
  TTL, KEYS,
};
