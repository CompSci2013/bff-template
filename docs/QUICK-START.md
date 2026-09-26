# Quick-Start Guide: Generating Initial Domain Configurations

**Precondition**: The Fastify BFF is up and running. Swagger UI is accessible at `http://localhost:3000/documentation` (and `http://localhost:3000/documentation/json`).

Follow these 6 numbered steps in exact chronological order:

---

### 1. Identify Your Target Domain
Open `http://localhost:3000/documentation` in your browser.
Locate the entity endpoint you need to configure (e.g., `/api/v1/{domain}/discover`).
Note your domain slug: `<domain>` (for example: `orders`, `claims`, `patients`, `inventory`, `policies`).

---

### 2. Run the Automated Scaffolder
In your BFF repository terminal, execute the scaffolder with your domain:
```bash
npm run scaffold:domain -- --domain=<domain>
```

*(Optional: If Swagger runs on a different port or remote host)*:
```bash
npm run scaffold:domain -- --domain=<domain> --url=http://<host>:<port>/documentation/json
```

**Output created in `src/domains/<domain>/`**:
- `<domain>.resource.ts` — Single Source of Truth (`ResourceDefinition`)
- `<domain>.domain-config.ts` — Angular DI Provider (`provideDomainConfig()`)
- `<domain>.models.ts` — Canonical 9-Spine TypeScript interfaces

---

### 3. Copy Generated Files to the Angular Client
Copy the generated domain folder into your Angular project:
```bash
cp -r src/domains/<domain> /path/to/angular-app/src/app/domains/
```

---

### 4. Perform the 5-Point Human Architectural Curation
Open `src/app/domains/<domain>/<domain>.resource.ts` in your editor. The script provides a ~30–35% baseline; you must now apply the remaining 65–70% human business decisions:

1. **Table Visibility & Column Widths**:
   - Set `visible: false` on internal keys, UUIDs, or audit timestamps.
   - Set explicit column widths (`width: '140px'`, `width: '260px'`) on visible columns.

2. **UI Filter Widget Types**:
   - Change default `'text'` to `'autocomplete'` or `'multiselect'` on catalog fields.
   - Set `optionsEndpoint: '/api/v1/<domain>/pickers/<pickerId>'` to point to the lookup catalog.

3. **Range Pairing**:
   - For numeric boundaries (e.g. `<metric>Min` / `<metric>Max`), ensure they share identical `rangeField: '<metric>'` with `rangeRole: 'min' | 'max'`.

4. **The Anti-Corruption Seam (`urlParam`)**:
   - If the backend API wire parameter name is legacy/cryptic (`apiParam: 'STAT_CD_X'`), set `urlParam: 'status'` to keep the browser URL clean, readable, and bookmarkable.

5. **Highlighting Channel**:
   - Set `highlightable: true` on fields that participate in keyword search matching (`h_*` channel).

---

### 5. Register the Domain in Angular Routes
In your Angular application routing configuration (`routes.ts` or component):
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

### 6. Verify in the Browser
Start the Angular development server (`ng serve`) and navigate to `http://localhost:4200/<domain>`:
1. Verify the table renders with your curated columns, widths, and sort headers.
2. Verify filters render with correct control types (`autocomplete`, `multiselect`, `range`).
3. Trigger a search or sort and verify the BFF responds with 200 OK.
