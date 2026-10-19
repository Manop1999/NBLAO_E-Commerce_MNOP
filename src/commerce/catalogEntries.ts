import type { Product } from "../data"
import type { CatalogProduct } from "./engine"
import { hasVariants, variantLabel, variantPrice } from "../lib/variants"

/**
 * Catalog rows the commerce engine prices/validates against.
 * Products without variants produce one row (unchanged behaviour). Variant products produce a
 * base row that cannot be ordered directly plus one row per variant (all variants, so inactive
 * ones are reported as unavailable instead of "missing").
 */
export function catalogEntries(p: Product): CatalogProduct[] {
  return withCurrency(baseEntries(p), p.priceCurrency)
}

const withCurrency = (rows: CatalogProduct[], priceCurrency?: string) =>
  priceCurrency ? rows.map((r) => ({ ...r, priceCurrency })) : rows

function baseEntries(p: Product): CatalogProduct[] {
  if (p.active === false)
    return [{ id: p.id, name: p.name, sku: p.sku, price: p.price, stock: 0, purchasable: false }]
  if (!hasVariants(p)) return [{ id: p.id, name: p.name, sku: p.sku, price: p.price, stock: p.stock }]
  const rows: CatalogProduct[] = [
    { id: p.id, name: p.name, sku: p.sku, price: p.price, stock: p.stock, requiresVariant: true },
  ]
  for (const v of p.variants ?? []) {
    rows.push({
      id: p.id,
      name: p.name,
      sku: v.sku,
      price: variantPrice(p, v),
      stock: Math.max(0, v.stock),
      variantId: v.id,
      variantLabel: variantLabel(p, v),
      purchasable: v.active && v.visible && v.purchasable,
      promoEligible: !(typeof v.price === "number" && v.price > 0 && v.price !== p.price),
    })
  }
  return rows
}

export const buildCatalogProducts = (products: Product[]): CatalogProduct[] => products.flatMap(catalogEntries)
