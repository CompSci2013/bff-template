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

## 2. API Surface & Pathway Verification

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

## 3. Frontend Developer Quick Guide: Using Swagger UI

Frontend developers (especially junior engineers) should use Swagger UI (`http://localhost:3000/documentation`) as an interactive development harness rather than manually guessing API contracts or hardcoding mock shapes.

> 📖 **Full Guide**: For detailed walkthroughs, parameter breakdowns, Angular `HttpClient` code samples, and automated TypeScript contract generation, see [**Frontend Developer Guide: Swagger UI & OpenAPI**](docs/swagger-guide-for-frontend.md).

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
   - Use the **Try it out** button with path parameter `domain: automobile` and query parameters `page: 1`, `pageSize: 10` to see real JSON payloads returned by Fastify.

---

## 4. Quick Start & Local Execution

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

---

## 5. Production Deployment: Docker Swarm

This project is configured out-of-the-box for **Docker Swarm** environments with zero Kubernetes dependency.

### 1. Initialize Swarm (if not already active)
```bash
docker swarm init
```

### 2. Deploy the Stack
Deploy the BFF as a replicated, auto-healing swarm service on an overlay network:
```bash
docker stack deploy -c docker-compose.yml bff
```

### 3. Verify Swarm Service & Rolling Updates
```bash
# Check running service replicas
docker stack services bff
docker service ps bff_bff

# Zero-downtime rolling update when releasing a new image
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

## 7. Directory Layout

```
bff-template/
├── Dockerfile                  # Multi-stage production container build
├── docker-compose.yml          # Swarm-ready deployment specification
├── package.json                # Dependencies: Fastify 5, CORS, Cookies, Vitest
├── tsconfig.json               # TypeScript ES2022 / NodeNext configuration
├── docs/
│   └── swagger-guide-for-frontend.md  # Detailed guide for FE devs using Swagger
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
│       └── canonical.ts        # Shared contract interfaces
└── tests/
    ├── discover.test.ts        # Contract tests
    ├── health.test.ts          # Probe tests
    ├── ping.test.ts            # Network pathway tests
    └── swagger.test.ts         # OpenAPI & Swagger UI tests
```

