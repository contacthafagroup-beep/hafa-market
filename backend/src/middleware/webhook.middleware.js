'use strict';
const crypto = require('crypto');
const logger = require('../config/logger');
const { getRedis, isAvailable } = require('../config/redis');

// ===== WEBHOOK TIMESTAMP VALIDATION =====
// Prevents replay attacks by rejecting webhooks older than MAX_AGE_SECONDS
const MAX_AGE_SECONDS = 300; // 5 minutes

function validateWebhookTimestamp(timestamp, toleranceSeconds = MAX_AGE_SECONDS) {
  if (!timestamp) return { valid: false, reason: 'Missing timestamp' };
  const ts  = parseInt(timestamp, 10);
  const now = Math.floor(Date.now() / 1000);
  const age = Math.abs(now - ts);
  if (age > toleranceSeconds) {
    return { valid: false, reason: `Webhook timestamp too old: ${age}s (max ${toleranceSeconds}s)` };
  }
  return { valid: true, age };
}

// ===== REPLAY NONCE STORE =====
// Stores seen webhook nonces in Redis to prevent exact replay
async function checkReplayNonce(nonce, ttlSeconds = 600) {
  if (!nonce) return true; // no nonce = allow (can't check)
  if (!isAvailable()) return true; // Redis down = fail open
  try {
    const redis  = getRedis();
    const key    = `webhook:nonce:${nonce}`;
    const result = await redis.set(key, '1', { NX: true, EX: ttlSeconds });
    return result === 'OK'; // OK = new nonce, null = replay
  } catch (err) {
    logger.warn(`Replay nonce check error: ${err.message}`);
    return true; // fail open
  }
}

// ===== SAFARICOM M-PESA IP WHITELIST =====
const MPESA_IPS = [
  '196.201.214.200','196.201.214.206','196.201.213.114',
  '196.201.214.207','196.201.214.208','196.201.213.44',
  '196.201.212.127','196.201.212.138','196.201.212.129',
  '196.201.212.136','196.201.212.74', '196.201.212.69',
  '::1','127.0.0.1','::ffff:127.0.0.1',
];

exports.mpesaIpWhitelist = (req, res, next) => {
  if (process.env.NODE_ENV !== 'production') return next();
  const clientIp = (req.ip || req.connection?.remoteAddress || '').replace('::ffff:', '');
  if (!MPESA_IPS.includes(clientIp)) {
    logger.warn(`M-Pesa callback blocked from IP: ${clientIp}`);
    return res.status(403).json({ ResultCode: 1, ResultDesc: 'Forbidden' });
  }
  next();
};

// ===== FLUTTERWAVE SIGNATURE + REPLAY =====
exports.flutterwaveSignature = async (req, res, next) => {
  const hash = req.headers['verif-hash'];
  if (!hash || hash !== process.env.FLW_ENCRYPTION_KEY) {
    logger.warn(`Flutterwave webhook invalid signature from ${req.ip}`);
    return res.status(401).json({ error: 'Invalid signature' });
  }

  // Replay protection via event ID
  const eventId = req.body?.data?.id ? String(req.body.data.id) : null;
  if (eventId) {
    const isNew = await checkReplayNonce(`flw:${eventId}`);
    if (!isNew) {
      logger.info(`Flutterwave replay blocked: event_id=${eventId}`);
      return res.json({ status: 'ok' }); // 200 to prevent retries
    }
  }
  next();
};

// ===== STRIPE SIGNATURE =====
exports.stripeSignature = (req, res, next) => {
  const sig = req.headers['stripe-signature'];
  if (!sig) {
    logger.warn(`Stripe webhook missing signature from ${req.ip}`);
    return res.status(400).json({ error: 'Missing stripe-signature header' });
  }

  // Stripe embeds timestamp in signature — validate age
  try {
    const parts = sig.split(',');
    const tPart = parts.find(p => p.startsWith('t='));
    if (tPart) {
      const ts = tPart.slice(2);
      const check = validateWebhookTimestamp(ts, 300);
      if (!check.valid) {
        logger.warn(`Stripe webhook replay attempt: ${check.reason} from ${req.ip}`);
        return res.status(400).json({ error: `Webhook ${check.reason}` });
      }
    }
  } catch (_) {}
  next();
};

// ===== CHAPA SIGNATURE + TIMESTAMP + REPLAY =====
exports.chapaWebhookMiddleware = async (req, res, next) => {
  const chapaSignature = req.headers['chapa-signature'] || req.headers['x-chapa-signature'];

  if (process.env.CHAPA_WEBHOOK_SECRET) {
    if (!chapaSignature) {
      logger.warn(`Chapa webhook missing signature from ${req.ip}`);
      return res.status(401).json({ error: 'Missing signature' });
    }
    const payload  = JSON.stringify(req.body);
    const expected = crypto.createHmac('sha256', process.env.CHAPA_WEBHOOK_SECRET)
                           .update(payload).digest('hex');
    if (!crypto.timingSafeEqual(
      Buffer.from(chapaSignature.padEnd(64, '0')),
      Buffer.from(expected.padEnd(64, '0'))
    )) {
      logger.warn(`Chapa webhook invalid signature from ${req.ip}`);
      return res.status(401).json({ error: 'Invalid signature' });
    }
  }

  // Timestamp validation (if Chapa sends it)
  const ts = req.headers['x-chapa-timestamp'] || req.body?.timestamp;
  if (ts) {
    const check = validateWebhookTimestamp(ts);
    if (!check.valid) {
      logger.warn(`Chapa webhook replay attempt: ${check.reason} from ${req.ip}`);
      return res.status(400).json({ error: check.reason });
    }
  }

  // Replay protection via tx_ref
  const txRef = req.body?.tx_ref;
  if (txRef) {
    const isNew = await checkReplayNonce(`chapa:${txRef}:${req.body?.status}`);
    if (!isNew) {
      logger.info(`Chapa replay blocked: tx_ref=${txRef}`);
      return res.json({ status: 'ok' });
    }
  }

  next();
};

// ===== GENERIC HMAC VERIFIER =====
exports.verifyHmac = (secret, headerName = 'x-signature') => (req, res, next) => {
  const signature = req.headers[headerName];
  if (!signature) return res.status(401).json({ error: 'Missing signature' });
  const payload  = JSON.stringify(req.body);
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  try {
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
      logger.warn(`HMAC verification failed from ${req.ip}`);
      return res.status(401).json({ error: 'Invalid signature' });
    }
  } catch {
    return res.status(401).json({ error: 'Invalid signature' });
  }
  next();
};
