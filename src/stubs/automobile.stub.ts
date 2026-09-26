// src/stubs/automobile.stub.ts
import { DiscoverPayload, CanonicalRecord } from '../types/canonical.js';

export const AUTOMOBILE_RECORDS: CanonicalRecord[] = [
  {
    id: 'auto-toyota-camry-2024',
    domain: 'automobile',
    title: '2024 Toyota Camry',
    manufacturer: 'Toyota',
    model: 'Camry',
    year: 2024,
    category: 'Sedan',
    count: 42,
    hasChildren: true,
    attributes: {
      msrp: 26420,
      fuelType: 'Gasoline',
      transmission: '8-Speed Automatic',
      horsepower: 203,
      vinCount: 42
    }
  },
  {
    id: 'auto-honda-civic-2024',
    domain: 'automobile',
    title: '2024 Honda Civic',
    manufacturer: 'Honda',
    model: 'Civic',
    year: 2024,
    category: 'Sedan',
    count: 35,
    hasChildren: true,
    attributes: {
      msrp: 23950,
      fuelType: 'Gasoline',
      transmission: 'CVT',
      horsepower: 158,
      vinCount: 35
    }
  },
  {
    id: 'auto-ford-f150-2024',
    domain: 'automobile',
    title: '2024 Ford F-150',
    manufacturer: 'Ford',
    model: 'F-150',
    year: 2024,
    category: 'Truck',
    count: 65,
    hasChildren: true,
    attributes: {
      msrp: 36570,
      fuelType: 'Gasoline / EcoBoost',
      transmission: '10-Speed Automatic',
      horsepower: 325,
      vinCount: 65
    }
  },
  {
    id: 'auto-chevrolet-corvette-2023',
    domain: 'automobile',
    title: '2023 Chevrolet Corvette',
    manufacturer: 'Chevrolet',
    model: 'Corvette',
    year: 2023,
    category: 'Coupe',
    count: 14,
    hasChildren: true,
    attributes: {
      msrp: 64500,
      fuelType: 'Gasoline',
      transmission: '8-Speed Dual Clutch',
      horsepower: 490,
      vinCount: 14
    }
  },
  {
    id: 'auto-tesla-model3-2024',
    domain: 'automobile',
    title: '2024 Tesla Model 3',
    manufacturer: 'Tesla',
    model: 'Model 3',
    year: 2024,
    category: 'Sedan',
    count: 50,
    hasChildren: true,
    attributes: {
      msrp: 38990,
      fuelType: 'Electric',
      transmission: 'Single-Speed',
      horsepower: 271,
      vinCount: 50
    }
  }
];

export function getAutomobileStub(query: Record<string, any> = {}): DiscoverPayload {
  let filtered = [...AUTOMOBILE_RECORDS];

  if (query['make'] || query['manufacturer']) {
    const make = String(query['make'] || query['manufacturer']).toLowerCase();
    filtered = filtered.filter(r => r.manufacturer.toLowerCase().includes(make));
  }
  if (query['q']) {
    const q = String(query['q']).toLowerCase();
    filtered = filtered.filter(r => r.title.toLowerCase().includes(q) || r.model.toLowerCase().includes(q));
  }
  if (query['category']) {
    const cat = String(query['category']).toLowerCase();
    filtered = filtered.filter(r => r.category.toLowerCase() === cat);
  }

  const page = parseInt(query['page'] ?? '1', 10);
  const pageSize = parseInt(query['size'] ?? query['pageSize'] ?? '25', 10);

  return {
    domain: 'automobile',
    results: filtered,
    total: filtered.length,
    page,
    pageSize,
    facets: {
      manufacturer: [
        { value: 'Toyota', count: 42 },
        { value: 'Honda', count: 35 },
        { value: 'Ford', count: 65 },
        { value: 'Chevrolet', count: 14 },
        { value: 'Tesla', count: 50 }
      ],
      category: [
        { value: 'Sedan', count: 127 },
        { value: 'Truck', count: 65 },
        { value: 'Coupe', count: 14 }
      ]
    },
    statistics: {
      totalInventory: 206,
      averageMSRP: 38086,
      electricFleetPercentage: 24.2
    }
  };
}

