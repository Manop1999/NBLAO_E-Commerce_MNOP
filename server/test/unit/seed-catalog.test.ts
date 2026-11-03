import { describe, expect, it } from 'vitest'
import { loadDemoCatalog, slugify, toMinorUnits } from '../../src/db/seed'

describe('toMinorUnits', () => {
  it('converts major units to integer minor units per currency', () => {
    expect(toMinorUnits(28500, 'USD')).toBe(2_850_000n)
    expect(toMinorUnits(45.5, 'USD')).toBe(4_550n)
    expect(toMinorUnits(0.01, 'THB')).toBe(1n)
    expect(toMinorUnits(150000, 'LAK')).toBe(150_000n)
    expect(toMinorUnits(0, 'USD')).toBe(0n)
  })

  it('refuses negative, non-finite, over-precise or unknown-currency prices', () => {
    expect(() => toMinorUnits(-1, 'USD')).toThrow(/invalid price/)
    expect(() => toMinorUnits(Number.NaN, 'USD')).toThrow(/invalid price/)
    expect(() => toMinorUnits(Number.POSITIVE_INFINITY, 'USD')).toThrow(/invalid price/)
    expect(() => toMinorUnits(1.005, 'USD')).toThrow(/more than 2 decimals/)
    expect(() => toMinorUnits(10.5, 'LAK')).toThrow(/more than 0 decimals/)
    expect(() => toMinorUnits(10, 'EUR')).toThrow(/unsupported currency/)
  })
})

describe('slugify', () => {
  it('makes stable URL-safe keys', () => {
    expect(slugify('Safety & Fire Protection')).toBe('safety-and-fire-protection')
    expect(slugify('  Test & Measurement ')).toBe('test-and-measurement')
    expect(slugify('Power/Energy (UPS)')).toBe('power-energy-ups')
  })
})

describe('loadDemoCatalog', () => {
  it('reads and validates the catalog the frontend ships, without changing it', async () => {
    const catalog = await loadDemoCatalog()
    expect(catalog.products.length).toBeGreaterThan(0)
    expect(catalog.brands.length).toBeGreaterThan(0)
    const skus = catalog.products.map(product => product.sku)
    expect(new Set(skus).size).toBe(skus.length)
    for (const product of catalog.products) {
      expect(() => toMinorUnits(product.price, product.priceCurrency ?? 'USD')).not.toThrow()
      for (const variant of product.variants ?? []) {
        if (variant.price !== undefined) expect(() => toMinorUnits(variant.price as number, product.priceCurrency ?? 'USD')).not.toThrow()
      }
    }
  })
})
