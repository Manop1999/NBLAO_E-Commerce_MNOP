import type { CatalogPlacement } from "./engine"

/**
 * Admin sales placements are part of the browser-only demo catalog. API catalog prices must remain
 * authoritative until promotions are represented and managed by the server catalog API.
 */
export function selectPricePlacements(
  source: "demo" | "api",
  placements: CatalogPlacement[],
): CatalogPlacement[] {
  return source === "api" ? [] : placements
}
