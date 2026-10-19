import { beforeEach, describe, expect, it } from "vitest"
import { transact, readDb, KeyValueStorage } from "../db"
import {
  Actor, AddressInput, adjustPoints, balanceFor, Catalog, CommerceError, createAddress,
  deleteAddress, getOrder, listAddresses, listLedger, placeOrder, PlaceOrderInput,
  quoteCart, resolvePrice, saveFxRate, saveLoyaltyRule, saveProductPrice, saveShippingRate,
  setCurrencyEnabled, setDefaultAddress, setOrderStatus, setPaymentStatus, updateAddress,
  Db, LoyaltyRule, defaultLoyaltyRule, setConversionEnabled,
} from "../engine"
import { convertMinor, formatMinor, parseDecimalToMinor, parseRateMicro } from "../money"

const NOW = new Date("2026-10-12T08:00:00Z")
const admin: Actor = { id: "A-001", role: "admin" }
const alice: Actor = { id: "C-001", role: "customer" }
const bob: Actor = { id: "C-002", role: "customer" }

const catalog = (): Catalog => ({
  products: [
    { id: 1, name: "Transformer", sku: "EE-1", price: 100, stock: 5 },
    { id: 2, name: "Cable", sku: "CA-2", price: 10.5, stock: 100 },
  ],
  placements: [],
})

function memoryStorage(): KeyValueStorage & { data: Record<string, string> } {
  const data: Record<string, string> = {}
  return { data, getItem: (k) => data[k] ?? null, setItem: (k, v) => { data[k] = v } }
}

const addr = (over: Partial<AddressInput> = {}): AddressInput => ({
  label: "Office", recipientName: "John Doe", phone: "+856 20 1234 5678", company: "Lao Power",
  countryCode: "LA", province: "Vientiane", district: "Chanthabouly", village: "Phontong",
  postalCode: "", addressLine: "123 Industrial Zone", instructions: "", ...over,
})

let storage: ReturnType<typeof memoryStorage>
const tx = <T,>(fn: (db: Db) => T) => transact(fn, storage).result
const read = () => readDb(storage)
const cat = catalog()

function configure() {
  tx((db) => {
    setCurrencyEnabled(db, admin, "THB", true, NOW)
    setCurrencyEnabled(db, admin, "LAK", true, NOW)
    saveFxRate(db, admin, { target: "THB", rate: "35.5", effectiveFrom: "2026-01-01", status: "active" }, NOW)
    saveFxRate(db, admin, { target: "LAK", rate: "21500", effectiveFrom: "2026-01-01", status: "active" }, NOW)
  })
}
const order = (over: Partial<PlaceOrderInput> = {}, actor = alice) =>
  tx((db) =>
    placeOrder(db, actor, cat, {
      idempotencyKey: `k-${Math.random()}`, currency: "USD", lines: [{ productId: 1, qty: 1 }],
      newAddress: addr(), paymentMethod: "bank-transfer",
      contact: { name: "John Doe", email: "j@x.la", phone: "+856201234", company: "" }, ...over,
    }, NOW),
  )
const rule = (over: Partial<LoyaltyRule>): LoyaltyRule => ({
  ...defaultLoyaltyRule("USD", NOW), enabled: true, spendThresholdMinor: 1000, pointsPerThreshold: 1,
  pointValueMinor: 10, minRedeemPoints: 5, maxRedeemPercent: 50, eligibleStatuses: ["Delivered"], ...over,
})
const deliver = (id: string) => {
  for (const s of ["Confirmed", "Processing", "Shipped", "Delivered"] as const)
    tx((db) => setOrderStatus(db, admin, id, s, NOW))
}
const expectCode = (fn: () => unknown, code: string) => {
  try { fn() } catch (e) { expect((e as CommerceError).code).toBe(code); return }
  throw new Error(`expected ${code}`)
}

beforeEach(() => { storage = memoryStorage() })

describe("money primitives", () => {
  it("parses and rounds exactly", () => {
    expect(parseDecimalToMinor("1,234.50", 2)).toBe(123450)
    expect(parseDecimalToMinor("10.555", 2)).toBeNull()
    expect(parseDecimalToMinor("100", 0)).toBe(100)
    expect(parseRateMicro("35.5")).toBe(35_500_000)
    expect(parseRateMicro("0")).toBeNull()
    expect(parseRateMicro("-1")).toBeNull()
    expect(parseRateMicro("abc")).toBeNull()
    // 10.50 USD * 35.5 THB = 372.75 THB ; 0.01 USD * 35.5 = 0.355 -> 0.36 (half up)
    expect(convertMinor(1050, 2, 2, 35_500_000)).toBe(37275)
    expect(convertMinor(1, 2, 2, 35_500_000)).toBe(36)
    // LAK has 0 decimals: 10.50 USD * 21500 = 225750
    expect(convertMinor(1050, 2, 0, 21_500_000_000)).toBe(225750)
    expect(convertMinor(1, 2, 0, 21_500_000_000)).toBe(215)
    expect(formatMinor(123456, { code: "USD", symbol: "$", decimals: 2 })).toBe("$1,234.56 USD")
    expect(formatMinor(2100000, { code: "LAK", symbol: "₭", decimals: 0 })).toBe("₭2,100,000 LAK")
  })
})

describe("multi-currency pricing", () => {
  it("1/2 manual price exists and wins over conversion", () => {
    configure()
    tx((db) => saveProductPrice(db, admin, { productId: 1, currency: "THB", amountMinor: 350000 }, cat, NOW))
    const p = resolvePrice(read(), cat.products[0], [], "THB", NOW)
    expect(p).toMatchObject({ ok: true, method: "manual", unitMinor: 350000 })
  })
  it("3 falls back to exchange rate", () => {
    configure()
    const p = resolvePrice(read(), cat.products[0], [], "THB", NOW)
    expect(p).toMatchObject({ ok: true, method: "converted", unitMinor: 355000, fxRate: "35.5" })
    expect(resolvePrice(read(), cat.products[1], [], "LAK", NOW)).toMatchObject({ method: "converted", unitMinor: 225750 })
  })
  it("4 neither manual price nor rate -> unavailable", () => {
    tx((db) => setCurrencyEnabled(db, admin, "THB", true, NOW))
    expect(resolvePrice(read(), cat.products[0], [], "THB", NOW)).toMatchObject({ ok: false, reason: "no_price" })
  })
  it("5 disabled currency is unavailable", () => {
    expect(resolvePrice(read(), cat.products[0], [], "THB", NOW)).toMatchObject({ ok: false, reason: "currency_disabled" })
    expect(resolvePrice(read(), cat.products[0], [], "EUR", NOW)).toMatchObject({ ok: false, reason: "currency_unknown" })
  })
  it("6 invalid, expired, inactive and disabled-conversion rates are never used", () => {
    tx((db) => { setCurrencyEnabled(db, admin, "THB", true, NOW) })
    expectCode(() => tx((db) => saveFxRate(db, admin, { target: "THB", rate: "-3", effectiveFrom: "2026-01-01", status: "active" }, NOW)), "rate_invalid")
    expectCode(() => tx((db) => saveFxRate(db, admin, { target: "THB", rate: "0", effectiveFrom: "2026-01-01", status: "active" }, NOW)), "rate_invalid")
    tx((db) => saveFxRate(db, admin, { target: "THB", rate: "35", effectiveFrom: "2025-01-01", expiresAt: "2025-12-31", status: "active" }, NOW))
    expect(resolvePrice(read(), cat.products[0], [], "THB", NOW)).toMatchObject({ ok: false, reason: "rate_expired" })
    tx((db) => saveFxRate(db, admin, { target: "THB", rate: "35", effectiveFrom: "2027-01-01", status: "active" }, NOW))
    expect(resolvePrice(read(), cat.products[0], [], "THB", NOW)).toMatchObject({ ok: false, reason: "rate_expired" })
    tx((db) => { db.fxRates.push({ id: "bad", base: "USD", target: "THB", rate: "oops", effectiveFrom: "2026-02-01", status: "active", createdAt: "", createdBy: "x" }) })
    expect(resolvePrice(read(), cat.products[0], [], "THB", NOW)).toMatchObject({ ok: false, reason: "rate_invalid" })
    configure()
    tx((db) => setConversionEnabled(db, admin, false, NOW))
    expect(resolvePrice(read(), cat.products[0], [], "LAK", NOW)).toMatchObject({ ok: false, reason: "no_price" })
  })
  it("7 currency-specific rounding", () => {
    configure()
    const lak = resolvePrice(read(), cat.products[1], [], "LAK", NOW)
    const thb = resolvePrice(read(), cat.products[1], [], "THB", NOW)
    expect(lak).toMatchObject({ unitMinor: 225750 }) // 0 decimals
    expect(thb).toMatchObject({ unitMinor: 37275 }) // 2 decimals
  })
  it("promotions apply to base, manual (proportionally) and converted prices", () => {
    configure()
    tx((db) => saveProductPrice(db, admin, { productId: 1, currency: "THB", amountMinor: 400000 }, cat, NOW))
    const withPromo: Catalog = { ...cat, placements: [{ productId: 1, type: "promotion", active: true, displayOrder: 1, promotionalPrice: 80 }] }
    expect(resolvePrice(read(), withPromo.products[0], withPromo.placements, "USD", NOW)).toMatchObject({ method: "base", unitMinor: 8000, listMinor: 10000, promoApplied: true })
    expect(resolvePrice(read(), withPromo.products[0], withPromo.placements, "THB", NOW)).toMatchObject({ method: "manual", unitMinor: 320000 })
    expect(resolvePrice(read(), withPromo.products[0], withPromo.placements, "LAK", NOW)).toMatchObject({ method: "converted", unitMinor: 1720000 })
  })
  it("9 cart/checkout totals share one currency and 10 ignore client prices", () => {
    configure()
    const q = quoteCart(read(), cat, { currency: "THB", lines: [{ productId: 1, qty: 2 }, { productId: 2, qty: 1 }] }, NOW)
    expect(q.currency).toBe("THB")
    expect(q.subtotalMinor).toBe(355000 * 2 + 37275)
    const o = order({ currency: "THB", lines: [{ productId: 1, qty: 2 }, { productId: 2, qty: 1 }], ...({ unitPrice: 1, price: 1, total: 1 } as object) }).order
    expect(o.currency).toBe("THB")
    expect(o.totalMinor).toBe(q.subtotalMinor)
    expect(o.lines[0]).toMatchObject({ method: "converted", fxRate: "35.5", baseUnitPriceMinor: 10000 })
  })
  it("11 existing orders keep prices after price/rate changes", () => {
    configure()
    const o = order({ currency: "THB" }).order
    tx((db) => {
      saveFxRate(db, admin, { target: "THB", rate: "40", effectiveFrom: "2026-10-01", status: "active" }, NOW)
      saveProductPrice(db, admin, { productId: 1, currency: "THB", amountMinor: 999900 }, cat, NOW)
    })
    const stored = getOrder(read(), alice, o.id)!
    expect(stored.totalMinor).toBe(355000)
    expect(stored.lines[0].unitPriceMinor).toBe(355000)
    expect(resolvePrice(read(), cat.products[0], [], "THB", NOW)).toMatchObject({ unitMinor: 999900 })
  })
  it("rejects unavailable currency and insufficient stock at order time", () => {
    expectCode(() => order({ currency: "THB" }), "quote_invalid")
    expectCode(() => order({ lines: [{ productId: 1, qty: 6 }] }), "quote_invalid")
    expect(read().orders).toHaveLength(0)
  })
  it("admin-only configuration", () => {
    expectCode(() => tx((db) => setCurrencyEnabled(db, alice, "THB", true, NOW)), "forbidden")
    expectCode(() => tx((db) => saveFxRate(db, alice, { target: "THB", rate: "3", effectiveFrom: "2026-01-01", status: "active" }, NOW)), "forbidden")
    expectCode(() => tx((db) => setCurrencyEnabled(db, admin, "USD", false, NOW)), "base_currency_locked")
    tx((db) => setCurrencyEnabled(db, admin, "THB", true, NOW))
    expect(read().audit[0]).toMatchObject({ action: "currency.toggle", actorId: "A-001" })
  })
})

describe("loyalty", () => {
  beforeEach(() => {
    configure()
    tx((db) => {
      saveLoyaltyRule(db, admin, rule({ currency: "USD" }), NOW) // 10 USD -> 1 pt
      saveLoyaltyRule(db, admin, rule({ currency: "THB", spendThresholdMinor: 10000, pointValueMinor: 100 }), NOW) // 100 THB -> 1pt
      saveLoyaltyRule(db, admin, rule({ currency: "LAK", spendThresholdMinor: 100000, pointValueMinor: 1000 }), NOW) // 100,000 LAK
    })
  })
  it("1/2 accrues per currency independently", () => {
    const usd = order({ currency: "USD" }).order // 100 USD -> 10 pts
    const thb = order({ currency: "THB" }).order // 3550 THB -> 35 pts
    const lak = order({ currency: "LAK" }).order // 2,150,000 LAK -> 21 pts
    for (const o of [usd, thb, lak]) deliver(o.id)
    const pts = read().ledger.filter((e) => e.type === "earn").map((e) => [e.orderId, e.points])
    expect(Object.fromEntries(pts)).toEqual({ [usd.id]: 10, [thb.id]: 35, [lak.id]: 21 })
    expect(balanceFor(read(), alice, alice.id)).toBe(66)
  })
  it("3 ineligible statuses award nothing", () => {
    const o = order().order
    tx((db) => setOrderStatus(db, admin, o.id, "Confirmed", NOW))
    tx((db) => setOrderStatus(db, admin, o.id, "Processing", NOW))
    expect(read().ledger).toHaveLength(0)
  })
  it("4/5 repeated updates and repeated events do not duplicate", () => {
    const o = order().order
    deliver(o.id)
    tx((db) => setOrderStatus(db, admin, o.id, "Delivered", NOW))
    tx((db) => setOrderStatus(db, admin, o.id, "Delivered", NOW))
    expect(read().ledger.filter((e) => e.type === "earn")).toHaveLength(1)
    expectCode(() => tx((db) => setOrderStatus(db, admin, o.id, "Processing", NOW)), "transition_invalid")
  })
  it("earning uses a snapshot: later rule changes do not alter pending orders; ledger keeps calc details", () => {
    const o = order().order
    tx((db) => saveLoyaltyRule(db, admin, rule({ currency: "USD", spendThresholdMinor: 100 }), NOW))
    deliver(o.id)
    const entry = read().ledger.find((e) => e.type === "earn")!
    expect(entry.points).toBe(10)
    expect(entry.details).toMatchObject({ eligibleMinor: 10000, spendThresholdMinor: 1000, pointsPerThreshold: 1 })
  })
  it("minimum order value gates earning", () => {
    tx((db) => saveLoyaltyRule(db, admin, rule({ currency: "USD", minOrderMinor: 50000 }), NOW))
    deliver(order().order.id)
    expect(read().ledger).toHaveLength(0)
  })
  it("6 cancellation restores redeemed points; refund reverses earned and restores redeemed", () => {
    tx((db) => adjustPoints(db, admin, { customerId: "C-001", points: 100, reason: "seed", requestId: "r1" }, NOW))
    const cancelled = order({ redeemPoints: 20 }).order // 20pt * 10 = 2.00 USD
    expect(cancelled.loyaltyDiscountMinor).toBe(200)
    expect(cancelled.totalMinor).toBe(9800)
    expect(balanceFor(read(), alice, alice.id)).toBe(80)
    tx((db) => setOrderStatus(db, admin, cancelled.id, "Cancelled", NOW))
    tx((db) => setOrderStatus(db, admin, cancelled.id, "Cancelled", NOW))
    expect(balanceFor(read(), alice, alice.id)).toBe(100)
    expect(read().ledger.some((e) => e.type === "restore_redeem")).toBe(true)

    const o = order({ redeemPoints: 10 }).order
    deliver(o.id) // eligible spend = 10000 - 100 = 9900 -> 9 pts
    expect(balanceFor(read(), alice, alice.id)).toBe(100 - 10 + 9)
    tx((db) => setOrderStatus(db, admin, o.id, "Refunded", NOW))
    expect(balanceFor(read(), alice, alice.id)).toBe(100)
    expect(read().ledger.length).toBe(7) // adjust; redeem+restore; redeem+earn+reverse+restore
  })
  it("7 cannot redeem beyond balance, min, or limits", () => {
    expectCode(() => order({ redeemPoints: 5 }), "quote_invalid") // zero balance
    tx((db) => adjustPoints(db, admin, { customerId: "C-001", points: 1000, reason: "seed", requestId: "r1" }, NOW))
    const q = (n: number) => quoteCart(read(), cat, { currency: "USD", lines: [{ productId: 1, qty: 1 }], redeemPoints: n, customerId: "C-001" }, NOW)
    expect(q(4).issues[0].code).toBe("redeem_below_min")
    expect(q(500).issues).toHaveLength(0) // 50% of $100 = 5000 minor / 10 per pt = 500 pts exactly
    expect(q(500).loyalty.discountMinor).toBe(5000)
    expect(q(501).issues[0].code).toBe("redeem_over_limit")
    expect(q(-5).issues[0].code).toBe("redeem_invalid")
    expect(q(2.5).issues[0].code).toBe("redeem_invalid")
  })
  it("8 sequential (atomic) redemptions cannot double-spend", () => {
    tx((db) => adjustPoints(db, admin, { customerId: "C-001", points: 30, reason: "seed", requestId: "r1" }, NOW))
    order({ redeemPoints: 25 })
    expectCode(() => order({ redeemPoints: 25 }), "quote_invalid")
    expect(balanceFor(read(), alice, alice.id)).toBe(5)
    // a failed transaction leaves no partial state
    expect(read().orders).toHaveLength(1)
  })
  it("duplicate order submission is idempotent", () => {
    tx((db) => adjustPoints(db, admin, { customerId: "C-001", points: 30, reason: "seed", requestId: "r1" }, NOW))
    const first = order({ idempotencyKey: "same", redeemPoints: 10 })
    const second = order({ idempotencyKey: "same", redeemPoints: 10 })
    expect(second.duplicate).toBe(true)
    expect(second.order.id).toBe(first.order.id)
    expect(read().orders).toHaveLength(1)
    expect(balanceFor(read(), alice, alice.id)).toBe(20)
    expect(second.stockDeltas).toEqual([])
  })
  it("9 config changes never rewrite history", () => {
    const o = order().order
    deliver(o.id)
    const before = JSON.stringify(read().ledger)
    tx((db) => saveLoyaltyRule(db, admin, rule({ currency: "USD", spendThresholdMinor: 1, pointsPerThreshold: 9 }), NOW))
    expect(JSON.stringify(read().ledger)).toBe(before)
    expect(read().audit.some((a) => a.action === "loyalty.rule")).toBe(true)
  })
  it("10 customer isolation for ledger and balance", () => {
    tx((db) => adjustPoints(db, admin, { customerId: "C-001", points: 30, reason: "seed", requestId: "r1" }, NOW))
    expectCode(() => listLedger(read(), bob, "C-001"), "forbidden")
    expectCode(() => balanceFor(read(), bob, "C-001"), "forbidden")
    expect(listLedger(read(), admin, "C-001")).toHaveLength(1)
  })
  it("rule validation and admin-only", () => {
    expectCode(() => tx((db) => saveLoyaltyRule(db, alice, rule({}), NOW)), "forbidden")
    expectCode(() => tx((db) => saveLoyaltyRule(db, admin, rule({ spendThresholdMinor: 0 }), NOW)), "loyalty_rule_invalid")
    expectCode(() => tx((db) => saveLoyaltyRule(db, admin, rule({ maxRedeemPercent: 101 }), NOW)), "loyalty_rule_invalid")
    expectCode(() => tx((db) => saveLoyaltyRule(db, admin, rule({ eligibleStatuses: ["Pending"] }), NOW)), "loyalty_rule_invalid")
    expectCode(() => tx((db) => adjustPoints(db, admin, { customerId: "C-001", points: -5, reason: "x", requestId: "n" }, NOW)), "insufficient_points")
  })
  it("payment status is independent of order status and does not mark paid on submit", () => {
    const o = order().order
    expect(o.paymentStatus).toBe("unpaid")
    tx((db) => setPaymentStatus(db, admin, o.id, "paid", NOW))
    expect(getOrder(read(), alice, o.id)!.paymentStatus).toBe("paid")
    expect(getOrder(read(), bob, o.id)).toBeUndefined()
  })
})

describe("addresses & shipping", () => {
  it("1/2 CRUD and default semantics", () => {
    const a = tx((db) => createAddress(db, alice, addr({ label: "Home" }), NOW))
    const b = tx((db) => createAddress(db, alice, addr({ label: "Warehouse" }), NOW))
    expect(a.isDefault).toBe(true)
    expect(b.isDefault).toBe(false)
    tx((db) => setDefaultAddress(db, alice, b.id))
    expect(listAddresses(read(), alice).filter((x) => x.isDefault).map((x) => x.id)).toEqual([b.id])
    tx((db) => updateAddress(db, alice, a.id, addr({ label: "Home 2", isDefault: true }), NOW))
    expect(listAddresses(read(), alice).filter((x) => x.isDefault).map((x) => x.id)).toEqual([a.id])
    tx((db) => deleteAddress(db, alice, a.id))
    expect(listAddresses(read(), alice).map((x) => [x.id, x.isDefault])).toEqual([[b.id, true]])
  })
  it("5 invalid addresses are rejected", () => {
    expectCode(() => tx((db) => createAddress(db, alice, addr({ addressLine: " " }), NOW)), "address_invalid")
    expectCode(() => tx((db) => createAddress(db, alice, addr({ countryCode: "US" }), NOW)), "address_invalid")
    expectCode(() => tx((db) => createAddress(db, alice, addr({ phone: "abc" }), NOW)), "address_invalid")
    expectCode(() => tx((db) => createAddress(db, alice, addr({ countryCode: "TH", postalCode: "12" }), NOW)), "address_invalid")
    expect(read().addresses).toHaveLength(0)
  })
  it("6 customers cannot read, edit, delete or order to another customer's address", () => {
    const a = tx((db) => createAddress(db, alice, addr(), NOW))
    expect(listAddresses(read(), bob)).toHaveLength(0)
    expectCode(() => tx((db) => updateAddress(db, bob, a.id, addr(), NOW)), "address_not_found")
    expectCode(() => tx((db) => deleteAddress(db, bob, a.id)), "address_not_found")
    expectCode(() => tx((db) => setDefaultAddress(db, bob, a.id)), "address_not_found")
    expectCode(() => order({ addressId: a.id, newAddress: undefined }, bob), "address_not_found")
    expectCode(() => tx((db) => listAddresses(db, admin)), "auth_required")
  })
  it("3/4 checkout accepts saved or new address (optionally saved); 7/8 snapshots are immutable", () => {
    const saved = tx((db) => createAddress(db, alice, addr({ label: "Home" }), NOW))
    const o1 = order({ addressId: saved.id, newAddress: undefined }).order
    const o2 = order({ newAddress: addr({ label: "Site", addressLine: "Site Rd" }), saveNewAddress: true }).order
    const o3 = order({ newAddress: addr({ label: "One-off" }) }).order
    expect(listAddresses(read(), alice).map((a) => a.label).sort()).toEqual(["Home", "Site"])
    expect(o2.address.sourceAddressId).toBeDefined()
    expect(o3.address.sourceAddressId).toBeUndefined()
    tx((db) => updateAddress(db, alice, saved.id, addr({ label: "Changed", addressLine: "Elsewhere" }), NOW))
    tx((db) => deleteAddress(db, alice, saved.id))
    const stored = getOrder(read(), alice, o1.id)!
    expect(stored.address).toMatchObject({ label: "Home", addressLine: "123 Industrial Zone" })
    expect(() => order({ newAddress: undefined })).toThrow()
  })
  it("9/10 shipping uses admin rates; missing rate -> manual confirmation; ineligible destination blocked", () => {
    configure()
    const noRate = order({ currency: "THB" }).order
    expect(noRate.shippingStatus).toBe("to_be_confirmed")
    expect(noRate.shippingMinor).toBe(0)
    tx((db) => saveShippingRate(db, admin, { countryCode: "LA", currency: "USD", amountMinor: 2500, active: true }, NOW))
    const rated = order().order
    expect(rated).toMatchObject({ shippingStatus: "calculated", shippingMinor: 2500, totalMinor: 12500 })
    expectCode(() => tx((db) => placeOrder(db, alice, cat, {
      idempotencyKey: "x", currency: "USD", lines: [{ productId: 1, qty: 1 }], newAddress: { ...addr(), countryCode: "US" },
      paymentMethod: "cash", contact: { name: "a", email: "a@b.co", phone: "123456" },
    } as PlaceOrderInput, NOW)), "address_invalid")
  })
})

describe("integration", () => {
  it("full journey across USD/THB/LAK with inventory effects", () => {
    configure()
    tx((db) => {
      saveLoyaltyRule(db, admin, rule({ currency: "THB", spendThresholdMinor: 10000, pointValueMinor: 100 }), NOW)
      adjustPoints(db, admin, { customerId: "C-001", points: 50, reason: "seed", requestId: "s" }, NOW)
      saveShippingRate(db, admin, { countryCode: "LA", currency: "THB", amountMinor: 50000, active: true }, NOW)
    })
    const placed = order({ currency: "THB", redeemPoints: 10, lines: [{ productId: 1, qty: 2 }] })
    expect(placed.stockDeltas).toEqual([{ productId: 1, delta: -2 }])
    // subtotal 7100 THB, -10pts*1.00 THB = 10.00, + 500.00 shipping
    expect(placed.order).toMatchObject({ subtotalMinor: 710000, loyaltyDiscountMinor: 1000, shippingMinor: 50000, totalMinor: 759000, paymentStatus: "unpaid", status: "Pending" })
    const cancelled = tx((db) => setOrderStatus(db, admin, placed.order.id, "Cancelled", NOW))
    expect(cancelled.stockDeltas).toEqual([{ productId: 1, delta: 2 }])
    expect(balanceFor(read(), alice, alice.id)).toBe(50)
  })
  it("failed transactions write nothing", () => {
    const before = storage.data["nblao_commerce"]
    expect(() => tx((db) => { createAddress(db, alice, addr(), NOW); throw new Error("boom") })).toThrow("boom")
    expect(storage.data["nblao_commerce"]).toBe(before)
    expect(read().addresses).toHaveLength(0)
  })
  it("normalizes older blobs without losing data", () => {
    storage.setItem("nblao_commerce", JSON.stringify({ orders: [{ id: "OLD" }], settings: { baseCurrency: "USD" } }))
    const db = read()
    expect(db.orders[0].id).toBe("OLD")
    expect(db.currencies.map((c) => c.code)).toEqual(["USD", "THB", "LAK"])
    expect(db.settings.conversionEnabled).toBe(true)
  })
})
