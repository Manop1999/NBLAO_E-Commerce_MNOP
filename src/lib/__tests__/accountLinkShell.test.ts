import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { describe, expect, it } from 'vitest'

// The inline script in index.html that removes an account-link token from the address bar before anything loads.
const html = readFileSync(new URL('../../../index.html', import.meta.url), 'utf8')
const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1] ?? ''

function run(pathname: string, hash: string) {
  const replaced: string[] = []
  const appended: { name: string; content: string }[] = []
  const window: Record<string, unknown> = {}
  const sandbox = {
    window,
    location: { pathname, hash, search: '' },
    history: { state: null, replaceState: (_state: unknown, _title: string, url: string) => replaced.push(url) },
    document: { createElement: () => ({ name: '', content: '' }), head: { appendChild: (node: { name: string; content: string }) => appended.push(node) } },
  }
  runInNewContext(script, sandbox)
  return { replaced, appended, token: window.__nblaoAccountLinkToken as string | undefined }
}

describe('account-link shell script (index.html)', () => {
  it('runs before the app and moves the token out of the address bar into memory, with no Referer', () => {
    expect(script).toContain('__nblaoAccountLinkToken')
    expect(html.indexOf(script)).toBeLessThan(html.indexOf('type="module"'))
    const result = run('/NBLAO_E-Commerce_MNOP/account/set-password', '#AbC_123-token')
    expect(result.token).toBe('AbC_123-token')
    expect(result.replaced).toEqual(['/NBLAO_E-Commerce_MNOP/account/set-password'])
    expect(result.appended).toEqual([{ name: 'referrer', content: 'no-referrer' }])
  })

  it('never stores the token in browser storage', () => {
    expect(script).not.toMatch(/localStorage|sessionStorage|document\.cookie/)
  })

  it('does nothing on other pages', () => {
    for (const path of ['/NBLAO_E-Commerce_MNOP/', '/NBLAO_E-Commerce_MNOP/account', '/NBLAO_E-Commerce_MNOP/products']) {
      const result = run(path, '#section')
      expect(result).toEqual({ replaced: [], appended: [], token: undefined })
    }
  })
})
