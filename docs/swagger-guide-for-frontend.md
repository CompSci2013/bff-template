# Frontend Developer Guide: Using Swagger UI & OpenAPI with the BFF

This guide explains how frontend developers (particularly those working with Angular) can use the interactive **Swagger UI** and **OpenAPI specification** provided by this BFF as an indispensable development aid.

---

## 1. What is Swagger UI & Why Should You Care?

When developing frontend features against a Backend-For-Frontend (BFF), you should **never guess** endpoint URLs, query parameter names, payload shapes, or status codes. 

The BFF serves two documentation endpoints out of the box:
- **Interactive UI**: `http://localhost:3000/documentation` (Visual testing & schema browser)
- **Raw OpenAPI 3.1 JSON**: `http://localhost:3000/documentation/json` (Machine-readable contract for automated type generation)

```
┌────────────────────────────────────────────────────────────────────────┐
│                        The Contract-First Cycle                        │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
    1. Inspect in Swagger UI        │  Open http://localhost:3000/documentation
                                    ▼
    2. Test with "Try it out"       │  Execute request with realistic parameters
                                    ▼
    3. Generate TypeScript Types    │  npx openapi-typescript -> bff-contract.ts
                                    ▼
    4. Implement Angular Service    │  Call endpoint with HttpClient using generated types
```

---

## 2. Navigating the Swagger UI (Step-by-Step)

Open your browser to `http://localhost:3000/documentation`. You will see endpoints organized into functional tags:

| Tag | Purpose | Example Endpoints |
|---|---|---|
| **System & Diagnostics** | Infrastructure liveness, readiness, and pathway verification. | `GET /api/v1/ping`<br>`GET /healthz`<br>`GET /api/v1/health` |
| **Page Loop (Discovery)** | Primary entity listing, search, pagination, and faceted filtering. | `GET /api/v1/:domain/discover` |
| **Picker Loop (Catalogs)** | Catalog lookups for modal selectors, dialog pickers, and dropdowns. | `GET /api/v1/:domain/pickers/:id` |

---

## 3. Interactive Testing: The "Try it out" Feature

Swagger UI lets you execute live HTTP requests against the BFF directly from your browser without writing a single line of frontend code.

### Step-by-Step Walkthrough

```
1. Click the Endpoint Accordion (e.g. GET /api/v1/:domain/discover)
   └── Expands parameters, request options, and responses.

2. Click the white [ Try it out ] button (top right of the route box)
   └── Input fields become editable.

3. Fill in Parameters:
   ├── Path parameter:
   │   └── domain: automobile
   └── Query parameters:
       ├── q: sedan
       ├── page: 1
       └── pageSize: 10

4. Click the blue [ Execute ] button
   └── Fastify processes the request and renders the result.

5. Inspect the Server Response:
   ├── Curl: Exact curl command to reproduce this request from terminal.
   ├── Request URL: http://localhost:3000/api/v1/automobile/discover?q=sedan&page=1&pageSize=10
   ├── Server Response Code: 200 OK
   └── Response Body: JSON object containing items, meta, and facets.
```

---

## 4. Understanding Response Schemas

Below the "Execute" button, the **Responses** section defines the exact contract returned by the BFF.

### Schema View vs. Example Value
- **Example Value**: Shows real mock JSON data (e.g., sample automobile records).
- **Schema**: Shows TypeScript-like definitions indicating:
  - Which fields are **required** (marked with a red asterisk `*`).
  - The data type of each property (`string`, `integer`, `boolean`, `array`, `object`).
  - Valid enum values (e.g. `status: "active" | "archived" | "draft"`).

### The Canonical 9-Spine Contract
All discover records follow the canonical 9-spine schema. When building Angular tables or cards, your component interfaces should bind directly to these 9 immutable fields:

```typescript
{
  "id": "auto-001",              // 1. Unique global identifier
  "title": "2024 Hybrid Sedan",   // 2. Human-readable display label
  "domain": "automobile",         // 3. Entity domain
  "status": "active",             // 4. Lifecycle state
  "created_at": "2026-01-15...",  // 5. ISO 8601 creation timestamp
  "updated_at": "2026-03-20...",  // 6. ISO 8601 last modified timestamp
  "owner_id": "fleet-ops",        // 7. Owning team or tenant ID
  "version": 1,                   // 8. Optimistic concurrency version
  "facets": {                     // 9. Structured classification key-values
    "make": "Toyota",
    "fuel": "Hybrid"
  },
  "attributes": {                 // Domain-specific custom payload bag
    "vin": "1HGCR2F83HA000000",
    "mileage": 14200
  }
}
```

---

## 5. Angular Integration Examples

Here is how to translate what you see in Swagger into clean, modern Angular (v17+) services using `HttpClient` and `inject()`.

### Example 1: Verifying Backend Connectivity (`GET /api/v1/ping`)
Use this during app initialization or in a diagnostic panel to ensure the Angular app can reach the BFF.

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
      withCredentials: true // Proves cookie flow across CORS
    });
  }
}
```

---

### Example 2: Calling the Discovery Page Loop (`GET /api/v1/:domain/discover`)
Translate query parameters observed in Swagger into Angular's `HttpParams`.

```typescript
// src/app/features/discovery/services/discovery.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface DiscoverParams {
  domain: string;
  q?: string;
  page?: number;
  pageSize?: number;
  sort?: string;
  order?: 'asc' | 'desc';
  filters?: Record<string, string>;
}

export interface DiscoverResponse<T = Record<string, unknown>> {
  domain: string;
  mode: 'stub' | 'hybrid' | 'live';
  items: Array<{
    id: string;
    title: string;
    domain: string;
    status: string;
    created_at: string;
    updated_at: string;
    owner_id: string;
    version: number;
    facets: Record<string, string>;
    attributes: T;
  }>;
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  facets: Record<string, Array<{ value: string; count: number }>>;
}

@Injectable({ providedIn: 'root' })
export class DiscoveryService {
  private http = inject(HttpClient);
  private bffUrl = 'http://localhost:3000/api/v1';

  discover<T>(params: DiscoverParams): Observable<DiscoverResponse<T>> {
    let httpParams = new HttpParams();

    if (params.q) httpParams = httpParams.set('q', params.q);
    if (params.page) httpParams = httpParams.set('page', params.page.toString());
    if (params.pageSize) httpParams = httpParams.set('pageSize', params.pageSize.toString());
    if (params.sort) httpParams = httpParams.set('sort', params.sort);
    if (params.order) httpParams = httpParams.set('order', params.order);

    // Append arbitrary facet filters
    if (params.filters) {
      Object.entries(params.filters).forEach(([key, val]) => {
        if (val) httpParams = httpParams.set(`filter.${key}`, val);
      });
    }

    return this.http.get<DiscoverResponse<T>>(
      `${this.bffUrl}/${params.domain}/discover`,
      { params: httpParams }
    );
  }
}
```

---

### Example 3: Calling the Modal Picker Loop (`GET /api/v1/:domain/pickers/:id`)
Use this to populate modal selectors and dialog dropdowns.

```typescript
// src/app/shared/components/picker/picker.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface PickerOption {
  id: string;
  label: string;
  description?: string;
  badge?: string;
}

export interface PickerResponse {
  pickerId: string;
  domain: string;
  total: number;
  options: PickerOption[];
}

@Injectable({ providedIn: 'root' })
export class PickerService {
  private http = inject(HttpClient);
  private bffUrl = 'http://localhost:3000/api/v1';

  getPickerOptions(domain: string, pickerId: string): Observable<PickerResponse> {
    return this.http.get<PickerResponse>(`${this.bffUrl}/${domain}/pickers/${pickerId}`);
  }
}
```

---

## 6. Superpower: Generating TypeScript Types from OpenAPI

**Never manually write TypeScript interfaces from scratch for backend responses.** Human transcription causes typos (`created_at` vs `createdAt`), missed nullables, and subtle bugs.

Instead, let `openapi-typescript` generate exact interfaces directly from the BFF's live Swagger JSON endpoint!

### Step 1: Install `openapi-typescript` in your Frontend Project
```bash
npm install -D openapi-typescript
```

### Step 2: Add Generation Script to `package.json`
```json
{
  "scripts": {
    "generate:api": "openapi-typescript http://localhost:3000/documentation/json -o src/app/core/models/bff-contract.ts"
  }
}
```

### Step 3: Run Generation
Ensure your BFF is running locally on port 3000, then execute:
```bash
npm run generate:api
```

### Step 4: Use Generated Types in Your Angular Services
```typescript
import { components } from '../models/bff-contract';

// Extract exact types generated from Swagger schemas:
export type PingResponse = components['schemas']['PingResponse'];
export type CanonicalRecord = components['schemas']['CanonicalRecord'];
export type DiscoverResponse = components['schemas']['DiscoverResponse'];
export type PickerResponse = components['schemas']['PickerResponse'];
```

Whenever the backend team adds a new field or route, rerun `npm run generate:api` and TypeScript will immediately alert you to any contract changes at compile-time.

---

## 7. Common Gotchas & Troubleshooting

### 1. "It works in Swagger, but Angular shows a CORS Error!"
- **Cause**: Swagger runs in the same browser window or directly on `localhost:3000`. Your Angular dev server runs on `http://localhost:4200` (a different origin).
- **Fix**: Check `.env` in the BFF directory. Ensure `BFF_CORS_ORIGIN` includes your Angular port:
  ```bash
  BFF_CORS_ORIGIN=http://localhost:4200
  ```
- If your Angular app passes cookies, ensure you set `{ withCredentials: true }` in Angular's `HttpClient` calls.

### 2. Path Parameters vs. Query Parameters
- **Path Parameter (`:domain`)**: Embedded directly in the URL path.
  - Correct: `/api/v1/automobile/discover`
  - Incorrect: `/api/v1/discover?domain=automobile`
- **Query Parameter (`?q=sedan&page=1`)**: Appended after the `?` delimiter.
  - In Swagger, path parameters are marked with `(path)` and query parameters are marked with `(query)`.

### 3. Inspecting the Generated `curl` Command
If an Angular request fails with a 400 or 500 status code:
1. Re-run the request in Swagger UI with the same parameters.
2. Copy the generated **Curl** command from Swagger.
3. Paste it into your terminal:
   ```bash
   curl -X 'GET' 'http://localhost:3000/api/v1/automobile/discover?page=1' -H 'accept: application/json'
   ```
4. If the curl command succeeds in your terminal, the issue is on the Angular frontend (e.g. parameter serialization, missing headers, or CORS). If curl fails, the issue is on the BFF.

