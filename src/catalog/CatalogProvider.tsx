/*
 * Loads the storefront catalog for the build's CATALOG_SOURCE.
 * Demo mode does nothing here: the store keeps serving the bundled/local demo catalog exactly as before.
 * API mode loads every product page and the brand list once; on failure it exposes the error and a retry,
 * and never falls back to demo data.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { createApiCatalogRepository } from './apiRepository'
import { mapCatalog } from './mapApiProduct'
import { CATALOG_SOURCE } from './source'
import { CatalogLoadError, type CatalogRepository, type StorefrontCatalog } from './types'

export type CatalogState =
  | { source: 'demo' }
  | {
      source: 'api'
      status: 'loading' | 'error' | 'ready'
      catalog: StorefrontCatalog | null
      error: CatalogLoadError | null
      retry: () => void
    }

const DEMO: CatalogState = { source: 'demo' }
const Ctx = createContext<CatalogState>(DEMO)

export function CatalogProvider({ children, repository }: { children: ReactNode; repository?: CatalogRepository }) {
  if (CATALOG_SOURCE !== 'api') return <Ctx.Provider value={DEMO}>{children}</Ctx.Provider>
  return <ApiCatalogProvider repository={repository}>{children}</ApiCatalogProvider>
}

function ApiCatalogProvider({ children, repository: injected }: { children: ReactNode; repository?: CatalogRepository }) {
  // Created once per provider so the loading effect does not restart on every render.
  const [repository] = useState<CatalogRepository>(() => injected ?? createApiCatalogRepository())
  const [attempt, setAttempt] = useState(0)
  const [status, setStatus] = useState<'loading' | 'error' | 'ready'>('loading')
  const [catalog, setCatalog] = useState<StorefrontCatalog | null>(null)
  const [error, setError] = useState<CatalogLoadError | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    setStatus('loading')
    setError(null)
    Promise.all([repository.listAllProducts(controller.signal), repository.listBrands(controller.signal)])
      .then(([products, brands]) => {
        if (controller.signal.aborted) return
        const mapped = mapCatalog(products, brands)
        if (mapped.skipped > 0) console.warn(`[catalog] ${mapped.skipped} API product(s) skipped (no legacy id or unsafe price)`)
        setCatalog(mapped)
        setStatus('ready')
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return
        setCatalog(null)
        setError(reason instanceof CatalogLoadError ? reason : new CatalogLoadError('network', 'The catalog could not be loaded'))
        setStatus('error')
      })
    return () => controller.abort()
  }, [repository, attempt])

  const retry = useCallback(() => setAttempt(n => n + 1), [])
  const value = useMemo<CatalogState>(() => ({ source: 'api', status, catalog, error, retry }), [status, catalog, error, retry])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export const useCatalog = (): CatalogState => useContext(Ctx)
