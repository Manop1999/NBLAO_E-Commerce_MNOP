export interface Currency {
  code: string
  name: string
  nameLo: string
  symbol: string
  decimals: number
  enabled: boolean
}

export const DEFAULT_CURRENCIES: Currency[] = [
  { code: "USD", name: "US Dollar", nameLo: "ໂດລາສະຫະລັດ", symbol: "$", decimals: 2, enabled: true },
  { code: "THB", name: "Thai Baht", nameLo: "ເງິນບາດໄທ", symbol: "฿", decimals: 2, enabled: false },
  { code: "LAK", name: "Lao Kip", nameLo: "ເງິນກີບລາວ", symbol: "₭", decimals: 0, enabled: false },
]

const big10 = (n: number) => BigInt(10) ** BigInt(n)
const ZERO = BigInt(0)
const TWO = BigInt(2)

/** round-half-up of a*b/c using exact integer arithmetic (non-negative inputs). */
export function mulDivRound(a: number, b: number, c: number): number {
  if (c <= 0) throw new Error("mulDivRound: divisor must be positive")
  const num = BigInt(a) * BigInt(b)
  const den = BigInt(c)
  return Number((num * TWO + den) / (den * TWO))
}

/** Strict decimal parser: "1234.5" -> minor units. Returns null when invalid or over-precise. */
export function parseDecimalToMinor(input: string | number, decimals: number): number | null {
  const text = String(input).trim().replace(/,/g, "")
  const match = /^(\d{1,12})(?:\.(\d+))?$/.exec(text)
  if (!match) return null
  const fraction = match[2] ?? ""
  if (fraction.length > decimals) return null
  const minor = BigInt(match[1] + fraction.padEnd(decimals, "0"))
  if (minor > BigInt(Number.MAX_SAFE_INTEGER)) return null
  return Number(minor)
}

export const RATE_SCALE = 1_000_000

/** Exchange rates are stored as decimal strings with <= 6 decimals and converted to micro-units. */
export function parseRateMicro(input: string): number | null {
  const match = /^(\d{1,9})(?:\.(\d{1,6}))?$/.exec(String(input).trim())
  if (!match) return null
  const micro = Number(match[1]) * RATE_SCALE + Number((match[2] ?? "").padEnd(6, "0"))
  return micro > 0 ? micro : null
}

/**
 * Convert base-currency minor units to target-currency minor units.
 * rate = how many target-currency major units equal ONE base-currency major unit.
 */
export function convertMinor(
  baseMinor: number,
  baseDecimals: number,
  targetDecimals: number,
  rateMicro: number,
): number {
  const num = BigInt(baseMinor) * BigInt(rateMicro) * big10(targetDecimals)
  const den = big10(baseDecimals) * BigInt(RATE_SCALE)
  return Number((num * TWO + den) / (den * TWO))
}

/** minor units of one currency -> another using the exact ratio num/den (target units per source unit). */
export function convertRatioMinor(minor: number, fromDecimals: number, toDecimals: number, num: number, den: number): number {
  const n = BigInt(minor) * BigInt(num) * big10(toDecimals)
  const d = BigInt(den) * big10(fromDecimals)
  return Number((n * TWO + d) / (d * TWO))
}

export function toMinor(amount: number, decimals: number): number {
  return Math.round(amount * 10 ** decimals)
}

export function minorToDecimalString(minor: number, decimals: number): string {
  const negative = minor < 0
  const digits = BigInt(Math.abs(minor)).toString().padStart(decimals + 1, "0")
  const whole = digits.slice(0, digits.length - decimals)
  const fraction = decimals ? digits.slice(-decimals) : ""
  return `${negative ? "-" : ""}${whole}${fraction ? `.${fraction}` : ""}`
}

export function formatMinor(
  minor: number,
  currency: Pick<Currency, "code" | "symbol" | "decimals">,
  options: { code?: boolean; trimWhole?: boolean } = {},
): string {
  const negative = minor < 0
  const abs = Math.abs(minor)
  const factor = 10 ** currency.decimals
  const whole = Math.floor(abs / factor)
  const fractionValue = abs % factor
  const groupedWhole = String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, ",")
  const showFraction = currency.decimals > 0 && !(options.trimWhole && fractionValue === 0)
  const fraction = showFraction ? `.${String(fractionValue).padStart(currency.decimals, "0")}` : ""
  const text = `${negative ? "-" : ""}${currency.symbol}${groupedWhole}${fraction}`
  return options.code === false ? text : `${text} ${currency.code}`
}
