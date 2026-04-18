'use strict';
const request = require('supertest');
const app     = require('../app');
const BASE    = '/api/v1';
let buyerToken  = '';
let adminToken  = '';
let addressId   = '';
let productId   = '';
let orderId     = '';
let referenceCode = '';
const ts = Date.now();

beforeAll(async () => {
  const b = await request(app).post(`${BASE}/auth/register`)
    .send({ name: 'Bank Buyer', email: `bankbuyer_${ts}@test.hafa`, password: 'Test@1234' });
  buyerToken = b.body.accessToken;

  const a = await request(app).post(`${BASE}/auth/login`)
    .send({ email: 'admin@hafamarket.com', password: 'Admin@123' });
  adminToken = a.body.accessToken;

  const addr = await request(app).post(`${BASE}/users/addresses`)
    .set('Authorization', `Bearer ${buyerToken}`)
    .send({ fullName: 'Bank Buyer', phone: '+251911000010', street: 'Bole',
            city: 'Addis Ababa', region: 'Addis Ababa', country: 'Ethiopia', isDefault: true });
  addressId = addr.body.data?.id;

  const prod = await request(app).get(`${BASE}/products?limit=1`);
  productId = prod.body.data?.[0]?.id;
});

describe('🏦 Bank Transfer API', () => {

  describe('GET /bank-transfers/accounts', () => {
    it('should return all bank accounts', async () => {
      const res = await request(app).get(`${BASE}/bank-transfers/accounts`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data[0]).toHaveProperty('bankName');
      expect(res.body.data[0]).toHaveProperty('accountNumber');
      expect(res.body.data[0]).toHaveProperty('bankCode');
    });

    it('should filter by currency ETB', async () => {
      const res = await request(app).get(`${BASE}/bank-transfers/accounts?currency=ETB`);
      expect(res.status).toBe(200);
      res.body.data.forEach(b => expect(b.currency).toBe('ETB'));
    });

    it('should filter by currency KES', async () => {
      const res = await request(app).get(`${BASE}/bank-transfers/accounts?currency=KES`);
      expect(res.status).toBe(200);
      res.body.data.forEach(b => expect(b.currency).toBe('KES'));
    });
  });

  describe('POST /bank-transfers/initiate', () => {
    it('should initiate bank transfer and return reference code', async () => {
      if (!addressId || !productId) return;
      const order = await request(app).post(`${BASE}/orders`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ addressId, paymentMethod: 'BANK_TRANSFER',
                items: [{ productId, quantity: 1 }] });
      orderId = order.body.data?.id;
      if (!orderId) return;

      const res = await request(app).post(`${BASE}/bank-transfers/initiate`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ orderId, bankCode: 'CBE', currency: 'ETB' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.referenceCode).toMatch(/^HAFA-/);
      expect(res.body.data.bankDetails.bankName).toContain('Commercial Bank');
      expect(res.body.data.bankDetails.accountNumber).toBeDefined();
      expect(res.body.data.instructions).toBeDefined();
      referenceCode = res.body.data.referenceCode;
    });

    it('should reject invalid bank code', async () => {
      if (!orderId) return;
      const res = await request(app).post(`${BASE}/bank-transfers/initiate`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ orderId, bankCode: 'INVALID_BANK' });
      expect(res.status).toBe(400);
    });

    it('should reject without auth', async () => {
      const res = await request(app).post(`${BASE}/bank-transfers/initiate`)
        .send({ orderId, bankCode: 'CBE' });
      expect(res.status).toBe(401);
    });
  });

  describe('POST /bank-transfers/submit-proof', () => {
    it('should submit transfer proof', async () => {
      if (!referenceCode) return;
      const res = await request(app).post(`${BASE}/bank-transfers/submit-proof`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({
          referenceCode,
          senderName:    'Bank Buyer',
          senderAccount: '1000987654321',
          transferDate:  new Date().toISOString().split('T')[0],
          proofImageUrl: 'https://example.com/receipt.jpg',
          notes:         'Test transfer',
        });
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('SUBMITTED');
    });

    it('should reject invalid reference code', async () => {
      const res = await request(app).post(`${BASE}/bank-transfers/submit-proof`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ referenceCode: 'HAFA-INVALID-REF' });
      // 400 = invalid format, 404 = valid format but not found — both are correct rejections
      expect([400, 404]).toContain(res.status);
    });
  });

  describe('GET /bank-transfers/status/:referenceCode', () => {
    it('should return transfer status', async () => {
      if (!referenceCode) return;
      const res = await request(app).get(`${BASE}/bank-transfers/status/${referenceCode}`)
        .set('Authorization', `Bearer ${buyerToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.referenceCode).toBe(referenceCode);
      expect(res.body.data.status).toBe('SUBMITTED');
      expect(res.body.data.message).toBeDefined();
    });
  });

  describe('Admin: GET /bank-transfers/pending', () => {
    it('should return pending transfers for admin', async () => {
      const res = await request(app).get(`${BASE}/bank-transfers/pending`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('should reject non-admin access', async () => {
      const res = await request(app).get(`${BASE}/bank-transfers/pending`)
        .set('Authorization', `Bearer ${buyerToken}`);
      expect(res.status).toBe(403);
    });
  });

  describe('Admin: POST /bank-transfers/verify', () => {
    it('should approve a bank transfer', async () => {
      if (!referenceCode) return;
      const res = await request(app).post(`${BASE}/bank-transfers/verify`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ referenceCode, action: 'approve', notes: 'Verified by test admin' });
      expect(res.status).toBe(200);
      expect(res.body.message).toContain('approved');
    });

    it('should reject invalid action', async () => {
      const res = await request(app).post(`${BASE}/bank-transfers/verify`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ referenceCode: 'HAFA-FAKE', action: 'invalidaction' });
      expect(res.status).toBe(400);
    });
  });

  describe('GET /bank-transfers/chapa-banks', () => {
    it('should return Chapa supported banks', async () => {
      const res = await request(app).get(`${BASE}/bank-transfers/chapa-banks`);
      // May fail if Chapa key not set — accept 200 or 503
      expect([200, 503]).toContain(res.status);
      if (res.status === 200) {
        expect(Array.isArray(res.body.data)).toBe(true);
      }
    });
  });
});
