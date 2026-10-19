import type { Product } from '../data'
import { aggregateStock, hasVariants } from './variants'
import { getStockStatus, STOCK_STATUS_STYLE } from './stockStatus'

/** Keep derived product fields consistent: variant products expose aggregate stock; label follows real stock. */
export function normalizeProduct(p: Product): Product {
  const variantProduct = hasVariants(p)
  const stock = variantProduct ? aggregateStock(p) : p.stock
  const next: Product = { ...p, stock }
  if (!variantProduct && (p.options || p.variants) && !(p.variants?.length)) {
    delete next.options
    delete next.variants
  }
  next.stockLabel = STOCK_STATUS_STYLE[getStockStatus({ stock, active: p.active !== false })].label
  return next
}
