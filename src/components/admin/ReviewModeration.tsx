import { useMemo, useState } from 'react'
import { useStore } from '../../store'
import { getReviewState, setReviewState, useReviewState } from '../../reviewsStore'
import { moderateReview, deleteReview, ReviewError, type ModerationAction, type ReviewStatus } from '../../lib/reviews'
import { StarDisplay } from '../StarRating'

const NAVY = 'var(--nb-navy)'
const STATUS_COLOR: Record<string, [string, string]> = {
  pending: ['#92400E', '#FEF3C7'], published: ['#166534', '#DCFCE7'], rejected: ['#991B1B', '#FEE2E2'],
  hidden: ['#475569', '#E2E8F0'], deleted: ['#475569', '#E2E8F0'],
}
const ACTIONS: Record<string, ModerationAction[]> = {
  pending: ['approve', 'reject'], published: ['hide', 'reject'], rejected: ['approve', 'restore'], hidden: ['restore'], deleted: [],
}
const ADMIN = { id: 'admin', role: 'admin' as const, name: 'Admin' }

export default function ReviewModeration() {
  const { allProducts: products } = useStore()
  const state = useReviewState()
  const [status, setStatus] = useState<'all' | ReviewStatus>('pending')
  const [productId, setProductId] = useState('all')
  const [rating, setRating] = useState('all')
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [error, setError] = useState('')
  const [showAudit, setShowAudit] = useState(false)

  const rows = useMemo(() => state.reviews
    .filter(r => (status === 'all' || r.status === status) && (productId === 'all' || String(r.productId) === productId) && (rating === 'all' || String(r.rating) === rating))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [state, status, productId, rating])
  const pending = state.reviews.filter(r => r.status === 'pending').length
  const name = (id: number) => products.find(p => p.id === id)?.name ?? `Product #${id}`

  const act = (id: string, action: ModerationAction | 'delete') => {
    try {
      const cur = getReviewState()
      const now = new Date()
      setReviewState(action === 'delete' ? deleteReview(cur, ADMIN, id, now) : moderateReview(cur, ADMIN, id, action, notes[id] ?? '', now))
      setError('')
    } catch (e) {
      setError(e instanceof ReviewError || e instanceof Error ? e.message : 'Action failed.')
    }
  }
  const sel = 'rounded-md font-ui text-[12px] px-3 py-2 bg-white'
  const selStyle = { border: '1px solid var(--nb-border)', color: NAVY }

  return (
    <div>
      <h2 className="font-display font-700 text-[22px]" style={{ color: NAVY }}>Review Moderation</h2>
      <p className="font-ui text-[12px] mt-1 mb-4 text-slate-500">
        {pending} pending. Only published reviews appear on product pages and count towards ratings. Reviews are stored in this browser (no backend).
      </p>
      <div className="flex flex-wrap gap-2 mb-4">
        <select aria-label="Status" value={status} onChange={e => setStatus(e.target.value as 'all' | ReviewStatus)} className={sel} style={selStyle}>
          {['all', 'pending', 'published', 'rejected', 'hidden', 'deleted'].map(s => <option key={s} value={s}>{s === 'all' ? 'All statuses' : s}</option>)}
        </select>
        <select aria-label="Product" value={productId} onChange={e => setProductId(e.target.value)} className={sel} style={selStyle}>
          <option value="all">All products</option>
          {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select aria-label="Rating" value={rating} onChange={e => setRating(e.target.value)} className={sel} style={selStyle}>
          <option value="all">All ratings</option>
          {[5, 4, 3, 2, 1].map(n => <option key={n} value={n}>{n} stars</option>)}
        </select>
        <button type="button" onClick={() => setShowAudit(v => !v)} className="rounded-md font-ui text-[12px] px-3 py-2 border border-slate-300 text-slate-600">{showAudit ? 'Hide audit log' : 'Audit log'}</button>
      </div>
      {error && <p role="alert" className="font-ui text-[12px] text-red-600 mb-3">{error}</p>}
      {showAudit && (
        <div className="rounded-lg bg-white mb-4 max-h-64 overflow-auto" style={{ border: '1px solid var(--nb-border)' }}>
          {state.audit.length === 0 ? <p className="p-4 font-ui text-[12px] text-slate-500">No audit entries yet.</p> :
            [...state.audit].reverse().map(a => <div key={a.id} className="px-4 py-2 font-ui text-[11px] border-b border-slate-100"><strong>{a.action}</strong> · {a.actorRole} · {new Date(a.at).toLocaleString()} · {a.summary}</div>)}
        </div>
      )}
      {rows.length === 0 ? <p className="font-ui text-[13px] text-slate-500">No reviews match these filters.</p> : (
        <div className="flex flex-col gap-3">
          {rows.map(r => {
            const [fg, bg] = STATUS_COLOR[r.status] ?? STATUS_COLOR.hidden
            return (
              <div key={r.id} className="rounded-lg bg-white p-4" style={{ border: '1px solid var(--nb-border)' }}>
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <StarDisplay value={r.rating} />
                  <span className="rounded-sm px-2 py-0.5 font-ui text-[10px] font-700 uppercase" style={{ background: bg, color: fg }}>{r.status}</span>
                  {r.verifiedPurchase && <span className="font-ui text-[10px] font-700" style={{ color: '#166534' }}>Verified purchase</span>}
                  <span className="font-ui text-[11px] text-slate-500 ml-auto">{r.authorName} · {new Date(r.createdAt).toLocaleDateString()}</span>
                </div>
                <div className="font-ui text-[12px] font-600" style={{ color: NAVY }}>{name(r.productId)}{r.variantId ? ` (variant ${r.variantId})` : ''}</div>
                {r.title && <div className="font-ui text-[13px] font-600 mt-1" style={{ color: NAVY }}>{r.title}</div>}
                <p className="font-ui text-[13px] mt-1 break-words" style={{ color: 'var(--nb-text-secondary)' }}>{r.body}</p>
                {r.media.length > 0 && <div className="flex gap-2 mt-2">{r.media.map(m => <img key={m.id} src={m.dataUrl} alt={m.name} className="w-16 h-16 object-cover rounded-md" />)}</div>}
                {r.moderationNote && <p className="font-ui text-[11px] mt-2 text-slate-500">Note: {r.moderationNote}</p>}
                <div className="flex flex-wrap items-center gap-2 mt-3">
                  <input aria-label="Moderation note" placeholder="Note (optional)" value={notes[r.id] ?? ''} onChange={e => setNotes(n => ({ ...n, [r.id]: e.target.value }))} className="rounded-md font-ui text-[12px] px-3 py-1.5 flex-1 min-w-40" style={selStyle} />
                  {ACTIONS[r.status].map(a => <button key={a} type="button" onClick={() => act(r.id, a)} className="rounded-sm font-ui text-[11px] px-3 py-1.5 border border-slate-300 text-slate-700 capitalize">{a}</button>)}
                  {r.status !== 'deleted' && <button type="button" onClick={() => window.confirm('Delete this review?') && act(r.id, 'delete')} className="rounded-sm font-ui text-[11px] px-3 py-1.5 border border-red-200 text-red-600">Delete</button>}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
