/*
 * Which catalog the storefront shows, fixed at build time by VITE_CATALOG_SOURCE:
 * - "demo" (default; the GitHub Pages build): bundled demo catalog plus local Admin edits, as before Phase 1D.
 * - "api": the local Fastify catalog API through the Vite dev proxy. Local development only.
 */
export type CatalogSource = 'demo' | 'api'

export function parseCatalogSource(raw: string | undefined): CatalogSource {
  if (raw === undefined || raw === '' || raw === 'demo') return 'demo'
  if (raw === 'api') return 'api'
  throw new Error(`VITE_CATALOG_SOURCE must be "demo" or "api" (got ${JSON.stringify(raw)})`)
}

export const CATALOG_SOURCE: CatalogSource = parseCatalogSource(import.meta.env.VITE_CATALOG_SOURCE)
