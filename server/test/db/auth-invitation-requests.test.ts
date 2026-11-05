/**
 * Manager invitation requests reviewed by an Admin (anti-enumeration across Manager scopes):
 * - a Manager's request answers identically, and runs the same statements, whether the email is new or belongs to a
 *   customer inside or outside the Manager's scope; the customers table is never read;
 * - Managers cannot invite directly and never learn the outcome (SUBMITTED / PROCESSED only, decisions are SECURITY
 *   audit events);
 * - Admins see whether the email exists, issue or decline; concurrent duplicates are a 409, never a 500;
 * - separation of duties covers the requester as well as the issuing Admin.
 */
import type { LightMyRequestResponse } from 'fastify'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createHarness, PASSWORD, removeStaleFixtures, type Browser, type CapturedQuery } from './authHarness'

const h = createHarness({ captureQueries: true })
const people: Record<string, { id: string; email: string; agent: Browser; secret: Buffer | undefined }> = {}
let teamA: { id: string }
let teamB: { id: string }

async function who(name: string): Promise<Browser> {
  const person = people[name]!
  if ((await person.agent.refresh('staff')).statusCode !== 200) person.agent = (await h.signedInStaff(person.email, person.secret)).agent
  return person.agent
}
async function decider(name: string): Promise<Browser> {
  const agent = await who(name)
  expect((await h.stepUp(agent, people[name]!.secret!)).statusCode).toBe(200)
  return agent
}
const profile = (email: string) => ({ email, firstName: 'Test', lastName: 'Requested', phone: '+856 20 4444 5555', companyName: 'Example Request Co' })
const tokenOf = (path: string) => path.split('#')[1]!

/** Waits until Prisma's asynchronous query-log events have all arrived. */
async function settle(): Promise<void> {
  let seen = -1
  while (seen !== h.queries.length) {
    seen = h.queries.length
    await new Promise(resolve => setTimeout(resolve, 25))
  }
}
async function traced(request: () => Promise<LightMyRequestResponse>) {
  await settle()
  h.queries.length = 0
  const response = await request()
  await settle()
  return { response, queries: [...h.queries] as CapturedQuery[] }
}
/** SQL texts (parameters excluded), sorted: Prisma may load related tables concurrently, in either order. */
const statements = (queries: CapturedQuery[]) => queries.map(q => q.query.replace(/\s+/g, ' ')).sort()
const touchesCustomers = (queries: CapturedQuery[]) => statements(queries).some(sql => sql.includes('"public"."customers"'))
const touchesRequests = (queries: CapturedQuery[]) => statements(queries).some(sql => sql.includes('"public"."customer_invitation_requests"'))
const MIN = 60_000

beforeAll(async () => {
  await removeStaleFixtures(h.prisma, h.run)
  teamA = await h.team('Req A')
  teamB = await h.team('Req B')
  const accounts = { sa: ['SUPER_ADMIN', null], admin: ['ADMIN', null], managerA: ['MANAGER', teamA.id], managerA2: ['MANAGER', teamA.id] } as const
  for (const [name, [role, teamId]] of Object.entries(accounts)) {
    const row = await h.staff(`req-${name}`, role, { teamId })
    const { agent, secret } = await h.signedInStaff(row.email)
    people[name] = { id: row.id, email: row.email, agent, secret }
  }
})
afterAll(() => h.cleanup())

describe('a Manager cannot tell whether an email is registered', () => {
  it('answers a request identically, with the same statements and no customer lookup, for new, in-scope and out-of-scope emails', async () => {
    const outside = await h.customer('req-outside', { teamId: teamB.id })
    const inside = await h.customer('req-inside', { teamId: teamA.id })
    const fresh = h.email('req-new')
    const manager = await who('managerA')

    const results = []
    for (const email of [outside.email, inside.email, fresh]) results.push({ email, ...(await traced(() => manager.post('/api/admin/customers/invitation-requests', profile(email)))) })

    const shapes = results.map(({ response }) => {
      expect(response.statusCode).toBe(202)
      const body = response.json()
      expect(Object.keys(body)).toEqual(['request'])
      expect(Object.keys(body.request).sort()).toEqual(['createdAt', 'id', 'status'])
      return { ...body.request, id: '<id>' }
    })
    expect(shapes[1]).toEqual(shapes[0])
    expect(shapes[2]).toEqual(shapes[0])
    expect(shapes[0].status).toBe('SUBMITTED')

    for (const { email, queries } of results) {
      expect(touchesCustomers(queries), email).toBe(false)
      expect(statements(queries), email).toEqual(statements(results[0]!.queries))
    }

    // The Manager's own list shows all three the same way; no outcome, no existence data.
    const mine = (await manager.get('/api/admin/customers/invitation-requests')).json().items as Record<string, unknown>[]
    const relevant = mine.filter(item => [outside.email, inside.email, fresh].includes(item.email as string))
    expect(relevant).toHaveLength(3)
    for (const item of relevant) {
      expect(item.status).toBe('SUBMITTED')
      expect(item).not.toHaveProperty('existingCustomer')
      expect(item).not.toHaveProperty('decisionNote')
      expect(item).not.toHaveProperty('requestedBy')
    }
    // Filtering by outcome would reveal it.
    expect((await manager.get('/api/admin/customers/invitation-requests?status=ISSUED')).json().error.code).toBe('forbidden')
  })

  it('refuses a direct invitation identically for every email, before any lookup', async () => {
    const outside = await h.customer('req-direct-outside', { teamId: teamB.id })
    const manager = await who('managerA')
    const traces = []
    for (const email of [outside.email, h.email('req-direct-new')]) traces.push(await traced(() => manager.post('/api/admin/customers/invitations', profile(email))))
    for (const { response, queries } of traces) {
      expect(response.statusCode).toBe(403)
      expect(response.body).toBe(traces[0]!.response.body)
      expect(touchesCustomers(queries)).toBe(false)
    }
  })
})

describe('Admin review', () => {
  it('shows reviewers whether the email exists; issues new emails and refuses existing ones without losing the request', async () => {
    const existing = await h.customer('req-review-existing', { teamId: teamB.id })
    const manager = await who('managerA')
    const newRequest = (await manager.post('/api/admin/customers/invitation-requests', profile(h.email('req-review-new')))).json().request
    const existingRequest = (await manager.post('/api/admin/customers/invitation-requests', profile(existing.email))).json().request

    const admin = await decider('admin')
    const pending =(await admin.get('/api/admin/customers/invitation-requests?status=PENDING')).json().items as { id: string; existingCustomer: { id: string } | null; requestedBy: { id: string } | null; status: string }[]
    const byId = new Map(pending.map(item => [item.id, item]))
    expect(byId.get(newRequest.id)).toMatchObject({ status: 'PENDING', existingCustomer: null, requestedBy: { id: people.managerA!.id } })
    expect(byId.get(existingRequest.id)?.existingCustomer?.id).toBe(existing.id)

    // Issue the new email: INVITED customer in the requested team, invited by the Admin, link returned once.
    const issued = await admin.post(`/api/admin/customers/invitation-requests/${newRequest.id}/issue`)
    expect(issued.statusCode).toBe(201)
    const customerId = issued.json().customer.id as string
    expect(issued.json().customer).toMatchObject({ status: 'INVITED', team: { id: teamA.id }, invitedByMe: true })
    expect(issued.json().link.path).toMatch(/^account\/set-password#[A-Za-z0-9_-]{43}$/)
    expect(await h.prisma.customerInvitationRequest.findUniqueOrThrow({ where: { id: newRequest.id } })).toMatchObject({ status: 'ISSUED', customerId, decidedById: people.admin!.id })
    expect((await admin.post(`/api/admin/customers/invitation-requests/${newRequest.id}/issue`)).json().error.code).toBe('request_processed')

    // The existing email: 409 for the reviewer, the request stays PENDING, the denial is a SECURITY event.
    const refused = await admin.post(`/api/admin/customers/invitation-requests/${existingRequest.id}/issue`)
    expect(refused.statusCode).toBe(409)
    expect(refused.json().error.code).toBe('email_in_use')
    expect((await h.prisma.customerInvitationRequest.findUniqueOrThrow({ where: { id: existingRequest.id } })).status).toBe('PENDING')
    const declined = await admin.post(`/api/admin/customers/invitation-requests/${existingRequest.id}/decline`, { note: 'Existing account in another team' })
    expect(declined.json().request).toMatchObject({ status: 'DECLINED' })

    const decisions = await h.prisma.auditEvent.findMany({ where: { type: { startsWith: 'customer_invitation_request_' }, actorId: people.admin!.id } })
    expect(decisions.map(event => [event.type, event.outcome, event.category]).sort()).toEqual([
      ['customer_invitation_request_declined', 'success', 'SECURITY'],
      ['customer_invitation_request_issued', 'denied', 'SECURITY'],
      ['customer_invitation_request_issued', 'success', 'SECURITY'],
    ])
    expect(JSON.stringify(decisions.map(event => event.details))).not.toContain('@')

    // The Manager sees both as PROCESSED, and cannot read the decision events.
    const mine = (await manager.get('/api/admin/customers/invitation-requests')).json().items as { id: string; status: string }[]
    expect(mine.find(item => item.id === newRequest.id)?.status).toBe('PROCESSED')
    expect(mine.find(item => item.id === existingRequest.id)?.status).toBe('PROCESSED')
    const visible = (await manager.get('/api/admin/audit?limit=200')).json().items as { type: string; category: string }[]
    expect(visible.some(event => event.type.startsWith('customer_invitation_request_'))).toBe(false)
    expect(visible.every(event => event.category === 'OPERATIONAL')).toBe(true)
    expect((await manager.post(`/api/admin/customers/invitation-requests/${existingRequest.id}/issue`)).json().error.code).toBe('forbidden')
    expect((await manager.post(`/api/admin/customers/invitation-requests/${existingRequest.id}/decline`, {})).json().error.code).toBe('forbidden')
  })

  it('applies separation of duties to the requester and to the issuing Admin; a third approver decides', async () => {
    const manager = await who('managerA')
    const request = (await manager.post('/api/admin/customers/invitation-requests', profile(h.email('req-sod')))).json().request
    const issued = await (await decider('admin')).post(`/api/admin/customers/invitation-requests/${request.id}/issue`)
    const customerId = issued.json().customer.id as string
    expect((await h.browser().post('/api/auth/account-token/complete', { token: tokenOf(issued.json().link.path), password: PASSWORD })).statusCode).toBe(200)

    // The requester sees the customer (own team) flagged, and cannot decide.
    const row = ((await manager.get('/api/admin/customers?status=PENDING')).json().items as { id: string; requestedByMe: boolean; invitedByMe: boolean }[]).find(item => item.id === customerId)
    expect(row).toMatchObject({ requestedByMe: true, invitedByMe: false })
    for (const name of ['managerA', 'admin']) {
      for (const action of ['approve', 'reject'] as const) {
        const response = await (await decider(name)).post(`/api/admin/customers/${customerId}/${action}`, action === 'reject' ? { reason: 'Test' } : {})
        expect(response.statusCode, `${name} ${action}`).toBe(403)
        expect(response.json().error.code).toBe('separation_of_duties')
      }
    }
    const denials = await h.prisma.auditEvent.findMany({ where: { subjectId: customerId, outcome: 'denied' }, orderBy: { at: 'asc' } })
    expect(denials.map(event => [event.actorId, (event.details as { role: string }).role])).toEqual([
      [people.managerA!.id, 'requester'],
      [people.managerA!.id, 'requester'],
      [people.admin!.id, 'inviter'],
      [people.admin!.id, 'inviter'],
    ])
    expect((await h.prisma.customer.findUniqueOrThrow({ where: { id: customerId } })).status).toBe('PENDING')
    expect((await (await decider('managerA2')).post(`/api/admin/customers/${customerId}/approve`)).statusCode).toBe(200)
  })
})

describe('concurrent duplicates', () => {
  const statuses = (responses: { statusCode: number }[]) => responses.map(response => response.statusCode).sort()

  it('issues one request only once when two reviewers issue it at the same time', async () => {
    const request = (await (await who('managerA')).post('/api/admin/customers/invitation-requests', profile(h.email('req-race-one')))).json().request
    const [admin, sa] = [await decider('admin'), await decider('sa')]
    const responses = await Promise.all([admin.post(`/api/admin/customers/invitation-requests/${request.id}/issue`), sa.post(`/api/admin/customers/invitation-requests/${request.id}/issue`)])
    expect(statuses(responses)).toEqual([201, 409])
    expect(responses.find(response => response.statusCode === 409)!.json().error.code).toBe('request_processed')
    expect(await h.prisma.customer.count({ where: { email: h.email('req-race-one') } })).toBe(1)
  })

  it('answers 409 (never 500) when two requests for the same new email are issued at the same time', async () => {
    const manager = await who('managerA')
    const email = h.email('req-race-two')
    const [first, second] = await Promise.all([1, 2].map(async () => (await manager.post('/api/admin/customers/invitation-requests', profile(email))).json().request))
    expect(first.id).not.toBe(second.id) // requests are not unique per email (that would leak across teams)
    const [admin, sa] = [await decider('admin'), await decider('sa')]
    const responses = await Promise.all([admin.post(`/api/admin/customers/invitation-requests/${first.id}/issue`), sa.post(`/api/admin/customers/invitation-requests/${second.id}/issue`)])
    expect(statuses(responses)).toEqual([201, 409])
    expect(responses.find(response => response.statusCode === 409)!.json().error.code).toBe('email_in_use')
    expect(await h.prisma.customer.count({ where: { email } })).toBe(1)
    const rows = await h.prisma.customerInvitationRequest.findMany({ where: { id: { in: [first.id, second.id] } } })
    expect(rows.map(row => row.status).sort()).toEqual(['ISSUED', 'PENDING'])
  })

  it('answers 409 (never 500) for concurrent direct invitations, and never 500 against a concurrent self-registration', async () => {
    const email = h.email('req-race-direct')
    const [admin, sa] = [await decider('admin'), await decider('sa')]
    const responses = await Promise.all([admin.post('/api/admin/customers/invitations', profile(email)), sa.post('/api/admin/customers/invitations', profile(email))])
    expect(statuses(responses)).toEqual([201, 409])
    expect(responses.find(response => response.statusCode === 409)!.json().error.code).toBe('email_in_use')
    expect(await h.prisma.customer.count({ where: { email } })).toBe(1)

    const raced = h.email('req-race-register')
    const [invite, register] = await Promise.all([
      admin.post('/api/admin/customers/invitations', profile(raced)),
      h.browser().post('/api/auth/customer/register', { ...profile(raced), password: PASSWORD }),
    ])
    expect([201, 409]).toContain(invite.statusCode)
    expect(register.statusCode).toBe(202)
    expect(await h.prisma.customer.count({ where: { email: raced } })).toBe(1)
  })
})

describe('fresh 2FA (step-up) for invitation operations', () => {
  const decisionTypes = ['customer_invited', 'customer_invitation_request_issued', 'customer_invitation_request_declined']

  it('refuses direct invitation, issue and decline without a fresh 2FA, before reading or changing anything', async () => {
    const request = (await (await who('managerA')).post('/api/admin/customers/invitation-requests', profile(h.email('req-stepup')))).json().request
    const admin = await who('admin')
    const operations = [
      { name: 'direct invitation', run: () => admin.post('/api/admin/customers/invitations', profile(h.email('req-stepup-direct'))) },
      { name: 'issue', run: () => admin.post(`/api/admin/customers/invitation-requests/${request.id}/issue`) },
      { name: 'decline', run: () => admin.post(`/api/admin/customers/invitation-requests/${request.id}/decline`, { note: 'Not now' }) },
    ]
    const unchanged = async (label: string) => {
      expect(await h.prisma.customerInvitationRequest.findUniqueOrThrow({ where: { id: request.id } }), label).toMatchObject({ status: 'PENDING', decidedById: null, decidedAt: null, decisionNote: null, customerId: null })
      expect(await h.prisma.customer.count({ where: { email: { in: [h.email('req-stepup'), h.email('req-stepup-direct')] } } }), label).toBe(0)
      expect(await h.prisma.auditEvent.count({ where: { actorId: people.admin!.id, type: { in: decisionTypes }, details: { path: ['requestId'], equals: request.id } } }), label).toBe(0)
    }
    const refuseAll = async (label: string) => {
      for (const operation of operations) {
        const { response, queries } = await traced(operation.run)
        expect(response.statusCode, `${label} ${operation.name}`).toBe(403)
        expect(response.json().error.code).toBe('step_up_required')
        // Refused by the guard: no statement touched the request or any customer.
        expect(touchesRequests(queries) || touchesCustomers(queries), `${label} ${operation.name}`).toBe(false)
      }
      await unchanged(label)
    }

    // Missing: the session has no 2FA confirmation time at all.
    await h.prisma.session.updateMany({ where: { staffId: people.admin!.id, revokedAt: null }, data: { mfaVerifiedAt: null } })
    await refuseAll('missing')

    // Expired: confirmed 5 minutes and 1 second ago.
    expect((await h.stepUp(admin, people.admin!.secret!)).statusCode).toBe(200)
    h.advance(5 * MIN + 1_000)
    await refuseAll('expired')

    // Valid: a fresh confirmation lets each operation through, on the same request.
    expect((await h.stepUp(admin, people.admin!.secret!)).statusCode).toBe(200)
    const declined = await admin.post(`/api/admin/customers/invitation-requests/${request.id}/decline`, { note: 'Not now' })
    expect(declined.statusCode).toBe(200)
    expect(await h.prisma.customerInvitationRequest.findUniqueOrThrow({ where: { id: request.id } })).toMatchObject({ status: 'DECLINED', decidedById: people.admin!.id, decisionNote: 'Not now' })
    const second = (await (await who('managerA')).post('/api/admin/customers/invitation-requests', profile(h.email('req-stepup-two')))).json().request
    expect((await admin.post(`/api/admin/customers/invitation-requests/${second.id}/issue`)).statusCode).toBe(201)
    expect((await admin.post('/api/admin/customers/invitations', profile(h.email('req-stepup-direct')))).statusCode).toBe(201)
  })
})

describe('audit visibility of invitation outcomes', () => {
  it('never shows issuance or decline outcomes to the requesting Manager; Super Admin sees the full history', async () => {
    // Audit events of earlier runs stay (append-only) and every run's clock starts at the same date, so move this
    // test to a time window of its own and read only that window.
    h.advance(Date.UTC(2031, 0, 1) + (Date.now() % 1_000_000_000) - h.clock.ms)
    const since = new Date(h.clock.ms).toISOString()
    const window = `from=${since}&to=${new Date(h.clock.ms + 2 * 60 * MIN).toISOString()}&limit=200`
    const manager = await who('managerA')
    const toIssue = (await manager.post('/api/admin/customers/invitation-requests', profile(h.email('req-audit-issue')))).json().request
    const toDecline = (await manager.post('/api/admin/customers/invitation-requests', profile(h.email('req-audit-decline')))).json().request
    const admin = await decider('admin')
    const customerId = (await admin.post(`/api/admin/customers/invitation-requests/${toIssue.id}/issue`)).json().customer.id as string
    expect((await admin.post(`/api/admin/customers/invitation-requests/${toDecline.id}/decline`, {})).statusCode).toBe(200)
    // A direct invitation, for comparison, stays an operational event.
    const direct = (await admin.post('/api/admin/customers/invitations', profile(h.email('req-audit-direct')))).json().customer.id as string

    // Request-based issuance is a SECURITY event; a direct invitation remains OPERATIONAL.
    expect((await h.prisma.auditEvent.findFirstOrThrow({ where: { subjectId: customerId, type: 'customer_invited' } })).category).toBe('SECURITY')
    expect((await h.prisma.auditEvent.findFirstOrThrow({ where: { subjectId: direct, type: 'customer_invited' } })).category).toBe('OPERATIONAL')

    type AuditItem = { type: string; category: string; outcome: string; subjectId: string | null; details: unknown }
    const outcomeOf = (items: AuditItem[]) =>
      items.filter(event =>
        ['customer_invited', 'customer_invitation_request_issued', 'customer_invitation_request_declined'].includes(event.type) &&
        (event.subjectId === customerId || [toIssue.id, toDecline.id].includes((event.details as { requestId?: string } | null)?.requestId ?? '')),
      )

    // Manager: nothing about the outcome, even when asking for the (in-team) customer directly; SECURITY is refused.
    const managerEvents = (await manager.get(`/api/admin/audit?${window}`)).json().items
    expect(outcomeOf(managerEvents)).toEqual([])
    expect(managerEvents.every((event: { category: string }) => event.category === 'OPERATIONAL')).toBe(true)
    expect((await manager.get(`/api/admin/audit?subjectId=${customerId}&limit=200`)).json().items).toEqual([])
    expect((await manager.get('/api/admin/audit?category=SECURITY')).json().error.code).toBe('forbidden')
    // The Manager still sees their own request events (no outcome in them).
    expect(managerEvents.filter((event: { type: string }) => event.type === 'customer_invitation_requested').length).toBeGreaterThanOrEqual(2)

    // Super Admin: the complete history of both decisions.
    const saEvents = (await (await who('sa')).get(`/api/admin/audit?${window}`)).json().items
    expect(outcomeOf(saEvents).map(event => [event.type, event.category, event.outcome]).sort()).toEqual([
      ['customer_invitation_request_declined', 'SECURITY', 'success'],
      ['customer_invitation_request_issued', 'SECURITY', 'success'],
      ['customer_invited', 'SECURITY', 'success'],
    ])

    // Admin: sees the Managers' request events, but — by the existing rule that only Super Admins see events
    // performed by Admin or Super Admin accounts — not the decisions an Admin made.
    const adminEvents = (await admin.get(`/api/admin/audit?${window}`)).json().items
    expect(adminEvents.filter((event: { type: string }) => event.type === 'customer_invitation_requested').length).toBeGreaterThanOrEqual(2)
    expect(outcomeOf(adminEvents)).toEqual([])
  })
})
