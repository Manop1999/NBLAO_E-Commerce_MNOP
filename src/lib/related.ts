import type { Product } from '../data'

export const isProductActive = (p: Pick<Product, 'active'>) => p.active !== false

/** Score how closely `candidate` relates to `product`; 0 = unrelated. Based on real catalogue fields only. */
export function relationScore(product: Product, candidate: Product): number {
  let score = 0
  if (candidate.subcategory && candidate.subcategory === product.subcategory) score += 4
  if (candidate.category === product.category) score += 2
  const apps = new Set(product.applications.map((a) => a.toLowerCase()))
  const shared = candidate.applications.filter((a) => apps.has(a.toLowerCase())).length
  score += Math.min(shared, 3)
  if (candidate.brandId === product.brandId && (candidate.category === product.category || shared > 0)) score += 1
  return score
}

/** Related products, best match first. Excludes the product itself and inactive products. */
export function getRelatedProducts(product: Product, all: Product[]): Product[] {
  return all
    .filter((p) => p.id !== product.id && isProductActive(p))
    .map((p) => ({ p, score: relationScore(product, p) }))
    .filter((x) => x.score >= 2)
    .sort((a, b) => b.score - a.score || Number(b.p.featured) - Number(a.p.featured) || a.p.id - b.p.id)
    .map((x) => x.p)
}
