import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { PRIVILEGED_EMAIL_SUFFIX } from '../../src/auth/privilegedNamespace'
import { cleanupExpired, createFirstSuperAdmin, CliRefusal, resetSuperAdminMfa } from '../../src/auth/cli'
import { totpAt } from '../../src/auth/totp'
import { createHarness, PASSWORD, removeStaleFixtures, type Browser } from './authHarness'

const h = createHarness()
const people: Record<string, { id: string; email: string; agent: Browser; secret: Buffer | undefined }> = {}
let team: { id: string }

async function who(name: string): Promise<Browser> {
  const person = people[name]!
  if ((await person.agent.refresh('staff')).statusCode !== 200) person.agent = (await h.signedInStaff(person.email, person.secret)).agent
  return person.agent
}
async function fresh(name: string): Promise<Browser> {
  const agent = await who(name)
  const response = await h.stepUp(agent, people[name]!.secret!)
  expect(response.statusCode, `step-up ${name}`).toBe(200)
  return agent
}
const tokenOf = (path: string) => path.split('#')[1]!

beforeAll(async () => {
  await removeStaleFixtures(h.prisma, h.run)
  team = await h.team('Staff Team')
  const accounts = [
    ['sa1', 'SUPER_ADMIN'],
    ['sa2', 'SUPER_ADMIN'],
    ['admin', 'ADMIN'],
    ['admin2', 'ADMIN'],
    ['manager', 'MANAGER'],
    ['sales', 'SALES'],
    ['sales2', 'SALES'],
    ['warehouse', 'WAREHOUSE'],
  ] as const
  for (const [name, role] of accounts) {
    const row = await h.staff(name, role, { teamId: role === 'MANAGER' || role === 'SALES' ? team.id : null })
    const { agent, secret } = await h.signedInStaff(row.email)
    people[name] = { id: row.id, email: row.email, agent, secret }
  }
})
afterAll(() => h.cleanup())

describe('staff accounts (D-STAFF)', () => {
  it('lets Admin create Sales with a one-time setup link, but not Admin or Super Admin accounts', async () => {
    const admin = await fresh('admin')
    const created = await admin.post('/api/admin/staff', { email: h.email('new-sales'), displayName: 'New Sales', role: 'SALES', teamId: team.id })
    expect(created.statusCode).toBe(201)
    expect(created.json().staff).toMatchObject({ role: 'SALES', status: 'ACTIVE', setupPending: true, mfaEnabled: false })
    const token = tokenOf(created.json().link.path)
    expect((await h.browser().staffLogin(h.email('new-sales'))).statusCode).toBe(401)
    const setup = await h.browser().post('/api/auth/account-token/complete', { token, password: PASSWORD })
    expect(setup.json()).toEqual({ status: 'password_set', account: 'staff' })
    expect((await h.browser().staffLogin(h.email('new-sales'))).json().stage).toBe('FULL')

    for (const role of ['ADMIN', 'SUPER_ADMIN'] as const) {
      expect((await admin.post('/api/admin/staff', { email: h.email(`no-${role}`), displayName: 'X', role })).json().error.code, role).toBe('forbidden')
    }
    const sa = await fresh('sa1')
    expect((await sa.post('/api/admin/staff', { email: h.staffEmail('new-admin', 'ADMIN'), displayName: 'New Admin', role: 'ADMIN' })).statusCode).toBe(201)
    expect((await (await who('manager')).post('/api/admin/staff', { email: h.email('x'), displayName: 'X', role: 'SALES' })).json().error.code).toBe('forbidden')
  })

  it('requires a fresh 2FA for staff changes', async () => {
    const admin = await who('admin')
    h.advance(6 * 60_000)
    const response = await admin.patch(`/api/admin/staff/${people.sales!.id}`, { displayName: 'Renamed' })
    expect(response.json().error.code).toBe('step_up_required')
  })

  it('lets Admin manage Manager/Sales/Warehouse only, and nobody change themselves', async () => {
    const admin = await fresh('admin')
    expect((await admin.patch(`/api/admin/staff/${people.sa1!.id}`, { status: 'DISABLED' })).json().error.code).toBe('forbidden')
    expect((await admin.patch(`/api/admin/staff/${people.sales!.id}`, { role: 'ADMIN' })).json().error.code).toBe('forbidden')
    // Admin accounts (including their own) are outside an Admin's visibility, so the request is refused outright.
    expect((await admin.patch(`/api/admin/staff/${people.admin!.id}`, { status: 'DISABLED' })).json().error.code).toBe('forbidden')
    expect((await admin.patch(`/api/admin/staff/${people.admin!.id}`, { displayName: 'Admin Renamed' })).statusCode).toBe(403) // Admin accounts are Super Admin-managed
  })

  it('promoting Sales to Manager ends their sessions and forces 2FA enrolment at the next sign-in', async () => {
    const salesAgent = await who('sales')
    const admin = await fresh('admin')
    const promoted = await admin.patch(`/api/admin/staff/${people.sales!.id}`, { role: 'MANAGER' })
    expect(promoted.statusCode).toBe(200)
    expect((await salesAgent.get('/api/auth/staff/session')).statusCode).toBe(401)
    const again = h.browser()
    expect((await again.staffLogin(people.sales!.email)).json().stage).toBe('MFA_ENROLLMENT_REQUIRED')
    expect((await again.get('/api/admin/customers')).json().error.code).toBe('stage_required')
    const events = await h.prisma.auditEvent.findMany({ where: { subjectId: people.sales!.id, type: 'staff_updated' } })
    expect(events.at(-1)?.details).toMatchObject({ fromRole: 'SALES', toRole: 'MANAGER' })
  })

  it('never disables or demotes the last active Super Admin, even with two concurrent requests', async () => {
    const one = await fresh('sa1')
    const two = await fresh('sa2')
    // Fixture Super Admins from this run are the only ones in the test database (stale fixtures were removed).
    const others = await h.prisma.staffUser.count({ where: { role: 'SUPER_ADMIN', status: 'ACTIVE', NOT: { email: { startsWith: h.run } } } })
    expect(others, 'nblao_test must contain no other active Super Admin for this test').toBe(0)
    const [a, b] = await Promise.all([
      one.patch(`/api/admin/staff/${people.sa2!.id}`, { status: 'DISABLED' }),
      two.patch(`/api/admin/staff/${people.sa1!.id}`, { role: 'ADMIN' }),
    ])
    const statuses = [a.statusCode, b.statusCode].sort()
    // One change wins; the other is refused as last-Super-Admin (or because its own session was just revoked).
    expect(statuses[0]).toBe(200)
    expect([401, 409]).toContain(statuses[1])
    expect(await h.prisma.staffUser.count({ where: { role: 'SUPER_ADMIN', status: 'ACTIVE', email: { startsWith: h.run } } })).toBe(1)

    const survivor = a.statusCode === 200 ? 'sa1' : 'sa2'
    const loser = survivor === 'sa1' ? 'sa2' : 'sa1'
    const agent = await fresh(survivor)
    expect((await agent.patch(`/api/admin/staff/${people[survivor]!.id}`, { status: 'DISABLED' })).json().error.code).toBe('self_change')
    // Restore the other Super Admin for the remaining tests.
    if (a.statusCode === 200) expect((await agent.patch(`/api/admin/staff/${people.sa2!.id}`, { status: 'ACTIVE' })).statusCode).toBe(200)
    else expect((await agent.patch(`/api/admin/staff/${people.sa1!.id}`, { role: 'SUPER_ADMIN' })).statusCode).toBe(200)
    people[loser]!.agent = (await h.signedInStaff(people[loser]!.email, people[loser]!.secret)).agent
  })
})

describe('staff reset links and 2FA reset (Super Admin only)', () => {
  it('lets only Super Admin issue staff reset links; redeeming keeps 2FA and revokes sessions', async () => {
    expect((await (await fresh('admin')).post(`/api/admin/staff/${people.manager!.id}/reset-link`)).json().error.code).toBe('forbidden')
    const managerAgent = await who('manager')
    const sa = await fresh('sa1')
    const issued = await sa.post(`/api/admin/staff/${people.manager!.id}/reset-link`)
    expect(issued.statusCode).toBe(201)
    expect((await sa.post(`/api/admin/staff/${people.sa1!.id}/reset-link`)).json().error.code).toBe('self_change')
    const done = await h.browser().post('/api/auth/account-token/complete', { token: tokenOf(issued.json().link.path), password: 'manager reset passphrase' })
    expect(done.statusCode).toBe(200)
    expect((await managerAgent.get('/api/auth/staff/session')).statusCode).toBe(401)
    const login = await h.browser().staffLogin(people.manager!.email, 'manager reset passphrase')
    expect(login.json().stage).toBe('MFA_REQUIRED') // a reset link never bypasses 2FA
    await h.prisma.staffUser.update({ where: { id: people.manager!.id }, data: { passwordHash: await h.hasher.hash(PASSWORD) } })
  })

  it('lets a Super Admin reset another person\'s 2FA (step-up, audited, sessions revoked)', async () => {
    const managerAgent = await who('manager')
    expect((await (await fresh('admin')).post(`/api/admin/staff/${people.manager!.id}/mfa-reset`)).json().error.code).toBe('forbidden')
    const sa = await fresh('sa1')
    expect((await sa.post(`/api/admin/staff/${people.sa1!.id}/mfa-reset`)).json().error.code).toBe('self_change')
    expect((await sa.post(`/api/admin/staff/${people.manager!.id}/mfa-reset`)).json()).toEqual({ status: 'mfa_reset' })
    expect((await managerAgent.get('/api/auth/staff/session')).statusCode).toBe(401)
    expect(await h.prisma.staffMfa.count({ where: { staffId: people.manager!.id } })).toBe(0)
    expect(await h.prisma.mfaRecoveryCode.count({ where: { staffId: people.manager!.id } })).toBe(0)
    const again = h.browser()
    expect((await again.staffLogin(people.manager!.email)).json().stage).toBe('MFA_ENROLLMENT_REQUIRED')
    people.manager!.secret = (await h.enrol(again)).secret
    people.manager!.agent = again
    const [event] = await h.prisma.auditEvent.findMany({ where: { subjectId: people.manager!.id, type: 'mfa_reset' } })
    expect(event).toMatchObject({ category: 'SECURITY', actorId: people.sa1!.id })
  })

  it('re-enrols a new authenticator only after a fresh 2FA, keeping the old one until confirmed', async () => {
    const admin = await who('admin')
    h.advance(6 * 60_000)
    expect((await admin.post('/api/auth/staff/mfa/enroll/start')).json().error.code).toBe('step_up_required')
    await fresh('admin')
    const start = await admin.post('/api/auth/staff/mfa/enroll/start')
    expect(start.statusCode).toBe(200)
    const stored = await h.prisma.staffMfa.findUniqueOrThrow({ where: { staffId: people.admin!.id } })
    expect(stored.enabledAt).not.toBeNull()
    expect(stored.pendingSecretCiphertext).not.toBeNull()
    // The old authenticator still signs in while the new one is pending.
    const old = h.browser()
    await old.staffLogin(people.admin!.email)
    expect((await old.post('/api/auth/staff/mfa/verify', { code: totpAt(people.admin!.secret!, h.clock.ms) })).statusCode).toBe(200)
    h.advance(30_000)
  })
})

describe('staff visibility (Admin sees only Manager, Sales and Warehouse)', () => {
  const emailsOf = (body: { items: { email: string }[] }) => body.items.map(item => item.email).filter(email => email.startsWith(h.run))

  it('Super Admin lists and inspects every staff account', async () => {
    const sa = await who('sa1')
    const listed = emailsOf((await sa.get('/api/admin/staff')).json())
    for (const name of Object.keys(people)) expect(listed, name).toContain(people[name]!.email)
    for (const name of ['sa2', 'admin2', 'warehouse']) expect((await sa.get(`/api/admin/staff/${people[name]!.id}`)).statusCode, name).toBe(200)
  })

  it('Admin lists only Manager, Sales and Warehouse accounts and cannot inspect or act on Admin or Super Admin accounts', async () => {
    const admin = await fresh('admin')
    const body = (await admin.get('/api/admin/staff')).json() as { items: { email: string; role: string }[] }
    expect(body.items.length).toBeGreaterThan(0)
    expect(body.items.every(item => ['MANAGER', 'SALES', 'WAREHOUSE'].includes(item.role))).toBe(true)
    const listed = emailsOf(body)
    for (const name of ['manager', 'sales2', 'warehouse']) expect(listed, name).toContain(people[name]!.email)
    for (const name of ['sa1', 'sa2', 'admin', 'admin2']) expect(listed, name).not.toContain(people[name]!.email)
    expect(JSON.stringify(body)).not.toContain('SUPER_ADMIN')

    expect((await admin.get(`/api/admin/staff/${people.warehouse!.id}`)).json().staff.role).toBe('WAREHOUSE')
    for (const name of ['sa1', 'sa2', 'admin', 'admin2']) {
      const id = people[name]!.id
      const inspect = await admin.get(`/api/admin/staff/${id}`)
      expect(inspect.statusCode, `inspect ${name}`).toBe(403)
      expect(inspect.body).not.toContain(people[name]!.email)
      for (const change of [{ displayName: 'X' }, { status: 'DISABLED' }, { role: 'SALES' }, { teamId: null }]) {
        expect((await admin.patch(`/api/admin/staff/${id}`, change)).statusCode, `patch ${name} ${JSON.stringify(change)}`).toBe(403)
      }
      for (const action of ['reset-link', 'mfa-reset', 'setup-link']) expect((await admin.post(`/api/admin/staff/${id}/${action}`)).statusCode, `${action} ${name}`).toBe(403)
    }
    // An id that belongs to nobody gets the same 403 as a hidden account, so ids cannot confirm existence.
    const unknown = await admin.get('/api/admin/staff/00000000-0000-4000-8000-000000000000')
    expect(unknown.statusCode).toBe(403)
    expect(unknown.body).toBe((await admin.get(`/api/admin/staff/${people.sa1!.id}`)).body)
    expect((await (await who('sa1')).get('/api/admin/staff/00000000-0000-4000-8000-000000000000')).statusCode).toBe(404)
    const sa1 = await h.prisma.staffUser.findUniqueOrThrow({ where: { id: people.sa1!.id } })
    expect(sa1).toMatchObject({ role: 'SUPER_ADMIN', status: 'ACTIVE', displayName: 'Test sa1' })
  })

  it('refuses every reserved-namespace address for Admin identically, before any lookup, whether or not the account exists', async () => {
    const admin = await fresh('admin')
    const lookups: unknown[] = []
    const original = h.prisma.staffUser.findUnique.bind(h.prisma.staffUser)
    const spy = vi.spyOn(h.prisma.staffUser, 'findUnique').mockImplementation(((args: { where: { email?: string } }) => {
      if (args.where.email !== undefined) lookups.push(args.where.email)
      return original(args as never)
    }) as never)
    try {
      const responses = []
      for (const email of [people.sa1!.email, people.sa1!.email.toUpperCase(), people.admin2!.email, h.staffEmail('nobody-here', 'ADMIN'), `x${PRIVILEGED_EMAIL_SUFFIX}`]) {
        for (const role of ['SALES', 'MANAGER', 'WAREHOUSE'] as const) {
          responses.push(await admin.post('/api/admin/staff', { email, displayName: 'Probe', role }))
        }
      }
      expect(new Set(responses.map(response => response.statusCode))).toEqual(new Set([400]))
      expect(new Set(responses.map(response => response.body)).size).toBe(1)
      expect(responses[0]!.json().error.code).toBe('reserved_email')
      expect(lookups).toEqual([]) // decided from the request alone: no lookup by email happened
    } finally {
      spy.mockRestore()
    }
    // Non-reserved addresses can only collide with accounts Admin already sees.
    const visible = await admin.post('/api/admin/staff', { email: people.warehouse!.email, displayName: 'Probe', role: 'SALES' })
    expect(visible.json().error.code).toBe('email_unavailable')
    // Attempts are audited (Super Admins only) without revealing anything to the Admin.
    expect(await h.prisma.auditEvent.count({ where: { type: 'staff_create_reserved_email', actorId: people.admin!.id } })).toBe(15)
    expect(((await admin.get(`/api/admin/audit?subjectId=${people.sa1!.id}`)).json().items as unknown[]).length).toBe(0)
    // No account was created by any of these attempts, and Admin still manages non-admin staff.
    expect(await h.prisma.staffUser.count({ where: { displayName: 'Probe' } })).toBe(0)
    const created = await (await fresh('admin')).post('/api/admin/staff', { email: h.email('admin-made-sales'), displayName: 'Admin Made', role: 'SALES' })
    expect(created.statusCode).toBe(201)
  })

  it('does exactly the same database work for existing and non-existing protected accounts (no timing or behaviour difference)', async () => {
    const admin = await fresh('admin')
    // Record every staff-table and audit call (method + which fields it filtered on) while the server answers.
    const calls: string[] = []
    const spies = [
      ...(['findUnique', 'findFirst', 'findMany', 'count', 'update', 'create'] as const).map(method => {
        const original = (h.prisma.staffUser[method] as (...args: unknown[]) => unknown).bind(h.prisma.staffUser)
        return vi.spyOn(h.prisma.staffUser, method).mockImplementation(((args: { where?: Record<string, unknown> } = {}) => {
          calls.push(`staffUser.${method}(${Object.keys(args.where ?? {}).sort().join(',')})`)
          return original(args)
        }) as never)
      }),
      (() => {
        const original = h.prisma.auditEvent.create.bind(h.prisma.auditEvent)
        return vi.spyOn(h.prisma.auditEvent, 'create').mockImplementation(((args: { data: { type: string } }) => {
          calls.push(`auditEvent.create(${args.data.type})`)
          return original(args as never)
        }) as never)
      })(),
    ]
    const trace = async (request: () => Promise<{ statusCode: number; body: string }>) => {
      calls.length = 0
      const response = await request()
      return { status: response.statusCode, body: response.body, calls: [...calls] }
    }
    try {
      // Reserved addresses: an existing Super Admin, an existing Admin, and addresses nobody has.
      const create = (email: string) => () => admin.post('/api/admin/staff', { email, displayName: 'Probe', role: 'SALES' })
      const emailTraces = [
        await trace(create(people.sa1!.email)),
        await trace(create(people.admin2!.email)),
        await trace(create(h.staffEmail('never-existed', 'ADMIN'))),
        await trace(create(`someone${PRIVILEGED_EMAIL_SUFFIX}`)),
      ]
      for (const result of emailTraces) expect(result).toEqual(emailTraces[0])
      expect(emailTraces[0]!.calls.some(call => call.includes('(email)'))).toBe(false)

      // Ids: a hidden Super Admin, a hidden Admin, and an id that belongs to nobody, on every staff endpoint.
      const missingId = '00000000-0000-4000-8000-000000000000'
      for (const [label, request] of [
        ['inspect', (id: string) => () => admin.get(`/api/admin/staff/${id}`)],
        ['update', (id: string) => () => admin.patch(`/api/admin/staff/${id}`, { displayName: 'Probe' })],
        ['disable', (id: string) => () => admin.patch(`/api/admin/staff/${id}`, { status: 'DISABLED' })],
        ['setup-link', (id: string) => () => admin.post(`/api/admin/staff/${id}/setup-link`)],
      ] as const) {
        const traces = [await trace(request(people.sa1!.id)), await trace(request(people.admin2!.id)), await trace(request(missingId))]
        expect(traces[0]!.status, label).toBe(403)
        for (const result of traces) expect(result, label).toEqual(traces[0])
      }
    } finally {
      for (const spy of spies) spy.mockRestore()
    }
  })

  it('limits repeated reserved-namespace attempts per staff member (anti-probing)', async () => {
    const limited = createHarness({ rateLimits: true })
    try {
      const admin = await limited.staff('probe-admin', 'ADMIN')
      const target = await limited.staff('probe-target', 'SUPER_ADMIN')
      const { agent, secret } = await limited.signedInStaff(admin.email)
      const statuses: number[] = []
      for (let i = 0; i < 6; i += 1) {
        await limited.stepUp(agent, secret!)
        // Alternate an existing and a non-existing reserved address: the limiter counts both the same way.
        const email = i % 2 === 0 ? target.email : limited.staffEmail(`missing-${i}`, 'SUPER_ADMIN')
        statuses.push((await agent.post('/api/admin/staff', { email, displayName: 'Probe', role: 'SALES' })).statusCode)
      }
      expect(statuses).toEqual([400, 400, 400, 400, 400, 429])
    } finally {
      await limited.cleanup()
    }
  })

  it('only Super Admin creates privileged accounts, and only with a reserved address; promotion needs a separate account', async () => {
    const sa = await fresh('sa1')
    const created = await sa.post('/api/admin/staff', { email: h.staffEmail('new-admin-2', 'ADMIN'), displayName: 'New Admin 2', role: 'ADMIN' })
    expect(created.statusCode).toBe(201)
    expect((await sa.post('/api/admin/staff', { email: h.email('plain-admin'), displayName: 'X', role: 'ADMIN' })).json().error.code).toBe('privileged_email_required')
    expect((await sa.post('/api/admin/staff', { email: h.email('plain-sa'), displayName: 'X', role: 'SUPER_ADMIN' })).json().error.code).toBe('privileged_email_required')
    expect((await sa.post('/api/admin/staff', { email: h.staffEmail('reserved-sales', 'ADMIN'), displayName: 'X', role: 'SALES' })).json().error.code).toBe('reserved_email')

    // Manager -> Admin is refused (needs its own reserved address); Admin -> Manager is refused (disable instead).
    expect((await sa.patch(`/api/admin/staff/${people.warehouse!.id}`, { role: 'ADMIN' })).json().error.code).toBe('privileged_email_required')
    expect((await sa.patch(`/api/admin/staff/${created.json().staff.id}`, { role: 'MANAGER' })).json().error.code).toBe('privileged_account_role')
    // Admin <-> Super Admin stays possible for a Super Admin.
    expect((await sa.patch(`/api/admin/staff/${created.json().staff.id}`, { role: 'SUPER_ADMIN' })).statusCode).toBe(200)
    expect((await (await fresh('sa1')).patch(`/api/admin/staff/${created.json().staff.id}`, { status: 'DISABLED' })).statusCode).toBe(200)
  })

  it('Manager, Sales and Warehouse get 403 from every staff-management endpoint', async () => {
    for (const name of ['manager', 'sales2', 'warehouse']) {
      const agent = await who(name)
      const target = people.sales2!.id
      const requests = [
        agent.get('/api/admin/staff'),
        agent.get(`/api/admin/staff/${target}`),
        agent.post('/api/admin/staff', { email: h.email(`by-${name}`), displayName: 'X', role: 'SALES' }),
        agent.patch(`/api/admin/staff/${target}`, { displayName: 'X' }),
        agent.post(`/api/admin/staff/${target}/reset-link`),
        agent.post(`/api/admin/staff/${target}/setup-link`),
        agent.post(`/api/admin/staff/${target}/mfa-reset`),
        agent.get('/api/admin/teams'),
        agent.post('/api/admin/teams', { name: `${h.run} by ${name}` }),
      ]
      for (const [index, response] of (await Promise.all(requests)).entries()) {
        expect(response.statusCode, `${name} request ${index}`).toBe(403)
        expect(response.json().error.code, `${name} request ${index}`).toBe('forbidden')
      }
    }
  })

  it('a Super Admin 2FA reset also clears every 2FA source block of the account (legitimate recovery)', async () => {
    const { recordSourceFailure } = await import('../../src/auth/mfaThrottle')
    const now = new Date(h.clock.ms)
    for (const ip of ['203.0.113.50', '203.0.113.51']) for (let i = 0; i < 10; i += 1) await recordSourceFailure(h.prisma, people.sales2!.id, ip, now)
    await h.prisma.staffUser.update({ where: { id: people.sales2!.id }, data: { mfaFailedCount: 20 } })
    expect(await h.prisma.mfaThrottle.count({ where: { staffId: people.sales2!.id, blockedUntil: { gt: now } } })).toBe(2)
    expect((await (await who('sales2')).post(`/api/admin/staff/${people.sales2!.id}/mfa-reset`)).statusCode).toBe(403)
    const sa = await fresh('sa1')
    expect((await sa.post(`/api/admin/staff/${people.sales2!.id}/mfa-reset`)).statusCode).toBe(200)
    expect(await h.prisma.mfaThrottle.count({ where: { staffId: people.sales2!.id } })).toBe(0)
    expect(await h.prisma.staffUser.findUniqueOrThrow({ where: { id: people.sales2!.id } })).toMatchObject({ mfaFailedCount: 0, mfaLockedUntil: null })
  })
})

describe('teams', () => {
  it('lets Super Admin and Admin create teams; others cannot', async () => {
    const created = await (await who('admin')).post('/api/admin/teams', { name: `${h.run} Created` })
    expect(created.statusCode).toBe(201)
    expect((await (await who('admin')).post('/api/admin/teams', { name: `${h.run} Created` })).json().error.code).toBe('team_exists')
    expect((await (await who('manager')).post('/api/admin/teams', { name: `${h.run} Nope` })).json().error.code).toBe('forbidden')
    const listed = await (await who('sa1')).get('/api/admin/teams')
    expect((listed.json().items as { name: string }[]).some(item => item.name === `${h.run} Created`)).toBe(true)
  })

  it('counts only visible staff for Admin (no hidden Admin or Super Admin members); Super Admin sees full counts', async () => {
    const counted = await h.team('Counted')
    await h.staff('count-manager', 'MANAGER', { teamId: counted.id })
    await h.staff('count-sales', 'SALES', { teamId: counted.id })
    await h.staff('count-admin', 'ADMIN', { teamId: counted.id })
    await h.staff('count-sa', 'SUPER_ADMIN', { teamId: counted.id })
    const countFor = async (name: string) => {
      const items = (await (await who(name)).get('/api/admin/teams')).json().items as { id: string; staffCount: number; customerCount: number }[]
      return items.find(item => item.id === counted.id)!
    }
    expect(await countFor('admin')).toMatchObject({ staffCount: 2, customerCount: 0 })
    expect(await countFor('sa1')).toMatchObject({ staffCount: 4, customerCount: 0 })
  })
})

describe('local CLI functions', () => {
  it('refuses a second Super Admin, resets Super Admin 2FA and cleans only expired rows', async () => {
    await expect(createFirstSuperAdmin(h.prisma, h.hasher, { email: h.email('cli-sa'), displayName: 'CLI', password: PASSWORD }, new Date(h.clock.ms))).rejects.toThrow(CliRefusal)
    await expect(resetSuperAdminMfa(h.prisma, people.admin!.email, new Date(h.clock.ms))).rejects.toThrow(CliRefusal)

    // A second signed-in session, so the reset has more than one session to end.
    const sa2Agent = await who('sa2')
    const second = (await h.signedInStaff(people.sa2!.email, people.sa2!.secret)).agent
    expect((await sa2Agent.get('/api/auth/staff/session')).statusCode).toBe(200)
    expect((await second.get('/api/auth/staff/session')).statusCode).toBe(200)
    expect(await h.prisma.session.count({ where: { staffId: people.sa2!.id, revokedAt: null } })).toBeGreaterThanOrEqual(2)

    await resetSuperAdminMfa(h.prisma, people.sa2!.email, new Date(h.clock.ms))
    expect(await h.prisma.staffMfa.count({ where: { staffId: people.sa2!.id } })).toBe(0)
    expect(await h.prisma.mfaRecoveryCode.count({ where: { staffId: people.sa2!.id } })).toBe(0)
    // Every session of the account ended in the same transaction, so no session from before the reset can outlive the
    // deleted 2FA record (and its generation, which restarts at 0 only with a new enrolment after a new sign-in).
    expect(await h.prisma.session.count({ where: { staffId: people.sa2!.id, revokedAt: null } })).toBe(0)
    expect(await h.prisma.session.count({ where: { staffId: people.sa2!.id, revokedReason: 'mfa_reset' } })).toBeGreaterThanOrEqual(2)
    expect((await sa2Agent.get('/api/auth/staff/session')).statusCode).toBe(401)
    expect((await second.get('/api/auth/staff/session')).statusCode).toBe(401)
    expect(await h.prisma.auditEvent.count({ where: { subjectId: people.sa2!.id, type: 'mfa_reset', details: { path: ['via'], equals: 'cli' } } })).toBe(1)
    // The next sign-in must enrol a new authenticator from scratch.
    const fresh2 = h.browser()
    expect((await fresh2.staffLogin(people.sa2!.email)).json().stage).toBe('MFA_ENROLLMENT_REQUIRED')
    const auditBefore = await h.prisma.auditEvent.count()
    const result = await cleanupExpired(h.prisma, new Date(h.clock.ms + 400 * 24 * 3600_000))
    expect(result.sessions).toBeGreaterThan(0)
    expect(await h.prisma.auditEvent.count()).toBeGreaterThanOrEqual(auditBefore)
  })
})
