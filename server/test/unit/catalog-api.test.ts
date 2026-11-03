import { afterEach, describe, expect, it, vi } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildApp } from '../../src/app'
import type { CatalogReader } from '../../src/catalog/reader'
import type { ProductPage, PublicBrand, PublicProduct } from '../../src/catalog/dto'
import type { ProductListQuery } from '../../src/catalog/query'

const product: PublicProduct = {
  id: '6c1d1f8e-0000-4000-8000-000000000001',
  legacyId: 1,
  sku: 'EE-TRF-001',
  name: 'Transformer',
  model: 'T-1',
  brand: { id: 'brand-siemens', name: 'Siemens' },
  category: { slug: 'electrical-equipment/transformers', name: 'Transformers', parent: { slug: 'electrical-equipment', name: 'Electrical Equipment' } },
  price: { minor: '2850000', currency: 'USD', decimals: 2 },
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
  featured: true,
  demoOptions: false,
  isDemo: true,
  images: [],
  variants: [],
}
const brand: PublicBrand = { id: 'brand-siemens', name: 'Siemens', nameLo: null, logoUrl: null, websiteUrl: null, displayOrder: 1 }

let app: FastifyInstance | undefined
const make = (catalog: CatalogReader) => {
  app = buildApp({ logLevel: 'silent', checkDatabase: () => Promise.resolve(), catalog })
  return app
}
const fakeReader = (overrides: Partial<CatalogReader> = {}): CatalogReader => ({
  listProducts: vi.fn(async (query: ProductListQuery): Promise<ProductPage> => ({ items: [product], page: query.page, pageSize: query.pageSize, total: 1, totalPages: 1 })),
  listBrands: vi.fn(async () => [brand]),
  ...overrides,
})

afterEach(async () => {
  await app?.close()
  app = undefined
})

describe('GET /api/products', () => {
  it('returns the page envelope and passes the validated query to the reader', async () => {
    const reader = fakeReader()
    const response = await make(reader).inject({ method: 'GET', url: '/api/products?page=2&pageSize=10&sort=name_asc&brand=brand-siemens&q=trans' })
    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ items: [product], page: 2, pageSize: 10, total: 1, totalPages: 1 })
    expect(reader.listProducts).toHaveBeenCalledWith({ page: 2, pageSize: 10, sort: 'name_asc', category: undefined, brand: 'brand-siemens', q: 'trans' })
    expect(response.headers['cache-control']).toBe('no-store')
    expect(response.headers['access-control-allow-origin']).toBeUndefined()
  })

  it('rejects invalid queries with the error envelope and never calls the reader', async () => {
    const reader = fakeReader()
    const instance = make(reader)
    for (const url of ['/api/products?pageSize=101', '/api/products?page=0', '/api/products?sort=cost', '/api/products?isDemo=false', '/api/products?page=1&page=2']) {
      const response = await instance.inject({ method: 'GET', url })
      expect(response.statusCode, url).toBe(400)
      const body = response.json()
      expect(body.error.code).toBe('invalid_query')
      expect(body.error.message).toBe('Invalid query parameters')
      expect(Array.isArray(body.error.issues)).toBe(true)
    }
    expect(reader.listProducts).not.toHaveBeenCalled()
  })

  it('hides internal failures behind a generic 500', async () => {
    const reader = fakeReader({ listProducts: vi.fn(async () => Promise.reject(new Error('relation "products" does not exist; password=s3cret'))) })
    const response = await make(reader).inject({ method: 'GET', url: '/api/products' })
    expect(response.statusCode).toBe(500)
    expect(response.json()).toEqual({ error: { code: 'internal', message: 'Internal server error' } })
    expect(response.body).not.toMatch(/s3cret|relation|stack/)
  })
})

describe('GET /api/brands', () => {
  it('returns active brands in an items envelope', async () => {
    const response = await make(fakeReader()).inject({ method: 'GET', url: '/api/brands' })
    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ items: [brand] })
  })

  it('rejects query parameters', async () => {
    const response = await make(fakeReader()).inject({ method: 'GET', url: '/api/brands?active=false' })
    expect(response.statusCode).toBe(400)
    expect(response.json().error.code).toBe('invalid_query')
  })
})

describe('read-only surface', () => {
  it('has no write routes and answers unknown API paths with the 404 envelope', async () => {
    const instance = make(fakeReader())
    for (const [method, url] of [
      ['POST', '/api/products'],
      ['PUT', '/api/products'],
      ['DELETE', '/api/brands'],
      ['GET', '/api/products/1'],
      ['GET', '/api/categories'],
      ['GET', '/api/admin'],
    ] as const) {
      const response = await instance.inject({ method, url })
      expect(response.statusCode, `${method} ${url}`).toBe(404)
      expect(response.json()).toEqual({ error: { code: 'not_found', message: 'Route not found' } })
    }
  })

  it('keeps health and readiness unchanged', async () => {
    const instance = make(fakeReader())
    expect((await instance.inject({ method: 'GET', url: '/api/health' })).json()).toEqual({ status: 'ok' })
    expect((await instance.inject({ method: 'GET', url: '/api/ready' })).json()).toEqual({ status: 'ready', checks: { database: 'ok' } })
  })
})
