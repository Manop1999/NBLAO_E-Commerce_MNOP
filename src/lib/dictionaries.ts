import { translations } from '../i18n'
import { legacyLao } from '../legacyTranslations'
import { thDictionary } from '../thTranslations'
import { authExactTranslations, authMessageTemplates } from '../authTranslations'
import type { MessageTemplate } from './translateText'

/** Whole-message templates with closed-list parameters; see translateText.ts rule 5. */
export const messageTemplates: readonly MessageTemplate[] = authMessageTemplates

const keyedLao: Record<string, string> = {}

function collectPairs(en: unknown, lo: unknown) {
  if (typeof en === 'string' && typeof lo === 'string') {
    keyedLao[en] = lo
    return
  }
  if (!en || !lo || typeof en !== 'object' || typeof lo !== 'object') return
  for (const key of Object.keys(en)) {
    collectPairs((en as Record<string, unknown>)[key], (lo as Record<string, unknown>)[key])
  }
}

collectPairs(translations.en, translations.lo)

/** Canonical English text -> display text, per non-English language. */
export const fromEnglish: Record<'lo' | 'th', Record<string, string>> = {
  lo: { ...legacyLao, ...keyedLao },
  th: { ...thDictionary },
}

/** Whole-text-only translations (never substituted inside longer text); see src/authTranslations.ts. */
export const exactOnly: Record<'lo' | 'th', Record<string, string>> = {
  lo: Object.fromEntries(Object.entries(authExactTranslations).map(([en, value]) => [en, value.lo])),
  th: Object.fromEntries(Object.entries(authExactTranslations).map(([en, value]) => [en, value.th])),
}
