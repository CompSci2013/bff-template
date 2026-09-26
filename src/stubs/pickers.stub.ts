// src/stubs/pickers.stub.ts
import { PickerPayload } from '../types/canonical.js';

export const PICKER_STUBS: Record<string, PickerPayload> = {
  '1': {
    id: '1',
    domain: 'automobile',
    title: 'Trim Level Catalog',
    multiSelect: true,
    options: [
      { value: 'LE', label: 'LE (Standard)', count: 28, category: 'Base' },
      { value: 'SE', label: 'SE (Sport Edition)', count: 34, category: 'Sport' },
      { value: 'XLE', label: 'XLE (Luxury)', count: 18, category: 'Luxury' },
      { value: 'XSE', label: 'XSE (Sport Luxury)', count: 22, category: 'Luxury' },
      { value: 'TRD', label: 'TRD (Performance)', count: 12, category: 'Performance' },
      { value: 'Touring', label: 'Touring Elite', count: 15, category: 'Luxury' }
    ]
  },
  '2': {
    id: '2',
    domain: 'automobile',
    title: 'Powertrain & Fuel Catalog',
    multiSelect: false,
    options: [
      { value: 'gasoline', label: 'Internal Combustion (Gasoline)', count: 112 },
      { value: 'hybrid', label: 'Hybrid Electric (HEV)', count: 44 },
      { value: 'phev', label: 'Plug-in Hybrid (PHEV)', count: 20 },
      { value: 'bev', label: 'Battery Electric (BEV)', count: 30 }
    ]
  }
};

export function getPickerStub(id: string, domain = 'automobile'): PickerPayload {
  const stub = PICKER_STUBS[id];
  if (stub) return stub;

  return {
    id,
    domain,
    title: `Generic Modal Catalog (${id})`,
    multiSelect: true,
    options: [
      { value: 'opt-1', label: 'Standard Tier Option', count: 10 },
      { value: 'opt-2', label: 'Premium Tier Option', count: 25 },
      { value: 'opt-3', label: 'Enterprise Tier Option', count: 8 }
    ]
  };
}
