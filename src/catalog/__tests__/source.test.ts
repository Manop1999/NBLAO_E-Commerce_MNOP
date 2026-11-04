import { describe, expect, it } from 'vitest'
import { CATALOG_SOURCE, parseCatalogSource } from '../source'

describe('catalog source', () => {
  it('defaults to the demo catalog', () => {
    expect(parseCatalogSource(undefined)).toBe('demo')
    expect(parseCatalogSource('')).toBe('demo')
    expect(parseCatalogSource('demo')).toBe('demo')
  })

  it('accepts api explicitly', () => {
    expect(parseCatalogSource('api')).toBe('api')
  })

  it('rejects anything else instead of guessing', () => {
    for (const value of ['API', 'prod', 'http://127.0.0.1:3001', ' api']) expect(() => parseCatalogSource(value)).toThrow(/VITE_CATALOG_SOURCE/)
  })

  it('is demo in the test and default builds', () => {
    expect(CATALOG_SOURCE).toBe('demo')
  })
})
