import { afterAll, describe, expect, it } from 'vitest'
import { buildApp } from '../../src/app'
import { createDatabaseClient, pingDatabase } from '../../src/db/client'
import { seed } from '../../src/db/commands'
import { loadDemoCatalog, toMinorUnits } from '../../src/db/seed'
import { testDbEnv } from './testEnv'

const env = testDbEnv()
const settings = { databaseUrl: env.DATABASE_URL, nodeEnv: env.NODE_ENV, allowedDatabases: env.ALLOWED_LOCAL_DATABASES }
const { prisma, target } = createDatabaseClient(settings)

afterAll(async () => {
  await prisma.$disconnect()
})

const counts = async () => ({
  brands: await prisma.brand.count(),
  categories: await prisma.category.count(),
  products: await prisma.product.count(),
  variants: await prisma.productVariant.count(),
  images: await prisma.productImage.count(),
})

describe('test database target', () => {
  it('is the local nblao_test database', () => {
    expect(target.database).toBe('nblao_test')
    expect(['localhost', '127.0.0.1', '::1']).toContain(target.host)
  })

  it('refuses nblao_dev while the allow-list is narrowed to nblao_test', () => {
    const devUrl = env.DATABASE_URL.replace(/\/nblao_test(\?|$)/, '/nblao_dev$1')
    expect(() => createDatabaseClient({ ...settings, databaseUrl: devUrl })).toThrow(/nblao_test/)
  })
})

describe('GET /api/ready against PostgreSQL', () => {
  it('returns 200 when the database is reachable', async () => {
    const app = buildApp({ logLevel: 'silent', checkDatabase: () => pingDatabase(prisma) })
    const response = await app.inject({ method: 'GET', url: '/api/ready' })
    await app.close()
    expect(response.statusCode).toBe(200)
  })

  it('returns 503 when nothing listens on the configured port', async () => {
    const unreachable = new URL(env.DATABASE_URL)
    unreachable.port = '1'
    const down = createDatabaseClient({ ...settings, databaseUrl: unreachable.toString() })
    const app = buildApp({ logLevel: 'silent', checkDatabase: () => pingDatabase(down.prisma) })
    const response = await app.inject({ method: 'GET', url: '/api/ready' })
    await app.close()
    await down.prisma.$disconnect()
    expect(response.statusCode).toBe(503)
  })
})

describe('demo seed', () => {
  it('is idempotent: a second run creates no duplicates', async () => {
    const first = await seed(env)
    const afterFirst = await counts()
    const second = await seed(env)
    const afterSecond = await counts()

    expect(second).toEqual(first)
    expect(afterSecond).toEqual(afterFirst)

    const catalog = await loadDemoCatalog()
    expect(await prisma.product.count({ where: { isDemo: true } })).toBe(catalog.products.length)
    expect(first.products).toBe(catalog.products.length)
  })

  it('stores prices as integer minor units and marks every seeded row as demo', async () => {
    const catalog = await loadDemoCatalog()
    const source = catalog.products[0]
    expect(source).toBeDefined()
    const row = await prisma.product.findUniqueOrThrow({ where: { sku: source!.sku }, include: { variants: true, images: true } })
    expect(row.priceMinor).toBe(toMinorUnits(source!.price, source!.priceCurrency ?? 'USD'))
    expect(row.currency).toBe(source!.priceCurrency ?? 'USD')
    expect(row.isDemo).toBe(true)
    expect(row.variants.length).toBe(source!.variants?.length ?? 0)
    expect(row.variants.every(variant => variant.isDemo)).toBe(true)
    expect(row.images.map(image => image.url)).toContain(source!.img)
    expect(row.legacyId).toBe(source!.id)
  })
})

describe('database constraints', () => {
  it('reject negative prices and invalid currency codes', async () => {
    const product = await prisma.product.findFirstOrThrow({ where: { isDemo: true } })
    await expect(prisma.product.update({ where: { id: product.id }, data: { priceMinor: -1n } })).rejects.toThrow()
    await expect(prisma.product.update({ where: { id: product.id }, data: { currency: 'usd' } })).rejects.toThrow()
    const unchanged = await prisma.product.findUniqueOrThrow({ where: { id: product.id } })
    expect(unchanged.priceMinor).toBe(product.priceMinor)
    expect(unchanged.currency).toBe(product.currency)
  })

  it('enforce unique SKUs', async () => {
    const [a, b] = await prisma.product.findMany({ take: 2, orderBy: { sku: 'asc' } })
    expect(a && b).toBeTruthy()
    await expect(prisma.product.update({ where: { id: b!.id }, data: { sku: a!.sku } })).rejects.toThrow()
  })
})
