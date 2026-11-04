/**
 * Public catalog response contracts. Only the fields listed here can leave the API; database rows are never
 * returned directly. JSON columns are re-shaped field by field so unexpected keys stored in them are dropped.
 */
import { CURRENCY_DECIMALS } from '../db/seed.ts'

export interface PublicPrice {
  /** Integer minor units as a decimal string (BIGINT-safe). */
  minor: string
  currency: string
  /** Minor-unit digits of `currency` (USD 2, LAK 0). */
  decimals: number
}

export interface PublicImage {
  url: string
  altText: string | null
  position: number
}

export interface PublicBrand {
  id: string
  name: string
  nameLo: string | null
  logoUrl: string | null
  websiteUrl: string | null
  displayOrder: number
}

export interface PublicCategory {
  slug: string
  name: string
  parent: { slug: string; name: string } | null
}

export interface PublicVariant {
  sku: string
  optionValues: Record<string, string>
  /** Null when the variant uses the product price. */
  price: PublicPrice | null
  purchasable: boolean
  images: PublicImage[]
}

export interface PublicProduct {
  id: string
  /** Numeric id used by the current frontend; null for products created after the prototype. */
  legacyId: number | null
  sku: string
  name: string
  model: string | null
  brand: { id: string; name: string } | null
  category: PublicCategory
  price: PublicPrice
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
  /** Options/variants are demonstration defaults, not manufacturer-verified. */
  demoOptions: boolean
  /** Demonstration record (seeded sample data). */
  isDemo: boolean
  images: PublicImage[]
  variants: PublicVariant[]
}

export interface ProductPage {
  items: PublicProduct[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export const SUPPORTED_CURRENCIES: readonly string[] = Object.keys(CURRENCY_DECIMALS)

export function toPublicPrice(minor: bigint, currency: string): PublicPrice {
  const decimals = CURRENCY_DECIMALS[currency]
  // The reader only selects supported currencies; this guards against a future caller forgetting that.
  if (decimals === undefined) throw new Error(`unsupported currency ${currency}`)
  return { minor: minor.toString(), currency, decimals }
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)

export function toSpecs(value: unknown): PublicProduct['specs'] {
  if (!Array.isArray(value)) return []
  return value.flatMap(item =>
    isRecord(item) && typeof item.label === 'string' && typeof item.value === 'string' ? [{ label: item.label, value: item.value }] : [],
  )
}

export function toOptions(value: unknown): PublicProduct['options'] {
  if (!Array.isArray(value)) return []
  return value.flatMap(item =>
    isRecord(item) && typeof item.name === 'string' && Array.isArray(item.values)
      ? [{ name: item.name, values: item.values.filter((v): v is string => typeof v === 'string') }]
      : [],
  )
}

export function toOptionValues(value: unknown): Record<string, string> {
  if (!isRecord(value)) return {}
  return Object.fromEntries(Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === 'string'))
}
