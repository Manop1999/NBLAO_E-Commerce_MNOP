import { describe, expect, it } from "vitest"
import { selectPricePlacements } from "../pricingSource"
import type { CatalogPlacement } from "../engine"

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
})
