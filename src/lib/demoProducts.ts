/** Deterministic demonstration defaults for catalogue products. Never overrides data a product already has. */
import type { Product } from '../data'
import type { ProductOption, ProductVariant } from './variants'

interface Template {
  options: ProductOption[]
  /** Configuration that holds the product's real stock first when it cannot be split evenly. */
  base: Record<string, string>
  /** Option combinations that do not exist (shown as unavailable). */
  exclude?: Record<string, string>[]
}

const opt = (name: string, ...values: string[]): ProductOption => ({ name, values })

/** Sample configuration options per bundled SKU. Values are demonstration data, not manufacturer-verified. */
const TEMPLATES: Record<string, Template> = {
  'EE-TRF-001': { options: [opt('Rated Power', '630 kVA', '1,000 kVA', '1,600 kVA'), opt('Cooling', 'ONAN', 'ONAF')], base: { 'Rated Power': '1,000 kVA', Cooling: 'ONAN' }, exclude: [{ 'Rated Power': '630 kVA', Cooling: 'ONAF' }] },
  'IM-CMP-002': { options: [opt('Motor Power', '55 kW', '75 kW', '90 kW'), opt('Working Pressure', '8 bar', '10 bar')], base: { 'Motor Power': '75 kW', 'Working Pressure': '10 bar' } },
  'EE-MCC-003': { options: [opt('Rated Current', '630 A', '1,600 A', '3,200 A'), opt('Protection Degree', 'IP42', 'IP54')], base: { 'Rated Current': '1,600 A', 'Protection Degree': 'IP54' } },
  'IM-ROB-004': { options: [opt('Mounting', 'Floor', 'Ceiling')], base: { Mounting: 'Floor' } },
  'SF-PPE-005': { options: [opt('Colour', 'White', 'Yellow', 'Orange', 'Blue')], base: { Colour: 'White' } },
  'CA-PWR-006': { options: [opt('Conductor Size', '95 mm²', '150 mm²', '185 mm²', '240 mm²'), opt('Cores', '3 Core', '4 Core')], base: { 'Conductor Size': '185 mm²', Cores: '3 Core' }, exclude: [{ 'Conductor Size': '240 mm²', Cores: '4 Core' }] },
  'TE-CLM-007': { options: [opt('Kit', 'Meter + iFlex Probe', 'Meter + iFlex + Carry Case'), opt('Calibration', 'Standard', 'With Calibration Certificate')], base: { Kit: 'Meter + iFlex Probe', Calibration: 'Standard' } },
  'EE-MCB-008': { options: [opt('Rated Current', '250 A', '320 A', '400 A'), opt('Poles', '3P', '4P')], base: { 'Rated Current': '400 A', Poles: '3P' } },
  'IM-PMP-009': { options: [opt('Port Size', '3/4" BSP', '1-1/4" BSP', '1-1/2" BSP'), opt('Mounting', 'SAE A Flange', 'SAE B Flange')], base: { 'Port Size': '1-1/4" BSP', Mounting: 'SAE B Flange' } },
  'SF-FIR-010': { options: [opt('Loops', '2-Loop', '4-Loop'), opt('Enclosure', 'Standard', 'Extended Battery Housing')], base: { Loops: '4-Loop', Enclosure: 'Standard' } },
  'PE-GEN-011': { options: [opt('Enclosure', 'Sound-Attenuated Canopy', 'Open Frame')], base: { Enclosure: 'Sound-Attenuated Canopy' } },
  'TE-DRL-012': { options: [opt('Core Bit Diameter', '82 mm', '152 mm', '250 mm', '500 mm'), opt('Stand', 'Rig Stand', 'Hand-Held Adapter')], base: { 'Core Bit Diameter': '500 mm', Stand: 'Rig Stand' }, exclude: [{ 'Core Bit Diameter': '500 mm', Stand: 'Hand-Held Adapter' }] },
}

const slug = (v: string) => v.replace(/[^A-Za-z0-9]/g, '').toUpperCase()
const matches = (combo: Record<string, string>, rule: Record<string, string>) => Object.entries(rule).every(([k, v]) => combo[k] === v)

function combinations(options: ProductOption[]): Record<string, string>[] {
  return options.reduce<Record<string, string>[]>((acc, o) => acc.flatMap(c => o.values.map(v => ({ ...c, [o.name]: v }))), [{}])
}

/** Splits the product's existing stock across variants so the total is unchanged (no invented inventory). */
export function buildDemoVariants(product: Pick<Product, 'sku' | 'stock'>, t: Template): ProductVariant[] {
  const combos = combinations(t.options).filter(c => !(t.exclude ?? []).some(r => matches(c, r)))
  const ordered = [...combos].sort((a, b) => Number(matches(b, t.base)) - Number(matches(a, t.base)))
  const total = Math.max(0, product.stock)
  const share = Math.floor(total / ordered.length)
  let remainder = total - share * ordered.length
  const stockOf = new Map<Record<string, string>, number>()
  for (const c of ordered) {
    const extra = remainder > 0 ? 1 : 0
    remainder -= extra
    stockOf.set(c, share + extra)
  }
  return combos.map(c => ({
    id: `${product.sku}-${t.options.map(o => slug(c[o.name])).join('-')}`,
    sku: `${product.sku}-${t.options.map(o => slug(c[o.name])).join('-')}`,
    options: c,
    stock: stockOf.get(c) ?? 0,
    active: true,
    visible: true,
    purchasable: true,
  }))
}

export const DEMO_DOCUMENT_TITLES = ['Product Datasheet', 'Installation Manual', 'Compliance Certificate', 'Wiring Diagram']

/** Fills only what is missing. Existing options, variants, images, specs and documents always win. */
export function applyDemoDefaults(product: Product): Product {
  const next: Product = { ...product }
  const template = TEMPLATES[product.sku]
  if (template && !next.options?.length && !next.variants?.length) {
    next.options = template.options.map(o => ({ ...o, values: [...o.values] }))
    next.variants = buildDemoVariants(product, template)
    next.demoOptions = true
  }
  return ensureProductLists(next)
}

/** Guards list fields so a partially filled saved product can never crash a page. */
export function ensureProductLists(product: Product): Product {
  return {
    ...product,
    images: Array.isArray(product.images) ? product.images : [],
    specs: Array.isArray(product.specs) ? product.specs : [],
    applications: Array.isArray(product.applications) ? product.applications : [],
    certifications: Array.isArray(product.certifications) ? product.certifications : [],
    tags: Array.isArray(product.tags) ? product.tags : [],
  }
}
