/**
 * Staff sign-in, session, password change and TOTP two-factor routes (plan §4, §5), under /api/auth/staff/.
 *
 * Session stages: a session that is not FULL can only read its session, sign out, change the password and
 * enrol or verify 2FA. Stage order on sign-in: 2FA verification (if enrolled) → forced password change →
 * forced 2FA enrolment (Super Admin, Admin, Manager) → FULL.
 */
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import QRCode from 'qrcode'
import { z } from 'zod'
import type { SessionStage } from '../generated/prisma/client.ts'
import { ApiError } from '../errors.ts'
import { passwordPolicyError } from './accountTokens.ts'
import { recordAudit } from './audit.ts'
import { normalizeEmail, type AuthContext } from './context.ts'
import { clearSessionCookie, parseWith, setSessionCookie, userAgentOf, type Guards, type HttpAuthOptions, type RouteRateLimit, type StaffRequest } from './http.ts'
import { isLocked, recordFailure, type AttemptLimiter } from './lockout.ts'
import { clearSource, MFA_ALERT_EVERY, recordSourceFailure, sourceBlockedUntil } from './mfaThrottle.ts'
import { checkPasswordPolicy, PASSWORD_MAX_LENGTH } from './password.ts'
import { generateRecoveryCodes, hashRecoveryCode, normalizeRecoveryCode } from './recoveryCodes.ts'
import { MFA_MANDATORY_ROLES, type StaffRoleName } from './roles.ts'
import { open, seal } from './secretBox.ts'
import {
  createSession,
  isStepUpFresh,
  MAX_MFA_ATTEMPTS_PER_SESSION,
  revokeAllSessions,
  revokeSession,
  rotateSession,
  STAFF_SESSION,
} from './sessions.ts'
import { csrfTokenFor } from './tokens.ts'
import { formatManualKey, generateTotpSecret, otpauthUri, verifyTotp } from './totp.ts'

export const ALL_STAGES: readonly SessionStage[] = ['PASSWORD_CHANGE_REQUIRED', 'MFA_ENROLLMENT_REQUIRED', 'MFA_REQUIRED', 'FULL']
const PENDING_ENROLMENT_MS = 15 * 60_000

const email = z.string().trim().min(3).max(254).email()
const password = z.string().min(1).max(PASSWORD_MAX_LENGTH * 4)
const code = z.string().trim().min(6).max(20)

const loginSchema = z.strictObject({ email, password })
const passwordChangeSchema = z.strictObject({ currentPassword: password, newPassword: password })
const emptySchema = z.strictObject({})
const codeSchema = z.strictObject({ code })
const regenerateSchema = z.strictObject({ password, code })

export const invalidCredentials = () => new ApiError(401, 'invalid_credentials', 'Email or password is incorrect, or the account is temporarily locked')

/** Next stage for a staff member, given whether 2FA was already verified in this session. */
export function nextStaffStage(
  staff: { role: string; mustChangePassword: boolean; mfa: { enabledAt: Date | null } | null },
  mfaVerified: boolean,
): SessionStage {
  const enrolled = Boolean(staff.mfa?.enabledAt)
  if (enrolled && !mfaVerified) return 'MFA_REQUIRED'
  if (staff.mustChangePassword) return 'PASSWORD_CHANGE_REQUIRED'
  if (!enrolled && MFA_MANDATORY_ROLES.has(staff.role as StaffRoleName)) return 'MFA_ENROLLMENT_REQUIRED'
  return 'FULL'
}

export interface StaffAuthOptions {
  http: HttpAuthOptions
  guards: Guards
  emailLimiter: AttemptLimiter
  /** Per account + source 2FA burst limiter (in memory; the per-source limit is `rateLimit.mfa`). */
  mfaSourceLimiter: AttemptLimiter
  rateLimit: { login: RouteRateLimit; mfa: RouteRateLimit }
}

/** Thrown inside a transaction when its atomic 2FA claim matched no row (rolls the whole transaction back). */
class MfaClaimLost extends Error {}

const mfaCodeUsed = () => new ApiError(409, 'mfa_code_used', 'This code was already used. Wait for the next code and try again.')

export const mfaThrottled = () =>
  new ApiError(429, 'mfa_throttled', 'Too many wrong codes from this network. Try again later, or ask a Super Admin to reset your two-factor authentication.')

export function registerStaffAuthRoutes(app: FastifyInstance, ctx: AuthContext, options: StaffAuthOptions): void {
  const { http, guards } = options
  const audit = (event: Omit<Parameters<typeof recordAudit>[1], 'at' | 'category'>) => recordAudit(ctx.prisma, { ...event, at: ctx.now(), category: 'SECURITY' })

  app.post('/api/auth/staff/login', { config: { rateLimit: options.rateLimit.login } }, async (request, reply) => {
    const body = parseWith(loginSchema, request.body)
    const now = ctx.now()
    const address = normalizeEmail(body.email)
    if (!options.emailLimiter.take(`staff:${address}`, now.getTime())) throw new ApiError(429, 'rate_limited', 'Too many attempts. Try again later.')

    const staff = await ctx.prisma.staffUser.findUnique({ where: { email: address }, include: { mfa: true } })
    if (!staff || !staff.passwordHash || isLocked(staff, now)) {
      await ctx.hasher.verifyDummy(body.password)
      if (staff) await audit({ type: 'staff_login', outcome: 'failure', subject: { type: 'STAFF', id: staff.id }, details: { reason: staff.passwordHash ? 'locked' : 'no_password' } })
      throw invalidCredentials()
    }
    const ok = await ctx.hasher.verify(staff.passwordHash, body.password)
    if (!ok) {
      await ctx.prisma.staffUser.update({ where: { id: staff.id }, data: recordFailure(staff, now) })
      await audit({ type: 'staff_login', outcome: 'failure', subject: { type: 'STAFF', id: staff.id }, details: { reason: 'wrong_password' } })
      throw invalidCredentials()
    }
    if (staff.status !== 'ACTIVE') {
      await audit({ type: 'staff_login', outcome: 'denied', subject: { type: 'STAFF', id: staff.id }, details: { reason: 'account_inactive' } })
      throw invalidCredentials()
    }

    const rehash = ctx.hasher.needsRehash(staff.passwordHash) ? await ctx.hasher.hash(body.password) : undefined
    await ctx.prisma.staffUser.update({
      where: { id: staff.id },
      data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: now, ...(rehash ? { passwordHash: rehash } : {}) },
    })
    const stage = nextStaffStage(staff, false)
    const issued = await createSession(ctx.prisma, now, { subject: { subjectType: 'STAFF', staffId: staff.id }, stage, userAgent: userAgentOf(request) })
    setSessionCookie(reply, http, 'STAFF', issued.token, issued.policy)
    await audit({ type: 'staff_login', outcome: 'success', actor: { type: 'STAFF', id: staff.id }, subject: { type: 'STAFF', id: staff.id }, details: { stage } })
    return { stage }
  })

  app.post('/api/auth/staff/logout', async (request, reply) => {
    let current: StaffRequest | undefined
    try {
      current = await guards.staff(request, reply, { stages: ALL_STAGES })
    } catch (error) {
      if (!(error instanceof ApiError) || error.code !== 'unauthenticated') throw error
    }
    if (current) {
      await revokeSession(ctx.prisma, ctx.now(), current.session.id, 'logout')
      await audit({ type: 'staff_logout', outcome: 'success', actor: { type: 'STAFF', id: current.staff.id }, subject: { type: 'STAFF', id: current.staff.id } })
    }
    clearSessionCookie(reply, http, 'STAFF')
    return reply.code(204).send()
  })

  app.get('/api/auth/staff/session', async (request, reply) => {
    const current = await guards.staff(request, reply, { stages: ALL_STAGES })
    return staffSessionBody(current, ctx.now())
  })

  app.post('/api/auth/staff/password', async (request, reply) => {
    const current = await guards.staff(request, reply, { stages: ['PASSWORD_CHANGE_REQUIRED'] })
    const body = parseWith(passwordChangeSchema, request.body)
    const now = ctx.now()
    const { staff } = current
    if (!staff.passwordHash || !(await ctx.hasher.verify(staff.passwordHash, body.currentPassword))) {
      await audit({ type: 'password_change', outcome: 'failure', actor: { type: 'STAFF', id: staff.id }, subject: { type: 'STAFF', id: staff.id } })
      throw new ApiError(400, 'invalid_current_password', 'The current password is incorrect')
    }
    const problems: string[] = checkPasswordPolicy(body.newPassword, staff.email)
    if (body.newPassword === body.currentPassword) problems.push('same_as_current')
    if (problems.length > 0) throw passwordPolicyError(problems)
    const passwordHash = await ctx.hasher.hash(body.newPassword)

    const issued = await ctx.prisma.$transaction(async tx => {
      await tx.staffUser.update({ where: { id: staff.id }, data: { passwordHash, passwordChangedAt: now, mustChangePassword: false } })
      await revokeAllSessions(tx, now, { subjectType: 'STAFF', staffId: staff.id }, 'password_changed', current.session.id)
      const stage = nextStaffStage({ ...staff, mustChangePassword: false }, current.session.mfaVerifiedAt !== null)
      const rotated = await rotateSession(tx, now, current.session, { stage, reason: 'password_changed' })
      await recordAudit(tx, { at: now, category: 'SECURITY', type: 'password_change', outcome: 'success', actor: { type: 'STAFF', id: staff.id }, subject: { type: 'STAFF', id: staff.id } })
      return { ...rotated, stage }
    })
    setSessionCookie(reply, http, 'STAFF', issued.token, issued.policy)
    return { stage: issued.stage }
  })

  // ---------------------------------------------------------------- 2FA enrolment

  app.post('/api/auth/staff/mfa/enroll/start', async (request, reply) => {
    const current = await guards.staff(request, reply, { stages: ['MFA_ENROLLMENT_REQUIRED'] })
    parseWith(emptySchema, request.body)
    const now = ctx.now()
    const { staff } = current
    const secret = generateTotpSecret()
    const sealed = seal(ctx.totpKey, secret, staff.id)

    if (staff.mfa?.enabledAt) {
      // Re-enrolment (new phone): the current authenticator keeps working until the new one is confirmed.
      if (!isStepUpFresh(current.session, now)) throw new ApiError(403, 'step_up_required', 'Confirm with your authenticator code to continue')
      await ctx.prisma.staffMfa.update({ where: { staffId: staff.id }, data: { pendingSecretCiphertext: sealed, pendingCreatedAt: now } })
    } else {
      await ctx.prisma.staffMfa.upsert({
        where: { staffId: staff.id },
        create: { staffId: staff.id, secretCiphertext: sealed },
        update: { secretCiphertext: sealed, lastUsedStep: null, pendingSecretCiphertext: null, pendingCreatedAt: null },
      })
    }
    const uri = otpauthUri(secret, staff.email)
    const svg = await QRCode.toString(uri, { type: 'svg', errorCorrectionLevel: 'M', margin: 1 })
    await audit({ type: 'mfa_enrollment_started', outcome: 'success', actor: { type: 'STAFF', id: staff.id }, subject: { type: 'STAFF', id: staff.id } })
    return { manualKey: formatManualKey(secret), otpauthUri: uri, qrCode: `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}` }
  })

  app.post('/api/auth/staff/mfa/enroll/confirm', { config: { rateLimit: options.rateLimit.mfa } }, async (request, reply) => {
    const current = await guards.staff(request, reply, { stages: ['MFA_ENROLLMENT_REQUIRED'] })
    const body = parseWith(codeSchema, request.body)
    const now = ctx.now()
    const { staff } = current
    await beginMfaAttempt(current, request, 'mfa_enrollment')
    const mfa = staff.mfa
    const reenrolling = Boolean(mfa?.enabledAt)
    const box = reenrolling ? mfa?.pendingSecretCiphertext : mfa?.secretCiphertext
    const pendingFresh = !reenrolling || (mfa?.pendingCreatedAt && now.getTime() - mfa.pendingCreatedAt.getTime() <= PENDING_ENROLMENT_MS)
    if (!mfa || !box || !pendingFresh) throw new ApiError(409, 'enrollment_not_started', 'Start the authenticator setup again')

    const step = verifyTotp(open(ctx.totpKey, box, staff.id), body.code, now.getTime(), reenrolling ? null : mfa.lastUsedStep)
    if (step === null) return failMfaAttempt(current, request, reply, 'mfa_enrollment')

    const codes = generateRecoveryCodes()
    const issued = await claimOrRefuse(current, 'mfa_enrollment', () => ctx.prisma.$transaction(async tx => {
      // Atomic claim, re-checked inside the transaction: the enrolment is still the one this code was checked against
      // (same secret; a re-enrolment still pending and fresh) and the time step was not used yet. A concurrent request
      // with the same code loses here, before it can touch recovery codes or sessions.
      const claimed = await tx.staffMfa.updateMany({
        where: reenrolling
          ? { staffId: staff.id, enabledAt: { not: null }, pendingSecretCiphertext: { equals: box }, pendingCreatedAt: { gte: new Date(now.getTime() - PENDING_ENROLMENT_MS) } }
          : { staffId: staff.id, enabledAt: null, secretCiphertext: { equals: box }, OR: [{ lastUsedStep: null }, { lastUsedStep: { lt: step } }] },
        data: { secretCiphertext: box, enabledAt: now, lastUsedStep: step, pendingSecretCiphertext: null, pendingCreatedAt: null },
      })
      if (claimed.count !== 1) throw new MfaClaimLost()
      await tx.mfaRecoveryCode.deleteMany({ where: { staffId: staff.id } })
      await tx.mfaRecoveryCode.createMany({ data: codes.map(value => ({ staffId: staff.id, codeHash: hashRecoveryCode(value), createdAt: now })) })
      await tx.staffUser.update({ where: { id: staff.id }, data: { mfaFailedCount: 0 } })
      await clearSource(tx, staff.id, request.ip)
      // Other sessions were signed in with the old setup; only this one continues.
      await revokeAllSessions(tx, now, { subjectType: 'STAFF', staffId: staff.id }, 'mfa_enrolled', current.session.id)
      const stage = nextStaffStage({ ...staff, mfa: { enabledAt: now } }, true)
      const rotated = await rotateSession(tx, now, current.session, { stage, mfaVerifiedAt: now, reason: 'mfa_enrolled' })
      await recordAudit(tx, {
        at: now,
        category: 'SECURITY',
        type: reenrolling ? 'mfa_reenrolled' : 'mfa_enrolled',
        outcome: 'success',
        actor: { type: 'STAFF', id: staff.id },
        subject: { type: 'STAFF', id: staff.id },
      })
      return { ...rotated, stage }
    }))
    setSessionCookie(reply, http, 'STAFF', issued.token, issued.policy)
    return { stage: issued.stage, recoveryCodes: codes }
  })

  // ---------------------------------------------------------------- 2FA verification and step-up

  app.post('/api/auth/staff/mfa/verify', { config: { rateLimit: options.rateLimit.mfa } }, async (request, reply) => {
    const current = await guards.staff(request, reply, { stages: ['MFA_REQUIRED'] })
    const body = parseWith(codeSchema, request.body)
    const now = ctx.now()
    const { staff } = current
    if (!staff.mfa?.enabledAt) throw new ApiError(409, 'mfa_not_enabled', 'Two-factor authentication is not set up')
    await beginMfaAttempt(current, request, 'mfa_verify')

    let method: 'totp' | 'recovery_code' | null = null
    const step = verifyTotp(open(ctx.totpKey, staff.mfa.secretCiphertext, staff.id), body.code, now.getTime(), staff.mfa.lastUsedStep)
    if (step !== null) {
      // Conditional update: two concurrent requests with the same code cannot both pass.
      const claimed = await ctx.prisma.staffMfa.updateMany({
        where: { staffId: staff.id, OR: [{ lastUsedStep: null }, { lastUsedStep: { lt: step } }] },
        data: { lastUsedStep: step },
      })
      if (claimed.count === 1) method = 'totp'
    } else if (normalizeRecoveryCode(body.code)) {
      const used = await ctx.prisma.mfaRecoveryCode.updateMany({ where: { staffId: staff.id, codeHash: hashRecoveryCode(body.code), usedAt: null }, data: { usedAt: now } })
      if (used.count === 1) method = 'recovery_code'
    }
    if (!method) return failMfaAttempt(current, request, reply, 'mfa_verify')

    const remaining = await ctx.prisma.mfaRecoveryCode.count({ where: { staffId: staff.id, usedAt: null } })
    await audit({ type: 'mfa_verify', outcome: 'success', actor: { type: 'STAFF', id: staff.id }, subject: { type: 'STAFF', id: staff.id }, details: { method, stepUp: current.stage === 'FULL' } })
    // A correct code clears this source's 2FA throttle and the monitoring counter; the password lockout is independent.
    await ctx.prisma.staffUser.update({ where: { id: staff.id }, data: { mfaFailedCount: 0 } })
    await clearSource(ctx.prisma, staff.id, request.ip)

    if (current.stage === 'FULL') {
      await ctx.prisma.session.update({ where: { id: current.session.id }, data: { mfaVerifiedAt: now, mfaFailedAttempts: 0 } })
      return { stage: 'FULL', method, recoveryCodesRemaining: remaining }
    }
    const stage = nextStaffStage(staff, true)
    const issued = await rotateSession(ctx.prisma, now, current.session, { stage, mfaVerifiedAt: now, reason: 'mfa_verified' })
    setSessionCookie(reply, http, 'STAFF', issued.token, issued.policy)
    return { stage, method, recoveryCodesRemaining: remaining }
  })

  app.post('/api/auth/staff/mfa/recovery-codes/regenerate', { config: { rateLimit: options.rateLimit.mfa } }, async (request, reply) => {
    const current = await guards.staff(request, reply)
    const body = parseWith(regenerateSchema, request.body)
    const now = ctx.now()
    const { staff } = current
    if (!staff.mfa?.enabledAt || !staff.passwordHash) throw new ApiError(409, 'mfa_not_enabled', 'Two-factor authentication is not set up')
    await beginMfaAttempt(current, request, 'recovery_codes_regenerate')
    // Each factor fails into its own counter: a wrong password counts toward the password lockout only, a wrong
    // code toward the 2FA counter only.
    if (!(await ctx.hasher.verify(staff.passwordHash, body.password))) {
      await ctx.prisma.staffUser.update({ where: { id: staff.id }, data: recordFailure(staff, now) })
      await audit({ type: 'recovery_codes_regenerate', outcome: 'failure', actor: { type: 'STAFF', id: staff.id }, subject: { type: 'STAFF', id: staff.id }, details: { reason: 'wrong_password' } })
      throw new ApiError(400, 'invalid_current_password', 'The current password is incorrect')
    }
    const step = verifyTotp(open(ctx.totpKey, staff.mfa.secretCiphertext, staff.id), body.code, now.getTime(), staff.mfa.lastUsedStep)
    if (step === null) return failMfaAttempt(current, request, reply, 'recovery_codes_regenerate')

    const codes = generateRecoveryCodes()
    const verifiedSecret = staff.mfa.secretCiphertext
    await claimOrRefuse(current, 'recovery_codes_regenerate', () => ctx.prisma.$transaction(async tx => {
      // Atomic claim of the time step (same secret as verified, step not used yet): only one of two concurrent
      // requests with the same code gets here, so the loser can never replace the winner's recovery codes.
      const claimed = await tx.staffMfa.updateMany({
        where: { staffId: staff.id, enabledAt: { not: null }, secretCiphertext: { equals: verifiedSecret }, OR: [{ lastUsedStep: null }, { lastUsedStep: { lt: step } }] },
        data: { lastUsedStep: step },
      })
      if (claimed.count !== 1) throw new MfaClaimLost()
      await tx.staffUser.update({ where: { id: staff.id }, data: { mfaFailedCount: 0 } })
      await clearSource(tx, staff.id, request.ip)
      await tx.mfaRecoveryCode.deleteMany({ where: { staffId: staff.id } })
      await tx.mfaRecoveryCode.createMany({ data: codes.map(value => ({ staffId: staff.id, codeHash: hashRecoveryCode(value), createdAt: now })) })
      await recordAudit(tx, { at: now, category: 'SECURITY', type: 'recovery_codes_regenerated', outcome: 'success', actor: { type: 'STAFF', id: staff.id }, subject: { type: 'STAFF', id: staff.id } })
    }))
    return { recoveryCodes: codes }
  })

  /**
   * Runs a transaction that starts with an atomic 2FA claim. When the claim is lost (the same code was used by a
   * concurrent request, or the enrolment changed meanwhile) nothing in the transaction happened; the request is
   * refused with 409 and audited. It does not count as a wrong code: the code itself was valid.
   */
  async function claimOrRefuse<T>(current: StaffRequest, type: string, work: () => Promise<T>): Promise<T> {
    try {
      return await work()
    } catch (error) {
      if (!(error instanceof MfaClaimLost)) throw error
      const { staff } = current
      await audit({ type, outcome: 'denied', actor: { type: 'STAFF', id: staff.id }, subject: { type: 'STAFF', id: staff.id }, details: { reason: 'replay_or_changed' } })
      throw mfaCodeUsed()
    }
  }

  /**
   * Runs before any 2FA code is checked. Refuses (without looking at the code) when this source is blocked for
   * this account, or over its burst limit. Both are keyed by account AND source: failures from one challenge or
   * address can never block the person's other sessions or other networks. The password lockout is untouched.
   */
  async function beginMfaAttempt(current: StaffRequest, request: FastifyRequest, type: string): Promise<void> {
    const now = ctx.now()
    const { staff } = current
    if (await sourceBlockedUntil(ctx.prisma, staff.id, request.ip, now)) {
      await audit({ type, outcome: 'denied', actor: { type: 'STAFF', id: staff.id }, subject: { type: 'STAFF', id: staff.id }, details: { reason: 'source_blocked' } })
      throw mfaThrottled()
    }
    if (!options.mfaSourceLimiter.take(`mfa:${staff.id}:${request.ip}`, now.getTime())) {
      await audit({ type, outcome: 'denied', actor: { type: 'STAFF', id: staff.id }, subject: { type: 'STAFF', id: staff.id }, details: { reason: 'rate_limited' } })
      throw new ApiError(429, 'rate_limited', 'Too many attempts. Try again later.')
    }
  }

  /**
   * Wrong code. Counts toward (1) this sign-in challenge: the 5th ends this session only; (2) this account + source
   * address: the 10th within 15 minutes blocks 2FA from this source for this account (15 min, doubling); and (3) the
   * account-wide monitoring counter, which only raises an audited alert. Other sessions are never revoked here and
   * the password counter is never touched. No code or secret is ever audited.
   */
  async function failMfaAttempt(current: StaffRequest, request: FastifyRequest, reply: FastifyReply, type: string): Promise<never> {
    const now = ctx.now()
    const { staff, session } = current
    const updatedSession = await ctx.prisma.session.update({ where: { id: session.id }, data: { mfaFailedAttempts: { increment: 1 } } })
    const updatedStaff = await ctx.prisma.staffUser.update({ where: { id: staff.id }, data: { mfaFailedCount: { increment: 1 } }, select: { mfaFailedCount: true } })
    const source = await recordSourceFailure(ctx.prisma, staff.id, request.ip, now)
    const details = { sessionAttempts: updatedSession.mfaFailedAttempts, sourceAttempts: source.failedCount, accountAttempts: updatedStaff.mfaFailedCount }
    await audit({ type, outcome: 'failure', actor: { type: 'STAFF', id: staff.id }, subject: { type: 'STAFF', id: staff.id }, details })
    if (updatedStaff.mfaFailedCount % MFA_ALERT_EVERY === 0) {
      await audit({ type: 'mfa_failures_alert', outcome: 'success', subject: { type: 'STAFF', id: staff.id }, details: { accountAttempts: updatedStaff.mfaFailedCount } })
    }

    if (source.blockedUntil) {
      // Only this challenge ends; the account's other sessions and other sources keep working.
      await revokeSession(ctx.prisma, now, session.id, 'mfa_source_blocked')
      await audit({ type: 'mfa_source_blocked', outcome: 'success', subject: { type: 'STAFF', id: staff.id }, details: { ...details, blockMinutes: Math.round((source.blockedUntil.getTime() - now.getTime()) / 60_000) } })
      clearSessionCookie(reply, http, 'STAFF')
      throw mfaThrottled()
    }
    if (updatedSession.mfaFailedAttempts >= MAX_MFA_ATTEMPTS_PER_SESSION) {
      await revokeSession(ctx.prisma, now, session.id, 'mfa_attempts_exceeded')
      await audit({ type: 'mfa_challenge_ended', outcome: 'success', subject: { type: 'STAFF', id: staff.id }, details })
      clearSessionCookie(reply, http, 'STAFF')
      throw new ApiError(401, 'unauthenticated', 'Too many wrong codes. Sign in again.')
    }
    throw new ApiError(400, 'invalid_code', 'The code is not valid')
  }
}

export function staffSessionBody(current: StaffRequest, now: Date) {
  const { staff, session } = current
  const stepUpUntil = session.mfaVerifiedAt ? new Date(session.mfaVerifiedAt.getTime() + 5 * 60_000) : null
  return {
    staff: {
      id: staff.id,
      email: staff.email,
      displayName: staff.displayName,
      role: staff.role,
      teamId: staff.teamId,
      mfaEnabled: Boolean(staff.mfa?.enabledAt),
      mfaRequired: MFA_MANDATORY_ROLES.has(staff.role),
    },
    stage: current.stage,
    permissions: current.stage === 'FULL' ? [...current.permissions].sort() : [],
    csrfToken: csrfTokenFor(current.token),
    stepUpUntil: stepUpUntil && stepUpUntil > now ? stepUpUntil.toISOString() : null,
    idleExpiresAt: session.idleExpiresAt.toISOString(),
    absoluteExpiresAt: session.absoluteExpiresAt.toISOString(),
    idleTimeoutSeconds: STAFF_SESSION.idleMs / 1000,
  }
}
