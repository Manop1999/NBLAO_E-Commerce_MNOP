import { useCommerce } from "./CommerceProvider"
import { useCT, fill } from "./text"
import { CommerceError } from "./engine"
import { Product } from "../data"
import { hasVariants, visibleVariants } from "../lib/variants"

/** Human-readable message for any thrown error from the commerce layer. */
export function useExplain() {
  const ct = useCT()
  return (e: unknown): string => {
    if (e instanceof CommerceError) return ct.errors[e.code] ?? e.code
    return ct.errors.storage_failed
  }
}

export function useIssueText() {
  const ct = useCT()
  const { currency } = useCommerce()
  return (code: string, params: Record<string, string | number> = {}) => {
    const tpl = (ct.issues as Record<string, string>)[code]
    return tpl ? fill(tpl, { code: currency.code, ...params }) : code
  }
}

export function ProductPrice({
  product,
  className = "",
  size = "md",
  note = false,
  variantId,
}: {
  product: Product
  className?: string
  size?: "sm" | "md" | "lg"
  note?: boolean
  variantId?: string
}) {
  const { priceFor, fmt, currency } = useCommerce()
  const ct = useCT()
  const price = priceFor(product, undefined, variantId)
  // Variant products without a chosen variant show the lowest purchasable-variant price as "From".
  const fromMinor = (() => {
    if (variantId || !hasVariants(product)) return undefined
    const prices = visibleVariants(product)
      .map((v) => priceFor(product, undefined, v.id))
      .filter((r): r is Extract<typeof r, { ok: true }> => r.ok)
      .map((r) => r.unitMinor)
    if (!prices.length) return undefined
    const lo = Math.min(...prices)
    return lo !== Math.max(...prices) ? lo : undefined
  })()
  const text = size === "lg" ? "text-3xl" : size === "sm" ? "text-sm" : "text-lg"
  if (!price.ok) {
    return (
      <div className={className}>
        <span className={`font-semibold text-[#52677D] ${size === "lg" ? "text-xl" : "text-sm"}`}>
          {ct.price_unavailable}
        </span>
        {note && <p className="text-xs text-[#52677D] mt-1">{fill(ct.price_unavailable_in, { code: currency.code })}</p>}
      </div>
    )
  }
  return (
    <div className={className}>
      <div className="flex items-baseline gap-2 flex-wrap">
        {fromMinor !== undefined && <span className="text-xs text-[#52677D]">{ct.from_price}</span>}
        <span className={`font-bold text-[#082E61] ${text}`}>{fmt(fromMinor ?? price.unitMinor, price.currency)}</span>
        {price.promoApplied && (
          <span className="text-xs text-[#52677D] line-through">{fmt(price.listMinor, price.currency)}</span>
        )}
      </div>
      {note && price.method === "converted" && (
        <p className="text-xs text-[#52677D] mt-1">
          {fill(ct.converted_note, { rate: price.fxRate ?? "", code: price.currency })}
        </p>
      )}
    </div>
  )
}

export function CurrencySelector({ variant = "header" }: { variant?: "header" | "drawer" }) {
  const { currencies, currency, setCurrency } = useCommerce()
  const ct = useCT()
  if (currencies.length < 2) return null
  if (variant === "drawer") {
    return (
      <div role="group" aria-label={ct.select_currency} className="flex gap-2">
        {currencies.map((c) => (
          <button
            key={c.code}
            type="button"
            onClick={() => setCurrency(c.code)}
            aria-pressed={c.code === currency.code}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold border ${
              c.code === currency.code
                ? "bg-[#0099FF] text-white border-[#0099FF]"
                : "bg-white text-[#082E61] border-[#D9E2EC]"
            }`}
          >
            {c.symbol} {c.code}
          </button>
        ))}
      </div>
    )
  }
  return (
    <label className="inline-flex items-center">
      <span className="sr-only">{ct.select_currency}</span>
      <select
        value={currency.code}
        onChange={(e) => setCurrency(e.target.value)}
        className="h-8 rounded-md border border-[#D9E2EC] bg-white px-2 text-xs font-semibold text-[#082E61] focus:outline-none focus:ring-2 focus:ring-[#0099FF]"
      >
        {currencies.map((c) => (
          <option key={c.code} value={c.code}>
            {c.symbol} {c.code}
          </option>
        ))}
      </select>
    </label>
  )
}
