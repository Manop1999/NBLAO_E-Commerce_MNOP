/**
 * Admin Portal → Customers (plan §3, §6, §7), under /api/admin/. Every route needs a FULL staff session, the
 * permission named on it, and the customer must be inside the caller's data scope (checked in the query; a
 * customer outside the scope is answered as not found).
 *
 * Separation of duties (D-SOD): the staff member who invited a customer can never approve or reject that
 * customer, whatever their role. The account then stays PENDING until another authorized approver acts.
 */
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { Customer, CustomerStatus, Prisma } from '../generated/prisma/client.ts'
import { ApiError } from '../errors.ts'
import { issueAccountToken } from './accountTokens.ts'
import { recordAudit } from './audit.ts'
import { normalizeEmail, type AuthContext, type Db } from './context.ts'
import { customerProfileFields, customerView } from './customerAuth.ts'
import { invalidStatusMessage } from './customerStatusText.ts'
import { parseWith, type Guards, type StaffRequest } from './http.ts'
import { customerScope, type StaffActor } from './roles.ts'
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

type AdminCustomer = Customer & { team: { id: string; name: string } | null; assignedStaff: { id: string; displayName: string } | null }

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
    approvedByMe: customer.approvedById !== null && customer.approvedById === actor.id,
    approvedAt: customer.approvedAt?.toISOString() ?? null,
    lastLoginAt: customer.lastLoginAt?.toISOString() ?? null,
  }
}

const adminInclude = { team: { select: { id: true, name: true } }, assignedStaff: { select: { id: true, displayName: true } } } as const

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

export function registerAdminCustomerRoutes(app: FastifyInstance, ctx: AuthContext, guards: Guards): void {
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
      if (action.separationOfDuties && customer.invitedById === current.actor.id) {
        await recordAudit(tx, {
          at: now,
          category: 'OPERATIONAL',
          type: action.type,
          outcome: 'denied',
          actor: { type: 'STAFF', id: current.actor.id },
          subject: { type: 'CUSTOMER', id: customer.id },
          teamId: customer.teamId,
          details: { reason: 'separation_of_duties' },
        })
        return { denied: true as const }
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
    if ('denied' in result) throw new ApiError(403, 'separation_of_duties', 'You invited this customer, so another authorized staff member must decide')
    return result
  }

  app.post('/api/admin/customers/:id/approve', async (request, reply) => {
    const current = await guards.staff(request, reply, { permission: 'customers.approve' })
    const { id } = parseWith(idParams, request.params)
    parseWith(emptyBody, request.body)
    return sendTransition(await transition(current, id, { type: 'customer_approved', from: ['PENDING', 'REJECTED'], to: () => 'ACTIVE', reason: undefined, separationOfDuties: true, revokeSessions: false }))
  })

  app.post('/api/admin/customers/:id/reject', async (request, reply) => {
    const current = await guards.staff(request, reply, { permission: 'customers.approve' })
    const { id } = parseWith(idParams, request.params)
    const body = parseWith(reasonRequired, request.body)
    return sendTransition(await transition(current, id, { type: 'customer_rejected', from: ['PENDING'], to: () => 'REJECTED', reason: body.reason, separationOfDuties: true, revokeSessions: true }))
  })

  app.post('/api/admin/customers/:id/suspend', async (request, reply) => {
    const current = await guards.staff(request, reply, { permission: 'customers.approve' })
    const { id } = parseWith(idParams, request.params)
    const body = parseWith(reasonRequired, request.body)
    return sendTransition(await transition(current, id, { type: 'customer_suspended', from: ['ACTIVE', 'PENDING'], to: () => 'SUSPENDED', reason: body.reason, separationOfDuties: false, revokeSessions: true }))
  })

  app.post('/api/admin/customers/:id/reactivate', async (request, reply) => {
    const current = await guards.staff(request, reply, { permission: 'customers.approve' })
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

  app.post('/api/admin/customers/invitations', async (request, reply) => {
    const current = await guards.staff(request, reply, { permission: 'customers.invite' })
    const body = parseWith(invitationBody, request.body)
    const now = ctx.now()
    const email = normalizeEmail(body.email)
    const defaults = { teamId: current.actor.role === 'MANAGER' ? current.actor.teamId : null, assignedStaffId: null }
    const result = await ctx.prisma.$transaction(async tx => {
      if (await tx.customer.findUnique({ where: { email }, select: { id: true } })) {
        throw new ApiError(409, 'email_in_use', 'A customer account with this email already exists')
      }
      const assignment = await resolveAssignment(tx, current, body, defaults)
      const customer = await tx.customer.create({
        data: {
          email,
          firstName: body.firstName,
          lastName: body.lastName,
          phone: body.phone,
          companyName: body.companyName,
          status: 'INVITED',
          passwordHash: null,
          invitedById: current.actor.id,
          createdAt: now,
          ...assignment,
        },
        include: adminInclude,
      })
      const link = await issueAccountToken(tx, now, { purpose: 'INVITATION', subject: { subjectType: 'CUSTOMER', customerId: customer.id }, issuedById: current.actor.id })
      await recordAudit(tx, {
        at: now,
        category: 'OPERATIONAL',
        type: 'customer_invited',
        outcome: 'success',
        actor: { type: 'STAFF', id: current.actor.id },
        subject: { type: 'CUSTOMER', id: customer.id },
        teamId: customer.teamId,
      })
      return { customer: adminCustomerView(customer, current.actor), link }
    })
    return reply.code(201).send(result)
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
