/**
 * SQL-level proof for staff endpoints (including statements inside transaction callbacks): an Admin gets the same
 * 403 for a hidden Super Admin, a hidden Admin and an id that belongs to nobody, with exactly the same statements;
 * the only lookup of the requested id carries the visibility filter in the query itself, so hidden records are never
 * fetched before authorization. Super Admin access is unchanged.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createHarness, removeStaleFixtures, type Browser, type CapturedQuery } from './authHarness'

const h = createHarness({ captureQueries: true })
const MISSING = '00000000-0000-4000-8000-000000000000'
const ids: Record<'sa' | 'admin' | 'admin2' | 'sales' | 'newStaff', string> = { sa: '', admin: '', admin2: '', sales: '', newStaff: '' }
let admin: { agent: Browser; secret: Buffer }
let superAdmin: { agent: Browser; secret: Buffer }

/**
 * Statements with the requested id replaced by <TARGET>, so traces for different ids can be compared. Prisma loads
 * the two related tables of a staff row (staff_mfa, teams) concurrently, so that adjacent pair is put in a fixed
 * order; every other statement keeps its exact position.
 */
const isRelationLoad = (line: string) => /FROM "public"\."(staff_mfa|teams)" WHERE "public"\."(staff_mfa|teams)"\."(staff_id|id)" IN \(/.test(line)
function normalize(queries: CapturedQuery[], target: string): string[] {
  const lines = queries.map(q => `${q.query.replace(/\s+/g, ' ')} | ${q.params.replaceAll(target, '<TARGET>')}`)
  const result: string[] = []
  for (let i = 0; i < lines.length; ) {
    if (!isRelationLoad(lines[i]!)) {
      result.push(lines[i]!)
      i += 1
      continue
    }
    const group: string[] = []
    while (i < lines.length && isRelationLoad(lines[i]!)) group.push(lines[i++]!)
    result.push(...group.sort())
  }
  return result
}

/**
 * Prisma emits query-log events asynchronously, so wait until no new statement has arrived for a moment before
 * and after each request; otherwise a late event from one request could land in the next trace.
 */
async function settle(): Promise<void> {
  let seen = -1
  while (seen !== h.queries.length) {
    seen = h.queries.length
    await new Promise(resolve => setTimeout(resolve, 25))
  }
}

async function capture(request: () => Promise<{ statusCode: number; body: string }>, target: string) {
  await settle()
  h.queries.length = 0
  const response = await request()
  await settle()
  return { status: response.statusCode, body: response.body, sql: normalize(h.queries, target) }
}

beforeAll(async () => {
  await removeStaleFixtures(h.prisma, h.run)
  ids.sa = (await h.staff('sql-sa', 'SUPER_ADMIN')).id
  ids.admin = (await h.staff('sql-admin', 'ADMIN')).id
  ids.admin2 = (await h.staff('sql-admin2', 'ADMIN')).id
  ids.sales = (await h.staff('sql-sales', 'SALES')).id
  // A Sales account that has not chosen a password yet (setup link possible).
  ids.newStaff = (await h.prisma.staffUser.create({ data: { email: h.email('sql-new'), displayName: 'Test sql-new', role: 'SALES', passwordHash: null } })).id
  const a = await h.signedInStaff(h.staffEmail('sql-admin', 'ADMIN'))
  const s = await h.signedInStaff(h.staffEmail('sql-sa', 'SUPER_ADMIN'))
  admin = { agent: a.agent, secret: a.secret! }
  superAdmin = { agent: s.agent, secret: s.secret! }
})
afterAll(() => h.cleanup())

describe('Admin requests for hidden or missing staff ids (statements inside transactions included)', () => {
  const operations = [
    { name: 'inspect (GET)', transaction: false, run: (id: string) => () => admin.agent.get(`/api/admin/staff/${id}`) },
    { name: 'update (PATCH)', transaction: true, run: (id: string) => () => admin.agent.patch(`/api/admin/staff/${id}`, { displayName: 'Probe' }) },
    { name: 'disable (PATCH status)', transaction: true, run: (id: string) => () => admin.agent.patch(`/api/admin/staff/${id}`, { status: 'DISABLED' }) },
    { name: 'change role (PATCH role)', transaction: true, run: (id: string) => () => admin.agent.patch(`/api/admin/staff/${id}`, { role: 'SALES' }) },
    { name: 'setup link (POST)', transaction: true, run: (id: string) => () => admin.agent.post(`/api/admin/staff/${id}/setup-link`) },
  ]

  for (const operation of operations) {
    it(`${operation.name}: identical 403 and identical SQL; the only lookup of the id is visibility-filtered`, async () => {
      const step = await h.stepUp(admin.agent, admin.secret) // fresh 2FA for sensitive actions, outside the capture
      expect(step.statusCode).toBe(200)
      const targets = [ids.sa, ids.admin2, MISSING]
      const traces = []
      for (const target of targets) traces.push(await capture(operation.run(target), target))

      for (const trace of traces) {
        expect(trace.status, operation.name).toBe(403)
        expect(trace.body, operation.name).toBe(traces[0]!.body)
        expect(trace.sql, operation.name).toEqual(traces[0]!.sql)
      }
      expect(JSON.parse(traces[0]!.body).error.code).toBe('forbidden')

      const sql = traces[0]!.sql
      const touchingTarget = sql.filter(line => line.includes('<TARGET>'))
      // Exactly one statement looks up the requested id, and it carries the Admin visibility filter (role IN ...).
      expect(touchingTarget, operation.name).toHaveLength(1)
      expect(touchingTarget[0]).toMatch(/FROM "public"\."staff_users"/)
      expect(touchingTarget[0]).toMatch(/"role"/)
      expect(touchingTarget[0]).toContain('"<TARGET>","MANAGER","SALES","WAREHOUSE"')
      // No existence check, nothing written, nothing about the hidden account loaded afterwards.
      expect(sql.some(line => /SELECT COUNT/i.test(line) && line.includes('staff_users'))).toBe(false)
      expect(sql.some(line => /^(INSERT|UPDATE|DELETE)\b/i.test(line) && !line.includes('"public"."sessions"'))).toBe(false)
      // After the filtered lookup, related data (2FA flag, team) is loaded for no row at all: nothing hidden is read.
      const afterLookup = sql.slice(sql.findIndex(line => line.includes('<TARGET>')) + 1)
      const relatedLoads = afterLookup.filter(line => /"public"\."(staff_mfa|teams)"/.test(line))
      expect(relatedLoads.length, operation.name).toBeGreaterThan(0)
      expect(relatedLoads.every(line => line.includes('IN (NULL)')), relatedLoads.join('\n')).toBe(true)
      if (operation.transaction) {
        // The statements above were captured inside the transaction callback, which is then rolled back.
        expect(sql.at(-1), operation.name).toMatch(/^ROLLBACK/)
      }
      if (operation.name.startsWith('update') || operation.name.startsWith('disable') || operation.name.startsWith('change role')) {
        const lock = sql.findIndex(line => line.includes('pg_advisory_xact_lock'))
        const lookup = sql.findIndex(line => line.includes('<TARGET>'))
        expect(lock).toBeGreaterThanOrEqual(0)
        expect(lookup).toBeGreaterThan(lock)
      }
    })
  }

  it('reset-link and 2FA reset are refused by permission before any lookup of the id', async () => {
    await h.stepUp(admin.agent, admin.secret)
    for (const action of ['reset-link', 'mfa-reset']) {
      const traces = []
      for (const target of [ids.sa, ids.admin2, MISSING]) traces.push(await capture(() => admin.agent.post(`/api/admin/staff/${target}/${action}`), target))
      for (const trace of traces) {
        expect(trace.status, action).toBe(403)
        expect(trace).toEqual(traces[0])
        expect(trace.sql.some(line => line.includes('<TARGET>')), action).toBe(false)
      }
    }
  })
})

describe('authorised access is unchanged', () => {
  it('Admin still inspects and manages a visible Sales account', async () => {
    await h.stepUp(admin.agent, admin.secret)
    expect((await admin.agent.get(`/api/admin/staff/${ids.sales}`)).json().staff.role).toBe('SALES')
    expect((await admin.agent.patch(`/api/admin/staff/${ids.sales}`, { displayName: 'Renamed Sales' })).statusCode).toBe(200)
    expect((await admin.agent.post(`/api/admin/staff/${ids.newStaff}/setup-link`)).statusCode).toBe(201)
    expect((await admin.agent.post(`/api/admin/staff/${ids.sales}/setup-link`)).json().error.code).toBe('already_set_up')
  })

  it('Super Admin still inspects and manages Admin accounts and gets 404 only for ids that do not exist', async () => {
    await h.stepUp(superAdmin.agent, superAdmin.secret)
    expect((await superAdmin.agent.get(`/api/admin/staff/${ids.admin2}`)).json().staff.role).toBe('ADMIN')
    expect((await superAdmin.agent.get(`/api/admin/staff/${MISSING}`)).statusCode).toBe(404)
    expect((await superAdmin.agent.patch(`/api/admin/staff/${ids.admin2}`, { displayName: 'Renamed Admin' })).statusCode).toBe(200)
    expect((await superAdmin.agent.patch(`/api/admin/staff/${ids.admin2}`, { status: 'DISABLED' })).statusCode).toBe(200)
    expect((await superAdmin.agent.patch(`/api/admin/staff/${ids.admin2}`, { status: 'ACTIVE' })).statusCode).toBe(200)
    const reset = await superAdmin.agent.post(`/api/admin/staff/${ids.admin2}/reset-link`)
    expect(reset.statusCode).toBe(201)
    expect(await h.prisma.staffUser.count({ where: { id: ids.admin2, displayName: 'Renamed Admin', status: 'ACTIVE' } })).toBe(1)
  })
})
