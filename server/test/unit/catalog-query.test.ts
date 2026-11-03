import { describe, expect, it } from 'vitest'
import { ApiError } from '../../src/errors'
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, parseBrandListQuery, parseProductListQuery } from '../../src/catalog/query'

const rejection = (raw: unknown): ApiError => {
  try {
    parseProductListQuery(raw)
  } catch (error) {
    if (error instanceof ApiError) return error
    throw error
  }
  throw new Error('expected the query to be rejected')
}

describe('parseProductListQuery', () => {
  it('applies defaults', () => {
    expect(parseProductListQuery({})).toEqual({ page: 1, pageSize: DEFAULT_PAGE_SIZE, sort: 'featured', category: undefined, brand: undefined, q: undefined })
    expect(parseProductListQuery(undefined)).toMatchObject({ page: 1 })
  })

  it('accepts every allowed parameter', () => {
    expect(
      parseProductListQuery({ page: '3', pageSize: '100', sort: 'price_desc', category: 'electrical-equipment/transformers', brand: 'brand-abb', q: '  breaker ' }),
    ).toEqual({ page: 3, pageSize: 100, sort: 'price_desc', category: 'electrical-equipment/transformers', brand: 'brand-abb', q: 'breaker' })
  })

  it('treats a blank search as no search', () => {
    expect(parseProductListQuery({ q: '   ' }).q).toBeUndefined()
  })

  it('enforces the maximum page size and positive pages', () => {
    expect(parseProductListQuery({ pageSize: String(MAX_PAGE_SIZE) }).pageSize).toBe(100)
    for (const pageSize of ['0', '101', '1000']) expect(rejection({ pageSize }).issues?.[0]?.path).toBe('pageSize')
    for (const page of ['0', '100001']) expect(rejection({ page }).issues?.[0]?.path).toBe('page')
  })

  it('rejects non-integer numbers in any spelling', () => {
    for (const value of ['1.5', '1e2', ' 3', '-1', '0x10', '', 'abc', '9999999999']) {
      expect(rejection({ page: value }).code).toBe('invalid_query')
    }
  })

  it('only allows the documented sort fields', () => {
    for (const sort of ['createdAt', 'cost', 'price', 'PRICE_ASC', 'name_desc']) expect(rejection({ sort }).issues?.[0]?.path).toBe('sort')
  })

  it('rejects unknown and repeated parameters', () => {
    expect(rejection({ isDemo: 'false' }).issues?.[0]?.message).toMatch(/isDemo/)
    expect(rejection({ include: 'cost' }).code).toBe('invalid_query')
    expect(rejection({ page: ['1', '2'] }).issues?.[0]?.path).toBe('page')
  })

  it('validates category slugs, brand ids and search length', () => {
    for (const category of ['Electrical Equipment', '../etc', 'a//b', 'a/b/c', 'UPPER']) expect(rejection({ category }).issues?.[0]?.path).toBe('category')
    for (const brand of ['brand abb', "brand'--", 'x'.repeat(101)]) expect(rejection({ brand }).issues?.[0]?.path).toBe('brand')
    expect(rejection({ q: 'x'.repeat(101) }).issues?.[0]?.path).toBe('q')
  })

  it('returns a 400 error with field issues', () => {
    const error = rejection({ pageSize: '500', sort: 'cost' })
    expect(error.statusCode).toBe(400)
    expect(error.issues?.map(issue => issue.path).sort()).toEqual(['pageSize', 'sort'])
  })
})

describe('parseBrandListQuery', () => {
  it('accepts no parameters and rejects any parameter', () => {
    expect(() => parseBrandListQuery({})).not.toThrow()
    expect(() => parseBrandListQuery({ active: 'false' })).toThrow(ApiError)
  })
})
