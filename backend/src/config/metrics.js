'use strict';
const client = require('prom-client');

// ===== REGISTRY =====
const register = new client.Registry();
register.setDefaultLabels({ app: 'hafa-market-api', env: process.env.NODE_ENV || 'development' });

// Collect default Node.js metrics (memory, CPU, event loop lag, etc.)
client.collectDefaultMetrics({ register, prefix: 'hafa_' });

// ===== CUSTOM METRICS =====

// HTTP request duration histogram
const httpDuration = new client.Histogram({
  name: 'hafa_http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [register],
});

// HTTP request counter
const httpRequests = new client.Counter({
  name: 'hafa_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

// Active connections gauge
const activeConnections = new client.Gauge({
  name: 'hafa_active_connections',
  help: 'Number of active HTTP connections',
  registers: [register],
});

// Cache hit/miss counters
const cacheHits = new client.Counter({
  name: 'hafa_cache_hits_total',
  help: 'Total Redis cache hits',
  registers: [register],
});
const cacheMisses = new client.Counter({
  name: 'hafa_cache_misses_total',
  help: 'Total Redis cache misses',
  registers: [register],
});

// Orders counter
const ordersTotal = new client.Counter({
  name: 'hafa_orders_total',
  help: 'Total orders placed',
  labelNames: ['status', 'payment_method'],
  registers: [register],
});

// Revenue gauge
const revenueTotal = new client.Gauge({
  name: 'hafa_revenue_total_usd',
  help: 'Total revenue in USD',
  registers: [register],
});

// Queue job counters
const queueJobs = new client.Counter({
  name: 'hafa_queue_jobs_total',
  help: 'Total background jobs processed',
  labelNames: ['queue', 'status'],
  registers: [register],
});

// ===== MIDDLEWARE =====
function metricsMiddleware(req, res, next) {
  // Skip metrics endpoint itself
  if (req.path === '/metrics') return next();

  activeConnections.inc();
  const end = httpDuration.startTimer();
  const startTime = Date.now();

  res.on('finish', () => {
    activeConnections.dec();
    // Normalize route (replace UUIDs and IDs with :id)
    const route = req.route?.path
      ? `${req.baseUrl}${req.route.path}`
      : req.path.replace(/\/[0-9a-f-]{36}/gi, '/:id').replace(/\/\d+/g, '/:id');

    const labels = { method: req.method, route, status_code: res.statusCode };
    end(labels);
    httpRequests.inc(labels);
  });

  next();
}

// ===== METRICS ENDPOINT =====
async function metricsHandler(req, res) {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
}

module.exports = {
  register, metricsMiddleware, metricsHandler,
  metrics: { httpDuration, httpRequests, activeConnections, cacheHits, cacheMisses, ordersTotal, revenueTotal, queueJobs },
};
