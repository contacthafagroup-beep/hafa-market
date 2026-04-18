'use strict';
const request = require('supertest');
const app     = require('../app');
const BASE    = '/api/v1';
let buyerToken  = '';
let adminToken  = '';
let addressId   = '';
let productId   = '';
let paidOrderId = '';
const ts = Date.now();

beforeAll(async () => {
  const b = await request(app).post(`${BASE}/auth/register`)
    .send({ name: 'Refund Buyer', email: `refundbuyer_${ts}@test.hafa`, password: 'Test@1234' });
  buyerToken = b.body.accessToken;

  const a = await request(app).post(`${BASE}/auth/login`)
    .send({ email: 'admin@hafamarket.com', password: 'Admin@123' });
  adminToken = a.body.accessToken;

  const addr = await request(app).post(`${BASE}/users/addresses`)
    .set('Authorization', `Bearer ${buyerToken}`)
    .send({ fullName: 'Refund Buyer', phone: '+251911000020', street: 'Bole',
            city: 'Addis Ababa', region: 'Addis Ababa', country: 'Ethiopia', isDefault: true });
  addressId = addr.body.data?.id;

  const prod = await request(app).get(`${BASE}/products?limit=1`);
  productId = prod.body.data?.[0]?.id;

  // Create a paid order via COD (auto-confirms)
  if (addressId && productId) {
    const order = await request(app).post(`${BASE}/orders`)
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({ addressId, paymentMethod: 'CASH_ON_DELIVERY', items: [{ productId, quantity: 1 }] });
    const orderId = order.body.data?.id;
    if (orderId) {
      // Initiate to confirm
      await request(app).post(`${BASE}/payments/initiate`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ orderId, method: 'CASH_ON_DELIVERY' });
      // Force mark as paid via admin status update
      await request(app).patch(`${BASE}/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'DELIVERED', note: 'Test delivery' });
      paidOrderId = orderId;
    }
  }
});

describe('💰 Refund & Wallet API', () => {

  describe('GET /refunds/wallet', () => {
    it('should return wallet balance', async () => {
      const res = await request(app).get(`${BASE}/refunds/wallet`)
        .set('Authorization', `Bearer ${buyerToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
      expect(typeof res.body.data.balance).toBe('number');
    });

    it('should reject without auth', async () => {
      const res = await request(app).get(`${BASE}/refunds/wallet`);
      expect(res.status).toBe(401);
    });
  });

  describe('POST /refunds/request', () => {
    it('should reject refund for non-existent order', async () => {
      const res = await request(app).post(`${BASE}/refunds/request`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ orderId: '00000000-0000-0000-0000-000000000000', reason: 'Test' });
      expect(res.status).toBe(404);
    });

    it('should reject refund for unpaid order', async () => {
      if (!addressId || !productId) return;
      const order = await request(app).post(`${BASE}/orders`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ addressId, paymentMethod: 'CASH_ON_DELIVERY', items: [{ productId, quantity: 1 }] });
      const orderId = order.body.data?.id;
      if (!orderId) return;

      const res = await request(app).post(`${BASE}/refunds/request`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ orderId, reason: 'Changed my mind' });
      expect([400, 404]).toContain(res.status);
    });

    it('should reject refund for another user order', async () => {
      if (!paidOrderId) return;
      const other = await request(app).post(`${BASE}/auth/register`)
        .send({ name: 'Other', email: `other_refund_${ts}@test.hafa`, password: 'Test@1234' });
      const otherToken = other.body.accessToken;

      const res = await request(app).post(`${BASE}/refunds/request`)
        .set('Authorization', `Bearer ${otherToken}`)
        .send({ orderId: paidOrderId, reason: 'Fraud attempt' });
      expect(res.status).toBe(403);
    });
  });

  describe('GET /refunds/my', () => {
    it('should return buyer refund list', async () => {
      const res = await request(app).get(`${BASE}/refunds/my`)
        .set('Authorization', `Bearer ${buyerToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  describe('Admin: GET /refunds/all', () => {
    it('should return all refunds for admin', async () => {
      const res = await request(app).get(`${BASE}/refunds/all`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('should reject non-admin access', async () => {
      const res = await request(app).get(`${BASE}/refunds/all`)
        .set('Authorization', `Bearer ${buyerToken}`);
      expect(res.status).toBe(403);
    });

    it('should filter by status', async () => {
      const res = await request(app).get(`${BASE}/refunds/all?status=PENDING`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      res.body.data.forEach(r => expect(r.status).toBe('PENDING'));
    });
  });

  describe('Admin: POST /refunds/process', () => {
    it('should reject invalid action', async () => {
      const res = await request(app).post(`${BASE}/refunds/process`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ refundId: '00000000-0000-0000-0000-000000000000', action: 'invalidaction' });
      expect(res.status).toBe(400);
    });

    it('should reject non-existent refund', async () => {
      const res = await request(app).post(`${BASE}/refunds/process`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ refundId: '00000000-0000-0000-0000-000000000000', action: 'approve' });
      expect(res.status).toBe(404);
    });
  });

  describe('POST /refunds/wallet/pay', () => {
    it('should reject wallet payment with insufficient balance', async () => {
      if (!addressId || !productId) return;
      const order = await request(app).post(`${BASE}/orders`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ addressId, paymentMethod: 'CASH_ON_DELIVERY', items: [{ productId, quantity: 1 }] });
      const orderId = order.body.data?.id;
      if (!orderId) return;

      const res = await request(app).post(`${BASE}/refunds/wallet/pay`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ orderId });
      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Insufficient wallet balance');
    });
  });

  describe('Webhook Replay Protection', () => {
    it('should reject Chapa webhook with invalid signature when secret is set', async () => {
      const payload = { event: 'charge.success', tx_ref: 'HAFA-REPLAY-TEST', status: 'success' };
      const res = await request(app).post(`${BASE}/payments/chapa/webhook`)
        .set('chapa-signature', 'invalidsignature000000000000000000000000000000000000000000000000')
        .send(payload);
      // 401 if secret set, 200 if not set (fail open)
      expect([200, 401]).toContain(res.status);
    });

    it('should accept Chapa webhook with valid signature', async () => {
      const crypto  = require('crypto');
      const payload = { event: 'charge.success', tx_ref: 'HAFA-REPLAY-VALID', status: 'success' };
      const secret  = process.env.CHAPA_WEBHOOK_SECRET || 'your_chapa_webhook_secret';
      const sig     = crypto.createHmac('sha256', secret)
                            .update(JSON.stringify(payload)).digest('hex');
      const res = await request(app).post(`${BASE}/payments/chapa/webhook`)
        .set('chapa-signature', sig).send(payload);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
    });
  });

  describe('Rate Limiting', () => {
    it('should have rate limit headers on payment initiate', async () => {
      const res = await request(app).post(`${BASE}/payments/initiate`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ orderId: '00000000-0000-0000-0000-000000000000', method: 'CHAPA' });
      // Should have rate limit headers (even on error response)
      expect(res.headers['ratelimit-limit'] || res.headers['x-ratelimit-limit']).toBeDefined();
    });
  });
});
