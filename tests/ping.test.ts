// tests/ping.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';

describe('BFF Pathway Verification (/api/v1/ping)', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('responds with 200 and pathway verification metadata', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/ping',
      headers: {
        'Origin': 'http://localhost:4200',
        'User-Agent': 'Angular-Legacy-Harness/1.0'
      }
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.message).toBe('pong');
    expect(body.protocolPathwayVerified).toBe(true);
    expect(body.origin).toBe('http://localhost:4200');
    expect(body.service).toBe('bff-template');
  });

  it('reports cookie status accurately', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/ping',
      headers: {
        'Cookie': 'sessionId=xyz123'
      }
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.cookiesReceived).toBe(true);
  });
});
