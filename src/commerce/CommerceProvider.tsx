import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from "react"
import { useAuth } from "../auth"
import { useStore } from "../store"
import {
  Actor,
  Catalog,
  Db,
  PriceResult,
  CommerceError,
  StockDelta,
  Quote,
  QuoteInput,
  quoteCart,
  resolvePrice,
  enabledCurrencies,
} from "./engine"
import { COMMERCE_KEY, readDb, transact } from "./db"
import { Currency, formatMinor } from "./money"
import { Product } from "../data"
import { buildCatalogProducts, catalogEntries } from "./catalogEntries"

const CURRENCY_KEY = "nblao_currency"

interface CommerceCtx {
  db: Db
  actor: Actor | null
  catalog: Catalog
  currencies: Currency[]
  currency: Currency
  setCurrency: (code: string) => void
  priceFor: (product: Product, code?: string, variantId?: string) => PriceResult
  fmt: (minor: number, code?: string, opts?: { code?: boolean; trimWhole?: boolean }) => string
  quote: (input: QuoteInput) => Quote
  cartQuote: Quote
  run: <T>(fn: (db: Db, actor: Actor, catalog: Catalog, now: Date) => T) => T
  runAdmin: <T>(fn: (db: Db, actor: Actor, now: Date) => T) => T
  applyStock: (deltas: StockDelta[]) => void
  refresh: () => void
}

const Ctx = createContext<CommerceCtx | null>(null)

export function CommerceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const { allProducts: products, salesPlacements, cart, saveProduct } = useStore()
  const [db, setDb] = useState<Db>(() => readDb())
  const [selected, setSelected] = useState<string>(() => {
    try {
      return localStorage.getItem(CURRENCY_KEY) || ""
    } catch {
      return ""
    }
  })

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === COMMERCE_KEY || e.key === null) setDb(readDb())
    }
    window.addEventListener("storage", onStorage)
    return () => window.removeEventListener("storage", onStorage)
  }, [])

  const actor: Actor | null = useMemo(
    () => (user ? { id: user.id, role: user.role } : null),
    [user],
  )

  const catalog: Catalog = useMemo(
    () => ({
      products: buildCatalogProducts(products),
      placements: salesPlacements,
    }),
    [products, salesPlacements],
  )

  const enabled = useMemo(() => enabledCurrencies(db), [db])
  const base = db.currencies.find((c) => c.code === db.settings.baseCurrency) ?? db.currencies[0]
  const currency = enabled.find((c) => c.code === selected) ?? enabled.find((c) => c.code === base.code) ?? enabled[0] ?? base

  const setCurrency = useCallback((code: string) => {
    setSelected(code)
    try {
      localStorage.setItem(CURRENCY_KEY, code)
    } catch {
      /* private mode */
    }
  }, [])

  const catalogProduct = (p: Product, variantId?: string) =>
    (catalogEntries(p).find((e) => (e.variantId ?? null) === (variantId ?? null)) ?? catalogEntries(p)[0])

  const priceFor = useCallback(
    (product: Product, code?: string, variantId?: string) =>
      resolvePrice(db, catalogProduct(product, variantId), salesPlacements, code ?? currency.code, new Date()),
    [db, salesPlacements, currency.code],
  )

  const fmt = useCallback(
    (minor: number, code?: string, opts?: { code?: boolean; trimWhole?: boolean }) => {
      const c = db.currencies.find((x) => x.code === (code ?? currency.code)) ?? currency
      return formatMinor(minor, c, opts)
    },
    [db.currencies, currency],
  )

  const quote = useCallback(
    (input: QuoteInput) => quoteCart(db, catalog, input, new Date()),
    [db, catalog],
  )

  const cartQuote = useMemo(
    () =>
      quoteCart(
        db,
        catalog,
        {
          currency: currency.code,
          lines: cart.map((i) => ({ productId: i.id, variantId: i.variantId, qty: i.qty })),
        },
        new Date(),
      ),
    [db, catalog, cart, currency.code],
  )

  const run = useCallback(
    <T,>(fn: (d: Db, a: Actor, c: Catalog, now: Date) => T): T => {
      if (!actor) throw new CommerceError("auth_required")
      const { result, db: next } = transact((draft) => fn(draft, actor, catalog, new Date()))
      setDb(next)
      return result
    },
    [actor, catalog],
  )

  const runAdmin = useCallback(
    <T,>(fn: (d: Db, a: Actor, now: Date) => T): T => {
      if (!actor) throw new CommerceError("forbidden")
      const { result, db: next } = transact((draft) => fn(draft, actor, new Date()))
      setDb(next)
      return result
    },
    [actor],
  )

  const applyStock = useCallback(
    (deltas: StockDelta[]) => {
      const byProduct = new Map<number, StockDelta[]>()
      for (const d of deltas) byProduct.set(d.productId, [...(byProduct.get(d.productId) ?? []), d])
      for (const [productId, list] of byProduct) {
        const p = products.find((x) => x.id === productId)
        if (!p) continue
        let next: Product = p
        for (const d of list) {
          if (d.variantId && next.variants)
            next = {
              ...next,
              variants: next.variants.map((v) =>
                v.id === d.variantId ? { ...v, stock: Math.max(0, v.stock + d.delta) } : v,
              ),
            }
          else if (!d.variantId) next = { ...next, stock: Math.max(0, next.stock + d.delta) }
        }
        saveProduct(next)
      }
    },
    [products, saveProduct],
  )

  const refresh = useCallback(() => setDb(readDb()), [])

  const value: CommerceCtx = {
    db, actor, catalog, currencies: enabled, currency, setCurrency, priceFor, fmt,
    quote, cartQuote, run, runAdmin, applyStock, refresh,
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useCommerce() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error("useCommerce must be used within CommerceProvider")
  return ctx
}
