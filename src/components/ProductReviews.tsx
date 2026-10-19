import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth'
import { useCommerce } from '../commerce/CommerceProvider'
import { useToast } from './Toast'
import { StarDisplay, StarInput } from './StarRating'
import { UploadError, prepareReviewImage } from '../lib/imageUpload'
import {
  REVIEW_LIMITS, ReviewError, deleteReview, editReview, publicAuthorName, publicReviews, reviewEligibility,
  submitReview, summarizeReviews, type ReviewMedia,
} from '../lib/reviews'
import { getReviewState, setReviewState, useReviewState } from '../reviewsStore'

const NAVY = 'var(--nb-navy)'
const MUTED = 'var(--nb-text-secondary)'

const REASONS: Record<string, string> = {
  login_required: 'Sign in to write a review.',
  no_delivered_order: 'Only customers with a delivered order for this product can review it.',
  already_reviewed: 'You have already reviewed this product.',
}

export function RatingSummary({ productId, compact }: { productId: number; compact?: boolean }) {
  const { reviews } = useReviewState()
  const s = useMemo(() => summarizeReviews(reviews, productId), [reviews, productId])
  if (!s.count || s.average === null) return compact ? null : <span className="font-ui text-[12px]" style={{ color: MUTED }}>No reviews yet</span>
  return (
    <span className="inline-flex items-center gap-1.5 font-ui text-[12px]" style={{ color: MUTED }}>
      <StarDisplay value={s.average} size={compact ? 12 : 14} />
      <strong style={{ color: NAVY }}>{s.average.toFixed(1)}</strong>
      <span>({s.count})</span>
    </span>
  )
}

export default function ProductReviews({ productId }: { productId: number }) {
  const { user } = useAuth()
  const { db } = useCommerce()
  const { addToast } = useToast()
  const state = useReviewState()
  const summary = useMemo(() => summarizeReviews(state.reviews, productId), [state.reviews, productId])
  const published = useMemo(() => publicReviews(state.reviews, productId), [state.reviews, productId])
  const mine = state.reviews.find((r) => r.userId === user?.id && r.productId === productId && r.status !== 'deleted')
  const eligibility = reviewEligibility(user?.role === 'customer' ? user.id : undefined, productId, db.orders, state.reviews)

  const [editing, setEditing] = useState(false)
  const [rating, setRating] = useState(0)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [media, setMedia] = useState<ReviewMedia[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const keyRef = useRef(`rk-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`)
  const [showForm, setShowForm] = useState(false)

  const reset = () => {
    setRating(0); setTitle(''); setBody(''); setMedia([]); setError(''); setEditing(false); setShowForm(false)
    keyRef.current = `rk-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
  }

  const actor = user ? { id: user.id, role: user.role, name: publicAuthorName(user.firstName, user.lastName) } : null

  const onFiles = async (files: FileList | null) => {
    if (!files) return
    setError('')
    for (const file of Array.from(files)) {
      if (media.length >= REVIEW_LIMITS.maxMedia) { setError(`Attach at most ${REVIEW_LIMITS.maxMedia} images.`); break }
      try {
        const item = await prepareReviewImage(file)
        setMedia((m) => [...m, item].slice(0, REVIEW_LIMITS.maxMedia))
      } catch (e) {
        setError(e instanceof UploadError ? e.message : 'The file could not be added.')
      }
    }
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!actor || busy) return
    setBusy(true)
    try {
      const now = new Date()
      const current = getReviewState()
      if (editing && mine) {
        setReviewState(editReview(current, actor, mine.id, { rating, title, body, media }, now))
        addToast('Review updated and sent for moderation.', 'success')
      } else {
        const result = submitReview(current, actor, { productId, rating, title, body, media, idempotencyKey: keyRef.current }, db.orders, now)
        if (!result.duplicate) setReviewState(result.state)
        addToast('Thanks! Your review will appear once it is approved.', 'success')
      }
      reset()
    } catch (err) {
      setError(err instanceof ReviewError ? (REASONS[err.code] ?? err.message) : 'Your review could not be saved. Browser storage may be full.')
    } finally {
      setBusy(false)
    }
  }

  const startEdit = () => {
    if (!mine) return
    setRating(mine.rating); setTitle(mine.title); setBody(mine.body); setMedia(mine.media); setEditing(true); setShowForm(true); setError('')
  }

  const remove = () => {
    if (!mine || !actor) return
    if (!window.confirm('Delete your review?')) return
    try {
      setReviewState(deleteReview(getReviewState(), actor, mine.id, new Date()))
      addToast('Review deleted.', 'info')
    } catch {
      addToast('The review could not be deleted.', 'error')
    }
  }

  const maxBar = Math.max(1, ...Object.values(summary.distribution))

  return (
    <section aria-labelledby="reviews-heading" className="mt-10" data-testid="product-reviews">
      <h2 id="reviews-heading" className="font-display font-700 text-[22px] mb-4" style={{ color: NAVY }}>Customer Reviews</h2>
      <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
        <div className="rounded-lg bg-white p-5 self-start" style={{ border: '1px solid var(--nb-border)' }}>
          {summary.count && summary.average !== null ? (
            <>
              <div className="flex items-end gap-3">
                <span className="font-display font-800 text-[40px] leading-none" style={{ color: NAVY }}>{summary.average.toFixed(1)}</span>
                <div className="pb-1"><StarDisplay value={summary.average} size={16} /><div className="font-ui text-[12px] mt-1" style={{ color: MUTED }}>{summary.count} review{summary.count > 1 ? 's' : ''}</div></div>
              </div>
              <div className="mt-4 flex flex-col gap-1.5">
                {([5, 4, 3, 2, 1] as const).map((n) => (
                  <div key={n} className="flex items-center gap-2 font-ui text-[11px]" style={{ color: MUTED }}>
                    <span className="w-6">{n}★</span>
                    <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: '#E8EEF4' }}>
                      <div className="h-full" style={{ width: `${(summary.distribution[n] / maxBar) * 100}%`, background: '#D4AF37' }} />
                    </div>
                    <span className="w-6 text-right">{summary.distribution[n]}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="font-ui text-[13px]" style={{ color: MUTED }}>No reviews yet.</p>
          )}
        </div>

        <div className="flex flex-col gap-3 min-w-0">
          {mine && !showForm && (
            <div className="rounded-lg p-4 font-ui text-[12.5px]" style={{ background: 'var(--nb-light-blue)', color: NAVY }}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  Your review: <strong>{mine.status === 'published' ? 'Published' : mine.status === 'pending' ? 'Awaiting approval' : mine.status === 'rejected' ? 'Not approved' : 'Hidden by moderator'}</strong>
                </span>
                <span className="flex gap-3">
                  <button type="button" onClick={startEdit} className="underline font-600">Edit</button>
                  <button type="button" onClick={remove} className="underline font-600" style={{ color: '#991B1B' }}>Delete</button>
                </span>
              </div>
            </div>
          )}

          {!mine && !showForm && (
            eligibility.eligible ? (
              <button type="button" onClick={() => setShowForm(true)} className="rounded-md self-start font-ui text-[13px] font-600 px-5 min-h-11 text-white" style={{ background: 'var(--nb-primary-deep)' }}>Write a review</button>
            ) : (
              <div className="rounded-lg bg-white p-4" style={{ border: '1px dashed var(--nb-border)' }} data-testid="review-locked">
                <div className="font-ui text-[12px] font-600 mb-1" style={{ color: NAVY }}>Rate this product</div>
                <StarInput value={0} onChange={() => {}} size={24} disabled />
                <p className="font-ui text-[12.5px] mt-2" style={{ color: MUTED }}>
                  {eligibility.reason ? REASONS[eligibility.reason] : ''}{' '}
                  {eligibility.reason === 'login_required' && <Link to="/login" className="underline" style={{ color: 'var(--nb-primary-deep)' }}>Sign in</Link>}
                </p>
              </div>
            )
          )}

          {showForm && (
            <form onSubmit={submit} noValidate className="rounded-lg bg-white p-5 flex flex-col gap-3" style={{ border: '1px solid var(--nb-border)' }}>
              <div>
                <div className="font-ui text-[12px] font-600 mb-1" style={{ color: NAVY }}>Your rating</div>
                <StarInput value={rating} onChange={setRating} />
              </div>
              <label className="font-ui text-[12px] font-600" style={{ color: NAVY }}>Title (optional)
                <input value={title} maxLength={REVIEW_LIMITS.maxTitle} onChange={(e) => setTitle(e.target.value)} className="rounded-md mt-1 w-full px-3 min-h-10 text-[14px] font-400" style={{ border: '1px solid var(--nb-border)' }} />
              </label>
              <label className="font-ui text-[12px] font-600" style={{ color: NAVY }}>Review
                <textarea value={body} maxLength={REVIEW_LIMITS.maxBody} rows={4} onChange={(e) => setBody(e.target.value)} className="rounded-md mt-1 w-full px-3 py-2 text-[14px] font-400" style={{ border: '1px solid var(--nb-border)' }} />
              </label>
              <div>
                <label className="font-ui text-[12px] font-600 block" style={{ color: NAVY }}>Photos (JPEG, PNG or WebP, up to {REVIEW_LIMITS.maxMedia})
                  <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(e) => { void onFiles(e.target.files); e.target.value = '' }} className="mt-1 block font-ui text-[12px] font-400" />
                </label>
                <p className="font-ui text-[11px] mt-1" style={{ color: MUTED }}>Video uploads are not available yet.</p>
                {media.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {media.map((m) => (
                      <div key={m.id} className="relative">
                        <img src={m.dataUrl} alt={m.name} className="rounded-md object-cover w-16 h-16" />
                        <button type="button" aria-label={`Remove ${m.name}`} onClick={() => setMedia((x) => x.filter((i) => i.id !== m.id))} className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-white text-[11px] shadow" style={{ border: '1px solid var(--nb-border)' }}>✕</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {error && <p role="alert" className="font-ui text-[12px]" style={{ color: '#991B1B' }}>{error}</p>}
              <div className="flex gap-2">
                <button type="submit" disabled={busy} className="rounded-md font-ui text-[13px] font-600 px-5 min-h-11 text-white disabled:opacity-60" style={{ background: 'var(--nb-primary-deep)' }}>{editing ? 'Save changes' : 'Submit review'}</button>
                <button type="button" onClick={reset} className="rounded-md font-ui text-[13px] font-600 px-5 min-h-11" style={{ border: `1px solid ${NAVY}`, color: NAVY }}>Cancel</button>
              </div>
            </form>
          )}

          {published.map((r) => (
            <article key={r.id} className="rounded-lg bg-white p-4" style={{ border: '1px solid var(--nb-border)' }}>
              <div className="flex flex-wrap items-center gap-2">
                <StarDisplay value={r.rating} />
                {r.title && <h3 className="font-display font-700 text-[14px]" style={{ color: NAVY }}>{r.title}</h3>}
              </div>
              <p className="font-ui text-[13px] leading-relaxed mt-1.5 whitespace-pre-line break-words" style={{ color: '#374151' }}>{r.body}</p>
              {r.media.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {r.media.map((m) => <img key={m.id} src={m.dataUrl} alt="Customer photo" loading="lazy" className="rounded-md object-cover w-20 h-20" />)}
                </div>
              )}
              <div className="font-ui text-[11px] mt-2 flex flex-wrap gap-x-3" style={{ color: MUTED }}>
                <span>{r.authorName}</span>
                {r.verifiedPurchase && <span style={{ color: '#166534' }}>✓ Verified purchase</span>}
                <time dateTime={r.createdAt}>{r.createdAt.slice(0, 10)}</time>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
