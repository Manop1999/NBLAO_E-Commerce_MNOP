import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { assetUrl, PUBLIC_ENTRIES } from '../assetUrl'

const BASE = '/NBLAO_E-Commerce_MNOP/'

describe('assetUrl', () => {
  it('prefixes root-relative public paths with the GitHub Pages base', () => {
    expect(assetUrl('/site-images/c323e3f37dfd.jpg', BASE)).toBe('/NBLAO_E-Commerce_MNOP/site-images/c323e3f37dfd.jpg')
    expect(assetUrl('/products/product-14.png', BASE)).toBe('/NBLAO_E-Commerce_MNOP/products/product-14.png')
    expect(assetUrl('brands/abb.svg', BASE)).toBe('/NBLAO_E-Commerce_MNOP/brands/abb.svg')
  })

  it('does not double-prefix paths that already include the base', () => {
    expect(assetUrl('/NBLAO_E-Commerce_MNOP/nb-lao-logo.png', BASE)).toBe('/NBLAO_E-Commerce_MNOP/nb-lao-logo.png')
  })

  it('leaves absolute, data and blob URLs unchanged', () => {
    expect(assetUrl('https://example.com/a.jpg', BASE)).toBe('https://example.com/a.jpg')
    expect(assetUrl('data:image/png;base64,AAAA', BASE)).toBe('data:image/png;base64,AAAA')
    expect(assetUrl('blob:https://example.com/123', BASE)).toBe('blob:https://example.com/123')
    expect(assetUrl('//cdn.example.com/a.jpg', BASE)).toBe('//cdn.example.com/a.jpg')
  })

  it('keeps root paths working when the base is "/"', () => {
    expect(assetUrl('/product-placeholder.svg', '/')).toBe('/product-placeholder.svg')
  })

  it('returns an empty string for missing values', () => {
    expect(assetUrl('', BASE)).toBe('')
    expect(assetUrl(undefined, BASE)).toBe('')
  })

  // Values written to the shared manop1999.github.io localStorage by the nblao-ecommerce-preview deployment.
  // Before the fix these resolved to /NBLAO_E-Commerce_MNOP/nblao-ecommerce-preview/... and returned 404.
  it('resolves paths saved by another deployment on the same origin to our own public assets', () => {
    expect(assetUrl('/nblao-ecommerce-preview/products/product-01.jpg', BASE)).toBe('/NBLAO_E-Commerce_MNOP/products/product-01.jpg')
    expect(assetUrl('/nblao-ecommerce-preview/brands/siemens.svg', BASE)).toBe('/NBLAO_E-Commerce_MNOP/brands/siemens.svg')
    expect(assetUrl('/nblao-ecommerce-preview/site-images/345e73efccf1.jpg', BASE)).toBe('/NBLAO_E-Commerce_MNOP/site-images/345e73efccf1.jpg')
    expect(assetUrl('/nblao-ecommerce-preview/advertisements/test001.png', BASE)).toBe('/NBLAO_E-Commerce_MNOP/advertisements/test001.png')
    expect(assetUrl('/nblao-ecommerce-preview/nb-lao-logo.png', BASE)).toBe('/NBLAO_E-Commerce_MNOP/nb-lao-logo.png')
    expect(assetUrl('/nblao-ecommerce-preview/product-placeholder.svg', BASE)).toBe('/NBLAO_E-Commerce_MNOP/product-placeholder.svg')
    expect(assetUrl('/nblao-ecommerce-preview/products/product-01.jpg', '/')).toBe('/products/product-01.jpg')
  })

  it('leaves our own root-relative paths and unrelated nested paths alone', () => {
    expect(assetUrl('/products/product-01.jpg', BASE)).toBe('/NBLAO_E-Commerce_MNOP/products/product-01.jpg')
    expect(assetUrl('/site-images/c323e3f37dfd.jpg', BASE)).toBe('/NBLAO_E-Commerce_MNOP/site-images/c323e3f37dfd.jpg')
    expect(assetUrl('/NBLAO_E-Commerce_MNOP/brands/abb.svg', BASE)).toBe('/NBLAO_E-Commerce_MNOP/brands/abb.svg')
    // Only confirmed foreign deployment bases are stripped, never an arbitrary leading folder.
    expect(assetUrl('/uploads/products/x.jpg', BASE)).toBe('/NBLAO_E-Commerce_MNOP/uploads/products/x.jpg')
    expect(assetUrl('/NBLAO-E-Commerce/brands/abb.svg', BASE)).toBe('/NBLAO_E-Commerce_MNOP/NBLAO-E-Commerce/brands/abb.svg')
    expect(assetUrl('/nblao-ecommerce-preview-old/products/x.jpg', BASE)).toBe('/NBLAO_E-Commerce_MNOP/nblao-ecommerce-preview-old/products/x.jpg')
    expect(assetUrl('/nblao-ecommerce-preview/uploads/x.jpg', BASE)).toBe('/NBLAO_E-Commerce_MNOP/nblao-ecommerce-preview/uploads/x.jpg')
    expect(assetUrl('/some/other/file.jpg', BASE)).toBe('/NBLAO_E-Commerce_MNOP/some/other/file.jpg')
    expect(assetUrl('https://manop1999.github.io/nblao-ecommerce-preview/products/product-01.jpg', BASE)).toBe(
      'https://manop1999.github.io/nblao-ecommerce-preview/products/product-01.jpg',
    )
  })

  it('keeps PUBLIC_ENTRIES in sync with the public/ folder', () => {
    const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
    expect([...PUBLIC_ENTRIES].sort()).toEqual(readdirSync(join(root, 'public')).sort())
  })
})

// --- Static source audit -------------------------------------------------------------------
// Every image a component renders must go through assetUrl(); otherwise a root-relative public
// path (e.g. `/site-images/x.jpg`, possibly stored in a data array) resolves to the domain root on
// GitHub Pages instead of /NBLAO_E-Commerce_MNOP/.

const IMAGE_EXT = 'png|jpe?g|svg|webp|gif|avif|ico'
const ABSOLUTE_URL = /^(?:[a-z][a-z\d+.-]*:|\/\/)/i

/** Values known to never be public paths (canvas data URLs / blob URLs), keyed by expression. */
const SAFE_SRC_EXPRESSIONS = new Set(['m.dataUrl'])
/** `.src =` right-hand sides known to be blob/data URLs, keyed by `file: expression`. */
const SAFE_SRC_ASSIGNMENTS = new Set(['src/lib/imageUpload.ts: url'])

/** Blank out comments while keeping line numbers, so documentation examples are not treated as code. */
function stripComments(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, comment => comment.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:\w'"`\\])\/\/.*$/gm, '$1')
}

const lineOf = (text: string, index: number) => text.slice(0, index).split('\n').length

/** Return the `{...}` expression starting at `open`, honouring nested braces. */
function braceExpression(text: string, open: number): string {
  let depth = 0
  for (let i = open; i < text.length; i++) {
    if (text[i] === '{') depth++
    else if (text[i] === '}' && --depth === 0) return text.slice(open + 1, i).trim()
  }
  return text.slice(open + 1).trim()
}

/** Find image sources that bypass assetUrl(). `text` must already be comment-stripped. */
function findUnresolvedImageSources(file: string, text: string): string[] {
  const offenders: string[] = []
  const report = (index: number, snippet: string) => offenders.push(`${file}:${lineOf(text, index)}: ${snippet.replace(/\s+/g, ' ').slice(0, 80)}`)

  // JSX attributes: src={...}, src="...", srcSet, poster
  for (const match of text.matchAll(/(?<=\s)(?:src|srcSet|poster)=([{"'])/g)) {
    const valueStart = match.index + match[0].length - 1
    if (match[1] === '{') {
      const expression = braceExpression(text, valueStart)
      if (!expression.startsWith('assetUrl(') && !SAFE_SRC_EXPRESSIONS.has(expression)) report(match.index, `${match[0]}${expression}}`)
    } else {
      const value = text.slice(valueStart + 1, text.indexOf(match[1], valueStart + 1))
      if (!ABSOLUTE_URL.test(value)) report(match.index, `${match[0]}${value}${match[1]}`)
    }
  }

  // DOM assignments: img.src = ..., event.currentTarget.src = ...
  for (const match of text.matchAll(/\.src\s*=(?!=)\s*([^\n;}]+)/g)) {
    const expression = match[1].trim()
    if (!expression.startsWith('assetUrl(') && !SAFE_SRC_ASSIGNMENTS.has(`${file}: ${expression}`)) report(match.index, match[0])
  }

  // Inline CSS url(...) in TS/TSX (Vite already rewrites url() in .css files with `base`)
  for (const match of text.matchAll(/\burl\(\s*['"`]?([^'"`)\s]+)/g)) {
    if (!ABSOLUTE_URL.test(match[1])) report(match.index, match[0])
  }

  return offenders
}

describe('static image-source audit helpers', () => {
  const scan = (code: string) => findUnresolvedImageSources('fixture.tsx', stripComments(code))

  it('flags unprefixed local images in every supported form', () => {
    expect(scan('<img src={industry.image} alt="" />')).toHaveLength(1)
    expect(scan('<img src="/site-images/a.jpg" />')).toHaveLength(1)
    expect(scan('<img\n  src={p.img}\n  alt=""\n/>')).toEqual(['fixture.tsx:2: src={p.img}'])
    expect(scan('<img src={p.img || "/product-placeholder.svg"} />')).toHaveLength(1)
    expect(scan('el.src = ad.image')).toHaveLength(1)
    expect(scan('onError={e => { e.currentTarget.src = "/product-placeholder.svg" }}')).toHaveLength(1)
    expect(scan("<div style={{ backgroundImage: 'url(/site-images/a.jpg)' }} />")).toHaveLength(1)
    expect(scan('<video poster={hero} />')).toHaveLength(1)
  })

  it('does not flag resolved, external, data or allow-listed sources, or comments', () => {
    expect(scan('<img src={assetUrl(p.img || "/product-placeholder.svg")} onError={e => { e.currentTarget.src = assetUrl("/x.svg") }} />')).toEqual([])
    expect(scan('<img src="https://cdn.example.com/site-images/a.jpg" />')).toEqual([])
    expect(scan('<img src="data:image/png;base64,AAAA" />')).toEqual([])
    expect(scan('<img src={m.dataUrl} />')).toEqual([])
    expect(scan("<div style={{ backgroundImage: 'url(https://cdn.example.com/a.jpg)' }} />")).toEqual([])
    expect(scan('// <img src="/site-images/a.jpg" />\n/* <img src={industry.image} /> */\n{/* el.src = x */}')).toEqual([])
    expect(scan("const link = 'https://example.com/a' // <img src={x} />")).toEqual([])
  })
})

describe('public image references', () => {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
  const publicDir = join(root, 'public')
  const sourceFiles = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) return entry.name === '__tests__' ? [] : sourceFiles(full)
      return /\.tsx?$/.test(entry.name) ? [full] : []
    })
  const sources = sourceFiles(join(root, 'src')).map(file => ({
    file: relative(root, file).split(sep).join('/'),
    text: stripComments(readFileSync(file, 'utf8')),
  }))

  it('points every literal public image path (including in data arrays/objects) at an existing file with exact casing', () => {
    const escape = (name: string) => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const entries = readdirSync(publicDir, { withFileTypes: true })
    const dirs = entries.filter(entry => entry.isDirectory()).map(entry => escape(entry.name)).join('|')
    // Directory names and extensions match case-insensitively so a wrong-case path is caught by the exact-case check below.
    const literal = new RegExp(`['"\`](\\/?(?:${dirs})\\/[\\w./-]+\\.(?:${IMAGE_EXT})|\\/?[\\w.-]+\\.(?:${IMAGE_EXT}))['"\`]`, 'gi')
    const topLevelFiles = new Set(entries.filter(entry => entry.isFile()).map(entry => entry.name.toLowerCase()))

    const existsExactCase = (path: string) => {
      let dir = publicDir
      for (const segment of path.split('/')) {
        if (!readdirSync(dir).includes(segment)) return false
        dir = join(dir, segment)
      }
      return true
    }

    const missing: string[] = []
    let checked = 0
    for (const { file, text } of sources) {
      for (const match of text.matchAll(literal)) {
        const path = match[1].replace(/^\//, '')
        // A bare file name (no folder, no leading slash) is only a public reference if public/ has such a file.
        if (!path.includes('/') && !match[1].startsWith('/') && !topLevelFiles.has(path.toLowerCase())) continue
        checked++
        if (!existsExactCase(path)) missing.push(`${file}:${lineOf(text, match.index)}: ${path}`)
      }
    }
    expect(checked).toBeGreaterThan(0)
    expect(missing).toEqual([])
  })

  it('routes every rendered image source through assetUrl()', () => {
    const offenders = sources.flatMap(({ file, text }) => findUnresolvedImageSources(file, text))
    expect(offenders).toEqual([])
  })
})
