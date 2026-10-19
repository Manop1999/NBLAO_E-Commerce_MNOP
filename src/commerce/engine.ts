import {
  convertMinor,
  convertRatioMinor,
  Currency,
  DEFAULT_CURRENCIES,
  mulDivRound,
  parseRateMicro,
  RATE_SCALE,
  toMinor,
} from "./money"

// ─── Types ────────────────────────────────────────────────────────────────────
export const ORDER_STATUSES = [
  "Pending",
  "Confirmed",
  "Processing",
  "Shipped",
  "Delivered",
  "Cancelled",
  "Refunded",
] as const
export type OrderStatus = (typeof ORDER_STATUSES)[number]

export const STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  Pending: ["Confirmed", "Cancelled"],
  Confirmed: ["Processing", "Cancelled"],
  Processing: ["Shipped", "Cancelled"],
  Shipped: ["Delivered"],
  Delivered: ["Refunded"],
  Cancelled: [],
  Refunded: [],
}

export type PaymentStatus = "unpaid" | "paid" | "refunded"
export const PAYMENT_METHODS = ["bank-transfer", "company-account", "cash"] as const
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]

export const SHIPPING_COUNTRIES = [
  { code: "LA", name: "Laos PDR", nameLo: "ສປປ ລາວ" },
  { code: "TH", name: "Thailand", nameLo: "ໄທ" },
  { code: "VN", name: "Vietnam", nameLo: "ຫວຽດນາມ" },
  { code: "KH", name: "Cambodia", nameLo: "ກຳປູເຈຍ" },
  { code: "MM", name: "Myanmar", nameLo: "ມຽນມາ" },
] as const

export interface Actor {
  id: string
  role: "customer" | "admin"
}

export interface Settings {
  baseCurrency: string
  conversionEnabled: boolean
}

export interface FxRate {
  id: string
  base: string
  target: string
  /** decimal string: target-currency units per ONE base-currency unit */
  rate: string
  effectiveFrom: string
  expiresAt?: string
  status: "active" | "inactive"
  createdAt: string
  createdBy: string
}

export interface ProductPrice {
  id: string
  productId: number
  variantId?: string | null
  currency: string
  amountMinor: number
  status: "active" | "inactive"
  validFrom?: string
  validTo?: string
  createdAt: string
  updatedAt: string
}

export interface ShippingRate {
  id: string
  countryCode: string
  currency: string
  amountMinor: number
  active: boolean
  createdAt: string
}

export interface CustomerAddress {
  id: string
  customerId: string
  label: string
  recipientName: string
  phone: string
  company: string
  countryCode: string
  province: string
  district: string
  village: string
  postalCode: string
  addressLine: string
  instructions: string
  isDefault: boolean
  createdAt: string
  updatedAt: string
}
export type AddressInput = Omit<
  CustomerAddress,
  "id" | "customerId" | "createdAt" | "updatedAt" | "isDefault"
> & { isDefault?: boolean }

export interface AddressSnapshot {
  sourceAddressId?: string
  label: string
  recipientName: string
  phone: string
  company: string
  countryCode: string
  province: string
  district: string
  village: string
  postalCode: string
  addressLine: string
  instructions: string
}

export interface LoyaltyRule {
  currency: string
  enabled: boolean
  /** every `spendThresholdMinor` of eligible spend earns `pointsPerThreshold` points */
  spendThresholdMinor: number
  pointsPerThreshold: number
  minOrderMinor: number
  eligibleStatuses: OrderStatus[]
  /** value of one point when redeemed, in minor units of `currency` */
  pointValueMinor: number
  minRedeemPoints: number
  /** max share of the order subtotal payable with points (0-100) */
  maxRedeemPercent: number
  /** hard cap per order; 0 = no cap */
  maxPointsPerOrder: number
  effectiveFrom: string
  updatedAt: string
  updatedBy: string
}

export type LedgerType =
  | "earn"
  | "redeem"
  | "reverse_earn"
  | "restore_redeem"
  | "adjustment"

export interface LedgerEntry {
  id: string
  customerId: string
  type: LedgerType
  /** signed: positive adds to balance, negative subtracts */
  points: number
  orderId?: string
  idempotencyKey: string
  details: Record<string, string | number>
  createdAt: string
  createdBy: string
}

export interface OrderLine {
  productId: number
  variantId?: string
  variantLabel?: string
  sku: string
  name: string
  qty: number
  unitPriceMinor: number
  listUnitPriceMinor: number
  lineTotalMinor: number
  method: "base" | "manual" | "converted"
  baseUnitPriceMinor: number
  promoApplied: boolean
  fxRate?: string
  fxRateId?: string
  manualPriceId?: string
}

export interface Order {
  id: string
  customerId: string
  contact: { name: string; email: string; phone: string; company: string }
  currency: string
  currencyDecimals: number
  currencySymbol: string
  lines: OrderLine[]
  subtotalMinor: number
  loyaltyRedeemedPoints: number
  loyaltyDiscountMinor: number
  taxMinor: number
  shippingMinor: number
  shippingStatus: "calculated" | "to_be_confirmed"
  totalMinor: number
  status: OrderStatus
  paymentStatus: PaymentStatus
  paymentMethod: PaymentMethod
  address: AddressSnapshot
  notes: string
  loyaltyRule: LoyaltyRule | null
  idempotencyKey: string
  statusHistory: { status: OrderStatus; at: string; by: string }[]
  createdAt: string
  updatedAt: string
}

export interface AuditEntry {
  id: string
  at: string
  actorId: string
  actorRole: string
  action: string
  entity: string
  entityId: string
  summary: string
}

export interface Db {
  version: 1
  settings: Settings
  currencies: Currency[]
  fxRates: FxRate[]
  productPrices: ProductPrice[]
  shippingRates: ShippingRate[]
  addresses: CustomerAddress[]
  orders: Order[]
  loyaltyRules: LoyaltyRule[]
  ledger: LedgerEntry[]
  audit: AuditEntry[]
  counters: { order: number; seq: number }
}

export interface CatalogProduct {
  id: number
  name: string
  sku: string
  price: number
  stock: number
  /** Set on entries that describe one purchasable variant of product `id` */
  variantId?: string
  variantLabel?: string
  /** Variant entry is active, visible and flagged purchasable (defaults to true) */
  purchasable?: boolean
  /** Base entry of a product that has variants: lines must pick a variant */
  requiresVariant?: boolean
  /** false when the variant carries its own price, so product-level promotions do not apply */
  promoEligible?: boolean
  /** Currency `price` is written in. Missing = LEGACY_PRICE_CURRENCY (all pre-existing prices were USD). */
  priceCurrency?: string
}

/** Evidence-based default for records created before products had a currency: the admin form said "Price (USD)". */
export const LEGACY_PRICE_CURRENCY = "USD"


export const catalogKey = (productId: number, variantId?: string | null) =>
  variantId ? `${productId}:${variantId}` : String(productId)

export function findCatalogEntry(catalog: Catalog, productId: number, variantId?: string | null) {
  return catalog.products.find((p) => p.id === productId && (p.variantId ?? null) === (variantId ?? null))
}
export interface CatalogPlacement {
  productId: number
  type: "promotion" | "recommended"
  active: boolean
  displayOrder: number
  promotionalPrice?: number
  startDate?: string
  endDate?: string
}
export interface Catalog {
  products: CatalogProduct[]
  placements: CatalogPlacement[]
}

export class CommerceError extends Error {
  code: string
  params?: Record<string, unknown>
  constructor(code: string, params?: Record<string, unknown>) {
    super(code)
    this.code = code
    this.params = params
  }
}

// ─── Defaults & helpers ───────────────────────────────────────────────────────
export function defaultLoyaltyRule(currency: string, now: Date): LoyaltyRule {
  return {
    currency,
    enabled: false,
    spendThresholdMinor: 0,
    pointsPerThreshold: 0,
    minOrderMinor: 0,
    eligibleStatuses: ["Delivered"],
    pointValueMinor: 0,
    minRedeemPoints: 0,
    maxRedeemPercent: 0,
    maxPointsPerOrder: 0,
    effectiveFrom: today(now),
    updatedAt: now.toISOString(),
    updatedBy: "system",
  }
}

export function createEmptyDb(now: Date = new Date()): Db {
  return {
    version: 1,
    settings: { baseCurrency: "USD", conversionEnabled: true },
    currencies: DEFAULT_CURRENCIES.map((c) => ({ ...c })),
    fxRates: [],
    productPrices: [],
    shippingRates: [],
    addresses: [],
    orders: [],
    loyaltyRules: DEFAULT_CURRENCIES.map((c) => defaultLoyaltyRule(c.code, now)),
    ledger: [],
    audit: [],
    counters: { order: 1000, seq: 0 },
  }
}

export function today(now: Date): string {
  return now.toISOString().slice(0, 10)
}

function nextId(db: Db, prefix: string): string {
  db.counters.seq += 1
  return `${prefix}-${Date.now().toString(36)}${db.counters.seq.toString(36)}`
}

function audit(
  db: Db,
  actor: Actor,
  now: Date,
  action: string,
  entity: string,
  entityId: string,
  summary: string,
) {
  db.audit.unshift({
    id: nextId(db, "aud"),
    at: now.toISOString(),
    actorId: actor.id,
    actorRole: actor.role,
    action,
    entity,
    entityId,
    summary,
  })
  if (db.audit.length > 500) db.audit.length = 500
}

export function requireAdmin(actor: Actor | null | undefined): asserts actor is Actor {
  if (!actor || actor.role !== "admin") throw new CommerceError("forbidden")
}
export function requireCustomer(actor: Actor | null | undefined): asserts actor is Actor {
  if (!actor || actor.role !== "customer") throw new CommerceError("auth_required")
}

export const getCurrency = (db: Db, code: string) =>
  db.currencies.find((c) => c.code === code)

export const enabledCurrencies = (db: Db) => db.currencies.filter((c) => c.enabled)

// ─── Pricing ──────────────────────────────────────────────────────────────────
export type PriceFailure =
  | "currency_unknown"
  | "currency_disabled"
  | "no_price"
  | "rate_expired"
  | "rate_invalid"
  | "product_missing"

export type PriceResult =
  | {
      ok: true
      currency: string
      method: "base" | "manual" | "converted"
      listMinor: number
      unitMinor: number
      baseListMinor: number
      promoApplied: boolean
      fxRate?: string
      fxRateId?: string
      manualPriceId?: string
    }
  | { ok: false; currency: string; reason: PriceFailure }

export function activePromotionPrice(
  placements: CatalogPlacement[],
  product: CatalogProduct,
  now: Date,
): number | undefined {
  if (product.promoEligible === false) return undefined
  const day = today(now)
  const match = [...placements]
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .find(
      (p) =>
        p.productId === product.id &&
        p.type === "promotion" &&
        p.active &&
        (!p.startDate || p.startDate <= day) &&
        (!p.endDate || p.endDate >= day) &&
        p.promotionalPrice !== undefined &&
        p.promotionalPrice > 0 &&
        p.promotionalPrice < product.price,
    )
  return match?.promotionalPrice
}

type RateLookup = { ok: true; micro: number; id: string; rate: string } | { ok: false; reason: PriceFailure }

/** Current valid base→`code` rate, with the same failure reasons the base-priced path reports. */
function currentBaseRate(db: Db, baseCode: string, code: string, day: string): RateLookup {
  const candidates = db.fxRates.filter((r) => r.base === baseCode && r.target === code && r.status === "active")
  if (!candidates.length) return { ok: false, reason: "no_price" }
  const current = candidates
    .filter((r) => r.effectiveFrom <= day && (!r.expiresAt || r.expiresAt >= day))
    .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))
  if (!current.length) return { ok: false, reason: "rate_expired" }
  const chosen = current.find((r) => parseRateMicro(r.rate) !== null)
  if (!chosen) return { ok: false, reason: "rate_invalid" }
  return { ok: true, micro: parseRateMicro(chosen.rate) as number, id: chosen.id, rate: chosen.rate }
}

/**
 * Product whose list price is written in a currency other than the base currency. Rates are stored
 * base→X only, so X→base uses the inverse and X→Y goes through the base. Nothing is invented:
 * without a manual price, or the needed valid rate(s) with conversion on, the price is unavailable.
 */
function resolveForeignSourcePrice(
  db: Db,
  product: CatalogProduct,
  placements: CatalogPlacement[],
  target: Currency,
  base: Currency,
  sourceCode: string,
  now: Date,
): PriceResult {
  const fail = (reason: PriceFailure): PriceResult => ({ ok: false, currency: target.code, reason })
  const source = getCurrency(db, sourceCode)
  if (!source) return fail("currency_unknown")
  if (!(product.price > 0)) return fail("no_price")
  const day = today(now)
  const sourceListMinor = toMinor(product.price, source.decimals)
  const promo = activePromotionPrice(placements, product, now)
  const sourcePromoMinor = promo !== undefined ? toMinor(promo, source.decimals) : undefined

  const sourceRate = currentBaseRate(db, base.code, sourceCode, day)
  const baseListMinor = sourceRate.ok
    ? convertRatioMinor(sourceListMinor, source.decimals, base.decimals, RATE_SCALE, sourceRate.micro)
    : 0

  const manual = db.productPrices
    .filter(
      (p) =>
        p.productId === product.id &&
        (p.variantId ?? null) === (product.variantId ?? null) &&
        p.currency === target.code &&
        p.status === "active" &&
        p.amountMinor > 0 &&
        (!p.validFrom || p.validFrom <= day) &&
        (!p.validTo || p.validTo >= day),
    )
    .sort((a, b) => (b.validFrom ?? "").localeCompare(a.validFrom ?? ""))[0]
  if (manual) {
    const unit = sourcePromoMinor !== undefined ? mulDivRound(manual.amountMinor, sourcePromoMinor, sourceListMinor) : manual.amountMinor
    return { ok: true, currency: target.code, method: "manual", listMinor: manual.amountMinor, unitMinor: Math.max(unit, 1), baseListMinor, promoApplied: sourcePromoMinor !== undefined, manualPriceId: manual.id }
  }

  // "base" here means the list price in the product's own currency (no conversion involved)
  if (target.code === sourceCode) {
    return { ok: true, currency: target.code, method: "base", listMinor: sourceListMinor, unitMinor: sourcePromoMinor ?? sourceListMinor, baseListMinor, promoApplied: sourcePromoMinor !== undefined }
  }
  if (!db.settings.conversionEnabled) return fail("no_price")
  if (!sourceRate.ok) return fail(sourceRate.reason)

  let num: number
  let den: number
  let rateText: string
  let rateId: string
  if (target.code === base.code) {
    num = RATE_SCALE
    den = sourceRate.micro
    rateText = (RATE_SCALE / sourceRate.micro).toFixed(6).replace(/0+$/, "").replace(/\.$/, "")
    rateId = sourceRate.id
  } else {
    const targetRate = currentBaseRate(db, base.code, target.code, day)
    if (!targetRate.ok) return fail(targetRate.reason)
    num = targetRate.micro
    den = sourceRate.micro
    rateText = (targetRate.micro / sourceRate.micro).toFixed(6).replace(/0+$/, "").replace(/\.$/, "")
    rateId = `${sourceRate.id}+${targetRate.id}`
  }
  const convert = (minor: number) => Math.max(convertRatioMinor(minor, source.decimals, target.decimals, num, den), 1)
  return {
    ok: true,
    currency: target.code,
    method: "converted",
    listMinor: convert(sourceListMinor),
    unitMinor: convert(sourcePromoMinor ?? sourceListMinor),
    baseListMinor,
    promoApplied: sourcePromoMinor !== undefined,
    fxRate: rateText,
    fxRateId: rateId,
  }
}

/**
 * Pricing priority (deterministic):
 *  1. active, in-window manual price for the selected currency
 *  2. base price (if selected currency is the base currency)
 *  3. base price × current valid exchange rate (when conversion is enabled)
 *  4. unavailable
 * Active sales promotions are authored in the product's price currency and are applied
 * proportionally to manual prices, or converted like the base price.
 */
export function resolvePrice(
  db: Db,
  product: CatalogProduct | undefined,
  placements: CatalogPlacement[],
  currencyCode: string,
  now: Date,
): PriceResult {
  const fail = (reason: PriceFailure): PriceResult => ({ ok: false, currency: currencyCode, reason })
  if (!product) return fail("product_missing")
  const currency = getCurrency(db, currencyCode)
  if (!currency) return fail("currency_unknown")
  if (!currency.enabled) return fail("currency_disabled")
  const base = getCurrency(db, db.settings.baseCurrency)
  if (!base) return fail("currency_unknown")
  const sourceCode = product.priceCurrency ?? LEGACY_PRICE_CURRENCY
  if (sourceCode !== base.code) return resolveForeignSourcePrice(db, product, placements, currency, base, sourceCode, now)
  if (!(product.price > 0)) return fail("no_price")

  const baseListMinor = toMinor(product.price, base.decimals)
  const promo = activePromotionPrice(placements, product, now)
  const basePromoMinor = promo !== undefined ? toMinor(promo, base.decimals) : undefined
  const day = today(now)

  const manual = db.productPrices
    .filter(
      (p) =>
        p.productId === product.id &&
        (p.variantId ?? null) === (product.variantId ?? null) &&
        p.currency === currencyCode &&
        p.status === "active" &&
        p.amountMinor > 0 &&
        (!p.validFrom || p.validFrom <= day) &&
        (!p.validTo || p.validTo >= day),
    )
    .sort((a, b) => (b.validFrom ?? "").localeCompare(a.validFrom ?? ""))[0]

  if (manual) {
    const unit =
      basePromoMinor !== undefined
        ? mulDivRound(manual.amountMinor, basePromoMinor, baseListMinor)
        : manual.amountMinor
    return {
      ok: true,
      currency: currencyCode,
      method: "manual",
      listMinor: manual.amountMinor,
      unitMinor: Math.max(unit, 1),
      baseListMinor,
      promoApplied: basePromoMinor !== undefined,
      manualPriceId: manual.id,
    }
  }

  if (currencyCode === base.code) {
    return {
      ok: true,
      currency: currencyCode,
      method: "base",
      listMinor: baseListMinor,
      unitMinor: basePromoMinor ?? baseListMinor,
      baseListMinor,
      promoApplied: basePromoMinor !== undefined,
    }
  }

  if (!db.settings.conversionEnabled) return fail("no_price")

  const candidates = db.fxRates.filter(
    (r) => r.base === base.code && r.target === currencyCode && r.status === "active",
  )
  if (!candidates.length) return fail("no_price")
  const current = candidates
    .filter((r) => r.effectiveFrom <= day && (!r.expiresAt || r.expiresAt >= day))
    .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))
  if (!current.length) return fail("rate_expired")
  const chosen = current.find((r) => parseRateMicro(r.rate) !== null)
  if (!chosen) return fail("rate_invalid")
  const micro = parseRateMicro(chosen.rate) as number
  const convert = (minor: number) =>
    Math.max(convertMinor(minor, base.decimals, currency.decimals, micro), 1)
  return {
    ok: true,
    currency: currencyCode,
    method: "converted",
    listMinor: convert(baseListMinor),
    unitMinor: convert(basePromoMinor ?? baseListMinor),
    baseListMinor,
    promoApplied: basePromoMinor !== undefined,
    fxRate: chosen.rate,
    fxRateId: chosen.id,
  }
}

// ─── Loyalty helpers ──────────────────────────────────────────────────────────
export const getRule = (db: Db, currency: string) =>
  db.loyaltyRules.find((r) => r.currency === currency) ?? null

export function loyaltyBalance(db: Db, customerId: string): number {
  return db.ledger
    .filter((e) => e.customerId === customerId)
    .reduce((sum, e) => sum + e.points, 0)
}

export function redemptionLimits(
  rule: LoyaltyRule | null,
  subtotalMinor: number,
  balance: number,
  now: Date,
) {
  const unavailable = { available: false, maxPoints: 0, minPoints: 0 }
  if (
    !rule ||
    !rule.enabled ||
    rule.pointValueMinor <= 0 ||
    rule.maxRedeemPercent <= 0 ||
    rule.effectiveFrom > today(now)
  )
    return unavailable
  const byPercent = Math.floor((subtotalMinor * rule.maxRedeemPercent) / (100 * rule.pointValueMinor))
  let maxPoints = Math.min(Math.max(balance, 0), byPercent)
  if (rule.maxPointsPerOrder > 0) maxPoints = Math.min(maxPoints, rule.maxPointsPerOrder)
  const minPoints = Math.max(rule.minRedeemPoints, 1)
  return { available: maxPoints >= minPoints, maxPoints, minPoints }
}

function appendLedger(
  db: Db,
  entry: Omit<LedgerEntry, "id" | "createdAt">,
  now: Date,
): LedgerEntry | null {
  if (db.ledger.some((e) => e.idempotencyKey === entry.idempotencyKey)) return null
  const full: LedgerEntry = { ...entry, id: nextId(db, "led"), createdAt: now.toISOString() }
  db.ledger.push(full)
  return full
}

// ─── Quote ────────────────────────────────────────────────────────────────────
export interface QuoteInput {
  currency: string
  lines: { productId: number; variantId?: string; qty: number }[]
  countryCode?: string
  redeemPoints?: number
  customerId?: string
}
export interface QuoteIssue {
  code: string
  productId?: number
  variantId?: string
}
export interface QuoteLine {
  productId: number
  variantId?: string
  variantLabel?: string
  name: string
  sku: string
  qty: number
  stock: number
  price: PriceResult
  unitMinor: number
  lineTotalMinor: number
}
export interface Quote {
  currency: string
  lines: QuoteLine[]
  subtotalMinor: number
  shipping: {
    status: "calculated" | "to_be_confirmed" | "ineligible" | "not_requested"
    amountMinor: number
  }
  loyalty: {
    rule: LoyaltyRule | null
    balance: number
    available: boolean
    minPoints: number
    maxPoints: number
    redeemPoints: number
    discountMinor: number
  }
  taxMinor: number
  totalMinor: number
  issues: QuoteIssue[]
  valid: boolean
}

export function quoteCart(db: Db, catalog: Catalog, input: QuoteInput, now: Date): Quote {
  const issues: QuoteIssue[] = []
  const currency = getCurrency(db, input.currency)
  if (!currency) issues.push({ code: "currency_unknown" })
  else if (!currency.enabled) issues.push({ code: "currency_disabled" })

  const merged = new Map<string, { productId: number; variantId?: string; qty: number }>()
  for (const line of input.lines) {
    if (!Number.isInteger(line.qty) || line.qty < 1) {
      issues.push({ code: "invalid_qty", productId: line.productId, variantId: line.variantId })
      continue
    }
    const key = catalogKey(line.productId, line.variantId)
    const prev = merged.get(key)
    merged.set(key, { productId: line.productId, variantId: line.variantId, qty: (prev?.qty ?? 0) + line.qty })
  }

  const lines: QuoteLine[] = []
  for (const { productId, variantId, qty } of merged.values()) {
    const product = findCatalogEntry(catalog, productId, variantId)
    if (!product) {
      const base = findCatalogEntry(catalog, productId)
      issues.push({ code: variantId && base ? "variant_missing" : "product_missing", productId, variantId })
      continue
    }
    if (product.requiresVariant) {
      issues.push({ code: "variant_required", productId })
      continue
    }
    if (product.purchasable === false) {
      issues.push({ code: "variant_unavailable", productId, variantId })
      continue
    }
    const price = resolvePrice(db, product, catalog.placements, input.currency, now)
    if (!price.ok) {
      if (price.reason !== "currency_disabled" && price.reason !== "currency_unknown")
        issues.push({ code: `price_${price.reason}`, productId, variantId })
    }
    if (qty > product.stock) issues.push({ code: "insufficient_stock", productId, variantId })
    const unitMinor = price.ok ? price.unitMinor : 0
    lines.push({
      productId,
      variantId,
      variantLabel: product.variantLabel,
      name: product.name,
      sku: product.sku,
      qty,
      stock: product.stock,
      price,
      unitMinor,
      lineTotalMinor: unitMinor * qty,
    })
  }
  if (!lines.length && !issues.length) issues.push({ code: "cart_empty" })

  const subtotalMinor = lines.reduce((sum, l) => sum + l.lineTotalMinor, 0)

  let shipping: Quote["shipping"] = { status: "not_requested", amountMinor: 0 }
  if (input.countryCode) {
    if (!SHIPPING_COUNTRIES.some((c) => c.code === input.countryCode)) {
      shipping = { status: "ineligible", amountMinor: 0 }
      issues.push({ code: "destination_ineligible" })
    } else {
      const rate = db.shippingRates.find(
        (r) => r.active && r.countryCode === input.countryCode && r.currency === input.currency,
      )
      shipping = rate
        ? { status: "calculated", amountMinor: rate.amountMinor }
        : { status: "to_be_confirmed", amountMinor: 0 }
    }
  }

  const rule = getRule(db, input.currency)
  const balance = input.customerId ? loyaltyBalance(db, input.customerId) : 0
  const limits = redemptionLimits(rule, subtotalMinor, balance, now)
  const requested = input.redeemPoints ?? 0
  let redeemPoints = 0
  let discountMinor = 0
  if (requested !== 0) {
    if (!Number.isInteger(requested) || requested < 0) issues.push({ code: "redeem_invalid" })
    else if (!limits.available) issues.push({ code: "redeem_unavailable" })
    else if (requested > balance) issues.push({ code: "redeem_over_balance" })
    else if (requested < limits.minPoints) issues.push({ code: "redeem_below_min" })
    else if (requested > limits.maxPoints) issues.push({ code: "redeem_over_limit" })
    else {
      redeemPoints = requested
      discountMinor = requested * (rule as LoyaltyRule).pointValueMinor
    }
  }

  const taxMinor = 0
  const totalMinor = Math.max(subtotalMinor - discountMinor, 0) + shipping.amountMinor + taxMinor
  return {
    currency: input.currency,
    lines,
    subtotalMinor,
    shipping,
    loyalty: {
      rule,
      balance,
      available: limits.available,
      minPoints: limits.minPoints,
      maxPoints: limits.maxPoints,
      redeemPoints,
      discountMinor,
    },
    taxMinor,
    totalMinor,
    issues,
    valid: issues.length === 0,
  }
}

// ─── Addresses ────────────────────────────────────────────────────────────────
export function validateAddressInput(input: AddressInput): Record<string, string> {
  const errors: Record<string, string> = {}
  const need = (key: keyof AddressInput) => {
    if (!String(input[key] ?? "").trim()) errors[key] = "required"
  }
  ;(["label", "recipientName", "phone", "province", "district", "addressLine"] as const).forEach(need)
  if (!SHIPPING_COUNTRIES.some((c) => c.code === input.countryCode)) errors.countryCode = "invalid_country"
  if (!errors.phone && !/^\+?[0-9][0-9\s-]{5,19}$/.test(input.phone.trim())) errors.phone = "invalid_phone"
  if (input.countryCode === "TH" && !/^\d{5}$/.test(input.postalCode.trim())) errors.postalCode = "invalid_postal"
  return errors
}

function cleanAddress(input: AddressInput): AddressInput {
  const t = (s: string) => String(s ?? "").trim()
  return {
    label: t(input.label),
    recipientName: t(input.recipientName),
    phone: t(input.phone),
    company: t(input.company),
    countryCode: t(input.countryCode),
    province: t(input.province),
    district: t(input.district),
    village: t(input.village),
    postalCode: t(input.postalCode),
    addressLine: t(input.addressLine),
    instructions: t(input.instructions),
    isDefault: input.isDefault,
  }
}

function ownedAddress(db: Db, actor: Actor, id: string): CustomerAddress {
  requireCustomer(actor)
  const found = db.addresses.find((a) => a.id === id && a.customerId === actor.id)
  if (!found) throw new CommerceError("address_not_found")
  return found
}

export function listAddresses(db: Db, actor: Actor): CustomerAddress[] {
  requireCustomer(actor)
  return db.addresses.filter((a) => a.customerId === actor.id)
}

export function createAddress(db: Db, actor: Actor, input: AddressInput, now: Date): CustomerAddress {
  requireCustomer(actor)
  const errors = validateAddressInput(input)
  if (Object.keys(errors).length) throw new CommerceError("address_invalid", { errors })
  const mine = db.addresses.filter((a) => a.customerId === actor.id)
  const makeDefault = !!input.isDefault || mine.length === 0
  if (makeDefault) mine.forEach((a) => (a.isDefault = false))
  const address: CustomerAddress = {
    ...cleanAddress(input),
    id: nextId(db, "addr"),
    customerId: actor.id,
    isDefault: makeDefault,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  }
  db.addresses.push(address)
  return address
}

export function updateAddress(
  db: Db,
  actor: Actor,
  id: string,
  input: AddressInput,
  now: Date,
): CustomerAddress {
  const existing = ownedAddress(db, actor, id)
  const errors = validateAddressInput(input)
  if (Object.keys(errors).length) throw new CommerceError("address_invalid", { errors })
  const cleaned = cleanAddress(input)
  if (input.isDefault) {
    db.addresses.filter((a) => a.customerId === actor.id).forEach((a) => (a.isDefault = false))
    existing.isDefault = true
  }
  Object.assign(existing, { ...cleaned, isDefault: existing.isDefault, updatedAt: now.toISOString() })
  return existing
}

/** If the default is deleted, the earliest-created remaining address becomes the default. */
export function deleteAddress(db: Db, actor: Actor, id: string) {
  const existing = ownedAddress(db, actor, id)
  db.addresses = db.addresses.filter((a) => a.id !== existing.id)
  if (existing.isDefault) {
    const next = db.addresses
      .filter((a) => a.customerId === actor.id)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0]
    if (next) next.isDefault = true
  }
}

export function setDefaultAddress(db: Db, actor: Actor, id: string) {
  const target = ownedAddress(db, actor, id)
  db.addresses.filter((a) => a.customerId === actor.id).forEach((a) => (a.isDefault = a.id === target.id))
}

function snapshotAddress(a: AddressInput, sourceAddressId?: string): AddressSnapshot {
  const c = cleanAddress(a)
  return {
    sourceAddressId,
    label: c.label,
    recipientName: c.recipientName,
    phone: c.phone,
    company: c.company,
    countryCode: c.countryCode,
    province: c.province,
    district: c.district,
    village: c.village,
    postalCode: c.postalCode,
    addressLine: c.addressLine,
    instructions: c.instructions,
  }
}

// ─── Orders ───────────────────────────────────────────────────────────────────
export interface PlaceOrderInput {
  idempotencyKey: string
  currency: string
  lines: { productId: number; variantId?: string; qty: number }[]
  addressId?: string
  newAddress?: AddressInput
  saveNewAddress?: boolean
  redeemPoints?: number
  paymentMethod: string
  notes?: string
  contact: { name: string; email: string; phone: string; company: string }
}
export interface StockDelta {
  productId: number
  variantId?: string
  delta: number
}
export interface PlaceOrderResult {
  order: Order
  duplicate: boolean
  stockDeltas: StockDelta[]
}

export function placeOrder(
  db: Db,
  actor: Actor,
  catalog: Catalog,
  input: PlaceOrderInput,
  now: Date,
): PlaceOrderResult {
  requireCustomer(actor)
  if (!input.idempotencyKey) throw new CommerceError("idempotency_required")
  const prior = db.orders.find(
    (o) => o.idempotencyKey === input.idempotencyKey && o.customerId === actor.id,
  )
  if (prior) return { order: prior, duplicate: true, stockDeltas: [] }

  if (!PAYMENT_METHODS.includes(input.paymentMethod as PaymentMethod))
    throw new CommerceError("payment_method_invalid")
  const text = (v: unknown) => String(v ?? "").trim()
  const contact = {
    name: text(input.contact?.name),
    email: text(input.contact?.email),
    phone: text(input.contact?.phone),
    company: text(input.contact?.company),
  }
  if (!contact.name || !/^\S+@\S+\.\S+$/.test(contact.email) || !contact.phone)
    throw new CommerceError("contact_invalid")

  let snapshot: AddressSnapshot
  let savedId: string | undefined
  if (input.addressId) {
    const saved = ownedAddress(db, actor, input.addressId)
    snapshot = snapshotAddress(saved, saved.id)
    savedId = saved.id
  } else if (input.newAddress) {
    const errors = validateAddressInput(input.newAddress)
    if (Object.keys(errors).length) throw new CommerceError("address_invalid", { errors })
    snapshot = snapshotAddress(input.newAddress)
  } else {
    throw new CommerceError("address_required")
  }

  const quote = quoteCart(
    db,
    catalog,
    {
      currency: input.currency,
      lines: input.lines,
      countryCode: snapshot.countryCode,
      redeemPoints: input.redeemPoints,
      customerId: actor.id,
    },
    now,
  )
  if (!quote.valid) throw new CommerceError("quote_invalid", { issues: quote.issues })

  if (!savedId && input.newAddress && input.saveNewAddress) {
    savedId = createAddress(db, actor, input.newAddress, now).id
    snapshot.sourceAddressId = savedId
  }

  const currency = getCurrency(db, input.currency) as Currency
  db.counters.order += 1
  const orderId = `NB-${now.getUTCFullYear()}-${String(db.counters.order).padStart(4, "0")}`
  const rule = getRule(db, input.currency)

  const order: Order = {
    id: orderId,
    customerId: actor.id,
    contact,
    currency: currency.code,
    currencyDecimals: currency.decimals,
    currencySymbol: currency.symbol,
    lines: quote.lines.map((l) => {
      const p = l.price as Extract<PriceResult, { ok: true }>
      return {
        productId: l.productId,
        ...(l.variantId ? { variantId: l.variantId, variantLabel: l.variantLabel } : {}),
        sku: l.sku,
        name: l.name,
        qty: l.qty,
        unitPriceMinor: l.unitMinor,
        listUnitPriceMinor: p.listMinor,
        lineTotalMinor: l.lineTotalMinor,
        method: p.method,
        baseUnitPriceMinor: p.baseListMinor,
        promoApplied: p.promoApplied,
        fxRate: p.fxRate,
        fxRateId: p.fxRateId,
        manualPriceId: p.manualPriceId,
      }
    }),
    subtotalMinor: quote.subtotalMinor,
    loyaltyRedeemedPoints: quote.loyalty.redeemPoints,
    loyaltyDiscountMinor: quote.loyalty.discountMinor,
    taxMinor: quote.taxMinor,
    shippingMinor: quote.shipping.amountMinor,
    shippingStatus: quote.shipping.status === "calculated" ? "calculated" : "to_be_confirmed",
    totalMinor: quote.totalMinor,
    status: "Pending",
    paymentStatus: "unpaid",
    paymentMethod: input.paymentMethod as PaymentMethod,
    address: snapshot,
    notes: (input.notes ?? "").trim(),
    loyaltyRule: rule ? structuredClone(rule) : null,
    idempotencyKey: input.idempotencyKey,
    statusHistory: [{ status: "Pending", at: now.toISOString(), by: actor.id }],
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  }
  db.orders.unshift(order)

  if (order.loyaltyRedeemedPoints > 0) {
    appendLedger(
      db,
      {
        customerId: actor.id,
        type: "redeem",
        points: -order.loyaltyRedeemedPoints,
        orderId,
        idempotencyKey: `redeem:${orderId}`,
        details: {
          currency: currency.code,
          pointValueMinor: rule?.pointValueMinor ?? 0,
          discountMinor: order.loyaltyDiscountMinor,
        },
        createdBy: actor.id,
      },
      now,
    )
  }
  audit(db, actor, now, "order.create", "order", orderId, `Order placed in ${currency.code}`)
  return {
    order,
    duplicate: false,
    stockDeltas: order.lines.map((l) => ({ productId: l.productId, variantId: l.variantId, delta: -l.qty })),
  }
}

export function eligibleSpendMinor(order: Order): number {
  return Math.max(order.subtotalMinor - order.loyaltyDiscountMinor, 0)
}

function settleLoyalty(db: Db, order: Order, actor: Actor, now: Date) {
  const rule = order.loyaltyRule
  const key = (t: string) => `${t}:${order.id}`
  const earned = db.ledger.some((e) => e.idempotencyKey === key("earn"))

  if (order.status === "Cancelled" || order.status === "Refunded") {
    const earnEntry = db.ledger.find((e) => e.idempotencyKey === key("earn"))
    if (earnEntry) {
      appendLedger(
        db,
        {
          customerId: order.customerId,
          type: "reverse_earn",
          points: -earnEntry.points,
          orderId: order.id,
          idempotencyKey: key("reverse-earn"),
          details: { reason: order.status, reverses: earnEntry.id },
          createdBy: actor.id,
        },
        now,
      )
    }
    const redeemEntry = db.ledger.find((e) => e.idempotencyKey === key("redeem"))
    if (redeemEntry) {
      appendLedger(
        db,
        {
          customerId: order.customerId,
          type: "restore_redeem",
          points: -redeemEntry.points,
          orderId: order.id,
          idempotencyKey: key("restore-redeem"),
          details: { reason: order.status, restores: redeemEntry.id },
          createdBy: actor.id,
        },
        now,
      )
    }
    return
  }

  if (earned || !rule || !rule.enabled) return
  if (rule.spendThresholdMinor <= 0 || rule.pointsPerThreshold <= 0) return
  if (rule.effectiveFrom > order.createdAt.slice(0, 10)) return
  if (!rule.eligibleStatuses.includes(order.status)) return
  const eligible = eligibleSpendMinor(order)
  if (eligible < rule.minOrderMinor) return
  const points = Math.floor(eligible / rule.spendThresholdMinor) * rule.pointsPerThreshold
  if (points <= 0) return
  appendLedger(
    db,
    {
      customerId: order.customerId,
      type: "earn",
      points,
      orderId: order.id,
      idempotencyKey: key("earn"),
      details: {
        currency: order.currency,
        eligibleMinor: eligible,
        spendThresholdMinor: rule.spendThresholdMinor,
        pointsPerThreshold: rule.pointsPerThreshold,
        policy: "subtotal minus loyalty discount; shipping and tax excluded",
        status: order.status,
      },
      createdBy: actor.id,
    },
    now,
  )
}

export function setOrderStatus(
  db: Db,
  actor: Actor,
  orderId: string,
  status: OrderStatus,
  now: Date,
): { order: Order; stockDeltas: StockDelta[] } {
  requireAdmin(actor)
  const order = db.orders.find((o) => o.id === orderId)
  if (!order) throw new CommerceError("order_not_found")
  if (!ORDER_STATUSES.includes(status)) throw new CommerceError("status_invalid")
  if (order.status === status) {
    settleLoyalty(db, order, actor, now)
    return { order, stockDeltas: [] }
  }
  if (!STATUS_TRANSITIONS[order.status].includes(status))
    throw new CommerceError("transition_invalid", { from: order.status, to: status })
  const previous = order.status
  order.status = status
  order.updatedAt = now.toISOString()
  order.statusHistory.push({ status, at: now.toISOString(), by: actor.id })
  if (status === "Refunded" && order.paymentStatus === "paid") order.paymentStatus = "refunded"
  settleLoyalty(db, order, actor, now)
  audit(db, actor, now, "order.status", "order", orderId, `${previous} → ${status}`)
  return {
    order,
    stockDeltas:
      status === "Cancelled" ? order.lines.map((l) => ({ productId: l.productId, variantId: l.variantId, delta: l.qty })) : [],
  }
}

export function setPaymentStatus(
  db: Db,
  actor: Actor,
  orderId: string,
  paymentStatus: PaymentStatus,
  now: Date,
) {
  requireAdmin(actor)
  const order = db.orders.find((o) => o.id === orderId)
  if (!order) throw new CommerceError("order_not_found")
  if (!["unpaid", "paid", "refunded"].includes(paymentStatus)) throw new CommerceError("status_invalid")
  if (order.status === "Cancelled" && paymentStatus === "paid") throw new CommerceError("transition_invalid")
  order.paymentStatus = paymentStatus
  order.updatedAt = now.toISOString()
  audit(db, actor, now, "order.payment", "order", orderId, `Payment → ${paymentStatus}`)
  return order
}

export function listOrders(db: Db, actor: Actor): Order[] {
  if (actor.role === "admin") return db.orders
  return db.orders.filter((o) => o.customerId === actor.id)
}

export function getOrder(db: Db, actor: Actor, id: string): Order | undefined {
  return listOrders(db, actor).find((o) => o.id === id)
}

export function listLedger(db: Db, actor: Actor, customerId: string): LedgerEntry[] {
  if (actor.role !== "admin" && actor.id !== customerId) throw new CommerceError("forbidden")
  return db.ledger.filter((e) => e.customerId === customerId).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function balanceFor(db: Db, actor: Actor, customerId: string): number {
  if (actor.role !== "admin" && actor.id !== customerId) throw new CommerceError("forbidden")
  return loyaltyBalance(db, customerId)
}

// ─── Admin configuration ──────────────────────────────────────────────────────
export function setCurrencyEnabled(db: Db, actor: Actor, code: string, enabled: boolean, now: Date) {
  requireAdmin(actor)
  const currency = getCurrency(db, code)
  if (!currency) throw new CommerceError("currency_unknown")
  if (!enabled && code === db.settings.baseCurrency) throw new CommerceError("base_currency_locked")
  currency.enabled = enabled
  audit(db, actor, now, "currency.toggle", "currency", code, enabled ? "Enabled" : "Disabled")
}

/**
 * The base currency is the exchange-rate anchor and the storefront default. It does not reinterpret any
 * stored price: products carry their own currency (legacy records = USD), manual prices, shipping and
 * loyalty rules are keyed by currency, and orders snapshot theirs. Rates recorded against the previous
 * base stay on file but are not used until that currency is the base again.
 */
export function setBaseCurrency(db: Db, actor: Actor, code: string, now: Date) {
  requireAdmin(actor)
  const currency = getCurrency(db, code)
  if (!currency) throw new CommerceError("currency_unknown")
  if (db.settings.baseCurrency === code) return
  const previous = db.settings.baseCurrency
  currency.enabled = true
  db.settings.baseCurrency = code
  audit(db, actor, now, "settings.base_currency", "settings", "baseCurrency", `${previous} -> ${code}`)
}

export function setConversionEnabled(db: Db, actor: Actor, enabled: boolean, now: Date) {
  requireAdmin(actor)
  db.settings.conversionEnabled = enabled
  audit(db, actor, now, "settings.conversion", "settings", "conversion", enabled ? "Enabled" : "Disabled")
}

export function saveFxRate(
  db: Db,
  actor: Actor,
  input: { id?: string; target: string; rate: string; effectiveFrom: string; expiresAt?: string; status: "active" | "inactive" },
  now: Date,
): FxRate {
  requireAdmin(actor)
  const base = db.settings.baseCurrency
  if (input.target === base || !getCurrency(db, input.target)) throw new CommerceError("currency_unknown")
  if (parseRateMicro(input.rate) === null) throw new CommerceError("rate_invalid")
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.effectiveFrom)) throw new CommerceError("date_invalid")
  if (input.expiresAt && (!/^\d{4}-\d{2}-\d{2}$/.test(input.expiresAt) || input.expiresAt < input.effectiveFrom))
    throw new CommerceError("date_invalid")
  const existing = input.id ? db.fxRates.find((r) => r.id === input.id) : undefined
  const record: FxRate = {
    id: existing?.id ?? nextId(db, "fx"),
    base,
    target: input.target,
    rate: input.rate.trim(),
    effectiveFrom: input.effectiveFrom,
    expiresAt: input.expiresAt || undefined,
    status: input.status,
    createdAt: existing?.createdAt ?? now.toISOString(),
    createdBy: existing?.createdBy ?? actor.id,
  }
  if (existing) Object.assign(existing, record)
  else db.fxRates.push(record)
  audit(db, actor, now, existing ? "fx.update" : "fx.create", "fx_rate", record.id, `1 ${base} = ${record.rate} ${record.target} from ${record.effectiveFrom}`)
  return record
}

export function deleteFxRate(db: Db, actor: Actor, id: string, now: Date) {
  requireAdmin(actor)
  db.fxRates = db.fxRates.filter((r) => r.id !== id)
  audit(db, actor, now, "fx.delete", "fx_rate", id, "Deleted exchange rate")
}

export function saveProductPrice(
  db: Db,
  actor: Actor,
  input: { productId: number; currency: string; amountMinor: number; status?: "active" | "inactive"; validFrom?: string; validTo?: string },
  catalog: Catalog,
  now: Date,
): ProductPrice {
  requireAdmin(actor)
  if (!catalog.products.some((p) => p.id === input.productId)) throw new CommerceError("product_missing")
  if (!getCurrency(db, input.currency)) throw new CommerceError("currency_unknown")
  if (!Number.isInteger(input.amountMinor) || input.amountMinor <= 0) throw new CommerceError("amount_invalid")
  if (input.validFrom && input.validTo && input.validTo < input.validFrom) throw new CommerceError("date_invalid")
  const existing = db.productPrices.find(
    (p) => p.productId === input.productId && p.currency === input.currency && !p.variantId,
  )
  const record: ProductPrice = {
    id: existing?.id ?? nextId(db, "pp"),
    productId: input.productId,
    variantId: null,
    currency: input.currency,
    amountMinor: input.amountMinor,
    status: input.status ?? "active",
    validFrom: input.validFrom || undefined,
    validTo: input.validTo || undefined,
    createdAt: existing?.createdAt ?? now.toISOString(),
    updatedAt: now.toISOString(),
  }
  if (existing) Object.assign(existing, record)
  else db.productPrices.push(record)
  audit(db, actor, now, existing ? "price.update" : "price.create", "product_price", record.id, `Product ${input.productId} ${input.currency} = ${input.amountMinor} minor`)
  return record
}

export function deleteProductPrice(db: Db, actor: Actor, id: string, now: Date) {
  requireAdmin(actor)
  db.productPrices = db.productPrices.filter((p) => p.id !== id)
  audit(db, actor, now, "price.delete", "product_price", id, "Deleted manual price")
}

export function saveShippingRate(
  db: Db,
  actor: Actor,
  input: { countryCode: string; currency: string; amountMinor: number; active: boolean },
  now: Date,
) {
  requireAdmin(actor)
  if (!SHIPPING_COUNTRIES.some((c) => c.code === input.countryCode)) throw new CommerceError("invalid_country")
  if (!getCurrency(db, input.currency)) throw new CommerceError("currency_unknown")
  if (!Number.isInteger(input.amountMinor) || input.amountMinor < 0) throw new CommerceError("amount_invalid")
  const existing = db.shippingRates.find((r) => r.countryCode === input.countryCode && r.currency === input.currency)
  if (existing) Object.assign(existing, input)
  else db.shippingRates.push({ ...input, id: nextId(db, "ship"), createdAt: now.toISOString() })
  audit(db, actor, now, "shipping.save", "shipping_rate", `${input.countryCode}-${input.currency}`, `Flat rate ${input.amountMinor} minor, ${input.active ? "active" : "inactive"}`)
}

export function deleteShippingRate(db: Db, actor: Actor, id: string, now: Date) {
  requireAdmin(actor)
  db.shippingRates = db.shippingRates.filter((r) => r.id !== id)
  audit(db, actor, now, "shipping.delete", "shipping_rate", id, "Deleted shipping rate")
}

export function validateLoyaltyRule(rule: LoyaltyRule): string | null {
  const ints: (keyof LoyaltyRule)[] = [
    "spendThresholdMinor",
    "pointsPerThreshold",
    "minOrderMinor",
    "pointValueMinor",
    "minRedeemPoints",
    "maxPointsPerOrder",
  ]
  for (const key of ints) {
    const v = rule[key] as number
    if (!Number.isInteger(v) || v < 0) return `invalid_${String(key)}`
  }
  if (!Number.isFinite(rule.maxRedeemPercent) || rule.maxRedeemPercent < 0 || rule.maxRedeemPercent > 100)
    return "invalid_maxRedeemPercent"
  if (!/^\d{4}-\d{2}-\d{2}$/.test(rule.effectiveFrom)) return "invalid_effectiveFrom"
  if (rule.enabled && (rule.spendThresholdMinor <= 0 || rule.pointsPerThreshold <= 0)) return "earning_required"
  if (rule.enabled && rule.eligibleStatuses.length === 0) return "statuses_required"
  if (rule.eligibleStatuses.some((s) => s === "Pending" || s === "Cancelled" || s === "Refunded"))
    return "statuses_invalid"
  return null
}

export function saveLoyaltyRule(db: Db, actor: Actor, rule: LoyaltyRule, now: Date) {
  requireAdmin(actor)
  if (!getCurrency(db, rule.currency)) throw new CommerceError("currency_unknown")
  const problem = validateLoyaltyRule(rule)
  if (problem) throw new CommerceError("loyalty_rule_invalid", { problem })
  const next: LoyaltyRule = { ...rule, updatedAt: now.toISOString(), updatedBy: actor.id }
  const index = db.loyaltyRules.findIndex((r) => r.currency === rule.currency)
  if (index >= 0) db.loyaltyRules[index] = next
  else db.loyaltyRules.push(next)
  audit(db, actor, now, "loyalty.rule", "loyalty_rule", rule.currency, `${rule.enabled ? "Enabled" : "Disabled"}: ${rule.pointsPerThreshold} pt per ${rule.spendThresholdMinor} minor; redeem ${rule.pointValueMinor} minor/pt`)
}

export function adjustPoints(
  db: Db,
  actor: Actor,
  input: { customerId: string; points: number; reason: string; requestId: string },
  now: Date,
) {
  requireAdmin(actor)
  if (!/^C-[\w-]+$/.test(input.customerId)) throw new CommerceError("customer_invalid")
  if (!Number.isInteger(input.points) || input.points === 0) throw new CommerceError("amount_invalid")
  if (!input.reason.trim()) throw new CommerceError("reason_required")
  if (input.points < 0 && loyaltyBalance(db, input.customerId) + input.points < 0)
    throw new CommerceError("insufficient_points")
  const entry = appendLedger(
    db,
    {
      customerId: input.customerId,
      type: "adjustment",
      points: input.points,
      idempotencyKey: `adjust:${input.requestId}`,
      details: { reason: input.reason.trim() },
      createdBy: actor.id,
    },
    now,
  )
  if (entry) audit(db, actor, now, "loyalty.adjust", "ledger", entry.id, `${input.points} pts for ${input.customerId}: ${input.reason.trim()}`)
  return entry
}
