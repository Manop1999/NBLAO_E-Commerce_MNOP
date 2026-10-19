import { CommerceError, createEmptyDb, Db } from "./engine"
import { DEFAULT_CURRENCIES } from "./money"

export const COMMERCE_KEY = "nblao_commerce"

export interface KeyValueStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

function defaultStorage(): KeyValueStorage {
  return globalThis.localStorage
}

/** Fill in any collection a stored (older) blob lacks, without discarding existing data. */
export function normalizeDb(raw: unknown, now: Date = new Date()): Db {
  const base = createEmptyDb(now)
  if (!raw || typeof raw !== "object") return base
  const src = raw as Partial<Db>
  const db: Db = {
    ...base,
    ...src,
    settings: { ...base.settings, ...(src.settings ?? {}) },
    counters: { ...base.counters, ...(src.counters ?? {}) },
    currencies: Array.isArray(src.currencies) ? src.currencies : base.currencies,
    fxRates: Array.isArray(src.fxRates) ? src.fxRates : [],
    productPrices: Array.isArray(src.productPrices) ? src.productPrices : [],
    shippingRates: Array.isArray(src.shippingRates) ? src.shippingRates : [],
    addresses: Array.isArray(src.addresses) ? src.addresses : [],
    orders: Array.isArray(src.orders) ? src.orders : [],
    loyaltyRules: Array.isArray(src.loyaltyRules) ? src.loyaltyRules : base.loyaltyRules,
    ledger: Array.isArray(src.ledger) ? src.ledger : [],
    audit: Array.isArray(src.audit) ? src.audit : [],
    version: 1,
  }
  for (const preset of DEFAULT_CURRENCIES) {
    if (!db.currencies.some((c) => c.code === preset.code)) db.currencies.push({ ...preset })
  }
  for (const currency of db.currencies) {
    if (!db.loyaltyRules.some((r) => r.currency === currency.code)) {
      db.loyaltyRules.push(base.loyaltyRules.find((r) => r.currency === currency.code) ?? { ...base.loyaltyRules[0], currency: currency.code })
    }
  }
  return db
}

export function readDb(storage: KeyValueStorage = defaultStorage()): Db {
  try {
    const raw = storage.getItem(COMMERCE_KEY)
    return normalizeDb(raw ? JSON.parse(raw) : null)
  } catch {
    return normalizeDb(null)
  }
}

/**
 * Run `fn` against a private copy of the freshest persisted state and commit it
 * with a single write. Any thrown error discards every change made by `fn`.
 */
export function transact<T>(
  fn: (draft: Db) => T,
  storage: KeyValueStorage = defaultStorage(),
): { result: T; db: Db } {
  const draft = structuredClone(readDb(storage))
  const result = fn(draft)
  try {
    storage.setItem(COMMERCE_KEY, JSON.stringify(draft))
  } catch {
    throw new CommerceError("storage_failed")
  }
  return { result, db: draft }
}
