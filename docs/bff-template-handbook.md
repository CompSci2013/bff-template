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

## 90 · Verification: The Door Holds

Execute these five verification checks before declaring Step 1 of the migration complete:

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
