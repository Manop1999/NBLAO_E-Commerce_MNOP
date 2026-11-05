import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { authExactTranslations, authMessageTemplates } from '../../authTranslations'
import { exactOnly, fromEnglish, messageTemplates } from '../dictionaries'
import { CUSTOMER_STATUS_PHRASES, INVALID_STATUS_TEMPLATE, invalidStatusMessage, type CustomerStatusName } from '../../../server/src/auth/customerStatusText'
import { createTranslator, isSingleWordKey } from '../translateText'

const { translate } = createTranslator({ fromEnglish, exactOnly, templates: messageTemplates })
const LANGS = ['lo', 'th'] as const

describe('display translation: short words never leak into unrelated English text', () => {
  // Sentences without their own translation that contain words which are dictionary or Phase 1E keys.
  const sentences = [
    'All products are ready for dispatch today',
    'Our team will contact you next week',
    'Done means the work is finished and approved',
    'Next generation pumps arrive soon',
    'Show 24 per page',
    'Assign a reason and refresh the list when you are done',
    'Please wait while customers are invited to the active team',
    'The Teamwork and Allocation reports are Done-ready',
  ]

  it('leaves untranslated sentences in clean English in every language', () => {
    for (const sentence of sentences) {
      for (const lang of LANGS) expect(translate(sentence, lang), `${lang}: ${sentence}`).toBe(sentence)
      expect(translate(sentence, 'en')).toBe(sentence)
    }
  })

  it('does not touch longer words that merely contain a key ("Teamwork", "Allocation", "Nextcloud")', () => {
    for (const lang of LANGS) {
      for (const word of ['Teamwork', 'Allocation', 'Nextcloud', 'Undone', 'Activeness']) expect(translate(word, lang)).toBe(word)
    }
  })

  it('still translates the short labels themselves as whole texts', () => {
    expect(translate('Team', 'lo')).toBe(authExactTranslations.Team!.lo)
    expect(translate('Team', 'th')).toBe(authExactTranslations.Team!.th)
    expect(translate('Done', 'th')).toBe(authExactTranslations.Done!.th)
    expect(translate('  Assign  ', 'lo')).toBe(`  ${authExactTranslations.Assign!.lo}  `)
    // Existing shared translations win over the exact-only table (behaviour preserved).
    expect(translate('All', 'th')).toBe(fromEnglish.th.All)
    expect(translate('Next', 'th')).toBe(fromEnglish.th.Next)
  })

  it('keeps translating texts made only of known words, as before', () => {
    expect(translate('12 items', 'th')).toBe(`12 ${fromEnglish.th.items}`)
    expect(translate('Subtotal ({code})', 'th')).not.toContain('Subtotal')
    expect(translate('Subtotal ({code})', 'th')).toContain('{code}')
  })

  it('never substitutes Phase 1E (exact-only) keys inside longer text', () => {
    const exactKeys = Object.keys(authExactTranslations).filter(key => !(key in fromEnglish.th) && isSingleWordKey(key))
    expect(exactKeys.length).toBeGreaterThan(10)
    for (const key of exactKeys) {
      const sentence = `Click ${key} before the deadline`
      for (const lang of LANGS) expect(translate(sentence, lang), `${lang}: ${sentence}`).toBe(sentence)
    }
  })

  it('round-trips every Phase 1E label back to the same English text (no clash with existing translations)', () => {
    // Same meaning, different wording of an older translation: acceptable when switching back to English.
    const synonyms: Record<string, string[]> = { Reject: ['decline'] }
    const clashes: string[] = []
    for (const [english, local] of Object.entries(authExactTranslations)) {
      for (const lang of LANGS) {
        if (fromEnglish[lang][english] !== undefined) continue // an existing translation is used; nothing new to check
        const back = translate(local[lang], 'en').toLowerCase()
        if (back !== english.toLowerCase() && !(synonyms[english] ?? []).includes(back)) clashes.push(`${lang}: "${english}" -> "${local[lang]}" -> "${back}"`)
      }
    }
    expect(clashes).toEqual([])
  })

  it('uses the existing wording for concepts the app already translates (one term per concept)', () => {
    // Phase 1E screens reuse these existing labels instead of adding near-duplicates with other casing.
    for (const key of ['Current Password', 'New Password', 'Confirm New Password', 'First Name', 'Last Name', 'Sign Out']) {
      for (const lang of LANGS) expect(translate(key, lang), `${lang}: ${key}`).not.toBe(key)
    }
    const nearDuplicates = Object.keys(authExactTranslations).filter(key =>
      LANGS.some(lang => Object.keys(fromEnglish[lang]).some(existing => existing !== key && existing.toLowerCase() === key.toLowerCase())),
    )
    expect(nearDuplicates).toEqual([])
  })

  it('translates every message the authentication API can show to a person (EN/LO/TH)', () => {
    // Collect the message of every `new ApiError(status, 'code', 'message')` in server/src (also template literals
    // using the privileged namespace suffix), plus the server's generic envelopes.
    const serverDir = new URL('../../../server/src/', import.meta.url)
    const files = ['errors.ts', ...readdirSync(new URL('auth/', serverDir)).filter(name => name.endsWith('.ts')).map(name => `auth/${name}`)]
    const messages = new Set<string>()
    for (const file of files) {
      const text = readFileSync(new URL(file, serverDir), 'utf8')
      for (const match of text.matchAll(/new ApiError\(\s*\d{3},\s*'[a-z_]+',\s*(?:'([^'\\]*)'|`([^`]*)`)/g)) {
        const message = (match[1] ?? match[2] ?? '').replace(/\$\{PRIVILEGED_EMAIL_SUFFIX\}/g, '@admin.nblao.invalid')
        if (!message.includes('${')) messages.add(message) // messages with other runtime values are not translatable whole
      }
      for (const match of text.matchAll(/message: '([^'\\]+)'/g)) messages.add(match[1]!)
    }
    expect(messages.size).toBeGreaterThan(40)
    const missing: string[] = []
    for (const message of messages) {
      for (const lang of LANGS) if (translate(message, lang) === message) missing.push(`${lang}: ${message}`)
    }
    expect(missing).toEqual([])
  })

  it('translates the runtime account-status message for every status through a template (EN/LO/TH)', () => {
    const template = authMessageTemplates[0]!
    // Same wording and the same closed list of status phrases as the server.
    expect(template.en).toBe(INVALID_STATUS_TEMPLATE)
    expect(Object.keys(template.params.status!).sort()).toEqual(Object.values(CUSTOMER_STATUS_PHRASES).sort())
    const statuses = Object.keys(CUSTOMER_STATUS_PHRASES) as CustomerStatusName[]
    expect(statuses).toEqual(['INVITED', 'PENDING', 'ACTIVE', 'REJECTED', 'SUSPENDED'])
    const rendered = new Set<string>()
    for (const status of statuses) {
      const message = invalidStatusMessage(status)
      const phrase = template.params.status![CUSTOMER_STATUS_PHRASES[status]]!
      expect(translate(message, 'en'), status).toBe(message)
      for (const lang of LANGS) {
        const expected = template[lang].replace('{status}', phrase[lang])
        expect(translate(message, lang), `${lang} ${status}`).toBe(expected)
        expect(translate(`  ${message} `, lang)).toBe(`  ${expected} `) // surrounding whitespace kept
        expect(expected).not.toMatch(/[A-Za-z]/) // fully translated, no English words left
        expect(translate(expected, 'en'), `${lang} ${status} back to English`).toBe(message)
        rendered.add(expected)
      }
    }
    expect(rendered.size).toBe(statuses.length * LANGS.length) // every status reads differently
  })

  it('never applies the status template to anything but the whole, exact message', () => {
    const notTemplates = [
      'This action is not possible while the account is archived.', // not one of the statuses
      'This action is not possible while the account is ACTIVE.', // raw code instead of the phrase
      'this action is not possible while the account is active.', // different case
      'This action is not possible while the account is active', // missing full stop
      'Note: This action is not possible while the account is active.', // inside a longer text
      'This action is not possible while the account is active. Contact NB LAO.',
      'This action is not possible while the account is active or suspended.',
    ]
    const plain = createTranslator({ fromEnglish, exactOnly }).translate
    for (const text of notTemplates) {
      for (const lang of LANGS) expect(translate(text, lang), `${lang}: ${text}`).toBe(plain(text, lang))
    }
    // The status words alone are not translated by the template either.
    for (const word of Object.values(CUSTOMER_STATUS_PHRASES)) {
      for (const lang of LANGS) expect(translate(word, lang)).toBe(plain(word, lang))
    }
  })

  it('has a Lao and a Thai translation for every Phase 1E entry', () => {
    for (const [english, local] of Object.entries(authExactTranslations)) {
      expect(local.lo.trim(), english).not.toBe('')
      expect(local.th.trim(), english).not.toBe('')
      expect(local.lo, english).not.toBe(english)
    }
  })
})
