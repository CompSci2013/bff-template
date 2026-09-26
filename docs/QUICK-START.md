# Quick-Start Guide: Generating Initial Domain Configurations

> **The Two Sides of the Fence**:
> - **BFF Side (Producer)**: Runs Fastify, serves live Swagger (`/documentation/json`), and runs `scaffold:domain` to harvest properties into UI config files.
> - **Angular Side (Consumer)**: Runs `openapi-typescript` to generate network wire types, receives the UI config files, applies the 5-point curation, and wires the route provider.

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

---

### Step 1 [Location: BFF Repository] — Identify Your Target Domain
1. Open `http://localhost:3000/documentation` in your browser.
2. Locate the entity endpoint you need to configure (e.g., `GET /api/v1/{domain}/discover`).
3. Note your domain slug: `<domain>` (for example: `orders`, `claims`, `patients`, `inventory`, `policies`).

---

### Step 2 [Location: Angular Application] — Generate Network Wire Types (`openapi-typescript`)
In your **Angular application** root terminal, generate compile-time TypeScript interfaces directly from the BFF's OpenAPI schema:
```bash
npx openapi-typescript http://localhost:3000/documentation/json -o src/app/core/models/bff-contract.ts
```
*Why here:* Angular is the consumer. This creates compile-time TypeScript types (`DiscoverPayload`, `CanonicalRecord`, `PingResponse`) so `HttpClient` services are 100% type-safe against the backend wire contract.

---

### Step 3 [Location: BFF Repository] — Scaffold Initial Domain Configuration (`scaffold:domain`)
Switch to your **BFF repository** terminal. Run the contract harvester for your domain:
```bash
npm run scaffold:domain -- --domain=<domain>
```
*(If Swagger runs on a different port or remote host, add `--url=http://<host>:<port>/documentation/json`)*.

**Output created in `src/domains/<domain>/`**:
- `<domain>.resource.ts` — Single Source of Truth (`ResourceDefinition`)
- `<domain>.domain-config.ts` — Angular DI Provider (`provideDomainConfig()`)
- `<domain>.models.ts` — Canonical 9-Spine TypeScript interfaces

---

### Step 4 [Location: Filesystem Transfer] — Copy Domain Configs to Angular
Copy the generated domain directory from the BFF into your Angular application:
```bash
cp -r /path/to/bff-template/src/domains/<domain> /path/to/angular-app/src/app/domains/
```

---

### Step 5 [Location: Angular Application] — Curate `<domain>.resource.ts` (The 5-Point Edit)
In your **Angular application**, open `src/app/domains/<domain>/<domain>.resource.ts`.  
The scaffolder established the ~30–35% mechanical baseline; now apply the remaining 65–70% human architectural curation:

1. **Table Visibility & Column Widths**:
   - Set `visible: false` on internal keys, UUIDs, or audit timestamps.
   - Assign explicit column widths (`width: '140px'`, `width: '260px'`) on visible columns.

2. **UI Filter Widget Types**:
   - Change default `'text'` to `'autocomplete'` or `'multiselect'` on catalog fields.
   - Set `optionsEndpoint: '/api/v1/<domain>/pickers/<pickerId>'` to point to the lookup catalog.

3. **Range Pairing**:
   - For numeric boundaries (e.g. `<metric>Min` / `<metric>Max`), ensure they share identical `rangeField: '<metric>'` and `rangeRole: 'min' | 'max'`.

4. **The Anti-Corruption Seam (`urlParam`)**:
   - If the backend API wire parameter name is legacy/cryptic (`apiParam: 'STAT_CD_X'`), set `urlParam: 'status'` to keep the browser URL clean, readable, and bookmarkable.

5. **Highlighting Channel**:
   - Set `highlightable: true` on fields that participate in keyword search matching (`h_*` channel).

---

### Step 6 [Location: Angular Application] — Register Domain in Angular Routes
In your **Angular application** routing configuration (`routes.ts` or component):
```typescript
import { Routes } from '@angular/router';
import { provideDomainConfig } from './domains/<domain>/<domain>.domain-config';
import { DiscoveryContainerComponent } from './features/discovery/discovery-container.component';

export const routes: Routes = [
  {
    path: '<domain>',
    component: DiscoveryContainerComponent,
    providers: [
      provideDomainConfig()
    ]
  }
];
```

---

### Step 7 [Location: Angular Application] — Verify in the Browser
In your **Angular application** terminal, start the development server:
```bash
ng serve
```
Open `http://localhost:4200/<domain>`:
1. Verify the table renders with your curated columns, widths, and sort headers.
2. Verify filters render with correct control types (`autocomplete`, `multiselect`, `range`).
3. Trigger a search or sort and verify the BFF responds with 200 OK.
