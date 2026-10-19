/** Pure review domain logic: validation, eligibility, moderation, aggregation. No React / storage. */

export type ReviewStatus = 'pending' | 'published' | 'rejected' | 'hidden' | 'deleted'
export type ModerationAction = 'approve' | 'reject' | 'hide' | 'restore'

export interface ReviewMedia {
  id: string
  kind: 'image'
  mime: 'image/jpeg' | 'image/png' | 'image/webp'
  size: number
  dataUrl: string
  name: string
}

export interface Review {
  id: string
  productId: number
  variantId?: string
  userId: string
  authorName: string
  rating: number
  title: string
  body: string
  media: ReviewMedia[]
  status: ReviewStatus
  verifiedPurchase: boolean
  orderId: string
  idempotencyKey: string
  createdAt: string
  updatedAt: string
  moderatedBy?: string
  moderatedAt?: string
  moderationNote?: string
}

export interface ReviewAuditEntry {
  id: string
  at: string
  actorId: string
  actorRole: 'customer' | 'admin'
  action: string
  reviewId: string
  summary: string
}

export interface ReviewState {
  reviews: Review[]
  audit: ReviewAuditEntry[]
}

export interface ReviewActor {
  id: string
  role: 'customer' | 'admin'
  name?: string
}

export const REVIEW_LIMITS = {
  minBody: 10,
  maxBody: 2000,
  maxTitle: 100,
  maxMedia: 3,
  maxImageBytes: 2 * 1024 * 1024,
  /** Reviews are stored in browser storage, so media is capped much lower than a real server would. */
  maxStoredMediaBytes: 600 * 1024,
} as const

export const ALLOWED_IMAGE_MIME = ['image/jpeg', 'image/png', 'image/webp'] as const

export class ReviewError extends Error {
  code: string
  constructor(code: string, message?: string) {
    super(message ?? code)
    this.code = code
  }
}

export interface ReviewInput {
  productId: number
  variantId?: string
  rating: number
  title?: string
  body: string
  media?: ReviewMedia[]
  idempotencyKey: string
}

export interface OrderEvidence {
  id: string
  customerId: string
  status: string
  lines: { productId: number }[]
}

/** Detect the real image type from the first bytes instead of trusting the file extension / declared MIME. */
export function sniffImageType(bytes: Uint8Array): (typeof ALLOWED_IMAGE_MIME)[number] | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg'
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  )
    return 'image/png'
  if (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' &&
    String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP'
  )
    return 'image/webp'
  return null
}

export function validateReviewInput(input: Pick<ReviewInput, 'rating' | 'title' | 'body' | 'media'>): Record<string, string> {
  const errors: Record<string, string> = {}
  if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) errors.rating = 'Choose a rating from 1 to 5 stars.'
  const body = (input.body ?? '').trim()
  if (body.length < REVIEW_LIMITS.minBody) errors.body = `Write at least ${REVIEW_LIMITS.minBody} characters.`
  else if (body.length > REVIEW_LIMITS.maxBody) errors.body = `Keep the review under ${REVIEW_LIMITS.maxBody} characters.`
  if ((input.title ?? '').trim().length > REVIEW_LIMITS.maxTitle) errors.title = `Keep the title under ${REVIEW_LIMITS.maxTitle} characters.`
  const media = input.media ?? []
  if (media.length > REVIEW_LIMITS.maxMedia) errors.media = `Attach at most ${REVIEW_LIMITS.maxMedia} images.`
  else if (
    media.some(
      (m) => !(ALLOWED_IMAGE_MIME as readonly string[]).includes(m.mime) || m.size > REVIEW_LIMITS.maxStoredMediaBytes || !m.dataUrl.startsWith(`data:${m.mime};base64,`),
    )
  )
    errors.media = 'Only JPEG, PNG or WebP images within the size limit are accepted.'
  return errors
}

export interface Eligibility {
  eligible: boolean
  verifiedPurchase: boolean
  orderId?: string
  reason?: 'login_required' | 'no_delivered_order' | 'already_reviewed'
}

/** Purchase evidence: a Delivered order of this customer containing the product. */
export function reviewEligibility(
  userId: string | undefined,
  productId: number,
  orders: OrderEvidence[],
  reviews: Review[],
): Eligibility {
  if (!userId) return { eligible: false, verifiedPurchase: false, reason: 'login_required' }
  const order = orders.find(
    (o) => o.customerId === userId && o.status === 'Delivered' && o.lines.some((l) => l.productId === productId),
  )
  if (!order) return { eligible: false, verifiedPurchase: false, reason: 'no_delivered_order' }
  if (reviews.some((r) => r.userId === userId && r.productId === productId && r.status !== 'deleted'))
    return { eligible: false, verifiedPurchase: true, orderId: order.id, reason: 'already_reviewed' }
  return { eligible: true, verifiedPurchase: true, orderId: order.id }
}

/** "John Doe" -> "John D." so the public never sees full names. */
export function publicAuthorName(first: string, last: string): string {
  const f = first.trim()
  const l = last.trim()
  if (!f) return 'Customer'
  return l ? `${f} ${l[0].toUpperCase()}.` : f
}

let seq = 0
const nextId = (prefix: string, now: Date) => `${prefix}-${now.getTime().toString(36)}${(seq++).toString(36)}`

function audit(state: ReviewState, actor: ReviewActor, now: Date, action: string, reviewId: string, summary: string): ReviewState {
  return {
    ...state,
    audit: [
      ...state.audit,
      { id: nextId('ra', now), at: now.toISOString(), actorId: actor.id, actorRole: actor.role, action, reviewId, summary },
    ],
  }
}

export function submitReview(
  state: ReviewState,
  actor: ReviewActor,
  input: ReviewInput,
  orders: OrderEvidence[],
  now: Date,
): { state: ReviewState; review: Review; duplicate: boolean } {
  if (actor.role !== 'customer') throw new ReviewError('forbidden', 'Only customers can submit reviews.')
  const prior = state.reviews.find((r) => r.idempotencyKey === input.idempotencyKey && r.userId === actor.id)
  if (prior) return { state, review: prior, duplicate: true }
  const errors = validateReviewInput(input)
  if (Object.keys(errors).length) throw new ReviewError('invalid', Object.values(errors)[0])
  const eligibility = reviewEligibility(actor.id, input.productId, orders, state.reviews)
  if (!eligibility.eligible) throw new ReviewError(eligibility.reason ?? 'not_eligible')
  const review: Review = {
    id: nextId('rev', now),
    productId: input.productId,
    variantId: input.variantId,
    userId: actor.id,
    authorName: actor.name || 'Customer',
    rating: input.rating,
    title: (input.title ?? '').trim(),
    body: input.body.trim(),
    media: input.media ?? [],
    status: 'pending',
    verifiedPurchase: eligibility.verifiedPurchase,
    orderId: eligibility.orderId as string,
    idempotencyKey: input.idempotencyKey,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  }
  const next = audit({ ...state, reviews: [review, ...state.reviews] }, actor, now, 'review.submit', review.id, `${review.rating}★ review submitted for product ${review.productId}`)
  return { state: next, review, duplicate: false }
}

function findOwned(state: ReviewState, actor: ReviewActor, id: string): Review {
  const review = state.reviews.find((r) => r.id === id)
  if (!review || review.status === 'deleted') throw new ReviewError('not_found')
  if (review.userId !== actor.id) throw new ReviewError('forbidden', 'You can only change your own review.')
  return review
}

/** Editing returns a review to moderation so changed content is never published unreviewed. */
export function editReview(
  state: ReviewState,
  actor: ReviewActor,
  id: string,
  patch: Pick<ReviewInput, 'rating' | 'title' | 'body' | 'media'>,
  now: Date,
): ReviewState {
  const review = findOwned(state, actor, id)
  const errors = validateReviewInput(patch)
  if (Object.keys(errors).length) throw new ReviewError('invalid', Object.values(errors)[0])
  const updated: Review = {
    ...review,
    rating: patch.rating,
    title: (patch.title ?? '').trim(),
    body: patch.body.trim(),
    media: patch.media ?? review.media,
    status: review.status === 'hidden' ? 'hidden' : 'pending',
    updatedAt: now.toISOString(),
  }
  return audit({ ...state, reviews: state.reviews.map((r) => (r.id === id ? updated : r)) }, actor, now, 'review.edit', id, 'Review edited by owner')
}

export function deleteReview(state: ReviewState, actor: ReviewActor, id: string, now: Date): ReviewState {
  const review = state.reviews.find((r) => r.id === id)
  if (!review || review.status === 'deleted') throw new ReviewError('not_found')
  if (actor.role !== 'admin' && review.userId !== actor.id) throw new ReviewError('forbidden')
  const reviews = state.reviews.map((r) => (r.id === id ? { ...r, status: 'deleted' as const, updatedAt: now.toISOString() } : r))
  return audit({ ...state, reviews }, actor, now, 'review.delete', id, `Review deleted by ${actor.role}`)
}

const MODERATION: Record<ModerationAction, { from: ReviewStatus[]; to: ReviewStatus }> = {
  approve: { from: ['pending', 'rejected'], to: 'published' },
  reject: { from: ['pending', 'published'], to: 'rejected' },
  hide: { from: ['published'], to: 'hidden' },
  restore: { from: ['hidden', 'rejected'], to: 'published' },
}

export function moderateReview(
  state: ReviewState,
  actor: ReviewActor,
  id: string,
  action: ModerationAction,
  note: string,
  now: Date,
): ReviewState {
  if (actor.role !== 'admin') throw new ReviewError('forbidden', 'Admin access required.')
  const review = state.reviews.find((r) => r.id === id)
  if (!review) throw new ReviewError('not_found')
  const rule = MODERATION[action]
  if (!rule.from.includes(review.status)) throw new ReviewError('transition_invalid', `Cannot ${action} a ${review.status} review.`)
  const reviews = state.reviews.map((r) =>
    r.id === id ? { ...r, status: rule.to, moderatedBy: actor.id, moderatedAt: now.toISOString(), moderationNote: note.trim() || undefined } : r,
  )
  return audit({ ...state, reviews }, actor, now, `review.${action}`, id, `${review.status} → ${rule.to}${note.trim() ? ` (${note.trim()})` : ''}`)
}

export interface ReviewSummary {
  count: number
  average: number | null
  distribution: Record<1 | 2 | 3 | 4 | 5, number>
}

/** Public numbers come from published reviews only; no reviews => null average, never a fabricated one. */
export function summarizeReviews(reviews: Review[], productId: number): ReviewSummary {
  const distribution: ReviewSummary['distribution'] = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  let total = 0
  let count = 0
  for (const r of reviews) {
    if (r.productId !== productId || r.status !== 'published') continue
    distribution[r.rating as 1 | 2 | 3 | 4 | 5] += 1
    total += r.rating
    count += 1
  }
  return { count, average: count ? Math.round((total / count) * 10) / 10 : null, distribution }
}

export type PublicReview = Pick<Review, 'id' | 'productId' | 'authorName' | 'rating' | 'title' | 'body' | 'media' | 'verifiedPurchase' | 'createdAt'>

/** Published reviews with private fields (user id, order id, idempotency key, moderation data) removed. */
export function publicReviews(reviews: Review[], productId: number): PublicReview[] {
  return reviews
    .filter((r) => r.productId === productId && r.status === 'published')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(({ id, productId: pid, authorName, rating, title, body, media, verifiedPurchase, createdAt }) => ({
      id, productId: pid, authorName, rating, title, body, media, verifiedPurchase, createdAt,
    }))
}
