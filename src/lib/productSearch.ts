/** Pure multilingual product search: Unicode-safe normalisation + per-field localized haystacks. */

export interface SearchableProduct {
  id: number
  name: string
  sku: string
  model: string
  category: string
  subcategory: string
  shortDesc: string
  description: string
  spec?: string
  specs?: { label: string; value: string }[]
  applications?: string[]
  tags?: string[]
  options?: { name: string; values: string[] }[]
  variants?: { sku: string }[]
}

/** English text -> translated text, one dictionary per extra language. Only exact stored translations are used. */
export type SearchDictionaries = Record<string, string>[]

const INVISIBLE = /[​‌‍⁠﻿­]/g

export function normalizeSearchText(value: string): string {
  return (value ?? '').normalize('NFKC').replace(INVISIBLE, '').toLowerCase().replace(/\s+/g, ' ').trim()
}

/** Identifier form: SKU "EE-TRF-001" also matches "eetrf001" / "ee trf 001". */
export const compactIdentifier = (value: string) => normalizeSearchText(value).replace(/[^\p{L}\p{N}]/gu, '')

export interface ProductSearchIndex {
  text: string
  ids: string
}

export function buildSearchIndex(p: SearchableProduct, brandName: string, dicts: SearchDictionaries): ProductSearchIndex {
  const base = [
    p.name, brandName, p.category, p.subcategory, p.shortDesc, p.description, p.spec ?? '',
    ...(p.specs ?? []).flatMap((s) => [s.label, s.value]),
    ...(p.applications ?? []), ...(p.tags ?? []),
    ...(p.options ?? []).flatMap((o) => [o.name, ...o.values]),
  ].filter(Boolean)
  const localized = base.flatMap((t) => dicts.map((d) => d[t]).filter(Boolean))
  const idParts = [p.sku, p.model, ...(p.variants ?? []).map((v) => v.sku)]
  return {
    // newline keeps one field's tail from combining with the next field's head into a false match
    text: [...base, ...localized, ...idParts].map(normalizeSearchText).join('\n'),
    ids: idParts.map(compactIdentifier).join('\n'),
  }
}

/** Every whitespace-separated term must appear (substring, so partial words and Thai/Lao phrases work). */
export function matchesQuery(index: ProductSearchIndex, query: string): boolean {
  const q = normalizeSearchText(query)
  if (!q) return true
  const compactQuery = compactIdentifier(q)
  if (compactQuery.length >= 3 && index.ids.includes(compactQuery)) return true
  return q.split(' ').every((term) => index.text.includes(term))
}
