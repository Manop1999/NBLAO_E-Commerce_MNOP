/**
 * Resolve a path to a file in `public/` against Vite's configured `base`.
 *
 * The site is deployed to a GitHub Pages project site, so `base` is
 * `/NBLAO_E-Commerce_MNOP/` and a root-relative path such as
 * `/site-images/hero.jpg` must become `/NBLAO_E-Commerce_MNOP/site-images/hero.jpg`.
 *
 * Absolute URLs (`https:`, `data:`, `blob:`, protocol-relative `//`) and paths that
 * already include the base are returned unchanged, so admin uploads stored as data
 * URLs and values already saved in localStorage keep working.
 *
 * localStorage is shared by every project site on manop1999.github.io, and the
 * nblao-ecommerce-preview deployment stores paths with its own base baked in (e.g.
 * `/nblao-ecommerce-preview/products/product-01.jpg`) under the same `nblao_*` keys.
 * Such a path is resolved to our own public entry here, at render time, so the stored
 * record is left as is. Only the confirmed bases in FOREIGN_DEPLOYMENT_BASES are
 * stripped; any other leading folder (e.g. `/uploads/products/x.jpg`) is kept.
 */
export function assetUrl(path: string | null | undefined, base: string = import.meta.env.BASE_URL || '/'): string {
  if (!path) return ''
  const value = path.trim()
  if (/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(value)) return value
  const normalizedBase = base.endsWith('/') ? base : `${base}/`
  if (normalizedBase !== '/' && value.startsWith(normalizedBase)) return value
  const foreignBase = FOREIGN_BASE_ASSET.exec(value)
  return normalizedBase + (foreignBase ? foreignBase[1] : value.replace(/^\/+/, ''))
}

/** Top-level entries of `public/`; kept in sync with the folder by assetUrl.test.ts. */
export const PUBLIC_ENTRIES = ['advertisements', 'brands', 'nb-lao-logo.png', 'product-placeholder.svg', 'products', 'site-images']

/** Bases of other deployments on the same origin confirmed to write `nblao_*` image paths. */
export const FOREIGN_DEPLOYMENT_BASES = ['nblao-ecommerce-preview']

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const FOREIGN_BASE_ASSET = new RegExp(
  `^/(?:${FOREIGN_DEPLOYMENT_BASES.map(escapeRegExp).join('|')})/((?:${PUBLIC_ENTRIES.map(escapeRegExp).join('|')})(?:/.*)?)$`,
)
