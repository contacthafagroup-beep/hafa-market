'use strict';
const { getRedis, isAvailable } = require('../config/redis');
const prisma = require('../config/prisma');
const logger = require('../config/logger');

const RESERVE_TTL = 600; // 10 minutes

// Reserve stock during checkout — prevents overselling
async function reserveStock(userId, items) {
  if (!isAvailable()) return true; // skip if Redis unavailable

  const redis = getRedis();
  const reserved = [];

  try {
    for (const item of items) {
      const key = `inventory:reserve:${item.productId}`;
      // Get current reservations
      const currentReserved = parseInt(await redis.get(key) || '0');
      // Get actual stock
      const product = await prisma.product.findUnique({ where: { id: item.productId }, select: { stock: true, name: true } });
      if (!product) throw new Error(`Product ${item.productId} not found`);

      const available = product.stock - currentReserved;
      if (available < item.quantity) {
        throw new Error(`Insufficient stock for "${product.name}". Available: ${available}`);
      }

      // Increment reservation
      await redis.incrBy(key, item.quantity);
      await redis.expire(key, RESERVE_TTL);
      reserved.push({ key, quantity: item.quantity });
    }
    return true;
  } catch (err) {
    // Rollback reservations made so far
    const redis2 = getRedis();
    for (const r of reserved) {
      await redis2.decrBy(r.key, r.quantity).catch(() => {});
    }
    throw err;
  }
}

// Release reservation (on payment failure or timeout)
async function releaseReservation(items) {
  if (!isAvailable()) return;
  const redis = getRedis();
  for (const item of items) {
    const key = `inventory:reserve:${item.productId}`;
    await redis.decrBy(key, item.quantity).catch(() => {});
  }
}

// Confirm reservation (on payment success — already decremented in DB)
async function confirmReservation(items) {
  if (!isAvailable()) return;
  const redis = getRedis();
  for (const item of items) {
    const key = `inventory:reserve:${item.productId}`;
    await redis.decrBy(key, item.quantity).catch(() => {});
  }
}

// Background job: release expired reservations
async function releaseExpiredReservations() {
  if (!isAvailable()) return;
  // Redis TTL handles expiry automatically — this is just for logging
  logger.debug('Inventory: expired reservations auto-released by Redis TTL');
}

// Check available stock (actual - reserved)
async function getAvailableStock(productId) {
  const product = await prisma.product.findUnique({ where: { id: productId }, select: { stock: true } });
  if (!product) return 0;
  if (!isAvailable()) return product.stock;
  const reserved = parseInt(await getRedis().get(`inventory:reserve:${productId}`) || '0');
  return Math.max(0, product.stock - reserved);
}

module.exports = { reserveStock, releaseReservation, confirmReservation, getAvailableStock };
