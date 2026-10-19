/** Pure product-variant helpers (selection, availability, validation). No React / storage. */
import { getStockStatus, type StockStatusKey } from './stockStatus'

export interface ProductOption {
  /** e.g. "Voltage", "Color", "Size" */
  name: string
  values: string[]
}

export interface ProductVariant {
  id: string
  sku: string
  /** option name -> chosen value */
  options: Record<string, string>
  /** undefined = inherit the product price */
  price?: number
  stock: number
  active: boolean
  visible: boolean
  purchasable: boolean
  images?: string[]
}

export interface VariantProductLike {
  price: number
  stock: number
  options?: ProductOption[]
  variants?: ProductVariant[]
}

export type Selection = Record<string, string>

export const hasVariants = (p: Pick<VariantProductLike, 'options' | 'variants'>): boolean =>
  !!p.options?.length && !!p.variants?.length

/** Variants shown to customers. */
export const visibleVariants = (p: Pick<VariantProductLike, 'variants'>): ProductVariant[] =>
  (p.variants ?? []).filter((v) => v.active && v.visible)

export const variantCanBePurchased = (v: ProductVariant): boolean =>
  v.active && v.visible && v.purchasable && v.stock > 0

export const variantPrice = (p: Pick<VariantProductLike, 'price'>, v: ProductVariant): number =>
  typeof v.price === 'number' && v.price > 0 ? v.price : p.price

export const variantStatus = (v: ProductVariant): StockStatusKey =>
  getStockStatus({ stock: v.stock, active: v.active && v.visible && v.purchasable })

export const variantLabel = (p: Pick<VariantProductLike, 'options'>, v: ProductVariant): string =>
  (p.options ?? [])
    .map((o) => (v.options[o.name] ? `${o.name}: ${v.options[o.name]}` : ''))
    .filter(Boolean)
    .join(' · ')

/** Stock a product-level view should show: the sum of purchasable variants, or its own stock. */
export function aggregateStock(p: VariantProductLike): number {
  if (!hasVariants(p)) return p.stock
  return (p.variants ?? []).filter((v) => v.active && v.purchasable).reduce((sum, v) => sum + Math.max(0, v.stock), 0)
}

export function priceRange(p: VariantProductLike): { min: number; max: number } {
  if (!hasVariants(p)) return { min: p.price, max: p.price }
  const prices = visibleVariants(p).map((v) => variantPrice(p, v))
  if (!prices.length) return { min: p.price, max: p.price }
  return { min: Math.min(...prices), max: Math.max(...prices) }
}

export const isSelectionComplete = (p: Pick<VariantProductLike, 'options'>, sel: Selection): boolean =>
  (p.options ?? []).every((o) => !!sel[o.name])

const matches = (v: ProductVariant, sel: Selection, skip?: string) =>
  Object.entries(sel).every(([k, val]) => k === skip || v.options[k] === val)

/** The variant that exactly matches a complete selection, if any is visible. */
export function resolveVariant(p: VariantProductLike, sel: Selection): ProductVariant | undefined {
  if (!isSelectionComplete(p, sel)) return undefined
  return visibleVariants(p).find((v) => (p.options ?? []).every((o) => v.options[o.name] === sel[o.name]))
}

export type ValueState = 'available' | 'out_of_stock' | 'invalid'

/**
 * State of one option value given the other current selections:
 * invalid = no visible variant has that combination, out_of_stock = exists but cannot be bought.
 */
export function optionValueState(p: VariantProductLike, sel: Selection, optionName: string, value: string): ValueState {
  const candidates = visibleVariants(p).filter((v) => v.options[optionName] === value && matches(v, sel, optionName))
  if (!candidates.length) return 'invalid'
  return candidates.some(variantCanBePurchased) ? 'available' : 'out_of_stock'
}

/** Drop selections that no longer lead to any visible variant (after another option changed). */
export function pruneSelection(p: VariantProductLike, sel: Selection, changed: string): Selection {
  const next: Selection = { ...sel }
  for (const o of p.options ?? []) {
    if (o.name === changed || !next[o.name]) continue
    if (optionValueState(p, next, o.name, next[o.name]) === 'invalid') delete next[o.name]
  }
  return next
}

/** A variant whose option map no longer fits the product's current option groups/values. */
export const isObsoleteVariant = (options: ProductOption[], v: ProductVariant): boolean =>
  Object.keys(v.options).some((k) => !options.some((o) => o.name === k)) ||
  options.some((o) => !v.options[o.name] || !o.values.includes(v.options[o.name]))

export interface VariantIssue {
  code:
    | 'sku_required'
    | 'sku_duplicate'
    | 'sku_conflict'
    | 'combination_duplicate'
    | 'option_missing'
    | 'option_unknown'
    | 'value_unknown'
    | 'stock_invalid'
    | 'price_invalid'
    | 'option_empty'
    | 'option_duplicate'
    | 'value_duplicate'
  variantId?: string
  /** option group index for option-level issues */
  optionIndex?: number
  message: string
}

/** Validate the option set and variant list; `otherSkus` are SKUs used by other products. */
export function validateVariants(
  options: ProductOption[],
  variants: ProductVariant[],
  otherSkus: Iterable<string> = [],
): VariantIssue[] {
  const issues: VariantIssue[] = []
  const taken = new Set([...otherSkus].map((s) => s.trim().toLowerCase()))
  const skuSeen = new Set<string>()
  const comboSeen = new Set<string>()
  const names = new Set<string>()
  options.forEach((o, optionIndex) => {
    if (!o.name.trim() || !o.values.length || o.values.some((x) => !x.trim()))
      issues.push({ code: 'option_empty', optionIndex, message: `Option "${o.name || '(unnamed)'}" needs a name and at least one value.` })
    const key = o.name.trim().toLowerCase()
    if (key && names.has(key)) issues.push({ code: 'option_duplicate', optionIndex, message: `Option name "${o.name}" is used twice.` })
    names.add(key)
    const seen = new Set<string>()
    for (const val of o.values) {
      const k = val.trim().toLowerCase()
      if (k && seen.has(k)) issues.push({ code: 'value_duplicate', optionIndex, message: `"${val}" appears twice in ${o.name || 'an option'}.` })
      seen.add(k)
    }
  })
  for (const v of variants) {
    const sku = v.sku.trim().toLowerCase()
    if (!sku) issues.push({ code: 'sku_required', variantId: v.id, message: 'Every variant needs a SKU.' })
    else if (skuSeen.has(sku)) issues.push({ code: 'sku_duplicate', variantId: v.id, message: `Duplicate SKU ${v.sku}.` })
    else if (taken.has(sku)) issues.push({ code: 'sku_conflict', variantId: v.id, message: `SKU ${v.sku} is already used by another product.` })
    skuSeen.add(sku)
    if (!Number.isInteger(v.stock) || v.stock < 0) issues.push({ code: 'stock_invalid', variantId: v.id, message: `${v.sku}: stock must be a whole number ≥ 0.` })
    if (v.price !== undefined && !(v.price > 0)) issues.push({ code: 'price_invalid', variantId: v.id, message: `${v.sku}: price must be greater than 0.` })
    // Retired combinations (their options were removed) are kept for history and only checked for SKU/stock/price above.
    if (isObsoleteVariant(options, v)) continue
    for (const key of Object.keys(v.options)) {
      const opt = options.find((o) => o.name === key)
      if (!opt) issues.push({ code: 'option_unknown', variantId: v.id, message: `Unknown option "${key}" on ${v.sku}.` })
      else if (!opt.values.includes(v.options[key]))
        issues.push({ code: 'value_unknown', variantId: v.id, message: `"${v.options[key]}" is not a value of ${key}.` })
    }
    for (const o of options) {
      if (!v.options[o.name]) issues.push({ code: 'option_missing', variantId: v.id, message: `${v.sku || 'Variant'} is missing ${o.name}.` })
    }
    const combo = options.map((o) => `${o.name}=${v.options[o.name] ?? ''}`).join('|')
    if (comboSeen.has(combo)) issues.push({ code: 'combination_duplicate', variantId: v.id, message: `Duplicate combination ${combo}.` })
    comboSeen.add(combo)
  }
  return issues
}

let counter = 0
export const newVariantId = () => `v${Date.now().toString(36)}${(counter++).toString(36)}`

/** Cartesian product of option values, used by the admin editor to generate missing combinations. */
export function combinations(options: ProductOption[]): Selection[] {
  return options.reduce<Selection[]>(
    (acc, o) => acc.flatMap((a) => o.values.map((val) => ({ ...a, [o.name]: val }))),
    [{}],
  )
}

const comboKey = (options: ProductOption[], sel: Selection) => options.map((o) => `${o.name}=${sel[o.name] ?? ''}`).join('|')

export interface ComboPreview {
  options: Selection
  label: string
  /** an existing variant (active or not) already covers this combination */
  existing?: ProductVariant
}

/** Every valid Cartesian combination of the current option groups, marked with the variant that already covers it. */
export function previewCombinations(options: ProductOption[], variants: ProductVariant[]): ComboPreview[] {
  const usable = options.filter((o) => o.name.trim() && o.values.length)
  if (!usable.length) return []
  const index = new Map(variants.map((v) => [comboKey(usable, v.options), v]))
  return combinations(usable).map((sel) => ({
    options: sel,
    label: usable.map((o) => sel[o.name]).join(' / '),
    existing: index.get(comboKey(usable, sel)),
  }))
}

/**
 * New variants for combinations nobody covers yet. Existing variants (price, stock, SKU, status) are never touched,
 * and generated SKUs never collide with an existing or reserved SKU.
 */
export function generateMissingVariants(
  options: ProductOption[],
  variants: ProductVariant[],
  baseSku: string,
  reservedSkus: Iterable<string> = [],
): ProductVariant[] {
  const taken = new Set([...variants.map((v) => v.sku), ...reservedSkus].map((x) => x.trim().toLowerCase()))
  const added: ProductVariant[] = []
  for (const combo of previewCombinations(options, variants)) {
    if (combo.existing) continue
    const suffix = Object.values(combo.options).join('-').replace(/\s+/g, '').toUpperCase()
    let sku = `${baseSku}-${suffix}`
    for (let n = 2; taken.has(sku.toLowerCase()); n++) sku = `${baseSku}-${suffix}-${n}`
    taken.add(sku.toLowerCase())
    added.push({ id: newVariantId(), sku, options: combo.options, stock: 0, active: true, visible: true, purchasable: true })
  }
  return added
}
