# BFF Template: Standalone & Docker Swarm Microservice

A production-ready Fastify 5.x / TypeScript Backend-for-Frontend (BFF) template designed for **brownfield application migrations**.

It establishes the single-door network gateway between a legacy Angular frontend and upstream services in environments where Kubernetes is not yet present, deploying directly via **Docker Compose** or **Docker Swarm**.

---

## 1. Architectural Mission & The Day-0 Gateway

During a brownfield migration onto URL-First and Configurable Components, the frontend cannot wait weeks for legacy backend APIs to be refactored or unraveled. 

This BFF template solves that problem on **Day 0**:
1. **Verifies the Communication Pathway**: Contains `/api/v1/ping` and `/healthz` to prove routing, reverse proxying, CORS headers, and cookie handling before writing UI code.
2. **Quarantines Upstream Volatility with Stubs**: Returns canonical 9-Spine discovery data, facets, and modal catalogs from in-memory stubs so frontend developers can build modern components on Day 1.
3. **Incremental Hydration**: Allows routes to be switched from stubs to live upstream aggregations (`main-api`, `secure-api`, `picker-api`) domain-by-domain as backend endpoints are audited.
4. **Protects Upstreams**: Built-in in-flight request coalescing (`singleFlight`) guarantees duplicate requests from multiple tabs or UI spikes never overwhelm backend services.

---

## 2. Quick-Start Guide: From Running Swagger to Initial Angular Configuration

> ⚡ **Quick Reference**: For a standalone printable copy, see [**Quick-Start Guide**](docs/QUICK-START.md).

```
┌────────────────────────────────────────────────────────────────────────┐
│                        THE CONTRACT FENCE                              │
├───────────────────────────────────┬────────────────────────────────────┤
│         BFF REPO (Producer)       │      ANGULAR REPO (Consumer)       │
├───────────────────────────────────┼────────────────────────────────────┤
│ • Serves Swagger / OpenAPI 3.1    │ • Consumes BFF HTTP endpoints      │
│   (http://localhost:3000/         │                                    │
│    documentation/json)            │                                    │
│                                   │                                    │
│ • Runs: `scaffold:domain`         │ • Runs: `openapi-typescript`       │
│   Generates: UI CONFIG FILES      │   Generates: WIRE CONTRACT TYPES   │
│   (`<domain>.resource.ts`,        │   (`bff-contract.ts`)              │
│    `<domain>.domain-config.ts`)   │                                    │
│                                   │                                    │
│   What it produces:               │   What it produces:                │
│   Table columns, filter widgets,  │   Raw network interfaces:          │
│   ranges, pickers, and labels.    │   `PingResponse`, `CanonicalRecord`│
└───────────────────────────────────┴────────────────────────────────────┘
```

**Precondition**: The Fastify BFF is up and running (`npm run dev`) with Swagger UI accessible at `http://localhost:3000/documentation`.

Follow these 7 numbered steps in exact chronological order, noting the repository location for each step:

1. **Step 1 [Location: BFF Repository] — Identify Your Target Domain**:  
   Open `http://localhost:3000/documentation` in your browser. Locate the entity endpoint you need to configure (e.g., `GET /api/v1/{domain}/discover`). Note your domain slug: `<domain>` (e.g. `orders`, `claims`, `patients`, `inventory`, `policies`).

2. **Step 2 [Location: Angular Application] — Generate Network Wire Types (`openapi-typescript`)**:  
   In your **Angular application** root terminal, generate compile-time TypeScript interfaces directly from the BFF's OpenAPI schema:
   ```bash
   npx openapi-typescript http://localhost:3000/documentation/json -o src/app/core/models/bff-contract.ts
   ```
   *Why here:* Angular is the consumer. This creates compile-time TypeScript types (`DiscoverPayload`, `CanonicalRecord`, `PingResponse`) so `HttpClient` services are 100% type-safe against the backend wire contract.

3. **Step 3 [Location: BFF Repository] — Scaffold Initial Domain Configuration (`scaffold:domain`)**:  
   Switch to your **BFF repository** terminal. Run the contract harvester for your domain:
   ```bash
   npm run scaffold:domain -- --domain=<domain>
   ```
   *Creates in `src/domains/<domain>/`:* `<domain>.resource.ts` (ResourceDefinition), `<domain>.domain-config.ts` (Angular DI provider), and `<domain>.models.ts`.

4. **Step 4 [Location: Filesystem Transfer] — Copy Domain Configs to Angular**:  
   Copy the generated domain directory from the BFF into your Angular application:
   ```bash
   cp -r /path/to/bff-template/src/domains/<domain> /path/to/angular-app/src/app/domains/
   ```

5. **Step 5 [Location: Angular Application] — Curate `<domain>.resource.ts` (The 5-Point Edit)**:  
   In your **Angular application**, open `src/app/domains/<domain>/<domain>.resource.ts`. The script provides a ~30–35% baseline; you must now apply the remaining 65–70% human business decisions:
   - *Visibility & Widths*: Set `visible: false` on internal keys/UUIDs; assign explicit column widths (`width: '140px'`).
   - *Filter Types*: Change text inputs to `'autocomplete'` or `'multiselect'` with `optionsEndpoint: '/api/v1/<domain>/pickers/<pickerId>'`.
   - *Range Pairing*: Pair numeric boundaries (`<metric>Min`/`<metric>Max`) with identical `rangeField: '<metric>'` and `rangeRole: 'min' | 'max'`.
   - *Anti-Corruption Seam*: Set `urlParam: '<cleanParam>'` to prevent legacy wire names from leaking into the browser URL.
   - *Highlighting*: Set `highlightable: true` on fields participating in `h_*` keyword queries.

6. **Step 6 [Location: Angular Application] — Register Domain in Angular Routes**:  
   In your **Angular application** routing configuration (`routes.ts` or component):
   ```typescript
   import { provideDomainConfig } from './domains/<domain>/<domain>.domain-config';

   export const routes: Routes = [
     {
       path: '<domain>',
       component: DiscoveryContainerComponent,
       providers: [provideDomainConfig()]
     }
   ];
   ```

7. **Step 7 [Location: Angular Application] — Verify in Browser**:  
   In your **Angular application** terminal, run `ng serve` and open `http://localhost:4200/<domain>`. Confirm dynamic table columns, filters, and search queries operate cleanly against the BFF.

---

## 3. API Surface & Pathway Verification

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/documentation` | **Interactive Swagger UI**: Visual testing, parameter playground, and contract schema browser. |
| `GET` | `/documentation/json` | **OpenAPI 3.1 JSON**: Machine-readable specification for automated parity testing and type generation. |
| `GET` | `/healthz` | Container liveness check for Docker daemon and Swarm scheduler. |
| `GET` | `/api/v1/health` | Readiness probe reporting uptime, operational mode, and upstream reachability. |
| `GET` | `/api/v1/ping` | **Pathway probe**: Echoes caller IP, User-Agent, Origin, and cookies to verify connectivity. |
| `GET` | `/api/v1/:domain/discover` | **Page Loop**: Returns canonical 9-spine records, total count, facet buckets, and stats. |
| `GET` | `/api/v1/:domain/pickers/:id` | **Picker Loop**: Returns modal catalog options for secondary selection loops. |

---

## 4. Frontend Developer Guide: Using Swagger UI

Frontend developers (especially junior engineers) should use Swagger UI (`http://localhost:3000/documentation`) as an interactive development harness rather than manually guessing API contracts or hardcoding mock shapes.

> 📖 **Frontend Swagger Guide**: For detailed walkthroughs, parameter breakdowns, Angular `HttpClient` code samples, and automated TypeScript contract generation, see [**Frontend Developer Guide: Swagger UI & OpenAPI**](docs/swagger-guide-for-frontend.md).
> 📘 **Applied Handbook**: For the comprehensive operational runbook on standing up this microservice in Docker Swarm and brownfield environments, see [**BFF Template Applied: The Day-0 Gateway Handbook**](docs/bff-template-handbook.md).

### The 4-Step Frontend Workflow

1. **Verify the Pathway First**:
   - Hit `GET /api/v1/ping` in Swagger UI via **Try it out** to verify routing, headers, and reverse proxies before writing UI components.
2. **Inspect the Canonical 9-Spine Contract**:
   - Expand `GET /api/v1/:domain/discover`. Look at the **Response Schema** to understand the 9 immutable spine fields (`id`, `title`, `domain`, `status`, `created_at`, `updated_at`, `owner_id`, `version`, `facets`) and dynamic `attributes`.
3. **Generate TypeScript Types Automatically**:
   - Do not hand-craft response interfaces. Generate them directly from the OpenAPI schema:
     ```bash
     npx openapi-typescript http://localhost:3000/documentation/json -o src/app/core/models/bff-contract.ts
     ```
4. **Test Live in the UI**:
   - Use the **Try it out** button with path parameter `domain: <domain>` and query parameters `page: 1`, `pageSize: 10` to see real JSON payloads returned by Fastify.

---

## 5. Local Execution & Docker Swarm Deployment

### Local Development (Direct Node.js)
```bash
# 1. Install dependencies
npm install

# 2. Copy environment variables
cp .env.example .env

# 3. Run with hot-reloading
npm run dev

# 4. Run test suite
npm test
```

### Standalone Docker Execution
```bash
# Build and run container in background
docker compose up --build -d

# Verify container logs and health
docker compose logs -f
curl -i http://localhost:3000/api/v1/ping
```

### Production Deployment: Docker Swarm

This project is configured out-of-the-box for **Docker Swarm** environments with zero Kubernetes dependency:

```bash
# 1. Initialize Swarm (if not already active)
docker swarm init

# 2. Deploy the stack
docker stack deploy -c docker-compose.yml bff

# 3. Inspect running replicas
docker stack services bff
docker service ps bff_bff

# 4. Zero-downtime rolling update when releasing a new image
docker service update --image localhost/bff-template:v1.1.0 bff_bff
```

---

## 6. The Stub-to-Hydration Protocol

This service operates in three configurable modes via the `BFF_MODE` environment variable:

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

### Transitioning from Stub to Live
To hydrate a domain (e.g. `automobile`) with real upstream data:
1. Set `BFF_MODE=hybrid` in `.env` or `docker-compose.yml`.
2. Configure upstream URLs:
   ```bash
   UPSTREAM_MAIN_API_URL=http://legacy-main-api:8080
   UPSTREAM_SECURE_API_URL=http://legacy-auth-api:8080
   ```
3. Open `src/routes/discover.ts`. Implement the aggregation and mapping from raw upstream responses into the `DiscoverPayload` contract.
4. The frontend UI requires **zero changes** because the wire contract remains identical.

---

## 7. Domain Configuration Scaffolding (The 30/70 Baseline)

The repository includes a domain-agnostic contract harvester for generating Angular configuration families from OpenAPI / Swagger endpoints:

```bash
npm run scaffold:domain -- --domain=<domainName>
```

### The 30/70 Law: Automation vs. Architectural Curation
Automated tools cannot build user interfaces on their own. In accordance with Volumes 2 & 3 of the architectural canon:
- **What is Automated (~30–35% mechanical baseline)**: The script queries the live Swagger endpoint and probes live Fastify responses ("Second Witness") to extract property names, primitive scalar types, algorithmic range pairing (`min`/`max`), and generates `ResourceDefinition`, `DomainConfig`, and TypeScript model ASTs.
- **What Requires Human Curation (~65–70% architectural effort)**: An API schema does not define user interaction models. Engineers must complete the **5-Point Human Architectural Audit**:
  1. **Range Pairing Audit**: Ensure paired min/max fields share `rangeField` and `rangeRole`.
  2. **Table Visibility & Widths**: Hide technical IDs/timestamps (`visible: false`), assign explicit widths (`width: '180px'`), and determine row expansion cardinality.
  3. **Filter Control Types**: Elevate plain text filters to `autocomplete` or `multiselect` with catalog endpoints.
  4. **The Anti-Corruption Seam**: Map client URL parameters (`urlParam`) to backend wire parameters (`apiParam`) to protect browser state from backend churn.
  5. **Highlighting Channel**: Configure `highlightable: true` for fields participating in `h_*` query highlighting.
- **Pickers (Family 3) & Charts (Family 4)**: Modal search-and-select workflows and analytical chart aggregations are **0% automated** from discovery schemas and must be authored by domain engineers.

> 📘 **Full Architectural Breakdown**: For the exhaustive 4-Family Reality Audit Table, Weighted Labor Distribution, and the 5-point curation protocol, see [**BFF Template Applied Handbook §27**](docs/bff-template-handbook.md#27--domain-configuration-scaffolding-the-3070-reality).

---

## 8. Directory Layout

```
bff-template/
├── Dockerfile                  # Multi-stage production container build
├── docker-compose.yml          # Swarm-ready deployment specification
├── package.json                # Dependencies: Fastify 5, CORS, Cookies, Vitest
├── tsconfig.json               # TypeScript ES2022 / NodeNext configuration
├── docs/
│   ├── QUICK-START.md                 # 6-step sequential quick-start guide
│   ├── bff-template-handbook.md       # Operational handbook for brownfield standup
│   └── swagger-guide-for-frontend.md  # Detailed guide for FE devs using Swagger
├── scripts/
│   └── scaffold-domain-config.ts      # Universal Day-0 contract harvester & scaffolder
├── src/
│   ├── server.ts               # Process bootstrap and port binding
│   ├── app.ts                  # Fastify plugin configuration and CORS
│   ├── config/
│   │   └── env.ts              # Strongly typed environment configuration
│   ├── routes/
│   │   ├── health.ts           # /healthz and /api/v1/health
│   │   ├── ping.ts             # /api/v1/ping (pathway verification)
│   │   ├── discover.ts         # /api/v1/:domain/discover
│   │   └── pickers.ts          # /api/v1/:domain/pickers/:id
│   ├── services/
│   │   ├── coalescing.ts       # Single-flight request deduplication
│   │   └── upstream-client.ts  # HTTP client for upstream fetch & health
│   ├── stubs/
│   │   ├── automobile.stub.ts  # 9-Spine stub data and facet generator
│   │   └── pickers.stub.ts     # Modal catalog stub options
│   └── types/
│   │   └── canonical.ts        # Shared contract interfaces
│   └── domains/                # Scaffolding target directory for generated domains
└── tests/
    ├── discover.test.ts        # Contract tests
    ├── health.test.ts          # Probe tests
    ├── ping.test.ts            # Network pathway tests
    └── swagger.test.ts         # OpenAPI & Swagger UI tests
```

