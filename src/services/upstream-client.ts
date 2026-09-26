// src/services/upstream-client.ts
import { env } from '../config/env.js';

export interface UpstreamFetchOptions {
  timeoutMs?: number;
  headers?: Record<string, string>;
}

export class UpstreamClient {
  public async fetchJson<T>(url: string, options: UpstreamFetchOptions = {}): Promise<T> {
    const timeout = options.timeoutMs ?? 5000;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      const res = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          ...(options.headers || {})
        },
        signal: controller.signal
      });

      if (!res.ok) {
        throw new Error(`Upstream ${url} returned HTTP ${res.status}: ${res.statusText}`);
      }

      return (await res.json()) as T;
    } finally {
      clearTimeout(timer);
    }
  }

  public async checkHealth(url: string): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 2000);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);
      return res.ok;
    } catch {
      return false;
    }
  }
}

export const upstreamClient = new UpstreamClient();
