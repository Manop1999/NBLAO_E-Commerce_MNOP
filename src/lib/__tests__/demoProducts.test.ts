import { describe, expect, it } from 'vitest'
import { PRODUCTS } from '../../data'
import { applyDemoDefaults } from '../demoProducts'
import { aggregateStock, hasVariants, isSelectionComplete, resolveVariant } from '../variants'

describe('demo product defaults', () => {
  it('populates every bundled product with category options and variants', () => {
    for (const p of PRODUCTS) {
      expect(hasVariants(p), p.sku).toBe(true)
      expect(p.images.length + 1).toBeGreaterThan(1)
      expect(p.specs.length).toBeGreaterThan(0)
    }
  })
  it('keeps real stock unchanged (variants only split it)', () => {
    const real = { 1: 3, 2: 5, 3: 8, 4: 2, 5: 500, 6: 2000, 7: 50, 8: 120, 9: 12, 10: 4, 11: 1, 12: 15 } as Record<number, number>
    for (const p of PRODUCTS) expect(aggregateStock(p), p.sku).toBe(real[p.id])
  })
  it('has unique deterministic variant ids/SKUs and resolvable selections', () => {
    for (const p of PRODUCTS) {
      const skus = p.variants!.map(v => v.sku)
      expect(new Set(skus).size).toBe(skus.length)
      expect(applyDemoDefaults(p)).toEqual(p)
      for (const v of p.variants!) {
        expect(isSelectionComplete(p, v.options)).toBe(true)
        expect(resolveVariant(p, v.options)?.id).toBe(v.id)
      }
    }
  })
  it('never overrides saved options', () => {
    const saved = { ...PRODUCTS[0], options: [{ name: 'X', values: ['a'] }], variants: [] }
    expect(applyDemoDefaults(saved).options).toEqual([{ name: 'X', values: ['a'] }])
  })
})
