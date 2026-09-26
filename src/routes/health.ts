// src/routes/health.ts
import { FastifyPluginAsync } from 'fastify';
import { env } from '../config/env.js';
import { upstreamClient } from '../services/upstream-client.js';
import { HealthStatus } from '../types/canonical.js';

const startTime = Date.now();

export const healthRoutes: FastifyPluginAsync = async (app) => {
  // Simple Liveness Probe for Docker / Swarm healthcheck
  app.get('/healthz', async (_req, reply) => {
    return reply.status(200).send({ status: 'ok' });
  });

  // Comprehensive Readiness & Diagnostics Probe
  app.get('/api/v1/health', async (_req, reply) => {
    const upstreams: Record<string, 'reachable' | 'unreachable' | 'stubbed'> = {};

    if (env.bffMode === 'stub') {
      upstreams['main-api'] = 'stubbed';
      upstreams['secure-api'] = 'stubbed';
      upstreams['picker1-api'] = 'stubbed';
      upstreams['picker2-api'] = 'stubbed';
    } else {
      // In hybrid or live mode, probe configured upstreams
      const [mainOk, secureOk] = await Promise.all([
        upstreamClient.checkHealth(`${env.upstreamMainApiUrl}/health`).catch(() => false),
        upstreamClient.checkHealth(`${env.upstreamSecureApiUrl}/health`).catch(() => false)
      ]);
      upstreams['main-api'] = mainOk ? 'reachable' : 'unreachable';
      upstreams['secure-api'] = secureOk ? 'reachable' : 'unreachable';
    }

    const payload: HealthStatus = {
      status: 'ok',
      mode: env.bffMode,
      uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
      timestamp: new Date().toISOString(),
      upstreams
    };

    return reply.status(200).send(payload);
  });
};
