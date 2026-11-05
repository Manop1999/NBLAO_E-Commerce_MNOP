/**
 * The invitation-request limit (20 per staff member per hour), with the real limiters switched on. The limiter reads
 * the harness's controllable clock, so the hour passes without waiting.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { INVITATION_REQUESTS_PER_HOUR } from '../../src/auth/adminCustomers'
import { createHarness, removeStaleFixtures, type Browser } from './authHarness'

const h = createHarness({ rateLimits: true })
const HOUR = 60 * 60_000
const people: Record<string, { id: string; email: string; ip: string; agent: Browser; secret: Buffer | undefined }> = {}
let outside: { email: string }

const profile = (email: string) => ({ email, firstName: 'Test', lastName: 'Limited', phone: '+856 20 6666 7777', companyName: 'Example Limit Co' })

beforeAll(async () => {
  await removeStaleFixtures(h.prisma, h.run)
  const teamA = await h.team('Limit A')
  const teamB = await h.team('Limit B')
  outside = await h.customer('limit-outside', { teamId: teamB.id })
  // Different source addresses, so the per-IP sign-in limits never interfere with this test.
  for (const [name, teamId, ip] of [['managerA', teamA.id, '10.20.0.1'], ['managerB', teamB.id, '10.20.0.2']] as const) {
    const row = await h.staff(`limit-${name}`, 'MANAGER', { teamId })
    const { agent, secret } = await h.signedInStaff(row.email, undefined, ip)
    people[name] = { id: row.id, email: row.email, ip, agent, secret }
  }
})
afterAll(() => h.cleanup())

describe('invitation request limit', () => {
  it('allows 20 requests per staff member per hour; the 21st gets 429 whatever the email; other staff are unaffected', async () => {
    expect(INVITATION_REQUESTS_PER_HOUR).toBe(20)
    const a = people.managerA!.agent

    // 20 requests within the hour, mixing an email registered outside the Manager's scope and new emails.
    for (let i = 0; i < INVITATION_REQUESTS_PER_HOUR; i += 1) {
      const response = await a.post('/api/admin/customers/invitation-requests', profile(i % 2 ? outside.email : h.email(`limit-${i}`)))
      expect(response.statusCode, `request ${i + 1}`).toBe(202)
      h.advance(60_000)
    }

    // The 21st is refused, identically for an existing and for a new email (nothing about the account is revealed).
    const overExisting = await a.post('/api/admin/customers/invitation-requests', profile(outside.email))
    const overNew = await a.post('/api/admin/customers/invitation-requests', profile(h.email('limit-over')))
    expect(overExisting.statusCode).toBe(429)
    expect(overExisting.json().error.code).toBe('rate_limited')
    expect(overNew.statusCode).toBe(429)
    expect(overNew.body).toBe(overExisting.body)
    // Refused requests are not stored: exactly 20 exist for Manager A.
    expect(await h.prisma.customerInvitationRequest.count({ where: { requestedById: people.managerA!.id } })).toBe(INVITATION_REQUESTS_PER_HOUR)

    // Isolated per staff account: another Manager is not affected.
    expect((await people.managerB!.agent.post('/api/admin/customers/invitation-requests', profile(h.email('limit-other')))).statusCode).toBe(202)

    // After the hour (controllable clock), Manager A may request again (signed in again: the session idled out).
    h.advance(HOUR)
    const again = await h.signedInStaff(people.managerA!.email, people.managerA!.secret, people.managerA!.ip)
    expect((await again.agent.post('/api/admin/customers/invitation-requests', profile(h.email('limit-later')))).statusCode).toBe(202)
  })
})
