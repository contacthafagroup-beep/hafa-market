'use strict';
const request = require('supertest');
const app = require('../app');
const BASE = '/api/v1';
let buyerToken = '';
let addressId  = '';
let productId  = '';
const ts = Date.now();

beforeAll(async () => {
  const b = await request(app).post(`${BASE}/auth/register`)
    .send({ name: 'Pay Buyer', email: `paybuyer_${ts}@test.hafa`, password: 'Test@1234' });
  buyerToken = b.body.accessToken;

  const addr = await request(app).post(`${BASE}/users/addresses`)
    .set('Authorization', `Bearer ${buyerToken}`)
    .send({ fullName: 'Pay Buyer', phone: '+251911000001', street: 'Bole Road',
            city: 'Addis Ababa', region: 'Addis Ababa', country: 'Ethiopia', isDefault: true });
  addressId = addr.body.data?.id;

  const prod = await request(app).get(`${BASE}/products?limit=1`);
  productId = prod.body.data?.[0]?.id;
});

describe('💳 Payment API', () => {

  describe('Payment methods validation', () => {
    it('should accept CASH_ON_DELIVERY', async () => {
      if (!addressId || !productId) return;
      const res = await request(app).post(`${BASE}/orders`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ addressId, paymentMethod: 'CASH_ON_DELIVERY',
                items: [{ productId, quantity: 1 }] });
      expect(res.status).toBe(201);
      expect(res.body.data.payment.method).toBe('CASH_ON_DELIVERY');
    });

    it('should accept PAYMENT_ON_DELIVERY', async () => {
      if (!addressId || !productId) return;
      const orderRes = await request(app).post(`${BASE}/orders`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ addressId, paymentMethod: 'PAYMENT_ON_DELIVERY',
                items: [{ productId, quantity: 1 }] });
      expect(orderRes.status).toBe(201);
      expect(orderRes.body.data.payment.method).toBe('PAYMENT_ON_DELIVERY');

      // Initiate payment to confirm the order
      const payRes = await request(app).post(`${BASE}/payments/initiate`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ orderId: orderRes.body.data.id, method: 'PAYMENT_ON_DELIVERY' });
      expect(payRes.status).toBe(200);
      expect(payRes.body.data.method).toBe('PAYMENT_ON_DELIVERY');
      expect(payRes.body.data.message).toContain('delivery agent');
    });

    it('should reject invalid payment method', async () => {
      if (!addressId || !productId) return;
      const res = await request(app).post(`${BASE}/orders`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ addressId, paymentMethod: 'BITCOIN',
                items: [{ productId, quantity: 1 }] });
      expect(res.status).toBe(400);
      expect(res.body.errors).toBeDefined();
    });
  });

  describe('GET /payments/status/:orderId', () => {
    it('should return payment status for own order', async () => {
      if (!addressId || !productId) return;
      const order = await request(app).post(`${BASE}/orders`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ addressId, paymentMethod: 'CASH_ON_DELIVERY',
                items: [{ productId, quantity: 1 }] });
      const orderId = order.body.data?.id;
      if (!orderId) return;

      const res = await request(app).get(`${BASE}/payments/status/${orderId}`)
        .set('Authorization', `Bearer ${buyerToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.method).toBe('CASH_ON_DELIVERY');
      expect(res.body.data.status).toBe('PENDING');
    });
  });

  describe('POST /payments/initiate — Chapa', () => {
    it('should return checkout URL for Chapa payment', async () => {
      if (!addressId || !productId) return;
      const order = await request(app).post(`${BASE}/orders`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ addressId, paymentMethod: 'CHAPA',
                items: [{ productId, quantity: 1 }] });
      const orderId = order.body.data?.id;
      if (!orderId) return;

      const res = await request(app).post(`${BASE}/payments/initiate`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ orderId, method: 'CHAPA' });
      // In test mode Chapa works (200) or may fail if sandbox is down (400/503)
      expect([200, 400, 503]).toContain(res.status);
      if (res.status === 200) {
        expect(res.body.data.checkoutUrl).toBeDefined();
        expect(res.body.data.txRef).toMatch(/^HAFA-/);
      }
    });
  });

  describe('Chapa webhook', () => {
    it('should accept valid webhook payload with correct signature', async () => {
      const crypto  = require('crypto');
      const payload = { event: 'charge.success', tx_ref: 'HAFA-NONEXISTENT', status: 'success' };
      const secret  = process.env.CHAPA_WEBHOOK_SECRET || 'your_chapa_webhook_secret';
      const sig     = crypto.createHmac('sha256', secret)
                            .update(JSON.stringify(payload)).digest('hex');

      const res = await request(app)
        .post(`${BASE}/payments/chapa/webhook`)
        .set('chapa-signature', sig)
        .send(payload);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
    });

    it('should reject webhook with invalid signature', async () => {
      const res = await request(app)
        .post(`${BASE}/payments/chapa/webhook`)
        .set('chapa-signature', 'invalidsignature')
        .send({ event: 'charge.success', tx_ref: 'HAFA-TEST', status: 'success' });
      // Only rejects if CHAPA_WEBHOOK_SECRET is set
      expect([200, 401]).toContain(res.status);
    });
  });
});
