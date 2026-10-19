import { useSyncExternalStore } from 'react'
import type { ReviewState } from './lib/reviews'

export const REVIEWS_KEY = 'nblao_reviews'
const EMPTY: ReviewState = { reviews: [], audit: [] }

function read(): ReviewState {
  try {
    const raw = localStorage.getItem(REVIEWS_KEY)
    if (!raw) return EMPTY
    const parsed = JSON.parse(raw)
    if (!parsed || !Array.isArray(parsed.reviews)) return EMPTY
    return { reviews: parsed.reviews, audit: Array.isArray(parsed.audit) ? parsed.audit : [] }
  } catch {
    return EMPTY
  }
}

let snapshot: ReviewState = read()
const listeners = new Set<() => void>()

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === REVIEWS_KEY) {
      snapshot = read()
      listeners.forEach((l) => l())
    }
  })
}

export const getReviewState = () => snapshot

/** Persist (throws if browser storage rejects the write, e.g. quota) and notify subscribers. */
export function setReviewState(next: ReviewState) {
  localStorage.setItem(REVIEWS_KEY, JSON.stringify(next))
  snapshot = next
  listeners.forEach((l) => l())
}

export function useReviewState(): ReviewState {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => snapshot,
  )
}
