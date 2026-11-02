import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { fromEnglish } from '../dictionaries'

// Prototype notices shown on public pages. Each must appear in its page and have Lao and Thai text,
// because GlobalLanguage translates them by exact English match.
const NOTICES: [page: string, text: string][] = [
  ['components/DemoBanner.tsx', 'Demo website: products, prices and stock are sample data. Orders and quote requests are not sent to NB LAO.'],
  ['pages/Login.tsx', 'Prototype sign-in: accounts and data are stored only in this browser.'],
  ['pages/AdminLogin.tsx', 'Prototype admin: changes are stored only in this browser.'],
  ['pages/Register.tsx', 'Demo registration only: accounts are not stored on the NB LAO server, and demo account data is not kept permanently.'],
  ['pages/ForgotPassword.tsx', 'Prototype: password reset is not available. No reset email is sent.'],
]

const source = (page: string) => readFileSync(new URL(`../../${page}`, import.meta.url), 'utf8')

describe('prototype notices', () => {
  it.each(NOTICES)('%s shows its notice', (page, text) => {
    expect(source(page)).toContain(text)
  })
  it.each(NOTICES)('%s notice is translated to Lao and Thai', (_page, text) => {
    expect(fromEnglish.lo[text]).toBeTruthy()
    expect(fromEnglish.th[text]).toBeTruthy()
  })
  it('register notice no longer claims accounts vanish on reload', () => {
    expect(source('pages/Register.tsx')).not.toContain('lost when the page reloads')
  })
  it('forgot-password notice is shown before the form is submitted', () => {
    const page = source('pages/ForgotPassword.tsx')
    const notice = page.indexOf('No reset email is sent.')
    const formStart = page.indexOf('<form onSubmit={handleSubmit}')
    const submittedBranch = page.indexOf('{submitted ? (')
    const formBranch = page.indexOf(') : (', submittedBranch)
    expect(notice).toBeGreaterThan(formBranch)
    expect(notice).toBeLessThan(formStart)
  })
})
