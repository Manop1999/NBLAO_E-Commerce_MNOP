/*
 * Catalog repository backed by the local API (`/api`, served through the Vite dev proxy). The base path is
 * relative on purpose: no host name is ever compiled into the bundle.
 *
 * listAllProducts() follows the server's pagination metadata until the last page and refuses to return a
 * partial catalog: every inconsistency raises CatalogLoadError instead.
 */
import { isApiBrandList, isApiProductPage } from './guards'
import { CatalogLoadError, type ApiBrand, type ApiProduct, type ApiProductPage, type CatalogRepository } from './types'

/** Server maximum (server/src/catalog/query.ts MAX_PAGE_SIZE). */
export const CATALOG_PAGE_SIZE = 100
/** 50 × 100 = 5,000 products. Beyond that, browser-side search is the wrong design (see server/README.md). */
export const MAX_CATALOG_PAGES = 50

export interface ApiRepositoryOptions {
  fetch?: typeof fetch
  basePath?: string
  pageSize?: number
  maxPages?: number
}

export function createApiCatalogRepository(options: ApiRepositoryOptions = {}): CatalogRepository {
  const doFetch = options.fetch ?? ((input, init) => globalThis.fetch(input, init))
  const basePath = options.basePath ?? '/api'
  const pageSize = options.pageSize ?? CATALOG_PAGE_SIZE
  const maxPages = options.maxPages ?? MAX_CATALOG_PAGES

  async function getJson(path: string, signal?: AbortSignal): Promise<unknown> {
    let response: Response
    try {
      response = await doFetch(`${basePath}${path}`, { headers: { accept: 'application/json' }, signal })
    } catch (error) {
      if (signal?.aborted || (error instanceof DOMException && error.name === 'AbortError')) {
        throw new CatalogLoadError('aborted', 'Catalog request was cancelled')
      }
      throw new CatalogLoadError('network', 'The catalog service could not be reached')
    }
    if (!response.ok) throw new CatalogLoadError('http', `The catalog service answered ${response.status}`)
    try {
      return await response.json()
    } catch {
      throw new CatalogLoadError('invalid_response', 'The catalog service returned invalid JSON')
    }
  }

  async function getPage(page: number, signal?: AbortSignal): Promise<ApiProductPage> {
    const body = await getJson(`/products?page=${page}&pageSize=${pageSize}&sort=featured`, signal)
    if (!isApiProductPage(body)) throw new CatalogLoadError('invalid_response', `Catalog page ${page} has an unexpected format`)
    if (body.page !== page || body.pageSize !== pageSize) {
      throw new CatalogLoadError('inconsistent', `Catalog page ${page} answered for page ${body.page} (size ${body.pageSize})`)
    }
    if (body.items.length > pageSize) throw new CatalogLoadError('inconsistent', `Catalog page ${page} has too many items`)
    return body
  }

  return {
    async listAllProducts(signal) {
      const first = await getPage(1, signal)
      const { total, totalPages } = first
      if (totalPages !== Math.ceil(total / pageSize)) throw new CatalogLoadError('inconsistent', 'Catalog page count does not match the total')
      if (totalPages > maxPages) {
        throw new CatalogLoadError('too_large', `The catalog has ${total} products, more than this storefront can load (${maxPages * pageSize})`)
      }

      const products: ApiProduct[] = []
      const seen = new Set<string>()
      for (let page = 1; page <= Math.max(totalPages, 1); page++) {
        const current = page === 1 ? first : await getPage(page, signal)
        if (current.total !== total || current.totalPages !== totalPages) {
          throw new CatalogLoadError('inconsistent', 'The catalog changed while it was loading')
        }
        const isLast = page >= totalPages
        const expected = isLast ? total - (totalPages - 1) * pageSize : pageSize
        if (totalPages > 0 && current.items.length !== expected) {
          throw new CatalogLoadError('inconsistent', `Catalog page ${page} has ${current.items.length} products, expected ${expected}`)
        }
        for (const item of current.items) {
          if (seen.has(item.id)) throw new CatalogLoadError('inconsistent', `Product ${item.sku} appeared on two catalog pages`)
          seen.add(item.id)
          products.push(item)
        }
      }
      if (products.length !== total) throw new CatalogLoadError('inconsistent', `Loaded ${products.length} of ${total} products`)
      return products
    },

    async listBrands(signal): Promise<ApiBrand[]> {
      const body = await getJson('/brands', signal)
      if (!isApiBrandList(body)) throw new CatalogLoadError('invalid_response', 'Brand list has an unexpected format')
      return body.items
    },
  }
}
