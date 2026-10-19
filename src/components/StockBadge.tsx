import { getStockStatus, STOCK_STATUS_STYLE } from '../lib/stockStatus'

interface StockBadgeProps {
  stock?: number | null
  /** @deprecated status is derived from real stock; kept so existing callers compile */
  stockLabel?: string
  active?: boolean
  size?: 'sm' | 'md'
}

export function StockBadge({ stock, active = true, size = 'sm' }: StockBadgeProps) {
  const key = getStockStatus({ stock, active })
  const s = STOCK_STATUS_STYLE[key]
  const px = size === 'md' ? 'px-3 py-1' : 'px-2 py-0.5'
  const fs = size === 'md' ? 'text-[12px]' : 'text-[11px]'
  return (
    <span
      data-stock-status={key}
      className={`font-ui ${fs} font-600 ${px} inline-block rounded-sm whitespace-nowrap`}
      style={{ background: s.bg, color: s.color }}
    >
      {s.label}
    </span>
  )
}
