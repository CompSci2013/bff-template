// src/routes/discover.ts
import { FastifyPluginAsync } from 'fastify';
import { env } from '../config/env.js';
import { requestCoalescer } from '../services/coalescing.js';
import { getAutomobileStub } from '../stubs/automobile.stub.js';
import { DiscoverPayload } from '../types/canonical.js';

export const discoverRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/v1/:domain/discover', {
    schema: {
      tags: ['Discovery & Analytics'],
      summary: 'Page Loop discovery endpoint (records, facets, and metrics)',
      description: 'The canonical analytical read endpoint. In stub mode, returns pristine 9-Spine records. In hydrated mode, aggregates live upstream services with single-flight coalescing.',
      params: {
        type: 'object',
        properties: {
          domain: { type: 'string', description: 'Target domain (e.g. automobile, train, plane)' }
        },
        required: ['domain']
      },
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', default: 1, description: 'Page number (1-indexed)' },
          size: { type: 'integer', default: 25, description: 'Page size' },
          q: { type: 'string', description: 'Free-text search query' },
          make: { type: 'string', description: 'Manufacturer filter' },
          category: { type: 'string', description: 'Body class / vehicle category filter' },
          sort: { type: 'string', description: 'Sort column field' },
          order: { type: 'string', enum: ['asc', 'desc'], description: 'Sort direction' }
        }
      }
    }
  }, async (req, reply) => {
    const { domain } = req.params as { domain: string };
    const query = req.query as Record<string, string>;
    const coalescingKey = `discover:${domain}:${JSON.stringify(query)}`;

    // Optional simulated latency for testing client loading spinners
    if (env.simulatedLatencyMs > 0) {
      await new Promise(resolve => setTimeout(resolve, env.simulatedLatencyMs));
    }

    // Coalesce concurrent requests onto a single execution
    const payload = await requestCoalescer.execute(coalescingKey, async (): Promise<DiscoverPayload> => {
      // MODE 1: STUB MODE (Day 0 / Day 1)
      if (env.bffMode === 'stub' || domain === 'automobile') {
        req.log.info({ domain, mode: 'stub' }, 'Serving stubbed canonical discovery response');
        return getAutomobileStub(query);
      }

      // MODE 2: HYDRATED MODE (Day 2+ as upstreams are characterized)
      req.log.info({ domain, mode: 'hydrated' }, 'Aggregating from live upstream microservices');
      try {
        const queryString = new URLSearchParams(query).toString();
        const mainUrl = `${env.upstreamMainApiUrl}/${domain}/records?${queryString}`;
        
        const mainRes = await fetch(mainUrl, {
          headers: { 'Accept': 'application/json' }
        });
        
        if (!mainRes.ok) {
          throw new Error(`Upstream returned ${mainRes.status}`);
        }
        
        const rawData = await mainRes.json() as any;
        
        // Normalize into Canonical DiscoverPayload
        return {
          domain,
          results: rawData.items ?? rawData.records ?? [],
          total: rawData.totalCount ?? rawData.total ?? 0,
          page: parseInt(query['page'] ?? '1', 10),
          pageSize: parseInt(query['size'] ?? '25', 10),
          facets: rawData.facets ?? {},
          statistics: rawData.statistics ?? {}
        };
      } catch (err: any) {
        req.log.error({ err, domain }, 'Upstream hydration failure; falling back to stub');
        return getAutomobileStub(query);
      }
    });

    return reply.status(200).send(payload);
  });
};
