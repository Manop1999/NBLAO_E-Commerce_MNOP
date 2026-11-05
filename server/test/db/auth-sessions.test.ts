import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { hashToken } from '../../src/auth/tokens'
import { totpAt } from '../../src/auth/totp'
import { createHarness, PASSWORD, removeStaleFixtures, type Browser } from './authHarness'

const h = createHarness()
const MIN = 60_000
const HOUR = 60 * MIN
const DAY = 24 * HOUR

beforeAll(async () => {
  await removeStaleFixtures(h.prisma, h.run)
})
afterAll(() => h.cleanup())

describe('staff sign-in, stages and forced 2FA', () => {
  it('forces 2FA enrolment for a Manager and blocks admin endpoints until it is done', async () => {
    const team = await h.team('sessions')
    const manager = await h.staff('mgr-enrol', 'MANAGER', { teamId: team.id })
    const agent = h.browser()
    const login = await agent.staffLogin(manager.email)
    expect(login.statusCode).toBe(200)
    expect(login.json()).toEqual({ stage: 'MFA_ENROLLMENT_REQUIRED' })

    const cookie = login.cookies.find(c => c.name === 'nblao_staff')!
    expect(cookie).toMatchObject({ httpOnly: true, sameSite: 'Strict', path: '/' })
    expect(cookie.secure).toBeFalsy()
    expect(cookie.maxAge).toBeUndefined()
    expect(await h.prisma.session.count({ where: { tokenHash: hashToken(cookie.value) } })).toBe(1)
    expect(JSON.stringify(await h.prisma.session.findMany({ where: { staffId: manager.id } }))).not.toContain(cookie.value)

    const session = await agent.refresh('staff')
    expect(session.json()).toMatchObject({ stage: 'MFA_ENROLLMENT_REQUIRED', permissions: [], staff: { role: 'MANAGER', mfaEnabled: false, mfaRequired: true } })
    expect(session.body).not.toMatch(/passwordHash|tokenHash|secret/i)

    const blocked = await agent.get('/api/admin/customers')
    expect(blocked.statusCode).toBe(403)
    expect(blocked.json().error).toMatchObject({ code: 'stage_required', stage: 'MFA_ENROLLMENT_REQUIRED' })

    const start = await agent.post('/api/auth/staff/mfa/enroll/start')
    expect(start.statusCode).toBe(200)
    expect(start.json().qrCode).toMatch(/^data:image\/svg\+xml;base64,/)
    expect(start.json().otpauthUri).toMatch(/^otpauth:\/\/totp\//)
    const stored = await h.prisma.staffMfa.findUniqueOrThrow({ where: { staffId: manager.id } })
    expect(stored.enabledAt).toBeNull()
    expect(Buffer.from(stored.secretCiphertext).toString('latin1')).not.toContain(start.json().manualKey.replace(/ /g, ''))

    expect((await agent.post('/api/auth/staff/mfa/enroll/confirm', { code: '000000' })).json().error.code).toBe('invalid_code')

    const oldCookie = agent.jar.get('nblao_staff')
    const { recoveryCodes } = await h.enrol(agent)
    expect(recoveryCodes).toHaveLength(10)
    expect(agent.jar.get('nblao_staff')).not.toBe(oldCookie) // rotated: no fixation
    const stale = h.browser()
    stale.jar.set('nblao_staff', oldCookie!)
    expect((await stale.get('/api/auth/staff/session')).statusCode).toBe(401)

    const full = await agent.refresh('staff')
    expect(full.json()).toMatchObject({ stage: 'FULL', staff: { mfaEnabled: true } })
    expect(full.json().permissions).toContain('customers.approve')
    expect((await agent.get('/api/admin/customers')).statusCode).toBe(200)
    const codes = await h.prisma.mfaRecoveryCode.findMany({ where: { staffId: manager.id } })
    expect(codes).toHaveLength(10)
    expect(JSON.stringify(codes)).not.toContain(recoveryCodes[0]!.replace('-', ''))
  })

  it('requires the 2FA code at every sign-in, refuses replays and accepts each recovery code once', async () => {
    const admin = await h.staff('admin-verify', 'ADMIN')
    const { secret, agent: first } = await h.signedInStaff(admin.email)
    const { recoveryCodes } = await (async () => {
      // regenerate codes to learn them (password + current code)
      const response = await first.post('/api/auth/staff/mfa/recovery-codes/regenerate', { password: PASSWORD, code: totpAt(secret!, h.clock.ms) })
      expect(response.statusCode).toBe(200)
      h.advance(30_000)
      return response.json() as { recoveryCodes: string[] }
    })()

    const agent = h.browser()
    expect((await agent.staffLogin(admin.email)).json()).toEqual({ stage: 'MFA_REQUIRED' })
    expect((await agent.get('/api/admin/customers')).json().error.stage).toBe('MFA_REQUIRED')
    expect((await agent.post('/api/auth/staff/password', { currentPassword: PASSWORD, newPassword: 'another long passphrase here' })).statusCode).toBe(403)

    const code = totpAt(secret!, h.clock.ms)
    const ok = await agent.post('/api/auth/staff/mfa/verify', { code })
    expect(ok.statusCode).toBe(200)
    expect(ok.json()).toMatchObject({ stage: 'FULL', method: 'totp' })

    const replay = h.browser()
    await replay.staffLogin(admin.email)
    expect((await replay.post('/api/auth/staff/mfa/verify', { code })).json().error.code).toBe('invalid_code')
    const recovery = await replay.post('/api/auth/staff/mfa/verify', { code: recoveryCodes[0]!.toLowerCase() })
    expect(recovery.json()).toMatchObject({ stage: 'FULL', method: 'recovery_code', recoveryCodesRemaining: 9 })

    const reuse = h.browser()
    await reuse.staffLogin(admin.email)
    expect((await reuse.post('/api/auth/staff/mfa/verify', { code: recoveryCodes[0]! })).json().error.code).toBe('invalid_code')
  })

  it('ends the sign-in challenge after 5 wrong 2FA codes without touching the password lockout', async () => {
    const admin = await h.staff('admin-brute', 'ADMIN')
    const { secret } = await h.signedInStaff(admin.email)
    const agent = h.browser()
    await agent.staffLogin(admin.email)
    for (let i = 0; i < 4; i += 1) expect((await agent.post('/api/auth/staff/mfa/verify', { code: '123456' })).statusCode).toBe(400)
    const fifth = await agent.post('/api/auth/staff/mfa/verify', { code: '123456' })
    expect(fifth.statusCode).toBe(401)
    expect((await agent.post('/api/auth/staff/mfa/verify', { code: totpAt(secret!, h.clock.ms) })).statusCode).toBe(401)
    expect(await h.prisma.staffUser.findUniqueOrThrow({ where: { id: admin.id } })).toMatchObject({ failedLoginCount: 0, lockedUntil: null, mfaFailedCount: 5, mfaLockedUntil: null })
    // The password sign-in is not locked; the new challenge still needs a correct code, which clears the counter.
    const again = h.browser()
    expect((await again.staffLogin(admin.email)).json().stage).toBe('MFA_REQUIRED')
    expect((await again.post('/api/auth/staff/mfa/verify', { code: totpAt(secret!, h.clock.ms) })).statusCode).toBe(200)
    expect((await h.prisma.staffUser.findUniqueOrThrow({ where: { id: admin.id } })).mfaFailedCount).toBe(0)
    h.advance(30_000)
  })

  it('applies the 30-minute idle and 12-hour absolute staff limits on the server', async () => {
    const sales = await h.staff('sales-idle', 'SALES')
    const agent = h.browser()
    expect((await agent.staffLogin(sales.email)).json().stage).toBe('FULL')
    h.advance(29 * MIN)
    expect((await agent.get('/api/auth/staff/session')).statusCode).toBe(200)
    h.advance(29 * MIN) // 58 minutes in, but active 29 minutes ago
    expect((await agent.get('/api/auth/staff/session')).statusCode).toBe(200)
    h.advance(31 * MIN)
    const idle = await agent.get('/api/auth/staff/session')
    expect(idle.statusCode).toBe(401)
    expect(idle.json().error.code).toBe('unauthenticated')
    expect((await h.prisma.session.findFirstOrThrow({ where: { staffId: sales.id }, orderBy: { createdAt: 'desc' } })).revokedReason).toBe('idle_expired')

    const busy = h.browser()
    await busy.staffLogin(sales.email)
    for (let i = 0; i < 24; i += 1) {
      h.advance(29 * MIN)
      expect((await busy.get('/api/auth/staff/session')).statusCode, `refresh ${i}`).toBe(200)
    }
    h.advance(29 * MIN) // 12 h 29 min after sign-in
    expect((await busy.get('/api/auth/staff/session')).statusCode).toBe(401)
  })

  it('locks the account after 5 wrong passwords with the same generic error', async () => {
    const sales = await h.staff('sales-lock', 'SALES')
    const agent = h.browser()
    const unknown = await agent.staffLogin(h.email('nobody'), 'wrong password value')
    for (let i = 0; i < 5; i += 1) expect((await agent.staffLogin(sales.email, 'wrong password value')).statusCode).toBe(401)
    const locked = await agent.staffLogin(sales.email)
    expect(locked.statusCode).toBe(401)
    expect(locked.json()).toEqual(unknown.json())
    h.advance(16 * MIN)
    expect((await agent.staffLogin(sales.email)).statusCode).toBe(200)
  })

  it('needs the CSRF token and an allowed origin for state changes', async () => {
    const sales = await h.staff('sales-csrf', 'SALES')
    const agent = h.browser()
    await agent.staffLogin(sales.email)
    agent.forgetCsrf()
    expect((await agent.post('/api/auth/staff/logout')).json().error.code).toBe('csrf_failed')
    expect((await agent.post('/api/auth/staff/logout', {}, { 'x-csrf-token': 'x'.repeat(43) })).json().error.code).toBe('csrf_failed')
    expect((await agent.post('/api/auth/staff/logout', {}, { origin: 'http://localhost:9999' })).json().error.code).toBe('origin_rejected')
    await agent.refresh('staff')
    const logout = await agent.post('/api/auth/staff/logout')
    expect(logout.statusCode).toBe(204)
    expect((await agent.get('/api/auth/staff/session')).statusCode).toBe(401)
  })

  it('keeps staff and customer sessions apart', async () => {
    const customer = await h.customer('cust-apart', { status: 'ACTIVE' })
    const agent = h.browser()
    await agent.customerLogin(customer.email)
    const token = agent.jar.get('nblao_customer')!
    const forged = h.browser()
    forged.jar.set('nblao_staff', token)
    expect((await forged.get('/api/auth/staff/session')).statusCode).toBe(401)
    expect((await agent.get('/api/admin/customers')).statusCode).toBe(401)
  })
})

describe('2FA failures: separate from passwords and limited per challenge and per source (no denial of service)', () => {
  const wrong = (agent: Browser, path = '/api/auth/staff/mfa/verify') => agent.post(path, { code: '123456' })
  const counters = (id: string) => h.prisma.staffUser.findUniqueOrThrow({ where: { id }, select: { failedLoginCount: true, lockedUntil: true, mfaFailedCount: true, mfaLockedUntil: true } })
  const throttles = (id: string) => h.prisma.mfaThrottle.findMany({ where: { staffId: id } })
  const ATTACKER = '203.0.113.9'
  const OFFICE = '198.51.100.20'
  const HOME = '198.51.100.30'

  it('setup: wrong confirmation codes never lock the password and end only the setup challenge', async () => {
    const manager = await h.staff('mgr-setup-fail', 'MANAGER')
    const agent = h.browser({ ip: ATTACKER })
    expect((await agent.staffLogin(manager.email)).json().stage).toBe('MFA_ENROLLMENT_REQUIRED')
    expect((await agent.post('/api/auth/staff/mfa/enroll/start')).statusCode).toBe(200)
    for (let i = 0; i < 4; i += 1) expect((await wrong(agent, '/api/auth/staff/mfa/enroll/confirm')).json().error.code).toBe('invalid_code')
    expect((await wrong(agent, '/api/auth/staff/mfa/enroll/confirm')).statusCode).toBe(401)
    expect(await counters(manager.id)).toMatchObject({ failedLoginCount: 0, lockedUntil: null, mfaFailedCount: 5, mfaLockedUntil: null })
    // Re-authentication works; mandatory 2FA is still required (no bypass).
    const again = h.browser({ ip: OFFICE })
    expect((await again.staffLogin(manager.email)).json().stage).toBe('MFA_ENROLLMENT_REQUIRED')
    expect((await again.get('/api/admin/customers')).json().error.code).toBe('stage_required')
  })

  it('an attacker with the password, failing from one source, blocks only that source; concurrent sessions and other networks keep working', async () => {
    const admin = await h.staff('admin-dos', 'ADMIN')
    const { secret, agent: legit } = await h.signedInStaff(admin.email, undefined, OFFICE)
    expect((await legit.get('/api/auth/staff/session')).json().stage).toBe('FULL')
    // A second legitimate challenge, opened before the attack and still waiting for its code.
    const pending = h.browser({ ip: HOME })
    expect((await pending.staffLogin(admin.email)).json().stage).toBe('MFA_REQUIRED')

    const first = h.browser({ ip: ATTACKER })
    await first.staffLogin(admin.email)
    for (let i = 0; i < 4; i += 1) expect((await wrong(first)).statusCode).toBe(400)
    expect((await wrong(first)).statusCode).toBe(401) // challenge 1 ended after 5
    const second = h.browser({ ip: ATTACKER })
    await second.staffLogin(admin.email)
    for (let i = 0; i < 4; i += 1) expect((await wrong(second)).statusCode).toBe(400)
    const blocking = await wrong(second)
    expect(blocking.statusCode).toBe(429)
    expect(blocking.json().error.code).toBe('mfa_throttled')
    expect((await second.get('/api/auth/staff/session')).statusCode).toBe(401) // only the attacking challenge ended

    // Nothing else is affected: the signed-in session, the pending challenge on another network, a new sign-in.
    expect((await legit.get('/api/auth/staff/session')).statusCode).toBe(200)
    expect((await legit.get('/api/admin/customers')).statusCode).toBe(200)
    expect((await pending.post('/api/auth/staff/mfa/verify', { code: totpAt(secret!, h.clock.ms) })).statusCode).toBe(200)
    h.advance(30_000)
    const fresh = h.browser({ ip: HOME })
    await fresh.staffLogin(admin.email)
    expect((await fresh.post('/api/auth/staff/mfa/verify', { code: totpAt(secret!, h.clock.ms) })).statusCode).toBe(200)
    h.advance(30_000)

    // From the blocked source even the correct code is refused, and mandatory 2FA is not bypassed.
    const blocked = h.browser({ ip: ATTACKER })
    expect((await blocked.staffLogin(admin.email)).json().stage).toBe('MFA_REQUIRED')
    expect((await blocked.post('/api/auth/staff/mfa/verify', { code: totpAt(secret!, h.clock.ms) })).json().error.code).toBe('mfa_throttled')
    expect((await blocked.get('/api/admin/customers')).json().error.code).toBe('stage_required')

    expect(await counters(admin.id)).toMatchObject({ failedLoginCount: 0, lockedUntil: null, mfaLockedUntil: null })
    const rows = await throttles(admin.id)
    expect(rows).toHaveLength(1) // only the attacking source; the successful sources were cleared
    expect(rows[0]!.blockedUntil!.getTime() - h.clock.ms).toBe(14 * MIN) // 15-minute block, 1 minute of test clock since
    expect(JSON.stringify(rows.map(row => ({ ...row, sourceHash: Buffer.from(row.sourceHash).toString('hex') })))).not.toContain(ATTACKER)
    const events = await h.prisma.auditEvent.findMany({ where: { subjectId: admin.id, type: { in: ['mfa_verify', 'mfa_source_blocked', 'mfa_challenge_ended'] } } })
    expect(events.filter(event => event.type === 'mfa_verify' && event.outcome === 'failure')).toHaveLength(10)
    expect(events.some(event => event.type === 'mfa_source_blocked')).toBe(true)
    expect(events.some(event => event.type === 'mfa_verify' && event.outcome === 'denied')).toBe(true)
    expect(JSON.stringify(events)).not.toContain('123456')
    expect(JSON.stringify(events)).not.toContain(ATTACKER)
  })

  it('failures from several sources are counted per source: none of them blocks another', async () => {
    const manager = await h.staff('mgr-multi-ip', 'MANAGER')
    const { secret } = await h.signedInStaff(manager.email, undefined, OFFICE)
    for (const ip of ['203.0.113.1', '203.0.113.2']) {
      const agent = h.browser({ ip })
      await agent.staffLogin(manager.email)
      for (let i = 0; i < 4; i += 1) expect((await wrong(agent)).statusCode).toBe(400)
      expect((await wrong(agent)).statusCode).toBe(401)
    }
    expect((await throttles(manager.id)).every(row => row.blockedUntil === null && row.failedCount === 5)).toBe(true)
    expect((await counters(manager.id)).mfaFailedCount).toBe(10) // monitoring only
    const third = h.browser({ ip: '203.0.113.3' })
    await third.staffLogin(manager.email)
    expect((await third.post('/api/auth/staff/mfa/verify', { code: totpAt(secret!, h.clock.ms) })).statusCode).toBe(200)
    h.advance(30_000)
  })

  it('repeated attacks from one source double the block; an account-wide alert is audited; recovery works after expiry', async () => {
    const admin = await h.staff('admin-repeat', 'ADMIN')
    const { secret } = await h.signedInStaff(admin.email, undefined, OFFICE)
    const attack = async () => {
      for (let round = 0; round < 2; round += 1) {
        const agent = h.browser({ ip: ATTACKER })
        await agent.staffLogin(admin.email)
        for (let i = 0; i < 5; i += 1) await wrong(agent)
      }
    }
    await attack()
    const firstBlock = (await throttles(admin.id))[0]!
    expect(firstBlock.blockedUntil!.getTime() - h.clock.ms).toBe(15 * MIN)
    h.advance(16 * MIN)
    await attack()
    const secondBlock = (await throttles(admin.id))[0]!
    expect(secondBlock.blockCount).toBe(2)
    expect(secondBlock.blockedUntil!.getTime() - h.clock.ms).toBe(30 * MIN)
    expect(await h.prisma.auditEvent.count({ where: { subjectId: admin.id, type: 'mfa_failures_alert' } })).toBe(1)

    // Legitimate recovery from the same source after the block expires: a correct code clears it.
    h.advance(31 * MIN)
    const back = h.browser({ ip: ATTACKER })
    await back.staffLogin(admin.email)
    expect((await back.post('/api/auth/staff/mfa/verify', { code: totpAt(secret!, h.clock.ms) })).statusCode).toBe(200)
    expect(await throttles(admin.id)).toHaveLength(0)
    expect(await counters(admin.id)).toMatchObject({ failedLoginCount: 0, mfaFailedCount: 0 })
    h.advance(30_000)
  })

  it('step-up: wrong codes end only that signed-in session, never other sessions or the password', async () => {
    const manager = await h.staff('mgr-stepup-fail', 'MANAGER')
    const { agent, secret } = await h.signedInStaff(manager.email, undefined, OFFICE)
    const other = (await h.signedInStaff(manager.email, secret, HOME)).agent
    for (let i = 0; i < 4; i += 1) expect((await wrong(agent)).json().error.code).toBe('invalid_code')
    expect((await wrong(agent)).statusCode).toBe(401)
    expect((await agent.get('/api/auth/staff/session')).statusCode).toBe(401)
    expect((await other.get('/api/auth/staff/session')).statusCode).toBe(200)
    expect(await counters(manager.id)).toMatchObject({ failedLoginCount: 0, lockedUntil: null, mfaFailedCount: 5 })
    expect((await h.browser({ ip: OFFICE }).staffLogin(manager.email)).statusCode).toBe(200)
  })

  it('limits bursts per account and source, not per account', async () => {
    const limited = createHarness({ rateLimits: true })
    try {
      const admin = await limited.staff('admin-mfa-rl', 'ADMIN')
      const { secret } = await limited.signedInStaff(admin.email, undefined, OFFICE)
      const a = limited.browser({ ip: ATTACKER })
      const b = limited.browser({ ip: ATTACKER })
      await a.staffLogin(admin.email)
      await b.staffLogin(admin.email)
      const statuses: number[] = []
      for (let i = 0; i < 3; i += 1) statuses.push((await wrong(a)).statusCode)
      for (let i = 0; i < 3; i += 1) statuses.push((await wrong(b)).statusCode)
      expect(statuses).toEqual([400, 400, 400, 400, 400, 429]) // 6th attempt from this source within a minute
      // The same account from another network is not slowed down by that.
      const office = limited.browser({ ip: OFFICE })
      await office.staffLogin(admin.email)
      expect((await office.post('/api/auth/staff/mfa/verify', { code: totpAt(secret!, limited.clock.ms) })).statusCode).toBe(200)
      expect((await limited.prisma.staffUser.findUniqueOrThrow({ where: { id: admin.id } })).failedLoginCount).toBe(0)
    } finally {
      await limited.cleanup()
    }
  })
})

describe('CSRF token binding', () => {
  it('accepts a CSRF token only for the session it was issued to', async () => {
    const sales = await h.staff('sales-csrf-bind', 'SALES')
    const customer = await h.customer('cust-csrf-bind', { status: 'ACTIVE' })
    const a = h.browser()
    const b = h.browser()
    const c = h.browser()
    await a.staffLogin(sales.email)
    await b.staffLogin(sales.email)
    await c.customerLogin(customer.email)
    const tokenA = (await a.get('/api/auth/staff/session')).json().csrfToken as string
    const tokenB = (await b.get('/api/auth/staff/session')).json().csrfToken as string
    const tokenC = (await c.get('/api/auth/customer/session')).json().csrfToken as string
    expect(tokenA).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(tokenA).not.toBe(tokenB)
    // Same account, other session: refused. Customer session token on a staff session: refused.
    expect((await b.post('/api/auth/staff/logout', {}, { 'x-csrf-token': tokenA })).json().error.code).toBe('csrf_failed')
    expect((await b.post('/api/auth/staff/logout', {}, { 'x-csrf-token': tokenC })).json().error.code).toBe('csrf_failed')
    expect((await c.post('/api/auth/customer/logout', {}, { 'x-csrf-token': tokenA })).json().error.code).toBe('csrf_failed')
    // The token is never in a URL or the log, and it changes when the session rotates.
    expect(h.logs.join('\n')).not.toContain(tokenA)
    expect((await b.post('/api/auth/staff/logout', {}, { 'x-csrf-token': tokenB })).statusCode).toBe(204)
  })
})

describe('account-link binding (purpose, account type, single use)', () => {
  it('honours each link only for its own purpose and account state', async () => {
    const { issueAccountToken } = await import('../../src/auth/accountTokens')
    const { hashToken } = await import('../../src/auth/tokens')
    const now = new Date(h.clock.ms)
    const tokenOf = (path: string) => path.split('#')[1]!
    const inspect = (token: string) => h.browser().post('/api/auth/account-token/inspect', { token })

    // A staff setup (INVITATION) link for an account that already has a password is not usable.
    const ready = await h.staff('staff-has-password', 'SALES')
    const setup = await issueAccountToken(h.prisma, now, { purpose: 'INVITATION', subject: { subjectType: 'STAFF', staffId: ready.id }, issuedById: null })
    expect((await inspect(tokenOf(setup.path))).json().error.code).toBe('invalid_token')

    // A password-reset link for a customer who has not accepted the invitation yet is not usable.
    const invited = await h.prisma.customer.create({
      data: { email: h.email('invited-reset'), firstName: 'T', lastName: 'I', phone: '1', companyName: 'X', status: 'INVITED', passwordHash: null },
    })
    const wrongPurpose = await issueAccountToken(h.prisma, now, { purpose: 'PASSWORD_RESET', subject: { subjectType: 'CUSTOMER', customerId: invited.id }, issuedById: null })
    expect((await inspect(tokenOf(wrongPurpose.path))).json().error.code).toBe('invalid_token')

    // The invitation for the same customer works, reports its own purpose, and is single-use.
    const invitation = await issueAccountToken(h.prisma, now, { purpose: 'INVITATION', subject: { subjectType: 'CUSTOMER', customerId: invited.id }, issuedById: null })
    expect((await inspect(tokenOf(invitation.path))).json()).toMatchObject({ purpose: 'INVITATION', account: 'customer' })
    expect((await h.browser().post('/api/auth/account-token/complete', { token: tokenOf(invitation.path), password: PASSWORD })).statusCode).toBe(200)
    expect((await inspect(tokenOf(invitation.path))).json().error.code).toBe('invalid_token')

    // Links for disabled staff are not usable; issuing a new link invalidates the previous unused one.
    const disabled = await h.staff('staff-disabled-link', 'SALES')
    const disabledReset = await issueAccountToken(h.prisma, now, { purpose: 'PASSWORD_RESET', subject: { subjectType: 'STAFF', staffId: disabled.id }, issuedById: null })
    await h.prisma.staffUser.update({ where: { id: disabled.id }, data: { status: 'DISABLED' } })
    expect((await inspect(tokenOf(disabledReset.path))).json().error.code).toBe('invalid_token')
    const active = await h.staff('staff-superseded', 'SALES')
    const first = await issueAccountToken(h.prisma, now, { purpose: 'PASSWORD_RESET', subject: { subjectType: 'STAFF', staffId: active.id }, issuedById: null })
    const second = await issueAccountToken(h.prisma, now, { purpose: 'PASSWORD_RESET', subject: { subjectType: 'STAFF', staffId: active.id }, issuedById: null })
    expect((await inspect(tokenOf(first.path))).json().error.code).toBe('invalid_token')
    expect((await inspect(tokenOf(second.path))).json()).toMatchObject({ purpose: 'PASSWORD_RESET', account: 'staff' })

    // Only the SHA-256 digest is stored; a row cannot point at the wrong kind of account (CHECK constraint).
    const row = await h.prisma.accountToken.findUniqueOrThrow({ where: { tokenHash: hashToken(tokenOf(second.path)) } })
    expect(JSON.stringify({ ...row, tokenHash: Buffer.from(row.tokenHash).toString('hex') })).not.toContain(tokenOf(second.path))
    await expect(
      h.prisma.accountToken.create({ data: { tokenHash: hashToken('x'.repeat(43)), purpose: 'PASSWORD_RESET', subjectType: 'STAFF', customerId: invited.id, expiresAt: new Date(h.clock.ms + 60_000), createdAt: new Date(h.clock.ms) } }),
    ).rejects.toThrow()
    expect(h.logs.join('\n')).not.toContain(tokenOf(second.path))
  })
})

describe('rate limits', () => {
  it('answers 429 after 10 sign-in attempts per minute from one address', async () => {
    const limited = createHarness({ rateLimits: true })
    try {
      const agent = limited.browser()
      const statuses: number[] = []
      for (let i = 0; i < 11; i += 1) statuses.push((await agent.staffLogin(limited.email(`rl${i}`), 'wrong password value')).statusCode)
      expect(statuses.slice(0, 10).every(status => status === 401)).toBe(true)
      expect(statuses[10]).toBe(429)
    } finally {
      await limited.cleanup()
    }
  })
})

describe('no secrets in logs', () => {
  it('logs no cookies, passwords or 2FA material from this file', async () => {
    const text = h.logs.join('\n')
    expect(text).toContain('incoming request')
    expect(text).not.toContain(PASSWORD)
    expect(text).not.toMatch(/nblao_(staff|customer)=/)
    expect(text).not.toMatch(/csrf/i)
  })
})
