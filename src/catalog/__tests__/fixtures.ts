import type { ApiProduct } from '../types'

/** A synthetic API product; #237 is the only "Generators" product, all others are "Transformers". */
export function apiProduct(n: number, overrides: Partial<ApiProduct> = {}): ApiProduct {
  const sub = n === 237 ? 'Generators' : 'Transformers'
  return {
    id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
    legacyId: n,
    sku: `SKU-${String(n).padStart(4, '0')}`,
    name: `Catalog Item ${n}`,
    model: null,
    brand: { id: 'brand-test', name: 'Test Brand' },
    category: { slug: `power/${sub.toLowerCase()}`, name: sub, parent: { slug: 'power', name: 'Power & Energy' } },
    price: { minor: String(n * 100), currency: 'USD', decimals: 2 },
    priceUnit: 'per unit',
    minOrderQuantity: null,
    leadTime: null,
    shortDescription: null,
    description: null,
    specs: [],
    options: [],
    applications: [],
    tags: [],
    certifications: [],
    featured: false,
    demoOptions: false,
    isDemo: true,
    images: [{ url: `/products/${n}.jpg`, altText: null, position: 0 }],
    variants: [],
    ...overrides,
  }
}
