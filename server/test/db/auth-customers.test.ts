import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { REGISTRATION_ACCEPTED } from '../../src/auth/customerAuth'
import { createHarness, PASSWORD, removeStaleFixtures, type Browser } from './authHarness'

const h = createHarness()
const MIN = 60_000
const HOUR = 60 * MIN

let teamA: { id: string }
let teamB: { id: string }
const people: Record<string, { id: string; email: string; agent: Browser; secret: Buffer | undefined }> = {}

/** The person's browser, signed in again (with 2FA) if the injected clock let the session expire. */
async function who(name: string): Promise<Browser> {
  const person = people[name]!
  if ((await person.agent.refresh('staff')).statusCode !== 200) person.agent = (await h.signedInStaff(person.email, person.secret)).agent
  return person.agent
}
/** The person's browser with a fresh 2FA confirmation (step-up), needed for customer status decisions. */
async function decider(name: string): Promise<Browser> {
  const agent = await who(name)
  const step = await h.stepUp(agent, people[name]!.secret!)
  expect(step.statusCode, `step-up ${name}`).toBe(200)
  return agent
}
const tokenOf = (path: string) => path.split('#')[1]!
const listIds = async (agent: Browser, query = '') => {
  const response = await agent.get(`/api/admin/customers${query}`)
  expect(response.statusCode).toBe(200)
  return (response.json().items as { id: string }[]).map(item => item.id)
}
const auditFor = (subjectId: string, type: string) => h.prisma.auditEvent.findMany({ where: { subjectId, type }, orderBy: { at: 'asc' } })

type AuditItem = { type: string; category: string; teamId: string | null; actorId: string | null; subjectId: string | null }
/**
 * Reads an audit listing of a window opened with h.freshAuditWindow() (after the latest audit event in the database,
 * so only this run writes to it): completely (under the page limit), and checks that every event belongs to this run,
 * i.e. was performed by or is about an account or customer this run created.
 */
async function readWindow(agent: Browser, query: string, label: string): Promise<{ items: AuditItem[]; body: string }> {
  const response = await agent.get(`/api/admin/audit?${query}`)
  expect(response.statusCode, label).toBe(200)
  const items = response.json().items as AuditItem[]
  expect(items.length, `${label}: the whole window was read`).toBeLessThan(200)
  const runIds = new Set([...Object.values(people).map(person => person.id), ...(await h.prisma.customer.findMany({ where: { email: { startsWith: h.run } }, select: { id: true } })).map(row => row.id)])
  for (const event of items) expect(runIds.has(event.actorId ?? '') || runIds.has(event.subjectId ?? ''), `${label}: ${event.type} belongs to this run`).toBe(true)
  return { items, body: response.body }
}

beforeAll(async () => {
  await removeStaleFixtures(h.prisma, h.run)
  teamA = await h.team('Team A')
  teamB = await h.team('Team B')
  const accounts = {
    sa: ['SUPER_ADMIN', null],
    admin: ['ADMIN', null],
    managerA: ['MANAGER', teamA.id],
    managerA2: ['MANAGER', teamA.id],
    managerB: ['MANAGER', teamB.id],
    managerNoTeam: ['MANAGER', null],
    salesA: ['SALES', teamA.id],
    salesA2: ['SALES', teamA.id],
    warehouse: ['WAREHOUSE', null],
  } as const
  for (const [name, [role, teamId]] of Object.entries(accounts)) {
    const row = await h.staff(name, role, { teamId })
    const { agent, secret } = await h.signedInStaff(row.email)
    people[name] = { id: row.id, email: row.email, agent, secret }
  }
})
afterAll(() => h.cleanup())

describe('self-registration (option B)', () => {
  it('creates a PENDING, unassigned account, answers duplicates identically and signs nobody in', async () => {
    const guest = h.browser()
    const body = { email: h.email('Self.Reg').toUpperCase(), password: PASSWORD, firstName: 'Test', lastName: 'Registrant', phone: '+856 20 1111 2222', companyName: 'Example Trading' }
    const first = await guest.post('/api/auth/customer/register', body)
    expect(first.statusCode).toBe(202)
    expect(first.json()).toEqual(REGISTRATION_ACCEPTED)
    expect(first.cookies).toHaveLength(0)
    const duplicate = await guest.post('/api/auth/customer/register', { ...body, password: 'a completely different one' })
    expect(duplicate.statusCode).toBe(202)
    expect(duplicate.body).toBe(first.body)

    const row = await h.prisma.customer.findUniqueOrThrow({ where: { email: h.email('self.reg') } })
    expect(row).toMatchObject({ status: 'PENDING', teamId: null, assignedStaffId: null, invitedById: null })
    expect(await h.hasher.verify(row.passwordHash!, PASSWORD)).toBe(true)
    expect((await auditFor(row.id, 'customer_registered'))).toHaveLength(1)

    expect((await guest.post('/api/auth/customer/register', { ...body, email: h.email('weak'), password: 'password1234' })).statusCode).toBe(422)
    expect((await guest.post('/api/auth/customer/register', { ...body, email: h.email('extra'), status: 'ACTIVE' })).statusCode).toBe(400)

    const pending = h.browser()
    expect((await pending.customerLogin(body.email)).json()).toEqual({ status: 'PENDING' })
    expect((await pending.get('/api/auth/customer/session')).json().customer).toMatchObject({ status: 'PENDING', email: h.email('self.reg') })
  })

  it('refuses REJECTED and SUSPENDED customers only after a correct password', async () => {
    const customer = await h.customer('suspended', { status: 'SUSPENDED' })
    expect((await h.browser().customerLogin(customer.email, 'wrong password value')).json().error.code).toBe('invalid_credentials')
    const correct = await h.browser().customerLogin(customer.email)
    expect(correct.statusCode).toBe(403)
    expect(correct.json().error.code).toBe('account_inactive')
    expect(correct.cookies).toHaveLength(0)
  })
})

describe('scopes', () => {
  it('shows Sales only their own customers, Managers their team plus unassigned, Admins everything', async () => {
    const unassigned = await h.customer('unassigned')
    const inA = await h.customer('in-a', { teamId: teamA.id })
    const inB = await h.customer('in-b', { teamId: teamB.id })
    const salesOwned = await h.customer('sales-owned', { teamId: teamA.id, assignedStaffId: people.salesA!.id })
    const query = `?page=1`

    const sales = await listIds((await who('salesA')), query)
    expect(sales).toContain(salesOwned.id)
    expect(sales).not.toContain(unassigned.id)
    expect(sales).not.toContain(inA.id)
    expect(await listIds((await who('salesA2')))).not.toContain(salesOwned.id)

    const managerA = await listIds((await who('managerA')), '?unassigned=true')
    expect(managerA).toContain(unassigned.id)
    const managerAAll = new Set<string>()
    for (let page = 1; page <= 20; page += 1) {
      const response = await (await who('managerA')).get(`/api/admin/customers?page=${page}`)
      const items = response.json().items as { id: string }[]
      items.forEach(item => managerAAll.add(item.id))
      if (items.length < 50) break
    }
    expect(managerAAll.has(inA.id) && managerAAll.has(salesOwned.id) && managerAAll.has(unassigned.id)).toBe(true)
    expect(managerAAll.has(inB.id)).toBe(false)

    expect(await listIds((await who('managerNoTeam')), `?teamId=${teamA.id}`)).toEqual([])
    expect(await listIds((await who('admin')), `?teamId=${teamB.id}`)).toContain(inB.id)
    expect((await (await who('warehouse')).get('/api/admin/customers')).json().error.code).toBe('forbidden')

    // Out of scope looks exactly like a missing customer (also with a fresh 2FA confirmation).
    const outOfScope = await (await decider('managerA')).post(`/api/admin/customers/${inB.id}/approve`)
    expect(outOfScope.statusCode).toBe(404)
    expect((await (await who('salesA')).post(`/api/admin/customers/${salesOwned.id}/approve`)).json().error.code).toBe('forbidden')
  })
})

describe('approval workflow', () => {
  it('lets Manager, Admin and Super Admin approve, reject, suspend and reactivate, auditing the actor', async () => {
    const one = await h.customer('approve-one')
    const approved = await (await decider('managerA')).post(`/api/admin/customers/${one.id}/approve`)
    expect(approved.statusCode).toBe(200)
    expect(approved.json().customer).toMatchObject({ status: 'ACTIVE', approvedByMe: true })
    expect((await h.prisma.customer.findUniqueOrThrow({ where: { id: one.id } })).approvedById).toBe(people.managerA!.id)
    const [event] = await auditFor(one.id, 'customer_approved')
    expect(event).toMatchObject({ category: 'OPERATIONAL', outcome: 'success', actorType: 'STAFF', actorId: people.managerA!.id })

    expect((await (await decider('admin')).post(`/api/admin/customers/${one.id}/approve`)).json().error.code).toBe('invalid_status')
    expect((await (await decider('admin')).post(`/api/admin/customers/${one.id}/suspend`, {})).statusCode).toBe(400)
    const session = h.browser()
    await session.customerLogin(one.email)
    expect((await (await decider('admin')).post(`/api/admin/customers/${one.id}/suspend`, { reason: 'Test suspension' })).json().customer.status).toBe('SUSPENDED')
    expect((await session.get('/api/auth/customer/session')).statusCode).toBe(401)
    expect((await (await decider('sa')).post(`/api/admin/customers/${one.id}/reactivate`, {})).json().customer.status).toBe('ACTIVE')
    expect((await auditFor(one.id, 'customer_suspended'))[0]).toMatchObject({ outcome: 'success', actorId: people.admin!.id, details: { fromStatus: 'ACTIVE', toStatus: 'SUSPENDED', reason: 'Test suspension' } })
    expect((await auditFor(one.id, 'customer_reactivated'))[0]).toMatchObject({ outcome: 'success', actorId: people.sa!.id, details: { fromStatus: 'SUSPENDED', toStatus: 'ACTIVE' } })

    const two = await h.customer('reject-two')
    expect((await (await decider('sa')).post(`/api/admin/customers/${two.id}/reject`, {})).statusCode).toBe(400)
    const rejected = await (await decider('sa')).post(`/api/admin/customers/${two.id}/reject`, { reason: 'Company could not be verified' })
    expect(rejected.json().customer).toMatchObject({ status: 'REJECTED', statusReason: 'Company could not be verified' })
    expect((await auditFor(two.id, 'customer_rejected'))[0]?.details).toMatchObject({ reason: 'Company could not be verified', toStatus: 'REJECTED' })

    // A never-approved customer goes back to PENDING when reactivated (no approval bypass).
    const three = await h.customer('never-approved')
    await (await decider('admin')).post(`/api/admin/customers/${three.id}/suspend`, { reason: 'Test' })
    expect((await (await decider('admin')).post(`/api/admin/customers/${three.id}/reactivate`, {})).json().customer.status).toBe('PENDING')
  })
})

describe('fresh 2FA (step-up) for status decisions', () => {
  const actions = [
    { action: 'approve', status: 'PENDING', body: {} },
    { action: 'reject', status: 'PENDING', body: { reason: 'Test' } },
    { action: 'suspend', status: 'ACTIVE', body: { reason: 'Test' } },
    { action: 'reactivate', status: 'SUSPENDED', body: {} },
  ] as const

  it('refuses every decision without a 2FA confirmation in the last 5 minutes, changing and auditing nothing', async () => {
    for (const name of ['managerA', 'admin', 'sa']) {
      const agent = await who(name)
      // The sign-in confirmation counts as a step-up for 5 minutes; let it expire.
      h.advance(6 * MIN)
      for (const { action, status, body } of actions) {
        const customer = await h.customer(`stepup-${name}-${action}`, { status, teamId: teamA.id })
        const refused = await agent.post(`/api/admin/customers/${customer.id}/${action}`, body)
        expect(refused.statusCode, `${name} ${action}`).toBe(403)
        expect(refused.json().error.code).toBe('step_up_required')
        expect((await h.prisma.customer.findUniqueOrThrow({ where: { id: customer.id } })).status).toBe(status)
        expect(await h.prisma.auditEvent.count({ where: { subjectId: customer.id } })).toBe(0)
      }
    }
  })

  it('accepts every decision with a fresh confirmation and records the decision in the audit log', async () => {
    const manager = people.managerA!
    for (const { action, status, body } of actions) {
      const customer = await h.customer(`stepup-ok-${action}`, { status, teamId: teamA.id })
      const agent = await decider('managerA')
      const response = await agent.post(`/api/admin/customers/${customer.id}/${action}`, body)
      expect(response.statusCode, action).toBe(200)
      const [event] = await h.prisma.auditEvent.findMany({ where: { subjectId: customer.id } })
      expect(event, action).toMatchObject({ category: 'OPERATIONAL', outcome: 'success', actorId: manager.id, subjectType: 'CUSTOMER', teamId: teamA.id, details: { fromStatus: status } })
      // The confirmation expires after 5 minutes.
      h.advance(5 * MIN + 1_000)
      expect((await agent.post(`/api/admin/customers/${customer.id}/${action}`, body)).json().error.code).toBe('step_up_required')
    }
  })
})

describe('invitations (option C) and separation of duties', () => {
  it('ends in PENDING after the customer sets a password; the link works once and expires after 72 hours', async () => {
    const created = await (await decider('admin')).post('/api/admin/customers/invitations', {
      email: h.email('invited-one'),
      firstName: 'Test',
      lastName: 'Invitee',
      phone: '+856 20 3333 4444',
      companyName: 'Example Imports',
      teamId: teamA.id,
    })
    expect(created.statusCode).toBe(201)
    const { customer, link } = created.json()
    expect(customer).toMatchObject({ status: 'INVITED', team: { id: teamA.id }, invitedByMe: true })
    expect(customer).not.toHaveProperty('invitedById') // staff ids are returned to Super Admins only
    expect(link.path).toMatch(/^account\/set-password#[A-Za-z0-9_-]{43}$/)
    expect(new Date(link.expiresAt).getTime() - h.clock.ms).toBe(72 * HOUR)
    const token = tokenOf(link.path)
    const stored = await h.prisma.accountToken.findFirstOrThrow({ where: { customerId: customer.id } })
    expect(JSON.stringify({ ...stored, tokenHash: Buffer.from(stored.tokenHash).toString('base64url') })).not.toContain(token)

    expect((await h.browser().customerLogin(h.email('invited-one'))).statusCode).toBe(401)
    const guest = h.browser()
    expect((await guest.post('/api/auth/account-token/inspect', { token })).json()).toMatchObject({ purpose: 'INVITATION', account: 'customer', email: h.email('invited-one') })
    expect((await guest.post('/api/auth/account-token/complete', { token, password: 'short' })).statusCode).toBe(422)
    const done = await guest.post('/api/auth/account-token/complete', { token, password: PASSWORD })
    expect(done.json()).toEqual({ status: 'password_set', account: 'customer' })
    expect(done.cookies).toHaveLength(0)
    expect((await h.prisma.customer.findUniqueOrThrow({ where: { id: customer.id } })).status).toBe('PENDING')
    expect((await guest.post('/api/auth/account-token/complete', { token, password: PASSWORD })).json().error.code).toBe('invalid_token')
    expect((await auditFor(customer.id, 'invitation_accepted'))).toHaveLength(1)

    const later = await (await decider('admin')).post('/api/admin/customers/invitations', { email: h.email('invited-late'), firstName: 'T', lastName: 'Late', phone: '+856 20 5555 6666', companyName: 'Example' })
    h.advance(72 * HOUR + MIN)
    expect((await guest.post('/api/auth/account-token/inspect', { token: tokenOf(later.json().link.path) })).json().error.code).toBe('invalid_token')
    expect((await guest.post('/api/auth/account-token/inspect', { token: 'A'.repeat(43) })).json().error.code).toBe('invalid_token')
  })

  it('never lets the inviter approve or reject their invitee, for any role; another approver must decide', async () => {
    for (const inviter of ['sa', 'admin'] as const) {
      const invite = await (await decider(inviter)).post('/api/admin/customers/invitations', {
        email: h.email(`sod-${inviter}`),
        firstName: 'Test',
        lastName: `Sod ${inviter}`,
        phone: '+856 20 7777 8888',
        companyName: 'Example',
      })
      expect(invite.statusCode, inviter).toBe(201)
      const id = invite.json().customer.id
      await h.browser().post('/api/auth/account-token/complete', { token: tokenOf(invite.json().link.path), password: PASSWORD })

      for (const action of ['approve', 'reject'] as const) {
        const response = await (await decider(inviter)).post(`/api/admin/customers/${id}/${action}`, action === 'reject' ? { reason: 'Test' } : {})
        expect(response.statusCode, `${inviter} ${action}`).toBe(403)
        expect(response.json().error.code).toBe('separation_of_duties')
      }
      expect((await h.prisma.customer.findUniqueOrThrow({ where: { id } })).status).toBe('PENDING')
      const denials = await h.prisma.auditEvent.findMany({ where: { subjectId: id, outcome: 'denied' } })
      expect(denials.map(event => event.actorId)).toEqual([people[inviter]!.id, people[inviter]!.id])
      expect(denials.map(event => event.details)).toEqual([{ reason: 'separation_of_duties', role: 'inviter' }, { reason: 'separation_of_duties', role: 'inviter' }])

      const approver = inviter === 'admin' ? 'sa' : 'admin'
      const approved = await (await decider(approver)).post(`/api/admin/customers/${id}/approve`)
      expect(approved.statusCode, `${approver} approves ${inviter}'s invitee`).toBe(200)
      const row = await h.prisma.customer.findUniqueOrThrow({ where: { id } })
      expect(row).toMatchObject({ status: 'ACTIVE', invitedById: people[inviter]!.id, approvedById: people[approver]!.id })
    }
  })

  it('is also enforced by a database CHECK constraint', async () => {
    const customer = await h.customer('sod-check', { invitedById: people.admin!.id })
    await expect(h.prisma.customer.update({ where: { id: customer.id }, data: { approvedById: people.admin!.id } })).rejects.toThrow()
    await expect(h.prisma.customer.update({ where: { id: customer.id }, data: { passwordHash: null } })).rejects.toThrow()
    await expect(h.prisma.customer.create({ data: { email: h.email('upper').toUpperCase(), firstName: 'T', lastName: 'U', phone: '1', companyName: 'X', passwordHash: 'x' } })).rejects.toThrow()
  })

  it('lets only Admin and Super Admin invite directly; Managers request; Sales and Warehouse do neither', async () => {
    const body = { email: h.email('no-invite'), firstName: 'T', lastName: 'N', phone: '+856 20 0000 1111', companyName: 'X' }
    for (const name of ['managerA', 'salesA', 'warehouse']) {
      expect((await (await who(name)).post('/api/admin/customers/invitations', body)).json().error.code, name).toBe('forbidden')
    }
    for (const name of ['salesA', 'warehouse']) {
      expect((await (await who(name)).post('/api/admin/customers/invitation-requests', body)).json().error.code, name).toBe('forbidden')
      expect((await (await who(name)).get('/api/admin/customers/invitation-requests')).json().error.code, name).toBe('forbidden')
    }
    expect((await (await who('managerA')).post('/api/admin/customers/invitation-requests', body)).statusCode).toBe(202)
  })

  it('requires a Manager to belong to a team before requesting an invitation (same answer for every email)', async () => {
    const existing = await h.customer('team-required-existing', { teamId: teamB.id })
    const agent = await who('managerNoTeam')
    const before = await h.prisma.customerInvitationRequest.count({ where: { requestedById: people.managerNoTeam!.id } })
    const answers = []
    for (const email of [existing.email, h.email('team-required-new')]) {
      const response = await agent.post('/api/admin/customers/invitation-requests', { email, firstName: 'T', lastName: 'N', phone: '+856 20 0000 2222', companyName: 'X' })
      expect(response.statusCode).toBe(403)
      expect(response.json().error.code).toBe('team_required')
      answers.push(response.body)
    }
    expect(answers[1]).toBe(answers[0])
    expect(await h.prisma.customerInvitationRequest.count({ where: { requestedById: people.managerNoTeam!.id } })).toBe(before)
    expect(await h.prisma.auditEvent.count({ where: { actorId: people.managerNoTeam!.id, type: 'customer_invitation_requested' } })).toBe(0)
    // Managers with a team are unaffected; Admins (no team) may still file requests.
    expect((await (await who('managerA')).post('/api/admin/customers/invitation-requests', { email: h.email('team-ok'), firstName: 'T', lastName: 'N', phone: '+856 20 0000 3333', companyName: 'X' })).statusCode).toBe(202)
    expect((await (await who('admin')).post('/api/admin/customers/invitation-requests', { email: h.email('team-admin'), firstName: 'T', lastName: 'N', phone: '+856 20 0000 4444', companyName: 'X' })).statusCode).toBe(202)
  })
})

describe('assignment', () => {
  it('lets Managers assign within their own team only', async () => {
    const customer = await h.customer('assign-me')
    const ok = await (await who('managerA')).patch(`/api/admin/customers/${customer.id}/assignment`, { assignedStaffId: people.salesA!.id })
    expect(ok.statusCode).toBe(200)
    expect(ok.json().customer).toMatchObject({ team: { id: teamA.id }, assignedStaff: { id: people.salesA!.id } })
    expect(await listIds((await who('salesA')))).toContain(customer.id)
    expect((await (await who('managerA')).patch(`/api/admin/customers/${customer.id}/assignment`, { teamId: teamB.id, assignedStaffId: null })).statusCode).toBe(403)
    expect((await (await who('managerB')).patch(`/api/admin/customers/${customer.id}/assignment`, { assignedStaffId: null })).statusCode).toBe(404)
    expect((await (await who('admin')).patch(`/api/admin/customers/${customer.id}/assignment`, { teamId: teamB.id, assignedStaffId: people.salesA!.id })).json().error.code).toBe('assignee_not_in_team')
    expect((await (await who('admin')).patch(`/api/admin/customers/${customer.id}/assignment`, { assignedStaffId: people.warehouse!.id })).json().error.code).toBe('invalid_assignee')
    expect((await (await who('salesA')).patch(`/api/admin/customers/${customer.id}/assignment`, { assignedStaffId: null })).json().error.code).toBe('forbidden')
    expect((await auditFor(customer.id, 'customer_assigned'))[0]).toMatchObject({ actorId: people.managerA!.id, teamId: teamA.id })
  })
})

describe('customer password reset links', () => {
  it('need a fresh 2FA, are single-use, last 60 minutes, revoke all sessions and are audited', async () => {
    const customer = await h.customer('reset-me', { status: 'ACTIVE', teamId: teamA.id })
    await who('managerA')
    const manager = people.managerA!
    h.advance(6 * MIN)
    expect((await manager.agent.post(`/api/admin/customers/${customer.id}/reset-link`)).json().error.code).toBe('step_up_required')
    expect((await h.stepUp(manager.agent, manager.secret!)).statusCode).toBe(200)
    const issued = await manager.agent.post(`/api/admin/customers/${customer.id}/reset-link`)
    expect(issued.statusCode).toBe(201)
    expect(new Date(issued.json().link.expiresAt).getTime() - h.clock.ms).toBe(60 * MIN)
    const token = tokenOf(issued.json().link.path)

    const signedIn = h.browser()
    await signedIn.customerLogin(customer.email)
    const done = await h.browser().post('/api/auth/account-token/complete', { token, password: 'reset passphrase for test' })
    expect(done.statusCode).toBe(200)
    expect((await signedIn.get('/api/auth/customer/session')).statusCode).toBe(401)
    expect((await h.browser().customerLogin(customer.email, 'reset passphrase for test')).statusCode).toBe(200)
    expect((await h.browser().post('/api/auth/account-token/complete', { token, password: 'another passphrase here' })).json().error.code).toBe('invalid_token')
    expect((await auditFor(customer.id, 'password_reset_link_issued'))[0]).toMatchObject({ category: 'SECURITY', actorId: manager.id })
    expect(await auditFor(customer.id, 'password_reset_completed')).toHaveLength(1)

    await h.stepUp(manager.agent, manager.secret!)
    const expiring = await manager.agent.post(`/api/admin/customers/${customer.id}/reset-link`)
    h.advance(61 * MIN)
    expect((await h.browser().post('/api/auth/account-token/complete', { token: tokenOf(expiring.json().link.path), password: 'too late passphrase' })).json().error.code).toBe('invalid_token')
    expect((await (await who('salesA')).post(`/api/admin/customers/${customer.id}/reset-link`)).json().error.code).toBe('forbidden')
  })
})

describe('audit log access', () => {
  it('gives Managers read-only operational events of their team; security events need Admin', async () => {
    // A window only this run writes to (never the global newest page), holding every kind of event a Manager's view
    // must include or exclude.
    const from = (await h.freshAuditWindow()).toISOString()
    const ownTeam = await h.customer('audit-scope-a', { teamId: teamA.id })
    const colleagueTeam = await h.customer('audit-scope-a2', { teamId: teamA.id })
    const otherTeam = await h.customer('audit-scope-b', { teamId: teamB.id })
    // OPERATIONAL, team A: the Manager's own approval and a team-A colleague's; each decision follows a step-up
    // (2FA verification), which is a SECURITY event of that Manager.
    expect((await (await decider('managerA')).post(`/api/admin/customers/${ownTeam.id}/approve`)).statusCode).toBe(200)
    expect((await (await decider('managerA2')).post(`/api/admin/customers/${colleagueTeam.id}/approve`)).statusCode).toBe(200)
    // OPERATIONAL, team B.
    expect((await (await decider('managerB')).post(`/api/admin/customers/${otherTeam.id}/approve`)).statusCode).toBe(200)
    // OPERATIONAL, no team: a self-registration (its password must never reach the log).
    const registrantEmail = h.email('audit-scope-registered')
    const registration = await h.browser().post('/api/auth/customer/register', { email: registrantEmail, password: PASSWORD, firstName: 'Test', lastName: 'Scope', phone: '+856 20 1111 3333', companyName: 'Example Scope' })
    expect(registration.statusCode).toBe(202)
    const registered = await h.prisma.customer.findUniqueOrThrow({ where: { email: registrantEmail } })
    // OPERATIONAL, no team, performed by an Admin: a direct invitation.
    const invited = await (await decider('admin')).post('/api/admin/customers/invitations', { email: h.email('audit-scope-invited'), firstName: 'T', lastName: 'Scope', phone: '+856 20 5555 8888', companyName: 'Example' })
    expect(invited.statusCode).toBe(201)
    const invitedId = invited.json().customer.id as string
    const window = `from=${from}&to=${new Date(h.clock.ms + 60_000).toISOString()}&limit=200`
    const approved = (items: AuditItem[], customerId: string, actorId: string) => items.some(event => event.type === 'customer_approved' && event.subjectId === customerId && event.actorId === actorId)
    const registeredIn = (items: AuditItem[]) => items.some(event => event.type === 'customer_registered' && event.subjectId === registered.id)
    const privileged = [people.sa!.id, people.admin!.id]

    // Super Admin: the window holds all of it, SECURITY included, so what the Manager does not see below was filtered.
    const saView = await readWindow(await who('sa'), window, 'sa')
    expect(approved(saView.items, ownTeam.id, people.managerA!.id)).toBe(true)
    expect(approved(saView.items, colleagueTeam.id, people.managerA2!.id)).toBe(true)
    expect(approved(saView.items, otherTeam.id, people.managerB!.id)).toBe(true)
    expect(registeredIn(saView.items)).toBe(true)
    expect(saView.items.some(event => event.type === 'customer_invited' && event.subjectId === invitedId && event.actorId === people.admin!.id)).toBe(true)
    expect(saView.items.some(event => event.category === 'SECURITY' && event.actorId === people.managerA!.id)).toBe(true)
    // No event of the window carries a password, token, code or secret (the registration had a password).
    expect(saView.body).not.toContain(PASSWORD)
    expect(saView.body).not.toMatch(/"(password|token|code|secret)[A-Za-z]*"\s*:/i)

    // Manager A sees the operational events of team A (own and a colleague's) and team-less ones of other staff or
    // customers...
    const managerView = await readWindow(await who('managerA'), window, 'managerA')
    expect(approved(managerView.items, ownTeam.id, people.managerA!.id), 'own approval').toBe(true)
    expect(approved(managerView.items, colleagueTeam.id, people.managerA2!.id), "team colleague's approval").toBe(true)
    expect(registeredIn(managerView.items), 'team-less registration').toBe(true)
    // ...and nothing else: no other team, nothing performed by or about Super Admin or Admin, no SECURITY event (not
    // even their own step-up), read-only.
    expect(managerView.items.some(event => event.subjectId === otherTeam.id), 'team B').toBe(false)
    expect(managerView.items.some(event => event.subjectId === invitedId), "the Admin's invitation").toBe(false)
    for (const event of managerView.items) {
      expect(privileged.includes(event.actorId ?? '') || privileged.includes(event.subjectId ?? ''), `managerA sees ${event.type} of a privileged account`).toBe(false)
    }
    expect(managerView.items.every(event => event.category === 'OPERATIONAL' && (event.teamId === teamA.id || event.teamId === null))).toBe(true)
    expect((await (await who('managerA')).get(`/api/admin/audit?${window}&category=SECURITY`)).statusCode).toBe(403)
    expect((await (await who('managerA')).get('/api/admin/audit?category=SECURITY')).statusCode).toBe(403)

    // Admin: SECURITY events of other staff (here the Managers' step-ups), none performed by or about privileged accounts.
    const adminSecurity = await readWindow(await who('admin'), `${window}&category=SECURITY`, 'admin SECURITY')
    expect(adminSecurity.items.some(event => event.actorId === people.managerA!.id)).toBe(true)
    expect(adminSecurity.items.every(event => event.category === 'SECURITY')).toBe(true)
    for (const event of adminSecurity.items) {
      expect(privileged.includes(event.actorId ?? '') || privileged.includes(event.subjectId ?? ''), `admin sees ${event.type} of a privileged account`).toBe(false)
    }

    // Sales: no audit access at all.
    expect((await (await who('salesA')).get(`/api/admin/audit?${window}`)).statusCode).toBe(403)
    expect((await (await who('salesA')).get('/api/admin/audit')).statusCode).toBe(403)
  })

  it('never returns Super Admin or Admin staff ids to other staff in the customer list', async () => {
    const privileged = [people.sa!.id, people.admin!.id]
    // Customers invited and approved by privileged staff exist from the tests above.
    expect(await h.prisma.customer.count({ where: { email: { startsWith: h.run }, OR: [{ invitedById: { in: privileged } }, { approvedById: { in: privileged } }] } })).toBeGreaterThan(0)
    for (const name of ['admin', 'managerA', 'salesA']) {
      const agent = await who(name)
      for (let page = 1; page <= 50; page += 1) {
        const response = await agent.get(`/api/admin/customers?page=${page}`)
        const body = response.json() as { items: Record<string, unknown>[] }
        for (const id of privileged) expect(response.body, `${name} page ${page}`).not.toContain(id)
        for (const item of body.items) {
          expect(item, name).not.toHaveProperty('invitedById')
          expect(item, name).not.toHaveProperty('approvedById')
        }
        if (body.items.length < 50) break
      }
    }
    // Super Admins still see who invited and approved.
    const sa = await who('sa')
    const items = (await sa.get('/api/admin/customers?page=1')).json().items as Record<string, unknown>[]
    expect(items.some(item => 'invitedById' in item && 'approvedById' in item)).toBe(true)
  })

  it('shows events about or by Super Admin and Admin accounts only to Super Admins', async () => {
    const privileged = [people.sa!.id, people.admin!.id]
    const sa = await who('sa')
    for (const id of privileged) {
      expect((await sa.get(`/api/admin/audit?subjectId=${id}&limit=200`)).json().items.length, `SA sees subject ${id}`).toBeGreaterThan(0)
    }
    // Audit rows are append-only and every run starts the harness clock at the same instant, so the newest 200
    // events of the shared test database may belong to other runs. Assertions about specific actors therefore
    // query customers created in this run (by subjectId) instead of relying on the global newest page.
    const invitedByAdmin = await h.prisma.customer.findFirstOrThrow({ where: { email: { startsWith: h.run }, invitedById: people.admin!.id } })
    const approvedByManager = await h.prisma.customer.findFirstOrThrow({ where: { email: { startsWith: h.run }, approvedById: people.managerA!.id } })
    const saAboutInvitee = (await sa.get(`/api/admin/audit?subjectId=${invitedByAdmin.id}&limit=200`)).json().items as { actorId: string | null }[]
    expect(saAboutInvitee.some(event => event.actorId === people.admin!.id)).toBe(true)

    for (const name of ['admin', 'managerA']) {
      const agent = await who(name)
      for (const id of privileged) expect((await agent.get(`/api/admin/audit?subjectId=${id}&limit=200`)).json().items, `${name} / subject ${id}`).toEqual([])
    }

    // Unfiltered listings, read from a time window that only this run writes to: it starts after the latest audit
    // event in the database (never the global newest page, which may hold only other runs' events). The window gets
    // events of every shape: by and about a Super Admin and an Admin (sign-in again; an Admin's invitation,
    // team-less) and by a Manager (an approval in team A).
    const from = (await h.freshAuditWindow()).toISOString()
    const pending = await h.customer('audit-window', { teamId: teamA.id })
    const invited = await (await decider('admin')).post('/api/admin/customers/invitations', { email: h.email('audit-window-invited'), firstName: 'T', lastName: 'Window', phone: '+856 20 5555 7777', companyName: 'Example' })
    expect(invited.statusCode).toBe(201)
    const invitedId = invited.json().customer.id as string
    expect((await (await decider('managerA')).post(`/api/admin/customers/${pending.id}/approve`)).statusCode).toBe(200)
    for (const name of ['sa', 'admin', 'managerA']) await h.signedInStaff(people[name]!.email, people[name]!.secret)
    // Events ABOUT a privileged account performed by nobody (a wrong password at sign-in): only the subject filter can
    // hide these, because the actor filter has no actor to match.
    for (const name of ['sa', 'admin']) expect((await h.browser().staffLogin(people[name]!.email, 'not the right passphrase')).statusCode).toBe(401)
    const window = `from=${from}&to=${new Date(h.clock.ms + 60_000).toISOString()}&limit=200`
    // Complete, and every event belongs to this run (see readWindow).
    const inWindow = async (name: string, extra = '') => (await readWindow(await who(name), `${window}${extra}`, name)).items
    const approvedInWindow = (items: AuditItem[]) => items.some(event => event.type === 'customer_approved' && event.subjectId === pending.id && event.actorId === people.managerA!.id)
    // Super Admin: the window does hold events by and about both privileged accounts of this run, so their absence
    // below is the visibility filter at work, not an empty window.
    const saWindow = await inWindow('sa')
    for (const id of privileged) {
      expect(saWindow.some(event => event.actorId === id), `SA sees actor ${id}`).toBe(true)
      expect(saWindow.some(event => event.subjectId === id), `SA sees subject ${id}`).toBe(true)
      expect(saWindow.some(event => event.type === 'staff_login' && event.actorId === null && event.subjectId === id), `SA sees the failed sign-in of ${id}`).toBe(true)
    }
    expect(saWindow.some(event => event.type === 'customer_invited' && event.subjectId === invitedId && event.actorId === people.admin!.id)).toBe(true)
    expect(approvedInWindow(saWindow)).toBe(true)
    for (const [name, extra] of [['admin', ''], ['managerA', '&category=OPERATIONAL']] as const) {
      const items = await inWindow(name, extra)
      expect(approvedInWindow(items), `${name} sees the Manager's approval`).toBe(true)
      expect(items.some(event => event.subjectId === invitedId), `${name} sees nothing of the Admin's invitation`).toBe(false)
      for (const event of items) {
        expect(privileged.includes(event.actorId ?? ''), `${name} sees actor ${event.actorId}`).toBe(false)
        expect(privileged.includes(event.subjectId ?? ''), `${name} sees subject ${event.subjectId}`).toBe(false)
      }
      if (name === 'managerA') expect(items.every(event => event.category === 'OPERATIONAL' && (event.teamId === teamA.id || event.teamId === null))).toBe(true)
    }

    const admin = await who('admin')
    // The Admin's own invitation of a customer (a non-privileged subject) is hidden from Admin: actor filter.
    const adminAboutInvitee = (await admin.get(`/api/admin/audit?subjectId=${invitedByAdmin.id}&limit=200`)).json().items as { actorId: string | null }[]
    expect(adminAboutInvitee.filter(event => privileged.includes(event.actorId ?? ''))).toEqual([])
    // Events by other staff (here the Manager's own approval) stay visible to Admin.
    const adminAboutApproved = (await admin.get(`/api/admin/audit?subjectId=${approvedByManager.id}&limit=200`)).json().items as { actorId: string | null }[]
    expect(adminAboutApproved.some(event => event.actorId === people.managerA!.id)).toBe(true)
  })

  it('cannot be changed or deleted, even with direct SQL', async () => {
    // An event of this run (the self-registration above), never another run's record.
    const registrant = await h.prisma.customer.findUniqueOrThrow({ where: { email: h.email('Self.Reg') } })
    const event = await h.prisma.auditEvent.findFirstOrThrow({ where: { type: 'customer_registered', subjectId: registrant.id } })
    await expect(h.prisma.auditEvent.update({ where: { id: event.id }, data: { outcome: 'tampered' } })).rejects.toThrow(/append-only/)
    await expect(h.prisma.auditEvent.delete({ where: { id: event.id } })).rejects.toThrow(/append-only/)
    await expect(h.prisma.$executeRawUnsafe('TRUNCATE audit_events')).rejects.toThrow(/append-only/)
    expect((await h.prisma.auditEvent.findUniqueOrThrow({ where: { id: event.id } })).outcome).toBe(event.outcome)
  })
})
