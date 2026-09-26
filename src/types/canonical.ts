// src/types/canonical.ts

export interface CanonicalRecord {
  id: string;
  domain: string;
  title: string;
  manufacturer: string;
  model: string;
  year: number;
  category: string;
  count: number;
  hasChildren: boolean;
  attributes: Record<string, unknown>;
}

export interface FacetBucket {
  value: string | number;
  count: number;
  highlightCount?: number;
}

export interface DiscoverPayload {
  domain: string;
  results: CanonicalRecord[];
  total: number;
  page: number;
  pageSize: number;
  facets: Record<string, FacetBucket[]>;
  statistics: Record<string, unknown>;
}

export interface PickerOption {
  value: string;
  label: string;
  count?: number;
  category?: string;
  children?: PickerOption[];
}

export interface PickerPayload {
  id: string;
  domain: string;
  title: string;
  multiSelect: boolean;
  options: PickerOption[];
}

export interface HealthStatus {
  status: 'ok' | 'degraded' | 'error';
  mode: 'stub' | 'hybrid' | 'live';
  uptimeSeconds: number;
  timestamp: string;
  upstreams: Record<string, 'reachable' | 'unreachable' | 'stubbed'>;
}
