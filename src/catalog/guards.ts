/* Runtime shape checks for API responses. Anything that does not match is rejected, never coerced. */
import type { ApiBrand, ApiImage, ApiPrice, ApiProduct, ApiProductPage, ApiVariant } from './types'

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const isString = (v: unknown): v is string => typeof v === 'string'
const isNullableString = (v: unknown): v is string | null => v === null || typeof v === 'string'
const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v)
const isStringArray = (v: unknown): v is string[] => Array.isArray(v) && v.every(isString)
const isArrayOf = <T>(v: unknown, guard: (x: unknown) => x is T): v is T[] => Array.isArray(v) && v.every(guard)

export const isApiPrice = (v: unknown): v is ApiPrice =>
  isObject(v) && isString(v.minor) && /^\d+$/.test(v.minor) && isString(v.currency) && /^[A-Z]{3}$/.test(v.currency) && isInt(v.decimals) && v.decimals >= 0 && v.decimals <= 4

const isApiImage = (v: unknown): v is ApiImage => isObject(v) && isString(v.url) && isNullableString(v.altText) && isInt(v.position)

const isApiVariant = (v: unknown): v is ApiVariant =>
  isObject(v) &&
  isString(v.sku) &&
  isObject(v.optionValues) &&
  Object.values(v.optionValues).every(isString) &&
  (v.price === null || isApiPrice(v.price)) &&
  typeof v.purchasable === 'boolean' &&
  isArrayOf(v.images, isApiImage)

const isNamed = (v: unknown): v is { slug: string; name: string } => isObject(v) && isString(v.slug) && isString(v.name)
const isCategory = (v: unknown): v is ApiProduct['category'] =>
  isObject(v) && isString(v.slug) && isString(v.name) && (v.parent === null || isNamed(v.parent))

export const isApiProduct = (v: unknown): v is ApiProduct =>
  isObject(v) &&
  isString(v.id) &&
  (v.legacyId === null || isInt(v.legacyId)) &&
  isString(v.sku) &&
  isString(v.name) &&
  isNullableString(v.model) &&
  (v.brand === null || (isObject(v.brand) && isString(v.brand.id) && isString(v.brand.name))) &&
  isCategory(v.category) &&
  isApiPrice(v.price) &&
  isNullableString(v.priceUnit) &&
  (v.minOrderQuantity === null || isInt(v.minOrderQuantity)) &&
  isNullableString(v.leadTime) &&
  isNullableString(v.shortDescription) &&
  isNullableString(v.description) &&
  isArrayOf(v.specs, (s): s is { label: string; value: string } => isObject(s) && isString(s.label) && isString(s.value)) &&
  isArrayOf(v.options, (o): o is { name: string; values: string[] } => isObject(o) && isString(o.name) && isStringArray(o.values)) &&
  isStringArray(v.applications) &&
  isStringArray(v.tags) &&
  isStringArray(v.certifications) &&
  typeof v.featured === 'boolean' &&
  typeof v.demoOptions === 'boolean' &&
  typeof v.isDemo === 'boolean' &&
  isArrayOf(v.images, isApiImage) &&
  isArrayOf(v.variants, isApiVariant)

export const isApiProductPage = (v: unknown): v is ApiProductPage =>
  isObject(v) &&
  Array.isArray(v.items) &&
  isInt(v.page) &&
  isInt(v.pageSize) &&
  isInt(v.total) &&
  isInt(v.totalPages) &&
  v.page >= 1 &&
  v.pageSize >= 1 &&
  v.total >= 0 &&
  v.totalPages >= 0 &&
  v.items.every(isApiProduct)

export const isApiBrand = (v: unknown): v is ApiBrand =>
  isObject(v) &&
  isString(v.id) &&
  isString(v.name) &&
  isNullableString(v.nameLo) &&
  isNullableString(v.logoUrl) &&
  isNullableString(v.websiteUrl) &&
  isInt(v.displayOrder)

export const isApiBrandList = (v: unknown): v is { items: ApiBrand[] } => isObject(v) && isArrayOf(v.items, isApiBrand)
