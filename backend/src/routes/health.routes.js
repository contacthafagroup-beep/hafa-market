'use strict';
const router = require('express').Router();
const prisma = require('../config/prisma');
const { isAvailable, getCacheStats, getRedisInfo } = require('../config/redis');
const os = require('os');

const START_TIME = Date.now();

// ===== BASIC HEALTH (for load balancers / k8s liveness probe) =====
router.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'Hafa Market API', timestamp: new Date().toISOString() });
});

// ===== DETAILED HEALTH (for monitoring dashboards) =====
router.get('/detailed', async (req, res) => {
  const checks = {};
  let overallStatus = 'healthy';

  // --- Database ---
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = { status: 'healthy', latency: null };
    const dbStart = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    checks.database.latency = `${Date.now() - dbStart}ms`;
  } catch (err) {
    checks.database = { status: 'unhealthy', error: err.message };
    overallStatus = 'degraded';
  }

  // --- Redis ---
  if (isAvailable()) {
    const info = await getRedisInfo();
    const cacheStats = getCacheStats();
    checks.redis = {
      status:    'healthy',
      memory:    info?.memory,
      keys:      info?.keys,
      hitRate:   cacheStats.hitRate,
    };
  } else {
    checks.redis = { status: 'unavailable', note: 'Running without cache' };
    // Redis being down is degraded, not unhealthy — app still works
    if (overallStatus === 'healthy') overallStatus = 'degraded';
  }

  // --- System ---
  const uptimeSeconds = Math.floor((Date.now() - START_TIME) / 1000);
  const memUsage = process.memoryUsage();
  checks.system = {
    uptime:      formatUptime(uptimeSeconds),
    uptimeSeconds,
    nodeVersion: process.version,
    platform:    process.platform,
    cpuCount:    os.cpus().length,
    memory: {
      heapUsed:  `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
      rss:       `${Math.round(memUsage.rss / 1024 / 1024)}MB`,
      external:  `${Math.round(memUsage.external / 1024 / 1024)}MB`,
    },
    loadAvg: os.loadavg().map(v => v.toFixed(2)),
  };

  // --- App ---
  checks.app = {
    name:        'Hafa Market API',
    version:     process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    port:        process.env.PORT || 5000,
  };

  const statusCode = overallStatus === 'healthy' ? 200
                   : overallStatus === 'degraded' ? 200
                   : 503;

  res.status(statusCode).json({
    status: overallStatus,
    timestamp: new Date().toISOString(),
    checks,
  });
});

// ===== READINESS PROBE (k8s — is app ready to serve traffic?) =====
router.get('/ready', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ready: true });
  } catch {
    res.status(503).json({ ready: false, reason: 'Database not reachable' });
  }
});

// ===== LIVENESS PROBE (k8s — is app alive?) =====
router.get('/live', (req, res) => {
  res.json({ alive: true, uptime: process.uptime().toFixed(0) + 's' });
});

function formatUptime(seconds) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${d}d ${h}h ${m}m ${s}s`;
}

module.exports = router;
