/*
 * RFQ line helpers. A saved cart line can reach the RFQ without a variant (for example a cart saved before the
 * product had options). Such a line is kept, with its product and quantity, and the customer must choose one of
 * the product's offered variants before continuing; it is never dropped silently.
 */
import type { RFQItem } from '../store'
import { hasVariants, variantCanBeQuoted, variantLabel, type ProductVariant, type VariantProductLike } from './variants'

type LineProduct = VariantProductLike & { id: number }

/** True when the line's product has variants but the line has none selected yet. */
export function lineNeedsVariant(item: Pick<RFQItem, 'id' | 'variantId'>, products: LineProduct[]): boolean {
  if (item.variantId) return false
  const product = products.find((p) => p.id === item.id)
  return !!product && hasVariants(product)
}

/** Variants a customer can choose for a quotation: offered (active and visible), whatever the stock. */
export function quotableVariants(product: VariantProductLike): ProductVariant[] {
  return (product.variants ?? []).filter(variantCanBeQuoted)
}

/**
 * Gives the variant-less line for product `id` the chosen variant, keeping its quantity and position.
 * If the RFQ already has a line for that variant, the quantities are added to it instead.
 */
export function applyRfqVariant(items: RFQItem[], id: number, product: VariantProductLike, variant: ProductVariant, qty: number): RFQItem[] {
  const index = items.findIndex((r) => r.id === id && !r.variantId)
  if (index === -1) return items
  const line = items[index]!
  const chosen = { variantId: variant.id, variantLabel: variantLabel(product, variant), sku: variant.sku }
  const existing = items.findIndex((r) => r.id === id && r.variantId === variant.id)
  if (existing !== -1) {
    return items
      .map((r, i) => (i === existing ? { ...r, qty: r.qty + qty } : r))
      .filter((_, i) => i !== index)
  }
  return items.map((r, i) => (i === index ? { ...line, ...chosen, qty } : r))
}
