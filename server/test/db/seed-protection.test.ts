import { afterAll, describe, expect, it } from 'vitest'
import { createDatabaseClient } from '../../src/db/client'
import { DemoSeedConflictError, seedDemoCatalog, type DemoCatalog } from '../../src/db/seed'
import { testDbEnv } from './testEnv'

const env = testDbEnv()
const { prisma } = createDatabaseClient({ databaseUrl: env.DATABASE_URL, nodeEnv: env.NODE_ENV, allowedDatabases: env.ALLOWED_LOCAL_DATABASES })

// Every row these tests create starts with ROOT, so cleanup removes only this run's fixtures.
const ROOT = `zztest${Date.now()}`
let counter = 0
const nextPrefix = () => `${ROOT}x${++counter}`
const legacyIdBase = 900_000 + (Date.now() % 50_000) * 10

/** A one-product catalog whose keys are all derived from `p`. */
function syntheticCatalog(p: string, legacyId: number): DemoCatalog {
  return {
    brands: [{ id: `${p}-brand`, name: 'Demo Brand', nameLo: '', logo: '', active: true, displayOrder: 0, websiteUrl: '', description: '' }],
    categories: [`${p} Category`],
    categorySubs: { [`${p} Category`]: ['Sub'] },
    products: [
      {
        id: legacyId,
        name: 'Demo Product',
        sku: `${p}-SKU`,
        brandId: `${p}-brand`,
        category: `${p} Category`,
        subcategory: 'Sub',
        model: '',
        price: 10,
        priceUnit: '',
        img: '/products/demo.jpg',
        images: [],
        shortDesc: '',
        description: '',
        specs: [],
        applications: [],
        tags: [],
        featured: false,
        certifications: [],
        options: [{ name: 'Size', values: ['A'] }],
        variants: [{ sku: `${p}-SKU-A`, options: { Size: 'A' }, active: true, visible: true, purchasable: true }],
      },
    ],
  }
}

/** Everything the synthetic catalog for `p` would create. All must stay absent after a refused seed. */
async function demoRowsFor(p: string) {
  return {
    brands: await prisma.brand.count({ where: { id: `${p}-brand`, isDemo: true } }),
    categories: await prisma.category.count({ where: { slug: { startsWith: `${p}-category` }, isDemo: true } }),
    products: await prisma.product.count({ where: { sku: `${p}-SKU`, isDemo: true } }),
    variants: await prisma.productVariant.count({ where: { sku: `${p}-SKU-A`, isDemo: true } }),
    images: await prisma.productImage.count({ where: { product: { sku: { startsWith: p } }, isDemo: true } }),
  }
}
const NOTHING = { brands: 0, categories: 0, products: 0, variants: 0, images: 0 }

async function refusal(promise: Promise<unknown>): Promise<DemoSeedConflictError> {
  try {
    await promise
  } catch (error) {
    if (error instanceof DemoSeedConflictError) return error
    throw error
  }
  throw new Error('expected the seed to be refused')
}

afterAll(async () => {
  await prisma.productImage.deleteMany({ where: { product: { sku: { startsWith: ROOT } } } })
  await prisma.productVariant.deleteMany({ where: { sku: { startsWith: ROOT } } })
  await prisma.product.deleteMany({ where: { sku: { startsWith: ROOT } } })
  await prisma.category.deleteMany({ where: { slug: { startsWith: ROOT }, parentId: { not: null } } })
  await prisma.category.deleteMany({ where: { slug: { startsWith: ROOT } } })
  await prisma.brand.deleteMany({ where: { id: { startsWith: ROOT } } })
  await prisma.$disconnect()
})

describe('demo seed protects non-demo records', () => {
  it('refuses when a non-demo Brand has the same id, and changes nothing', async () => {
    const p = nextPrefix()
    const own = await prisma.brand.create({ data: { id: `${p}-brand`, name: 'Real Brand', isDemo: false } })

    const error = await refusal(seedDemoCatalog(prisma, syntheticCatalog(p, legacyIdBase + 1)))
    expect(error.conflicts).toEqual([`brand id "${p}-brand" belongs to a non-demo record`])

    expect(await prisma.brand.findUniqueOrThrow({ where: { id: own.id } })).toEqual(own)
    expect(await demoRowsFor(p)).toEqual(NOTHING)
  })

  it('refuses when a non-demo Category has the same slug, and changes nothing', async () => {
    const p = nextPrefix()
    const own = await prisma.category.create({ data: { slug: `${p}-category/sub`, name: 'Real Sub', isDemo: false } })

    const error = await refusal(seedDemoCatalog(prisma, syntheticCatalog(p, legacyIdBase + 2)))
    expect(error.conflicts).toEqual([`category slug "${p}-category/sub" belongs to a non-demo record`])

    expect(await prisma.category.findUniqueOrThrow({ where: { id: own.id } })).toEqual(own)
    // The brand and parent category come earlier in the seed; they must not exist either (no partial writes).
    expect(await demoRowsFor(p)).toEqual(NOTHING)
  })

  it('refuses when a non-demo Product has the same SKU, and changes nothing', async () => {
    const p = nextPrefix()
    const category = await prisma.category.create({ data: { slug: `${p}-own`, name: 'Own', isDemo: false } })
    const own = await prisma.product.create({
      data: { sku: `${p}-SKU`, name: 'Real Product', categoryId: category.id, priceMinor: 99_999n, currency: 'USD', isDemo: false },
    })

    const error = await refusal(seedDemoCatalog(prisma, syntheticCatalog(p, legacyIdBase + 3)))
    expect(error.conflicts).toEqual([`product SKU "${p}-SKU" belongs to a non-demo record`])

    expect(await prisma.product.findUniqueOrThrow({ where: { id: own.id } })).toEqual(own)
    expect(await demoRowsFor(p)).toEqual(NOTHING)
  })

  it('refuses when a non-demo ProductVariant has the same SKU, and changes nothing', async () => {
    const p = nextPrefix()
    const category = await prisma.category.create({ data: { slug: `${p}-own`, name: 'Own', isDemo: false } })
    const product = await prisma.product.create({
      data: { sku: `${p}-other`, name: 'Real Product', categoryId: category.id, priceMinor: 5_000n, currency: 'USD', isDemo: false },
    })
    const own = await prisma.productVariant.create({
      data: { sku: `${p}-SKU-A`, productId: product.id, optionValues: { Size: 'Real' }, priceMinor: 7_000n, isDemo: false },
    })

    const error = await refusal(seedDemoCatalog(prisma, syntheticCatalog(p, legacyIdBase + 4)))
    expect(error.conflicts).toEqual([`variant SKU "${p}-SKU-A" belongs to a non-demo record`])

    expect(await prisma.productVariant.findUniqueOrThrow({ where: { id: own.id } })).toEqual(own)
    expect(await demoRowsFor(p)).toEqual(NOTHING)
  })

  it('reports every conflict at once', async () => {
    const p = nextPrefix()
    await prisma.brand.create({ data: { id: `${p}-brand`, name: 'Real Brand', isDemo: false } })
    const category = await prisma.category.create({ data: { slug: `${p}-category`, name: 'Real', isDemo: false } })
    await prisma.product.create({ data: { sku: `${p}-SKU`, name: 'Real', categoryId: category.id, priceMinor: 1n, currency: 'USD', isDemo: false } })

    const error = await refusal(seedDemoCatalog(prisma, syntheticCatalog(p, legacyIdBase + 5)))
    expect(error.conflicts).toHaveLength(3)
    expect(error.message).toMatch(/nothing was changed/)
  })

  it('refuses duplicate keys inside the source before touching the database', async () => {
    const p = nextPrefix()
    const catalog = syntheticCatalog(p, legacyIdBase + 6)
    const product = catalog.products[0]!
    catalog.products.push({ ...product, id: legacyIdBase + 7, variants: [] })

    const error = await refusal(seedDemoCatalog(prisma, catalog))
    expect(error.conflicts).toEqual([`duplicate product SKU "${p}-SKU" in the demo source`])
    expect(await demoRowsFor(p)).toEqual(NOTHING)
  })
})

describe('demo seed still works next to non-demo records', () => {
  it('seeds, repeats idempotently, and keeps non-demo rows attached to demo rows', async () => {
    const p = nextPrefix()
    const catalog = syntheticCatalog(p, legacyIdBase + 8)

    const first = await seedDemoCatalog(prisma, catalog)
    expect(first).toEqual({ brands: 1, categories: 2, products: 1, variants: 1, images: 1 })
    expect(await demoRowsFor(p)).toEqual({ brands: 1, categories: 2, products: 1, variants: 1, images: 1 })

    // Non-demo rows that hang off demo rows: a variant and an image on the demo product, a product in the demo category.
    const demoProduct = await prisma.product.findUniqueOrThrow({ where: { sku: `${p}-SKU` } })
    const ownVariant = await prisma.productVariant.create({
      data: { sku: `${p}-OWN-VARIANT`, productId: demoProduct.id, optionValues: { Size: 'Own' }, isDemo: false },
    })
    const ownImage = await prisma.productImage.create({ data: { productId: demoProduct.id, url: '/own.jpg', position: 5, isDemo: false } })
    const ownProduct = await prisma.product.create({
      data: { sku: `${p}-OWN-PRODUCT`, name: 'Own', categoryId: demoProduct.categoryId, priceMinor: 100n, currency: 'USD', isDemo: false },
    })

    const second = await seedDemoCatalog(prisma, catalog)
    const third = await seedDemoCatalog(prisma, catalog)
    expect(second).toEqual(first)
    expect(third).toEqual(first)
    expect(await demoRowsFor(p)).toEqual({ brands: 1, categories: 2, products: 1, variants: 1, images: 1 })

    expect(await prisma.productVariant.findUniqueOrThrow({ where: { id: ownVariant.id } })).toEqual(ownVariant)
    expect(await prisma.productImage.findUniqueOrThrow({ where: { id: ownImage.id } })).toEqual(ownImage)
    expect(await prisma.product.findUniqueOrThrow({ where: { id: ownProduct.id } })).toEqual(ownProduct)
  })
})
