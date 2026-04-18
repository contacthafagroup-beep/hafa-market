'use strict';
const { getCache, setCache, getCacheStats, TTL } = require('../config/redis');
const logger = require('../config/logger');

/**
 * Generic cache middleware — wraps any GET route with Redis caching.
 * Usage: router.get('/path', cache(TTL.PRODUCTS_LIST, keyFn), handler)
 *
 * @param {number} ttl - seconds to cache
 * @param {function} keyFn - (req) => string — builds the cache key from request
 */
function cache(ttl = TTL.PRODUCTS_LIST, keyFn) {
  return async (req, res, next) => {
    // Only cache GET requests
    if (req.method !== 'GET') return next();

    const key = keyFn ? keyFn(req) : `route:${req.originalUrl}`;

    try {
      const cached = await getCache(key);
      if (cached) {
        // Add cache header so client knows it's a cache hit
        res.setHeader('X-Cache', 'HIT');
        res.setHeader('X-Cache-Key', key);
        return res.json(cached);
      }
      res.setHeader('X-Cache', 'MISS');

      // Intercept res.json to cache the response
      const originalJson = res.json.bind(res);
      res.json = async (body) => {
        if (res.statusCode === 200 && body?.success) {
          await setCache(key, body, ttl);
        }
        return originalJson(body);
      };

      next();
    } catch (err) {
      logger.warn(`Cache middleware error: ${err.message}`);
      next();
    }
  };
}

/**
 * Log cache stats periodically to the logger (every N requests)
 */
let requestCount = 0;
const LOG_EVERY = 100;

function cacheStatsLogger(req, res, next) {
  requestCount++;
  if (requestCount % LOG_EVERY === 0) {
    const stats = getCacheStats();
    logger.info(`📊 Cache stats [${requestCount} reqs] — Hit rate: ${stats.hitRate} | Hits: ${stats.hits} | Misses: ${stats.misses} | Errors: ${stats.errors}`);
  }
  next();
}

module.exports = { cache, cacheStatsLogger };
