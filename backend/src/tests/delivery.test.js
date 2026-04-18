'use strict';
const request = require('supertest');
const app = require('../app');
const BASE = '/api/v1';

describe('🚚 Delivery API', () => {

  describe('GET /delivery/zones', () => {
    it('should return delivery zones', async () => {
      const res = await request(app).get(`${BASE}/delivery/zones`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data[0]).toHaveProperty('city');
      expect(res.body.data[0]).toHaveProperty('baseFee');
      expect(res.body.data[0]).toHaveProperty('freeThreshold');
    });
  });

  describe('POST /delivery/calculate-fee', () => {
    it('should return fee for order under threshold', async () => {
      const res = await request(app).post(`${BASE}/delivery/calculate-fee`)
        .send({ city: 'Nairobi', subtotal: 20 });
      expect(res.status).toBe(200);
      expect(res.body.data.fee).toBeGreaterThan(0);
    });

    it('should return free delivery for order over threshold', async () => {
      const res = await request(app).post(`${BASE}/delivery/calculate-fee`)
        .send({ city: 'Nairobi', subtotal: 100 });
      expect(res.status).toBe(200);
      expect(res.body.data.fee).toBe(0);
    });

    it('should use default zone for unknown city', async () => {
      const res = await request(app).post(`${BASE}/delivery/calculate-fee`)
        .send({ city: 'UnknownCity', subtotal: 10 });
      expect(res.status).toBe(200);
      expect(res.body.data.fee).toBeDefined();
    });
  });

  describe('GET /delivery/track/:code', () => {
    it('should return 404 for invalid tracking code', async () => {
      const res = await request(app).get(`${BASE}/delivery/track/INVALID-CODE-999`);
      expect(res.status).toBe(404);
    });
  });
});
