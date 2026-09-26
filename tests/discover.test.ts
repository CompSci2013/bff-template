// tests/discover.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';

describe('BFF Discovery Contract (/api/v1/:domain/discover)', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('serves canonical discover payload with 9 spine fields', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/automobile/discover?page=1&size=10'
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.domain).toBe('automobile');
    expect(Array.isArray(body.results)).toBe(true);
    expect(body.results.length).toBeGreaterThan(0);

    const first = body.results[0];
    // Check 9 Spine Fields
    expect(first).toHaveProperty('id');
    expect(first).toHaveProperty('domain', 'automobile');
    expect(first).toHaveProperty('title');
    expect(first).toHaveProperty('manufacturer');
    expect(first).toHaveProperty('model');
    expect(first).toHaveProperty('year');
    expect(first).toHaveProperty('category');
    expect(first).toHaveProperty('count');
    expect(first).toHaveProperty('hasChildren');
    expect(first).toHaveProperty('attributes');

    // Check Facets and Stats
    expect(body.facets).toHaveProperty('manufacturer');
    expect(body.statistics).toHaveProperty('totalInventory');
  });

  it('filters results by query parameter', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/automobile/discover?make=Toyota'
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.results.length).toBe(1);
    expect(body.results[0].manufacturer).toBe('Toyota');
  });
});

