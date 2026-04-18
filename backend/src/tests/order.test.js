'use strict';
const request = require('supertest');
const app = require('../app');

const BASE = '/api/v1';
let buyerToken = '';
let addressId = '';
let productId = '';
let orderId = '';
let adminToken = '';
const ts = Date.now();

beforeAll(async () => {
  // Register buyer
  const buyerRes = await request(app).post(`${BASE}/auth/register`)
    .send({ name: 'Order Buyer', email: `ordbuyer_${ts}@test.hafa`, password: 'Test@1234' });
  buyerToken = buyerRes.body.accessToken;

  // Admin token
  const adminRes = await request(app).post(`${BASE}/auth/login`)
    .send({ email: 'admin@hafamarket.com', password: 'Admin@123' });
  adminToken = adminRes.body.accessToken;

  // Add address
  const addrRes = await request(app).post(`${BASE}/users/addresses`)
    .set('Authorization', `Bearer ${buyerToken}`)
    .send({ fullName: 'Order Buyer', phone: '+254700000001', street: '123 Test St',
            city: 'Nairobi', region: 'Nairobi', country: 'Kenya', isDefault: true });
  addressId = addrRes.body.data?.id;

  // Get a product
  const prodRes = await request(app).get(`${BASE}/products?limit=1`);
  productId = prodRes.body.data?.[0]?.id;
});

describe('🛒 Orders API', () => {

  // ===== CREATE ORDER =====
  describe('POST /orders', () => {
    it('should place an order successfully', async () => {
      if (!addressId || !productId) return;
      const res = await request(app).post(`${BASE}/orders`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({
          addressId,
          paymentMethod: 'CASH_ON_DELIVERY',
          items: [{ productId, quantity: 1 }],
        });
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('PENDING');
      expect(res.body.data.payment).toBeDefined();
      orderId = res.body.data.id;
    });

    it('should apply promo code HAFA10', async () => {
      if (!addressId || !productId) return;
      const res = await request(app).post(`${BASE}/orders`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({
          addressId,
          paymentMethod: 'CASH_ON_DELIVERY',
          items: [{ productId, quantity: 1 }],
          promoCode: 'HAFA10',
        });
      expect(res.status).toBe(201);
      expect(res.body.data.discount).toBeGreaterThanOrEqual(0);
    });

    it('should reject order without auth', async () => {
      const res = await request(app).post(`${BASE}/orders`)
        .send({ addressId, paymentMethod: 'CASH_ON_DELIVERY', items: [{ productId, quantity: 1 }] });
      expect(res.status).toBe(401);
    });

    it('should reject empty items array', async () => {
      const res = await request(app).post(`${BASE}/orders`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ addressId, paymentMethod: 'CASH_ON_DELIVERY', items: [] });
      expect(res.status).toBe(400);
    });

    it('should reject invalid payment method', async () => {
      const res = await request(app).post(`${BASE}/orders`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ addressId, paymentMethod: 'BITCOIN', items: [{ productId, quantity: 1 }] });
      expect(res.status).toBe(400);
    });
  });

  // ===== GET ORDERS =====
  describe('GET /orders', () => {
    it('should return user orders', async () => {
      const res = await request(app).get(`${BASE}/orders`)
        .set('Authorization', `Bearer ${buyerToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('should filter by status', async () => {
      const res = await request(app).get(`${BASE}/orders?status=PENDING`)
        .set('Authorization', `Bearer ${buyerToken}`);
      expect(res.status).toBe(200);
      res.body.data.forEach(o => expect(o.status).toBe('PENDING'));
    });

    it('should reject without auth', async () => {
      const res = await request(app).get(`${BASE}/orders`);
      expect(res.status).toBe(401);
    });
  });

  // ===== GET SINGLE ORDER =====
  describe('GET /orders/:id', () => {
    it('should return order by id', async () => {
      if (!orderId) return;
      const res = await request(app).get(`${BASE}/orders/${orderId}`)
        .set('Authorization', `Bearer ${buyerToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(orderId);
    });

    it('should reject access to another user order', async () => {
      if (!orderId) return;
      const otherRes = await request(app).post(`${BASE}/auth/register`)
        .send({ name: 'Other', email: `other_${ts}@test.hafa`, password: 'Test@1234' });
      const otherToken = otherRes.body.accessToken;
      const res = await request(app).get(`${BASE}/orders/${orderId}`)
        .set('Authorization', `Bearer ${otherToken}`);
      expect(res.status).toBe(403);
    });
  });

  // ===== CANCEL ORDER =====
  describe('PATCH /orders/:id/cancel', () => {
    it('should cancel a pending order', async () => {
      if (!orderId) return;
      const res = await request(app).patch(`${BASE}/orders/${orderId}/cancel`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ reason: 'Changed my mind' });
      expect(res.status).toBe(200);
    });

    it('should reject cancelling already cancelled order', async () => {
      if (!orderId) return;
      const res = await request(app).patch(`${BASE}/orders/${orderId}/cancel`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ reason: 'Again' });
      expect(res.status).toBe(400);
    });
  });
});
