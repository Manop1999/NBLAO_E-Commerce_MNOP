/**
 * Read-only catalog access. The Prisma implementation selects an explicit field list, so a column added to the
 * schema later (cost, margin, supplier data…) is never returned unless it is added here and to dto.ts.
 *
 * Public visibility rules: active products in a supported currency; active + visible variants; active brands.
 * Every ordering ends with the primary key, so pages are deterministic (no overlaps, no skipped rows).
 */
import type { Prisma, PrismaClient } from '../generated/prisma/client.ts'
import {
  SUPPORTED_CURRENCIES,
  toOptions,
  toOptionValues,
  toPublicPrice,
  toSpecs,
  type ProductPage,
  type PublicBrand,
  type PublicImage,
  type PublicProduct,
} from './dto.ts'
import type { ProductListQuery, ProductSort } from './query.ts'

export interface CatalogReader {
  listProducts(query: ProductListQuery): Promise<ProductPage>
  listBrands(): Promise<PublicBrand[]>
}

const imageSelect = { url: true, altText: true, position: true } satisfies Prisma.ProductImageSelect

const productSelect = {
  id: true,
  legacyId: true,
  sku: true,
  name: true,
  model: true,
  priceMinor: true,
  currency: true,
  priceUnit: true,
  minOrderQuantity: true,
  leadTime: true,
  shortDescription: true,
  description: true,
  specs: true,
  options: true,
  applications: true,
  tags: true,
  certifications: true,
  featured: true,
  demoOptions: true,
  isDemo: true,
  brand: { select: { id: true, name: true, active: true } },
  category: { select: { slug: true, name: true, parent: { select: { slug: true, name: true } } } },
  images: { where: { variantId: null }, select: imageSelect, orderBy: [{ position: 'asc' }, { id: 'asc' }] },
  variants: {
    where: { active: true, visible: true },
    select: {
      sku: true,
      optionValues: true,
      priceMinor: true,
      purchasable: true,
      images: { select: imageSelect, orderBy: [{ position: 'asc' }, { id: 'asc' }] },
    },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  },
} satisfies Prisma.ProductSelect

type ProductRow = Prisma.ProductGetPayload<{ select: typeof productSelect }>

const ORDER_BY: Record<ProductSort, Prisma.ProductOrderByWithRelationInput[]> = {
  featured: [{ featured: 'desc' }, { legacyId: { sort: 'asc', nulls: 'last' } }, { id: 'asc' }],
  // Sorted by minor units within the stored currency; the catalog is single-currency (USD) today.
  price_asc: [{ priceMinor: 'asc' }, { id: 'asc' }],
  price_desc: [{ priceMinor: 'desc' }, { id: 'asc' }],
  name_asc: [{ name: 'asc' }, { id: 'asc' }],
}

export function productWhere(query: Pick<ProductListQuery, 'category' | 'brand' | 'q'>): Prisma.ProductWhereInput {
  const and: Prisma.ProductWhereInput[] = [{ active: true }, { currency: { in: [...SUPPORTED_CURRENCIES] } }]
  if (query.brand) and.push({ brandId: query.brand, brand: { active: true } })
  if (query.category) and.push({ category: { OR: [{ slug: query.category }, { parent: { slug: query.category } }] } })
  if (query.q) {
    and.push({
      OR: [
        { name: { contains: query.q, mode: 'insensitive' } },
        { sku: { contains: query.q, mode: 'insensitive' } },
        { model: { contains: query.q, mode: 'insensitive' } },
      ],
    })
  }
  return { AND: and }
}

const toImage = (row: { url: string; altText: string | null; position: number }): PublicImage => ({
  url: row.url,
  altText: row.altText,
  position: row.position,
})

export function toPublicProduct(row: ProductRow): PublicProduct {
  return {
    id: row.id,
    legacyId: row.legacyId,
    sku: row.sku,
    name: row.name,
    model: row.model,
    brand: row.brand && row.brand.active ? { id: row.brand.id, name: row.brand.name } : null,
    category: { slug: row.category.slug, name: row.category.name, parent: row.category.parent ? { ...row.category.parent } : null },
    price: toPublicPrice(row.priceMinor, row.currency),
    priceUnit: row.priceUnit,
    minOrderQuantity: row.minOrderQuantity,
    leadTime: row.leadTime,
    shortDescription: row.shortDescription,
    description: row.description,
    specs: toSpecs(row.specs),
    options: toOptions(row.options),
    applications: [...row.applications],
    tags: [...row.tags],
    certifications: [...row.certifications],
    featured: row.featured,
    demoOptions: row.demoOptions,
    isDemo: row.isDemo,
    images: row.images.map(toImage),
    variants: row.variants.map(variant => ({
      sku: variant.sku,
      optionValues: toOptionValues(variant.optionValues),
      price: variant.priceMinor === null ? null : toPublicPrice(variant.priceMinor, row.currency),
      purchasable: variant.purchasable,
      images: variant.images.map(toImage),
    })),
  }
}

export function createPrismaCatalogReader(prisma: PrismaClient): CatalogReader {
  return {
    async listProducts(query) {
      const where = productWhere(query)
      const [total, rows] = await prisma.$transaction([
        prisma.product.count({ where }),
        prisma.product.findMany({
          where,
          select: productSelect,
          orderBy: ORDER_BY[query.sort],
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
        }),
      ])
      return {
        items: rows.map(toPublicProduct),
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.ceil(total / query.pageSize),
      }
    },

    async listBrands() {
      const rows = await prisma.brand.findMany({
        where: { active: true },
        select: { id: true, name: true, nameLo: true, logoUrl: true, websiteUrl: true, displayOrder: true },
        orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }, { id: 'asc' }],
      })
      return rows.map(row => ({ ...row }))
    },
  }
}
