/**
 * Test harness for the authentication API against nblao_test: a real app with a controllable clock, a cookie
 * jar per simulated browser, and synthetic fixtures (`@example.test` emails, invented names). Fixture rows
 * share one prefix and are removed afterwards; audit events are append-only and stay (by design).
 */
import { Writable } from 'node:stream'
import type { FastifyInstance, LightMyRequestResponse } from 'fastify'
import { buildApp } from '../../src/app'
import { PasswordHasher } from '../../src/auth/password'
import { PRIVILEGED_EMAIL_SUFFIX } from '../../src/auth/privilegedNamespace'
import { base32Decode, totpAt } from '../../src/auth/totp'
import { PrismaPg } from '@prisma/adapter-pg'
import { CONNECT_TIMEOUT_MS, createDatabaseClient } from '../../src/db/client'
import { PrismaClient } from '../../src/generated/prisma/client'
import type { StaffRoleName } from './authTypes'
import { testDbEnv } from './testEnv'

export const ORIGIN = 'http://127.0.0.1:5174'
export const PASSWORD = 'correct horse battery staple'
export const FIXTURE_DOMAIN = 'example.test'
export const FIXTURE_PREFIX = 'zzauth'

/** One SQL statement Prisma sent to PostgreSQL (including statements inside transaction callbacks). */
export interface CapturedQuery {
  query: string
  params: string
}

export function createHarness(options: { rateLimits?: boolean; captureQueries?: boolean } = {}) {
  const env = testDbEnv()
  const queries: CapturedQuery[] = []
  // With captureQueries, the client logs every statement as an event (still created through the guarded factory).
  const factory = options.captureQueries
    ? (databaseUrl: string) => {
        const client = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl, connectionTimeoutMillis: CONNECT_TIMEOUT_MS }), log: [{ emit: 'event', level: 'query' }] })
        ;(client as unknown as { $on(event: 'query', listener: (e: CapturedQuery) => void): void }).$on('query', e => queries.push({ query: e.query, params: e.params }))
        return client as unknown as PrismaClient
      }
    : undefined
  const { prisma } = createDatabaseClient({ databaseUrl: env.DATABASE_URL, nodeEnv: env.NODE_ENV, allowedDatabases: env.ALLOWED_LOCAL_DATABASES }, factory)
  const run = `${FIXTURE_PREFIX}${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`
  const clock = { ms: Date.UTC(2026, 10, 4, 9, 0, 0) }
  const logs: string[] = []
  const hasher = new PasswordHasher({ memoryCost: 1024, timeCost: 1, parallelism: 1 })
  const app: FastifyInstance = buildApp({
    logLevel: 'info',
    logStream: new Writable({ write(chunk, _encoding, done) { logs.push(String(chunk)); done() } }),
    checkDatabase: () => Promise.resolve(),
    auth: {
      ctx: { prisma, hasher, totpKey: Buffer.alloc(32, 42), now: () => new Date(clock.ms) },
      http: { cookieSecure: false, allowedOrigins: [ORIGIN] },
      rateLimits: options.rateLimits ?? false,
    },
  })

  /** Lower-case, like every stored email (CHECK constraint). */
  const email = (name: string) => `${run}-${name}@${FIXTURE_DOMAIN}`.toLowerCase()
  const advance = (ms: number) => {
    clock.ms += ms
  }
  /**
   * Moves the clock (forward only) to a time window no earlier audit event reaches: one minute after the latest event
   * in the database. Audit rows are append-only and every run starts at the same instant, so time alone never
   * separates runs; this does, because DB test files run one at a time (fileParallelism: false) and only this run
   * writes from here on. Returns the start of the window.
   */
  async function freshAuditWindow(): Promise<Date> {
    const latest = (await prisma.auditEvent.aggregate({ _max: { at: true } }))._max.at
    clock.ms = Math.max(clock.ms, (latest?.getTime() ?? 0) + 60_000)
    return new Date(clock.ms)
  }

  async function team(name: string) {
    return prisma.team.create({ data: { name: `${run} ${name}` } })
  }

  /** Privileged roles use the reserved namespace (CHECK constraint), everyone else @example.test. */
  const staffEmail = (name: string, role: StaffRoleName) =>
    role === 'SUPER_ADMIN' || role === 'ADMIN' ? `${run}-${name}${PRIVILEGED_EMAIL_SUFFIX}`.toLowerCase() : email(name)

  async function staff(name: string, role: StaffRoleName, extra: { teamId?: string | null; mustChangePassword?: boolean } = {}) {
    return prisma.staffUser.create({
      data: { email: staffEmail(name, role), displayName: `Test ${name}`, role, passwordHash: await hasher.hash(PASSWORD), teamId: extra.teamId ?? null, mustChangePassword: extra.mustChangePassword ?? false },
    })
  }

  async function customer(name: string, extra: { status?: 'PENDING' | 'ACTIVE' | 'SUSPENDED'; teamId?: string | null; assignedStaffId?: string | null; invitedById?: string | null } = {}) {
    return prisma.customer.create({
      data: {
        email: email(name),
        firstName: 'Test',
        lastName: name,
        phone: '+856 20 0000 0000',
        companyName: `${run} Company`,
        status: extra.status ?? 'PENDING',
        passwordHash: await hasher.hash(PASSWORD),
        teamId: extra.teamId ?? null,
        assignedStaffId: extra.assignedStaffId ?? null,
        invitedById: extra.invitedById ?? null,
      },
    })
  }

  /**
   * A simulated browser: keeps cookies like a browser would and sends the CSRF token it was given. `ip` sets the
   * source address the server sees (default 127.0.0.1), to simulate different networks.
   */
  function browser(options: { ip?: string } = {}) {
    const jar = new Map<string, string>()
    let csrf: string | undefined
    const store = (response: LightMyRequestResponse) => {
      for (const cookie of response.cookies) {
        if (cookie.value === '' || (cookie.expires && cookie.expires.getTime() <= Date.now())) jar.delete(cookie.name)
        else jar.set(cookie.name, cookie.value)
      }
      return response
    }
    const cookieHeader = () => [...jar].map(([name, value]) => `${name}=${value}`).join('; ')
    const request = async (method: 'GET' | 'POST' | 'PATCH', url: string, body?: unknown, headers: Record<string, string> = {}) =>
      store(
        await app.inject({
          method,
          url,
          ...(options.ip ? { remoteAddress: options.ip } : {}),
          headers: {
            ...(jar.size ? { cookie: cookieHeader() } : {}),
            ...(method !== 'GET' ? { origin: ORIGIN, ...(csrf ? { 'x-csrf-token': csrf } : {}) } : {}),
            ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
            ...headers,
          },
          ...(body !== undefined ? { payload: JSON.stringify(body) } : {}),
        }),
      )
    const self = {
      jar,
      get: (url: string) => request('GET', url),
      post: (url: string, body: unknown = {}, headers?: Record<string, string>) => request('POST', url, body, headers),
      patch: (url: string, body: unknown, headers?: Record<string, string>) => request('PATCH', url, body, headers),
      /** Reads the session (staff or customer) and remembers its CSRF token. */
      async refresh(kind: 'staff' | 'customer') {
        const response = await request('GET', `/api/auth/${kind}/session`)
        if (response.statusCode === 200) csrf = response.json().csrfToken
        return response
      },
      forgetCsrf() {
        csrf = undefined
      },
      async staffLogin(address: string, password = PASSWORD) {
        const response = await request('POST', '/api/auth/staff/login', { email: address, password })
        if (response.statusCode === 200) await self.refresh('staff')
        return response
      },
      async customerLogin(address: string, password = PASSWORD, rememberMe = false) {
        const response = await request('POST', '/api/auth/customer/login', { email: address, password, rememberMe })
        if (response.statusCode === 200) await self.refresh('customer')
        return response
      },
    }
    return self
  }

  /** Enrols TOTP through the API for a browser in MFA_ENROLLMENT_REQUIRED or FULL; returns the secret. */
  async function enrol(agent: ReturnType<typeof browser>) {
    const start = await agent.post('/api/auth/staff/mfa/enroll/start')
    if (start.statusCode !== 200) throw new Error(`enroll/start ${start.statusCode} ${start.body}`)
    const secret = base32Decode(start.json().manualKey)
    const confirm = await agent.post('/api/auth/staff/mfa/enroll/confirm', { code: totpAt(secret, clock.ms) })
    if (confirm.statusCode !== 200) throw new Error(`enroll/confirm ${confirm.statusCode} ${confirm.body}`)
    await agent.refresh('staff')
    advance(30_000)
    return { secret, recoveryCodes: confirm.json().recoveryCodes as string[], start: start.json(), confirm: confirm.json() }
  }

  /** Signs in a staff member and completes 2FA (enrolling first when needed). */
  async function signedInStaff(address: string, secret?: Buffer, ip?: string) {
    const agent = browser({ ip })
    const login = await agent.staffLogin(address)
    if (login.statusCode !== 200) throw new Error(`login ${login.statusCode} ${login.body}`)
    let key = secret
    if (login.json().stage === 'MFA_ENROLLMENT_REQUIRED') key = (await enrol(agent)).secret
    else if (login.json().stage === 'MFA_REQUIRED' && key) {
      const verified = await agent.post('/api/auth/staff/mfa/verify', { code: totpAt(key, clock.ms) })
      if (verified.statusCode !== 200) throw new Error(`verify ${verified.statusCode} ${verified.body}`)
      await agent.refresh('staff')
      advance(30_000)
    }
    return { agent, secret: key }
  }

  /** Fresh step-up for a FULL session. */
  async function stepUp(agent: ReturnType<typeof browser>, secret: Buffer) {
    const response = await agent.post('/api/auth/staff/mfa/verify', { code: totpAt(secret, clock.ms) })
    advance(30_000)
    return response
  }

  async function cleanup() {
    await prisma.customerInvitationRequest.deleteMany({ where: { email: { startsWith: run } } })
    await prisma.customer.deleteMany({ where: { email: { startsWith: run } } })
    await prisma.staffUser.deleteMany({ where: { email: { startsWith: run } } })
    await prisma.team.deleteMany({ where: { name: { startsWith: run } } })
    await app.close()
    await prisma.$disconnect()
  }

  return { app, prisma: prisma as PrismaClient, queries, run, clock, logs, hasher, email, staffEmail, advance, freshAuditWindow, team, staff, customer, browser, enrol, signedInStaff, stepUp, cleanup }
}

/**
 * Removes fixtures left behind by an earlier, interrupted run (only rows with the fixture prefix and domain), so
 * counts such as "active Super Admins" are not affected by them.
 */
export async function removeStaleFixtures(prisma: PrismaClient, currentRun: string) {
  const stale = { startsWith: FIXTURE_PREFIX, endsWith: `@${FIXTURE_DOMAIN}`, not: { startsWith: currentRun } }
  const staleStaff = { OR: [{ email: stale }, { email: { startsWith: FIXTURE_PREFIX, endsWith: PRIVILEGED_EMAIL_SUFFIX, not: { startsWith: currentRun } } }] }
  await prisma.customerInvitationRequest.deleteMany({ where: { email: stale } })
  await prisma.customer.deleteMany({ where: { email: stale } })
  await prisma.staffUser.deleteMany({ where: staleStaff })
  await prisma.team.deleteMany({ where: { name: { startsWith: FIXTURE_PREFIX, not: { startsWith: currentRun } } } })
}

export type Harness = ReturnType<typeof createHarness>
export type Browser = ReturnType<Harness['browser']>
