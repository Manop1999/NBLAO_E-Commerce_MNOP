import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildApp } from '../../src/app'
import { createPrismaCatalogReader } from '../../src/catalog/reader'
import type { ProductPage, PublicProduct } from '../../src/catalog/dto'
import { createDatabaseClient } from '../../src/db/client'
import { seed } from '../../src/db/commands'
import { testDbEnv } from './testEnv'

const env = testDbEnv()
const { prisma } = createDatabaseClient({ databaseUrl: env.DATABASE_URL, nodeEnv: env.NODE_ENV, allowedDatabases: env.ALLOWED_LOCAL_DATABASES })
const reader = createPrismaCatalogReader(prisma)
const app = buildApp({ logLevel: 'silent', checkDatabase: () => Promise.resolve(), catalog: reader })

// Fixture rows all start with ROOT; afterAll removes exactly those.
const ROOT = `zzcat${Date.now()}`
const FIXTURE_COUNT = 120
const sku = (n: number) => `${ROOT}-P${String(n).padStart(3, '0')}`

const PUBLIC_PRODUCT_KEYS = [
  'applications', 'brand', 'category', 'certifications', 'demoOptions', 'description', 'featured', 'id', 'images', 'isDemo',
  'leadTime', 'legacyId', 'minOrderQuantity', 'model', 'name', 'options', 'price', 'priceUnit', 'shortDescription', 'sku',
  'specs', 'tags', 'variants',
].sort()

const get = async (url: string) => {
  const response = await app.inject({ method: 'GET', url })
  return { status: response.statusCode, body: response.json() }
}
const page = async (query: string): Promise<ProductPage> => {
  const { status, body } = await get(`/api/products?${query}`)
  expect(status, query).toBe(200)
  return body as ProductPage
}

beforeAll(async () => {
  await seed(env)
  await prisma.brand.createMany({
    data: [
      { id: `${ROOT}-brand`, name: 'Fixture Brand', active: true },
      { id: `${ROOT}-offbrand`, name: 'Hidden Brand', active: false },
    ],
  })
  const parent = await prisma.category.create({ data: { slug: ROOT, name: 'Fixture Parent' } })
  const child = await prisma.category.create({ data: { slug: `${ROOT}/sub`, name: 'Fixture Child', parentId: parent.id } })
  await prisma.product.createMany({
    data: [
      ...Array.from({ length: FIXTURE_COUNT }, (_, i) => ({
        sku: sku(i + 1),
        name: `${ROOT} Item ${String(i + 1).padStart(3, '0')}`,
        brandId: `${ROOT}-brand`,
        categoryId: child.id,
        // Prices are not in SKU order, so price sorting is actually exercised.
        priceMinor: BigInt(((i * 37) % FIXTURE_COUNT) * 100 + 100),
        currency: 'USD',
      })),
      { sku: `${ROOT}-OFF`, name: `${ROOT} inactive`, categoryId: child.id, priceMinor: 1n, currency: 'USD', active: false },
      { sku: `${ROOT}-EUR`, name: `${ROOT} euro`, categoryId: child.id, priceMinor: 1n, currency: 'EUR' },
      { sku: `${ROOT}-OB`, name: `${ROOT} hidden brand`, brandId: `${ROOT}-offbrand`, categoryId: parent.id, priceMinor: 1n, currency: 'USD' },
    ],
  })
  const withVariants = await prisma.product.findUniqueOrThrow({ where: { sku: sku(1) } })
  await prisma.productVariant.createMany({
    data: [
      { sku: `${sku(1)}-SHOWN`, productId: withVariants.id, optionValues: { Size: 'A' }, priceMinor: 500n },
      { sku: `${sku(1)}-INACTIVE`, productId: withVariants.id, optionValues: { Size: 'B' }, active: false },
      { sku: `${sku(1)}-HIDDEN`, productId: withVariants.id, optionValues: { Size: 'C' }, visible: false },
    ],
  })
})

afterAll(async () => {
  await app.close()
  await prisma.productVariant.deleteMany({ where: { sku: { startsWith: ROOT } } })
  await prisma.product.deleteMany({ where: { sku: { startsWith: ROOT } } })
  await prisma.category.deleteMany({ where: { slug: { startsWith: `${ROOT}/` } } })
  await prisma.category.deleteMany({ where: { slug: ROOT } })
  await prisma.brand.deleteMany({ where: { id: { startsWith: ROOT } } })
  await prisma.$disconnect()
})

describe('GET /api/products against PostgreSQL', () => {
  it('returns the seeded demo catalog with public fields only', async () => {
    const all = await page('pageSize=100&q=EE-TRF-001')
    expect(all.total).toBe(1)
    const item = all.items[0] as PublicProduct
    expect(Object.keys(item).sort()).toEqual(PUBLIC_PRODUCT_KEYS)
    expect(item).toMatchObject({ sku: 'EE-TRF-001', legacyId: 1, isDemo: true, price: { minor: '2850000', currency: 'USD', decimals: 2 } })
    expect(item.brand).toEqual({ id: 'brand-siemens', name: 'Siemens' })
    expect(item.category.parent?.slug).toBe('electrical-equipment')
    expect(item.variants.length).toBeGreaterThan(0)
    for (const variant of item.variants) expect(Object.keys(variant).sort()).toEqual(['images', 'optionValues', 'price', 'purchasable', 'sku'])
    const json = JSON.stringify(all)
    for (const internal of ['priceMinor', 'categoryId', 'brandId', 'createdAt', 'updatedAt', '"active"', 'visible', 'optionsJson']) {
      expect(json).not.toContain(internal)
    }
  })

  it('paginates more than 100 products with correct metadata and no overlap', async () => {
    const first = await page(`category=${ROOT}&pageSize=100`)
    const second = await page(`category=${ROOT}&pageSize=100&page=2`)
    const beyond = await page(`category=${ROOT}&pageSize=100&page=3`)

    // 120 fixtures + the hidden-brand product; the inactive and EUR products are excluded.
    expect(first).toMatchObject({ page: 1, pageSize: 100, total: FIXTURE_COUNT + 1, totalPages: 2 })
    expect(first.items).toHaveLength(100)
    expect(second.items).toHaveLength(FIXTURE_COUNT + 1 - 100)
    expect(beyond).toMatchObject({ items: [], total: FIXTURE_COUNT + 1, totalPages: 2 })

    const skus = [...first.items, ...second.items].map(item => item.sku)
    expect(new Set(skus).size).toBe(skus.length)
    expect(skus).toContain(sku(FIXTURE_COUNT))
    expect(skus).not.toContain(`${ROOT}-OFF`)
    expect(skus).not.toContain(`${ROOT}-EUR`)

    // Same request twice gives the same order (deterministic tiebreaker).
    const again = await page(`category=${ROOT}&pageSize=100`)
    expect(again.items.map(item => item.id)).toEqual(first.items.map(item => item.id))
  })

  it('sorts only by the allowed fields', async () => {
    const asc = (await page(`category=${ROOT}/sub&pageSize=100&sort=price_asc`)).items.map(item => BigInt(item.price.minor))
    expect(asc).toEqual([...asc].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)))
    const desc = (await page(`category=${ROOT}/sub&pageSize=100&sort=price_desc`)).items.map(item => BigInt(item.price.minor))
    expect(desc).toEqual([...desc].sort((a, b) => (a > b ? -1 : a < b ? 1 : 0)))
    const names = (await page(`category=${ROOT}/sub&pageSize=100&sort=name_asc`)).items.map(item => item.name)
    expect(names).toEqual([...names].sort())
  })

  it('filters by brand, category and search text', async () => {
    expect((await page(`brand=${ROOT}-brand&pageSize=1`)).total).toBe(FIXTURE_COUNT)
    expect((await page(`brand=${ROOT}-offbrand`)).total).toBe(0)
    expect((await page(`category=${ROOT}/sub&pageSize=1`)).total).toBe(FIXTURE_COUNT)
    const search = await page(`q=${ROOT.toUpperCase()}-p05&pageSize=100`)
    expect(search.items.map(item => item.sku).sort()).toEqual(Array.from({ length: 10 }, (_, i) => sku(50 + i)))
  })

  it('hides inactive brands, inactive variants and invisible variants', async () => {
    const hiddenBrand = (await page(`q=${ROOT}-OB`)).items[0]
    expect(hiddenBrand?.brand).toBeNull()
    const withVariants = (await page(`q=${sku(1)}&pageSize=10`)).items.find(item => item.sku === sku(1))
    expect(withVariants?.variants.map(variant => variant.sku)).toEqual([`${sku(1)}-SHOWN`])
    expect(withVariants?.variants[0]?.price).toEqual({ minor: '500', currency: 'USD', decimals: 2 })
  })

  it('rejects invalid queries before touching the database', async () => {
    const { status, body } = await get('/api/products?pageSize=101')
    expect(status).toBe(400)
    expect(body.error.code).toBe('invalid_query')
  })
})

describe('GET /api/brands against PostgreSQL', () => {
  it('returns active brands only, with public fields', async () => {
    const { status, body } = await get('/api/brands')
    expect(status).toBe(200)
    const ids = body.items.map((item: { id: string }) => item.id)
    expect(ids).toContain('brand-siemens')
    expect(ids).toContain(`${ROOT}-brand`)
    expect(ids).not.toContain(`${ROOT}-offbrand`)
    expect(Object.keys(body.items[0]).sort()).toEqual(['displayOrder', 'id', 'logoUrl', 'name', 'nameLo', 'websiteUrl'])
  })
})
