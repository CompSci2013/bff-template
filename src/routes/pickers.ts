// src/routes/pickers.ts
import { FastifyPluginAsync } from 'fastify';
import { env } from '../config/env.js';
import { getPickerStub } from '../stubs/pickers.stub.js';
import { PickerPayload } from '../types/canonical.js';

export const pickerRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/v1/:domain/pickers/:id', {
    schema: {
      tags: ['Modal Pickers'],
      summary: 'Picker Loop modal options catalog',
      description: 'Provides isolated option catalogs for modal dialogs (such as Trim Level Pickers) without polluting the Page Loop.',
      params: {
        type: 'object',
        properties: {
          domain: { type: 'string', description: 'Target domain' },
          id: { type: 'string', description: 'Picker catalog identifier (e.g. 1 for trim levels, 2 for powertrain)' }
        },
        required: ['domain', 'id']
      }
    }
  }, async (req, reply) => {
    const { domain, id } = req.params as { domain: string; id: string };

    // MODE 1: STUB MODE (Day 0 / Day 1)
    if (env.bffMode === 'stub') {
      req.log.info({ domain, id, mode: 'stub' }, 'Serving stubbed modal picker catalog');
      return reply.status(200).send(getPickerStub(id, domain));
    }

    // MODE 2: HYDRATED MODE (Calling upstream picker microservices)
    try {
      const upstreamUrl = id === '1'
        ? `${env.upstreamPicker1ApiUrl}/${domain}/options`
        : `${env.upstreamPicker2ApiUrl}/${domain}/options`;

      const res = await fetch(upstreamUrl, {
        headers: { 'Accept': 'application/json' }
      });

      if (!res.ok) {
        throw new Error(`Upstream picker returned HTTP ${res.status}`);
      }

      const options = await res.json() as any[];

      const payload: PickerPayload = {
        id,
        domain,
        title: id === '1' ? 'Trim Level Catalog' : 'Options Catalog',
        multiSelect: true,
        options: options.map(opt => ({
          value: opt.value ?? opt.id ?? String(opt),
          label: opt.label ?? opt.name ?? String(opt),
          count: opt.count
        }))
      };

      return reply.status(200).send(payload);
    } catch (err: any) {
      req.log.warn({ err, domain, id }, 'Picker upstream unreachable; falling back to stub');
      return reply.status(200).send(getPickerStub(id, domain));
    }
  });
};
