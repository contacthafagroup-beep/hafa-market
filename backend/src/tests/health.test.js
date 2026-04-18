'use strict';
const request = require('supertest');
const app = require('../app');

describe('🏥 Health Checks', () => {
  it('GET /health — basic health', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.service).toBe('Hafa Market API');
  });

  it('GET /health/detailed — detailed health', async () => {
    const res = await request(app).get('/health/detailed');
    expect([200, 200]).toContain(res.status);
    expect(['healthy','degraded']).toContain(res.body.status);
    expect(res.body.checks.database).toBeDefined();
    expect(res.body.checks.system).toBeDefined();
    expect(res.body.checks.system.uptime).toBeDefined();
  });

  it('GET /health/ready — readiness probe', async () => {
    const res = await request(app).get('/health/ready');
    expect(res.status).toBe(200);
    expect(res.body.ready).toBe(true);
  });

  it('GET /health/live — liveness probe', async () => {
    const res = await request(app).get('/health/live');
    expect(res.status).toBe(200);
    expect(res.body.alive).toBe(true);
  });

  it('GET /api-docs — Swagger UI loads', async () => {
    const res = await request(app).get('/api-docs/');
    expect(res.status).toBe(200);
    expect(res.text).toContain('swagger');
  });

  it('GET /api-docs.json — Swagger spec valid', async () => {
    const res = await request(app).get('/api-docs.json');
    expect(res.status).toBe(200);
    expect(res.body.openapi).toBe('3.0.0');
    expect(res.body.info.title).toBe('Hafa Market API');
    expect(res.body.paths).toBeDefined();
  });
});
