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
 */
export function assetUrl(path: string | null | undefined, base: string = import.meta.env.BASE_URL || '/'): string {
  if (!path) return ''
  const value = path.trim()
  if (/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(value)) return value
  const normalizedBase = base.endsWith('/') ? base : `${base}/`
  if (normalizedBase !== '/' && value.startsWith(normalizedBase)) return value
  return normalizedBase + value.replace(/^\/+/, '')
}
