/*
 * API records → the Product / Brand shapes the storefront components already use.
 *
 * Rules (explicit, so API data and local demo data never mix silently):
 * - `Product.id` is the API `legacyId`, because cart, compare, wishlist, RFQ and /products/:id use numeric ids.
 *   Products without a legacyId (none today) are skipped and counted, not given invented ids.
 * - Stock is not part of the API yet (inventory comes in Phase 1F): `stock: 0` with `stockKnown: false`, which
 *   the UI shows as "Availability on request" and which blocks Add to Cart while keeping RFQ available.
 * - Prices arrive as integer minor units; they are converted to the major-unit numbers the UI uses. A price too
 *   large for exact JavaScript arithmetic makes the product skipped rather than rounded.
 */
import type { Brand } from '../brands'
import type { Product } from '../data'
import type { ProductVariant } from '../lib/variants'
import type { ApiBrand, ApiPrice, ApiProduct, StorefrontCatalog } from './types'

export const AVAILABILITY_ON_REQUEST = 'Availability on request'

/** Minor units → major units, or null when the value cannot be represented exactly. */
export function priceToMajor(price: ApiPrice): number | null {
  const minor = BigInt(price.minor)
  if (minor > BigInt(Number.MAX_SAFE_INTEGER)) return null
  return Number(minor) / 10 ** price.decimals
}

export function mapApiBrand(brand: ApiBrand): Brand {
  return {
    id: brand.id,
    name: brand.name,
    nameEn: brand.name,
    nameLo: brand.nameLo ?? '',
    logo: brand.logoUrl ?? '',
    active: true,
    displayOrder: brand.displayOrder,
    websiteUrl: brand.websiteUrl ?? '',
    description: '',
  }
}

const formatDisplayPrice = (amount: number, price: ApiPrice) =>
  `${price.currency} ${amount.toLocaleString('en-US', { minimumFractionDigits: price.decimals, maximumFractionDigits: price.decimals })}`

/** Returns null when the product cannot be shown safely (see rules above). */
export function mapApiProduct(api: ApiProduct): Product | null {
  if (api.legacyId === null) return null
  const price = priceToMajor(api.price)
  if (price === null) return null

  const variants: ProductVariant[] = []
  for (const variant of api.variants) {
    const variantPrice = variant.price === null ? undefined : priceToMajor(variant.price)
    if (variantPrice === null) return null
    variants.push({
      id: variant.sku,
      sku: variant.sku,
      options: { ...variant.optionValues },
      ...(variantPrice === undefined ? {} : { price: variantPrice }),
      stock: 0,
      active: true,
      visible: true,
      purchasable: variant.purchasable,
      ...(variant.images.length ? { images: variant.images.map(image => image.url) } : {}),
    })
  }

  const [main, ...rest] = api.images
  const parent = api.category.parent
  return {
    id: api.legacyId,
    name: api.name,
    sku: api.sku,
    brandId: api.brand?.id ?? '',
    category: parent ? parent.name : api.category.name,
    subcategory: parent ? api.category.name : '',
    model: api.model ?? '',
    price,
    priceCurrency: api.price.currency,
    priceDisplay: formatDisplayPrice(price, api.price),
    priceUnit: api.priceUnit ?? '',
    ...(api.minOrderQuantity === null ? {} : { moq: api.minOrderQuantity }),
    ...(api.leadTime === null ? {} : { leadTime: api.leadTime }),
    stock: 0,
    stockKnown: false,
    stockLabel: AVAILABILITY_ON_REQUEST,
    img: main?.url ?? '',
    images: rest.map(image => image.url),
    shortDesc: api.shortDescription ?? '',
    description: api.description ?? '',
    spec: '',
    specs: api.specs.map(spec => ({ ...spec })),
    applications: [...api.applications],
    tags: [...api.tags],
    featured: api.featured,
    certifications: [...api.certifications],
    active: true,
    ...(api.options.length ? { options: api.options.map(option => ({ name: option.name, values: [...option.values] })) } : {}),
    ...(variants.length ? { variants } : {}),
    demoOptions: api.demoOptions,
  }
}

export function mapCatalog(apiProducts: ApiProduct[], apiBrands: ApiBrand[]): StorefrontCatalog {
  const products: Product[] = []
  const ids = new Set<number>()
  let skipped = 0
  for (const api of apiProducts) {
    const product = mapApiProduct(api)
    // Two API products claiming the same legacy id would collide in carts and URLs; keep the first.
    if (!product || ids.has(product.id)) {
      skipped++
      continue
    }
    ids.add(product.id)
    products.push(product)
  }
  return { products, brands: apiBrands.map(mapApiBrand), skipped }
}
