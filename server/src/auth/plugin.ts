/**
 * Registers authentication and the admin API in one encapsulated Fastify plugin: cookies, rate limits
 * (per route, never global), the Origin check, JSON-only bodies, and all /api/auth and /api/admin routes.
 */
import cookie from '@fastify/cookie'
import rateLimit from '@fastify/rate-limit'
import type { FastifyInstance } from 'fastify'
import { ApiError } from '../errors.ts'
import { registerAccountTokenRoutes } from './accountTokens.ts'
import { registerAdminCustomerRoutes } from './adminCustomers.ts'
import { registerAdminStaffRoutes } from './adminStaff.ts'
import type { AuthContext } from './context.ts'
import { registerCustomerAuthRoutes } from './customerAuth.ts'
import { createGuards, installOriginCheck, type HttpAuthOptions, type RouteRateLimit } from './http.ts'
import { AttemptLimiter } from './lockout.ts'
import { registerStaffAuthRoutes } from './staffAuth.ts'

export interface AuthPluginOptions {
  ctx: AuthContext
  http: HttpAuthOptions
  /** Rate limits are on by default; tests that sign in many times turn them off (one test checks them). */
  rateLimits?: boolean
}

/** Staff-creation attempts with an already used email, per staff member per hour (anti-probing). */
export const STAFF_EMAIL_CONFLICTS_PER_HOUR = 5

/** 2FA code attempts per staff account per source address per minute (on top of the per-source `mfa` limit). */
export const MFA_ATTEMPTS_PER_ACCOUNT_SOURCE_PER_MINUTE = 5

/**
 * Per-IP limits (requests per window). Per-email limits and account lockout come on top.
 * The store is in process memory: not production-safe (resets on restart, not shared between processes).
 */
export const RATE_LIMITS = {
  login: { max: 10, timeWindow: 60_000 },
  register: { max: 5, timeWindow: 60 * 60_000 },
  accountToken: { max: 20, timeWindow: 15 * 60_000 },
  mfa: { max: 10, timeWindow: 60_000 },
} as const

export async function authPlugin(app: FastifyInstance, options: AuthPluginOptions): Promise<void> {
  const { ctx, http } = options
  const limitsOn = options.rateLimits !== false
  app.log.warn('rate limits use an in-memory store: local development only, not production-safe (Phase 1H launch blocker)')

  await app.register(cookie, { hook: 'onRequest' })
  await app.register(rateLimit, {
    global: false,
    errorResponseBuilder: () => new ApiError(429, 'rate_limited', 'Too many requests. Try again later.'),
  })
  // Only JSON bodies: a cross-site HTML form cannot send application/json without a CORS preflight.
  app.removeContentTypeParser('text/plain')
  installOriginCheck(app, http)

  const limit = (config: { max: number; timeWindow: number }): RouteRateLimit => (limitsOn ? { ...config } : false)
  // In-memory limiters: local single-process development only (see lockout.ts); Phase 1H needs a shared store.
  const emailLimiter = new AttemptLimiter(limitsOn ? 10 : Number.MAX_SAFE_INTEGER, 15 * 60_000)
  const mfaSourceLimiter = new AttemptLimiter(limitsOn ? MFA_ATTEMPTS_PER_ACCOUNT_SOURCE_PER_MINUTE : Number.MAX_SAFE_INTEGER, 60_000)
  const guards = createGuards(ctx, http)

  registerStaffAuthRoutes(app, ctx, { http, guards, emailLimiter, mfaSourceLimiter, rateLimit: { login: limit(RATE_LIMITS.login), mfa: limit(RATE_LIMITS.mfa) } })
  registerCustomerAuthRoutes(app, ctx, { http, guards, emailLimiter, rateLimit: { login: limit(RATE_LIMITS.login), register: limit(RATE_LIMITS.register) } })
  registerAccountTokenRoutes(app, ctx, limit(RATE_LIMITS.accountToken))
  registerAdminCustomerRoutes(app, ctx, guards)
  registerAdminStaffRoutes(app, ctx, guards, { conflictLimiter: new AttemptLimiter(limitsOn ? STAFF_EMAIL_CONFLICTS_PER_HOUR : Number.MAX_SAFE_INTEGER, 60 * 60_000) })
}
