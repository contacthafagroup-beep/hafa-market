'use strict';
const request = require('supertest');
const app = require('../app');

const BASE = '/api/v1/auth';
const ts = `${Date.now()}_${Math.random().toString(36).slice(2,6)}`;
const TEST_USER = { name: 'Test User', email: `user_${ts}@test.hafa`, password: 'Test@1234' };
let accessToken = '';

beforeAll(async () => {
  await global.testPrisma.user.deleteMany({ where: { email: { contains: '@test.hafa' } } }).catch(() => {});
});

describe('🔐 Auth API', () => {

  // ===== REGISTER =====
  describe('POST /auth/register', () => {
    it('should register a new user', async () => {
      const res = await request(app).post(`${BASE}/register`).send(TEST_USER);
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.accessToken).toBeDefined();
      expect(res.body.user.email).toBe(TEST_USER.email);
      expect(res.body.user.passwordHash).toBeUndefined();
      accessToken = res.body.accessToken;
    });

    it('should reject duplicate email', async () => {
      const res = await request(app).post(`${BASE}/register`).send(TEST_USER);
      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
    });

    it('should reject missing name (validation)', async () => {
      const res = await request(app).post(`${BASE}/register`)
        .send({ email: `x_${ts}@test.hafa`, password: 'Test@1234' });
      expect(res.status).toBe(400);
      expect(res.body.errors).toBeDefined();
      expect(res.body.errors[0].field).toBe('name');
    });

    it('should reject weak password', async () => {
      const res = await request(app).post(`${BASE}/register`)
        .send({ name: 'Test', email: `y_${ts}@test.hafa`, password: '123' });
      expect(res.status).toBe(400);
      expect(res.body.errors.some(e => e.field === 'password')).toBe(true);
    });

    it('should reject when neither email nor phone provided', async () => {
      const res = await request(app).post(`${BASE}/register`)
        .send({ name: 'Test', password: 'Test@1234' });
      expect(res.status).toBe(400);
    });
  });

  // ===== LOGIN =====
  describe('POST /auth/login', () => {
    it('should login with correct credentials', async () => {
      const res = await request(app).post(`${BASE}/login`)
        .send({ email: TEST_USER.email, password: TEST_USER.password });
      expect(res.status).toBe(200);
      expect(res.body.accessToken).toBeDefined();
      accessToken = res.body.accessToken;
    });

    it('should reject wrong password', async () => {
      const res = await request(app).post(`${BASE}/login`)
        .send({ email: TEST_USER.email, password: 'WrongPass@1' });
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should reject non-existent user', async () => {
      const res = await request(app).post(`${BASE}/login`)
        .send({ email: 'nobody@test.hafa', password: 'Test@1234' });
      expect(res.status).toBe(401);
    });

    it('should reject missing password (validation)', async () => {
      const res = await request(app).post(`${BASE}/login`)
        .send({ email: TEST_USER.email });
      expect(res.status).toBe(400);
    });
  });

  // ===== GET ME =====
  describe('GET /auth/me', () => {
    it('should return current user with valid token', async () => {
      const res = await request(app).get(`${BASE}/me`)
        .set('Authorization', `Bearer ${accessToken}`);
      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe(TEST_USER.email);
    });

    it('should reject without token', async () => {
      const res = await request(app).get(`${BASE}/me`);
      expect(res.status).toBe(401);
    });

    it('should reject with invalid token', async () => {
      const res = await request(app).get(`${BASE}/me`)
        .set('Authorization', 'Bearer invalid.token.here');
      expect(res.status).toBe(401);
    });
  });

  // ===== CHANGE PASSWORD =====
  describe('PATCH /auth/password', () => {
    it('should reject wrong current password', async () => {
      const res = await request(app).patch(`${BASE}/password`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ currentPassword: 'WrongPass@1', newPassword: 'NewPass@1234' });
      expect(res.status).toBe(400);
    });

    it('should reject weak new password', async () => {
      const res = await request(app).patch(`${BASE}/password`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ currentPassword: TEST_USER.password, newPassword: '123' });
      expect(res.status).toBe(400);
    });
  });

  // ===== LOGOUT =====
  describe('POST /auth/logout', () => {
    it('should logout successfully', async () => {
      const res = await request(app).post(`${BASE}/logout`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});
