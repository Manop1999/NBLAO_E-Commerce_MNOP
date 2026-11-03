/**
 * Demo catalog seed. The source is the catalog the frontend already ships (src/data.ts, src/brands.ts), so
 * the database never gets invented products. Every seeded row is marked isDemo = true.
 *
 * Idempotent: rows are upserted by their natural keys (brand id, category slug, product SKU, variant SKU) and
 * a product's demo images are replaced as a whole, so running it again leaves the same rows (no duplicates).
 *
 * Callers must check the target with assertLocalDatabase() first (scripts/db.ts and createDatabaseClient do).
 */
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { z } from 'zod'
import type { PrismaClient } from '../generated/prisma/client.ts'

/** Minor-unit digits per currency, as in src/commerce/money.ts DEFAULT_CURRENCIES. */
export const CURRENCY_DECIMALS: Readonly<Record<string, number>> = { USD: 2, THB: 2, LAK: 0 }

/** Major-unit price (e.g. 28500.5) to integer minor units, refusing negative, non-finite or over-precise values. */
export function toMinorUnits(price: number, currency: string): bigint {
  const decimals = CURRENCY_DECIMALS[currency]
  if (decimals === undefined) throw new Error(`unsupported currency ${currency}`)
  const text = price.toString()
  const match = /^(\d+)(?:\.(\d+))?$/.exec(text)
  if (!Number.isFinite(price) || !match) throw new Error(`invalid price ${text}`)
  const fraction = match[2] ?? ''
  if (fraction.length > decimals) throw new Error(`price ${text} has more than ${decimals} decimals for ${currency}`)
  return BigInt(`${match[1]}${fraction.padEnd(decimals, '0')}`)
}

export const slugify = (value: string): string =>
  value
    .normalize('NFKD')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

// Only the fields the seed uses; anything else in the frontend objects is ignored.
const brandSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  nameLo: z.string(),
  logo: z.string(),
  active: z.boolean(),
  displayOrder: z.number().int(),
  websiteUrl: z.string(),
  description: z.string(),
})

const variantSchema = z.object({
  sku: z.string().min(1),
  options: z.record(z.string(), z.string()),
  price: z.number().nonnegative().optional(),
  active: z.boolean(),
  visible: z.boolean(),
  purchasable: z.boolean(),
  images: z.array(z.string()).optional(),
})

const productSchema = z.object({
  id: z.number().int(),
  name: z.string().min(1),
  sku: z.string().min(1),
  brandId: z.string(),
  category: z.string().min(1),
  subcategory: z.string(),
  model: z.string(),
  price: z.number().nonnegative(),
  priceCurrency: z.string().optional(),
  priceUnit: z.string(),
  moq: z.number().int().positive().optional(),
  leadTime: z.string().optional(),
  img: z.string(),
  images: z.array(z.string()),
  shortDesc: z.string(),
  description: z.string(),
  specs: z.array(z.object({ label: z.string(), value: z.string() })),
  applications: z.array(z.string()),
  tags: z.array(z.string()),
  featured: z.boolean(),
  certifications: z.array(z.string()),
  active: z.boolean().optional(),
  options: z.array(z.object({ name: z.string(), values: z.array(z.string()) })).optional(),
  variants: z.array(variantSchema).optional(),
  demoOptions: z.boolean().optional(),
})

const catalogSchema = z.object({
  brands: z.array(brandSchema),
  categories: z.array(z.string().min(1)),
  categorySubs: z.record(z.string(), z.array(z.string())),
  products: z.array(productSchema),
})

export type DemoCatalog = z.infer<typeof catalogSchema>

/** Repository root (server/ is one level below it). */
const REPO_ROOT = path.resolve(import.meta.dirname, '../../..')

/**
 * Loads the frontend's bundled catalog at run time and validates it. The modules are imported by computed
 * path so the server's strict type check does not compile frontend code.
 */
export async function loadDemoCatalog(repoRoot: string = REPO_ROOT): Promise<DemoCatalog> {
  const load = (file: string): Promise<Record<string, unknown>> => import(pathToFileURL(path.join(repoRoot, file)).href)
  const [data, brands] = await Promise.all([load('src/data.ts'), load('src/brands.ts')])
  return catalogSchema.parse({
    brands: brands.DEFAULT_BRANDS,
    categories: data.CATEGORIES,
    categorySubs: data.CATEGORY_SUBS,
    products: data.PRODUCTS,
  })
}

export interface SeedSummary {
  brands: number
  categories: number
  products: number
  variants: number
  images: number
}

const orNull = (value: string | undefined): string | null => (value && value.trim() ? value : null)

export async function seedDemoCatalog(prisma: PrismaClient, catalog: DemoCatalog): Promise<SeedSummary> {
  const summary: SeedSummary = { brands: 0, categories: 0, products: 0, variants: 0, images: 0 }

  for (const brand of catalog.brands) {
    const fields = {
      name: brand.name,
      nameLo: orNull(brand.nameLo),
      logoUrl: orNull(brand.logo),
      websiteUrl: orNull(brand.websiteUrl),
      description: orNull(brand.description),
      active: brand.active,
      displayOrder: brand.displayOrder,
      isDemo: true,
    }
    await prisma.brand.upsert({ where: { id: brand.id }, create: { id: brand.id, ...fields }, update: fields })
    summary.brands++
  }
  const brandIds = new Set(catalog.brands.map(brand => brand.id))

  // Top-level categories in catalog order, then subcategories (including ones only products mention).
  const categoryIds = new Map<string, string>()
  const upsertCategory = async (slug: string, name: string, parentId: string | null, displayOrder: number) => {
    const fields = { name, parentId, displayOrder, isDemo: true }
    const row = await prisma.category.upsert({ where: { slug }, create: { slug, ...fields }, update: fields })
    categoryIds.set(slug, row.id)
    summary.categories++
    return row.id
  }
  const topLevel = [...catalog.categories]
  for (const product of catalog.products) if (!topLevel.includes(product.category)) topLevel.push(product.category)
  for (const [index, name] of topLevel.entries()) {
    const parentSlug = slugify(name)
    const parentId = await upsertCategory(parentSlug, name, null, index)
    const subs = [...(catalog.categorySubs[name] ?? [])]
    for (const product of catalog.products) {
      if (product.category === name && product.subcategory.trim() && !subs.includes(product.subcategory)) subs.push(product.subcategory)
    }
    for (const [subIndex, sub] of subs.entries()) await upsertCategory(`${parentSlug}/${slugify(sub)}`, sub, parentId, subIndex)
  }

  for (const product of catalog.products) {
    const currency = (product.priceCurrency ?? 'USD').toUpperCase()
    const parentSlug = slugify(product.category)
    const categorySlug = product.subcategory.trim() ? `${parentSlug}/${slugify(product.subcategory)}` : parentSlug
    const categoryId = categoryIds.get(categorySlug)
    if (!categoryId) throw new Error(`category ${categorySlug} was not seeded`)

    const fields = {
      legacyId: product.id,
      name: product.name,
      model: orNull(product.model),
      brandId: brandIds.has(product.brandId) ? product.brandId : null,
      categoryId,
      priceMinor: toMinorUnits(product.price, currency),
      currency,
      priceUnit: orNull(product.priceUnit),
      minOrderQuantity: product.moq ?? null,
      leadTime: orNull(product.leadTime),
      shortDescription: orNull(product.shortDesc),
      description: orNull(product.description),
      specs: product.specs,
      options: product.options ?? [],
      applications: product.applications,
      tags: product.tags,
      certifications: product.certifications,
      featured: product.featured,
      active: product.active ?? true,
      demoOptions: product.demoOptions ?? false,
      isDemo: true,
    }

    await prisma.$transaction(async tx => {
      const row = await tx.product.upsert({ where: { sku: product.sku }, create: { sku: product.sku, ...fields }, update: fields })

      const variants = product.variants ?? []
      const variantIds = new Map<string, string>()
      for (const variant of variants) {
        const variantFields = {
          productId: row.id,
          optionValues: variant.options,
          priceMinor: variant.price === undefined ? null : toMinorUnits(variant.price, currency),
          active: variant.active,
          visible: variant.visible,
          purchasable: variant.purchasable,
          isDemo: true,
        }
        const saved = await tx.productVariant.upsert({
          where: { sku: variant.sku },
          create: { sku: variant.sku, ...variantFields },
          update: variantFields,
        })
        variantIds.set(variant.sku, saved.id)
      }
      // Demo variants that are no longer in the source are removed; non-demo rows are never touched.
      await tx.productVariant.deleteMany({ where: { productId: row.id, isDemo: true, sku: { notIn: variants.map(v => v.sku) } } })

      const productImages = [...new Set([product.img, ...product.images].filter(url => url.trim()))]
      const images = [
        ...productImages.map((url, position) => ({ productId: row.id, variantId: null, url, altText: product.name, position, isDemo: true })),
        ...variants.flatMap(variant =>
          (variant.images ?? []).map((url, position) => ({
            productId: row.id,
            variantId: variantIds.get(variant.sku) ?? null,
            url,
            altText: product.name,
            position,
            isDemo: true,
          })),
        ),
      ]
      await tx.productImage.deleteMany({ where: { productId: row.id, isDemo: true } })
      if (images.length) await tx.productImage.createMany({ data: images })

      summary.products++
      summary.variants += variants.length
      summary.images += images.length
    })
  }

  return summary
}
