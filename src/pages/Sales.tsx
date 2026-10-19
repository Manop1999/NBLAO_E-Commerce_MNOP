import { ProductPrice } from "../commerce/ui"
import { useCommerce } from "../commerce/CommerceProvider"
import { Link } from "react-router-dom"
import { useStore, type SalesPlacement } from "../store"
import { getBrandName } from "../brands"
import { StockBadge } from "../components/StockBadge"
import { useToast } from "../components/Toast"
import type { Product } from "../data"

const NAVY = "var(--nb-navy)"
const BLUE = "var(--nb-primary)"
const GOLD = "var(--nb-gold)"

function isActiveNow(placement: SalesPlacement) {
  const today = new Date().toISOString().slice(0, 10)
  return (
    placement.active &&
    (!placement.startDate || placement.startDate <= today) &&
    (!placement.endDate || placement.endDate >= today)
  )
}

function SalesProductCard({
  product,
  placement,
  label,
}: {
  product: Product
  placement?: SalesPlacement
  label?: string
}) {
  const { addToCart, addToRFQ, getBrandById, lang } = useStore()
  const { addToast } = useToast()
  const { priceFor } = useCommerce()
  const salePrice = placement?.promotionalPrice
  const brand = getBrandName(getBrandById(product.brandId), lang)
  const discount =
    salePrice && salePrice < product.price
      ? Math.round((1 - salePrice / product.price) * 100)
      : null

  return (
    <article
      className="rounded-lg overflow-hidden flex flex-col bg-white"
      style={{ border: "1px solid var(--nb-border)" }}
    >
      <div
        className="relative h-32 overflow-hidden sm:h-36 lg:h-40"
        style={{ background: "var(--nb-bg)" }}
      >
        <Link to={`/products/${product.id}`} className="block w-full h-full">
          <img
            src={product.img || "/product-placeholder.svg"}
            onError={(event) => {
              event.currentTarget.src = "/product-placeholder.svg"
            }}
            alt={product.name}
            className="w-full h-full object-contain"
          />
        </Link>
        {label && (
          <span
            className="rounded-sm absolute top-2 left-2 px-1.5 py-0.5 font-ui text-[8px] font-700 tracking-wide text-white"
            style={{ background: label === "Promotion" ? GOLD : BLUE }}
          >
            {label.toUpperCase()}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-3 lg:p-3.5">
        <div className="mb-1 flex items-center justify-between gap-2">
          <span
            className="truncate font-ui text-[9px] font-700 uppercase tracking-[0.1em]"
            style={{ color: BLUE }}
          >
            {brand}
          </span>
          <StockBadge
            stock={product.stock}
            size="sm"
          />
        </div>
        <Link to={`/products/${product.id}`} className="no-underline">
          <h2
            className="min-h-9 font-display text-[13px] font-700 leading-snug lg:text-[14px]"
            style={{ color: NAVY }}
          >
            {product.name}
          </h2>
        </Link>
        <p
          className="mt-1 truncate font-ui text-[10px]"
          style={{ color: "var(--nb-text-secondary)" }}
        >
          {product.model} · {product.category}
        </p>
        <div className="mt-auto flex items-baseline gap-1 pt-3">
          <ProductPrice product={product} size="sm" />
          {discount && (
            <>
              <span
                className="font-ui text-[9px] font-700"
                style={{ color: GOLD }}
              >
                −{discount}%
              </span>
            </>
          )}
        </div>
        <div className="product-card-actions mt-2 flex h-8 gap-1">
          <button
            disabled={product.stock <= 0 || !priceFor(product).ok}
            onClick={() => {
              addToCart({
                id: product.id,
                name: product.name,
                sku: product.sku,
                price: salePrice ?? product.price,
                img: product.img,
                category: product.category,
                brand,
                stock: product.stock,
                priceUnit: product.priceUnit,
              })
            }}
            className="rounded-sm flex-1 font-ui text-[10px] font-600 text-white disabled:cursor-not-allowed disabled:opacity-50"
            style={{ background: BLUE }}
          >
            Add to Cart
          </button>
          <button
            onClick={() => {
              addToRFQ({
                id: product.id,
                name: product.name,
                sku: product.sku,
                img: product.img,
                category: product.category,
              })
              addToast("Added to RFQ.", "info")
            }}
            className="rounded-md px-2 font-ui text-[10px] font-600"
            style={{ border: `1px solid ${NAVY}`, color: NAVY }}
          >
            RFQ
          </button>
        </div>
      </div>
    </article>
  )
}

function ProductSection({
  title,
  eyebrow,
  products,
  placements,
  label,
}: {
  title: string
  eyebrow: string
  products: Product[]
  placements?: SalesPlacement[]
  label?: string
}) {
  if (!products.length) return null
  return (
    <section className="py-6 sm:py-8">
      <div className="mb-4">
        <p
          className="font-ui text-[10px] font-700 uppercase tracking-[0.16em]"
          style={{ color: GOLD }}
        >
          {eyebrow}
        </p>
        <h2
          className="font-display text-[25px] font-700"
          style={{ color: NAVY }}
        >
          {title}
        </h2>
      </div>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4 lg:gap-4 min-[1440px]:grid-cols-5">
        {products.map((product) => (
          <SalesProductCard
            key={product.id}
            product={product}
            placement={placements?.find(
              (item) => item.productId === product.id,
            )}
            label={label}
          />
        ))}
      </div>
    </section>
  )
}

export default function Sales() {
  const { products, salesPlacements } = useStore()
  const active = salesPlacements
    .filter(
      (item) =>
        isActiveNow(item) &&
        products.some((product) => product.id === item.productId),
    )
    .sort((a, b) => a.displayOrder - b.displayOrder)
  const promotions = active.filter(
    (item) =>
      item.type === "promotion" &&
      item.promotionalPrice !== undefined &&
      item.promotionalPrice > 0,
  )
  const recommended = active.filter((item) => item.type === "recommended")
  const productsFor = (placements: SalesPlacement[]) =>
    placements
      .map((item) => products.find((product) => product.id === item.productId))
      .filter((product): product is Product => Boolean(product))
  const featured = products.filter((product) => product.featured)
  const hasContent = promotions.length || recommended.length || featured.length

  return (
    <div style={{ background: "var(--nb-bg)" }}>
      <div
        className="border-b bg-white"
        style={{ borderColor: "var(--nb-border)" }}
      >
        <div className="mx-auto max-w-[1440px] px-4 py-7 sm:px-6 sm:py-10 lg:px-12 lg:py-12">
          <p
            className="font-ui text-[10px] font-700 uppercase tracking-[0.18em]"
            style={{ color: GOLD }}
          >
            NB LAO selection
          </p>
          <h1
            className="mt-1 font-display text-[32px] font-700 leading-none sm:text-[42px] lg:text-[48px]"
            style={{ color: NAVY }}
          >
            Sales & Promotions
          </h1>
          <p
            className="mt-3 max-w-xl font-ui text-[13px] leading-relaxed lg:max-w-2xl lg:text-[14px]"
            style={{ color: "var(--nb-text-secondary)" }}
          >
            Company-selected industrial products, current offers, and priority
            equipment for your next project.
          </p>
        </div>
      </div>
      <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-12">
        {hasContent ? (
          <>
            <ProductSection
              title="Promotional Products"
              eyebrow="Current offers"
              products={productsFor(promotions)}
              placements={promotions}
              label="Promotion"
            />
            <ProductSection
              title="Recommended Products"
              eyebrow="NB LAO recommends"
              products={productsFor(recommended)}
              placements={recommended}
              label="Recommended"
            />
            <ProductSection
              title="Featured Products"
              eyebrow="Company highlights"
              products={featured}
              label="Featured"
            />
          </>
        ) : (
          <div className="mx-auto max-w-xl py-16 text-center sm:py-24">
            <h2
              className="font-display text-[26px] font-700"
              style={{ color: NAVY }}
            >
              No current sales selections
            </h2>
            <p
              className="mt-2 font-ui text-[13px]"
              style={{ color: "var(--nb-text-secondary)" }}
            >
              Our team has not published a promotion or featured product yet.
            </p>
            <Link
              to="/products"
              className="rounded-md mt-5 inline-flex px-5 py-2.5 font-ui text-[12px] font-600 text-white no-underline"
              style={{ background: BLUE }}
            >
              Browse Product Catalogue
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
