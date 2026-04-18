'use strict';
const request = require('supertest');
const app = require('../app');

const BASE = '/api/v1';
let adminToken = '';
let sellerToken = '';
let buyerToken = '';
let productSlug = '';
let productId = '';
const ts = Date.now();

beforeAll(async () => {
  // Login as admin
  const adminRes = await request(app).post(`${BASE}/auth/login`)
    .send({ email: 'admin@hafamarket.com', password: 'Admin@123' });
  adminToken = adminRes.body.accessToken;

  // Login as seller
  const sellerRes = await request(app).post(`${BASE}/auth/login`)
    .send({ email: 'kwame@hafamarket.com', password: 'Seller@123' });
  sellerToken = sellerRes.body.accessToken;

  // Register a buyer
  const buyerRes = await request(app).post(`${BASE}/auth/register`)
    .send({ name: 'Test Buyer', email: `buyer_${ts}@test.hafa`, password: 'Test@1234' });
  buyerToken = buyerRes.body.accessToken;
});

describe('📦 Products API', () => {

  // ===== GET PRODUCTS =====
  describe('GET /products', () => {
    it('should return paginated products', async () => {
      const res = await request(app).get(`${BASE}/products`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.pagination).toBeDefined();
      expect(res.body.pagination.page).toBe(1);
    });

    it('should filter by category', async () => {
      const res = await request(app).get(`${BASE}/products?category=vegetables`);
      expect(res.status).toBe(200);
    });

    it('should filter by price range', async () => {
      const res = await request(app).get(`${BASE}/products?minPrice=1&maxPrice=10`);
      expect(res.status).toBe(200);
      res.body.data.forEach(p => {
        expect(p.price).toBeGreaterThanOrEqual(1);
        expect(p.price).toBeLessThanOrEqual(10);
      });
    });

    it('should sort by price ascending', async () => {
      const res = await request(app).get(`${BASE}/products?sort=price&order=asc&limit=5`);
      expect(res.status).toBe(200);
      const prices = res.body.data.map(p => p.price);
      for (let i = 1; i < prices.length; i++) {
        expect(prices[i]).toBeGreaterThanOrEqual(prices[i-1]);
      }
    });

    it('should search products', async () => {
      const res = await request(app).get(`${BASE}/products?search=coffee`);
      expect(res.status).toBe(200);
    });
  });

  // ===== GET FEATURED =====
  describe('GET /products/featured', () => {
    it('should return featured products', async () => {
      const res = await request(app).get(`${BASE}/products/featured`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  // ===== CREATE PRODUCT =====
  describe('POST /products', () => {
    it('should create product as verified seller', async () => {
      // Get a category ID first
      const catRes = await request(app).get(`${BASE}/categories`);
      const categoryId = catRes.body.data[0]?.children?.[0]?.id || catRes.body.data[0]?.id;

      const res = await request(app).post(`${BASE}/products`)
        .set('Authorization', `Bearer ${sellerToken}`)
        .send({
          name: `Test Product ${ts}`,
          categoryId,
          price: 5.99,
          stock: 50,
          unit: 'kg',
          description: 'A test product for automated testing',
          isOrganic: true,
        });
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      productSlug = res.body.data.slug;
      productId   = res.body.data.id;
    });

    it('should reject creation without auth', async () => {
      const res = await request(app).post(`${BASE}/products`)
        .send({ name: 'Unauthorized', price: 1, categoryId: 'fake' });
      expect(res.status).toBe(401);
    });

    it('should reject creation by buyer', async () => {
      const res = await request(app).post(`${BASE}/products`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ name: 'Buyer Product', price: 1, categoryId: 'fake' });
      expect(res.status).toBe(403);
    });

    it('should reject invalid product data', async () => {
      const res = await request(app).post(`${BASE}/products`)
        .set('Authorization', `Bearer ${sellerToken}`)
        .send({ name: 'X', price: -5 }); // name too short, negative price
      expect(res.status).toBe(400);
      expect(res.body.errors).toBeDefined();
    });
  });

  // ===== GET SINGLE PRODUCT =====
  describe('GET /products/:slug', () => {
    it('should return product by slug', async () => {
      if (!productSlug) return;
      const res = await request(app).get(`${BASE}/products/${productSlug}`);
      expect(res.status).toBe(200);
      expect(res.body.data.slug).toBe(productSlug);
    });

    it('should return 404 for non-existent slug', async () => {
      const res = await request(app).get(`${BASE}/products/does-not-exist-999`);
      expect(res.status).toBe(404);
    });
  });

  // ===== UPDATE PRODUCT =====
  describe('PATCH /products/:id', () => {
    it('should update product as seller', async () => {
      if (!productId) return;
      const res = await request(app).patch(`${BASE}/products/${productId}`)
        .set('Authorization', `Bearer ${sellerToken}`)
        .send({ price: 6.99, stock: 40 });
      expect(res.status).toBe(200);
      expect(res.body.data.price).toBe(6.99);
    });

    it('should reject update by different user', async () => {
      if (!productId) return;
      const res = await request(app).patch(`${BASE}/products/${productId}`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ price: 1 });
      expect(res.status).toBe(403);
    });
  });
});
