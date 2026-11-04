/*
 * Public catalog API contract (mirror of server/src/catalog/dto.ts) and the repository the storefront uses.
 * Components never call fetch() directly; they read the catalog through CatalogProvider.
 */
import type { Brand } from '../brands'
import type { Product } from '../data'

export interface ApiPrice {
  minor: string
  currency: string
  decimals: number
}

export interface ApiImage {
  url: string
  altText: string | null
  position: number
}

export interface ApiBrand {
  id: string
  name: string
  nameLo: string | null
  logoUrl: string | null
  websiteUrl: string | null
  displayOrder: number
}

export interface ApiVariant {
  sku: string
  optionValues: Record<string, string>
  price: ApiPrice | null
  purchasable: boolean
  images: ApiImage[]
}

export interface ApiProduct {
  id: string
  legacyId: number | null
  sku: string
  name: string
  model: string | null
  brand: { id: string; name: string } | null
  category: { slug: string; name: string; parent: { slug: string; name: string } | null }
  price: ApiPrice
  priceUnit: string | null
  minOrderQuantity: number | null
  leadTime: string | null
  shortDescription: string | null
  description: string | null
  specs: { label: string; value: string }[]
  options: { name: string; values: string[] }[]
  applications: string[]
  tags: string[]
  certifications: string[]
  featured: boolean
  demoOptions: boolean
  isDemo: boolean
  images: ApiImage[]
  variants: ApiVariant[]
}

export interface ApiProductPage {
  items: ApiProduct[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export type CatalogLoadErrorCode =
  | 'network'
  | 'http'
  | 'invalid_response'
  | 'too_large'
  | 'inconsistent'
  | 'aborted'

/** Loading failed; the storefront shows an error instead of a partial or stale catalog. */
export class CatalogLoadError extends Error {
  readonly code: CatalogLoadErrorCode

  constructor(code: CatalogLoadErrorCode, message: string) {
    super(message)
    this.name = 'CatalogLoadError'
    this.code = code
  }
}

export interface CatalogRepository {
  /** Every public product, following the API's pagination until the last page. */
  listAllProducts(signal?: AbortSignal): Promise<ApiProduct[]>
  listBrands(signal?: AbortSignal): Promise<ApiBrand[]>
}

/** Catalog in the shapes the existing storefront components already use. */
export interface StorefrontCatalog {
  products: Product[]
  brands: Brand[]
  /** API products left out because the storefront cannot address them yet (see mapApiProduct). */
  skipped: number
}
