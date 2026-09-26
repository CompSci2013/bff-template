// src/routes/ping.ts
import { FastifyPluginAsync } from 'fastify';
import { env } from '../config/env.js';

export const pingRoutes: FastifyPluginAsync = async (app) => {
  /**
   * Pathway Verification Endpoint
   * Used on Day 0 from the legacy Angular app to prove:
   * 1. The network path / reverse proxy resolves
   * 2. CORS headers are accepted by the browser
   * 3. Cookies/session tokens are received
   */
  app.get('/api/v1/ping', {
    schema: {
      tags: ['Pathway Verification'],
      summary: 'Communication pathway and CORS echo probe',
      description: 'Used on Day 0 to verify that the reverse proxy, CORS credentials, and cookie propagation work from the legacy client.',
      response: {
        200: {
          type: 'object',
          properties: {
            message: { type: 'string' },
            service: { type: 'string' },
            mode: { type: 'string' },
            timestamp: { type: 'string' },
            clientIp: { type: 'string' },
            userAgent: { type: 'string' },
            origin: { type: 'string' },
            cookiesReceived: { type: 'boolean' },
            protocolPathwayVerified: { type: 'boolean' }
          }
        }
      }
    }
  }, async (req, reply) => {
    return reply.status(200).send({
      message: 'pong',
      service: 'bff-template',
      mode: env.bffMode,
      timestamp: new Date().toISOString(),
      clientIp: req.ip,
      userAgent: req.headers['user-agent'] ?? 'unknown',
      origin: req.headers['origin'] ?? 'same-origin',
      cookiesReceived: Object.keys(req.cookies || {}).length > 0,
      protocolPathwayVerified: true
    });
  });
};
