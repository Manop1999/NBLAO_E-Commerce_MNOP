import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { createApiCatalogRepository } from '../apiRepository'
import { CatalogStateProvider, loadStorefrontCatalog, type CatalogState } from '../CatalogProvider'
import { CatalogLoadError, type CatalogRepository } from '../types'
import { catalogNoticeKind, useCatalogNotice } from '../../components/CatalogStatus'
import { fromEnglish } from '../../lib/dictionaries'
import { mapApiProduct } from '../mapApiProduct'
import { apiProduct } from './fixtures'

/** The API answering successfully with zero products (no database involved). */
const emptyApiFetch = (async (input: RequestInfo | URL) => {
  const path = new URL(String(input), 'http://test.invalid').pathname
  if (path === '/api/brands') return Response.json({ items: [] })
  return Response.json({ items: [], page: 1, pageSize: 100, total: 0, totalPages: 0 })
}) as typeof fetch

const renderNotice = (value: CatalogState) => {
  function Probe() {
    return createElement('div', null, useCatalogNotice())
  }
  return renderToStaticMarkup(createElement(CatalogStateProvider, { value, children: createElement(Probe) }))
}

const apiState = (overrides: Partial<Extract<CatalogState, { source: 'api' }>>): CatalogState => ({
  source: 'api',
  status: 'ready',
  catalog: { products: [], brands: [], skipped: 0 },
  error: null,
  retry: () => {},
  ...overrides,
})

describe('empty API catalog', () => {
  it('loads as ready with zero products, not as an error', async () => {
    const result = await loadStorefrontCatalog(createApiCatalogRepository({ fetch: emptyApiFetch }))
    expect(result).toEqual({ status: 'ready', catalog: { products: [], brands: [], skipped: 0 } })
  })

  it('shows the empty notice, not loading or error', async () => {
    const result = await loadStorefrontCatalog(createApiCatalogRepository({ fetch: emptyApiFetch }))
    expect(result.status).toBe('ready')
    const state = apiState({ catalog: result.status === 'ready' ? result.catalog : null })
    expect(catalogNoticeKind(state)).toBe('empty')

    const html = renderNotice(state)
    expect(html).toContain('role="status"')
    expect(html).toContain('No products available')
    expect(html).toContain('The catalog does not contain any published products yet.')
    expect(html).not.toContain('Loading products')
    expect(html).not.toContain('could not be loaded')
    expect(html).not.toContain('Try again')
  })

  it('has Lao and Thai text for the empty notice', () => {
    for (const text of ['No products available', 'The catalog does not contain any published products yet.']) {
      expect(fromEnglish.lo[text]).toBeTruthy()
      expect(fromEnglish.th[text]).toBeTruthy()
    }
  })
})

describe('catalog notice for other states', () => {
  it('distinguishes loading, error, products and demo mode', () => {
    expect(catalogNoticeKind(apiState({ status: 'loading', catalog: null }))).toBe('loading')
    expect(catalogNoticeKind(apiState({ status: 'error', catalog: null, error: new CatalogLoadError('network', 'down') }))).toBe('error')
    const product = mapApiProduct(apiProduct(1))!
    expect(catalogNoticeKind(apiState({ catalog: { products: [product], brands: [], skipped: 0 } }))).toBeNull()
    expect(catalogNoticeKind({ source: 'demo' })).toBeNull()
    expect(renderNotice({ source: 'demo' })).toBe('<div></div>')
  })

  it('reports a failing repository as an error result instead of rejecting', async () => {
    const failing: CatalogRepository = {
      listAllProducts: () => Promise.reject(new CatalogLoadError('http', 'The catalog service answered 503')),
      listBrands: () => Promise.resolve([]),
    }
    const result = await loadStorefrontCatalog(failing)
    expect(result.status).toBe('error')
    expect(result.status === 'error' && result.error.code).toBe('http')
  })
})
