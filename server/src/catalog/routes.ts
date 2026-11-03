/** Public, read-only catalog routes (Phase 1D). No write routes, no authentication, no CORS. */
import type { FastifyInstance } from 'fastify'
import { parseBrandListQuery, parseProductListQuery } from './query.ts'
import type { CatalogReader } from './reader.ts'

export function registerCatalogRoutes(app: FastifyInstance, reader: CatalogReader): void {
  app.get('/api/products', async request => reader.listProducts(parseProductListQuery(request.query)))

  app.get('/api/brands', async request => {
    parseBrandListQuery(request.query)
    return { items: await reader.listBrands() }
  })
}
