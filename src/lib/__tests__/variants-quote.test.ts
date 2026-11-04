import { describe, expect, it } from 'vitest'
import { optionValueState, resolveVariant, type ProductVariant, type VariantProductLike } from '../variants'
import { displayStock, getStockStatus, STOCK_STATUS_STYLE } from '../stockStatus'

const variant = (id: string, size: string, extra: Partial<ProductVariant> = {}): ProductVariant => ({
  id, sku: id, options: { Size: size }, stock: 0, active: true, visible: true, purchasable: true, ...extra,
})

const product = (stockKnown: boolean | undefined): VariantProductLike => ({
  price: 10,
  stock: 0,
  ...(stockKnown === undefined ? {} : { stockKnown }),
  options: [{ name: 'Size', values: ['S', 'M', 'L', 'XL'] }],
  variants: [variant('S', 'S'), variant('M', 'M', { purchasable: false }), variant('L', 'L', { active: false }), variant('XL', 'XL', { visible: false })],
})

describe('variant availability for quotation (stock unknown)', () => {
  it('lets customers choose any offered variant even without stock', () => {
    const p = product(false)
    expect(optionValueState(p, {}, 'Size', 'S')).toBe('available')
    expect(optionValueState(p, {}, 'Size', 'M')).toBe('available')
    // Inactive or invisible variants are still not offered.
    expect(optionValueState(p, {}, 'Size', 'L')).toBe('invalid')
    expect(optionValueState(p, {}, 'Size', 'XL')).toBe('invalid')
    expect(resolveVariant(p, { Size: 'M' })?.id).toBe('M')
  })

  it('keeps the stock-based purchase rule for the demo catalog', () => {
    for (const p of [product(undefined), product(true)]) {
      expect(optionValueState(p, {}, 'Size', 'S')).toBe('out_of_stock')
      expect(optionValueState(p, {}, 'Size', 'M')).toBe('out_of_stock')
      const stocked = { ...p, variants: [variant('S', 'S', { stock: 3 })] }
      expect(optionValueState(stocked, {}, 'Size', 'S')).toBe('available')
    }
  })
})

describe('stock display', () => {
  it('shows "Availability on request" when stock is unknown', () => {
    expect(displayStock({ stock: 0, stockKnown: false })).toBeNull()
    expect(STOCK_STATUS_STYLE[getStockStatus({ stock: displayStock({ stock: 0, stockKnown: false }) })].label).toBe('Availability on request')
  })

  it('keeps real stock values for the demo catalog', () => {
    expect(displayStock({ stock: 0 })).toBe(0)
    expect(displayStock({ stock: 7, stockKnown: true })).toBe(7)
    expect(getStockStatus({ stock: displayStock({ stock: 0 }) })).toBe('out')
  })
})
