export type StockStatusKey = 'in' | 'low' | 'out' | 'unavailable' | 'unknown'

export const LOW_STOCK_THRESHOLD = 5

export const STOCK_STATUS_STYLE: Record<StockStatusKey, { color: string; bg: string; label: string }> = {
  in: { color: '#166534', bg: '#DCFCE7', label: 'In Stock' },
  low: { color: '#92400E', bg: '#FEF3C7', label: 'Low Stock' },
  out: { color: '#991B1B', bg: '#FEE2E2', label: 'Out of Stock' },
  unavailable: { color: '#475569', bg: '#E2E8F0', label: 'Unavailable' },
  unknown: { color: '#475569', bg: '#F1F5F9', label: 'Check Availability' },
}

export interface StockInput {
  stock?: number | null
  active?: boolean
  threshold?: number
}

export function getStockStatus({ stock, active = true, threshold = LOW_STOCK_THRESHOLD }: StockInput): StockStatusKey {
  if (!active) return 'unavailable'
  if (typeof stock !== 'number' || !Number.isFinite(stock)) return 'unknown'
  if (stock <= 0) return 'out'
  if (stock <= threshold) return 'low'
  return 'in'
}

export function isPurchasable(input: StockInput): boolean {
  const s = getStockStatus(input)
  return s === 'in' || s === 'low'
}
