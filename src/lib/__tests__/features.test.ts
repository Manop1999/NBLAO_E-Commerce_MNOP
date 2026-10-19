import { describe, expect, it } from 'vitest'
import { getStockStatus, isPurchasable } from '../stockStatus'
import {
  aggregateStock, combinations, hasVariants, isSelectionComplete, optionValueState, priceRange,
  pruneSelection, resolveVariant, validateVariants, type ProductVariant,
} from '../variants'
import {
  deleteReview, moderateReview, publicReviews, reviewEligibility, sniffImageType, submitReview,
  summarizeReviews, validateReviewInput, editReview, type OrderEvidence, type ReviewState,
} from '../reviews'
import { DEFAULT_LANG, mapLeaves, normalizeLang } from '../language'
import { pushToast, toastDuration } from '../toastQueue'
import { getRelatedProducts } from '../related'
import { PRODUCTS } from '../../data'
import { buildCatalogProducts } from '../../commerce/catalogEntries'

const v = (id: string, sku: string, options: Record<string, string>, stock: number, extra: Partial<ProductVariant> = {}): ProductVariant =>
  ({ id, sku, options, stock, active: true, visible: true, purchasable: true, ...extra })
const options = [{ name: 'Voltage', values: ['220V', '380V'] }, { name: 'Color', values: ['Red', 'Blue'] }]
const variants = [
  v('a', 'X-220-R', { Voltage: '220V', Color: 'Red' }, 10),
  v('b', 'X-220-B', { Voltage: '220V', Color: 'Blue' }, 0),
  v('c', 'X-380-R', { Voltage: '380V', Color: 'Red' }, 2, { price: 150 }),
  v('d', 'X-380-B', { Voltage: '380V', Color: 'Blue' }, 7, { active: false }),
]
const vp = { price: 100, stock: 0, options, variants }

describe('stock status', () => {
  it('maps real stock to statuses', () => {
    expect(getStockStatus({ stock: 20 })).toBe('in')
    expect(getStockStatus({ stock: 5 })).toBe('low')
    expect(getStockStatus({ stock: 0 })).toBe('out')
    expect(getStockStatus({ stock: 20, active: false })).toBe('unavailable')
    expect(getStockStatus({ stock: undefined })).toBe('unknown')
  })
  it('only in/low are purchasable', () => {
    expect(isPurchasable({ stock: 1 })).toBe(true)
    expect(isPurchasable({ stock: 0 })).toBe(false)
    expect(isPurchasable({ stock: 9, active: false })).toBe(false)
  })
})

describe('variants', () => {
  it('aggregates only active purchasable stock', () => expect(aggregateStock(vp)).toBe(12))
  it('computes price range from visible variants', () => expect(priceRange(vp)).toEqual({ min: 100, max: 150 }))
  it('requires all options and resolves variant', () => {
    expect(isSelectionComplete(vp, { Voltage: '220V' })).toBe(false)
    expect(resolveVariant(vp, { Voltage: '220V', Color: 'Red' })?.id).toBe('a')
    expect(resolveVariant(vp, { Voltage: '380V', Color: 'Blue' })).toBeUndefined()
  })
  it('flags out-of-stock and invalid values', () => {
    expect(optionValueState(vp, { Voltage: '220V' }, 'Color', 'Blue')).toBe('out_of_stock')
    expect(optionValueState(vp, { Voltage: '380V' }, 'Color', 'Blue')).toBe('invalid')
    expect(optionValueState(vp, { Voltage: '220V' }, 'Color', 'Red')).toBe('available')
  })
  it('prunes incompatible selections', () => {
    expect(pruneSelection(vp, { Voltage: '220V', Color: 'Blue' }, 'Voltage')).toEqual({ Voltage: '220V', Color: 'Blue' })
  })
  it('detects duplicate / conflicting / missing SKUs', () => {
    const dup = [v('a', 'S1', { Voltage: '220V', Color: 'Red' }, 1), v('b', 'S1', { Voltage: '380V', Color: 'Red' }, 1)]
    expect(validateVariants(options, dup).map((i) => i.code)).toContain('sku_duplicate')
    expect(validateVariants(options, [dup[0]], ['s1']).map((i) => i.code)).toContain('sku_conflict')
    expect(validateVariants(options, [v('z', ' ', { Voltage: '220V', Color: 'Red' }, 1)]).map((i) => i.code)).toContain('sku_required')
    expect(validateVariants(options, variants)).toEqual([])
  })
  it('generates combinations', () => expect(combinations(options)).toHaveLength(4))
  it('non-variant products pass through', () => expect(hasVariants({ options: [], variants: [] })).toBe(false))
})

describe('catalog entries', () => {
  it('creates one row per variant plus a base row requiring a variant', () => {
    const base = { ...PRODUCTS[0], options, variants }
    const rows = buildCatalogProducts([base])
    expect(rows).toHaveLength(5)
    expect(rows.filter((r) => r.variantId)).toHaveLength(4)
    expect(rows.find((r) => !r.variantId)?.requiresVariant).toBe(true)
  })
  it('inactive product is not purchasable', () => {
    const rows = buildCatalogProducts([{ ...PRODUCTS[0], active: false }])
    expect(rows.every((r) => r.purchasable === false)).toBe(true)
  })
})

describe('reviews', () => {
  const empty: ReviewState = { reviews: [], audit: [] }
  const customer = { id: 'u1', role: 'customer' as const, name: 'John Doe' }
  const admin = { id: 'admin', role: 'admin' as const }
  const orders: OrderEvidence[] = [{ id: 'O1', customerId: 'u1', status: 'Delivered', lines: [{ productId: 1 }] }]
  const input = { productId: 1, rating: 5, body: 'Works really well in our plant.', idempotencyKey: 'k1' }
  const now = new Date('2026-10-14T00:00:00Z')

  it('validates input', () => {
    expect(validateReviewInput({ rating: 0, body: 'long enough text here' })).toHaveProperty('rating')
    expect(validateReviewInput({ rating: 3, body: 'short' })).toHaveProperty('body')
    expect(validateReviewInput({ rating: 3, body: 'long enough text here' })).toEqual({})
  })
  it('sniffs real image types, not extensions', () => {
    expect(sniffImageType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg')
    expect(sniffImageType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe('image/png')
    expect(sniffImageType(new TextEncoder().encode('<svg></svg>'))).toBeNull()
  })
  it('needs a delivered order to review', () => {
    expect(reviewEligibility('u1', 1, [], []).eligible).toBe(false)
    expect(reviewEligibility(undefined, 1, orders, []).reason).toBe('login_required')
    expect(reviewEligibility('u1', 1, orders, []).eligible).toBe(true)
  })
  it('is idempotent and starts pending', () => {
    const a = submitReview(empty, customer, input, orders, now)
    expect(a.review.status).toBe('pending')
    expect(a.review.verifiedPurchase).toBe(true)
    const b = submitReview(a.state, customer, input, orders, now)
    expect(b.duplicate).toBe(true)
    expect(b.state.reviews).toHaveLength(1)
  })
  it('rejects review without a delivered order', () => {
    expect(() => submitReview(empty, customer, input, [], now)).toThrow()
  })
  it('only published reviews count publicly; no private fields leak', () => {
    const a = submitReview(empty, customer, input, orders, now)
    expect(summarizeReviews(a.state.reviews, 1)).toMatchObject({ count: 0, average: null })
    const pub = moderateReview(a.state, admin, a.review.id, 'approve', '', now)
    expect(summarizeReviews(pub.reviews, 1)).toMatchObject({ count: 1, average: 5 })
    const out = publicReviews(pub.reviews, 1)[0] as unknown as Record<string, unknown>
    expect(out.userId).toBeUndefined()
    expect(out.orderId).toBeUndefined()
    expect(out.idempotencyKey).toBeUndefined()
    expect(pub.audit.length).toBeGreaterThan(0)
  })
  it('enforces moderation rules', () => {
    const a = submitReview(empty, customer, input, orders, now)
    expect(() => moderateReview(a.state, customer as never, a.review.id, 'approve', '', now)).toThrow()
    expect(() => moderateReview(a.state, admin, a.review.id, 'hide', '', now)).toThrow()
    const hidden = moderateReview(moderateReview(a.state, admin, a.review.id, 'approve', '', now), admin, a.review.id, 'hide', 'spam', now)
    expect(summarizeReviews(hidden.reviews, 1).count).toBe(0)
    expect(moderateReview(hidden, admin, a.review.id, 'restore', '', now).reviews[0].status).toBe('published')
  })
  it('owner edit returns to pending; only owner or admin can delete', () => {
    const a = submitReview(empty, customer, input, orders, now)
    const pub = moderateReview(a.state, admin, a.review.id, 'approve', '', now)
    const ed = editReview(pub, customer, a.review.id, { rating: 4, body: 'Updated review text here.' }, now)
    expect(ed.reviews[0].status).toBe('pending')
    expect(() => deleteReview(ed, { id: 'u2', role: 'customer' }, a.review.id, now)).toThrow()
    expect(deleteReview(ed, customer, a.review.id, now).reviews[0].status).toBe('deleted')
  })
})

describe('language', () => {
  it('falls back to default on invalid values', () => {
    expect(normalizeLang('th')).toBe('th')
    expect(normalizeLang('fr')).toBe(DEFAULT_LANG)
    expect(normalizeLang(null)).toBe(DEFAULT_LANG)
  })
  it('maps leaves with English fallback', () => {
    expect(mapLeaves({ a: 'Hello', b: { c: 'Unknown' } }, { Hello: 'สวัสดี' })).toEqual({ a: 'สวัสดี', b: { c: 'Unknown' } })
  })
})

describe('toast queue', () => {
  it('consolidates repeats and replaces different toasts', () => {
    const a = pushToast(null, 'Added', 'success', '1')
    const b = pushToast(a, 'Added', 'success', '2')
    expect(b).toMatchObject({ id: '1', count: 2, nonce: 1 })
    expect(pushToast(b, 'Oops', 'error', '3')).toMatchObject({ id: '3', count: 1 })
  })
  it('errors last longer than success', () => {
    expect(toastDuration('success')).toBe(3000)
    expect(toastDuration('error')).toBeGreaterThan(toastDuration('success'))
  })
})

describe('related products', () => {
  it('excludes self, inactive and unrelated', () => {
    const base = PRODUCTS[0]
    const rel = getRelatedProducts(base, [...PRODUCTS, { ...PRODUCTS[1], id: 9999, active: false }])
    expect(rel.find((p) => p.id === base.id)).toBeUndefined()
    expect(rel.find((p) => p.id === 9999)).toBeUndefined()
    expect(rel.every((p) => p.category === base.category || p.applications.some((a) => base.applications.includes(a)))).toBe(true)
  })
})
