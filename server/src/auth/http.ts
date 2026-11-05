/**
 * HTTP side of authentication: session cookies, the Origin check, CSRF tokens, request parsing and the guards
 * every protected route calls first. Guards answer from the database only; nothing the browser says about its
 * own session is trusted.
 */
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import type { z } from 'zod'
import type { Customer, SessionStage, StaffMfa, StaffUser, SubjectType } from '../generated/prisma/client.ts'
import { ApiError } from '../errors.ts'
import type { AuthContext } from './context.ts'
import { can, type PermissionCode } from './permissions.ts'
import { MFA_MANDATORY_ROLES, permissionsFor, type StaffActor } from './roles.ts'
import { isStepUpFresh, resolveSession, revokeSession, type SessionPolicy, type SessionRow } from './sessions.ts'
import { csrfTokenFor, safeEqual } from './tokens.ts'

/** Per-route rate limit for @fastify/rate-limit (`false` = off, used by tests). */
export type RouteRateLimit = { max: number; timeWindow: number } | false

export interface HttpAuthOptions {
  cookieSecure: boolean
  allowedOrigins: readonly string[]
}

const COOKIE_BASE = { staff: 'nblao_staff', customer: 'nblao_customer' } as const

/** `__Host-` names need Secure, so they are used exactly when cookies are Secure (HTTPS, Phase 1H). */
export function cookieName(subjectType: SubjectType, secure: boolean): string {
  const base = subjectType === 'STAFF' ? COOKIE_BASE.staff : COOKIE_BASE.customer
  return secure ? `__Host-${base}` : base
}

export function cookieOptions(subjectType: SubjectType, secure: boolean, maxAgeSeconds?: number) {
  return {
    httpOnly: true,
    secure,
    path: '/',
    sameSite: subjectType === 'STAFF' ? ('strict' as const) : ('lax' as const),
    ...(maxAgeSeconds !== undefined ? { maxAge: maxAgeSeconds } : {}),
  }
}

export function setSessionCookie(reply: FastifyReply, http: HttpAuthOptions, subjectType: SubjectType, token: string, policy: SessionPolicy): void {
  reply.setCookie(cookieName(subjectType, http.cookieSecure), token, cookieOptions(subjectType, http.cookieSecure, policy.cookieMaxAgeSeconds))
}

export function clearSessionCookie(reply: FastifyReply, http: HttpAuthOptions, subjectType: SubjectType): void {
  reply.clearCookie(cookieName(subjectType, http.cookieSecure), cookieOptions(subjectType, http.cookieSecure))
}

export function readSessionCookie(request: FastifyRequest, http: HttpAuthOptions, subjectType: SubjectType): string | undefined {
  return request.cookies[cookieName(subjectType, http.cookieSecure)]
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])
const PROTECTED_PREFIXES = ['/api/auth/', '/api/admin/']

/**
 * First CSRF layer, before any handler runs: state-changing requests to auth/admin routes must come from an
 * allowed Origin and must not be cross-site. JSON-only bodies are enforced by removing the text/plain parser
 * (Fastify then answers 415 for form or text bodies).
 */
export function installOriginCheck(app: FastifyInstance, http: HttpAuthOptions): void {
  const allowed = new Set(http.allowedOrigins)
  app.addHook('onRequest', async request => {
    if (SAFE_METHODS.has(request.method)) return
    const path = request.url.split('?')[0] ?? ''
    if (!PROTECTED_PREFIXES.some(prefix => path.startsWith(prefix))) return
    const origin = request.headers.origin
    if (typeof origin !== 'string' || !allowed.has(origin)) throw new ApiError(403, 'origin_rejected', 'Request origin is not allowed')
    if (request.headers['sec-fetch-site'] === 'cross-site') throw new ApiError(403, 'origin_rejected', 'Request origin is not allowed')
  })
}

/** Second CSRF layer: the synchronizer token from GET …/session must come back in `x-csrf-token`. */
export function requireCsrf(request: FastifyRequest, sessionToken: string): void {
  const header = request.headers['x-csrf-token']
  const expected = Buffer.from(csrfTokenFor(sessionToken))
  if (typeof header !== 'string' || !safeEqual(Buffer.from(header), expected)) {
    throw new ApiError(403, 'csrf_failed', 'Missing or invalid CSRF token')
  }
}

/** Strict request parsing; issues carry paths and messages only, never the submitted values. */
export function parseWith<T extends z.ZodType>(schema: T, value: unknown): z.infer<T> {
  const result = schema.safeParse(value ?? {})
  if (result.success) return result.data
  throw new ApiError(
    400,
    'invalid_request',
    'The request is invalid',
    result.error.issues.map(issue => ({ path: issue.path.join('.') || '(body)', message: issue.message })),
  )
}

export const unauthenticated = () => new ApiError(401, 'unauthenticated', 'Sign in required')

export type StaffWithMfa = StaffUser & { mfa: StaffMfa | null }

export interface StaffRequest {
  session: SessionRow
  token: string
  staff: StaffWithMfa
  actor: StaffActor
  stage: SessionStage
  permissions: ReadonlySet<PermissionCode>
}

export interface CustomerRequest {
  session: SessionRow
  token: string
  customer: Customer
}

/** Stored stage, tightened when a role now requires 2FA that is not enrolled yet (e.g. after a promotion). */
export function effectiveStage(session: { stage: SessionStage }, staff: { role: string; mfa: { enabledAt: Date | null } | null }): SessionStage {
  if (session.stage !== 'FULL') return session.stage
  if (MFA_MANDATORY_ROLES.has(staff.role as StaffActor['role']) && !staff.mfa?.enabledAt) return 'MFA_ENROLLMENT_REQUIRED'
  return 'FULL'
}

export interface StaffGuardOptions {
  permission?: PermissionCode
  /** Stages allowed besides FULL. Default: FULL only. */
  stages?: readonly SessionStage[]
  /** Sensitive action: 2FA verified within the last 5 minutes. */
  stepUp?: boolean
}

export function createGuards(ctx: AuthContext, http: HttpAuthOptions) {
  async function staff(request: FastifyRequest, reply: FastifyReply, options: StaffGuardOptions = {}): Promise<StaffRequest> {
    const now = ctx.now()
    const token = readSessionCookie(request, http, 'STAFF')
    const resolved = await resolveSession(ctx.prisma, now, token, 'STAFF')
    if ('rejected' in resolved || !token) {
      if (token) clearSessionCookie(reply, http, 'STAFF')
      throw unauthenticated()
    }
    const { session } = resolved
    const staffUser = await ctx.prisma.staffUser.findUnique({ where: { id: session.staffId! }, include: { mfa: true } })
    if (!staffUser || staffUser.status !== 'ACTIVE') {
      await revokeSession(ctx.prisma, now, session.id, 'account_inactive')
      clearSessionCookie(reply, http, 'STAFF')
      throw unauthenticated()
    }
    if (!SAFE_METHODS.has(request.method)) requireCsrf(request, token)

    const stage = effectiveStage(session, staffUser)
    const allowed = new Set<SessionStage>(['FULL', ...(options.stages ?? [])])
    if (!allowed.has(stage)) throw new ApiError(403, 'stage_required', 'Finish signing in first', undefined, stage)

    const permissions = permissionsFor(staffUser.role)
    if (options.permission && !can(permissions, options.permission)) throw new ApiError(403, 'forbidden', 'You do not have permission for this action')
    if (options.stepUp && !isStepUpFresh(session, now)) {
      throw new ApiError(403, 'step_up_required', 'Confirm with your authenticator code to continue')
    }
    return {
      session,
      token,
      staff: staffUser,
      actor: { id: staffUser.id, role: staffUser.role, teamId: staffUser.teamId },
      stage,
      permissions,
    }
  }

  async function customer(request: FastifyRequest, reply: FastifyReply): Promise<CustomerRequest> {
    const now = ctx.now()
    const token = readSessionCookie(request, http, 'CUSTOMER')
    const resolved = await resolveSession(ctx.prisma, now, token, 'CUSTOMER')
    if ('rejected' in resolved || !token) {
      if (token) clearSessionCookie(reply, http, 'CUSTOMER')
      throw unauthenticated()
    }
    const { session } = resolved
    const row = await ctx.prisma.customer.findUnique({ where: { id: session.customerId! } })
    if (!row || (row.status !== 'ACTIVE' && row.status !== 'PENDING')) {
      await revokeSession(ctx.prisma, now, session.id, 'account_inactive')
      clearSessionCookie(reply, http, 'CUSTOMER')
      throw unauthenticated()
    }
    if (!SAFE_METHODS.has(request.method)) requireCsrf(request, token)
    return { session, token, customer: row }
  }

  return { staff, customer }
}

export type Guards = ReturnType<typeof createGuards>

/** Shortened user agent for the session row (diagnostics only). */
export const userAgentOf = (request: FastifyRequest): string | undefined => {
  const value = request.headers['user-agent']
  return typeof value === 'string' ? value : undefined
}
