/**
 * Server-side sessions (plan §4). The cookie carries a random token; the database stores its SHA-256 only.
 * Idle and absolute expiry and revocation are decided here, never by the browser.
 */
import type { SessionStage, SubjectType } from '../generated/prisma/client.ts'
import type { Db } from './context.ts'
import { generateToken, hashToken, isWellFormedToken } from './tokens.ts'

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

export interface SessionPolicy {
  idleMs: number
  absoluteMs: number
  /** Persistent cookie lifetime; undefined = browser-session cookie. */
  cookieMaxAgeSeconds: number | undefined
}

export const STAFF_SESSION: SessionPolicy = { idleMs: 30 * MINUTE, absoluteMs: 12 * HOUR, cookieMaxAgeSeconds: undefined }
export const CUSTOMER_SESSION: SessionPolicy = { idleMs: 2 * HOUR, absoluteMs: 12 * HOUR, cookieMaxAgeSeconds: undefined }
export const CUSTOMER_REMEMBERED_SESSION: SessionPolicy = { idleMs: 7 * DAY, absoluteMs: 30 * DAY, cookieMaxAgeSeconds: 30 * 24 * 60 * 60 }

/** How recently 2FA must have been verified for sensitive actions (step-up). */
export const STEP_UP_WINDOW_MS = 5 * MINUTE
/** Wrong 2FA codes allowed per session before it is revoked. */
export const MAX_MFA_ATTEMPTS_PER_SESSION = 5

export function sessionPolicy(subjectType: SubjectType, rememberMe: boolean): SessionPolicy {
  if (subjectType === 'STAFF') return STAFF_SESSION
  return rememberMe ? CUSTOMER_REMEMBERED_SESSION : CUSTOMER_SESSION
}

export type SessionSubject = { subjectType: 'STAFF'; staffId: string } | { subjectType: 'CUSTOMER'; customerId: string }

export interface NewSession {
  subject: SessionSubject
  stage: SessionStage
  rememberMe?: boolean
  mfaVerifiedAt?: Date | null
  /** staff_mfa.generation the 2FA confirmation was made against (see sessionMfaGeneration). */
  mfaGeneration?: number | null
  userAgent?: string | undefined
  /** Rotation keeps the original absolute limit, so rotating never extends a session's lifetime. */
  absoluteExpiresAt?: Date
}

export interface IssuedSession {
  token: string
  id: string
  policy: SessionPolicy
}

const truncateUserAgent = (value: string | undefined) => (value ? value.slice(0, 200) : null)

export async function createSession(db: Db, now: Date, input: NewSession): Promise<IssuedSession> {
  const rememberMe = input.subject.subjectType === 'CUSTOMER' && input.rememberMe === true
  const policy = sessionPolicy(input.subject.subjectType, rememberMe)
  const absoluteExpiresAt = input.absoluteExpiresAt ?? new Date(now.getTime() + policy.absoluteMs)
  const idleExpiresAt = new Date(Math.min(now.getTime() + policy.idleMs, absoluteExpiresAt.getTime()))
  const token = generateToken()
  const row = await db.session.create({
    data: {
      tokenHash: hashToken(token),
      subjectType: input.subject.subjectType,
      staffId: input.subject.subjectType === 'STAFF' ? input.subject.staffId : null,
      customerId: input.subject.subjectType === 'CUSTOMER' ? input.subject.customerId : null,
      stage: input.stage,
      rememberMe,
      mfaVerifiedAt: input.mfaVerifiedAt ?? null,
      mfaGeneration: input.mfaGeneration ?? null,
      createdAt: now,
      lastSeenAt: now,
      idleExpiresAt,
      absoluteExpiresAt,
      userAgent: truncateUserAgent(input.userAgent),
    },
    select: { id: true },
  })
  return { token, id: row.id, policy }
}

export type SessionRow = NonNullable<Awaited<ReturnType<typeof findSessionRow>>>

function findSessionRow(db: Db, token: string) {
  return db.session.findUnique({ where: { tokenHash: hashToken(token) } })
}

export type SessionRejection = 'missing' | 'unknown' | 'revoked' | 'idle_expired' | 'absolute_expired' | 'wrong_subject'

/**
 * Looks up a session by cookie token and checks revocation and both expiry limits at `now`. A valid session's
 * idle deadline is extended (never past the absolute limit). Expired sessions are revoked on the spot.
 */
export async function resolveSession(
  db: Db,
  now: Date,
  token: string | undefined,
  subjectType: SubjectType,
): Promise<{ session: SessionRow } | { rejected: SessionRejection }> {
  if (!token) return { rejected: 'missing' }
  if (!isWellFormedToken(token)) return { rejected: 'unknown' }
  const session = await findSessionRow(db, token)
  if (!session) return { rejected: 'unknown' }
  if (session.subjectType !== subjectType) return { rejected: 'wrong_subject' }
  if (session.revokedAt) return { rejected: 'revoked' }
  const expired = now >= session.absoluteExpiresAt ? 'absolute_expired' : now >= session.idleExpiresAt ? 'idle_expired' : null
  if (expired) {
    await db.session.updateMany({ where: { id: session.id, revokedAt: null }, data: { revokedAt: now, revokedReason: expired } })
    return { rejected: expired }
  }
  const policy = sessionPolicy(session.subjectType, session.rememberMe)
  const idleExpiresAt = new Date(Math.min(now.getTime() + policy.idleMs, session.absoluteExpiresAt.getTime()))
  const updated = await db.session.update({ where: { id: session.id }, data: { lastSeenAt: now, idleExpiresAt } })
  return { session: updated }
}

/** Replaces a session with a fresh token (no fixation). Stage and 2FA time can change; the absolute limit cannot. */
export async function rotateSession(
  db: Db,
  now: Date,
  session: SessionRow,
  changes: { stage?: SessionStage; mfaVerifiedAt?: Date | null; mfaGeneration?: number | null; reason: string },
): Promise<IssuedSession> {
  await revokeSession(db, now, session.id, changes.reason)
  const subject: SessionSubject =
    session.subjectType === 'STAFF' ? { subjectType: 'STAFF', staffId: session.staffId! } : { subjectType: 'CUSTOMER', customerId: session.customerId! }
  return createSession(db, now, {
    subject,
    stage: changes.stage ?? session.stage,
    rememberMe: session.rememberMe,
    mfaVerifiedAt: changes.mfaVerifiedAt === undefined ? session.mfaVerifiedAt : changes.mfaVerifiedAt,
    mfaGeneration: changes.mfaGeneration === undefined ? session.mfaGeneration : changes.mfaGeneration,
    userAgent: session.userAgent ?? undefined,
    absoluteExpiresAt: session.absoluteExpiresAt,
  })
}

export async function revokeSession(db: Db, now: Date, sessionId: string, reason: string): Promise<void> {
  await db.session.updateMany({ where: { id: sessionId, revokedAt: null }, data: { revokedAt: now, revokedReason: reason } })
}

/** Revokes every live session of an account (optionally keeping one). Returns how many were revoked. */
export async function revokeAllSessions(db: Db, now: Date, subject: SessionSubject, reason: string, exceptSessionId?: string): Promise<number> {
  const owner = subject.subjectType === 'STAFF' ? { staffId: subject.staffId } : { customerId: subject.customerId }
  const result = await db.session.updateMany({
    where: { ...owner, revokedAt: null, ...(exceptSessionId ? { NOT: { id: exceptSessionId } } : {}) },
    data: { revokedAt: now, revokedReason: reason },
  })
  return result.count
}

/**
 * The 2FA generation a session confirmed against: its recorded value; 0 for a session that confirmed 2FA before
 * generations were recorded (accounts enrolled then are at generation 0 too); -1 for a session that never confirmed
 * 2FA, which is older than any activated authenticator.
 */
export function sessionMfaGeneration(session: { mfaGeneration: number | null; mfaVerifiedAt: Date | null }): number {
  return session.mfaGeneration ?? (session.mfaVerifiedAt ? 0 : -1)
}

export function isStepUpFresh(session: { mfaVerifiedAt: Date | null }, now: Date): boolean {
  return session.mfaVerifiedAt !== null && now.getTime() - session.mfaVerifiedAt.getTime() <= STEP_UP_WINDOW_MS
}
