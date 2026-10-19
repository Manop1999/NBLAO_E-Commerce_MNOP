export type Lang = 'en' | 'lo' | 'th'

export const LANGS: readonly Lang[] = ['en', 'lo', 'th']
export const DEFAULT_LANG: Lang = 'en'
export const LANG_STORAGE_KEY = 'nblao_lang'

export function normalizeLang(value: unknown): Lang {
  return typeof value === 'string' && (LANGS as readonly string[]).includes(value) ? (value as Lang) : DEFAULT_LANG
}

export const HTML_LANG: Record<Lang, string> = { en: 'en', lo: 'lo', th: 'th' }

/** Pick the localized value for lang, falling back to English when the localized one is empty. */
export function pickLocalized(lang: Lang, en: string, lo?: string, th?: string): string {
  if (lang === 'lo' && lo) return lo
  if (lang === 'th' && th) return th
  return en
}

/** Deep-map every string leaf through a dictionary; unknown strings fall back to themselves (English). */
export function mapLeaves<T>(node: T, dict: Record<string, string>): T {
  if (typeof node === 'string') return (dict[node] ?? node) as unknown as T
  if (Array.isArray(node)) return node.map((v) => mapLeaves(v, dict)) as unknown as T
  if (node && typeof node === 'object') {
    return Object.fromEntries(Object.entries(node).map(([k, v]) => [k, mapLeaves(v, dict)])) as T
  }
  return node
}
