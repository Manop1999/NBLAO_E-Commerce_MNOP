import { describe, expect, it } from 'vitest'
import { AttemptLimiter, lockoutDurationMs, recordFailure } from '../../src/auth/lockout'
import { MFA_SOURCE_THRESHOLD, MFA_SOURCE_WINDOW_MS, sourceBlockDurationMs, sourceHash } from '../../src/auth/mfaThrottle'
import { checkPasswordPolicy, DEFAULT_HASH_PARAMETERS, PasswordHasher } from '../../src/auth/password'
import { PERMISSION_CODES, type PermissionCode } from '../../src/auth/permissions'
import {
  auditScope,
  customerScope,
  isCustomerInScope,
  MFA_MANDATORY_ROLES,
  permissionsFor,
  ROLE_PERMISSIONS,
  staffManagementRefusal,
  staffVisibilityScope,
  STAFF_ROLES,
  type StaffActor,
} from '../../src/auth/roles'
import { CUSTOMER_REMEMBERED_SESSION, CUSTOMER_SESSION, sessionPolicy, STAFF_SESSION } from '../../src/auth/sessions'
import { nextStaffStage } from '../../src/auth/staffAuth'

const MIN = 60_000
const HOUR = 60 * MIN
const DAY = 24 * HOUR

describe('password policy', () => {
  it('accepts long passphrases without composition rules', () => {
    expect(checkPasswordPolicy('correct horse battery staple', 'sa@example.test')).toEqual([])
    expect(checkPasswordPolicy('ຂ້ອຍມັກກາເຟລາວຫຼາຍໆ', 'sa@example.test')).toEqual([])
  })

  it('refuses short, overlong, email-based and common passwords', () => {
    expect(checkPasswordPolicy('short-pass1')).toContain('too_short')
    expect(checkPasswordPolicy('x'.repeat(129) + 'y')).toContain('too_long')
    expect(checkPasswordPolicy('my sa.manager@example.test pw', 'sa.manager@example.test')).toContain('contains_email')
    expect(checkPasswordPolicy('xxSA.MANAGERyy-long', 'sa.manager@example.test')).toContain('contains_email')
    expect(checkPasswordPolicy('Password1234')).toContain('too_common')
    expect(checkPasswordPolicy('aaaaaaaaaaaaaaa')).toContain('too_common')
  })

  it('hashes with Argon2id at the OWASP parameters and detects outdated hashes', async () => {
    expect(DEFAULT_HASH_PARAMETERS).toEqual({ memoryCost: 19_456, timeCost: 2, parallelism: 1 })
    const fast = new PasswordHasher({ memoryCost: 1024, timeCost: 1, parallelism: 1 })
    const hash = await fast.hash('correct horse battery staple')
    expect(hash).toMatch(/^\$argon2id\$v=19\$m=1024,t=1,p=1\$/)
    expect(await fast.verify(hash, 'correct horse battery staple')).toBe(true)
    expect(await fast.verify(hash, 'correct horse battery stapler')).toBe(false)
    expect(await fast.verify('not-a-hash', 'anything')).toBe(false)
    expect(fast.needsRehash(hash)).toBe(false)
    expect(new PasswordHasher().needsRehash(hash)).toBe(true)
    expect(await fast.verifyDummy('anything')).toBe(false)
  })
})

describe('lockout and attempt limits', () => {
  it('locks after 5 failures for 15 minutes, doubling up to 24 hours', () => {
    expect([1, 2, 3, 4].map(count => lockoutDurationMs(count))).toEqual([0, 0, 0, 0])
    expect(lockoutDurationMs(5)).toBe(15 * MIN)
    expect(lockoutDurationMs(6)).toBe(30 * MIN)
    expect(lockoutDurationMs(7)).toBe(60 * MIN)
    expect(lockoutDurationMs(12)).toBe(24 * HOUR)
    expect(lockoutDurationMs(100)).toBe(24 * HOUR)
    const now = new Date(0)
    expect(recordFailure({ failedLoginCount: 3 }, now)).toEqual({ failedLoginCount: 4, lockedUntil: null })
    expect(recordFailure({ failedLoginCount: 4 }, now)).toEqual({ failedLoginCount: 5, lockedUntil: new Date(15 * MIN) })
  })

  it('blocks a 2FA source for 15 minutes, doubling per repeat up to 24 hours, and never stores the address', () => {
    expect(MFA_SOURCE_THRESHOLD).toBe(10)
    expect(MFA_SOURCE_WINDOW_MS).toBe(15 * MIN)
    expect([0, 1, 2, 3].map(blocks => sourceBlockDurationMs(blocks))).toEqual([15 * MIN, 30 * MIN, 60 * MIN, 120 * MIN])
    expect(sourceBlockDurationMs(30)).toBe(24 * HOUR)
    const hash = sourceHash('203.0.113.7')
    expect(hash).toHaveLength(32)
    expect(Buffer.from(hash).toString('latin1')).not.toContain('203.0.113.7')
    expect(Buffer.from(sourceHash('203.0.113.7')).equals(Buffer.from(hash))).toBe(true)
    expect(Buffer.from(sourceHash('203.0.113.8')).equals(Buffer.from(hash))).toBe(false)
  })

  it('limits attempts per key within a sliding window', () => {
    const limiter = new AttemptLimiter(3, 1000)
    expect([0, 1, 2, 3].map(t => limiter.take('a', t))).toEqual([true, true, true, false])
    expect(limiter.take('b', 3)).toBe(true)
    expect(limiter.take('a', 1001)).toBe(true)
  })
})

describe('session policies (plan §4)', () => {
  it('uses the decided idle and absolute limits', () => {
    expect(STAFF_SESSION).toMatchObject({ idleMs: 30 * MIN, absoluteMs: 12 * HOUR, cookieMaxAgeSeconds: undefined })
    expect(CUSTOMER_SESSION).toMatchObject({ idleMs: 2 * HOUR, absoluteMs: 12 * HOUR, cookieMaxAgeSeconds: undefined })
    expect(CUSTOMER_REMEMBERED_SESSION).toMatchObject({ idleMs: 7 * DAY, absoluteMs: 30 * DAY, cookieMaxAgeSeconds: 30 * 24 * 3600 })
    expect(sessionPolicy('STAFF', true)).toBe(STAFF_SESSION)
    expect(sessionPolicy('CUSTOMER', false)).toBe(CUSTOMER_SESSION)
    expect(sessionPolicy('CUSTOMER', true)).toBe(CUSTOMER_REMEMBERED_SESSION)
  })

  it('orders staff stages: 2FA verification, password change, forced enrolment, full', () => {
    const enrolled = { enabledAt: new Date() }
    expect(nextStaffStage({ role: 'ADMIN', mustChangePassword: true, mfa: enrolled }, false)).toBe('MFA_REQUIRED')
    expect(nextStaffStage({ role: 'ADMIN', mustChangePassword: true, mfa: enrolled }, true)).toBe('PASSWORD_CHANGE_REQUIRED')
    expect(nextStaffStage({ role: 'SUPER_ADMIN', mustChangePassword: true, mfa: null }, false)).toBe('PASSWORD_CHANGE_REQUIRED')
    expect(nextStaffStage({ role: 'MANAGER', mustChangePassword: false, mfa: null }, false)).toBe('MFA_ENROLLMENT_REQUIRED')
    expect(nextStaffStage({ role: 'SALES', mustChangePassword: false, mfa: null }, false)).toBe('FULL')
    expect(nextStaffStage({ role: 'WAREHOUSE', mustChangePassword: false, mfa: enrolled }, false)).toBe('MFA_REQUIRED')
  })
})

describe('role map (D12)', () => {
  const holders = (code: PermissionCode) => STAFF_ROLES.filter(role => ROLE_PERMISSIONS[role].has(code))

  it('grants the account-management permissions exactly as decided', () => {
    expect(holders('customers.view')).toEqual(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'SALES'])
    for (const code of ['customers.approve', 'customers.invite', 'customers.assign', 'customers.reset_password', 'audit.view'] as const) {
      expect(holders(code), code).toEqual(['SUPER_ADMIN', 'ADMIN', 'MANAGER'])
    }
    for (const code of ['customers.export', 'customers.export_contact', 'addresses.export', 'payments.refund', 'audit.view_security', 'staff.manage', 'teams.manage', 'roles.assign'] as const) {
      expect(holders(code), code).toEqual(['SUPER_ADMIN', 'ADMIN'])
    }
    for (const code of ['staff.reset_password', 'staff.mfa_reset', 'audit.export', 'permissions.manage', 'settings.write'] as const) {
      expect(holders(code), code).toEqual(['SUPER_ADMIN'])
    }
  })

  it('gives Super Admin everything, uses only known codes, and grants unknown roles nothing', () => {
    expect([...ROLE_PERMISSIONS.SUPER_ADMIN].sort()).toEqual([...PERMISSION_CODES].sort())
    for (const role of STAFF_ROLES) for (const code of ROLE_PERMISSIONS[role]) expect(PERMISSION_CODES).toContain(code)
    expect(permissionsFor('CUSTOMER').size).toBe(0)
    expect(permissionsFor('super_admin').size).toBe(0)
    expect(ROLE_PERMISSIONS.WAREHOUSE.has('customers.view')).toBe(false)
  })

  it('requires 2FA for Super Admin, Admin and Manager only', () => {
    expect([...MFA_MANDATORY_ROLES].sort()).toEqual(['ADMIN', 'MANAGER', 'SUPER_ADMIN'])
  })
})

describe('data scopes', () => {
  const actor = (role: StaffActor['role'], teamId: string | null = null): StaffActor => ({ id: 'me', role, teamId })
  const unassigned = { teamId: null, assignedStaffId: null }

  it('builds the customer query scope per role', () => {
    expect(customerScope(actor('SUPER_ADMIN'))).toEqual({})
    expect(customerScope(actor('ADMIN'))).toEqual({})
    expect(customerScope(actor('MANAGER', 't1'))).toEqual({ OR: [{ teamId: 't1' }, unassigned] })
    expect(customerScope(actor('MANAGER'))).toEqual(unassigned)
    expect(customerScope(actor('SALES', 't1'))).toEqual({ assignedStaffId: 'me' })
    expect(customerScope(actor('WAREHOUSE'))).toBeNull()
  })

  it('never lets Sales see unassigned or other customers; Managers see their team plus unassigned', () => {
    expect(isCustomerInScope(actor('SALES', 't1'), unassigned)).toBe(false)
    expect(isCustomerInScope(actor('SALES', 't1'), { teamId: 't1', assignedStaffId: 'other' })).toBe(false)
    expect(isCustomerInScope(actor('SALES', 't1'), { teamId: 't1', assignedStaffId: 'me' })).toBe(true)
    expect(isCustomerInScope(actor('MANAGER', 't1'), unassigned)).toBe(true)
    expect(isCustomerInScope(actor('MANAGER', 't1'), { teamId: 't1', assignedStaffId: 'x' })).toBe(true)
    expect(isCustomerInScope(actor('MANAGER', 't1'), { teamId: 't2', assignedStaffId: null })).toBe(false)
    expect(isCustomerInScope(actor('MANAGER'), { teamId: null, assignedStaffId: 'x' })).toBe(false)
    expect(isCustomerInScope(actor('WAREHOUSE'), unassigned)).toBe(false)
  })

  it('limits Managers to operational events of their team; security events need audit.view_security', () => {
    expect(auditScope(actor('SUPER_ADMIN'))).toEqual({})
    expect(auditScope(actor('ADMIN'))).toEqual({})
    expect(auditScope(actor('MANAGER', 't1'))).toEqual({ category: 'OPERATIONAL', OR: [{ teamId: 't1' }, { teamId: null }] })
    expect(auditScope(actor('MANAGER'))).toEqual({ category: 'OPERATIONAL', OR: [{ teamId: null }] })
    expect(auditScope(actor('SALES'))).toBeNull()
    expect(auditScope(actor('WAREHOUSE'))).toBeNull()
  })
})

describe('staff management rules (D-STAFF)', () => {
  const admin: StaffActor = { id: 'admin', role: 'ADMIN', teamId: null }
  const sa: StaffActor = { id: 'sa', role: 'SUPER_ADMIN', teamId: null }

  it('lets Admin manage only Manager, Sales and Warehouse accounts', () => {
    for (const role of ['MANAGER', 'SALES', 'WAREHOUSE'] as const) {
      expect(staffManagementRefusal(admin, null, { role })).toBeNull()
      expect(staffManagementRefusal(admin, { id: 'x', role }, { status: 'DISABLED' })).toBeNull()
    }
    for (const role of ['ADMIN', 'SUPER_ADMIN'] as const) {
      expect(staffManagementRefusal(admin, null, { role })).toBe('forbidden')
      expect(staffManagementRefusal(admin, { id: 'x', role }, { status: 'DISABLED' })).toBe('forbidden')
      expect(staffManagementRefusal(admin, { id: 'x', role: 'SALES' }, { role })).toBe('forbidden')
    }
  })

  it('filters which staff accounts each role may list or inspect', () => {
    expect(staffVisibilityScope(sa)).toEqual({})
    expect(staffVisibilityScope(admin)).toEqual({ role: { in: ['MANAGER', 'SALES', 'WAREHOUSE'] } })
    for (const role of ['MANAGER', 'SALES', 'WAREHOUSE'] as const) expect(staffVisibilityScope({ id: 'x', role, teamId: 't' })).toBeNull()
  })

  it('lets Super Admin manage every account but nobody change their own role or status', () => {
    expect(staffManagementRefusal(sa, { id: 'x', role: 'ADMIN' }, { role: 'SUPER_ADMIN' })).toBeNull()
    expect(staffManagementRefusal(sa, { id: 'sa', role: 'SUPER_ADMIN' }, { role: 'ADMIN' })).toBe('self_change')
    expect(staffManagementRefusal(admin, { id: 'admin', role: 'ADMIN' }, { status: 'DISABLED' })).toBe('self_change')
    expect(staffManagementRefusal({ id: 'm', role: 'MANAGER', teamId: 't' }, null, { role: 'SALES' })).toBe('forbidden')
  })
})
