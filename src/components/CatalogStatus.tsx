import type { ReactNode } from 'react'
import { useCatalog, type CatalogState } from '../catalog/CatalogProvider'

export type CatalogNoticeKind = 'loading' | 'error' | 'empty'

/** Which notice replaces the product list, or null when products can be shown (always in demo mode). */
export function catalogNoticeKind(catalog: CatalogState): CatalogNoticeKind | null {
  if (catalog.source !== 'api') return null
  if (catalog.status === 'loading') return 'loading'
  if (catalog.status === 'error') return 'error'
  return catalog.catalog?.products.length ? null : 'empty'
}

const NAVY = 'var(--nb-navy)'
const BLUE = 'var(--nb-primary)'

function Panel({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div role="status" className="rounded-lg bg-white text-center px-6 py-14" style={{ border: '1px solid var(--nb-border)' }}>
      <h3 className="font-display font-700 text-[18px] mb-2" style={{ color: NAVY }}>{title}</h3>
      <p className="font-ui text-[13px] max-w-[460px] mx-auto" style={{ color: 'var(--nb-text-secondary)' }}>{body}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

/**
 * What a catalog page should show instead of products while the API catalog is not usable: loading, error
 * (with retry; never stale demo data) or an empty catalog. Null when products can be shown (always in demo mode).
 */
export function useCatalogNotice(): ReactNode | null {
  const catalog = useCatalog()
  const kind = catalogNoticeKind(catalog)
  if (kind === null || catalog.source !== 'api') return null
  if (kind === 'loading') {
    return <Panel title="Loading products…" body="Fetching the latest catalog." />
  }
  if (kind === 'error') {
    return (
      <Panel
        title="Products could not be loaded"
        body="The catalog service is not available right now. Please try again in a moment."
        action={
          <button type="button" onClick={catalog.retry} className="rounded-md font-ui text-[13px] font-600 px-6 py-2.5 text-white" style={{ background: BLUE }}>
            Try again
          </button>
        }
      />
    )
  }
  return <Panel title="No products available" body="The catalog does not contain any published products yet." />
}
