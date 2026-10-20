import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Product } from '../data'
import { useStore } from '../store'
import { useT } from '../i18n'
import { getBrandName } from '../brands'
import { ProductPrice } from '../commerce/ui'
import { StockBadge } from './StockBadge'
import { RatingSummary } from './ProductReviews'
import { getRelatedProducts } from '../lib/related'
import { assetUrl } from '../lib/assetUrl'

/** Compact related-product grid: two rows on first view, the rest behind View All. */
export default function RelatedProducts({ product }: { product: Product }) {
  const { products, getBrandById, lang } = useStore()
  const t = useT()
  const [expanded, setExpanded] = useState(false)
  const related = useMemo(() => getRelatedProducts(product, products), [product, products])
  if (!related.length) return null

  // Two rows at every breakpoint: 2 cols -> 4 items, 3 cols -> 6 items, 4 cols -> 8 items.
  const hiddenClass = (i: number) =>
    expanded ? '' : i >= 8 ? 'hidden' : i >= 6 ? 'hidden lg:block' : i >= 4 ? 'hidden md:block' : ''
  const overflow = related.length > 4

  return (
    <section className="mt-10" aria-labelledby="related-heading">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h2 id="related-heading" className="font-display font-700 text-[22px]" style={{ color: 'var(--nb-navy)' }}>{t.product.related}</h2>
        {overflow && (
          <button type="button" aria-expanded={expanded} onClick={() => setExpanded((v) => !v)} className="font-ui text-[12px] font-600 min-h-10 px-2" style={{ color: 'var(--nb-primary-deep)' }}>
            {expanded ? 'Show less' : `View All (${related.length})`}
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {related.map((p, i) => (
          <Link key={p.id} to={`/products/${p.id}`} className={`rounded-lg no-underline bg-white flex flex-col min-w-0 overflow-hidden hover:shadow-md transition-shadow ${hiddenClass(i)}`} style={{ border: '1px solid var(--nb-border)' }}>
            <div className="aspect-[4/3] bg-[var(--nb-bg)]">
              <img src={assetUrl(p.img || '/product-placeholder.svg')} onError={(e) => { e.currentTarget.src = assetUrl('/product-placeholder.svg') }} alt={p.name} loading="lazy" className="w-full h-full object-contain" />
            </div>
            <div className="p-2.5 flex flex-col gap-1 flex-1 min-w-0">
              <span className="font-ui text-[9px] font-700 tracking-[0.12em] uppercase truncate" style={{ color: 'var(--nb-primary-deep)' }}>{getBrandName(getBrandById(p.brandId), lang)}</span>
              <h3 className="font-display font-700 text-[13px] leading-snug line-clamp-2 min-h-9" style={{ color: 'var(--nb-navy)' }}>{p.name}</h3>
              <p className="font-ui text-[10px] truncate" style={{ color: 'var(--nb-text-secondary)' }}>{p.model} · {p.sku}</p>
              <RatingSummary productId={p.id} compact />
              <div className="flex items-center justify-between gap-2 mt-auto pt-1.5">
                <ProductPrice product={p} size="sm" />
                <StockBadge stock={p.stock} />
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}
