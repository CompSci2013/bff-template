// src/config/env.ts
import 'dotenv/config';

export interface EnvConfig {
  port: number;
  host: string;
  nodeEnv: string;
  bffMode: 'stub' | 'hybrid' | 'live';
  simulatedLatencyMs: number;
  corsOrigins: string[];
  upstreamMainApiUrl: string;
  upstreamSecureApiUrl: string;
  upstreamPicker1ApiUrl: string;
  upstreamPicker2ApiUrl: string;
}

export const env: EnvConfig = {
  port: parseInt(process.env['PORT'] ?? '3000', 10),
  host: process.env['HOST'] ?? '0.0.0.0',
  nodeEnv: process.env['NODE_ENV'] ?? 'development',
  bffMode: (process.env['BFF_MODE'] as any) ?? 'stub',
  simulatedLatencyMs: parseInt(process.env['SIMULATED_LATENCY_MS'] ?? '0', 10),
  corsOrigins: (process.env['CORS_ORIGIN'] ?? 'http://localhost:4200,http://localhost:4207')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean),
  upstreamMainApiUrl: process.env['UPSTREAM_MAIN_API_URL'] ?? 'http://main-api.internal',
  upstreamSecureApiUrl: process.env['UPSTREAM_SECURE_API_URL'] ?? 'http://secure-api.internal',
  upstreamPicker1ApiUrl: process.env['UPSTREAM_PICKER1_API_URL'] ?? 'http://picker1-api.internal',
  upstreamPicker2ApiUrl: process.env['UPSTREAM_PICKER2_API_URL'] ?? 'http://picker2-api.internal',
};
