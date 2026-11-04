import { describe, expect, it } from 'vitest'
import type { RFQItem } from '../../store'
import { applyRfqVariant, lineNeedsVariant, quotableVariants } from '../rfqLines'
import type { ProductVariant, VariantProductLike } from '../variants'

const variant = (id: string, size: string, extra: Partial<ProductVariant> = {}): ProductVariant => ({
  id, sku: id, options: { Size: size }, stock: 0, active: true, visible: true, purchasable: true, ...extra,
})

const helmet: VariantProductLike & { id: number } = {
  id: 5,
  price: 45,
  stock: 0,
  options: [{ name: 'Size', values: ['S', 'M', 'L', 'XL'] }],
  variants: [variant('H-S', 'S'), variant('H-M', 'M', { purchasable: false }), variant('H-L', 'L', { active: false }), variant('H-XL', 'XL', { visible: false })],
}
const cable: VariantProductLike & { id: number } = { id: 6, price: 185, stock: 10 }
const products = [helmet, cable]

const line = (id: number, qty: number, extra: Partial<RFQItem> = {}): RFQItem => ({ id, name: `P${id}`, sku: `SKU-${id}`, img: '', category: 'C', qty, ...extra })

describe('lineNeedsVariant', () => {
  it('flags only variant products without a chosen variant', () => {
    expect(lineNeedsVariant(line(5, 3), products)).toBe(true)
    expect(lineNeedsVariant(line(5, 3, { variantId: 'H-S' }), products)).toBe(false)
    // Products without variants never need one.
    expect(lineNeedsVariant(line(6, 2), products)).toBe(false)
    // Unknown products are kept as they are.
    expect(lineNeedsVariant(line(99, 1), products)).toBe(false)
  })
})

describe('quotableVariants', () => {
  it('offers active and visible variants, whatever the stock or purchasable flag', () => {
    expect(quotableVariants(helmet).map(v => v.id)).toEqual(['H-S', 'H-M'])
  })
})

describe('applyRfqVariant', () => {
  it('sets the variant on the variant-less line, keeping product, quantity and position', () => {
    const items = [line(6, 2), line(5, 7), line(1, 1, { variantId: 'X' })]
    const next = applyRfqVariant(items, 5, helmet, variant('H-M', 'M'), 7)
    expect(next.map(r => `${r.id}:${r.variantId ?? '-'}:${r.qty}`)).toEqual(['6:-:2', '5:H-M:7', '1:X:1'])
    expect(next[1]).toMatchObject({ name: 'P5', sku: 'H-M', variantLabel: 'Size: M' })
  })

  it('adds the quantity to an existing line for the same variant instead of duplicating it', () => {
    const items = [line(5, 4, { variantId: 'H-S', sku: 'H-S', variantLabel: 'Size: S' }), line(5, 3)]
    const next = applyRfqVariant(items, 5, helmet, variant('H-S', 'S'), 3)
    expect(next).toHaveLength(1)
    expect(next[0]).toMatchObject({ variantId: 'H-S', qty: 7 })
  })

  it('changes nothing when there is no variant-less line', () => {
    const items = [line(5, 4, { variantId: 'H-S' })]
    expect(applyRfqVariant(items, 5, helmet, variant('H-M', 'M'), 4)).toBe(items)
  })
})
