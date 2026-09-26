// tests/swagger.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';

describe('OpenAPI / Swagger Documentation (/documentation)', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('serves interactive Swagger UI HTML at /documentation', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/documentation'
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
    expect(res.body).toContain('swagger-ui');
  });

  it('serves OpenAPI 3 specification JSON at /documentation/json', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/documentation/json'
    });

    expect(res.statusCode).toBe(200);
    const spec = res.json();
    expect(spec.openapi).toMatch(/^3\./);
    expect(spec.info.title).toBe('BFF Microservice Gateway');
    expect(spec.paths).toHaveProperty('/api/v1/ping');
    expect(spec.paths).toHaveProperty('/api/v1/{domain}/discover');
    expect(spec.paths).toHaveProperty('/api/v1/{domain}/pickers/{id}');
    expect(spec.paths).toHaveProperty('/healthz');
    expect(spec.paths).toHaveProperty('/api/v1/health');
  });

  it('redirects /docs to /documentation', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/docs'
    });

    expect(res.statusCode).toBe(302);
    expect(res.headers['location']).toBe('/documentation');
  });
});
