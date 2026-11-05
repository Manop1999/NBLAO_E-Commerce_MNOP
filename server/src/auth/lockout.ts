/**
 * Account lockout after repeated failures (plan §4): 5 failures lock the account for 15 minutes, each further
 * failure doubles the lock, up to 24 hours. A successful sign-in resets the counter.
 *
 * Also a small in-memory attempt limiter used per email address and per account for 2FA (the per-IP limits are
 * @fastify/rate-limit, also in memory).
 *
 * NOT PRODUCTION-SAFE: in-memory counters reset whenever the process restarts and are not shared between
 * processes or servers, so an attacker spreading attempts across restarts or instances is not limited by them.
 * That is acceptable only for this local, single-process development server (config.ts refuses any NODE_ENV
 * other than development/test). A shared store (for example Redis or PostgreSQL) is a mandatory Phase 1H
 * production launch blocker. The database lockouts (password and 2FA) persist and are shared regardless.
 */
export const LOCKOUT_THRESHOLD = 5
export const LOCKOUT_BASE_MS = 15 * 60_000
export const LOCKOUT_MAX_MS = 24 * 60 * 60_000

// Two-factor failures never use this password lockout; see mfaThrottle.ts.

/** Lock duration after `failedCount` consecutive failures, or 0 while below the threshold. */
export function lockoutDurationMs(failedCount: number, threshold = LOCKOUT_THRESHOLD): number {
  if (failedCount < threshold) return 0
  const doublings = Math.min(failedCount - threshold, 20)
  return Math.min(LOCKOUT_BASE_MS * 2 ** doublings, LOCKOUT_MAX_MS)
}

export function isLocked(account: { lockedUntil: Date | null }, now: Date): boolean {
  return account.lockedUntil !== null && account.lockedUntil > now
}

/** Values to store after one more failure. */
export function recordFailure(account: { failedLoginCount: number }, now: Date): { failedLoginCount: number; lockedUntil: Date | null } {
  const failedLoginCount = account.failedLoginCount + 1
  const duration = lockoutDurationMs(failedLoginCount)
  return { failedLoginCount, lockedUntil: duration > 0 ? new Date(now.getTime() + duration) : null }
}

export class AttemptLimiter {
  private readonly attempts = new Map<string, number[]>()

  constructor(
    readonly max: number,
    readonly windowMs: number,
  ) {}

  /** Records an attempt for `key`; returns false when the key is over the limit (the attempt is not counted). */
  take(key: string, nowMs: number): boolean {
    const recent = (this.attempts.get(key) ?? []).filter(at => nowMs - at < this.windowMs)
    if (recent.length >= this.max) {
      this.attempts.set(key, recent)
      return false
    }
    recent.push(nowMs)
    this.attempts.set(key, recent)
    if (this.attempts.size > 10_000) this.prune(nowMs)
    return true
  }

  private prune(nowMs: number): void {
    for (const [key, times] of this.attempts) {
      if (times.every(at => nowMs - at >= this.windowMs)) this.attempts.delete(key)
    }
  }
}
