// tests/health.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';

describe('BFF Health & Probes (/healthz, /api/v1/health)', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('responds with 200 on /healthz for container liveness', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/healthz'
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok' });
  });

  it('responds with detailed readiness status on /api/v1/health', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/health'
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe('ok');
    expect(body.mode).toBe('stub');
    expect(body).toHaveProperty('upstreams');
    expect(body.upstreams['main-api']).toBe('stubbed');
  });
});
