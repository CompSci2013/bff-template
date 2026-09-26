#!/usr/bin/env tsx
/**
 * scaffold-domain-config.ts
 *
 * Universal Domain-Agnostic Day-0 Contract Harvester & Architectural Scaffolder.
 * Dynamically inspects OpenAPI 3.x / Swagger contracts and live wire endpoints to
 * generate the mechanical baseline (~30-35% of domain effort) for ANY brownfield domain.
 *
 * CRITICAL REALITY (THE 30/70 LAW):
 * Automation covers ~30-35% of total domain work (field names, primitive types, models, boilerplate).
 * The remaining 65-70% (widget selection, range grouping, anti-corruption aliases, row expansion,
 * modal pickers, and metric charts) REQUIRES HUMAN ARCHITECTURAL DECISIONS.
 *
 * GOVERNED BY THE LAW OF THE TEXTBOOKS (Volumes 2 & 3):
 * - Vol 2 Ch 06-01: One Class, N Configs (Components are 100% domain-blind)
 * - Vol 2 Ch 06-02: The Four Narrow Config Families (Filters, Table, Pickers, Charts)
 * - Vol 2 Ch 08-04: Adapters & Config-Generators (Pure leaf generators)
 * - Vol 3 Ch 01-01: The Canonical Record (9-Spine + attributes bag oracle)
 * - Vol 3 Ch 01-02: The DOMAIN_CONFIG Token & Per-Domain DI Boundary
 * - Vol 3 Ch 04-01: Convention over Configuration (ResourceDefinition as Single Source of Truth)
 *
 * ZERO HARDCODED CAPSTONE ASSUMPTIONS.
 * Operates purely on what Swagger and the wire contract reveal.
 *
 * Usage:
 *   npx tsx scripts/scaffold-domain-config.ts --domain=<domainName>
 *   npx tsx scripts/scaffold-domain-config.ts --url=http://localhost:3000/documentation/json --domain=<domainName>
 *   npx tsx scripts/scaffold-domain-config.ts --spec=./openapi.json --domain=<domainName> --out=./src/domains
 */

import * as fs from 'fs';
import * as path from 'path';

interface CliArgs {
  domain: string;
  url: string;
  specFile?: string;
  outDir: string;
}

function parseArgs(): CliArgs {
  const args: CliArgs = {
    domain: '',
    url: 'http://localhost:3000/documentation/json',
    outDir: './src/domains'
  };

  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith('--domain=')) {
      args.domain = arg.split('=')[1].trim();
    } else if (arg.startsWith('--url=')) {
      args.url = arg.split('=')[1].trim();
    } else if (arg.startsWith('--spec=')) {
      args.specFile = arg.split('=')[1].trim();
    } else if (arg.startsWith('--out=')) {
      args.outDir = arg.split('=')[1].trim();
    }
  }

  if (!args.domain) {
    console.error('\n[Error]: Missing required argument --domain=<domainName>');
    console.error('Usage: npm run scaffold:domain -- --domain=<domainName> [--url=<swaggerJsonUrl>] [--out=<outputDir>]\n');
    process.exit(1);
  }

  return args;
}

function toPascalCase(str: string): string {
  return str
    .replace(/[-_](\w)/g, (_, c) => c.toUpperCase())
    .replace(/^(\w)/, (_, c) => c.toUpperCase());
}

function toTitleCase(str: string): string {
  return str
    .replace(/([A-Z])/g, ' $1')
    .replace(/[-_]/g, ' ')
    .replace(/^./, s => s.toUpperCase())
    .trim();
}

/**
 * Universal Discovered Field Descriptor.
 * Populated purely by introspection of OpenAPI parameters and response schemas.
 */
interface DiscoveredField {
  name: string;
  label: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'array';
  filterable: boolean;
  sortable: boolean;
  visible: boolean;
  highlightable: boolean;
  filterType?: 'text' | 'autocomplete' | 'multiselect' | 'select' | 'range' | 'number';
  rangeField?: string;
  rangeRole?: 'min' | 'max';
  urlParam?: string;
  apiParam?: string;
  width?: string;
  dataType?: 'text' | 'numeric' | 'date' | 'boolean';
  description?: string;
  source: 'query-param' | 'spine-property' | 'attribute-property' | 'wire-probe';
}

/**
 * Resolves local and remote OpenAPI specifications.
 */
async function loadOpenApiSpec(args: CliArgs): Promise<any> {
  if (args.specFile && fs.existsSync(args.specFile)) {
    console.log(`[Spec] Loading local OpenAPI specification from file: ${args.specFile}`);
    return JSON.parse(fs.readFileSync(args.specFile, 'utf-8'));
  }

  try {
    console.log(`[Spec] Querying Swagger endpoint: ${args.url}`);
    const res = await fetch(args.url);
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    return await res.json();
  } catch (err: any) {
    console.warn(`[Spec Warning] Remote fetch failed (${err.message}). Attempting in-process Fastify buildApp probe...`);
    const { buildApp } = await import('../src/app.js');
    const app = await buildApp({ logger: false });
    const res = await app.inject({ method: 'GET', url: '/documentation/json' });
    await app.close();
    return JSON.parse(res.body);
  }
}

/**
 * Traverses OpenAPI paths to locate the discovery endpoint for the requested domain.
 */
function findDiscoverOperation(spec: any, domain: string): { pathKey: string; operation: any } | null {
  const paths = spec.paths || {};

  // Try exact path or parameterized path
  const candidateKeys = [
    `/api/v1/${domain}/discover`,
    `/api/v1/{domain}/discover`,
    `/${domain}/discover`,
    `/${domain}/records`,
    `/api/v1/${domain}/records`,
    `/${domain}/search`
  ];

  for (const key of candidateKeys) {
    if (paths[key]?.get) {
      return { pathKey: key, operation: paths[key].get };
    }
  }

  // Fallback: look for any GET route containing 'discover' or the domain name
  for (const [key, pathItem] of Object.entries(paths) as [string, any][]) {
    if (pathItem.get && (key.includes(domain) || key.includes('{domain}')) && key.includes('discover')) {
      return { pathKey: key, operation: pathItem.get };
    }
  }

  return null;
}

/**
 * Resolves a $ref pointer in the OpenAPI document.
 */
function resolveRef(spec: any, ref: string): any {
  if (!ref || !ref.startsWith('#/')) return null;
  const parts = ref.substring(2).split('/');
  let current = spec;
  for (const part of parts) {
    if (!current) return null;
    current = current[part];
  }
  return current;
}

/**
 * Performs a Second Witness wire probe against the live running server to discover
 * actual runtime attributes when the OpenAPI schema uses an open object (additionalProperties).
 */
async function probeLiveEndpoint(domain: string, baseUrl: string): Promise<Record<string, unknown> | null> {
  // 1. Try remote HTTP fetch first
  try {
    const urlObj = new URL(baseUrl);
    const probeUrl = `${urlObj.origin}/api/v1/${domain}/discover?size=1`;
    const res = await fetch(probeUrl, { headers: { 'Accept': 'application/json' } });
    if (res.ok) {
      const body: any = await res.json();
      return body.results?.[0] || body.records?.[0] || body.items?.[0] || body.data?.[0] || null;
    }
  } catch {
    // Remote fetch failed, fall through to in-process injection
  }

  // 2. Try in-process Fastify injection fallback
  try {
    const { buildApp } = await import('../src/app.js');
    const app = await buildApp({ logger: false });
    const res = await app.inject({ method: 'GET', url: `/api/v1/${domain}/discover?size=1` });
    await app.close();
    if (res.statusCode === 200) {
      const body: any = JSON.parse(res.body);
      return body.results?.[0] || body.records?.[0] || body.items?.[0] || body.data?.[0] || null;
    }
  } catch {
    // In-process fallback not possible
  }

  return null;
}

/**
 * Introspects Swagger query parameters, response schema, and live wire payload.
 * ZERO HARDCODED DOMAIN CONSTANTS.
 */
async function inspectSwaggerContract(
  spec: any,
  domain: string,
  url: string
): Promise<{ fields: DiscoveredField[]; pagination: any; sorting: any; dataKey: string }> {
  const fieldsMap = new Map<string, DiscoveredField>();

  const pagination = {
    defaultSize: 25,
    sizeOptions: [10, 25, 50, 100],
    pageParam: 'page',
    sizeParam: 'size',
    zeroIndexed: false
  };

  const sorting = {
    defaultField: 'title',
    defaultDirection: 'asc' as const,
    sortFieldParam: 'sort',
    sortDirectionParam: 'order'
  };

  let dataKey = 'id';

  const opInfo = findDiscoverOperation(spec, domain);
  if (!opInfo) {
    console.warn(`[Warning] No discover operation found in OpenAPI paths for domain '${domain}'. Using fallback inspection.`);
  }

  const operation = opInfo?.operation;
  const parameters: any[] = operation?.parameters || [];

  // =========================================================================
  // 1. DISCOVER FIELDS FROM SWAGGER QUERY PARAMETERS
  // =========================================================================
  for (const param of parameters) {
    if (param.in !== 'query') continue;
    const name: string = param.name;
    const schema = param.schema?.$ref ? resolveRef(spec, param.schema.$ref) : (param.schema || {});
    const schemaType: string = schema.type || 'string';

    // Detect pagination parameters
    if (['page', 'pageIndex', 'pageNumber'].includes(name)) {
      pagination.pageParam = name;
      continue;
    }
    if (['size', 'pageSize', 'limit'].includes(name)) {
      pagination.sizeParam = name;
      if (schema.default) pagination.defaultSize = schema.default;
      continue;
    }

    // Detect sort parameters
    if (['sort', 'sortBy', 'sortField'].includes(name)) {
      sorting.sortFieldParam = name;
      continue;
    }
    if (['order', 'sortOrder', 'sortDirection', 'dir'].includes(name)) {
      sorting.sortDirectionParam = name;
      continue;
    }

    // Detect full-text search
    if (['q', 'query', 'search', 'keyword'].includes(name)) {
      fieldsMap.set(name, {
        name,
        label: 'Search',
        type: 'string',
        filterable: true,
        sortable: false,
        visible: false,
        highlightable: false,
        filterType: 'text',
        source: 'query-param',
        description: param.description || 'Full-text keyword search'
      });
      continue;
    }

    // General domain filter parameter
    let type: DiscoveredField['type'] = 'string';
    if (schemaType === 'integer' || schemaType === 'number') type = 'number';
    else if (schemaType === 'boolean') type = 'boolean';
    else if (schemaType === 'array') type = 'array';

    let filterType: DiscoveredField['filterType'] = type === 'number' ? 'number' 
      : type === 'array' ? 'multiselect' 
      : (schema.enum ? 'select' : 'text');

    fieldsMap.set(name, {
      name,
      label: toTitleCase(name),
      type,
      filterable: true,
      sortable: false,
      visible: false, // Default: query parameters are filter controls; columns confirmed by response schema
      highlightable: false,
      filterType,
      source: 'query-param',
      description: param.description
    });
  }

  // =========================================================================
  // 2. DISCOVER FIELDS FROM SWAGGER RESPONSE SCHEMA (200 OK)
  // =========================================================================
  const response200 = operation?.responses?.['200'] || operation?.responses?.['default'];
  let responseSchema = response200?.content?.['application/json']?.schema || response200?.schema;
  if (responseSchema?.$ref) responseSchema = resolveRef(spec, responseSchema.$ref);

  if (responseSchema?.properties) {
    // Find record list property (results, items, records, data)
    let recordsProp = responseSchema.properties.results 
      || responseSchema.properties.items 
      || responseSchema.properties.records 
      || responseSchema.properties.data;

    if (recordsProp?.$ref) recordsProp = resolveRef(spec, recordsProp.$ref);

    let itemSchema = recordsProp?.items;
    if (itemSchema?.$ref) itemSchema = resolveRef(spec, itemSchema.$ref);

    if (itemSchema?.properties) {
      for (const [propName, rawPropSchema] of Object.entries(itemSchema.properties) as [string, any][]) {
        let propSchema = rawPropSchema.$ref ? resolveRef(spec, rawPropSchema.$ref) : rawPropSchema;
        const pType = propSchema.type || 'string';

        // Check if this property is a primary identifier
        if (['id', '_id', 'uuid', 'key'].includes(propName.toLowerCase())) {
          dataKey = propName;
        }

        // Handle nested attributes bag (canonical 9-spine pattern)
        if (propName === 'attributes' && propSchema.properties) {
          for (const [attrName, attrRaw] of Object.entries(propSchema.properties) as [string, any][]) {
            const attrSchema = attrRaw.$ref ? resolveRef(spec, attrRaw.$ref) : attrRaw;
            registerProperty(fieldsMap, attrName, attrSchema, 'attribute-property');
          }
          continue;
        }

        if (propName === 'facets') continue; // Handled separately by framework

        registerProperty(fieldsMap, propName, propSchema, 'spine-property');
      }
    }
  }

  // =========================================================================
  // 3. SECOND WITNESS: LIVE PROBE FOR RUNTIME ATTRIBUTES
  // =========================================================================
  console.log(`[Second Witness] Probing live wire endpoint for runtime attributes...`);
  const liveRecord = await probeLiveEndpoint(domain, url);
  if (liveRecord) {
    console.log(`[Second Witness] Discovered live sample record with ${Object.keys(liveRecord).length} keys.`);
    for (const [k, v] of Object.entries(liveRecord)) {
      if (k === 'facets') continue;
      if (k === 'attributes' && typeof v === 'object' && v !== null) {
        for (const [attrKey, attrVal] of Object.entries(v)) {
          if (!fieldsMap.has(attrKey)) {
            const valType = inferTypeFromValue(attrVal);
            fieldsMap.set(attrKey, {
              name: attrKey,
              label: toTitleCase(attrKey),
              type: valType,
              filterable: false,
              sortable: true,
              visible: true,
              highlightable: false,
              dataType: valType === 'number' ? 'numeric' : (valType === 'date' ? 'date' : 'text'),
              source: 'wire-probe'
            });
          }
        }
        continue;
      }

      if (!fieldsMap.has(k)) {
        const valType = inferTypeFromValue(v);
        const isId = ['id', '_id', 'uuid'].includes(k.toLowerCase());
        fieldsMap.set(k, {
          name: k,
          label: toTitleCase(k),
          type: valType,
          filterable: false,
          sortable: !isId,
          visible: !isId,
          highlightable: false,
          dataType: valType === 'number' ? 'numeric' : (valType === 'date' ? 'date' : 'text'),
          source: 'wire-probe'
        });
      }
    }
  }

  // =========================================================================
  // 4. GENERIC ALGORITHMIC RANGE PAIRING (NO HARDCODING)
  // Detects: fooMin/fooMax, min_foo/max_foo, foo_from/foo_to, fooStart/fooEnd
  // =========================================================================
  const allNames = Array.from(fieldsMap.keys());
  for (const name of allNames) {
    const rangeMatch = name.match(/^(.+?)(Min|_min|Start|_start|From|_from)$/i)
      || name.match(/^(min_|start_|from_)(.+)$/i);

    if (rangeMatch) {
      const baseName = rangeMatch[1].startsWith('min_') ? rangeMatch[2] : rangeMatch[1];
      const maxPartner = allNames.find(other => 
        other.toLowerCase() === `${baseName.toLowerCase()}max` ||
        other.toLowerCase() === `${baseName.toLowerCase()}_max` ||
        other.toLowerCase() === `max_${baseName.toLowerCase()}` ||
        other.toLowerCase() === `${baseName.toLowerCase()}end`
      );

      if (maxPartner) {
        const minField = fieldsMap.get(name)!;
        const maxField = fieldsMap.get(maxPartner)!;

        minField.rangeField = baseName;
        minField.rangeRole = 'min';
        minField.filterable = true;

        maxField.rangeField = baseName;
        maxField.rangeRole = 'max';
        maxField.filterable = true;
      }
    }
  }

  // Sort fields alphabetically, keeping primary id at top
  const sortedFields = Array.from(fieldsMap.values()).sort((a, b) => {
    if (a.name === dataKey) return -1;
    if (b.name === dataKey) return 1;
    return a.name.localeCompare(b.name);
  });

  return { fields: sortedFields, pagination, sorting, dataKey };
}

function registerProperty(
  map: Map<string, DiscoveredField>,
  propName: string,
  schema: any,
  source: DiscoveredField['source']
) {
  const pType = schema.type || 'string';
  const isDate = schema.format === 'date' || schema.format === 'date-time' || propName.endsWith('_at') || propName.endsWith('Date');
  const type: DiscoveredField['type'] = isDate ? 'date' 
    : (pType === 'integer' || pType === 'number') ? 'number'
    : (pType === 'boolean') ? 'boolean'
    : (pType === 'array') ? 'array' : 'string';

  const isTechnicalId = ['id', '_id', 'uuid', 'version', 'domain', 'owner_id'].includes(propName);

  if (map.has(propName)) {
    const existing = map.get(propName)!;
    existing.visible = !isTechnicalId;
    existing.sortable = !isTechnicalId;
    if (type !== 'string') existing.type = type;
    if (type === 'number') existing.dataType = 'numeric';
    if (type === 'date') existing.dataType = 'date';
  } else {
    map.set(propName, {
      name: propName,
      label: toTitleCase(propName),
      type,
      filterable: false,
      sortable: !isTechnicalId,
      visible: !isTechnicalId,
      highlightable: false,
      filterType: type === 'number' ? 'number' : (type === 'array' ? 'multiselect' : 'text'),
      dataType: type === 'number' ? 'numeric' : (type === 'date' ? 'date' : 'text'),
      source,
      description: schema.description
    });
  }
}

function inferTypeFromValue(val: unknown): DiscoveredField['type'] {
  if (typeof val === 'number') return 'number';
  if (typeof val === 'boolean') return 'boolean';
  if (Array.isArray(val)) return 'array';
  if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}/.test(val)) return 'date';
  return 'string';
}

function generateResourceTs(
  domain: string,
  fields: DiscoveredField[],
  pagination: any,
  sorting: any,
  dataKey: string
): string {
  const domainPascal = toPascalCase(domain);
  const resourceConstName = `${domain.toUpperCase()}_RESOURCE`;

  return `/**
 * ${domainPascal} Resource Definition
 *
 * Generated by bff-config-scaffold (Universal Day-0 Contract Harvester).
 *
 * THE 30/70 REALITY (VOLUMES 2 & 3):
 * Automated tooling provides the ~30-35% mechanical baseline:
 * - Scraped field names, raw types, and TypeScript interface syntax.
 *
 * THE REMAINING 65-70% REQUIRES HUMAN ARCHITECTURAL DECISIONS (THE LAW):
 * An API schema cannot know presentation intent, secondary workflows, or business semantics.
 * You must now complete the 5-point audit checklist below:
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE 5-POINT HUMAN ARCHITECTURAL AUDIT CHECKLIST:
 * ─────────────────────────────────────────────────────────────────────────────
 * [ ] 1. Range Pairing (Vol 2 Ch 08-04):
 *        Verify min/max fields share identical 'rangeField' and 'rangeRole: min|max'.
 *        Collapses two wire parameters into a single user-facing range slider.
 *
 * [ ] 2. Visibility Intent & Table Columns (Vol 3 Ch 04-01):
 *        Set 'visible: false' for internal IDs, audit timestamps, or fields not displayed in tables.
 *        Tune column widths ('120px', '220px') and 'dataType: numeric|text|date'.
 *
 * [ ] 3. UI Filter Control Types (Vol 2 Ch 06-02):
 *        Change default 'text' to 'autocomplete' (set 'autocompleteEndpoint') or 
 *        'multiselect' (set 'optionsEndpoint') for catalog-driven filters.
 *
 * [ ] 4. The Anti-Corruption Seam (Vol 3 Ch 04-01 §Where it breaks):
 *        If client URL parameters require aliases, set 'urlParam: ...' so the URL uses
 *        the client's vocabulary while the BFF receives the wire parameter.
 *
 * [ ] 5. Highlighting Channel (Vol 2 Ch 08-04):
 *        Set 'highlightable: true' for fields participating in the 'h_*' highlight query channel.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export interface ResourceField {
  name: string;
  label: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'array';
  filterable?: boolean;
  sortable?: boolean;
  visible?: boolean;
  highlightable?: boolean;
  filterType?: 'text' | 'autocomplete' | 'multiselect' | 'select' | 'range' | 'number';
  rangeField?: string;
  rangeRole?: 'min' | 'max';
  urlParam?: string;
  apiParam?: string;
  width?: string;
  dataType?: 'text' | 'numeric' | 'date' | 'boolean';
  optionsEndpoint?: string;
  autocompleteEndpoint?: string;
  min?: number;
  max?: number;
  placeholder?: string;
  description?: string;
}

export interface ResourceDefinition {
  name: string;
  label: string;
  fields: ResourceField[];
  endpoints: {
    search: string;
    stats?: string;
  };
  pagination: {
    defaultSize: number;
    sizeOptions: number[];
    pageParam: string;
    sizeParam: string;
    zeroIndexed: boolean;
  };
  sorting: {
    defaultField: string;
    defaultDirection: 'asc' | 'desc';
    sortFieldParam: string;
    sortDirectionParam: string;
  };
  highlights: {
    prefix: string;
    valueSeparator: string;
    normalizePipes: boolean;
  };
  dataKey: string;
}

export const ${resourceConstName}: ResourceDefinition = {
  name: '${domain}',
  label: '${toTitleCase(domain)} Discovery',

  fields: [
${fields.map(f => {
  const parts: string[] = [
    `name: '${f.name}'`,
    `label: '${f.label}'`,
    `type: '${f.type}'`
  ];
  if (f.filterable) parts.push(`filterable: true`);
  if (f.sortable) parts.push(`sortable: true`);
  if (f.visible) parts.push(`visible: true`);
  else parts.push(`visible: false`);
  if (f.highlightable) parts.push(`highlightable: true`);
  if (f.filterType) parts.push(`filterType: '${f.filterType}'`);
  if (f.rangeField) {
    parts.push(`rangeField: '${f.rangeField}'`);
    parts.push(`rangeRole: '${f.rangeRole}'`);
  }
  if (f.urlParam) parts.push(`urlParam: '${f.urlParam}'`);
  if (f.width) parts.push(`width: '${f.width}'`);
  if (f.dataType) parts.push(`dataType: '${f.dataType}'`);

  return `    { ${parts.join(', ')} },`;
}).join('\n')}
  ],

  endpoints: {
    search: '/api/v1/${domain}/discover',
    stats: '/api/v1/${domain}/stats'
  },

  pagination: {
    defaultSize: ${pagination.defaultSize},
    sizeOptions: [${pagination.sizeOptions.join(', ')}],
    pageParam: '${pagination.pageParam}',
    sizeParam: '${pagination.sizeParam}',
    zeroIndexed: ${pagination.zeroIndexed}
  },

  sorting: {
    defaultField: '${fields.find(f => f.visible && f.sortable)?.name || sorting.defaultField}',
    defaultDirection: '${sorting.defaultDirection}',
    sortFieldParam: '${sorting.sortFieldParam}',
    sortDirectionParam: '${sorting.sortDirectionParam}'
  },

  highlights: {
    prefix: 'h_',
    valueSeparator: ',',
    normalizePipes: true
  },

  dataKey: '${dataKey}'
};
`;
}

function generateDomainConfigTs(domain: string): string {
  const domainPascal = toPascalCase(domain);
  const resourceConstName = `${domain.toUpperCase()}_RESOURCE`;

  return `/**
 * ${domainPascal} Domain Configuration Assembly
 *
 * Implements the Four Narrow Config Families (Vol 2 Ch 06-02, Vol 3 Ch 01-02).
 * THE FOUR FAMILIES MEET ONLY HERE AT THIS ASSEMBLY FACTORY.
 */

import { ${resourceConstName} } from './${domain}.resource.js';
import {
  generateTableConfig,
  generateFilterDefinitions,
  generateHighlightFilterDefinitions
} from '../utils/config-generators.js';
import {
  ${domainPascal}Filters,
  ${domainPascal}Result,
  ${domainPascal}Statistics
} from './${domain}.models.js';

export function create${domainPascal}DomainConfig() {
  return {
    domainName: '${domain}',
    domainLabel: '${toTitleCase(domain)}',

    // Family 1: Filter Definitions (Vol 2 Ch 06-02 - Generated from ResourceDefinition)
    filters: generateFilterDefinitions(${resourceConstName}),

    // Family 2: Table Configuration (Vol 2 Ch 08-04 - Generated + Overridden)
    // [LAW - Vol 2 Ch 08-04]: Choose expansion mode: 'detail' (local 1:1 attributes) vs 'children' (1:many wire fetch)
    tableConfig: generateTableConfig<${domainPascal}Result>(${resourceConstName}, {
      expandable: false, // Set true if table supports row drill-down
      // expansion: { mode: 'detail' }
    }),

    // Family 3: Picker Configurations (Vol 2 Ch 06-02 - Authored Dialog Catalogs)
    // Empty array if domain has no secondary modal selectors.
    pickers: [],

    // Family 4: Chart Configurations (Vol 3 Ch 06-01 - Authored Metrics)
    // Empty array if domain has no analytical chart panel.
    charts: [],

    // QueryControl Slices (Vol 3 Ch 01-02)
    queryControlFilters: generateFilterDefinitions(${resourceConstName}).map(f => ({
      id: f.id,
      label: f.label
    })),
    highlightFilters: generateHighlightFilterDefinitions(${resourceConstName}),

    // Feature Flags (Vol 3 Ch 01-02)
    features: {
      highlights: true,
      popOuts: true,
      rowExpansion: false,
      statistics: true,
      export: true,
      columnManagement: true,
      statePersistence: true
    }
  };
}
`;
}

function generateModelsTs(domain: string, fields: DiscoveredField[]): string {
  const domainPascal = toPascalCase(domain);

  return `/**
 * ${domainPascal} Models
 *
 * Strongly typed contracts derived from Swagger/OpenAPI specification.
 */

export interface ${domainPascal}Filters {
  q?: string;
  page?: number;
  size?: number;
  sort?: string;
  order?: 'asc' | 'desc';
${fields.filter(f => f.filterable && !['page', 'size', 'sort', 'order', 'q'].includes(f.name)).map(f => {
  const tsType = f.type === 'number' ? 'number' : (f.type === 'boolean' ? 'boolean' : (f.type === 'array' ? 'string[]' : 'string'));
  return `  ${f.name}?: ${tsType};`;
}).join('\n')}
  [key: string]: unknown;
}

export interface ${domainPascal}Result {
  id: string;
  domain: string;
  title: string;
  status: string;
  created_at: string;
  updated_at: string;
  owner_id: string;
  version: number;
  facets: Record<string, string>;
  attributes: {
${fields.filter(f => !['id', 'domain', 'title', 'status', 'created_at', 'updated_at', 'owner_id', 'version', 'facets'].includes(f.name)).map(f => {
  const tsType = f.type === 'number' ? 'number' : (f.type === 'boolean' ? 'boolean' : (f.type === 'array' ? 'string[]' : 'string'));
  return `    ${f.name}?: ${tsType};`;
}).join('\n')}
    [key: string]: unknown;
  };
}

export interface ${domainPascal}Statistics {
  totalRecords: number;
  [key: string]: unknown;
}
`;
}

async function main() {
  const args = parseArgs();
  console.log(`========================================================================`);
  console.log(`Universal BFF / OpenAPI Config Family Scaffolder (Volumes 2 & 3 Law)`);
  console.log(`Domain:     ${args.domain}`);
  console.log(`Source:     ${args.specFile || args.url}`);
  console.log(`Output:     ${args.outDir}/${args.domain}`);
  console.log(`========================================================================\n`);

  const spec = await loadOpenApiSpec(args);
  const { fields, pagination, sorting, dataKey } = await inspectSwaggerContract(spec, args.domain, args.url);

  console.log(`\nDiscovered ${fields.length} contract fields (ZERO hardcoded constants):`);
  for (const f of fields) {
    const role = f.visible ? '[column]' : (f.filterable ? '[filter]' : '[meta]');
    console.log(`  ${role.padEnd(9)} ${f.name.padEnd(20)} | type: ${f.type.padEnd(8)} | src: ${f.source}`);
  }

  const targetDir = path.resolve(args.outDir, args.domain);
  fs.mkdirSync(targetDir, { recursive: true });

  const resourcePath = path.join(targetDir, `${args.domain}.resource.ts`);
  const domainConfigPath = path.join(targetDir, `${args.domain}.domain-config.ts`);
  const modelsPath = path.join(targetDir, `${args.domain}.models.ts`);

  fs.writeFileSync(resourcePath, generateResourceTs(args.domain, fields, pagination, sorting, dataKey));
  fs.writeFileSync(domainConfigPath, generateDomainConfigTs(args.domain));
  fs.writeFileSync(modelsPath, generateModelsTs(args.domain, fields));

  console.log(`\n[Success] Mechanical Scaffolding Complete (~30-35% baseline):`);
  console.log(`  - ResourceDefinition: ${resourcePath}`);
  console.log(`  - DomainConfig:       ${domainConfigPath}`);
  console.log(`  - DomainModels:       ${modelsPath}`);
  console.log(`\n[Next Step: Progressive Human Curation (~65-70% of domain effort)]:`);
  console.log(`  Complete the 5-point audit checklist at the top of ${resourcePath}`);
  console.log(`  to apply domain-specific Law from Volumes 2 & 3.`);
}

main().catch(err => {
  console.error('[Fatal Error]:', err);
  process.exit(1);
});
