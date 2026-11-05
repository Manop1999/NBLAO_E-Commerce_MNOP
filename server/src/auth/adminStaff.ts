/**
 * Staff accounts, teams and the audit log, under /api/admin/ (API only in Phase 1E; the Staff/Positions UI is
 * Phase 1G backlog).
 *
 * D-STAFF: Admin manages Manager, Sales and Warehouse accounts only; only a Super Admin manages Admin and Super
 * Admin accounts. The last active Super Admin can never be disabled, suspended or demoted: the check and the
 * change run in one transaction under an advisory lock, so two concurrent requests cannot both succeed.
 * Creating staff, changing role/status/team, reset links and 2FA resets need a fresh 2FA (step-up).
 *
 * Visibility: Super Admin lists and inspects every staff account; Admin only Manager, Sales and Warehouse
 * accounts (the filter is part of the database query). A direct request for an account outside the caller's
 * visibility is refused with 403 before anything about it is returned or changed.
 */
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { Prisma, StaffUser } from '../generated/prisma/client.ts'
import { ApiError } from '../errors.ts'
import { issueAccountToken } from './accountTokens.ts'
import { recordAudit } from './audit.ts'
import { normalizeEmail, type AuthContext, type Db } from './context.ts'
import { parseWith, type Guards, type StaffRequest } from './http.ts'
import { auditScope, staffManagementRefusal, staffVisibilityScope, STAFF_ROLES } from './roles.ts'
import type { AttemptLimiter } from './lockout.ts'
import { clearAllForAccount } from './mfaThrottle.ts'
import { isPrivilegedEmail, isPrivilegedRole } from './privilegedNamespace.ts'
import { revokeAllSessions } from './sessions.ts'

const uuid = z.uuid()
const idParams = z.strictObject({ id: uuid })
const emptyBody = z.strictObject({})
const role = z.enum(STAFF_ROLES)
const displayName = z.string().trim().min(1).max(100)

const createBody = z.strictObject({ email: z.string().trim().min(3).max(254).email(), displayName, role, teamId: uuid.nullable().optional() })
const updateBody = z
  .strictObject({ displayName: displayName.optional(), role: role.optional(), status: z.enum(['ACTIVE', 'SUSPENDED', 'DISABLED']).optional(), teamId: uuid.nullable().optional() })
  .refine(value => Object.values(value).some(field => field !== undefined), 'at least one field is required')
const teamBody = z.strictObject({ name: z.string().trim().min(1).max(100) })
const auditQuery = z.strictObject({
  category: z.enum(['SECURITY', 'OPERATIONAL']).optional(),
  from: z.iso.datetime().optional(),
  to: z.iso.datetime().optional(),
  subjectId: uuid.optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
})

/** Arbitrary constant key for pg_advisory_xact_lock: serialises every Super Admin status/role change. */
const SUPER_ADMIN_LOCK_KEY = 7_340_001

type StaffWithMfaFlag = StaffUser & { mfa: { enabledAt: Date | null } | null; team: { id: string; name: string } | null }

function staffView(staff: StaffWithMfaFlag) {
  return {
    id: staff.id,
    email: staff.email,
    displayName: staff.displayName,
    role: staff.role,
    status: staff.status,
    team: staff.team,
    mfaEnabled: Boolean(staff.mfa?.enabledAt),
    setupPending: staff.passwordHash === null,
    lastLoginAt: staff.lastLoginAt?.toISOString() ?? null,
    createdAt: staff.createdAt.toISOString(),
  }
}

const staffInclude = { mfa: { select: { enabledAt: true } }, team: { select: { id: true, name: true } } } as const

const refusalError = (refusal: 'forbidden' | 'self_change') =>
  refusal === 'self_change'
    ? new ApiError(403, 'self_change', 'You cannot change your own role or status')
    : new ApiError(403, 'forbidden', 'You do not have permission to manage this account')

async function assertTeam(db: Db, teamId: string | null | undefined): Promise<void> {
  if (teamId && !(await db.team.findUnique({ where: { id: teamId }, select: { id: true } }))) throw new ApiError(400, 'invalid_team', 'Team not found')
}

/** Same answer for every existing email, whatever the account's role, so it reveals nothing about Admins. */
const emailUnavailable = () => new ApiError(409, 'email_unavailable', 'This email address cannot be used for a new staff account.')

/**
 * Fixed answers of the privileged-namespace rule (privilegedNamespace.ts). They depend only on the submitted
 * role and address, never on the database, so they cannot reveal whether a privileged account exists.
 */
// The messages do not name the namespace domain, so the temporary placeholder never ships in a frontend bundle.
const reservedEmail = () => new ApiError(400, 'reserved_email', 'This address is reserved for Admin and Super Admin accounts, which only a Super Admin can create.')
const privilegedEmailRequired = () =>
  new ApiError(400, 'privileged_email_required', 'Admin and Super Admin accounts need their own address in the reserved administrator namespace. Create a separate account instead of changing this one.')
const privilegedAccountRole = () =>
  new ApiError(400, 'privileged_account_role', 'A privileged account keeps its reserved address and cannot become a Manager, Sales or Warehouse account. Disable it instead.')

export interface AdminStaffOptions {
  /** Limits repeated email collisions per staff member (probing), in memory: local development only. */
  conflictLimiter: AttemptLimiter
}

export function registerAdminStaffRoutes(app: FastifyInstance, ctx: AuthContext, guards: Guards, options: AdminStaffOptions): void {
  const actorRef = (current: StaffRequest) => ({ type: 'STAFF' as const, id: current.actor.id })

  function visibilityOf(current: StaffRequest) {
    const scope = staffVisibilityScope(current.actor)
    if (!scope) throw refusalError('forbidden')
    return scope
  }

  /**
   * Loads one staff account through the caller's visibility filter, in a single query. A caller with limited
   * visibility (Admin) gets the same 403 whether the id belongs to a hidden account or to no account at all, so ids
   * cannot be used to confirm that a Super Admin or Admin exists. A Super Admin sees every account, so for them a
   * missing id is simply 404.
   */
  async function loadVisible(db: Db, current: StaffRequest, id: string) {
    const target = await db.staffUser.findFirst({ where: { AND: [{ id }, visibilityOf(current)] }, include: staffInclude })
    if (target) return target
    throw current.actor.role === 'SUPER_ADMIN' ? new ApiError(404, 'not_found', 'Staff account not found') : refusalError('forbidden')
  }

  async function loadTarget(db: Db, current: StaffRequest, id: string) {
    const target = await loadVisible(db, current, id)
    const refusal = staffManagementRefusal(current.actor, target, {})
    if (refusal) throw refusalError(refusal)
    return target
  }

  app.get('/api/admin/staff', async (request, reply) => {
    const current = await guards.staff(request, reply, { permission: 'staff.manage' })
    const rows = await ctx.prisma.staffUser.findMany({ where: visibilityOf(current), include: staffInclude, orderBy: [{ role: 'asc' }, { displayName: 'asc' }] })
    return { items: rows.map(staffView) }
  })

  app.get('/api/admin/staff/:id', async (request, reply) => {
    const current = await guards.staff(request, reply, { permission: 'staff.manage' })
    const { id } = parseWith(idParams, request.params)
    return { staff: staffView(await loadVisible(ctx.prisma, current, id)) }
  })

  app.post('/api/admin/staff', async (request, reply) => {
    const current = await guards.staff(request, reply, { permission: 'staff.manage', stepUp: true })
    const body = parseWith(createBody, request.body)
    const refusal = staffManagementRefusal(current.actor, null, { role: body.role })
    if (refusal) throw refusalError(refusal)
    const now = ctx.now()
    const email = normalizeEmail(body.email)
    // Namespace rule, decided from the request alone and BEFORE any lookup by email: an address in the reserved
    // namespace gets the same answer whether or not an account with it exists (audited and rate-limited as probing).
    if (isPrivilegedEmail(email) && !isPrivilegedRole(body.role)) {
      await recordAudit(ctx.prisma, { at: now, category: 'SECURITY', type: 'staff_create_reserved_email', outcome: 'denied', actor: actorRef(current), details: { requestedRole: body.role } })
      if (!options.conflictLimiter.take(`staff-conflict:${current.actor.id}`, now.getTime())) throw new ApiError(429, 'rate_limited', 'Too many attempts. Try again later.')
      throw reservedEmail()
    }
    if (isPrivilegedRole(body.role) && !isPrivilegedEmail(email)) throw privilegedEmailRequired()
    const existing = await ctx.prisma.staffUser.findUnique({ where: { email }, select: { id: true } })
    if (existing) {
      // Probing protection: one generic answer, audited (Super Admins see it), and a limit on repeated collisions.
      const visible = (await ctx.prisma.staffUser.count({ where: { AND: [{ id: existing.id }, visibilityOf(current)] } })) > 0
      await recordAudit(ctx.prisma, { at: now, category: 'SECURITY', type: 'staff_create_conflict', outcome: 'denied', actor: actorRef(current), subject: { type: 'STAFF', id: existing.id }, details: { visibleToActor: visible } })
      if (!options.conflictLimiter.take(`staff-conflict:${current.actor.id}`, now.getTime())) throw new ApiError(429, 'rate_limited', 'Too many attempts. Try again later.')
      throw emailUnavailable()
    }
    const result = await ctx.prisma.$transaction(async tx => {
      if (await tx.staffUser.findUnique({ where: { email }, select: { id: true } })) throw emailUnavailable()
      await assertTeam(tx, body.teamId)
      const staff = await tx.staffUser.create({
        data: { email, displayName: body.displayName, role: body.role, teamId: body.teamId ?? null, passwordHash: null, createdById: current.actor.id, createdAt: now },
        include: staffInclude,
      })
      // The new colleague chooses their own password through a one-time setup link (no temporary passwords).
      const link = await issueAccountToken(tx, now, { purpose: 'INVITATION', subject: { subjectType: 'STAFF', staffId: staff.id }, issuedById: current.actor.id })
      await recordAudit(tx, { at: now, category: 'SECURITY', type: 'staff_created', outcome: 'success', actor: actorRef(current), subject: { type: 'STAFF', id: staff.id }, teamId: staff.teamId, details: { role: staff.role } })
      return { staff: staffView(staff), link }
    })
    return reply.code(201).send(result)
  })

  app.patch('/api/admin/staff/:id', async (request, reply) => {
    const current = await guards.staff(request, reply, { permission: 'staff.manage', stepUp: true })
    const { id } = parseWith(idParams, request.params)
    const body = parseWith(updateBody, request.body)
    if (body.role !== undefined && !current.permissions.has('roles.assign')) throw refusalError('forbidden')
    const now = ctx.now()
    const updated = await ctx.prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${SUPER_ADMIN_LOCK_KEY}::bigint)`
      const target = await loadVisible(tx, current, id)
      const refusal = staffManagementRefusal(current.actor, target, { role: body.role, status: body.status })
      if (refusal) throw refusalError(refusal)
      await assertTeam(tx, body.teamId)

      const roleChanged = body.role !== undefined && body.role !== target.role
      // Namespace rule: promotion into Admin/Super Admin needs a separate account with a reserved address; a
      // privileged account cannot be turned into a non-privileged one (disable it instead). Super Admin <-> Admin
      // stays possible. The CHECK constraint enforces the same rule in the database.
      if (roleChanged && isPrivilegedRole(body.role!) !== isPrivilegedEmail(target.email)) {
        throw isPrivilegedRole(body.role!) ? privilegedEmailRequired() : privilegedAccountRole()
      }
      const statusChanged = body.status !== undefined && body.status !== target.status
      const losesSuperAdmin = target.role === 'SUPER_ADMIN' && target.status === 'ACTIVE' && ((roleChanged && body.role !== 'SUPER_ADMIN') || (statusChanged && body.status !== 'ACTIVE'))
      if (losesSuperAdmin) {
        const others = await tx.staffUser.count({ where: { role: 'SUPER_ADMIN', status: 'ACTIVE', NOT: { id: target.id } } })
        if (others === 0) throw new ApiError(409, 'last_super_admin', 'The last active Super Admin cannot be disabled or demoted')
      }

      const data: Prisma.StaffUserUpdateInput = {}
      if (body.displayName !== undefined) data.displayName = body.displayName
      if (body.role !== undefined) data.role = body.role
      if (body.status !== undefined) data.status = body.status
      if (body.teamId !== undefined) data.team = body.teamId ? { connect: { id: body.teamId } } : { disconnect: true }
      const row = await tx.staffUser.update({ where: { id: target.id }, data, include: staffInclude })
      // New role or status: every existing session ends; the next sign-in applies the new rules (incl. 2FA).
      if (roleChanged || statusChanged) await revokeAllSessions(tx, now, { subjectType: 'STAFF', staffId: target.id }, roleChanged ? 'role_changed' : 'status_changed')
      await recordAudit(tx, {
        at: now,
        category: 'SECURITY',
        type: 'staff_updated',
        outcome: 'success',
        actor: actorRef(current),
        subject: { type: 'STAFF', id: target.id },
        teamId: row.teamId,
        details: {
          fromRole: target.role,
          toRole: row.role,
          fromStatus: target.status,
          toStatus: row.status,
          teamChanged: body.teamId !== undefined && body.teamId !== target.teamId,
        },
      })
      return row
    })
    return { staff: staffView(updated) }
  })

  app.post('/api/admin/staff/:id/reset-link', async (request, reply) => {
    const current = await guards.staff(request, reply, { permission: 'staff.reset_password', stepUp: true })
    const { id } = parseWith(idParams, request.params)
    parseWith(emptyBody, request.body)
    if (id === current.actor.id) throw new ApiError(400, 'self_change', 'Change your own password from your session instead')
    const now = ctx.now()
    const link = await ctx.prisma.$transaction(async tx => {
      const target = await loadTarget(tx, current, id)
      const issued = await issueAccountToken(tx, now, { purpose: 'PASSWORD_RESET', subject: { subjectType: 'STAFF', staffId: target.id }, issuedById: current.actor.id })
      await recordAudit(tx, { at: now, category: 'SECURITY', type: 'password_reset_link_issued', outcome: 'success', actor: actorRef(current), subject: { type: 'STAFF', id: target.id }, teamId: target.teamId })
      return issued
    })
    return reply.code(201).send({ link })
  })

  app.post('/api/admin/staff/:id/setup-link', async (request, reply) => {
    const current = await guards.staff(request, reply, { permission: 'staff.manage', stepUp: true })
    const { id } = parseWith(idParams, request.params)
    parseWith(emptyBody, request.body)
    const now = ctx.now()
    const link = await ctx.prisma.$transaction(async tx => {
      const target = await loadTarget(tx, current, id)
      if (target.passwordHash !== null) throw new ApiError(409, 'already_set_up', 'This account already has a password; use a reset link')
      const issued = await issueAccountToken(tx, now, { purpose: 'INVITATION', subject: { subjectType: 'STAFF', staffId: target.id }, issuedById: current.actor.id })
      await recordAudit(tx, { at: now, category: 'SECURITY', type: 'staff_setup_link_issued', outcome: 'success', actor: actorRef(current), subject: { type: 'STAFF', id: target.id }, teamId: target.teamId })
      return issued
    })
    return reply.code(201).send({ link })
  })

  app.post('/api/admin/staff/:id/mfa-reset', async (request, reply) => {
    const current = await guards.staff(request, reply, { permission: 'staff.mfa_reset', stepUp: true })
    const { id } = parseWith(idParams, request.params)
    parseWith(emptyBody, request.body)
    if (id === current.actor.id) throw new ApiError(400, 'self_change', 'You cannot reset your own two-factor authentication')
    const now = ctx.now()
    await ctx.prisma.$transaction(async tx => {
      const target = await loadTarget(tx, current, id)
      await tx.mfaRecoveryCode.deleteMany({ where: { staffId: target.id } })
      await tx.staffMfa.deleteMany({ where: { staffId: target.id } })
      // The person must enrol again (mandatory roles cannot get past MFA_ENROLLMENT_REQUIRED without it).
      await clearAllForAccount(tx, target.id)
      await revokeAllSessions(tx, now, { subjectType: 'STAFF', staffId: target.id }, 'mfa_reset')
      await recordAudit(tx, { at: now, category: 'SECURITY', type: 'mfa_reset', outcome: 'success', actor: actorRef(current), subject: { type: 'STAFF', id: target.id }, teamId: target.teamId })
    })
    return { status: 'mfa_reset' }
  })

  // ---------------------------------------------------------------- teams

  app.get('/api/admin/teams', async (request, reply) => {
    const current = await guards.staff(request, reply, { permission: 'teams.manage' })
    // Staff counts follow staff visibility, in the count query itself: an Admin's counts never include Admin or Super
    // Admin members (hidden accounts); a Super Admin's are complete.
    const visibleStaff = staffVisibilityScope(current.actor) ?? { id: { in: [] } }
    const teams = await ctx.prisma.team.findMany({ orderBy: { name: 'asc' }, include: { _count: { select: { staff: { where: visibleStaff }, customers: true } } } })
    return { items: teams.map(team => ({ id: team.id, name: team.name, staffCount: team._count.staff, customerCount: team._count.customers })) }
  })

  app.post('/api/admin/teams', async (request, reply) => {
    const current = await guards.staff(request, reply, { permission: 'teams.manage' })
    const body = parseWith(teamBody, request.body)
    const now = ctx.now()
    const team = await ctx.prisma.$transaction(async tx => {
      if (await tx.team.findUnique({ where: { name: body.name }, select: { id: true } })) throw new ApiError(409, 'team_exists', 'A team with this name already exists')
      const created = await tx.team.create({ data: { name: body.name, createdAt: now } })
      await recordAudit(tx, { at: now, category: 'OPERATIONAL', type: 'team_created', outcome: 'success', actor: actorRef(current), teamId: created.id, details: { name: created.name } })
      return created
    })
    return reply.code(201).send({ team: { id: team.id, name: team.name } })
  })

  // ---------------------------------------------------------------- audit log (read-only)

  app.get('/api/admin/audit', async (request, reply) => {
    const current = await guards.staff(request, reply, { permission: 'audit.view' })
    const query = parseWith(auditQuery, request.query)
    const scope = auditScope(current.actor)
    if (!scope) throw new ApiError(403, 'forbidden', 'You do not have permission for this action')
    if (query.category === 'SECURITY' && !current.permissions.has('audit.view_security')) throw new ApiError(403, 'forbidden', 'Security events need the audit.view_security permission')
    const filters: Prisma.AuditEventWhereInput[] = [scope]
    if (current.actor.role !== 'SUPER_ADMIN') {
      // Only Super Admins see events about, or performed by, Super Admin and Admin accounts (consistent with staff
      // visibility). Enforced in the query; events of customers and of other staff stay visible as scoped above.
      const privileged = (await ctx.prisma.staffUser.findMany({ where: { role: { in: ['SUPER_ADMIN', 'ADMIN'] } }, select: { id: true } })).map(row => row.id)
      if (privileged.length > 0) {
        filters.push({ OR: [{ subjectId: null }, { subjectType: 'CUSTOMER' }, { subjectId: { notIn: privileged } }] })
        filters.push({ OR: [{ actorId: null }, { actorType: 'CUSTOMER' }, { actorId: { notIn: privileged } }] })
      }
    }
    if (query.category) filters.push({ category: query.category })
    if (query.subjectId) filters.push({ subjectId: query.subjectId })
    if (query.from || query.to) filters.push({ at: { ...(query.from ? { gte: new Date(query.from) } : {}), ...(query.to ? { lte: new Date(query.to) } : {}) } })
    const rows = await ctx.prisma.auditEvent.findMany({ where: { AND: filters }, orderBy: [{ at: 'desc' }, { id: 'desc' }], take: query.limit })
    return {
      items: rows.map(row => ({
        id: row.id,
        at: row.at.toISOString(),
        category: row.category,
        type: row.type,
        outcome: row.outcome,
        actorType: row.actorType,
        actorId: row.actorId,
        subjectType: row.subjectType,
        subjectId: row.subjectId,
        teamId: row.teamId,
        details: row.details,
      })),
    }
  })
}
