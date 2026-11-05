/**
 * Customer registration (option B: self-registration → PENDING, awaiting staff approval), sign-in with
 * "Remember me", session and password change, under /api/auth/customer/.
 *
 * Registration answers the same way whether or not the email is already registered (no enumeration) and
 * never signs anyone in. PENDING customers may sign in and see their own status; REJECTED and SUSPENDED
 * customers are refused only after a correct password.
 */
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { Customer } from '../generated/prisma/client.ts'
import { ApiError } from '../errors.ts'
import { passwordPolicyError } from './accountTokens.ts'
import { recordAudit } from './audit.ts'
import { normalizeEmail, type AuthContext } from './context.ts'
import { clearSessionCookie, parseWith, setSessionCookie, userAgentOf, type CustomerRequest, type Guards, type HttpAuthOptions, type RouteRateLimit } from './http.ts'
import { isLocked, recordFailure, type AttemptLimiter } from './lockout.ts'
import { checkPasswordPolicy, PASSWORD_MAX_LENGTH } from './password.ts'
import { createSession, revokeAllSessions, revokeSession, rotateSession, sessionPolicy } from './sessions.ts'
import { invalidCredentials } from './staffAuth.ts'
import { csrfTokenFor } from './tokens.ts'

const email = z.string().trim().min(3).max(254).email()
const password = z.string().min(1).max(PASSWORD_MAX_LENGTH * 4)
const name = z.string().trim().min(1).max(100)

export const customerProfileFields = {
  firstName: name,
  lastName: name,
  phone: z.string().trim().min(6).max(30).regex(/^[0-9+()\-\s]+$/, 'digits, spaces and + ( ) - only'),
  companyName: z.string().trim().min(1).max(200),
}

const registerSchema = z.strictObject({ email, password, ...customerProfileFields })
const loginSchema = z.strictObject({ email, password, rememberMe: z.boolean().optional() })
const passwordChangeSchema = z.strictObject({ currentPassword: password, newPassword: password })

export const REGISTRATION_ACCEPTED = {
  status: 'received',
  message: 'If this email can be registered, the account now awaits approval by NB LAO. You can then sign in.',
} as const

export function customerView(customer: Customer) {
  return {
    id: customer.id,
    email: customer.email,
    firstName: customer.firstName,
    lastName: customer.lastName,
    phone: customer.phone,
    companyName: customer.companyName,
    status: customer.status,
    createdAt: customer.createdAt.toISOString(),
  }
}

export interface CustomerAuthOptions {
  http: HttpAuthOptions
  guards: Guards
  emailLimiter: AttemptLimiter
  rateLimit: { login: RouteRateLimit; register: RouteRateLimit }
}

export function registerCustomerAuthRoutes(app: FastifyInstance, ctx: AuthContext, options: CustomerAuthOptions): void {
  const { http, guards } = options

  app.post('/api/auth/customer/register', { config: { rateLimit: options.rateLimit.register } }, async (request, reply) => {
    const body = parseWith(registerSchema, request.body)
    const address = normalizeEmail(body.email)
    const problems = checkPasswordPolicy(body.password, address)
    if (problems.length > 0) throw passwordPolicyError(problems)
    // Hash first in every case, so an existing email takes the same time as a new one.
    const passwordHash = await ctx.hasher.hash(body.password)
    const now = ctx.now()
    const existing = await ctx.prisma.customer.findUnique({ where: { email: address }, select: { id: true } })
    if (!existing) {
      try {
        const created = await ctx.prisma.customer.create({
          data: {
            email: address,
            firstName: body.firstName,
            lastName: body.lastName,
            phone: body.phone,
            companyName: body.companyName,
            status: 'PENDING',
            passwordHash,
            createdAt: now,
          },
        })
        await recordAudit(ctx.prisma, {
          at: now,
          category: 'OPERATIONAL',
          type: 'customer_registered',
          outcome: 'success',
          actor: { type: 'CUSTOMER', id: created.id },
          subject: { type: 'CUSTOMER', id: created.id },
          teamId: null,
        })
      } catch (error) {
        // A concurrent registration of the same email: answer exactly as for an existing one.
        if (!(error instanceof Error && 'code' in error && (error as { code?: string }).code === 'P2002')) throw error
      }
    }
    return reply.code(202).send(REGISTRATION_ACCEPTED)
  })

  app.post('/api/auth/customer/login', { config: { rateLimit: options.rateLimit.login } }, async (request, reply) => {
    const body = parseWith(loginSchema, request.body)
    const now = ctx.now()
    const address = normalizeEmail(body.email)
    if (!options.emailLimiter.take(`customer:${address}`, now.getTime())) throw new ApiError(429, 'rate_limited', 'Too many attempts. Try again later.')

    const customer = await ctx.prisma.customer.findUnique({ where: { email: address } })
    if (!customer || !customer.passwordHash || isLocked(customer, now)) {
      await ctx.hasher.verifyDummy(body.password)
      throw invalidCredentials()
    }
    if (!(await ctx.hasher.verify(customer.passwordHash, body.password))) {
      await ctx.prisma.customer.update({ where: { id: customer.id }, data: recordFailure(customer, now) })
      await recordAudit(ctx.prisma, { at: now, category: 'SECURITY', type: 'customer_login', outcome: 'failure', subject: { type: 'CUSTOMER', id: customer.id }, teamId: customer.teamId })
      throw invalidCredentials()
    }
    if (customer.status !== 'ACTIVE' && customer.status !== 'PENDING') {
      throw new ApiError(403, 'account_inactive', 'This account cannot sign in. Please contact NB LAO.')
    }
    const rehash = ctx.hasher.needsRehash(customer.passwordHash) ? await ctx.hasher.hash(body.password) : undefined
    await ctx.prisma.customer.update({
      where: { id: customer.id },
      data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: now, ...(rehash ? { passwordHash: rehash } : {}) },
    })
    const rememberMe = body.rememberMe === true
    const issued = await createSession(ctx.prisma, now, {
      subject: { subjectType: 'CUSTOMER', customerId: customer.id },
      stage: 'FULL',
      rememberMe,
      userAgent: userAgentOf(request),
    })
    setSessionCookie(reply, http, 'CUSTOMER', issued.token, issued.policy)
    await recordAudit(ctx.prisma, { at: now, category: 'SECURITY', type: 'customer_login', outcome: 'success', actor: { type: 'CUSTOMER', id: customer.id }, subject: { type: 'CUSTOMER', id: customer.id }, teamId: customer.teamId, details: { rememberMe } })
    return { status: customer.status }
  })

  app.post('/api/auth/customer/logout', async (request, reply) => {
    let current: CustomerRequest | undefined
    try {
      current = await guards.customer(request, reply)
    } catch (error) {
      if (!(error instanceof ApiError) || error.code !== 'unauthenticated') throw error
    }
    if (current) await revokeSession(ctx.prisma, ctx.now(), current.session.id, 'logout')
    clearSessionCookie(reply, http, 'CUSTOMER')
    return reply.code(204).send()
  })

  app.get('/api/auth/customer/session', async (request, reply) => {
    const current = await guards.customer(request, reply)
    const policy = sessionPolicy('CUSTOMER', current.session.rememberMe)
    return {
      customer: customerView(current.customer),
      csrfToken: csrfTokenFor(current.token),
      rememberMe: current.session.rememberMe,
      idleExpiresAt: current.session.idleExpiresAt.toISOString(),
      absoluteExpiresAt: current.session.absoluteExpiresAt.toISOString(),
      idleTimeoutSeconds: policy.idleMs / 1000,
    }
  })

  app.post('/api/auth/customer/password', async (request, reply) => {
    const current = await guards.customer(request, reply)
    const body = parseWith(passwordChangeSchema, request.body)
    const now = ctx.now()
    const { customer } = current
    if (!customer.passwordHash || !(await ctx.hasher.verify(customer.passwordHash, body.currentPassword))) {
      throw new ApiError(400, 'invalid_current_password', 'The current password is incorrect')
    }
    const problems: string[] = checkPasswordPolicy(body.newPassword, customer.email)
    if (body.newPassword === body.currentPassword) problems.push('same_as_current')
    if (problems.length > 0) throw passwordPolicyError(problems)
    const passwordHash = await ctx.hasher.hash(body.newPassword)
    const issued = await ctx.prisma.$transaction(async tx => {
      await tx.customer.update({ where: { id: customer.id }, data: { passwordHash } })
      await revokeAllSessions(tx, now, { subjectType: 'CUSTOMER', customerId: customer.id }, 'password_changed', current.session.id)
      const rotated = await rotateSession(tx, now, current.session, { reason: 'password_changed' })
      await recordAudit(tx, { at: now, category: 'SECURITY', type: 'password_change', outcome: 'success', actor: { type: 'CUSTOMER', id: customer.id }, subject: { type: 'CUSTOMER', id: customer.id }, teamId: customer.teamId })
      return rotated
    })
    setSessionCookie(reply, http, 'CUSTOMER', issued.token, issued.policy)
    return { status: 'password_changed' }
  })
}
