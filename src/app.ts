// src/app.ts
import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
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

  // Register Routes
  await app.register(healthRoutes);
  await app.register(pingRoutes);
  await app.register(discoverRoutes);
  await app.register(pickerRoutes);

  return app;
}

