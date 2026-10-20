import { StockBadge } from '../components/StockBadge'
import { useEffect, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { useStore } from '../store'
import { useT } from '../i18n'
import { getBrandName } from '../brands'
import { ProductPrice } from '../commerce/ui'
import { useCommerce } from '../commerce/CommerceProvider'
import { useCT } from '../commerce/text'
import VariantSelector from '../components/VariantSelector'
import ProductReviews, { RatingSummary } from '../components/ProductReviews'
import RelatedProducts from '../components/RelatedProducts'
import { hasVariants, isSelectionComplete, pruneSelection, resolveVariant, variantCanBePurchased, variantLabel, type Selection } from '../lib/variants'
import { useToast } from '../components/Toast'
import { DEMO_DOCUMENT_TITLES } from '../lib/demoProducts'
import { assetUrl } from '../lib/assetUrl'

const NAVY = 'var(--nb-navy)'
const BLUE = 'var(--nb-primary)'
const BLUE_H = 'var(--nb-primary-deep)'
const GOLD = 'var(--nb-gold)'

const HeartIcon = ({ filled }: { filled?: boolean }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill={filled ? '#ef4444' : 'none'} stroke={filled ? '#ef4444' : 'currentColor'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
  </svg>
)
const CartIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" />
    <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
  </svg>
)
const PhoneIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.37a2 2 0 0 1 1.99-2.18h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6 6z" />
  </svg>
)
const MinusIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
)
const PlusIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
  </svg>
)
const DownloadIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
  </svg>
)

function Breadcrumb({ items }: { items: { label: string; to?: string }[] }) {
  return (
    <nav className="flex items-center gap-1.5 font-ui text-[12px] flex-wrap" style={{ color: '#8f9faf' }}>
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <span>/</span>}
          {item.to ? <Link to={item.to} className="hover:text-[var(--nb-primary)] transition-colors no-underline">{item.label}</Link>
            : <span style={{ color: NAVY }}>{item.label}</span>}
        </span>
      ))}
    </nav>
  )
}

export default function ProductDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { addToCart, toggleWishlist, wishlist, addToRFQ, getBrandById, lang, products, customerService } = useStore()
  const t = useT()
  const ct = useCT()
  const { priceFor } = useCommerce()
  const TABS = [t.product.overview, t.product.specifications, t.product.applications, t.product.documents]
  const [qty, setQty] = useState(1)
  const [activeImg, setActiveImg] = useState(0)
  const [tabIdx, setTabIdx] = useState(0)
  useEffect(() => {
    const tab = document.getElementById(`detail-tab-${tabIdx}`)
    const strip = tab?.parentElement
    if (!tab || !strip) return
    const left = tab.offsetLeft - (strip.clientWidth - tab.offsetWidth) / 2
    strip.scrollTo?.({ left: Math.max(0, left), behavior: 'smooth' })
  }, [tabIdx])
  const [added, setAdded] = useState(false)
  const [selection, setSelection] = useState<Selection>({})
  const [showOptionErrors, setShowOptionErrors] = useState(false)
  const { addToast } = useToast()

  const product = products.find(p => String(p.id) === id)
  const variantProduct = !!product && hasVariants(product)
  const selectedVariant = product && variantProduct ? resolveVariant(product, selection) : undefined
  const optionsComplete = !!product && (!variantProduct || isSelectionComplete(product, selection))
  const activeProduct = product && product.active !== false
  const unitStock = selectedVariant ? selectedVariant.stock : product?.stock ?? 0
  const canBuy = !!product && !!activeProduct && (variantProduct ? !!selectedVariant && variantCanBePurchased(selectedVariant) : product.stock > 0)
  const unitSku = selectedVariant?.sku ?? product?.sku ?? ''
  const baseGallery = product ? [product.img, ...(product.images ?? [])].filter((src, i, all) => !!src && all.indexOf(src) === i) : []
  const gallery = product ? (selectedVariant?.images?.length ? selectedVariant.images : baseGallery) : []
  const specs = product?.specs ?? []
  const applications = product?.applications ?? []
  const certifications = product?.certifications ?? []
  const documents = product?.documents ?? []
  useEffect(() => { setSelection({}); setQty(1); setActiveImg(0); setShowOptionErrors(false) }, [id])
  useEffect(() => { setQty(q => Math.max(1, Math.min(q, Math.max(1, unitStock)))) ; setActiveImg(0) }, [selectedVariant?.id, unitStock])
  const inWish = wishlist.includes(product?.id ?? 0)
  const productBrand = product ? getBrandById(product.brandId) : undefined
  const brandName = getBrandName(productBrand, lang)

  if (!product) return (
    <div className="py-24 text-center">
      <h2 className="font-display font-700 text-[28px] mb-4" style={{ color: NAVY }}>Product Not Found</h2>
      <Link to="/products" className="rounded-md font-ui text-[13px] font-600 px-6 py-3 text-white no-underline" style={{ background: BLUE }}>Browse Products</Link>
    </div>
  )

  const changeOption = (name: string, value: string) => {
    setSelection(prev => pruneSelection(product, { ...prev, [name]: value }, name))
    setShowOptionErrors(false)
  }

  const handleAddToCart = () => {
    if (!optionsComplete) { setShowOptionErrors(true); addToast('Select all product options first.', 'warning'); return }
    if (!canBuy) { addToast('This option is currently unavailable.', 'error'); return }
    addToCart({
      id: product.id, name: product.name, sku: unitSku, price: selectedVariant ? (selectedVariant.price && selectedVariant.price > 0 ? selectedVariant.price : product.price) : product.price,
      img: gallery[0] || product.img, category: product.category, brand: brandName, stock: unitStock,
      ...(selectedVariant ? { variantId: selectedVariant.id, variantLabel: variantLabel(product, selectedVariant) } : {}),
    }, qty)
    setAdded(true)
    setTimeout(() => setAdded(false), 2000)
  }

  return (
    <div style={{ background: 'var(--nb-bg)', overflowX: 'hidden' }}>
      {/* Breadcrumb */}
      <div className="bg-white" style={{ borderBottom: '1px solid var(--nb-border)' }}>
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-12 py-4">
          <Breadcrumb items={[{ label: 'Home', to: '/' }, { label: 'Products', to: '/products' }, { label: product.category, to: `/products?category=${encodeURIComponent(product.category)}` }, { label: product.name }]} />
        </div>
      </div>

      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-12 py-6 lg:py-8">
        {/* Main product block */}
        <div className="grid lg:grid-cols-[1fr_420px] gap-10 mb-10">
          {/* Gallery */}
          <div>
            <div className="rounded-lg bg-white overflow-hidden mb-3 h-[200px] sm:h-[300px] lg:h-[420px]" style={{ border: '1px solid var(--nb-border)' }}>
              <img src={assetUrl(gallery[activeImg] || gallery[0] || product.img || '/product-placeholder.svg')} onError={event => { event.currentTarget.src = assetUrl('/product-placeholder.svg') }} alt={product.name} className="w-full h-full object-contain" />
            </div>
            {gallery.length > 1 && (
              <div className="flex gap-2">
                {gallery.map((img, i) => (
                  <button key={i} onClick={() => setActiveImg(i)}
                    className="rounded-md overflow-hidden transition-all" style={{ width: 72, height: 54, border: `2px solid ${i === activeImg ? BLUE : 'var(--nb-border)'}` }}>
                    <img src={assetUrl(img || '/product-placeholder.svg')} onError={event => { event.currentTarget.src = assetUrl('/product-placeholder.svg') }} alt={`View ${i + 1}`} className="w-full h-full object-contain" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product info */}
          <div className="rounded-lg bg-white p-7" style={{ border: '1px solid var(--nb-border)', alignSelf: 'start' }}>
            {/* Brand + certifications */}
            <div className="flex items-center gap-2 mb-3">
              {productBrand?.logo && <img src={assetUrl(productBrand.logo)} alt="" className="w-auto object-contain" style={{ maxHeight: 22, maxWidth: 90 }} />}
              <span className="font-display font-700 text-[13px] tracking-wide" style={{ color: BLUE }}>{brandName}</span>
              {certifications.map(c => (
                <span key={c} className="rounded-sm font-ui text-[9px] px-2 py-0.5 tracking-wide" style={{ background: '#F0F4F8', color: '#607080' }}>{c}</span>
              ))}
            </div>

            <h1 className="font-display font-800 leading-tight mb-2" style={{ fontSize: 'clamp(20px, 2.5vw, 28px)', color: NAVY }}>{product.name}</h1>

            <div className="flex items-center gap-4 mb-4">
              <span className="font-ui text-[12px]" style={{ color: '#8f9faf' }}>Model: <strong style={{ color: '#475569' }}>{product.model}</strong></span>
              <span className="font-ui text-[12px]" style={{ color: '#8f9faf' }}>SKU: <strong style={{ color: '#475569' }}>{unitSku}</strong></span>
              <RatingSummary productId={product.id} />
            </div>

            <div className="mb-5 pb-5" style={{ borderBottom: '1px solid var(--nb-bg)' }}>
              <p className="font-ui text-[14px] leading-[1.75]" style={{ color: '#4a5568' }}>{product.shortDesc || 'Contact Sales for details.'}</p>
            </div>

            {/* Price + stock */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <ProductPrice product={product} size="lg" note variantId={selectedVariant?.id} />
                <div className="font-ui text-[11px] mt-1" style={{ color: '#8f9faf' }}>{ct.approx_excl}</div>
              </div>
              <div className="text-right">
                <StockBadge stock={variantProduct && !selectedVariant ? product.stock : unitStock} active={!!activeProduct && (!selectedVariant || (selectedVariant.active && selectedVariant.purchasable))} size="md" />
                <div className="font-ui text-[11px] mt-1" style={{ color: '#8f9faf' }}>{variantProduct && !selectedVariant ? 'Select options to see availability' : `${unitStock} units available`}</div>
              </div>
            </div>

            {variantProduct && <VariantSelector product={product} selection={selection} onChange={changeOption} showErrors={showOptionErrors} />}
            {variantProduct && product.demoOptions && (
              <p className="font-ui text-[11px] -mt-2 mb-5" style={{ color: '#8f9faf' }}>Sample configuration options (demonstration data). Confirm exact specifications and availability with Sales.</p>
            )}

            {/* Qty selector */}
            <div className="flex items-center gap-3 mb-5">
              <div className="rounded-md overflow-hidden flex items-center" style={{ border: '1px solid var(--nb-border)' }}>
                <button onClick={() => setQty(Math.max(1, qty - 1))} className="rounded-md px-3 py-2.5 transition-colors hover:bg-slate-50"><MinusIcon /></button>
                <span className="font-ui text-[14px] font-600 px-4" style={{ color: NAVY }}>{qty}</span>
                <button onClick={() => setQty(Math.min(Math.max(1, unitStock), qty + 1))} className="rounded-md px-3 py-2.5 transition-colors hover:bg-slate-50"><PlusIcon /></button>
              </div>
              <span className="font-ui text-[12px]" style={{ color: '#8f9faf' }}>Max: {unitStock} units</span>
            </div>

            {/* CTAs */}
            <div className="flex flex-col gap-2.5 mb-5">
              <button onClick={handleAddToCart} disabled={!priceFor(product, undefined, selectedVariant?.id).ok || (optionsComplete && !canBuy)}
                className="rounded-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-ui text-[13px] font-600 py-3.5 text-white w-full transition-all"
                style={{ background: added ? '#16a34a' : BLUE }}>
                <CartIcon />
                {added ? t.product.added_cart : t.product.add_to_cart}
              </button>
              <button onClick={() => { if (!optionsComplete) { setShowOptionErrors(true); addToast('Select all product options first.', 'warning'); return } addToRFQ({ id: product.id, name: product.name, sku: unitSku, img: gallery[0] || product.img, category: product.category, ...(selectedVariant ? { variantId: selectedVariant.id, variantLabel: variantLabel(product, selectedVariant) } : {}) }, qty); navigate('/rfq') }}
                className="rounded-md font-ui text-[13px] font-600 py-3.5 w-full transition-all"
                style={{ border: `1px solid ${NAVY}`, color: NAVY }}>
                {t.product.add_to_rfq}
              </button>
            </div>

            {/* Secondary actions */}
            <div className="flex gap-4 pb-5" style={{ borderBottom: '1px solid var(--nb-bg)' }}>
              <button onClick={() => toggleWishlist(product.id)} className="flex items-center gap-1.5 font-ui text-[12px] transition-colors"
                style={{ color: inWish ? '#ef4444' : 'var(--nb-text-secondary)' }}>
                <HeartIcon filled={inWish} /> {inWish ? 'Saved' : 'Save to Wishlist'}
              </button>
              <a href={`tel:${customerService.phone.replace(/\s/g, '')}`} className="flex items-center gap-1.5 font-ui text-[12px] no-underline" style={{ color: 'var(--nb-text-secondary)' }}>
                <PhoneIcon /> Contact Sales
              </a>
            </div>

            {/* Trust signals */}
            <div className="grid grid-cols-2 gap-3 mt-4">
              {['Quotation on Request', 'Technical Support', 'After-Sales Service', 'Competitive Pricing'].map(label => (
                <div key={label} className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: GOLD }} />
                  <span className="font-ui text-[11px]" style={{ color: 'var(--nb-text-secondary)' }}>{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Detail tabs */}
        <div className="rounded-lg bg-white" style={{ border: '1px solid var(--nb-border)' }}>
          <div role="tablist" aria-label="Product information" data-testid="detail-tablist" className="flex overflow-x-auto overscroll-x-contain" style={{ borderBottom: '1px solid var(--nb-border)', scrollbarWidth: 'none' }}
            onKeyDown={e => {
              if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft' && e.key !== 'Home' && e.key !== 'End') return
              e.preventDefault()
              const n = TABS.length
              const next = e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : (tabIdx + (e.key === 'ArrowRight' ? 1 : n - 1)) % n
              setTabIdx(next)
              document.getElementById(`detail-tab-${next}`)?.focus()
            }}>
            {TABS.map((label, i) => (
              <button key={i} id={`detail-tab-${i}`} role="tab" aria-selected={tabIdx === i} aria-controls="detail-tabpanel" tabIndex={tabIdx === i ? 0 : -1}
                onClick={() => setTabIdx(i)}
                className="rounded-md font-ui text-[12px] sm:text-[13px] font-600 px-4 sm:px-7 py-3.5 sm:py-4 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-[var(--nb-primary)]"
                style={{ color: tabIdx === i ? BLUE : '#475569', borderBottom: tabIdx === i ? `2px solid ${BLUE}` : '2px solid transparent' }}>
                {label}
              </button>
            ))}
          </div>

          <div id="detail-tabpanel" role="tabpanel" aria-labelledby={`detail-tab-${tabIdx}`} className="p-4 sm:p-6 lg:p-8 min-w-0">
            {tabIdx === 0 && (
              <div className="max-w-3xl">
                <h3 className="font-display font-700 text-[20px] mb-4" style={{ color: NAVY }}>{t.product.overview}</h3>
                <p className="font-ui text-[14.5px] leading-[1.8]" style={{ color: '#4a5568' }}>{product.description || 'Contact Sales for details.'}</p>
              </div>
            )}

            {tabIdx === 1 && (
              <div className="max-w-2xl overflow-x-auto">
                <h3 className="font-display font-700 text-[18px] sm:text-[20px] mb-4 sm:mb-6" style={{ color: NAVY }}>{t.product.specifications}</h3>
                <div className="flex flex-col min-w-0">
                  {specs.length === 0 && <p className="font-ui text-[13px]" style={{ color: '#8f9faf' }}>Contact Sales for details.</p>}
                  {specs.map((s, i) => (
                    <div key={s.label} className="flex py-2.5"
                      style={{ borderBottom: '1px solid var(--nb-bg)', background: i % 2 === 0 ? 'var(--nb-surface)' : '#fff' }}>
                      <span className="font-ui text-[12px] sm:text-[13px] font-600 px-3 sm:px-4 w-[45%] shrink-0" style={{ color: '#374151' }}>{s.label}</span>
                      <span className="font-ui text-[12px] sm:text-[13px] px-3 sm:px-4 flex-1 min-w-0" style={{ color: 'var(--nb-text-secondary)' }}>{s.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {tabIdx === 2 && (
              <div className="max-w-2xl">
                <h3 className="font-display font-700 text-[20px] mb-6" style={{ color: NAVY }}>Applications</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {applications.length === 0 && <p className="font-ui text-[13px]" style={{ color: '#8f9faf' }}>Contact Sales for details.</p>}
                  {applications.map(app => (
                    <div key={app} className="rounded-lg flex items-center gap-3 p-4" style={{ background: 'var(--nb-bg)', border: '1px solid var(--nb-border)' }}>
                      <div className="w-2 h-2 shrink-0" style={{ background: GOLD }} />
                      <span className="font-ui text-[13px]" style={{ color: '#374151' }}>{app}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {tabIdx === 3 && (
              <div>
                <h3 className="font-display font-700 text-[18px] sm:text-[20px] mb-4 sm:mb-6" style={{ color: NAVY }}>{t.product.documents}</h3>
                {documents.map(doc => (
                  <div key={doc.url} className="flex items-center justify-between gap-3 py-3 sm:py-4" style={{ borderBottom: '1px solid var(--nb-bg)' }}>
                    <div className="min-w-0">
                      <div className="font-ui text-[12px] sm:text-[13px] font-600 break-words" style={{ color: NAVY }}>{doc.title}</div>
                      <div className="font-ui text-[10px] sm:text-[11px]" style={{ color: '#8f9faf' }}>PDF</div>
                    </div>
                    <a href={doc.url} target="_blank" rel="noopener noreferrer" className="rounded-sm flex items-center gap-1 sm:gap-1.5 font-ui text-[11px] sm:text-[12px] font-600 px-3 sm:px-4 py-2 shrink-0 no-underline" style={{ border: '1px solid var(--nb-border)', color: '#475569' }}>
                      <DownloadIcon /> Download
                    </a>
                  </div>
                ))}
                {documents.length === 0 && (
                  <>
                    <p className="font-ui text-[12px] mb-2" style={{ color: '#8f9faf' }}>No files are attached to this product yet. The entries below are demonstration placeholders; request the documents from Sales.</p>
                    {DEMO_DOCUMENT_TITLES.map(doc => (
                      <div key={doc} className="flex items-center justify-between gap-3 py-3 sm:py-4" style={{ borderBottom: '1px solid var(--nb-bg)' }}>
                        <div className="min-w-0">
                          <div className="font-ui text-[12px] sm:text-[13px] font-600 break-words" style={{ color: NAVY }}>{doc}</div>
                          <div className="font-ui text-[10px] sm:text-[11px]" style={{ color: '#8f9faf' }}>Demonstration entry · no file attached</div>
                        </div>
                        <Link to="/contact" className="rounded-sm flex items-center gap-1 sm:gap-1.5 font-ui text-[11px] sm:text-[12px] font-600 px-3 sm:px-4 py-2 shrink-0 no-underline" style={{ border: '1px solid var(--nb-border)', color: '#475569' }}>
                          Request
                        </Link>
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        <ProductReviews productId={product.id} />

        <RelatedProducts product={product} />
      </div>
    </div>
  )
}
