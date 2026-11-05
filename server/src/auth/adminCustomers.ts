/**
 * Admin Portal → Customers (plan §3, §6, §7), under /api/admin/. Every route needs a FULL staff session, the
 * permission named on it, and the customer must be inside the caller's data scope (checked in the query; a
 * customer outside the scope is answered as not found).
 *
 * Separation of duties (D-SOD): the staff member who invited a customer, and the staff member who requested that
 * invitation, can never approve or reject that customer, whatever their role. The account then stays PENDING until
 * another authorized approver acts. Status decisions (approve, reject, suspend, reactivate) need a fresh 2FA
 * confirmation (step-up).
 *
 * Invitations (anti-enumeration): a direct invitation must look the email up across all customers, so only staff
 * with a global customer scope may issue one (`customers.invite`: Admin, Super Admin). Managers file an invitation
 * request instead (`customers.request_invite`): filing never reads the customers table and always answers the same,
 * whether the email is new or belongs to a customer inside or outside the Manager's scope. An Admin reviews the
 * request and issues the invitation or declines; decisions are SECURITY audit events, which Managers cannot read.
 */
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { Customer, CustomerInvitationRequest, CustomerStatus, InvitationRequestStatus, Prisma } from '../generated/prisma/client.ts'
import { ApiError } from '../errors.ts'
import { issueAccountToken } from './accountTokens.ts'
import { recordAudit } from './audit.ts'
import { normalizeEmail, type AuthContext, type Db } from './context.ts'
import { customerProfileFields, customerView } from './customerAuth.ts'
import { invalidStatusMessage } from './customerStatusText.ts'
import { parseWith, type Guards, type StaffRequest } from './http.ts'
import type { AttemptLimiter } from './lockout.ts'
import { ADMIN_MANAGEABLE_ROLES, customerScope, type StaffActor } from './roles.ts'
import { revokeAllSessions } from './sessions.ts'

const uuid = z.uuid()
const reason = z.string().trim().min(1).max(500)
const idParams = z.strictObject({ id: uuid })

const listQuery = z.strictObject({
  status: z.enum(['INVITED', 'PENDING', 'ACTIVE', 'REJECTED', 'SUSPENDED']).optional(),
  teamId: uuid.optional(),
  assignedStaffId: uuid.optional(),
  unassigned: z.enum(['true']).optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
})
const PAGE_SIZE = 50

const reasonRequired = z.strictObject({ reason })
const reasonOptional = z.strictObject({ reason: reason.optional() })
const emptyBody = z.strictObject({})
const assignmentBody = z
  .strictObject({ teamId: uuid.nullable().optional(), assignedStaffId: uuid.nullable().optional() })
  .refine(value => value.teamId !== undefined || value.assignedStaffId !== undefined, 'teamId or assignedStaffId is required')
const invitationBody = z.strictObject({
  email: z.string().trim().min(3).max(254).email(),
  ...customerProfileFields,
  teamId: uuid.nullable().optional(),
  assignedStaffId: uuid.nullable().optional(),
})
const requestListQuery = z.strictObject({
  status: z.enum(['PENDING', 'ISSUED', 'DECLINED']).optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
})
const declineBody = z.strictObject({ note: reason.optional() })

/** Invitation requests filed per staff member per hour (bounds probing volume; in memory: local development only). */
export const INVITATION_REQUESTS_PER_HOUR = 20

const emailInUse = () => new ApiError(409, 'email_in_use', 'A customer account with this email already exists')
const requestNotFound = () => new ApiError(404, 'not_found', 'Invitation request not found')
const requestProcessed = () => new ApiError(409, 'request_processed', 'This invitation request has already been processed')

/** A unique-index violation (e.g. two concurrent invitations of the same email). */
function isUniqueViolation(error: unknown): boolean {
  return error instanceof Error && 'code' in error && (error as { code?: string }).code === 'P2002'
}

/** What the requester sees: never whether the request was issued or declined (that would reveal account existence). */
const requesterStatus = (status: InvitationRequestStatus) => (status === 'PENDING' ? 'SUBMITTED' : 'PROCESSED')

type AdminCustomer = Customer & {
  team: { id: string; name: string } | null
  assignedStaff: { id: string; displayName: string } | null
  invitationRequest: { requestedById: string } | null
}

/**
 * Customer as staff see it. Inviter and approver ids are returned only to Super Admins: for everyone else they
 * could be ids of Super Admin or Admin accounts, so other staff get only "by me" flags (the assigned owner is always
 * a Sales or Manager account and stays visible).
 */
function adminCustomerView(customer: AdminCustomer, actor: StaffActor) {
  const ids = actor.role === 'SUPER_ADMIN' ? { invitedById: customer.invitedById, approvedById: customer.approvedById } : {}
  return {
    ...customerView(customer),
    statusReason: customer.statusReason,
    team: customer.team,
    assignedStaff: customer.assignedStaff,
    ...ids,
    invitedByMe: customer.invitedById === actor.id,
    // Separation of duties also covers the staff member who requested the invitation (never their id).
    requestedByMe: customer.invitationRequest?.requestedById === actor.id,
    approvedByMe: customer.approvedById !== null && customer.approvedById === actor.id,
    approvedAt: customer.approvedAt?.toISOString() ?? null,
    lastLoginAt: customer.lastLoginAt?.toISOString() ?? null,
  }
}

const adminInclude = {
  team: { select: { id: true, name: true } },
  assignedStaff: { select: { id: true, displayName: true } },
  invitationRequest: { select: { requestedById: true } },
} as const

const notFound = () => new ApiError(404, 'not_found', 'Customer not found')

function scopeOf(current: StaffRequest): Prisma.CustomerWhereInput {
  const scope = customerScope(current.actor)
  if (!scope) throw new ApiError(403, 'forbidden', 'You do not have permission for this action')
  return scope
}

async function loadInScope(db: Db, current: StaffRequest, id: string): Promise<AdminCustomer> {
  const customer = await db.customer.findFirst({ where: { AND: [{ id }, scopeOf(current)] }, include: adminInclude })
  if (!customer) throw notFound()
  return customer
}

/**
 * Validates a team / sales-owner assignment for the caller. Managers can only assign within their own team;
 * the owner must be an active Sales or Manager account, in the same team when a team is set.
 */
async function resolveAssignment(
  db: Db,
  current: StaffRequest,
  requested: { teamId?: string | null | undefined; assignedStaffId?: string | null | undefined },
  existing: { teamId: string | null; assignedStaffId: string | null },
): Promise<{ teamId: string | null; assignedStaffId: string | null }> {
  let teamId = requested.teamId === undefined ? existing.teamId : requested.teamId
  const assignedStaffId = requested.assignedStaffId === undefined ? existing.assignedStaffId : requested.assignedStaffId

  if (assignedStaffId) {
    const owner = await db.staffUser.findUnique({ where: { id: assignedStaffId }, select: { role: true, status: true, teamId: true } })
    if (!owner || owner.status !== 'ACTIVE' || (owner.role !== 'SALES' && owner.role !== 'MANAGER')) {
      throw new ApiError(400, 'invalid_assignee', 'The selected owner must be an active Sales or Manager account')
    }
    if (teamId === null && owner.teamId) teamId = owner.teamId
    if (owner.teamId !== teamId) throw new ApiError(400, 'assignee_not_in_team', 'The selected owner is not in that team')
  }
  if (teamId && !(await db.team.findUnique({ where: { id: teamId }, select: { id: true } }))) {
    throw new ApiError(400, 'invalid_team', 'Team not found')
  }
  if (current.actor.role === 'MANAGER') {
    const ownTeam = current.actor.teamId
    const stays = teamId === ownTeam || (teamId === null && assignedStaffId === null)
    if (!stays) throw new ApiError(403, 'forbidden', 'Managers can only assign customers within their own team')
  }
  return { teamId, assignedStaffId }
}

export interface AdminCustomerOptions {
  /** Limits invitation requests per staff member (anti-probing), in memory: local development only. */
  requestLimiter: AttemptLimiter
}

export function registerAdminCustomerRoutes(app: FastifyInstance, ctx: AuthContext, guards: Guards, options: AdminCustomerOptions): void {
  app.get('/api/admin/customers', async (request, reply) => {
    const current = await guards.staff(request, reply, { permission: 'customers.view' })
    const query = parseWith(listQuery, request.query)
    const filters: Prisma.CustomerWhereInput[] = [scopeOf(current)]
    if (query.status) filters.push({ status: query.status })
    if (query.teamId) filters.push({ teamId: query.teamId })
    if (query.assignedStaffId) filters.push({ assignedStaffId: query.assignedStaffId })
    if (query.unassigned) filters.push({ teamId: null, assignedStaffId: null })
    const where = { AND: filters }
    const [total, rows] = await Promise.all([
      ctx.prisma.customer.count({ where }),
      ctx.prisma.customer.findMany({ where, include: adminInclude, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], skip: (query.page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
    ])
    return { items: rows.map(row => adminCustomerView(row, current.actor)), total, page: query.page, pageSize: PAGE_SIZE }
  })

  /** Shared status transition: conditional update (no race), session revocation, audit with actor ID. */
  async function transition(
    current: StaffRequest,
    id: string,
    action: { type: string; from: CustomerStatus[]; to: (customer: Customer) => CustomerStatus; reason: string | undefined; separationOfDuties: boolean; revokeSessions: boolean },
  ) {
    const now = ctx.now()
    return ctx.prisma.$transaction(async tx => {
      const customer = await loadInScope(tx, current, id)
      if (action.separationOfDuties) {
        // The inviter, and the staff member who requested the invitation, may never decide on this customer.
        const invited = customer.invitedById === current.actor.id
        const requested = !invited && customer.invitationRequest?.requestedById === current.actor.id
        if (invited || requested) {
          await recordAudit(tx, {
            at: now,
            category: 'OPERATIONAL',
            type: action.type,
            outcome: 'denied',
            actor: { type: 'STAFF', id: current.actor.id },
            subject: { type: 'CUSTOMER', id: customer.id },
            teamId: customer.teamId,
            details: { reason: 'separation_of_duties', role: invited ? 'inviter' : 'requester' },
          })
          return { denied: true as const }
        }
      }
      if (!action.from.includes(customer.status)) throw new ApiError(409, 'invalid_status', invalidStatusMessage(customer.status))
      const toStatus = action.to(customer)
      const approving = toStatus === 'ACTIVE' && action.type === 'customer_approved'
      const updated = await tx.customer.updateMany({
        where: { id: customer.id, status: customer.status },
        data: {
          status: toStatus,
          statusReason: action.reason ?? null,
          statusChangedById: current.actor.id,
          ...(approving ? { approvedById: current.actor.id, approvedAt: now } : {}),
        },
      })
      if (updated.count !== 1) throw new ApiError(409, 'conflict', 'The account changed in the meantime. Reload and try again.')
      if (action.revokeSessions) await revokeAllSessions(tx, now, { subjectType: 'CUSTOMER', customerId: customer.id }, action.type)
      await recordAudit(tx, {
        at: now,
        category: 'OPERATIONAL',
        type: action.type,
        outcome: 'success',
        actor: { type: 'STAFF', id: current.actor.id },
        subject: { type: 'CUSTOMER', id: customer.id },
        teamId: customer.teamId,
        details: { fromStatus: customer.status, toStatus, reason: action.reason },
      })
      return { customer: adminCustomerView(await loadInScope(tx, current, id), current.actor) }
    })
  }

  const sendTransition = (result: Awaited<ReturnType<typeof transition>>) => {
    // Thrown outside the transaction so the denial audit event above is committed.
    if ('denied' in result) throw new ApiError(403, 'separation_of_duties', 'You invited this customer or requested the invitation, so another authorized staff member must decide')
    return result
  }

  // Status decisions are sensitive: each needs a 2FA confirmation within the last 5 minutes (step-up), checked by
  // the guard before the body is read or the customer is looked up.
  app.post('/api/admin/customers/:id/approve', async (request, reply) => {
    const current = await guards.staff(request, reply, { permission: 'customers.approve', stepUp: true })
    const { id } = parseWith(idParams, request.params)
    parseWith(emptyBody, request.body)
    return sendTransition(await transition(current, id, { type: 'customer_approved', from: ['PENDING', 'REJECTED'], to: () => 'ACTIVE', reason: undefined, separationOfDuties: true, revokeSessions: false }))
  })

  app.post('/api/admin/customers/:id/reject', async (request, reply) => {
    const current = await guards.staff(request, reply, { permission: 'customers.approve', stepUp: true })
    const { id } = parseWith(idParams, request.params)
    const body = parseWith(reasonRequired, request.body)
    return sendTransition(await transition(current, id, { type: 'customer_rejected', from: ['PENDING'], to: () => 'REJECTED', reason: body.reason, separationOfDuties: true, revokeSessions: true }))
  })

  app.post('/api/admin/customers/:id/suspend', async (request, reply) => {
    const current = await guards.staff(request, reply, { permission: 'customers.approve', stepUp: true })
    const { id } = parseWith(idParams, request.params)
    const body = parseWith(reasonRequired, request.body)
    return sendTransition(await transition(current, id, { type: 'customer_suspended', from: ['ACTIVE', 'PENDING'], to: () => 'SUSPENDED', reason: body.reason, separationOfDuties: false, revokeSessions: true }))
  })

  app.post('/api/admin/customers/:id/reactivate', async (request, reply) => {
    const current = await guards.staff(request, reply, { permission: 'customers.approve', stepUp: true })
    const { id } = parseWith(idParams, request.params)
    const body = parseWith(reasonOptional, request.body)
    // A customer who was never approved goes back to PENDING, so reactivation can never skip approval.
    return sendTransition(
      await transition(current, id, { type: 'customer_reactivated', from: ['SUSPENDED'], to: customer => (customer.approvedAt ? 'ACTIVE' : 'PENDING'), reason: body.reason, separationOfDuties: false, revokeSessions: false }),
    )
  })

  app.patch('/api/admin/customers/:id/assignment', async (request, reply) => {
    const current = await guards.staff(request, reply, { permission: 'customers.assign' })
    const { id } = parseWith(idParams, request.params)
    const body = parseWith(assignmentBody, request.body)
    const now = ctx.now()
    return ctx.prisma.$transaction(async tx => {
      const customer = await loadInScope(tx, current, id)
      const next = await resolveAssignment(tx, current, body, customer)
      await tx.customer.update({ where: { id: customer.id }, data: next })
      await recordAudit(tx, {
        at: now,
        category: 'OPERATIONAL',
        type: 'customer_assigned',
        outcome: 'success',
        actor: { type: 'STAFF', id: current.actor.id },
        subject: { type: 'CUSTOMER', id: customer.id },
        teamId: next.teamId,
        details: { fromTeamId: customer.teamId, toTeamId: next.teamId, fromStaffId: customer.assignedStaffId, toStaffId: next.assignedStaffId },
      })
      const updated = await tx.customer.findUniqueOrThrow({ where: { id: customer.id }, include: adminInclude })
      return { customer: adminCustomerView(updated, current.actor) }
    })
  })

  /**
   * Creates the INVITED customer and its one-time invitation link, inside the caller's transaction. Only for staff
   * with a global customer scope (`customers.invite`), who may learn that an email is already registered.
   */
  async function inviteCustomer(
    tx: Db,
    current: StaffRequest,
    now: Date,
    profile: { email: string; firstName: string; lastName: string; phone: string; companyName: string },
    assignment: { teamId: string | null; assignedStaffId: string | null },
    requestId?: string,
  ) {
    if (await tx.customer.findUnique({ where: { email: profile.email }, select: { id: true } })) throw emailInUse()
    const customer = await tx.customer.create({
      data: { ...profile, status: 'INVITED', passwordHash: null, invitedById: current.actor.id, createdAt: now, ...assignment },
      include: adminInclude,
    })
    const link = await issueAccountToken(tx, now, { purpose: 'INVITATION', subject: { subjectType: 'CUSTOMER', customerId: customer.id }, issuedById: current.actor.id })
    await recordAudit(tx, {
      at: now,
      // Issued from a Manager's request: SECURITY, so the requester can never read the outcome through the audit
      // log (Managers read OPERATIONAL events only). Direct invitations stay OPERATIONAL.
      category: requestId ? 'SECURITY' : 'OPERATIONAL',
      type: 'customer_invited',
      outcome: 'success',
      actor: { type: 'STAFF', id: current.actor.id },
      subject: { type: 'CUSTOMER', id: customer.id },
      teamId: customer.teamId,
      ...(requestId ? { details: { requestId } } : {}),
    })
    return { customer, link }
  }

  /** Runs an invitation transaction; a concurrent invitation or registration of the same email is a 409, never a 500. */
  async function withEmailConflictAs409<T>(work: () => Promise<T>): Promise<T> {
    try {
      return await work()
    } catch (error) {
      if (isUniqueViolation(error)) throw emailInUse()
      throw error
    }
  }

  // Direct invitation: Admin and Super Admin only (global customer scope), see the file header. Issuing an account
  // link is sensitive: fresh 2FA (step-up), checked by the guard before anything is read or written.
  app.post('/api/admin/customers/invitations', async (request, reply) => {
    const current = await guards.staff(request, reply, { permission: 'customers.invite', stepUp: true })
    const body = parseWith(invitationBody, request.body)
    const now = ctx.now()
    const email = normalizeEmail(body.email)
    const result = await withEmailConflictAs409(() =>
      ctx.prisma.$transaction(async tx => {
        const assignment = await resolveAssignment(tx, current, body, { teamId: null, assignedStaffId: null })
        const profile = { email, firstName: body.firstName, lastName: body.lastName, phone: body.phone, companyName: body.companyName }
        const { customer, link } = await inviteCustomer(tx, current, now, profile, assignment)
        return { customer: adminCustomerView(customer, current.actor), link }
      }),
    )
    return reply.code(201).send(result)
  })

  // ---------------------------------------------------------------- invitation requests (Manager → Admin)

  /**
   * Files a request. Deliberately never reads the customers table, so the answer (status, body, timing) is the same
   * for a new email and for one registered inside or outside the requester's scope.
   */
  app.post('/api/admin/customers/invitation-requests', async (request, reply) => {
    const current = await guards.staff(request, reply, { permission: 'customers.request_invite' })
    // A Manager's customers belong to their team; without one, the invited customer would be unassigned and visible
    // to every Manager. Decided from the session alone, before the body or the database.
    if (current.actor.role === 'MANAGER' && !current.actor.teamId) throw new ApiError(403, 'team_required', 'You need to belong to a team before requesting customer invitations')
    const body = parseWith(invitationBody, request.body)
    const now = ctx.now()
    if (!options.requestLimiter.take(`invitation-request:${current.actor.id}`, now.getTime())) throw new ApiError(429, 'rate_limited', 'Too many attempts. Try again later.')
    const email = normalizeEmail(body.email)
    const defaults = { teamId: current.actor.role === 'MANAGER' ? current.actor.teamId : null, assignedStaffId: null }
    const created = await ctx.prisma.$transaction(async tx => {
      const assignment = await resolveAssignment(tx, current, body, defaults)
      const row = await tx.customerInvitationRequest.create({
        data: {
          email,
          firstName: body.firstName,
          lastName: body.lastName,
          phone: body.phone,
          companyName: body.companyName,
          requestedById: current.actor.id,
          createdAt: now,
          ...assignment,
        },
        select: { id: true, createdAt: true },
      })
      await recordAudit(tx, {
        at: now,
        category: 'OPERATIONAL',
        type: 'customer_invitation_requested',
        outcome: 'success',
        actor: { type: 'STAFF', id: current.actor.id },
        teamId: assignment.teamId,
        details: { requestId: row.id },
      })
      return row
    })
    return reply.code(202).send({ request: { id: created.id, status: 'SUBMITTED', createdAt: created.createdAt.toISOString() } })
  })

  /**
   * Reviewers (`customers.invite`) see every request with its real status and whether the email is already
   * registered. Everyone else sees only their own requests as SUBMITTED / PROCESSED, never the outcome.
   */
  app.get('/api/admin/customers/invitation-requests', async (request, reply) => {
    const current = await guards.staff(request, reply)
    const reviewer = current.permissions.has('customers.invite')
    if (!reviewer && !current.permissions.has('customers.request_invite')) throw new ApiError(403, 'forbidden', 'You do not have permission for this action')
    const query = parseWith(requestListQuery, request.query)
    // Filtering by outcome would reveal it to a requester.
    if (!reviewer && query.status) throw new ApiError(403, 'forbidden', 'You do not have permission for this action')
    const where: Prisma.CustomerInvitationRequestWhereInput = reviewer ? (query.status ? { status: query.status } : {}) : { requestedById: current.actor.id }
    const [total, rows] = await Promise.all([
      ctx.prisma.customerInvitationRequest.count({ where }),
      ctx.prisma.customerInvitationRequest.findMany({
        where,
        include: { team: { select: { id: true, name: true } }, assignedStaff: { select: { id: true, displayName: true } } },
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: (query.page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
      }),
    ])
    const page = { total, page: query.page, pageSize: PAGE_SIZE }
    if (!reviewer) {
      return {
        items: rows.map(row => ({
          id: row.id,
          email: row.email,
          firstName: row.firstName,
          lastName: row.lastName,
          companyName: row.companyName,
          team: row.team,
          status: requesterStatus(row.status),
          createdAt: row.createdAt.toISOString(),
        })),
        ...page,
      }
    }
    // Registered emails, within the reviewer's customer scope (global for Admin and Super Admin).
    const emails = [...new Set(rows.map(row => row.email))]
    const scope = customerScope(current.actor) ?? { id: { in: [] } }
    const existing = emails.length
      ? await ctx.prisma.customer.findMany({ where: { AND: [{ email: { in: emails } }, scope] }, select: { id: true, email: true, status: true, team: { select: { id: true, name: true } } } })
      : []
    const byEmail = new Map(existing.map(customer => [customer.email, customer]))
    // Requester ids and names only when the reviewer may see that account (same rule as staff visibility).
    const requesterIds = [...new Set(rows.map(row => row.requestedById))]
    const requesters = await ctx.prisma.staffUser.findMany({ where: { id: { in: requesterIds } }, select: { id: true, displayName: true, role: true } })
    const visibleRequester = new Map(
      requesters
        .filter(staff => current.actor.role === 'SUPER_ADMIN' || ADMIN_MANAGEABLE_ROLES.includes(staff.role))
        .map(staff => [staff.id, { id: staff.id, displayName: staff.displayName, role: staff.role }]),
    )
    return {
      items: rows.map(row => {
        const match = byEmail.get(row.email)
        return {
          id: row.id,
          email: row.email,
          firstName: row.firstName,
          lastName: row.lastName,
          phone: row.phone,
          companyName: row.companyName,
          team: row.team,
          assignedStaff: row.assignedStaff,
          status: row.status,
          requestedBy: visibleRequester.get(row.requestedById) ?? null,
          requestedByMe: row.requestedById === current.actor.id,
          decidedByMe: row.decidedById !== null && row.decidedById === current.actor.id,
          decidedAt: row.decidedAt?.toISOString() ?? null,
          decisionNote: row.decisionNote,
          customerId: row.customerId,
          existingCustomer: match ? { id: match.id, status: match.status, team: match.team } : null,
          createdAt: row.createdAt.toISOString(),
        }
      }),
      ...page,
    }
  })

  /** Claims a PENDING request for this decision (conditional update: two reviewers cannot both decide). */
  async function claimRequest(tx: Db, current: StaffRequest, id: string, now: Date, status: InvitationRequestStatus, note?: string): Promise<CustomerInvitationRequest> {
    const claimed = await tx.customerInvitationRequest.updateMany({
      where: { id, status: 'PENDING' },
      data: { status, decidedById: current.actor.id, decidedAt: now, ...(note ? { decisionNote: note } : {}) },
    })
    if (claimed.count !== 1) {
      throw (await tx.customerInvitationRequest.count({ where: { id } })) > 0 ? requestProcessed() : requestNotFound()
    }
    return tx.customerInvitationRequest.findUniqueOrThrow({ where: { id } })
  }

  const decisionAudit = (db: Db, current: StaffRequest, now: Date, type: string, outcome: 'success' | 'denied', request: { id: string; teamId: string | null }, extra: Record<string, unknown> = {}, customerId?: string) =>
    recordAudit(db, {
      at: now,
      // SECURITY: a Manager may read OPERATIONAL events of their team, and the outcome would tell them whether the
      // email was already registered.
      category: 'SECURITY',
      type,
      outcome,
      actor: { type: 'STAFF', id: current.actor.id },
      ...(customerId ? { subject: { type: 'CUSTOMER' as const, id: customerId } } : {}),
      teamId: request.teamId,
      details: { requestId: request.id, ...extra },
    })

  // Issue and decline need fresh 2FA (step-up), checked by the guard before the request is read or claimed, so a
  // refused attempt never consumes or changes the request.
  app.post('/api/admin/customers/invitation-requests/:id/issue', async (request, reply) => {
    const current = await guards.staff(request, reply, { permission: 'customers.invite', stepUp: true })
    const { id } = parseWith(idParams, request.params)
    parseWith(emptyBody, request.body)
    const now = ctx.now()
    try {
      const result = await withEmailConflictAs409(() =>
        ctx.prisma.$transaction(async tx => {
          const claimed = await claimRequest(tx, current, id, now, 'ISSUED')
          // The requested team and owner are checked again, now with the reviewer's rights.
          const assignment = await resolveAssignment(tx, current, { teamId: claimed.teamId, assignedStaffId: claimed.assignedStaffId }, { teamId: null, assignedStaffId: null })
          const profile = { email: claimed.email, firstName: claimed.firstName, lastName: claimed.lastName, phone: claimed.phone, companyName: claimed.companyName }
          const { customer, link } = await inviteCustomer(tx, current, now, profile, assignment, claimed.id)
          await tx.customerInvitationRequest.update({ where: { id }, data: { customerId: customer.id } })
          await decisionAudit(tx, current, now, 'customer_invitation_request_issued', 'success', claimed, {}, customer.id)
          return { customer, link }
        }),
      )
      return reply.code(201).send({ customer: adminCustomerView(result.customer, current.actor), link: result.link })
    } catch (error) {
      // The transaction rolled back, so the request is still PENDING; the reviewer can decline it.
      if (error instanceof ApiError && error.code === 'email_in_use') {
        const pending = await ctx.prisma.customerInvitationRequest.findUnique({ where: { id }, select: { id: true, teamId: true } })
        if (pending) await decisionAudit(ctx.prisma, current, now, 'customer_invitation_request_issued', 'denied', pending, { reason: 'email_in_use' })
      }
      throw error
    }
  })

  app.post('/api/admin/customers/invitation-requests/:id/decline', async (request, reply) => {
    const current = await guards.staff(request, reply, { permission: 'customers.invite', stepUp: true })
    const { id } = parseWith(idParams, request.params)
    const body = parseWith(declineBody, request.body)
    const now = ctx.now()
    const declined = await ctx.prisma.$transaction(async tx => {
      const row = await claimRequest(tx, current, id, now, 'DECLINED', body.note)
      await decisionAudit(tx, current, now, 'customer_invitation_request_declined', 'success', row)
      return row
    })
    return { request: { id: declined.id, status: declined.status, decidedAt: declined.decidedAt?.toISOString() ?? null } }
  })

  app.post('/api/admin/customers/:id/reset-link', async (request, reply) => {
    const current = await guards.staff(request, reply, { permission: 'customers.reset_password', stepUp: true })
    const { id } = parseWith(idParams, request.params)
    parseWith(emptyBody, request.body)
    const now = ctx.now()
    const link = await ctx.prisma.$transaction(async tx => {
      const customer = await loadInScope(tx, current, id)
      if (customer.status === 'INVITED') throw new ApiError(409, 'invitation_pending', 'This customer has not accepted the invitation yet')
      const issued = await issueAccountToken(tx, now, { purpose: 'PASSWORD_RESET', subject: { subjectType: 'CUSTOMER', customerId: customer.id }, issuedById: current.actor.id })
      await recordAudit(tx, {
        at: now,
        category: 'SECURITY',
        type: 'password_reset_link_issued',
        outcome: 'success',
        actor: { type: 'STAFF', id: current.actor.id },
        subject: { type: 'CUSTOMER', id: customer.id },
        teamId: customer.teamId,
      })
      return issued
    })
    return reply.code(201).send({ link })
  })

  // Lookups for the assignment and invitation forms, limited to what the caller may assign.
  app.get('/api/admin/assignment-options', async (request, reply) => {
    const current = await guards.staff(request, reply, { permission: 'customers.assign' })
    const manager = current.actor.role === 'MANAGER'
    if (manager && !current.actor.teamId) return { teams: [], staff: [] }
    const teamFilter = manager ? { id: current.actor.teamId! } : {}
    const [teams, staff] = await Promise.all([
      ctx.prisma.team.findMany({ where: teamFilter, orderBy: { name: 'asc' }, select: { id: true, name: true } }),
      ctx.prisma.staffUser.findMany({
        where: { status: 'ACTIVE', role: { in: ['SALES', 'MANAGER'] }, ...(manager ? { teamId: current.actor.teamId } : {}) },
        orderBy: { displayName: 'asc' },
        select: { id: true, displayName: true, role: true, teamId: true },
      }),
    ])
    return { teams, staff }
  })
}
