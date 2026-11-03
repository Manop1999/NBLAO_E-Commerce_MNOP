import { describe, expect, it } from 'vitest'
import { createApiCatalogRepository } from '../apiRepository'
import { mapCatalog } from '../mapApiProduct'
import { CatalogLoadError, type ApiProductPage } from '../types'
import { buildSearchIndex, matchesQuery } from '../../lib/productSearch'
import { fromEnglish } from '../../lib/dictionaries'
import { apiProduct } from './fixtures'

interface FakeServerOptions {
  total: number
  /** Override a page response before it is returned (to simulate a misbehaving server). */
  tamper?: (page: number, body: ApiProductPage) => unknown
  status?: number
}

/** In-memory /api server implementing the same pagination contract as server/src/catalog. */
function fakeFetch({ total, tamper, status = 200 }: FakeServerOptions) {
  const all = Array.from({ length: total }, (_, i) => apiProduct(i + 1))
  const calls: string[] = []
  const fetchImpl = (async (input: RequestInfo | URL) => {
    const url = new URL(String(input), 'http://test.invalid')
    calls.push(url.pathname + url.search)
    if (status !== 200) return new Response('{}', { status })
    if (url.pathname === '/api/brands') {
      return Response.json({ items: [{ id: 'brand-test', name: 'Test Brand', nameLo: null, logoUrl: null, websiteUrl: null, displayOrder: 1 }] })
    }
    const page = Number(url.searchParams.get('page'))
    const pageSize = Number(url.searchParams.get('pageSize'))
    const body: ApiProductPage = {
      items: all.slice((page - 1) * pageSize, page * pageSize),
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    }
    return Response.json(tamper ? tamper(page, body) : body)
  }) as typeof fetch
  return { fetchImpl, calls }
}

const loadError = async (promise: Promise<unknown>): Promise<CatalogLoadError> => {
  try {
    await promise
  } catch (error) {
    if (error instanceof CatalogLoadError) return error
    throw error
  }
  throw new Error('expected a CatalogLoadError')
}

describe('listAllProducts pagination', () => {
  it('loads every page of a 250-product catalog (3 pages of 100)', async () => {
    const { fetchImpl, calls } = fakeFetch({ total: 250 })
    const products = await createApiCatalogRepository({ fetch: fetchImpl }).listAllProducts()
    expect(products).toHaveLength(250)
    expect(new Set(products.map(p => p.id)).size).toBe(250)
    expect(calls).toEqual([
      '/api/products?page=1&pageSize=100&sort=featured',
      '/api/products?page=2&pageSize=100&sort=featured',
      '/api/products?page=3&pageSize=100&sort=featured',
    ])
  })

  it('puts products from later pages into the browser search index (EN, SKU, LO, TH)', async () => {
    const { fetchImpl } = fakeFetch({ total: 250 })
    const repository = createApiCatalogRepository({ fetch: fetchImpl })
    const catalog = mapCatalog(await repository.listAllProducts(), await repository.listBrands())
    const indexes = new Map(catalog.products.map(p => [p.id, buildSearchIndex(p, 'Test Brand', [fromEnglish.lo, fromEnglish.th])]))
    const search = (query: string) => catalog.products.filter(p => matchesQuery(indexes.get(p.id)!, query)).map(p => p.id)

    // #237 is on page 3.
    expect(search('Catalog Item 237')).toEqual([237])
    expect(search('SKU-0237')).toEqual([237])
    expect(search('sku0237')).toEqual([237])
    expect(search(fromEnglish.lo['Generators']!)).toEqual([237])
    expect(search(fromEnglish.th['Generators']!)).toEqual([237])
    expect(search('Catalog Item 250')).toEqual([250])
  })

  it('handles an empty catalog and an exactly full last page', async () => {
    expect(await createApiCatalogRepository({ fetch: fakeFetch({ total: 0 }).fetchImpl }).listAllProducts()).toEqual([])
    expect(await createApiCatalogRepository({ fetch: fakeFetch({ total: 200 }).fetchImpl }).listAllProducts()).toHaveLength(200)
  })

  it('refuses catalogs larger than the page limit instead of truncating', async () => {
    const { fetchImpl, calls } = fakeFetch({ total: 501 })
    const error = await loadError(createApiCatalogRepository({ fetch: fetchImpl, maxPages: 5 }).listAllProducts())
    expect(error.code).toBe('too_large')
    expect(calls).toHaveLength(1)
  })

  it('fails when the catalog changes while loading', async () => {
    const { fetchImpl } = fakeFetch({ total: 250, tamper: (page, body) => (page === 2 ? { ...body, total: 251 } : body) })
    expect((await loadError(createApiCatalogRepository({ fetch: fetchImpl }).listAllProducts())).code).toBe('inconsistent')
  })

  it('fails when the server ignores the page parameter (no infinite loop, no duplicates)', async () => {
    const { fetchImpl, calls } = fakeFetch({ total: 250, tamper: (_page, body) => ({ ...body, page: 1 }) })
    const error = await loadError(createApiCatalogRepository({ fetch: fetchImpl }).listAllProducts())
    expect(error.code).toBe('inconsistent')
    expect(calls.length).toBeLessThanOrEqual(2)
  })

  it('fails when a page repeats products from an earlier page', async () => {
    const first = Array.from({ length: 100 }, (_, i) => apiProduct(i + 1))
    const { fetchImpl } = fakeFetch({ total: 250, tamper: (page, body) => (page === 2 ? { ...body, items: first } : body) })
    expect((await loadError(createApiCatalogRepository({ fetch: fetchImpl }).listAllProducts())).message).toMatch(/two catalog pages/)
  })

  it('fails on a short or empty page before the last page', async () => {
    const short = fakeFetch({ total: 250, tamper: (page, body) => (page === 2 ? { ...body, items: body.items.slice(0, 50) } : body) })
    expect((await loadError(createApiCatalogRepository({ fetch: short.fetchImpl }).listAllProducts())).code).toBe('inconsistent')
    const empty = fakeFetch({ total: 250, tamper: (page, body) => (page === 2 ? { ...body, items: [] } : body) })
    expect((await loadError(createApiCatalogRepository({ fetch: empty.fetchImpl }).listAllProducts())).code).toBe('inconsistent')
  })

  it('fails when page metadata does not add up', async () => {
    const { fetchImpl } = fakeFetch({ total: 250, tamper: (_page, body) => ({ ...body, totalPages: 2 }) })
    expect((await loadError(createApiCatalogRepository({ fetch: fetchImpl }).listAllProducts())).code).toBe('inconsistent')
  })

  it('rejects malformed responses', async () => {
    const cases: ((page: number, body: ApiProductPage) => unknown)[] = [
      () => ({ items: 'nope' }),
      (_p, body) => ({ ...body, items: [{ ...body.items[0], price: { minor: '-1', currency: 'USD', decimals: 2 } }, ...body.items.slice(1)] }),
      (_p, body) => ({ ...body, items: [{ ...body.items[0], legacyId: '1' }, ...body.items.slice(1)] }),
    ]
    for (const tamper of cases) {
      const { fetchImpl } = fakeFetch({ total: 10, tamper })
      expect((await loadError(createApiCatalogRepository({ fetch: fetchImpl }).listAllProducts())).code).toBe('invalid_response')
    }
  })

  it('reports HTTP and network errors without falling back to anything', async () => {
    expect((await loadError(createApiCatalogRepository({ fetch: fakeFetch({ total: 10, status: 503 }).fetchImpl }).listAllProducts())).code).toBe('http')
    const offline = (async () => {
      throw new TypeError('Failed to fetch')
    }) as typeof fetch
    expect((await loadError(createApiCatalogRepository({ fetch: offline }).listAllProducts())).code).toBe('network')
  })

  it('stops when aborted', async () => {
    const controller = new AbortController()
    const fetchImpl = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      controller.abort()
      throw init?.signal?.reason ?? new DOMException('aborted', 'AbortError')
    }) as typeof fetch
    expect((await loadError(createApiCatalogRepository({ fetch: fetchImpl }).listAllProducts(controller.signal))).code).toBe('aborted')
  })

  it('uses a relative API path only', async () => {
    const { fetchImpl, calls } = fakeFetch({ total: 1 })
    await createApiCatalogRepository({ fetch: fetchImpl }).listBrands()
    expect(calls).toEqual(['/api/brands'])
  })
})
