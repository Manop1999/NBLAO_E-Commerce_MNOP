import { describe, expect, it } from "vitest"
import { createEmptyDb, resolvePrice, type CatalogPlacement, type CatalogProduct } from "../engine"
import { selectPricePlacements } from "../pricingSource"

const localPromotion: CatalogPlacement = {
  productId: 1,
  type: "promotion",
  active: true,
  displayOrder: 1,
  promotionalPrice: 20_000,
}

describe("catalog-source pricing placements", () => {
  it("keeps local Admin promotions in demo mode", () => {
    const placements = [localPromotion]
    expect(selectPricePlacements("demo", placements)).toEqual(placements)
  })

  it("does not apply local Admin promotions to API catalog prices", () => {
    const placements = [localPromotion]
    expect(selectPricePlacements("api", placements)).toEqual([])
    expect(placements).toEqual([localPromotion])
  })

  it("keeps the API list price while preserving the demo promotional price", () => {
    const now = new Date("2026-11-04T00:00:00.000Z")
    const db = createEmptyDb(now)
    const product: CatalogProduct = {
      id: 1,
      name: "Transformer",
      sku: "EE-TRF-001",
      price: 28_500,
      stock: 0,
    }
    const placements = [localPromotion]

    const demoPrice = resolvePrice(db, product, selectPricePlacements("demo", placements), "USD", now)
    const apiPrice = resolvePrice(db, product, selectPricePlacements("api", placements), "USD", now)

    expect(demoPrice).toMatchObject({ ok: true, unitMinor: 2_000_000, promoApplied: true })
    expect(apiPrice).toMatchObject({ ok: true, unitMinor: 2_850_000, promoApplied: false })
  })
})
