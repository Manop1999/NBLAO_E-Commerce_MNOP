import { describe, expect, it } from 'vitest'
import { can, isPermissionCode, PERMISSION_CODES } from '../../src/auth/permissions'

describe('permissions: deny by default', () => {
  it('denies every known code when there are no grants', () => {
    for (const code of PERMISSION_CODES) {
      expect(can(undefined, code)).toBe(false)
      expect(can(null, code)).toBe(false)
      expect(can([], code)).toBe(false)
      expect(can(new Set<string>(), code)).toBe(false)
    }
  })

  it('grants nothing implicitly: holding one permission never implies another', () => {
    for (const held of PERMISSION_CODES) {
      for (const code of PERMISSION_CODES) {
        expect(can([held], code)).toBe(held === code)
      }
    }
  })
})

describe('permissions: exact matching', () => {
  it('allows only exact, known grants from any iterable', () => {
    expect(can(['payments.record'], 'payments.record')).toBe(true)
    expect(can(['payments.record'], 'payments.verify')).toBe(false)
    expect(can(new Set(['catalog.view', 'catalog.export']), 'catalog.export')).toBe(true)
    expect(can(['catalog.view'].values(), 'catalog.view')).toBe(true)
  })

  it('treats wildcard-looking, differently-cased or padded grants as nothing', () => {
    for (const grant of ['*', 'payments.*', 'payments', '*.verify', 'PAYMENTS.VERIFY', ' payments.verify', 'payments.verify ']) {
      expect(can([grant], 'payments.verify')).toBe(false)
    }
  })

  it('denies unknown permission codes even if they are granted', () => {
    expect(isPermissionCode('superuser.everything')).toBe(false)
    expect(can(['superuser.everything'], 'superuser.everything')).toBe(false)
    expect(can([''], '')).toBe(false)
  })
})

describe('permissions: catalog integrity', () => {
  it('has unique, lower-case dotted codes', () => {
    expect(new Set(PERMISSION_CODES).size).toBe(PERMISSION_CODES.length)
    for (const code of PERMISSION_CODES) expect(code).toMatch(/^[a-z]+\.[a-z_]+$/)
  })

  it('keeps sensitive operations as separate codes (separation of duties stays possible)', () => {
    for (const code of [
      'payments.record',
      'payments.verify',
      'payments.refund',
      'roles.assign',
      'permissions.manage',
      'prices.edit',
      'prices.import',
      'inventory.adjust',
      'inventory.import',
      'customers.export',
      'customers.export_contact',
      'orders.export_customer_data',
      'audit.export',
      'import.start',
      'import.confirm',
    ]) {
      expect(isPermissionCode(code)).toBe(true)
    }
  })
})
