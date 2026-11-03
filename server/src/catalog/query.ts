/**
 * Query contracts for the public catalog endpoints. Unknown parameters, repeated parameters and malformed
 * values are rejected (400) instead of being ignored, so clients cannot rely on accidental behaviour.
 */
import { z } from 'zod'
import { invalidQuery, type ApiIssue } from '../errors.ts'

export const MAX_PAGE_SIZE = 100
export const DEFAULT_PAGE_SIZE = 24
/** Upper bound for `page` so offsets stay reasonable. */
export const MAX_PAGE = 100_000
export const MAX_SEARCH_LENGTH = 100
export const PRODUCT_SORTS = ['featured', 'price_asc', 'price_desc', 'name_asc'] as const
export type ProductSort = (typeof PRODUCT_SORTS)[number]

/** Plain decimal digits only: rejects "1.5", "1e2", " 3", "-1" and "0x10". */
const integerParam = (min: number, max: number) =>
  z
    .string()
    .regex(/^\d{1,9}$/, 'must be a whole number')
    .transform(Number)
    .pipe(z.number().int().min(min).max(max))

const productListSchema = z.strictObject({
  page: integerParam(1, MAX_PAGE).optional(),
  pageSize: integerParam(1, MAX_PAGE_SIZE).optional(),
  sort: z.enum(PRODUCT_SORTS).optional(),
  // Category slugs as stored by the seed: "electrical-equipment" or "electrical-equipment/transformers".
  category: z
    .string()
    .max(200)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)?$/, 'must be a category slug')
    .optional(),
  brand: z
    .string()
    .regex(/^[A-Za-z0-9_-]{1,100}$/, 'must be a brand id')
    .optional(),
  q: z.string().max(MAX_SEARCH_LENGTH).optional(),
})

export interface ProductListQuery {
  page: number
  pageSize: number
  sort: ProductSort
  category: string | undefined
  brand: string | undefined
  q: string | undefined
}

const toIssues = (error: z.ZodError): ApiIssue[] =>
  error.issues.map(issue => ({ path: issue.path.join('.') || 'query', message: issue.message }))

export function parseProductListQuery(raw: unknown): ProductListQuery {
  const result = productListSchema.safeParse(raw ?? {})
  if (!result.success) throw invalidQuery(toIssues(result.error))
  const value = result.data
  const q = value.q?.trim()
  return {
    page: value.page ?? 1,
    pageSize: value.pageSize ?? DEFAULT_PAGE_SIZE,
    sort: value.sort ?? 'featured',
    category: value.category,
    brand: value.brand,
    q: q ? q : undefined,
  }
}

/** `/api/brands` takes no parameters. */
export function parseBrandListQuery(raw: unknown): void {
  const result = z.strictObject({}).safeParse(raw ?? {})
  if (!result.success) throw invalidQuery(toIssues(result.error))
}
