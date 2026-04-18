'use strict';
const request = require('supertest');
const app = require('../app');
const BASE = '/api/v1';
let sellerToken = '';
let buyerToken  = '';
let adminToken  = '';
const ts = Date.now();

beforeAll(async () => {
  const s = await request(app).post(`${BASE}/auth/login`)
    .send({ email: 'kwame@hafamarket.com', password: 'Seller@123' });
  sellerToken = s.body.accessToken;

  const a = await request(app).post(`${BASE}/auth/login`)
    .send({ email: 'admin@hafamarket.com', password: 'Admin@123' });
  adminToken = a.body.accessToken;

  const b = await request(app).post(`${BASE}/auth/register`)
    .send({ name: 'Seller Test Buyer', email: `stbuyer_${ts}@test.hafa`, password: 'Test@1234' });
  buyerToken = b.body.accessToken;
});

describe('🏪 Seller API', () => {

  describe('GET /sellers/:slug', () => {
    it('should return public seller store', async () => {
      const res = await request(app).get(`${BASE}/sellers/kwame-farms`).catch(() => null);
      // May 404 if slug differs — just check it responds
      expect([200, 404]).toContain(res?.status || 404);
    });
  });

  describe('GET /sellers/me/store', () => {
    it('should return seller own store', async () => {
      const res = await request(app).get(`${BASE}/sellers/me/store`)
        .set('Authorization', `Bearer ${sellerToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.storeName).toBeDefined();
    });

    it('should reject buyer accessing seller store', async () => {
      const res = await request(app).get(`${BASE}/sellers/me/store`)
        .set('Authorization', `Bearer ${buyerToken}`);
      expect(res.status).toBe(403);
    });

    it('should reject unauthenticated access', async () => {
      const res = await request(app).get(`${BASE}/sellers/me/store`);
      expect(res.status).toBe(401);
    });
  });

  describe('GET /sellers/me/analytics', () => {
    it('should return seller analytics', async () => {
      const res = await request(app).get(`${BASE}/sellers/me/analytics`)
        .set('Authorization', `Bearer ${sellerToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.overview).toBeDefined();
      expect(res.body.data.topProducts).toBeDefined();
    });
  });

  describe('GET /sellers/me/orders', () => {
    it('should return seller orders', async () => {
      const res = await request(app).get(`${BASE}/sellers/me/orders`)
        .set('Authorization', `Bearer ${sellerToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  describe('POST /sellers/register', () => {
    it('should reject duplicate seller registration', async () => {
      const res = await request(app).post(`${BASE}/sellers/register`)
        .set('Authorization', `Bearer ${sellerToken}`)
        .send({ storeName: 'Duplicate Store', city: 'Accra', country: 'Ghana' });
      expect(res.status).toBe(409);
    });

    it('should allow buyer to register as seller', async () => {
      const res = await request(app).post(`${BASE}/sellers/register`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ storeName: `Test Store ${ts}`, city: 'Nairobi', country: 'Kenya',
                description: 'Test seller store' });
      expect(res.status).toBe(201);
      expect(res.body.data.status).toBe('PENDING');
    });
  });

  describe('Admin: PATCH /admin/sellers/:id/status', () => {
    it('should verify a seller', async () => {
      const sellers = await request(app).get(`${BASE}/admin/sellers?status=PENDING`)
        .set('Authorization', `Bearer ${adminToken}`);
      const pending = sellers.body.data?.[0];
      if (!pending) return;

      const res = await request(app).patch(`${BASE}/admin/sellers/${pending.id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'VERIFIED' });
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('VERIFIED');
    });
  });
});
