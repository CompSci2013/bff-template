// src/app.ts
import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { env } from './config/env.js';
import { healthRoutes } from './routes/health.js';
import { pingRoutes } from './routes/ping.js';
import { discoverRoutes } from './routes/discover.js';
import { pickerRoutes } from './routes/pickers.js';

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: env.nodeEnv === 'development'
      ? {
          transport: {
            target: 'pino-pretty',
            options: { colorize: true, translateTime: 'HH:MM:ss Z' }
          }
        }
      : true
  });

  // CORS Configuration: allows legacy Angular app to make credentialed requests
  await app.register(cors, {
    origin: (origin, cb) => {
      // Allow requests with no origin (like mobile apps, curl, or server-to-server)
      if (!origin) return cb(null, true);
      
      const allowed = env.corsOrigins.some(o => origin.startsWith(o));
      if (allowed || env.nodeEnv === 'development') {
        return cb(null, true);
      }
      return cb(new Error('Not allowed by CORS'), false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
  });

  await app.register(cookie);

  // OpenAPI / Swagger Specification Registration
  await app.register(swagger, {
    openapi: {
      info: {
        title: 'BFF Microservice Gateway',
        description: 'Canonical Fastify Backend-for-Frontend (BFF) template for brownfield application modernization.',
        version: '1.0.0'
      },
      servers: [
        {
          url: `http://localhost:${env.port}`,
          description: 'Local Development Server'
        }
      ],
      tags: [
        { name: 'Pathway Verification', description: 'Network connectivity, CORS, and cookie verification probes for Day 0' },
        { name: 'Health & Diagnostics', description: 'Docker Swarm container liveness and upstream readiness checks' },
        { name: 'Discovery & Analytics', description: 'The Page Loop: canonical 9-spine records, total counts, and facet aggregations' },
        { name: 'Modal Pickers', description: 'The Picker Loop: isolated secondary selection dialog catalogs' }
      ]
    }
  });

  // Interactive Swagger UI
  await app.register(swaggerUi, {
    routePrefix: '/documentation',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: false
    }
  });

  // Root and docs redirect to /documentation
  app.get('/docs', async (_req, reply) => {
    return reply.redirect('/documentation');
  });

  // Register Application Routes
  await app.register(healthRoutes);
  await app.register(pingRoutes);
  await app.register(discoverRoutes);
  await app.register(pickerRoutes);

  return app;
}
