import { describe, expect, it } from 'vitest'
import { AVAILABILITY_ON_REQUEST, mapApiBrand, mapApiProduct, mapCatalog, priceToMajor } from '../mapApiProduct'
import { apiProduct } from './fixtures'

describe('priceToMajor', () => {
  it('converts integer minor units using the currency decimals', () => {
    expect(priceToMajor({ minor: '2850000', currency: 'USD', decimals: 2 })).toBe(28500)
    expect(priceToMajor({ minor: '4550', currency: 'USD', decimals: 2 })).toBe(45.5)
    expect(priceToMajor({ minor: '150000', currency: 'LAK', decimals: 0 })).toBe(150000)
  })
  it('refuses values JavaScript cannot represent exactly', () => {
    expect(priceToMajor({ minor: '9007199254740993', currency: 'USD', decimals: 2 })).toBeNull()
  })
})

describe('mapApiProduct', () => {
  it('maps to the storefront Product shape with unknown stock', () => {
    const product = mapApiProduct(apiProduct(7, { model: 'M-7', leadTime: '2 weeks', minOrderQuantity: 3 }))!
    expect(product).toMatchObject({
      id: 7,
      sku: 'SKU-0007',
      brandId: 'brand-test',
      category: 'Power & Energy',
      subcategory: 'Transformers',
      model: 'M-7',
      price: 7,
      priceCurrency: 'USD',
      moq: 3,
      leadTime: '2 weeks',
      stock: 0,
      stockKnown: false,
      stockLabel: AVAILABILITY_ON_REQUEST,
      img: '/products/7.jpg',
      images: [],
      active: true,
    })
  })

  it('maps variants with inherited or own prices, and keeps them quotable', () => {
    const product = mapApiProduct(
      apiProduct(8, {
        options: [{ name: 'Size', values: ['A', 'B'] }],
        variants: [
          { sku: 'V-A', optionValues: { Size: 'A' }, price: null, purchasable: true, images: [] },
          { sku: 'V-B', optionValues: { Size: 'B' }, price: { minor: '1250', currency: 'USD', decimals: 2 }, purchasable: false, images: [{ url: '/b.jpg', altText: null, position: 0 }] },
        ],
      }),
    )!
    expect(product.options).toEqual([{ name: 'Size', values: ['A', 'B'] }])
    expect(product.variants).toEqual([
      { id: 'V-A', sku: 'V-A', options: { Size: 'A' }, stock: 0, active: true, visible: true, purchasable: true },
      { id: 'V-B', sku: 'V-B', options: { Size: 'B' }, price: 12.5, stock: 0, active: true, visible: true, purchasable: false, images: ['/b.jpg'] },
    ])
  })

  it('uses the category itself when it has no parent', () => {
    const product = mapApiProduct(apiProduct(9, { category: { slug: 'tools', name: 'Tools & Equipment', parent: null } }))!
    expect(product.category).toBe('Tools & Equipment')
    expect(product.subcategory).toBe('')
  })

  it('skips products the storefront cannot address or price exactly', () => {
    expect(mapApiProduct(apiProduct(10, { legacyId: null }))).toBeNull()
    expect(mapApiProduct(apiProduct(11, { price: { minor: '9007199254740993', currency: 'USD', decimals: 2 } }))).toBeNull()
  })
})

describe('mapCatalog', () => {
  it('counts skipped products and never lets two products share an id', () => {
    const catalog = mapCatalog([apiProduct(1), apiProduct(2, { legacyId: null }), apiProduct(3), { ...apiProduct(4), legacyId: 1 }], [])
    expect(catalog.products.map(p => p.id)).toEqual([1, 3])
    expect(catalog.skipped).toBe(2)
  })

  it('maps brands', () => {
    expect(mapApiBrand({ id: 'b', name: 'B', nameLo: null, logoUrl: '/b.svg', websiteUrl: null, displayOrder: 2 })).toEqual({
      id: 'b', name: 'B', nameEn: 'B', nameLo: '', logo: '/b.svg', active: true, displayOrder: 2, websiteUrl: '', description: '',
    })
  })
})
