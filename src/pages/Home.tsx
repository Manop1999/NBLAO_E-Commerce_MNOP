import { StockBadge } from '../components/StockBadge'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ProductPrice } from '../commerce/ui'
import { useCommerce } from '../commerce/CommerceProvider'
import { Link } from 'react-router-dom'
import { useStore, type SalesPlacement } from '../store'
import { CATEGORIES, type Product } from '../data'
import { useT } from '../i18n'
import { getBrandName } from '../brands'
import LogoCarousel from '../components/LogoCarousel'
import AdvertisementSlider from '../components/AdvertisementSlider'
import { assetUrl } from '../lib/assetUrl'

const NAVY = 'var(--nb-navy)'
const BLUE = 'var(--nb-primary)'
const BLUE_H = 'var(--nb-primary-deep)'
const GOLD = 'var(--nb-gold)'

const ArrowRightIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
  </svg>
)
const HeartIcon = ({ filled }: { filled?: boolean }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill={filled ? '#ef4444' : 'none'} stroke={filled ? '#ef4444' : 'currentColor'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
  </svg>
)
const ChevronIcon = ({ direction }: { direction: 'left' | 'right' }) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points={direction === 'left' ? '15 18 9 12 15 6' : '9 18 15 12 9 6'} />
  </svg>
)
const STATS = [
  { value: '12+', label: 'Years in Business' },
  { value: '500+', label: 'Products Supplied' },
  { value: '200+', label: 'Clients Served' },
  { value: '15+', label: 'Countries Sourced' },
]

const CAT_IMAGES: Record<string, string> = {
  'Electrical Equipment': '/site-images/c323e3f37dfd.jpg',
  'Industrial Machinery': '/site-images/e169c380d5ea.jpg',
  'Power & Energy': '/site-images/1444ffae0af2.jpg',
  'Tools & Equipment': '/site-images/f11d3f0cacb2.jpg',
  'Safety & Fire Protection': '/site-images/3595a0eb5f49.jpg',
  'Cables & Accessories': '/site-images/fe8658504d59.jpg',
}

const CAT_DESC: Record<string, string> = {
  'Electrical Equipment': 'Switchgear, transformers, circuit breakers, control panels',
  'Industrial Machinery': 'Pumps, compressors, conveyors, processing equipment',
  'Power & Energy': 'Generators, UPS, solar and energy storage solutions',
  'Tools & Equipment': 'Power tools, hand tools, measuring and testing gear',
  'Safety & Fire Protection': 'PPE, fire suppression, detection and emergency equipment',
  'Cables & Accessories': 'Power cables, control cables, conduits and management',
}

const INDUSTRIES = [
  { id: 1, name: 'Power Plants', desc: 'Hydroelectric, thermal, and solar generation facilities', icon: '⚡', stat: '15+ Projects' },
  { id: 2, name: 'Manufacturing', desc: 'Automotive, food processing, and heavy manufacturing plants', icon: '🏭', stat: '40+ Clients' },
  { id: 3, name: 'Construction', desc: 'Large-scale civil, infrastructure, and building projects', icon: '🏗', stat: '60+ Projects' },
  { id: 4, name: 'Industrial Facilities', desc: 'Refineries, chemical plants, and processing facilities', icon: '🔧', stat: '25+ Facilities' },
]

function SectionLabel({ children, light = false }: { children: React.ReactNode; light?: boolean }) {
  return (
    <div className="flex items-center gap-3 mb-3">
      <div className="w-5 h-px" style={{ background: GOLD }} />
      <span className="font-ui text-[10px] tracking-[0.22em] uppercase font-600" style={{ color: light ? '#7dbfff' : BLUE }}>
        {children}
      </span>
    </div>
  )
}

// ─── Hero ─────────────────────────────────────────────────────────────────────
function Hero() {
  const t = useT()
  return (
    <section className="relative overflow-hidden lg:flex lg:w-full lg:items-center lg:aspect-[2/1] lg:min-h-[520px] lg:max-h-[680px]" style={{ background: 'var(--nb-navy)' }}>
      <div className="absolute inset-0" style={{ pointerEvents: 'none' }}>
        <img
          src={assetUrl("/site-images/73dcaba7ec9f.jpg")}
          alt="High-voltage electrical substation"
          width={1600}
          height={900}
          className="uhero-art block w-full h-full object-cover"
        />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(105deg, rgba(7,33,61,0.88) 0%, rgba(8,46,97,0.7) 42%, rgba(8,46,97,0.28) 100%)', pointerEvents: 'none' }} />
      </div>
      <div className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ background: GOLD, pointerEvents: 'none' }} />

      <div className="relative max-w-[1440px] mx-auto px-5 sm:px-6 lg:px-12 w-full py-8 sm:py-10 lg:py-12" style={{ zIndex: 1 }}>
        <div className="max-w-[600px]">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-6 h-px" style={{ background: GOLD }} />
            <span className="font-ui text-[10px] tracking-[0.25em] uppercase font-600" style={{ color: GOLD }}>
              Industrial Supply Solutions — Laos PDR
            </span>
          </div>
          <h1 className="uhero-title font-display font-800 text-white leading-[0.95] mb-4" style={{ fontSize: 'clamp(38px, 5vw, 68px)', letterSpacing: '-0.01em' }}>
            Power. Machinery.<br />
            <span style={{ color: '#5bc5ff' }}>Built to Perform.</span>
          </h1>
          <p className="uhero-description font-ui text-[14px] leading-[1.7] mb-7 max-w-[480px]" style={{ color: 'rgba(255,255,255,0.62)' }}>
            NB Lao Sole Co., Ltd. supplies certified industrial equipment, electrical systems, and safety solutions to power plants, factories, and construction projects across Southeast Asia.
          </p>
          <div className="flex flex-wrap gap-3 mb-10">
            <Link to="/products" className="rounded-md flex items-center gap-2 font-ui text-[13px] font-600 px-7 py-3 no-underline" style={{ background: BLUE, color: '#fff' }}
              onMouseEnter={e => (e.currentTarget.style.background = BLUE_H)} onMouseLeave={e => (e.currentTarget.style.background = BLUE)}>
              {t.products.title} <ArrowRightIcon />
            </Link>
            <Link to="/rfq" className="rounded-md font-ui text-[13px] font-500 px-7 py-3 no-underline" style={{ border: '1px solid rgba(255,255,255,0.28)', color: 'rgba(255,255,255,0.85)' }}>
              {t.common.request_quote}
            </Link>
          </div>
          <div className="flex flex-wrap gap-x-8 gap-y-4 pt-6" style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
            {STATS.map((s) => (
              <div key={s.label}>
                <div className="font-display font-800 leading-none" style={{ fontSize: 'clamp(22px, 2.2vw, 28px)', color: GOLD }}>{s.value}</div>
                <div className="font-ui text-[10px] mt-1 tracking-wide" style={{ color: 'rgba(255,255,255,0.45)' }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function Advertisements() {
  const { activeAdvertisements } = useStore()
  const t = useT()
  const mainAdvertisements = useMemo(
    () => activeAdvertisements.filter(advertisement => (advertisement.placement || 'main') === 'main'),
    [activeAdvertisements],
  )
  const sideAdvertisements = useMemo(
    () => activeAdvertisements.filter(advertisement => advertisement.placement === 'side'),
    [activeAdvertisements],
  )

  if (mainAdvertisements.length === 0 && sideAdvertisements.length === 0) return null

  const sideContent = (sideAdvertisement: typeof sideAdvertisements[number]) => (
    <div className="rounded-xl relative h-full min-h-40 overflow-hidden">
      <img src={assetUrl(sideAdvertisement.image)} alt="" className="absolute inset-0 w-full h-full object-cover" />
    </div>
  )

  const renderSideAdvertisement = (advertisement: typeof sideAdvertisements[number]) =>
    advertisement.destinationUrl.startsWith('/')
      ? <Link key={advertisement.id} to={advertisement.destinationUrl} className="hidden lg:block no-underline">{sideContent(advertisement)}</Link>
      : <a key={advertisement.id} href={advertisement.destinationUrl} target="_blank" rel="noreferrer" className="hidden lg:block no-underline">{sideContent(advertisement)}</a>

  return (
    <section className="py-3 sm:py-4" style={{ background: 'var(--nb-light-blue)' }} aria-label={t.home.promotions}>
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-12">
        <div className={`grid gap-3 ${sideAdvertisements.length > 1 ? 'lg:grid-cols-[minmax(200px,1fr)_minmax(0,3fr)_minmax(200px,1fr)]' : sideAdvertisements.length ? 'lg:grid-cols-[minmax(0,3fr)_minmax(240px,1fr)]' : ''}`}>
        {sideAdvertisements.length > 1 && renderSideAdvertisement(sideAdvertisements[0])}
        {mainAdvertisements.length > 0 && (
          <AdvertisementSlider
            ads={mainAdvertisements}
            prevLabel={t.products.previous}
            nextLabel={t.products.next}
            dotLabel={index => `Show promotion ${index + 1}`}
            renderChevron={direction => <ChevronIcon direction={direction} />}
          />
        )}
        {sideAdvertisements.length === 1 && renderSideAdvertisement(sideAdvertisements[0])}
        {sideAdvertisements.length > 1 && sideAdvertisements.slice(1).map(renderSideAdvertisement)}
        </div>
      </div>
    </section>
  )
}

function isActiveSalesPlacement(placement: SalesPlacement, product: Product) {
  const today = new Date().toISOString().slice(0, 10)
  return placement.active &&
    (!placement.startDate || placement.startDate <= today) &&
    (!placement.endDate || placement.endDate >= today) &&
    (placement.type === 'recommended' ||
      (placement.promotionalPrice !== undefined &&
        placement.promotionalPrice > 0 &&
        placement.promotionalPrice < product.price))
}

// ─── Sales & Promotions ───────────────────────────────────────────────────────
function SalesPromotions() {
  const [hovered, setHovered] = useState<number | null>(null)
  const { addToCart, addToRFQ, getBrandById, lang, products, salesPlacements, toggleWishlist, wishlist } = useStore()
  const { priceFor } = useCommerce()
  const selections = salesPlacements
    .map(placement => ({ placement, product: products.find(product => product.id === placement.productId) }))
    .filter((item): item is { placement: SalesPlacement; product: Product } =>
      item.product !== undefined && isActiveSalesPlacement(item.placement, item.product))
    .sort((a, b) => a.placement.displayOrder - b.placement.displayOrder)
    .slice(0, 8)

  if (!selections.length) return null

  return (
    <section className="py-5 sm:py-8 lg:py-11" style={{ background: 'var(--nb-light-blue)' }} aria-labelledby="sales-promotions-heading">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-12">
        <div className="mb-3 sm:mb-5 lg:mb-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <SectionLabel>NB LAO Selection</SectionLabel>
              <h2 id="sales-promotions-heading" className="font-display font-700 leading-[1.05]" style={{ fontSize: 'clamp(22px, 2.6vw, 36px)', color: NAVY }}>Sales &amp; Promotions</h2>
            </div>
            <Link to="/sales" className="flex items-center gap-1.5 shrink-0 min-h-8 font-ui text-[12px] font-600 no-underline whitespace-nowrap" style={{ color: 'var(--nb-primary-deep)' }}>View All <ArrowRightIcon /></Link>
          </div>
          <p className="font-ui text-[12px] sm:text-[13px] leading-relaxed mt-1.5 max-w-xl line-clamp-2 sm:line-clamp-none" style={{ color: 'var(--nb-text-secondary)' }}>Company-selected industrial products, current offers, and priority equipment for your next project.</p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 lg:gap-5" aria-label="Sales and promotions">
          {selections.map(({ placement, product }) => {
            const isHov = hovered === product.id
            const inWish = wishlist.includes(product.id)
            const promotionalPrice = placement.type === 'promotion' ? placement.promotionalPrice : undefined
            const discount = promotionalPrice ? Math.round((1 - promotionalPrice / product.price) * 100) : null
            const brand = getBrandName(getBrandById(product.brandId), lang)
            return (
              <article key={placement.id} className="rounded-lg overflow-hidden flex flex-col" style={{ background: '#fff', border: '1px solid var(--nb-border)' }} onMouseEnter={() => setHovered(product.id)} onMouseLeave={() => setHovered(null)}>
                <div className="relative overflow-hidden bg-slate-100 h-[132px] sm:h-36 lg:h-40">
                  <Link to={`/products/${product.id}`} className="block w-full h-full"><img src={assetUrl(product.img || '/product-placeholder.svg')} onError={event => { event.currentTarget.src = assetUrl('/product-placeholder.svg') }} alt={product.name} className="w-full h-full object-contain transition-transform duration-500" style={{ transform: isHov ? 'scale(1.05)' : 'scale(1)' }} /></Link>
                  <span className="rounded-sm absolute top-2 left-2 px-1.5 py-0.5 font-ui text-[8px] font-700 tracking-[0.12em] text-white" style={{ background: placement.type === 'promotion' ? GOLD : BLUE }}>{placement.type === 'promotion' ? 'SALE' : 'SELECTED'}</span>
                  <button type="button" onClick={() => toggleWishlist(product.id)} aria-label={inWish ? `Remove ${product.name} from wishlist` : `Add ${product.name} to wishlist`} className="rounded-md absolute top-2 right-2 w-6 h-6 flex items-center justify-center bg-white/90 hover:bg-white" style={{ color: inWish ? '#ef4444' : '#94a3b8' }}><HeartIcon filled={inWish} /></button>
                  <div className="absolute bottom-0 left-0 right-0 h-[2px] transition-opacity duration-300" style={{ background: GOLD, opacity: isHov ? 1 : 0 }} />
                </div>
                <div className="flex flex-col flex-1 p-3">
                  <span className="font-ui text-[9px] font-700 tracking-[0.14em] uppercase truncate mb-1" style={{ color: BLUE }}>{brand}</span>
                  <Link to={`/products/${product.id}`} className="no-underline"><h3 className="font-display font-700 text-[13px] leading-snug min-h-9 line-clamp-2" style={{ color: NAVY }}>{product.name}</h3></Link>
                  <p className="font-ui text-[10px] truncate mt-1" style={{ color: 'var(--nb-text-secondary)' }}>{product.model} · {product.category}</p>
                  <div className="flex items-center justify-between gap-2 mt-auto pt-3">
                    <div className="flex items-baseline gap-1 min-w-0"><ProductPrice product={product} size="sm" />{discount && <><span className="font-ui text-[9px] font-700 whitespace-nowrap" style={{ color: GOLD }}>−{discount}%</span></>}</div>
                    <StockBadge stock={product.stock} />
                  </div>
                  <div className="product-card-actions flex gap-1.5 h-8 mt-2">
                    <button type="button" disabled={product.stock <= 0 || !priceFor(product).ok} onClick={() => addToCart({ id: product.id, name: product.name, sku: product.sku, price: promotionalPrice ?? product.price, img: product.img, category: product.category, brand, stock: product.stock, priceUnit: product.priceUnit })} className="rounded-sm flex-1 min-w-0 font-ui text-[10px] font-600 px-1 text-white whitespace-nowrap disabled:opacity-50" style={{ background: isHov ? BLUE_H : BLUE }}>Add to Cart</button>
                    <button type="button" onClick={() => addToRFQ({ id: product.id, name: product.name, sku: product.sku, img: product.img, category: product.category })} className="rounded-md shrink-0 font-ui text-[10px] font-600 px-2" style={{ border: `1px solid ${NAVY}`, color: NAVY }}>RFQ</button>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      </div>
    </section>
  )
}

// ─── Product Categories ────────────────────────────────────────────────────────
function ProductCategories() {
  const t = useT()
  const { products } = useStore()
  const [hovered, setHovered] = useState<string | null>(null)
  return (
    <section className="py-8 lg:py-14" style={{ background: 'var(--nb-bg)' }}>
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-12">
        <div className="flex items-center justify-between mb-5 pb-4" style={{ borderBottom: '1px solid var(--nb-border)' }}>
          <div>
            <SectionLabel>Product Range</SectionLabel>
            <h2 className="font-display font-700 leading-[1.05]" style={{ fontSize: 'clamp(22px, 2.4vw, 34px)', color: NAVY }}>Browse by Category</h2>
          </div>
          <Link to="/products" className="flex items-center gap-2 font-ui text-[12px] font-500 no-underline" style={{ color: BLUE }}>
            {t.common.view_all} <ArrowRightIcon />
          </Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4 lg:gap-5">
          {CATEGORIES.map((cat) => {
            const isHov = hovered === cat
            return (
              <Link
                key={cat}
                to={`/products?category=${encodeURIComponent(cat)}`}
                className="rounded-lg no-underline flex flex-col overflow-hidden"
                style={{ border: '1px solid var(--nb-border)' }}
                onMouseEnter={() => setHovered(cat)}
                onMouseLeave={() => setHovered(null)}
              >
                <div className="relative overflow-hidden bg-slate-200" style={{ height: 90 }}>
                  <img src={assetUrl(CAT_IMAGES[cat])} alt={cat} className="w-full h-full object-cover transition-transform duration-500"
                    style={{ transform: isHov ? 'scale(1.06)' : 'scale(1)', opacity: isHov ? 0.85 : 0.72 }} />
                  <div className="absolute inset-0 transition-colors duration-300" style={{ background: isHov ? 'rgba(8,46,97,0.18)' : 'rgba(8,46,97,0.42)' }} />
                  <div className="absolute bottom-0 left-0 right-0 h-[2px] transition-all duration-300" style={{ background: GOLD, opacity: isHov ? 1 : 0 }} />
                </div>
                <div className="p-2.5 lg:p-3 transition-colors duration-200" style={{ background: isHov ? 'var(--nb-surface)' : '#fff' }}>
                  <h3 className="font-display font-700 text-[11px] lg:text-[12px] leading-snug mb-0.5" style={{ color: NAVY }}>{cat}</h3>
                  <p className="font-ui text-[10px] leading-snug line-clamp-2 hidden lg:block" style={{ color: '#7a8ea6' }}>{CAT_DESC[cat]}</p>
                  <span className="font-ui text-[9px] font-600 tracking-wide" style={{ color: BLUE }}>
                    {products.filter(p => p.category === cat).length}+ SKUs
                  </span>
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </section>
  )
}

// ─── Featured Products ─────────────────────────────────────────────────────────
function FeaturedProducts() {
  const t = useT()
  const [hovered, setHovered] = useState<number | null>(null)
  const { addToCart, toggleWishlist, wishlist, addToRFQ, getBrandById, lang, products } = useStore()
  const { priceFor } = useCommerce()
  const featured = products.filter(p => p.featured).slice(0, 8)

  return (
    <section className="py-8 lg:py-14" style={{ background: '#fff' }}>
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-12">
        <div className="flex items-center justify-between mb-5 lg:mb-8">
          <div>
            <SectionLabel>Product Catalogue</SectionLabel>
            <h2 className="font-display font-700 leading-[1.05]" style={{ fontSize: 'clamp(22px, 2.4vw, 34px)', color: NAVY }}>Featured Products</h2>
          </div>
          <Link to="/products" className="flex items-center gap-2 font-ui text-[12px] font-500 no-underline" style={{ color: BLUE }}>
            {t.header.view_all} <ArrowRightIcon />
          </Link>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 lg:gap-5">
          {featured.map((p) => {
            const isHov = hovered === p.id
            const inWish = wishlist.includes(p.id)
            return (
              <div key={p.id} className="rounded-lg overflow-hidden flex flex-col" style={{ background: isHov ? 'var(--nb-surface)' : '#fff', border: '1px solid var(--nb-border)' }}
                onMouseEnter={() => setHovered(p.id)} onMouseLeave={() => setHovered(null)}>
                <div className="relative overflow-hidden bg-slate-100" style={{ height: 140 }}>
                  <Link to={`/products/${p.id}`}>
                    <img src={assetUrl(p.img || '/product-placeholder.svg')} onError={event => { event.currentTarget.src = assetUrl('/product-placeholder.svg') }} alt={p.name} className="w-full h-full object-contain transition-transform duration-500"
                      style={{ transform: isHov ? 'scale(1.05)' : 'scale(1)' }} />
                  </Link>
                  <button onClick={() => toggleWishlist(p.id)}
                    className="rounded-md absolute top-2 right-2 w-6 h-6 flex items-center justify-center bg-white/90 hover:bg-white"
                    style={{ color: inWish ? '#ef4444' : '#94a3b8' }}>
                    <HeartIcon filled={inWish} />
                  </button>
                  <div className="absolute bottom-0 left-0 right-0 h-[2px] transition-all duration-300" style={{ background: GOLD, opacity: isHov ? 1 : 0 }} />
                </div>
                  <div className="p-3 flex flex-col flex-1">
                  <span className="font-ui text-[9px] font-700 tracking-[0.14em] uppercase mb-1" style={{ color: BLUE }}>{p.category}</span>
                  <Link to={`/products/${p.id}`} className="no-underline">
                    <h3 className="font-display font-700 text-[13px] leading-snug mb-1 hover:text-[var(--nb-primary)] transition-colors line-clamp-2" style={{ color: NAVY }}>{p.name}</h3>
                  </Link>
                  <div className="flex items-center justify-between mb-2 mt-auto pt-1">
                    <ProductPrice product={p} size="sm" />
                    <StockBadge stock={p.stock} />
                  </div>
                  <div className="product-card-actions flex gap-1.5 h-8">
                    <button disabled={!priceFor(p).ok || p.stock <= 0} onClick={() => addToCart({ id: p.id, name: p.name, sku: p.sku, price: p.price, img: p.img, category: p.category, brand: getBrandName(getBrandById(p.brandId), lang), stock: p.stock })}
                      className="rounded-sm flex-1 min-w-0 font-ui text-[10px] font-600 px-2 text-white whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{ background: isHov ? BLUE_H : BLUE }}>
                      {t.common.add_to_cart}
                    </button>
                    <button onClick={() => addToRFQ({ id: p.id, name: p.name, sku: p.sku, img: p.img, category: p.category })}
                      className="rounded-md shrink-0 font-ui text-[10px] font-600 px-2.5"
                      style={{ border: `1px solid ${NAVY}`, color: NAVY }}>
                      {t.products.rfq_short}
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

// ─── Industries ────────────────────────────────────────────────────────────────
function IndustriesSection() {
  const [active, setActive] = useState(0)
  return (
    <section className="py-8 lg:py-14" style={{ background: NAVY }}>
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-12">
        <div className="grid lg:grid-cols-[380px_1fr] gap-10 lg:gap-16 items-start">
          <div>
            <SectionLabel light>Sectors Served</SectionLabel>
            <h2 className="font-display font-700 leading-[1.05] mb-3" style={{ fontSize: 'clamp(22px, 2.4vw, 34px)', color: '#fff' }}>Industries We Serve</h2>
            <p className="font-ui text-[13px] leading-[1.7] mb-6" style={{ color: 'rgba(255,255,255,0.48)' }}>
              From hydroelectric power infrastructure to precision manufacturing lines, we source and deliver the right technical equipment for demanding industrial environments.
            </p>
            <div className="flex flex-col" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
              {INDUSTRIES.map((ind, i) => (
                <button key={ind.id} onClick={() => setActive(i)}
                  className="rounded-md text-left flex items-center justify-between px-4 py-3.5 transition-all duration-150"
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.07)', borderLeft: `2px solid ${active === i ? GOLD : 'transparent'}`, background: active === i ? 'rgba(255,255,255,0.05)' : 'transparent' }}>
                  <div className="flex items-center gap-3">
                    <span className="text-[16px] opacity-80">{ind.icon}</span>
                    <div>
                      <div className="font-display font-700 text-[14px]" style={{ color: active === i ? '#fff' : 'rgba(255,255,255,0.6)' }}>{ind.name}</div>
                      {active === i && <div className="font-ui text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.45)' }}>{ind.desc}</div>}
                    </div>
                  </div>
                  <span className="font-ui text-[11px] font-600 shrink-0 ml-4" style={{ color: active === i ? GOLD : 'rgba(255,255,255,0.3)' }}>{ind.stat}</span>
                </button>
              ))}
            </div>
            <div className="mt-5">
              <Link to="/industries" className="font-ui text-[12px] no-underline flex items-center gap-1.5" style={{ color: 'rgba(255,255,255,0.5)' }}>
                View all industries <ArrowRightIcon />
              </Link>
            </div>
          </div>
          <div className="hidden lg:block relative">
            <div className="relative overflow-hidden" style={{ height: 380, background: 'var(--nb-navy)' }}>
              <img src={assetUrl("/site-images/3ea03ff0d86f.jpg")}
                alt="Industrial facility" className="w-full h-full object-cover" style={{ opacity: 0.55 }} />
              <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(8,46,97,0.92) 0%, rgba(8,46,97,0.2) 55%, transparent 100%)' }} />
              <div className="absolute bottom-0 left-0 right-0 p-6">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-5 h-px" style={{ background: GOLD }} />
                  <span className="font-ui text-[10px] tracking-[0.22em] uppercase font-600" style={{ color: GOLD }}>Currently Viewing</span>
                </div>
                <div className="font-display font-800 text-white text-[26px] leading-none mb-1">{INDUSTRIES[active].name}</div>
                <div className="font-ui text-[12px]" style={{ color: 'rgba(255,255,255,0.55)' }}>{INDUSTRIES[active].desc}</div>
              </div>
              <div className="absolute top-0 right-0 w-10 h-10" style={{ borderTop: `2px solid ${GOLD}`, borderRight: `2px solid ${GOLD}` }} />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

// ─── Brands ────────────────────────────────────────────────────────────────────
function BrandsSection() {
  const { activeBrands, lang } = useStore()
  const t = useT()
  const items = activeBrands.map(brand => ({
    id: brand.id,
    name: getBrandName(brand, lang),
    logo: brand.logo,
    url: brand.websiteUrl,
  }))

  return (
    <section className="py-6 lg:py-14" style={{ background: 'var(--nb-bg)', borderTop: '1px solid var(--nb-border)', borderBottom: '1px solid var(--nb-border)' }}>
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-12">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 mb-3 lg:mb-5">
          <h2 className="font-ui partner-section-label">Authorised Brand Partners</h2>
          <Link to="/partners#brand-partners" className="flex shrink-0 items-center gap-1.5 font-ui text-[11px] no-underline" style={{ color: BLUE }}>
            {t.common.view_all} <ArrowRightIcon />
          </Link>
        </div>
        <LogoCarousel ariaLabel="Authorised brand partners" items={items} limit={10} />
      </div>
    </section>
  )
}

function BusinessPartnersSection() {
  const { partners, brands } = useStore()
  const t = useT()
  const items = [...partners]
    .filter(partner => partner.active)
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map(partner => ({
      id: partner.id,
      name: partner.name,
      logo: partner.logo || brands.find(brand => brand.id === partner.brandId)?.logo || '',
      url: partner.url,
    }))
    .filter(partner => partner.logo)

  if (!items.length) return null

  return (
    <section className="py-6 lg:py-14" style={{ background: 'var(--nb-surface)', borderBottom: '1px solid var(--nb-border)' }}>
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-12">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 mb-3 lg:mb-5">
          <h2 className="font-ui partner-section-label">{t.footer.business_partners}</h2>
          <Link to="/partners#business-partners" className="flex shrink-0 items-center gap-1.5 font-ui text-[11px] no-underline" style={{ color: BLUE }}>
            {t.common.view_all} <ArrowRightIcon />
          </Link>
        </div>
        <LogoCarousel ariaLabel={t.footer.business_partners} items={items} variant="business" limit={10} />
      </div>
    </section>
  )
}

// ─── CTA ──────────────────────────────────────────────────────────────────────
function CTASection() {
  const t = useT()
  return (
    <section className="relative overflow-hidden py-10 lg:py-16" style={{ background: 'var(--nb-navy)' }}>
      <div className="absolute inset-0" style={{ pointerEvents: 'none' }}>
        <img src={assetUrl("/site-images/5ebe4e342d35.jpg")}
          alt="Industrial factory" className="w-full h-full object-cover" style={{ opacity: 0.18 }} />
        <div className="absolute inset-0" style={{ background: 'rgba(7,33,61,0.55)', pointerEvents: 'none' }} />
      </div>
      <div className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ background: GOLD, pointerEvents: 'none' }} />
      <div className="relative max-w-[1440px] mx-auto px-6 lg:px-12 text-center" style={{ zIndex: 1 }}>
        <div className="flex items-center justify-center gap-4 mb-4">
          <div className="h-px w-8" style={{ background: GOLD, opacity: 0.6 }} />
          <span className="font-ui text-[10px] tracking-[0.24em] uppercase font-600" style={{ color: GOLD }}>Get in Touch</span>
          <div className="h-px w-8" style={{ background: GOLD, opacity: 0.6 }} />
        </div>
        <h2 className="font-display font-800 text-white mb-4" style={{ fontSize: 'clamp(26px, 3.5vw, 48px)', letterSpacing: '-0.01em', lineHeight: 1.05 }}>
          Need Industrial Equipment?
        </h2>
        <p className="font-ui text-[13.5px] leading-[1.7] max-w-md mx-auto mb-6" style={{ color: 'rgba(255,255,255,0.5)' }}>
          Tell us what you need. Our technical team will provide specifications, availability, and competitive pricing within 24 hours.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link to="/rfq" className="rounded-md flex items-center gap-2 font-ui text-[13px] font-600 px-8 py-3 no-underline" style={{ background: BLUE, color: '#fff' }}
            onMouseEnter={e => (e.currentTarget.style.background = BLUE_H)} onMouseLeave={e => (e.currentTarget.style.background = BLUE)}>
            {t.common.request_quote} <ArrowRightIcon />
          </Link>
          <Link to="/contact" className="rounded-md font-ui text-[13px] font-500 px-8 py-3 no-underline" style={{ border: '1px solid rgba(255,255,255,0.22)', color: 'rgba(255,255,255,0.8)' }}>
            {t.common.contact_us}
          </Link>
        </div>
      </div>
    </section>
  )
}

export default function Home() {
  return (
    <>
      <Advertisements />
      <Hero />
      <ProductCategories />
      <SalesPromotions />
      <FeaturedProducts />
      <IndustriesSection />
      <BrandsSection />
      <CTASection />
      <BusinessPartnersSection />
    </>
  )
}
