// src/server.ts
import { buildApp } from './app.js';
import { env } from './config/env.js';

async function start() {
  const app = await buildApp();

  try {
    const address = await app.listen({ port: env.port, host: env.host });
    app.log.info(`🚀 BFF Microservice running at ${address} in [${env.bffMode.toUpperCase()}] mode`);
    app.log.info(`📡 Pathway Verification: ${address}/api/v1/ping`);
    app.log.info(`🩺 Health Probe:        ${address}/healthz`);
    app.log.info(`🔎 Discovery Endpoint:   ${address}/api/v1/:domain/discover`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
