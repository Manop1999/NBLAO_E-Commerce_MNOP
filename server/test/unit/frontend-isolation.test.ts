import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * Proves that files in server/ cannot change the frontend's generated CSS.
 *
 * It does not just look for the `@source not` line: it compiles the real src/index.css with the installed
 * tailwindcss, builds the scanner sources exactly like @tailwindcss/vite does when the CSS has no source()
 * (`{ base: <vite root>, pattern: "**\/*" }` plus the compiler's @source entries), and runs Tailwind's own
 * oxide Scanner over the repository.
 *
 * Sentinel token (must never reach frontend CSS candidates): nblao-server-isolation-sentinel
 */

const SENTINEL = 'nblao-server-isolation-sentinel'
const repoRoot = fileURLToPath(new URL('../../../', import.meta.url))
const thisFile = fileURLToPath(import.meta.url)

// Resolve Tailwind exactly as the frontend build does: through the root's @tailwindcss/vite dependency.
const rootRequire = createRequire(path.join(repoRoot, 'package.json'))
const viteRequire = createRequire(rootRequire.resolve('@tailwindcss/vite'))
const tailwind = viteRequire('tailwindcss') as {
  compile(
    css: string,
    options: { base: string; loadStylesheet: (id: string, base: string) => Promise<{ path: string; base: string; content: string }> },
  ): Promise<{ root: null | 'none' | { base: string; pattern: string }; sources: { base: string; pattern: string; negated: boolean }[] }>
}
const { Scanner } = viteRequire('@tailwindcss/oxide') as {
  Scanner: new (options: { sources: { base: string; pattern: string; negated: boolean }[] }) => { scan(): string[]; files: string[] }
}

const relative = (file: string) => path.relative(repoRoot, file).split(path.sep).join('/')

async function compileFrontendCss() {
  // The remote Google Fonts @import url(...) is irrelevant to source scanning, so it is removed for the in-memory compile.
  const css = fs.readFileSync(path.join(repoRoot, 'src', 'index.css'), 'utf8').replace(/@import url\([^)]*\);?/g, '')
  return tailwind.compile(css, {
    base: path.join(repoRoot, 'src'),
    loadStylesheet: async (id, base) => {
      const file = id === 'tailwindcss' ? viteRequire.resolve('tailwindcss/index.css') : viteRequire.resolve(id, { paths: [base] })
      return { path: file, base: path.dirname(file), content: fs.readFileSync(file, 'utf8') }
    },
  })
}

function scan(sources: { base: string; pattern: string; negated: boolean }[]) {
  const scanner = new Scanner({ sources })
  const candidates = new Set(scanner.scan())
  return { candidates, files: scanner.files.map(relative) }
}

describe('frontend CSS isolation of server/', () => {
  it('control: without a boundary, Tailwind would scan server/ (so the real check below is meaningful)', () => {
    const unbounded = scan([{ base: repoRoot, pattern: '**/*', negated: false }])
    expect(unbounded.files).toContain(relative(thisFile))
    expect(unbounded.candidates.has(SENTINEL)).toBe(true)
  })

  it('with the real src/index.css, no server/ file is scanned and the sentinel never reaches the CSS', async () => {
    const compiler = await compileFrontendCss()

    // Same source list as @tailwindcss/vite 4.2.x: auto-detection from the Vite root when root === null.
    expect(compiler.root).toBeNull()
    const sources = [{ base: repoRoot, pattern: '**/*', negated: false }, ...compiler.sources]

    // The boundary comes from the CSS itself, not from this test.
    expect(compiler.sources.some(s => s.negated && path.resolve(s.base, s.pattern) === path.resolve(repoRoot, 'server'))).toBe(true)

    const bounded = scan(sources)
    expect(bounded.files.some(f => f.startsWith('src/'))).toBe(true)
    expect(bounded.files.filter(f => f.startsWith('server/'))).toEqual([])
    expect(bounded.candidates.has(SENTINEL)).toBe(false)
  })
})
