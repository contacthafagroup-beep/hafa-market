'use strict';
const request = require('supertest');
const app = require('../app');
const BASE = '/api/v1';

describe('🔍 Search API', () => {
  it('should return results for valid query', async () => {
    const res = await request(app).get(`${BASE}/search?q=coffee`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.products).toBeDefined();
    expect(res.body.data.sellers).toBeDefined();
    expect(res.body.data.categories).toBeDefined();
  });

  it('should return empty for blank query', async () => {
    const res = await request(app).get(`${BASE}/search?q=`);
    expect(res.status).toBe(200);
    expect(res.body.data.products).toHaveLength(0);
  });

  it('should autocomplete product names', async () => {
    const res = await request(app).get(`${BASE}/search/autocomplete?q=ka`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('should return empty autocomplete for single char', async () => {
    const res = await request(app).get(`${BASE}/search/autocomplete?q=a`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
  });

  it('should return trending searches', async () => {
    const res = await request(app).get(`${BASE}/search/trending`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('should filter search by price range', async () => {
    const res = await request(app).get(`${BASE}/search?q=kale&minPrice=1&maxPrice=5`);
    expect(res.status).toBe(200);
    res.body.data.products.forEach(p => {
      expect(p.price).toBeGreaterThanOrEqual(1);
      expect(p.price).toBeLessThanOrEqual(5);
    });
  });

  it('should sort search results', async () => {
    const res = await request(app).get(`${BASE}/search?q=coffee&sort=price-asc`);
    expect(res.status).toBe(200);
  });
});
