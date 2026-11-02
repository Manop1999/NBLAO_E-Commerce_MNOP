// Checks the production document shell after `pnpm build`: the site title and social meta from
// .figma/make/site.json were applied, no Figma Make placeholder or default title survived, and the
// GitHub Pages SPA fallback (404.html) matches index.html. Usage: node scripts/verify-build-output.mjs [distDir]
import { readFileSync } from 'node:fs'
import path from 'node:path'

const dist = path.resolve(process.argv[2] ?? 'dist')
const site = JSON.parse(readFileSync(new URL('../.figma/make/site.json', import.meta.url), 'utf8'))
const html = readFileSync(path.join(dist, 'index.html'), 'utf8')
const fallback = readFileSync(path.join(dist, '404.html'), 'utf8')

const decode = (value) =>
  value.replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
const metaContent = (attr, name) => {
  const tag = html.match(new RegExp(`<meta[^>]*\\b${attr}="${name}"[^>]*>`))?.[0]
  const content = tag?.match(/\bcontent="([^"]*)"/)?.[1]
  return content === undefined ? undefined : decode(content)
}

const failures = []
const expectEqual = (label, actual, expected) => {
  if (actual !== expected) failures.push(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
}

const title = html.match(/<title>([^<]*)<\/title>/)?.[1]
expectEqual('<title>', title === undefined ? undefined : decode(title), site.title)
expectEqual('meta description', metaContent('name', 'description'), site.description)
expectEqual('og:title', metaContent('property', 'og:title'), site.title)
expectEqual('og:description', metaContent('property', 'og:description'), site.description)
if (!site.title || /figma/i.test(site.title)) failures.push('site.json title is missing or still mentions Figma')
if (/Figma Make App/i.test(html)) failures.push('index.html still contains "Figma Make App"')
if (/<!--\s*figma:/.test(html)) failures.push('index.html still contains an unresolved figma: placeholder')
if (fallback !== html) failures.push('404.html differs from index.html (GitHub Pages SPA fallback)')

if (failures.length) {
  console.error(`Build output check failed (${dist}):\n- ${failures.join('\n- ')}`)
  process.exit(1)
}
console.log(`Build output OK: "${site.title}"`)
