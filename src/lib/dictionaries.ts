import { translations } from '../i18n'
import { legacyLao } from '../legacyTranslations'
import { thDictionary } from '../thTranslations'

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
