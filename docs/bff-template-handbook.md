# BFF Template Applied: The Day-0 Gateway Handbook
### Standing Up the Fastify 5.x Backend-for-Frontend in Brownfield Environments (Docker Swarm / Compose, Swagger UI, 9-Spine Stubs, and Automated TypeScript Contract Generation)

---

## 00 · Orientation: The Gateway across the Chasm

In a brownfield application migration, the frontend cannot wait weeks for legacy backend teams to re-architect or consolidate endpoints. Nor can modern Angular components talk directly to three or four uncoordinated legacy backend systems (`main-api`, `secure-api`, `picker1-api`, `picker2-api`) without importing crippling technical debt.

```
                  ┌───────────────────────────────────────────────┐
                  │              The Brownfield Chasm             │
                  └───────────────────────┬───────────────────────┘
                                          │
       WITHOUT A BFF (Direct API Tangling)│  WITH THE BFF TEMPLATE (Day 0 Single-Door)
                                          │
  ┌───────────────────────┐               │  ┌───────────────────────┐
  │ Legacy Angular Client │               │  │ Modern Angular Client │
  └───┬───────┬───────┬───┘               │  └───────────┬───────────┘
      │       │       │                   │              │ /api/v1/*
      ▼       ▼       ▼                   │              ▼
  ┌──────┐┌──────┐┌──────┐                │    ┌───────────────────┐
  │main  ││secure││picker│                │    │ Fastify 5.x BFF   │
  │-api  ││-api  ││-api  │                │    │ (Coalesce, Stubs) │
  └──────┘└──────┘└──────┘                │    └─────────┬─────────┘
  4 Network roundtrips, CORS tangles,     │              │ Aggregated Upstreams
  duplicated requests, no single door.    │              ▼
                                          │    ┌──────┐┌──────┐┌──────┐
                                          │    │main  ││secure││picker│
                                          │    └──────┘└──────┘└──────┘
```

This handbook is the operational desk reference for standing up the **BFF Template microservice** on **Day 0**. It guides backend, DevOps, and frontend engineers through:
1. **Zero-Kubernetes Deployment**: Packaging the BFF as a standalone container running on **Docker Compose** locally and **Docker Swarm** in production.
2. **Day-0 Pathway Verification**: Validating CORS, reverse proxies, and cookie propagation before writing any UI logic (`/api/v1/ping`).
3. **The Living Swagger Contract**: Interactive API exploration (`/documentation`) and OpenAPI 3.1 specification (`/documentation/json`).
4. **The Frontend Superpower**: Automatically generating bulletproof TypeScript interfaces directly from the live Swagger schema—eliminating manual typing bugs forever.
5. **The Three-Phase Stub-to-Hydration Protocol**: Unblocking frontend feature development immediately with canonical 9-spine stubs while backend engineers audit and hydrate live upstreams.

---

## 01 · The Standalone BFF Topology

The BFF template lives in an autonomous repository: [`/mnt/data/projects/bff-template`](file:///mnt/data/projects/bff-template) (or GitLab `halo/bff-template.git`).

### The Docker Swarm Overlay Network
In production enterprise environments where Kubernetes is not yet deployed, the BFF deploys as a replicated microservice attached to a Docker Swarm overlay network (`bff-net`):

```
┌────────────────────────────────────────────────────────────────────────┐
│ Docker Swarm Overlay Network: bff-net                                  │
│                                                                        │
│  ┌─────────────────────────┐               ┌────────────────────────┐  │
│  │  Client: Browser        │               │  BFF Service (Replica) │  │
│  │  (via Reverse Proxy)    │               │  Fastify 5.x           │  │
│  │                         │               │  Internal Port: 3000   │  │
│  │  GET /api/v1/ping       ├──────────────►│                        │  │
│  │  GET /api/v1/*/discover │               │  - Request Coalescing  │  │
│  │  GET /documentation     │               │  - 9-Spine Normalizer  │  │
│  │                         │               │  - Swagger UI / OpenAPI│  │
│  └─────────────────────────┘               └───────────┬────────────┘  │
│                                                        │               │
└────────────────────────────────────────────────────────┼───────────────┘
                                                         │ Internal Upstream Calls
                                                         ▼
                                             ┌───────────────────────┐
                                             │ Legacy Upstream APIs  │
                                             │ (main-api, auth-api)  │
                                             └───────────────────────┘
```

### Core Invariants of the Template
1. **Single Door**: The frontend consumes exactly one origin. All entity discovery, pagination, faceted search, and modal catalog calls go through `/api/v1/*`.
2. **Single-Flight Request Coalescing**: Duplicate in-flight requests (e.g. rapid user filter clicks or multiple browser tabs) are coalesced into a single upstream call, protecting fragile legacy backends.
3. **Dual-Origin CORS Handling**: Configurable origins via `BFF_CORS_ORIGIN` allow seamless local development from Angular (`http://localhost:4200`) while strictly isolating production domains.
4. **The Canonical 9-Spine Contract**: Every discovery endpoint returns identical metadata spines, abstracting domain-specific quirks into an isolated `attributes` bag.

---

## 20 · Precondition: The Day-0 Pathway & Second Witness Audit

Before altering frontend components or implementing complex aggregation logic, you must prove that the network pathway is sound.

> [!IMPORTANT]
> **The Second Witness Rule**: Never trust legacy TypeScript model interfaces or static API documentation. Legacy interfaces often list optional fields that backends haven't returned in years, or omit critical status fields. Always capture the **actual wire JSON emitted by existing endpoints** in your browser's Network DevTools. These wire captures serve as the canonical test fixtures for the BFF.

### Precondition Checklist
1. **Reverse Proxy & Routing**: Verify that requests to `/api/v1/*` route cleanly to internal port `3000`.
2. **CORS & Credentials**: Verify that `Access-Control-Allow-Credentials: true` is honored when the Angular client sends session cookies.
3. **Node.js Runtime**: Ensure Node.js `>= 20.x` is available for local execution, or Docker Engine `>= 24.x` for containerized runs.

---

## 21 · Step 1: Stand Up & Configure the BFF Microservice

Clone the template repository into your workspace:

```bash
git clone http://gitlab.minilab/halo/bff-template.git /mnt/data/projects/bff-template
cd /mnt/data/projects/bff-template
```

### 1. Environment Configuration
Copy the sample environment file:
```bash
cp .env.example .env
```

Inspect and tune `.env`:
```ini
# Server Configuration
PORT=3000
HOST=0.0.0.0
NODE_ENV=development
LOG_LEVEL=info

# Operational Mode: stub | hybrid | live
BFF_MODE=stub

# Security & CORS (Permit Angular dev server)
BFF_CORS_ORIGIN=http://localhost:4200,http://localhost:3000

# Upstream Legacy Service URLs
UPSTREAM_MAIN_API_URL=http://legacy-main-api:8080
UPSTREAM_SECURE_API_URL=http://legacy-secure-api:8080
UPSTREAM_TIMEOUT_MS=5000
```

### 2. Install Dependencies & Build
```bash
npm install
npm run build
```

### 3. Verify Local Execution
Start the service with hot-reloading:
```bash
npm run dev
```

In another terminal, execute the container health check:
```bash
curl -i http://localhost:3000/healthz
# HTTP/1.1 200 OK -> {"status":"ok","uptime":...}
```

---

## 22 · Step 2: The Pathway Verification Probe (`GET /api/v1/ping`)

The template includes a dedicated diagnostic probe: `GET /api/v1/ping`.

### What the Probe Reveals
When invoked, `/api/v1/ping` echoes back the exact environment seen by Fastify:
```json
{
  "status": "ok",
  "timestamp": "2026-09-26T12:00:00.000Z",
  "service": "bff-template",
  "echo": {
    "ip": "127.0.0.1",
    "userAgent": "Mozilla/5.0 ...",
    "origin": "http://localhost:4200",
    "host": "localhost:3000"
  },
  "cookiesPresent": ["session_id", "auth_token"]
}
```

### Angular Pathway Service
Frontend teams can immediately drop this diagnostic service into the Angular codebase to prove connectivity on application boot:

```typescript
// src/app/core/services/pathway.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface PingResponse {
  status: string;
  timestamp: string;
  echo: {
    ip: string;
    userAgent: string;
    origin?: string;
  };
  cookiesPresent: string[];
}

@Injectable({ providedIn: 'root' })
export class PathwayService {
  private http = inject(HttpClient);
  private bffUrl = 'http://localhost:3000/api/v1';

  verifyPathway(): Observable<PingResponse> {
    return this.http.get<PingResponse>(`${this.bffUrl}/ping`, {
      withCredentials: true // Validates credentialed CORS flow
    });
  }
}
```

---

## 23 · Step 3: Swagger UI as the Living Contract

The BFF provides an interactive **Swagger UI** and OpenAPI 3.1 specification powered by `@fastify/swagger` and `@fastify/swagger-ui`.

- **Interactive UI**: `http://localhost:3000/documentation`
- **OpenAPI 3.1 JSON**: `http://localhost:3000/documentation/json`
- **Short Redirect**: `http://localhost:3000/docs`

```
┌────────────────────────────────────────────────────────────────────────┐
│ bff-template / Fastify 5.x Swagger UI                                  │
│ http://localhost:3000/documentation                                    │
├────────────────────────────────────────────────────────────────────────┤
│ ▼ System & Diagnostics                                                 │
│   GET  /healthz             Container liveness check                   │
│   GET  /api/v1/health       Service readiness and upstream probe       │
│   GET  /api/v1/ping         Echo client IP, headers, and cookies       │
│                                                                        │
│ ▼ Page Loop (Discovery)                                                │
│   GET  /api/v1/{domain}/discover   Canonical 9-spine page loop query   │
│                                                                        │
│ ▼ Picker Loop (Catalogs)                                               │
│   GET  /api/v1/{domain}/pickers/{id}   Modal selector options catalog  │
└────────────────────────────────────────────────────────────────────────┘
```

### The "Try it out" Workflow for Frontend Engineers
Frontend developers should use Swagger UI to execute requests before writing TypeScript:
1. Expand `GET /api/v1/{domain}/discover`.
2. Click the white **Try it out** button.
3. Supply parameters:
   - `domain`: `automobile`
   - `page`: `1`
   - `pageSize`: `10`
   - `q`: `hybrid`
4. Click the blue **Execute** button.
5. Inspect the generated **Curl** command, the **Request URL**, and the **Response Body**.

### The Canonical 9-Spine Contract
All discover responses follow the strict 9-spine standard. Every item returned across every domain guarantees these 9 top-level fields:

| Field | Type | Description |
|---|---|---|
| `id` | `string` | Unique entity identifier (e.g. `auto-001`). |
| `title` | `string` | Primary human-readable display label. |
| `domain` | `string` | Context domain (e.g. `automobile`, `train`, `plane`). |
| `status` | `string` | Lifecycle state (`active`, `archived`, `draft`). |
| `created_at`| `string` | ISO 8601 creation timestamp. |
| `updated_at`| `string` | ISO 8601 last modification timestamp. |
| `owner_id` | `string` | Owning user, department, or tenant. |
| `version` | `integer` | Optimistic concurrency record version. |
| `facets` | `object` | Key-value faceted filter classification pairs. |
| *`attributes`* | `object` | Domain-specific custom payload bag (VIN, mileage, payload capacity). |

---

## 24 · Step 4: The Superpower — Automated TypeScript Contract Generation

> [!CAUTION]
> **The Manual Transcription Anti-Pattern**: Never permit frontend developers to manually write TypeScript interfaces by copying JSON snippets into interface files. Manual copying creates subtle casing discrepancies (`created_at` vs `createdAt`), missed nullable fields, and silent contract divergence that only surfaces as runtime UI crashes in production.

Instead, execute the **OpenAPI-to-TypeScript Superpower**: generate exact, compile-time verified TypeScript contracts directly from the BFF's live Swagger JSON endpoint!

```
                               THE SUPERPOWER
┌────────────────────────────────┐         ┌────────────────────────────────┐
│   Fastify Swagger JSON         │         │   Angular Frontend Project     │
│   http://localhost:3000/       ├────────►│   src/app/core/models/         │
│   documentation/json           │         │   bff-contract.ts              │
└────────────────────────────────┘         └────────────────────────────────┘
   (Single Source of Truth)                   (100% Typed, Zero Human Drift)
```

### Step-by-Step Implementation in the Angular Client

#### 1. Install `openapi-typescript` as a Dev Dependency
In your Angular application root:
```bash
npm install -D openapi-typescript
```

#### 2. Add the Generation Script to `package.json`
```json
{
  "scripts": {
    "generate:api": "openapi-typescript http://localhost:3000/documentation/json -o src/app/core/models/bff-contract.ts"
  }
}
```

#### 3. Run the Generator
Ensure the BFF is running on port 3000, then execute:
```bash
npm run generate:api
```

This outputs a pristine, fully typed contract file: `src/app/core/models/bff-contract.ts`.

#### 4. Import and Use in Modern Angular Services
Extract and export the generated types cleanly:

```typescript
// src/app/core/models/bff-types.ts
import { components } from './bff-contract';

// Extract pristine types directly from OpenAPI schemas:
export type PingResponse = components['schemas']['PingResponse'];
export type CanonicalRecord = components['schemas']['CanonicalRecord'];
export type DiscoverResponse = components['schemas']['DiscoverResponse'];
export type PickerResponse = components['schemas']['PickerResponse'];
```

Now, wire them directly into your Angular `DiscoveryService`:

```typescript
// src/app/features/discovery/services/discovery.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { DiscoverResponse } from '../../../core/models/bff-types';

@Injectable({ providedIn: 'root' })
export class DiscoveryService {
  private http = inject(HttpClient);
  private bffUrl = 'http://localhost:3000/api/v1';

  discover(domain: string, page = 1, pageSize = 10, q?: string): Observable<DiscoverResponse> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('pageSize', pageSize.toString());

    if (q) params = params.set('q', q);

    return this.http.get<DiscoverResponse>(`${this.bffUrl}/${domain}/discover`, { params });
  }
}
```

> [!TIP]
> **The Compile-Time Gate**: When a backend engineer renames a field or alters a type in the BFF, running `npm run generate:api` causes the Angular TypeScript compiler to immediately red-flag every affected component during build time—preventing bugs from ever reaching QA.

---

## 25 · Step 5: The Three-Phase Stub-to-Hydration Protocol

The BFF template operates across three distinct operational phases via `BFF_MODE`:

```
                  ┌───────────────────────────────────────────────┐
                  │              BFF_MODE Lifecycle               │
                  └───────────────────────┬───────────────────────┘
                                          │
              ┌───────────────────────────┼───────────────────────────┐
              ▼                           ▼                           ▼
      [ BFF_MODE=stub ]          [ BFF_MODE=hybrid ]          [ BFF_MODE=live ]
    Day 0 - Day 3              Day 4 - Day 14               Production Cutover
  All endpoints return        Automobile hits live         All domains aggregate
  canonical mock records.     upstreams; Train & Plane     from live upstreams with
  Unblocks UI immediately.    serve stubs.                 circuit breaking.
```

### Phase 1: `BFF_MODE=stub` (Day 0–3)
- All requests return structured, realistic in-memory records from `src/stubs/automobile.stub.ts` and `src/stubs/pickers.stub.ts`.
- Frontend engineers begin building URL-First query controls, dynamic tables, and modal dialogs on Day 1.
- Zero dependency on live backend infrastructure.

### Phase 2: `BFF_MODE=hybrid` (Day 4–14)
- Used during incremental migration.
- Primary domain (`automobile`) connects to live legacy upstreams (`UPSTREAM_MAIN_API_URL`, `UPSTREAM_SECURE_API_URL`).
- Auxiliary domains (`train`, `plane`) continue serving stubs.
- In `src/routes/discover.ts`, implement the upstream fetch and 9-spine normalizer:
  ```typescript
  // Normalizing legacy upstream response into CanonicalRecord
  const canonicalItem: CanonicalRecord = {
    id: legacyItem.vehicle_id,
    title: `${legacyItem.year} ${legacyItem.make} ${legacyItem.model}`,
    domain: 'automobile',
    status: legacyItem.is_active ? 'active' : 'archived',
    created_at: legacyItem.registration_date,
    updated_at: new Date().toISOString(),
    owner_id: legacyItem.fleet_code,
    version: legacyItem.revision_num,
    facets: {
      make: legacyItem.make,
      fuel: legacyItem.fuel_type
    },
    attributes: {
      vin: legacyItem.vin,
      mileage: legacyItem.current_mileage
    }
  };
  ```

### Phase 3: `BFF_MODE=live` (Production Cutover)
- All domains aggregate live upstreams through `singleFlight` request coalescing and circuit breakers.
- The Angular frontend requires **zero code changes** between stub and live modes because the wire contract is identical.

---

## 26 · Step 6: Docker Swarm Deployment (Zero Kubernetes)

In production environments without Kubernetes, deploy the BFF directly to Docker Swarm.

### 1. Multi-Stage Production Dockerfile
The template includes an optimized multi-stage build:
```dockerfile
# /mnt/data/projects/bff-template/Dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json tsconfig.json ./
RUN npm ci
COPY src ./src
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -S bffgroup && adduser -S bffuser -G bffgroup
COPY package*.json ./
RUN npm ci --only=production
COPY --from=builder /app/dist ./dist
USER bffuser
EXPOSE 3000
CMD ["node", "dist/server.js"]
```

### 2. Docker Swarm Stack Specification
```yaml
# /mnt/data/projects/bff-template/docker-compose.yml
version: '3.8'

services:
  bff:
    image: localhost/bff-template:v1.0.0
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - HOST=0.0.0.0
      - PORT=3000
      - BFF_MODE=stub
      - LOG_LEVEL=info
      - BFF_CORS_ORIGIN=http://localhost:4200,http://app.legacy.local
    deploy:
      replicas: 2
      restart_policy:
        condition: on-failure
      update_config:
        parallelism: 1
        delay: 10s
        order: start-first
    networks:
      - bff-net
    healthcheck:
      test: ["CMD-SHELL", "wget -qO- http://localhost:3000/healthz || exit 1"]
      interval: 10s
      timeout: 3s
      retries: 3
      start_period: 5s

networks:
  bff-net:
    driver: overlay
    attachable: true
```

### 3. Swarm Operations
```bash
# Initialize Docker Swarm (if not active)
docker swarm init

# Build local container image
docker compose build

# Deploy the stack
docker stack deploy -c docker-compose.yml bff

# Inspect running replicas
docker stack services bff
docker service ps bff_bff

# Perform zero-downtime rolling update
docker service update --image localhost/bff-template:v1.1.0 bff_bff
```

---

## 27 · Domain Configuration Scaffolding: The 30/70 Reality
### Automated Scaffolding as an Architectural Floor, Not a Finished Product

In Volumes 2 and 3 of the architectural canon, modern Angular frontends achieve 100% domain-blind component reuse through the **Four Narrow Config Families** (*Vol 2 Ch 06-02*) and the single source of truth defined in the **ResourceDefinition** (*Vol 3 Ch 04-01*). 

To accelerate brownfield migrations, the BFF template includes an automated Day-0 Contract Harvester:
```bash
npm run scaffold:domain -- --domain=<domainName>
```

> [!CAUTION]
> **The Myth of the 80% Automated Scaffolder**:
> Junior engineers and hasty project managers often look at code generation tools and assume they deliver "80% or 95% complete configuration." **This is a dangerous delusion that causes critical architectural defects.**
>
> In reality, automated contract introspection provides a **~30% to 35% mechanical baseline**. The remaining **65% to 70% of domain effort requires deliberate human architectural curation**.
>
> An API contract (Swagger/OpenAPI) describes *transport boundaries*, not *user interaction boundaries*. A compiler can parse field names and JSON datatypes, but it cannot infer user search workflows, column priorities, anti-corruption aliases, modal picker loops, or analytical metrics. Treat the scaffolder as a **floor**, never as a finished product.

---

### The 4-Family Reality Audit

To understand why automated scaffolding covers only ~30–35% of the total domain implementation, examine what can be mechanically extracted from an API contract versus what requires human architectural decisions:

| Config Family | Automated by Script (~30–35%) | Requires Human Architectural Curation (~65–70%) | Net Automation |
|---|---|---|---|
| **Family 1: Filters**<br>*(Vol 2 Ch 06-02)* | • Query parameter names<br>• Primitive scalar datatypes (`string`, `number`, `boolean`, `date`)<br>• Basic text/number inputs<br>• Algorithmic range pairing heuristics (`fooMin`/`fooMax`, `min_foo`/`max_foo`) | • Widget selection: which fields are `autocomplete`, `multiselect`, `select`, or `range`<br>• Dynamic catalog endpoints (`optionsEndpoint`, `autocompleteEndpoint`)<br>• Human-friendly labels and placeholders<br>• Separation into primary toolbar vs drawer filters<br>• Array serialization format (CSV, pipe, or repeated keys) | **~40%** |
| **Family 2: Table Columns**<br>*(Vol 2 Ch 06-02)* | • Discovered attributes as column candidates<br>• Column sortable flags<br>• Basic data formatting types (`numeric`, `date`, `text`)<br>• Primary entity key (`dataKey: 'id'`) | • Column visibility: hiding technical IDs, UUIDs, audit timestamps (`visible: false`)<br>• Responsive column widths (`width: '120px'`, `'240px'`)<br>• Sticky column pinning and display priority<br>• **Row expansion cardinality**: determining whether row detail is a 1:1 local projection or a 1:many sub-resource fetch | **~60%** |
| **Family 3: Modal Pickers**<br>*(Vol 2 Ch 06-02)* | • **Zero automation possible**.<br>A discovery endpoint exposes flat entity records, not secondary search-and-select workflows. | • Modal picker catalog endpoints (`/api/v1/:domain/pickers/:id`)<br>• Multi-domain foreign key resolution dialogs<br>• Modal search filters, selection modes (single vs multi), and selection chips | **0%** |
| **Family 4: Analytical Charts**<br>*(Vol 2 Ch 06-02)* | • **Zero automation possible**.<br>An entity contract defines individual records, not analytical aggregations. | • Metric selection (sums, averages, counts)<br>• Visualization widget type (bar, donut, time-series)<br>• Facet bucket dimensions and cross-filtering interactions | **0%** |
| **The Anti-Corruption Seam**<br>*(Vol 3 Ch 04-01)* | • Defaults wire parameters to identity (`urlParam = apiParam`). | • Defining `urlParam` aliases to insulate client state and URL bookmarkability from legacy backend parameter churn and naming inconsistencies | **0%** |
| **Mechanical Boilerplate** | • TypeScript interfaces for domain models<br>• `ResourceDefinition` object AST<br>• Angular `DOMAIN_CONFIG` injection token wiring<br>• Pagination and sorting parameter binding | • Verifying DI module scoping and type safety | **~90%** |

---

### The Weighted Labor Distribution

When evaluating the true engineering labor required to stand up a new domain in a brownfield application, the effort naturally partitions into three distinct phases:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    TOTAL DOMAIN IMPLEMENTATION LABOR                        │
├──────────────────────────────┬──────────────────────────────┬───────────────┤
│ PHASE A: Mechanical Baseline │ PHASE B: Semantic Curation   │ PHASE C: UX   │
│ (Transcription & AST Syntax) │ (Anti-Corruption & Semantics)│ (Workflows)   │
│ ~30% of Total Effort         │ ~35% of Total Effort         │ ~35% of Total │
├──────────────────────────────┼──────────────────────────────┼───────────────┤
│    100% AUTOMATED            │        0% AUTOMATED          │  0% AUTOMATED │
│  (scaffold-domain-config)    │     (Human Architect)        │ (Human Dev)   │
└──────────────────────────────┴──────────────────────────────┴───────────────┘
```

1. **Phase A: Mechanical Transcription (~30% of total effort — 100% Automated)**:
   - Extracting 20–50 property names without spelling errors or casing mismatches.
   - Parsing OpenAPI schemas and probing live Fastify wire payloads ("Second Witness").
   - Generating `ResourceDefinition`, `DomainConfig`, and TypeScript model ASTs.
   - **Value**: Eliminates the "blank page problem", guarantees structural conformance with the textbook architecture, and saves 2–4 hours of rote typing.

2. **Phase B: Semantic Curation & Anti-Corruption (~35% of total effort — 0% Automated)**:
   - Human reasoning guided by business rules and backend reality.
   - Deciding which 8 columns out of 35 should be visible by default in the grid.
   - Identifying catalog-backed filters and wiring their lookup endpoints.
   - Establishing URL parameter aliases (`urlParam`) to prevent wire leaks into browser history.

3. **Phase C: Interactive Workflows & Analytics (~35% of total effort — 0% Automated)**:
   - Authoring modal search pickers (Family 3) for entity relationships and foreign keys.
   - Designing analytical facet charts (Family 4) to summarize dataset distributions.
   - Integrating domain-specific action buttons, status badge styling, and detail drawers.

**Net Result**: Automated tooling achieves **~30–35% total project acceleration**. Engineers who treat scaffolding as a "turnkey 80% solution" ship uncurated, brittle interfaces that leak backend implementation details directly into the UI.

---

### The Second Witness Contract Probe

Static OpenAPI/Swagger documents in legacy environments are notoriously incomplete. Backend developers frequently return undeclared dynamic attributes or omit query parameter schemas.

To guarantee accurate scaffolding, `scaffold-domain-config.ts` uses the **Second Witness Protocol**:
1. **First Witness (OpenAPI Schema)**: It queries `/documentation/json` (or reads a local `openapi.json`) to extract path parameters, query parameters, and declared schema models.
2. **Second Witness (Live Wire Probe)**: If the remote schema is missing or incomplete, the script boots the Fastify application in-process and executes an injection probe (`GET /api/v1/:domain/discover?size=1`). It harvests actual runtime wire attributes from live responses or 9-spine stubs, merging undeclared fields into the resource catalog.
3. **Generic Algorithmic Range Pairing**: Without any hardcoded domain assumptions, the script detects reciprocal range patterns (`fooMin`/`fooMax`, `min_foo`/`max_foo`, `foo_from`/`foo_to`, `fooStart`/`fooEnd`) and automatically configures range pairing.

---

### The 5-Point Human Architectural Audit Protocol

Immediately after running `npm run scaffold:domain`, the engineer **MUST** open the generated `<domain>.resource.ts` file and execute the 5-point curation protocol before wiring components:

```typescript
// src/domains/<domain>/<domain>.resource.ts

export const AUTOMOBILE_RESOURCE: ResourceDefinition = {
  name: 'automobile',
  label: 'Automobile Discovery',
  // ...
  fields: [
    // ─────────────────────────────────────────────────────────────────────────
    // STEP 1: RANGE PAIRING AUDIT (Vol 2 Ch 08-04)
    // Verify min/max fields share identical rangeField and rangeRole.
    // Collapses two wire parameters into a single user-facing range slider.
    // ─────────────────────────────────────────────────────────────────────────
    {
      name: 'priceMin',
      label: 'Price Min',
      type: 'number',
      filterable: true,
      filterType: 'range',
      rangeField: 'price',
      rangeRole: 'min'
    },
    {
      name: 'priceMax',
      label: 'Price Max',
      type: 'number',
      filterable: true,
      filterType: 'range',
      rangeField: 'price',
      rangeRole: 'max'
    },

    // ─────────────────────────────────────────────────────────────────────────
    // STEP 2: TABLE VISIBILITY & COLUMN LAYOUT (Vol 3 Ch 04-01)
    // Hide technical IDs and audit stamps. Tune explicit widths.
    // ─────────────────────────────────────────────────────────────────────────
    {
      name: 'id',
      label: 'ID',
      type: 'string',
      visible: false,      // Do not clutter the primary table with technical UUIDs
      sortable: false
    },
    {
      name: 'title',
      label: 'Vehicle Description',
      type: 'string',
      visible: true,
      sortable: true,
      width: '260px',
      dataType: 'text'
    },

    // ─────────────────────────────────────────────────────────────────────────
    // STEP 3: UI FILTER CONTROL TYPES (Vol 2 Ch 06-02)
    // Elevate plain text inputs to catalog-driven autocompletes or multiselects.
    // ─────────────────────────────────────────────────────────────────────────
    {
      name: 'make',
      label: 'Manufacturer',
      type: 'string',
      filterable: true,
      filterType: 'multiselect',
      optionsEndpoint: '/api/v1/automobile/pickers/makes'
    },

    // ─────────────────────────────────────────────────────────────────────────
    // STEP 4: THE ANTI-CORRUPTION SEAM (Vol 3 Ch 04-01 §Where it breaks)
    // Map client URL parameters to wire parameters to prevent contract churn.
    // ─────────────────────────────────────────────────────────────────────────
    {
      name: 'category',
      label: 'Body Style',
      type: 'string',
      filterable: true,
      urlParam: 'bodyStyle',     // Client URL: ?bodyStyle=suv
      apiParam: 'category'       // Upstream Wire: ?category=suv
    },

    // ─────────────────────────────────────────────────────────────────────────
    // STEP 5: HIGHLIGHTING CHANNEL (Vol 2 Ch 08-04)
    // Enable fields that participate in the 'h_*' highlight query channel.
    // ─────────────────────────────────────────────────────────────────────────
    {
      name: 'model',
      label: 'Model Name',
      type: 'string',
      highlightable: true
    }
  ]
};
```

---

### Command Line Reference

```bash
# Scaffolding via running Fastify instance (default: localhost:3000)
npm run scaffold:domain -- --domain=inventory

# Scaffolding via explicit remote Swagger URL
npm run scaffold:domain -- --domain=order --url=http://api.staging.internal/documentation/json

# Scaffolding via static OpenAPI specification file
npm run scaffold:domain -- --domain=customer --spec=./specs/customer-api.json --out=./src/domains
```

---

## 90 · Verification: The Door Holds

Execute these six verification checks before declaring Step 1 of the migration complete:

### Check 1: Container Liveness & Health
```bash
curl -s http://localhost:3000/healthz | grep '"status":"ok"'
```
*Expected*: Exit code 0, returns JSON with uptime and process metrics.

### Check 2: Pathway Echo Probe
```bash
curl -s -H "Origin: http://localhost:4200" http://localhost:3000/api/v1/ping | grep '"echo"'
```
*Expected*: Echoes caller origin, IP, and headers. Validates reverse proxy and CORS routing.

### Check 3: OpenAPI Specification Validity
```bash
curl -s http://localhost:3000/documentation/json | grep '"openapi":"3.1'
```
*Expected*: Returns valid OpenAPI 3.1 JSON contract definition.

### Check 4: Automated Type Generation Gate
In the frontend project:
```bash
npm run generate:api && npx tsc --noEmit
```
*Expected*: Exits 0 with zero TypeScript errors in generated contract types.

### Check 5: Unit Test Suite
In the BFF project:
```bash
npm test
```
*Expected*: 9/9 tests pass (ping, health, discover, and swagger documentation suites).

### Check 6: Domain Configuration Scaffolder Baseline
In the BFF project:
```bash
npm run scaffold:domain -- --domain=automobile
```
*Expected*: Discovers contract fields via OpenAPI/Second Witness, generates baseline `automobile.resource.ts`, `automobile.domain-config.ts`, and `automobile.models.ts`, and outputs the 30/70 curation warning.
