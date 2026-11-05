/**
 * 2FA failure handling that cannot be turned into a denial of service against a colleague (plan review, Phase 1E).
 *
 * Layers (none of them touches the password lockout, and none of them disables mandatory 2FA):
 * 1. Challenge: a sign-in challenge (session) ends after 5 wrong codes; the person signs in again.
 * 2. Account + source: 10 wrong codes for one account from one source address within 15 minutes block 2FA for
 *    that account *from that source only* for 15 minutes, doubling on each repeat (max 24 h). Other sources and
 *    the account's existing sessions are unaffected. Persisted in PostgreSQL (mfa_throttles); the source address
 *    is stored only as a labelled SHA-256 digest.
 * 3. Rate limits: per source address on every 2FA route (@fastify/rate-limit) and per account + source burst limit
 *    (in memory; see lockout.ts for the production caveat).
 * 4. Monitoring: an account-wide failure counter only raises audited alerts; it never blocks.
 *
 * A correct code from a source clears that source's throttle; a Super Admin 2FA reset clears all of them.
 * Behind a reverse proxy the source address needs a correct `trustProxy` setting (Phase 1H launch blocker).
 */
import { createHash } from 'node:crypto'
import type { Db } from './context.ts'

export const MFA_SOURCE_THRESHOLD = 10
export const MFA_SOURCE_WINDOW_MS = 15 * 60_000
export const MFA_SOURCE_BLOCK_BASE_MS = 15 * 60_000
export const MFA_SOURCE_BLOCK_MAX_MS = 24 * 60 * 60_000
/** Account-wide failures between audited alerts (monitoring only). */
export const MFA_ALERT_EVERY = 20

export function sourceHash(address: string): Uint8Array<ArrayBuffer> {
  return new Uint8Array(createHash('sha256').update(`nblao-source-v1:${address}`, 'utf8').digest())
}

export function sourceBlockDurationMs(previousBlocks: number): number {
  return Math.min(MFA_SOURCE_BLOCK_BASE_MS * 2 ** Math.min(previousBlocks, 20), MFA_SOURCE_BLOCK_MAX_MS)
}

const key = (staffId: string, address: string) => ({ staffId_sourceHash: { staffId, sourceHash: sourceHash(address) } })

/** The time until which this source is blocked for this account, or null. */
export async function sourceBlockedUntil(db: Db, staffId: string, address: string, now: Date): Promise<Date | null> {
  const row = await db.mfaThrottle.findUnique({ where: key(staffId, address), select: { blockedUntil: true } })
  return row?.blockedUntil && row.blockedUntil > now ? row.blockedUntil : null
}

/** Counts one wrong code from `address`; returns the new block end when this failure triggered a block. */
export async function recordSourceFailure(db: Db, staffId: string, address: string, now: Date): Promise<{ failedCount: number; blockedUntil: Date | null }> {
  let row = await db.mfaThrottle.upsert({
    where: key(staffId, address),
    create: { staffId, sourceHash: sourceHash(address), failedCount: 1, windowStart: now },
    update: { failedCount: { increment: 1 } },
  })
  if (now.getTime() - row.windowStart.getTime() > MFA_SOURCE_WINDOW_MS) {
    // The window has passed (or a block has ended): start counting again from this failure.
    row = await db.mfaThrottle.update({ where: { id: row.id }, data: { failedCount: 1, windowStart: now } })
  }
  if (row.failedCount < MFA_SOURCE_THRESHOLD) return { failedCount: row.failedCount, blockedUntil: null }
  const blockedUntil = new Date(now.getTime() + sourceBlockDurationMs(row.blockCount))
  await db.mfaThrottle.update({ where: { id: row.id }, data: { failedCount: 0, windowStart: now, blockCount: { increment: 1 }, blockedUntil } })
  return { failedCount: row.failedCount, blockedUntil }
}

/** A correct code from this source: forget its failures and blocks. */
export async function clearSource(db: Db, staffId: string, address: string): Promise<void> {
  await db.mfaThrottle.deleteMany({ where: { staffId, sourceHash: sourceHash(address) } })
}

/** Super Admin / CLI 2FA reset: forget every source throttle and the monitoring counter of the account. */
export async function clearAllForAccount(db: Db, staffId: string): Promise<void> {
  await db.mfaThrottle.deleteMany({ where: { staffId } })
  await db.staffUser.update({ where: { id: staffId }, data: { mfaFailedCount: 0, mfaLockedUntil: null } })
}
