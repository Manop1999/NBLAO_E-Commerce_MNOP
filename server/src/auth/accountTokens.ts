/**
 * Single-use account links: customer invitations and staff setup links (72 h), password reset links (60 min).
 * Only the SHA-256 of a token is stored. The raw link is returned once to the staff member who created it and
 * puts the token in the URL fragment (`#…`), which browsers never send to a server, so it cannot reach logs.
 *
 * Routes: POST /api/auth/account-token/inspect and POST /api/auth/account-token/complete. Redeeming a link sets
 * a password; it never signs anyone in, never activates a customer (invitations end in PENDING) and never
 * bypasses 2FA.
 */
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { TokenPurpose } from '../generated/prisma/client.ts'
import { ApiError } from '../errors.ts'
import { recordAudit } from './audit.ts'
import type { AuthContext, Db } from './context.ts'
import { parseWith, type RouteRateLimit } from './http.ts'
import { checkPasswordPolicy, PASSWORD_MAX_LENGTH } from './password.ts'
import { revokeAllSessions, type SessionSubject } from './sessions.ts'
import { generateToken, hashToken, isWellFormedToken } from './tokens.ts'

export const INVITATION_TTL_MS = 72 * 60 * 60_000
export const PASSWORD_RESET_TTL_MS = 60 * 60_000

export const ACCOUNT_LINK_PATH = 'account/set-password'

export interface IssuedLink {
  /** Relative to the app's base URL, e.g. `account/set-password#<token>`. Shown once, never stored or logged. */
  path: string
  expiresAt: string
}

/** Creates a new link and invalidates any earlier unused link of the same purpose for the same account. */
export async function issueAccountToken(
  db: Db,
  now: Date,
  input: { purpose: TokenPurpose; subject: SessionSubject; issuedById: string | null },
): Promise<IssuedLink> {
  const owner = input.subject.subjectType === 'STAFF' ? { staffId: input.subject.staffId } : { customerId: input.subject.customerId }
  await db.accountToken.updateMany({ where: { ...owner, purpose: input.purpose, usedAt: null }, data: { usedAt: now } })
  const token = generateToken()
  const expiresAt = new Date(now.getTime() + (input.purpose === 'INVITATION' ? INVITATION_TTL_MS : PASSWORD_RESET_TTL_MS))
  await db.accountToken.create({
    data: {
      tokenHash: hashToken(token),
      purpose: input.purpose,
      subjectType: input.subject.subjectType,
      ...owner,
      issuedById: input.issuedById,
      createdAt: now,
      expiresAt,
    },
  })
  return { path: `${ACCOUNT_LINK_PATH}#${token}`, expiresAt: expiresAt.toISOString() }
}

const invalidToken = () => new ApiError(400, 'invalid_token', 'This link is invalid or has expired')

const inspectSchema = z.strictObject({ token: z.string().max(100) })
const completeSchema = z.strictObject({ token: z.string().max(100), password: z.string().min(1).max(PASSWORD_MAX_LENGTH * 4) })

async function findUsableToken(ctx: AuthContext, token: string, now: Date) {
  if (!isWellFormedToken(token)) return null
  const row = await ctx.prisma.accountToken.findUnique({ where: { tokenHash: hashToken(token) }, include: { staff: true, customer: true } })
  if (!row || row.usedAt || row.expiresAt <= now) return null
  if (row.subjectType === 'STAFF') {
    if (!row.staff || row.staff.status !== 'ACTIVE') return null
    if (row.purpose === 'INVITATION' && row.staff.passwordHash !== null) return null
  } else {
    if (!row.customer) return null
    if (row.purpose === 'INVITATION' && row.customer.status !== 'INVITED') return null
    if (row.purpose === 'PASSWORD_RESET' && row.customer.status === 'INVITED') return null
  }
  return row
}

export function registerAccountTokenRoutes(app: FastifyInstance, ctx: AuthContext, rateLimit: RouteRateLimit): void {
  app.post('/api/auth/account-token/inspect', { config: { rateLimit } }, async request => {
    const { token } = parseWith(inspectSchema, request.body)
    const row = await findUsableToken(ctx, token, ctx.now())
    if (!row) throw invalidToken()
    const email = row.staff?.email ?? row.customer?.email ?? ''
    return { purpose: row.purpose, account: row.subjectType === 'STAFF' ? 'staff' : 'customer', email, expiresAt: row.expiresAt.toISOString() }
  })

  app.post('/api/auth/account-token/complete', { config: { rateLimit } }, async (request, reply) => {
    const { token, password } = parseWith(completeSchema, request.body)
    const now = ctx.now()
    const row = await findUsableToken(ctx, token, now)
    if (!row) throw invalidToken()
    const email = row.staff?.email ?? row.customer?.email ?? ''
    const problems = checkPasswordPolicy(password, email)
    if (problems.length > 0) throw passwordPolicyError(problems)
    const passwordHash = await ctx.hasher.hash(password)

    await ctx.prisma.$transaction(async tx => {
      // Claim the token atomically: a second, concurrent redemption finds nothing to update.
      const claimed = await tx.accountToken.updateMany({ where: { id: row.id, usedAt: null, expiresAt: { gt: now } }, data: { usedAt: now } })
      if (claimed.count !== 1) throw invalidToken()

      if (row.subjectType === 'STAFF' && row.staff) {
        const subject = { subjectType: 'STAFF', staffId: row.staff.id } as const
        await tx.staffUser.update({
          where: { id: row.staff.id },
          data: { passwordHash, passwordChangedAt: now, mustChangePassword: false, failedLoginCount: 0, lockedUntil: null },
        })
        await revokeAllSessions(tx, now, subject, row.purpose === 'INVITATION' ? 'account_setup' : 'password_reset')
        await recordAudit(tx, {
          at: now,
          category: 'SECURITY',
          type: row.purpose === 'INVITATION' ? 'staff_setup_completed' : 'password_reset_completed',
          outcome: 'success',
          actor: { type: 'STAFF', id: row.staff.id },
          subject: { type: 'STAFF', id: row.staff.id },
          teamId: row.staff.teamId,
        })
      } else if (row.customer) {
        const customer = row.customer
        if (row.purpose === 'INVITATION') {
          const updated = await tx.customer.updateMany({ where: { id: customer.id, status: 'INVITED' }, data: { passwordHash, status: 'PENDING' } })
          if (updated.count !== 1) throw invalidToken()
          await recordAudit(tx, {
            at: now,
            category: 'OPERATIONAL',
            type: 'invitation_accepted',
            outcome: 'success',
            actor: { type: 'CUSTOMER', id: customer.id },
            subject: { type: 'CUSTOMER', id: customer.id },
            teamId: customer.teamId,
          })
        } else {
          await tx.customer.update({ where: { id: customer.id }, data: { passwordHash, failedLoginCount: 0, lockedUntil: null } })
          await revokeAllSessions(tx, now, { subjectType: 'CUSTOMER', customerId: customer.id }, 'password_reset')
          await recordAudit(tx, {
            at: now,
            category: 'SECURITY',
            type: 'password_reset_completed',
            outcome: 'success',
            actor: { type: 'CUSTOMER', id: customer.id },
            subject: { type: 'CUSTOMER', id: customer.id },
            teamId: customer.teamId,
          })
        }
      }
    })
    return reply.code(200).send({ status: 'password_set', account: row.subjectType === 'STAFF' ? 'staff' : 'customer' })
  })
}

export function passwordPolicyError(problems: string[]): ApiError {
  return new ApiError(
    422,
    'password_policy',
    'The password does not meet the password rules',
    problems.map(problem => ({ path: 'password', message: problem })),
  )
}
