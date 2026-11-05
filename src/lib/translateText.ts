/*
 * Display translation of canonical English UI text (used by GlobalLanguage for pages that predate the keyed
 * catalogue). Pure functions over plain dictionaries, so the rules are unit-tested.
 *
 * Rules, in order:
 * 1. Whole-text match: a text node or attribute that equals a key (after trimming) is replaced as a whole.
 *    Shared dictionaries win over the exact-only table, so existing translations stay as they were.
 * 2. Phrase substitution: multi-word keys from the shared dictionaries (e.g. "Request a Quote") are replaced
 *    inside longer text (at English word boundaries), as before.
 * 3. Single-word keys (e.g. "All", "Next", "Team", "Done", "items", "of", "Products") are replaced inside longer
 *    text only when that text has nothing else left in English: "12 items" or "Total Items" are translated, but
 *    "All products are ready" or "Show 24 per page" stay English instead of becoming a word-by-word mix.
 *    Codes written in capitals (SKU, NB, LAO) do not count as untranslated English.
 * 4. Exact-only keys (src/authTranslations.ts) are never used for substitution inside longer text.
 * 5. Message templates (e.g. an API message with a status) translate only a whole text of exactly the template's
 *    shape, with parameters from a closed list; anything else is left to the rules above.
 */

export type DisplayLang = 'lo' | 'th'
export type Lang = 'en' | DisplayLang

/**
 * A whole-message template with parameters from a closed list, e.g. "… while the account is {status}." It matches
 * only when the ENTIRE text has this shape and every parameter is one of the listed values (rule 5), so it can
 * never translate part of another sentence.
 */
export interface MessageTemplate {
  en: string
  lo: string
  th: string
  /** Allowed English values per parameter, with their Lao and Thai wording. */
  params: Record<string, Record<string, { lo: string; th: string }>>
}

export interface TranslationSource {
  /** Shared dictionaries: whole-text and substring use (rules 1–3). */
  fromEnglish: Record<DisplayLang, Record<string, string>>
  /** Exact-only dictionaries: whole-text use only (rules 1 and 4). */
  exactOnly: Record<DisplayLang, Record<string, string>>
  /** Whole-message templates with closed-list parameters (rule 5). */
  templates?: readonly MessageTemplate[]
}

type TemplateLang = 'en' | DisplayLang

interface CompiledTemplate {
  patterns: Record<TemplateLang, RegExp>
  template: MessageTemplate
  /** Parameter value in one language -> the same value in every language. */
  values: Record<string, Record<TemplateLang, Record<string, Record<TemplateLang, string>>>>
}

function compileTemplate(template: MessageTemplate): CompiledTemplate {
  const langs: TemplateLang[] = ['en', 'lo', 'th']
  const values = {} as CompiledTemplate['values']
  for (const [name, options] of Object.entries(template.params)) {
    values[name] = { en: {}, lo: {}, th: {} }
    for (const [english, local] of Object.entries(options)) {
      const all = { en: english, lo: local.lo, th: local.th }
      for (const lang of langs) values[name]![lang][all[lang]] = all
    }
  }
  const patterns = Object.fromEntries(
    langs.map(lang => {
      const source = escapeRegExp(template[lang]).replace(/\\\{([a-z]+)\\\}/g, (_, name: string) => {
        const alternatives = Object.keys(values[name]?.[lang] ?? {}).sort((a, b) => b.length - a.length).map(escapeRegExp)
        return `(?<${name}>${alternatives.join('|')})`
      })
      return [lang, new RegExp(`^${source}$`)]
    }),
  ) as Record<TemplateLang, RegExp>
  return { patterns, template, values }
}

/** Renders `to` from a whole-text match in `from`, or returns null when the text is not exactly this template. */
function renderTemplate(compiled: CompiledTemplate, text: string, from: TemplateLang, to: TemplateLang): string | null {
  const match = compiled.patterns[from].exec(text)
  if (!match) return null
  return compiled.template[to].replace(/\{([a-z]+)\}/g, (_, name: string) => compiled.values[name]![from][match.groups![name]!]![to])
}

/** Letters plus the straight and typographic apostrophe (U+2019). */
const WORD = "[A-Za-z][A-Za-z'’]*"
const SINGLE_WORD = new RegExp(`^${WORD}$`)
const WORDS = new RegExp(WORD, 'g')

/** A dictionary key that is one English word (guarded by rule 3). */
export function isSingleWordKey(key: string): boolean {
  return SINGLE_WORD.test(key)
}

type Entries = [string, string][]

const byLength = (entries: Entries) => [...entries].sort((a, b) => b[0].length - a[0].length)

function invert(dict: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [english, local] of Object.entries(dict)) if (!(local in out)) out[local] = english
  return out
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function applyEntries(value: string, entries: Entries): string {
  let result = value
  for (const [from, to] of entries) {
    if (from.length < 2 || !result.includes(from)) continue
    if (/[A-Za-z]/.test(from)) {
      const pattern = new RegExp(`(^|[^A-Za-z])${escapeRegExp(from)}(?=$|[^A-Za-z])`, 'g')
      result = result.replace(pattern, (_, prefix: string) => `${prefix}${to}`)
    } else {
      result = result.split(from).join(to)
    }
  }
  return result
}

/**
 * True when every Latin-letter word left in `text` is a single-word key or a code in capitals. `{placeholder}`
 * tokens (filled in later, e.g. "Subtotal ({code})") are not words of the sentence.
 */
function onlySingleWordKeysRemain(text: string, singleWords: ReadonlySet<string>): boolean {
  for (const word of text.replace(/\{[^{}]*\}/g, ' ').match(WORDS) ?? []) {
    if (singleWords.has(word)) continue
    if (/^[A-Z]{2,}$/.test(word)) continue
    return false
  }
  return true
}

interface PreparedLang {
  phrases: Entries
  single: Entries
  singleWords: Set<string>
  reverse: Record<string, string>
  reverseExact: Record<string, string>
  reverseEntries: Entries
}

export function createTranslator(source: TranslationSource) {
  const prepare = (lang: DisplayLang): PreparedLang => {
    const all = Object.entries(source.fromEnglish[lang])
    const single = byLength(all.filter(([key]) => isSingleWordKey(key)))
    const reverse = invert(source.fromEnglish[lang])
    return {
      phrases: byLength(all.filter(([key]) => !isSingleWordKey(key))),
      single,
      singleWords: new Set(single.map(([key]) => key)),
      reverse,
      reverseExact: invert(source.exactOnly[lang]),
      reverseEntries: byLength(Object.entries(reverse)),
    }
  }
  const prepared: Record<DisplayLang, PreparedLang> = { lo: prepare('lo'), th: prepare('th') }
  const templates = (source.templates ?? []).map(compileTemplate)

  /** Canonical English for text shown in any language (used when switching languages). */
  function toEnglish(value: string): string {
    const trimmed = value.trim()
    const direct =
      prepared.lo.reverse[trimmed] ?? prepared.th.reverse[trimmed] ?? prepared.lo.reverseExact[trimmed] ?? prepared.th.reverseExact[trimmed]
    if (direct) return value.replace(trimmed, direct)
    for (const compiled of templates) {
      const english = renderTemplate(compiled, trimmed, 'lo', 'en') ?? renderTemplate(compiled, trimmed, 'th', 'en')
      if (english) return value.replace(trimmed, english)
    }
    return applyEntries(applyEntries(value, prepared.lo.reverseEntries), prepared.th.reverseEntries)
  }

  function translate(value: string, lang: Lang): string {
    if (!value.trim()) return value
    if (lang === 'en') return toEnglish(value)
    const trimmed = value.trim()
    const direct = source.fromEnglish[lang][trimmed] ?? source.exactOnly[lang][trimmed]
    if (direct) return value.replace(trimmed, direct)
    for (const compiled of templates) {
      const rendered = renderTemplate(compiled, trimmed, 'en', lang)
      if (rendered) return value.replace(trimmed, rendered)
    }
    const table = prepared[lang]
    const withPhrases = applyEntries(value, table.phrases)
    return onlySingleWordKeysRemain(withPhrases, table.singleWords) ? applyEntries(withPhrases, table.single) : withPhrases
  }

  return { translate }
}
