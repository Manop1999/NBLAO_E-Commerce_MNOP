import { useState, useMemo, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useStore } from '../store'
import { useT } from '../i18n'
import { CATEGORIES, CATEGORY_SUBS, type Product } from '../data'
import { getBrandName } from '../brands'
import { StockBadge } from '../components/StockBadge'
import { Pagination } from '../components/Pagination'
import { useToast } from '../components/Toast'
import { useCT } from '../commerce/text'
import { fromEnglish } from '../lib/dictionaries'
import { buildSearchIndex, matchesQuery } from '../lib/productSearch'
import { ProductPrice } from '../commerce/ui'
import { useCommerce } from '../commerce/CommerceProvider'

const NAVY = 'var(--nb-navy)'
const BLUE = 'var(--nb-primary)'
const BLUE_H = 'var(--nb-primary-deep)'
const GOLD = 'var(--nb-gold)'

const HeartIcon = ({ filled }: { filled?: boolean }) => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill={filled ? '#ef4444' : 'none'} stroke={filled ? '#ef4444' : 'currentColor'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
  </svg>
)
const FilterIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <line x1="4" y1="6" x2="20" y2="6" /><line x1="8" y1="12" x2="16" y2="12" /><line x1="11" y1="18" x2="13" y2="18" />
  </svg>
)
const XIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
)
const XSmallIcon = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
)
const GridIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
  </svg>
)
const ListIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" />
    <line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
  </svg>
)
const SearchIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
)

// ─── Shared filter controls ───────────────────────────────────────────────────
interface FilterProps {
  category: string; setCategory: (v: string) => void
  subcategory: string; setSubcategory: (v: string) => void
  brand: string; setBrand: (v: string) => void
  minPrice: string; setMinPrice: (v: string) => void
  maxPrice: string; setMaxPrice: (v: string) => void
  stockOnly: boolean; setStockOnly: (v: boolean) => void
  onClear: () => void
}

function FilterControls({ category, setCategory, subcategory, setSubcategory, brand, setBrand, minPrice, setMinPrice, maxPrice, setMaxPrice, stockOnly, setStockOnly, onClear }: FilterProps) {
  const t = useT()
  const { activeBrands, lang } = useStore()
  const hasFilters = category || subcategory || brand || minPrice || maxPrice || stockOnly
  const subcats = category ? (CATEGORY_SUBS[category] || []) : []

  return (
    <div className="flex flex-col gap-5">
      {/* Category */}
      <div>
        <div className="font-display font-700 text-[11px] tracking-wide mb-2 uppercase" style={{ color: NAVY }}>{t.products.category}</div>
        <div className="flex flex-col gap-0.5">
          <button onClick={() => { setCategory(''); setSubcategory('') }} className="rounded-sm text-left font-ui text-[12px] px-2 py-1.5 transition-colors"
            style={{ background: !category ? 'var(--nb-light-blue)' : 'transparent', color: !category ? BLUE : '#475569' }}>
            {t.products.all_categories}
          </button>
          {CATEGORIES.map(c => (
            <button key={c} onClick={() => { setCategory(c); setSubcategory('') }} className="rounded-sm text-left font-ui text-[12px] px-2 py-1.5 transition-colors"
              style={{ background: category === c ? 'var(--nb-light-blue)' : 'transparent', color: category === c ? BLUE : '#475569' }}>
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Subcategory */}
      {category && subcats.length > 0 && (
        <div>
          <div className="font-display font-700 text-[11px] tracking-wide mb-2 uppercase" style={{ color: NAVY }}>{t.products.subcategory}</div>
          <div className="flex flex-col gap-0.5">
            <button onClick={() => setSubcategory('')} className="rounded-sm text-left font-ui text-[12px] px-2 py-1.5 transition-colors"
              style={{ background: !subcategory ? 'var(--nb-light-blue)' : 'transparent', color: !subcategory ? BLUE : '#475569' }}>
              {t.products.all}
            </button>
            {subcats.map(s => (
              <button key={s} onClick={() => setSubcategory(s)} className="rounded-sm text-left font-ui text-[12px] px-2 py-1.5 transition-colors"
                style={{ background: subcategory === s ? 'var(--nb-light-blue)' : 'transparent', color: subcategory === s ? BLUE : '#475569' }}>
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Brand */}
      <div>
        <div className="font-display font-700 text-[11px] tracking-wide mb-2 uppercase" style={{ color: NAVY }}>{t.products.brand}</div>
        <div className="flex flex-col gap-0.5">
          <button onClick={() => setBrand('')} className="rounded-sm text-left font-ui text-[12px] px-2 py-1.5 transition-colors"
            style={{ background: !brand ? 'var(--nb-light-blue)' : 'transparent', color: !brand ? BLUE : '#475569' }}>
            {t.products.all_brands}
          </button>
          {activeBrands.map(b => (
            <button key={b.id} onClick={() => setBrand(b.id)} className="rounded-sm text-left font-ui text-[12px] px-2 py-1.5 transition-colors"
              style={{ background: brand === b.id ? 'var(--nb-light-blue)' : 'transparent', color: brand === b.id ? BLUE : '#475569' }}>
              {getBrandName(b, lang)}
            </button>
          ))}
        </div>
      </div>

      {/* Price Range */}
      <div>
        <div className="font-display font-700 text-[11px] tracking-wide mb-2 uppercase" style={{ color: NAVY }}>{t.products.price_range}</div>
        <div className="flex gap-2 items-center">
          <input type="number" placeholder={t.products.min_price} value={minPrice} onChange={e => setMinPrice(e.target.value)}
            className="rounded-md w-full font-ui text-[12px] px-2 py-1.5 outline-none" style={{ border: '1px solid var(--nb-border)', color: NAVY }} />
          <span className="font-ui text-[11px] shrink-0" style={{ color: '#94a3b8' }}>–</span>
          <input type="number" placeholder={t.products.max_price} value={maxPrice} onChange={e => setMaxPrice(e.target.value)}
            className="rounded-md w-full font-ui text-[12px] px-2 py-1.5 outline-none" style={{ border: '1px solid var(--nb-border)', color: NAVY }} />
        </div>
      </div>

      {/* In Stock */}
      <div>
        <div className="font-display font-700 text-[11px] tracking-wide mb-2 uppercase" style={{ color: NAVY }}>{t.products.availability}</div>
        <label className="flex items-center gap-2.5 cursor-pointer">
          <input type="checkbox" checked={stockOnly} onChange={e => setStockOnly(e.target.checked)}
            className="w-4 h-4 accent-[var(--nb-primary)]" />
          <span className="font-ui text-[12px]" style={{ color: '#475569' }}>{t.products.in_stock_only}</span>
        </label>
      </div>

      {/* Clear */}
      {hasFilters && (
        <button onClick={onClear} className="rounded-md font-ui text-[12px] font-600 py-2 transition-colors"
          style={{ border: '1px solid var(--nb-border)', color: '#475569' }}>
          {t.products.clear_all}
        </button>
      )}
    </div>
  )
}

// ─── Mobile/tablet Filter Drawer ──────────────────────────────────────────────
function FilterDrawer(props: FilterProps & { onApply: () => void }) {
  const { activeDrawer, setActiveDrawer } = useStore()
  const t = useT()
  const open = activeDrawer === 'filters'
  const onClose = () => setActiveDrawer(null)

  // Body scroll lock
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  // Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape' && open) onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open])

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 xl:hidden"
        style={{
          background: 'rgba(0,0,0,0.38)',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
          transition: 'opacity 200ms ease-out',
        }}
        onClick={onClose}
      />
      {/* Drawer */}
      <div
        className="fixed top-0 left-0 bottom-0 z-50 flex flex-col w-[290px] max-w-[88vw] xl:hidden"
        style={{
          background: '#fff',
          boxShadow: '4px 0 24px rgba(0,0,0,0.16)',
          transform: open ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 300ms ease-out',
        }}
      >
        {/* Drawer header */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--nb-border)' }}>
          <span className="font-display font-700 text-[15px]" style={{ color: NAVY }}>{t.products.filters}</span>
          <button onClick={onClose} className="text-[#94a3b8] hover:text-[var(--nb-navy)]"><XIcon /></button>
        </div>

        {/* Scrollable filter content */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <FilterControls {...props} />
        </div>

        {/* Drawer footer */}
        <div className="px-5 py-4" style={{ borderTop: '1px solid var(--nb-border)' }}>
          <button onClick={() => { props.onApply(); onClose() }} className="rounded-md w-full font-ui text-[12px] font-600 py-2.5 text-white"
            style={{ background: BLUE }}>
            {t.products.apply_filters}
          </button>
        </div>
      </div>
    </>
  )
}

// ─── Product Card ─────────────────────────────────────────────────────────────
function ProductCard({ product, view }: { product: Product; view: 'grid' | 'list' }) {
  const { addToCart, toggleWishlist, wishlist, addToRFQ, compare, toggleCompare, getBrandById, lang } = useStore()
  const { addToast } = useToast()
  const t = useT()
  const { priceFor } = useCommerce()
  const ct = useCT()
  const priceOk = priceFor(product).ok
  const brandRecord = getBrandById(product.brandId)
  const brandName = getBrandName(brandRecord, lang)
  const [hov, setHov] = useState(false)
  const inWish = wishlist.includes(product.id)
  const inCompare = compare.includes(product.id)

  const handleCompare = () => {
    if (!inCompare && compare.length >= 4) {
      addToast('You can compare up to 4 products at a time.', 'warning')
      return
    }
    toggleCompare(product.id)
    addToast(inCompare ? `${product.name} removed from compare.` : `${product.name} added to compare.`, 'info')
  }

  if (view === 'list') {
    return (
      <div className="flex gap-3 p-3 transition-colors" style={{ background: hov ? 'var(--nb-surface)' : '#fff', borderBottom: '1px solid var(--nb-border)' }}
        onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}>
        <Link to={`/products/${product.id}`} className="rounded-md shrink-0 overflow-hidden" style={{ width: 80, height: 68, minWidth: 80, background: 'var(--nb-bg)' }}>
          <img src={product.img || '/product-placeholder.svg'} alt={product.name} className="w-full h-full object-contain"
            onError={e => { (e.currentTarget as HTMLImageElement).src = '/product-placeholder.svg' }} />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
            {brandRecord?.logo && <img src={brandRecord.logo} alt="" className="w-auto object-contain" style={{ maxHeight: 14, maxWidth: 48 }} />}
            <span className="font-ui text-[10px] font-700 tracking-[0.12em] uppercase truncate" style={{ color: BLUE }}>{brandName}</span>
            <span className="font-ui text-[10px]" style={{ color: '#cbd5e1' }}>·</span>
            <span className="font-ui text-[10px] truncate" style={{ color: '#94a3b8' }}>SKU: {product.sku}</span>
          </div>
          <Link to={`/products/${product.id}`} className="no-underline">
            <h3 className="font-display font-700 text-[14px] sm:text-[15px] leading-snug mb-1 line-clamp-1" style={{ color: NAVY }}>{product.name}</h3>
          </Link>
          <div className="flex items-center gap-2 mb-1.5">
            <ProductPrice product={product} />
            {priceOk && <span className="font-ui text-[10px]" style={{ color: '#94a3b8' }}>/{product.priceUnit}</span>}
            <StockBadge stock={product.stock} size="sm" />
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {product.stock > 0 && priceOk && (
              <button onClick={() => { addToCart({ id: product.id, name: product.name, sku: product.sku, price: product.price, img: product.img, category: product.category, brand: brandName, stock: product.stock, priceUnit: product.priceUnit }) }}
                className="rounded-sm font-ui text-[11px] font-600 px-3 py-1 text-white" style={{ background: BLUE }}>
                {t.products.add_to_cart}
              </button>
            )}
            <button onClick={() => { addToRFQ({ id: product.id, name: product.name, sku: product.sku, img: product.img, category: product.category }); addToast(t.product.added_rfq, 'info') }}
              className="rounded-sm font-ui text-[11px] font-600 px-3 py-1" style={{ border: `1px solid ${NAVY}`, color: NAVY }}>
              {t.products.rfq_short}
            </button>
            <button onClick={handleCompare} className="rounded-sm font-ui text-[11px] font-600 px-3 py-1 transition-colors hidden sm:block"
              style={{ border: `1px solid ${inCompare ? BLUE : 'var(--nb-border)'}`, color: inCompare ? BLUE : '#94a3b8', background: inCompare ? 'var(--nb-light-blue)' : '#fff' }}>
              {inCompare ? t.products.compare_check : t.products.compare}
            </button>
            <button onClick={() => toggleWishlist(product.id)} className="ml-auto shrink-0" style={{ color: inWish ? '#ef4444' : '#94a3b8' }}>
              <HeartIcon filled={inWish} />
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-lg overflow-hidden flex flex-col" style={{ background: hov ? 'var(--nb-surface)' : '#fff', border: '1px solid var(--nb-border)' }}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}>
      <div className="relative overflow-hidden" style={{ height: 110, background: 'var(--nb-bg)' }}>
        <Link to={`/products/${product.id}`} className="block w-full h-full">
          <img src={product.img || '/product-placeholder.svg'} alt={product.name} className="w-full h-full object-contain"
            onError={e => { (e.currentTarget as HTMLImageElement).src = '/product-placeholder.svg' }} />
        </Link>
        <button onClick={() => toggleWishlist(product.id)}
          className="rounded-md absolute top-2 right-2 w-6 h-6 flex items-center justify-center bg-white/90 hover:bg-white"
          style={{ color: inWish ? '#ef4444' : '#94a3b8' }}>
          <HeartIcon filled={inWish} />
        </button>
        {inCompare && (
          <div className="absolute top-2 left-2 font-ui text-[8px] font-700 px-1 py-0.5 text-white" style={{ background: BLUE }}>
            COMPARING
          </div>
        )}
        <div className="absolute bottom-0 left-0 right-0 h-[2px] transition-opacity duration-300" style={{ background: GOLD, opacity: hov ? 1 : 0 }} />
      </div>
      <div className="p-2.5 flex flex-col flex-1">
        <div className="flex items-center justify-between mb-1">
          <span className="flex items-center gap-1.5 min-w-0">
            {brandRecord?.logo && <img src={brandRecord.logo} alt="" className="w-auto object-contain shrink-0" style={{ maxHeight: 13, maxWidth: 42 }} />}
            <span className="font-ui text-[9px] font-700 tracking-[0.10em] uppercase truncate mr-1" style={{ color: BLUE }}>{brandName}</span>
          </span>
          <StockBadge stock={product.stock} size="sm" />
        </div>
        <Link to={`/products/${product.id}`} className="no-underline">
          <h3 className="font-display font-700 text-[12px] leading-snug mb-1 hover:text-[var(--nb-primary)] transition-colors line-clamp-2" style={{ color: NAVY }}>{product.name}</h3>
        </Link>
        <div className="flex items-baseline gap-1 mb-2 mt-auto">
          <ProductPrice product={product} size="sm" />
          {priceOk && <span className="font-ui text-[9px]" style={{ color: '#94a3b8' }}>/{product.priceUnit}</span>}
        </div>
        <div className="product-card-actions flex gap-1 h-8">
          {product.stock > 0 && priceOk ? (
            <button onClick={() => { addToCart({ id: product.id, name: product.name, sku: product.sku, price: product.price, img: product.img, category: product.category, brand: brandName, stock: product.stock, priceUnit: product.priceUnit }) }}
              className="rounded-sm flex-1 min-w-0 font-ui text-[10px] font-600 px-1.5 text-white transition-colors whitespace-nowrap"
              style={{ background: hov ? BLUE_H : BLUE }}>
              {t.products.add_to_cart}
            </button>
          ) : (
            <button disabled className="rounded-sm flex-1 min-w-0 font-ui text-[10px] font-600 px-1 whitespace-nowrap" style={{ background: 'var(--nb-bg)', color: '#94a3b8' }}>
              {product.stock > 0 ? ct.price_unavailable : t.common.out_of_stock}
            </button>
          )}
          <button onClick={() => { addToRFQ({ id: product.id, name: product.name, sku: product.sku, img: product.img, category: product.category }); addToast(t.product.added_rfq, 'info') }}
            className="rounded-md shrink-0 font-ui text-[10px] font-600 px-2" style={{ border: `1px solid ${NAVY}`, color: NAVY, background: '#fff' }}>
            {t.products.rfq_short}
          </button>
          <button onClick={handleCompare} title={inCompare ? 'Remove from compare' : 'Add to compare'}
            className="rounded-sm font-ui text-[11px] font-600 py-1.5 px-1.5 transition-colors hidden sm:block"
            style={{ border: `1px solid ${inCompare ? BLUE : 'var(--nb-border)'}`, color: inCompare ? BLUE : '#94a3b8', background: inCompare ? 'var(--nb-light-blue)' : '#fff' }}>
            ⇌
          </button>
        </div>
      </div>
    </div>
  )
}

const SORT_KEYS = ['sort_featured', 'sort_price_asc', 'sort_price_desc', 'sort_name_az'] as const
const PAGE_SIZE = 12

export default function Products() {
  const [searchParams] = useSearchParams()
  const urlSearch = searchParams.get('search') || ''
  const t = useT()
  const [category, setCategory] = useState(searchParams.get('category') || '')
  const [subcategory, setSubcategory] = useState(searchParams.get('subcategory') || '')
  const [brand, setBrand] = useState(searchParams.get('brand') || '')
  const [search, setSearch] = useState(searchParams.get('search') || '')
  const [minPrice, setMinPrice] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [stockOnly, setStockOnly] = useState(false)
  const [sortKey, setSortKey] = useState<typeof SORT_KEYS[number]>('sort_featured')
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [page, setPage] = useState(1)
  const { compare, activeDrawer, setActiveDrawer, brands, products } = useStore()

  // Close filter drawer when leaving this page
  useEffect(() => {
    return () => {
      setActiveDrawer(null)
    }
  }, [])

  const resetPage = () => setPage(1)

  // header search while already on /products changes the URL, not this component's state
  useEffect(() => { setSearch(urlSearch); setPage(1) }, [urlSearch])

  const searchIndex = useMemo(() => {
    const dicts = [fromEnglish.lo, fromEnglish.th]
    return new Map(products.map(p => [p.id, buildSearchIndex(p, (() => { const b = brands.find(x => x.id === p.brandId); return b ? [b.name, b.nameEn, b.nameLo].filter(Boolean).join(' ') : '' })(), dicts)]))
  }, [products, brands])

  const filtered = useMemo(() => {
    let list = [...products]
    if (category) list = list.filter(p => p.category === category)
    if (subcategory) list = list.filter(p => p.subcategory === subcategory)
    if (brand) list = list.filter(p => p.brandId === brand)
    if (stockOnly) list = list.filter(p => p.stock > 0)
    if (search.trim()) list = list.filter(p => { const idx = searchIndex.get(p.id); return idx ? matchesQuery(idx, search) : false })
    if (minPrice) list = list.filter(p => p.price >= Number(minPrice))
    if (maxPrice) list = list.filter(p => p.price <= Number(maxPrice))
    if (sortKey === 'sort_price_asc') list.sort((a, b) => a.price - b.price)
    if (sortKey === 'sort_price_desc') list.sort((a, b) => b.price - a.price)
    if (sortKey === 'sort_name_az') list.sort((a, b) => a.name.localeCompare(b.name))
    return list
  }, [category, subcategory, brand, search, minPrice, maxPrice, stockOnly, sortKey, searchIndex, products])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const clearFilters = () => {
    setCategory(''); setSubcategory(''); setBrand('')
    setMinPrice(''); setMaxPrice(''); setSearch(''); setStockOnly(false)
    resetPage()
  }

  const handlePageChange = (p: number) => {
    setPage(p)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const activeFilterCount = [category, subcategory, brand, minPrice, maxPrice, stockOnly ? 'stock' : ''].filter(Boolean).length
  const startItem = filtered.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const endItem = Math.min(page * PAGE_SIZE, filtered.length)

  const sortOptions = SORT_KEYS.map(k => ({ key: k, label: (t.products as Record<string, string>)[k] }))

  const filterProps = {
    category, setCategory: (v: string) => { setCategory(v); resetPage() },
    subcategory, setSubcategory: (v: string) => { setSubcategory(v); resetPage() },
    brand, setBrand: (v: string) => { setBrand(v); resetPage() },
    minPrice, setMinPrice,
    maxPrice, setMaxPrice,
    stockOnly, setStockOnly: (v: boolean) => { setStockOnly(v); resetPage() },
    onClear: clearFilters,
  }

  return (
    <div style={{ background: 'var(--nb-bg)', minHeight: '70vh' }}>
      {/* Page header */}
      <div className="bg-white" style={{ borderBottom: '1px solid var(--nb-border)' }}>
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-12 py-5 lg:py-6">
          <nav className="flex items-center gap-1.5 font-ui text-[12px] mb-2 flex-wrap" style={{ color: '#8f9faf' }}>
            <Link to="/" className="hover:text-[var(--nb-primary)] no-underline">{t.nav.home}</Link>
            <span>/</span>
            <span style={{ color: NAVY }}>{t.products.title}</span>
          </nav>
          <h1 className="font-display font-800 mb-0.5" style={{ fontSize: 'clamp(22px, 2.6vw, 34px)', color: NAVY }}>
            {category || t.header.all_products}
          </h1>
          <p className="font-ui text-[12px]" style={{ color: 'var(--nb-text-secondary)' }}>
            {filtered.length > 0
              ? `${t.products.showing} ${startItem}–${endItem} ${t.products.of} ${filtered.length} ${t.products.results}${search ? ` for "${search}"` : ''}`
              : `${t.products.no_results}${search ? ` for "${search}"` : ''}`
            }
          </p>
        </div>
      </div>

      {/* Compare bar */}
      {compare.length > 0 && (
        <div className="sticky top-0 z-30 py-2 px-6" style={{ background: NAVY, borderBottom: '2px solid var(--nb-primary)' }}>
          <div className="max-w-[1440px] mx-auto flex items-center justify-between gap-4">
            <span className="font-ui text-[12px] text-white">
              {compare.length} {t.products.results} — {t.products.compare}
            </span>
            <Link to="/compare" className="rounded-sm font-ui text-[12px] font-600 px-4 py-1.5 no-underline" style={{ background: BLUE, color: '#fff' }}>
              {t.compare.title} →
            </Link>
          </div>
        </div>
      )}

      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-12 py-4 lg:py-6">
        <div className="flex gap-6">

          {/* ── Desktop Filter Sidebar ── */}
          <aside className="hidden xl:block shrink-0 w-[200px]">
            <div className="rounded-lg bg-white p-4 sticky top-[110px]" style={{ border: '1px solid var(--nb-border)' }}>
              <div className="font-display font-700 text-[13px] mb-4 pb-3" style={{ color: NAVY, borderBottom: '1px solid var(--nb-border)' }}>
                {t.products.filters}
              </div>
              <FilterControls {...filterProps} />
            </div>
          </aside>

          {/* ── Main content ── */}
          <div className="flex-1 min-w-0">
            {/* Toolbar */}
            <div className="rounded-lg bg-white px-3 py-2.5 mb-4" style={{ border: '1px solid var(--nb-border)' }}>
              <div className="flex items-center gap-2 flex-wrap">
                {/* Filters button — mobile/tablet only */}
                <button
                  onClick={() => setActiveDrawer(activeDrawer === 'filters' ? null : 'filters')}
                  className="rounded-sm flex items-center gap-1.5 font-ui text-[12px] font-600 px-3 py-1.5 shrink-0 transition-colors xl:hidden"
                  style={{ border: '1px solid var(--nb-border)', color: NAVY, background: activeFilterCount > 0 ? 'var(--nb-light-blue)' : '#fff' }}
                >
                  <FilterIcon />
                  {t.products.filters}
                  {activeFilterCount > 0 && (
                    <span className="w-4 h-4 flex items-center justify-center text-white text-[9px] font-700 rounded-full ml-0.5" style={{ background: BLUE }}>
                      {activeFilterCount}
                    </span>
                  )}
                </button>

                {/* Search */}
                <div className="relative hidden md:block">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: '#94a3b8' }}><SearchIcon /></span>
                  <input value={search} onChange={e => { setSearch(e.target.value); resetPage() }} placeholder={t.header.search_placeholder}
                    className="rounded-md font-ui text-[12px] pl-8 pr-3 py-1.5 outline-none w-44"
                    style={{ border: '1px solid var(--nb-border)', color: NAVY }} />
                </div>

                {/* Active filter chips */}
                <div className="flex items-center gap-1 flex-wrap flex-1 min-w-0">
                  {category && (
                    <span className="rounded-sm flex items-center gap-1 font-ui text-[10px] px-2 py-0.5" style={{ background: 'var(--nb-light-blue)', color: BLUE }}>
                      {category.length > 18 ? category.slice(0, 18) + '…' : category}
                      <button onClick={() => { setCategory(''); setSubcategory(''); resetPage() }}><XSmallIcon /></button>
                    </span>
                  )}
                  {subcategory && (
                    <span className="rounded-sm flex items-center gap-1 font-ui text-[10px] px-2 py-0.5" style={{ background: 'var(--nb-light-blue)', color: BLUE }}>
                      {subcategory.length > 16 ? subcategory.slice(0, 16) + '…' : subcategory}
                      <button onClick={() => { setSubcategory(''); resetPage() }}><XSmallIcon /></button>
                    </span>
                  )}
                  {brand && (
                    <span className="rounded-sm flex items-center gap-1 font-ui text-[10px] px-2 py-0.5" style={{ background: 'var(--nb-light-blue)', color: BLUE }}>
                      {brand} <button onClick={() => { setBrand(''); resetPage() }}><XSmallIcon /></button>
                    </span>
                  )}
                  {stockOnly && (
                    <span className="rounded-sm flex items-center gap-1 font-ui text-[10px] px-2 py-0.5" style={{ background: 'var(--nb-light-blue)', color: BLUE }}>
                      {t.common.in_stock} <button onClick={() => { setStockOnly(false); resetPage() }}><XSmallIcon /></button>
                    </span>
                  )}
                </div>

                {/* Sort + View */}
                <div className="flex items-center gap-2 shrink-0 ml-auto">
                  <select value={sortKey} onChange={e => { setSortKey(e.target.value as typeof SORT_KEYS[number]); resetPage() }} className="rounded-md font-ui text-[12px] px-2 py-1.5 outline-none hidden md:block" style={{ border: '1px solid var(--nb-border)', color: NAVY, background: '#fff' }}>
                    {sortOptions.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
                  </select>
                  <div className="hidden md:flex items-center gap-0.5">
                    <button onClick={() => setView('grid')} className="p-1.5" style={{ color: view === 'grid' ? BLUE : '#94a3b8' }}><GridIcon /></button>
                    <button onClick={() => setView('list')} className="p-1.5" style={{ color: view === 'list' ? BLUE : '#94a3b8' }}><ListIcon /></button>
                  </div>
                </div>
              </div>
            </div>

            {/* Mobile search + sort row */}
            <div className="flex gap-2 mb-4 md:hidden">
              <div className="relative flex-1">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: '#94a3b8' }}><SearchIcon /></span>
                <input value={search} onChange={e => { setSearch(e.target.value); resetPage() }} placeholder={t.header.search_placeholder}
                  className="rounded-md w-full font-ui text-[12px] pl-8 pr-3 py-2 outline-none"
                  style={{ border: '1px solid var(--nb-border)', color: NAVY, background: '#fff' }} />
              </div>
              <select value={sortKey} onChange={e => { setSortKey(e.target.value as typeof SORT_KEYS[number]); resetPage() }} className="rounded-md font-ui text-[12px] px-2 py-2 outline-none shrink-0"
                style={{ border: '1px solid var(--nb-border)', color: NAVY, background: '#fff' }}>
                {sortOptions.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
              </select>
              <div className="flex items-center gap-0.5 shrink-0">
                <button onClick={() => setView('grid')} className="p-1.5" style={{ color: view === 'grid' ? BLUE : '#94a3b8' }}><GridIcon /></button>
                <button onClick={() => setView('list')} className="p-1.5" style={{ color: view === 'list' ? BLUE : '#94a3b8' }}><ListIcon /></button>
              </div>
            </div>

            {/* Product grid */}
            {filtered.length === 0 ? (
              <div className="rounded-lg bg-white flex flex-col items-center justify-center py-16" style={{ border: '1px solid var(--nb-border)' }}>
                <div className="w-14 h-14 flex items-center justify-center mb-4" style={{ background: 'var(--nb-bg)' }}>
                  <SearchIcon />
                </div>
                <h3 className="font-display font-700 text-[18px] mb-2" style={{ color: NAVY }}>{t.products.no_results}</h3>
                <p className="font-ui text-[13px] mb-5" style={{ color: 'var(--nb-text-secondary)' }}>
                  {search ? `${t.products.no_results} for "${search}".` : t.products.no_results_desc}
                </p>
                <button onClick={clearFilters} className="rounded-md font-ui text-[13px] font-600 px-6 py-2.5 text-white" style={{ background: BLUE }}>
                  {t.products.clear_all}
                </button>
              </div>
            ) : view === 'grid' ? (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-3">
                  {paginated.map(p => <ProductCard key={p.id} product={p} view="grid" />)}
                </div>
                <Pagination page={page} totalPages={totalPages} onPage={handlePageChange} totalItems={filtered.length} itemsPerPage={PAGE_SIZE} />
              </>
            ) : (
              <>
                <div className="rounded-lg bg-white" style={{ border: '1px solid var(--nb-border)' }}>
                  {paginated.map(p => <ProductCard key={p.id} product={p} view="list" />)}
                </div>
                <Pagination page={page} totalPages={totalPages} onPage={handlePageChange} totalItems={filtered.length} itemsPerPage={PAGE_SIZE} />
              </>
            )}
          </div>
        </div>
      </div>

      {/* Mobile/tablet Filter Drawer */}
      <FilterDrawer {...filterProps} onApply={resetPage} />
    </div>
  )
}
