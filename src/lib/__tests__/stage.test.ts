import { describe, expect, it } from 'vitest'
import { PRODUCTS } from '../../data'
import { fromEnglish } from '../dictionaries'
import { buildSearchIndex, matchesQuery } from '../productSearch'
import { generateMissingVariants, previewCombinations, validateVariants, isObsoleteVariant, type ProductVariant } from '../variants'
import { DEFAULT_CUSTOMER_SERVICE, getWhatsAppUrl, migrateCustomerService, validateCustomerService } from '../../content'

const trf = PRODUCTS[0]
const idx = (q: string) => matchesQuery(buildSearchIndex(trf as never, 'Siemens', [fromEnglish.lo, fromEnglish.th]), q)

describe('multilingual search', () => {
  it('matches English names, partials, whitespace and SKU', () => {
    expect(idx('transformer')).toBe(true)
    expect(idx('  high-volt   power ')).toBe(true)
    expect(idx('EE-TRF-001')).toBe(true)
    expect(idx('eetrf001')).toBe(true)
    expect(idx('siemens')).toBe(true)
    expect(idx('zzzz-nothing')).toBe(false)
  })
  it('matches Lao and Thai only where a stored translation exists', () => {
    const lo = fromEnglish.lo[trf.name]
    const th = fromEnglish.th[trf.name]
    if (lo) expect(idx(lo)).toBe(true)
    if (th) expect(idx(th)).toBe(true)
    expect(Boolean(lo || th)).toBe(true)
  })
})

describe('variant generation', () => {
  const opts = [{ name: 'Voltage', values: ['220V', '380V'] }, { name: 'Color', values: ['Red', 'Blue'] }]
  it('2x2 creates 4, then 3x2 adds only the missing 2 without touching existing', () => {
    const first = generateMissingVariants(opts, [], 'P')
    expect(first).toHaveLength(4)
    const edited: ProductVariant[] = first.map((v, i) => ({ ...v, stock: 10 + i, price: 5 + i }))
    const wider = [{ name: 'Voltage', values: ['220V', '380V', '110V'] }, opts[1]]
    const more = generateMissingVariants(wider, edited, 'P')
    expect(more).toHaveLength(2)
    expect(previewCombinations(wider, [...edited, ...more]).every((c) => c.existing)).toBe(true)
    expect(generateMissingVariants(wider, [...edited, ...more], 'P')).toHaveLength(0)
    expect(validateVariants(wider, [...edited, ...more])).toEqual([])
    expect(edited[0].stock).toBe(10)
  })
  it('flags obsolete variants and avoids SKU collisions', () => {
    const [a] = generateMissingVariants(opts, [], 'P')
    expect(isObsoleteVariant([{ name: 'Voltage', values: ['380V'] }, opts[1]], a)).toBe(a.options.Voltage === '220V')
    const clash = generateMissingVariants(opts, [], 'P', ['p-220v-red'])
    expect(clash.find((v) => v.sku.toLowerCase() === 'p-220v-red')).toBeUndefined()
  })
})

describe('customer service', () => {
  it('migrates only unconfigured/blank values', () => {
    expect(migrateCustomerService({ ...DEFAULT_CUSTOMER_SERVICE, whatsapp: '', phone: '+856 20 5555 6789' }).whatsapp).toBe('+8562052371258')
    const saved = { ...DEFAULT_CUSTOMER_SERVICE, phone: '+1 555 123 4567', whatsapp: '', userConfigured: true }
    expect(migrateCustomerService(saved)).toEqual(saved)
    expect(migrateCustomerService({ ...DEFAULT_CUSTOMER_SERVICE, whatsapp: '+66 81 234 5678' }).whatsapp).toBe('+66 81 234 5678')
  })
  it('builds wa.me links and validates', () => {
    expect(getWhatsAppUrl('+856 20 5237 1258')).toBe('https://wa.me/8562052371258')
    expect(getWhatsAppUrl('abc')).toBe('')
    expect(getWhatsAppUrl('')).toBe('')
    expect(validateCustomerService(DEFAULT_CUSTOMER_SERVICE)).toEqual({})
    expect(validateCustomerService({ ...DEFAULT_CUSTOMER_SERVICE, facebook: 'javascript:alert(1)', email: 'x' })).toHaveProperty('facebook')
    expect(DEFAULT_CUSTOMER_SERVICE.wechat).toBe('')
  })
})
