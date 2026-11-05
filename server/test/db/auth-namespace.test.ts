import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { CliRefusal, createFirstSuperAdmin } from '../../src/auth/cli'
import { PRIVILEGED_EMAIL_SUFFIX, roleMatchesNamespace } from '../../src/auth/privilegedNamespace'
import { STAFF_ROLES } from '../../src/auth/roles'
import { createHarness, PASSWORD, removeStaleFixtures } from './authHarness'

const h = createHarness()

beforeAll(async () => {
  await removeStaleFixtures(h.prisma, h.run)
})
afterAll(() => h.cleanup())

describe('app validation and the PostgreSQL CHECK constraint agree', () => {
  it('accept and refuse exactly the same role/email combinations', async () => {
    const r = h.run
    const emails = [
      `${r}-a${PRIVILEGED_EMAIL_SUFFIX}`,
      `${r}-b+admin${PRIVILEGED_EMAIL_SUFFIX}`,
      `${r}-c@sub.admin.nblao.invalid`,
      `${r}-d@xadmin.nblao.invalid`,
      `${r}-e@admin-nblao.invalid`,
      `${r}-f@admin.nblao.invalidx`,
      `${r}-g${PRIVILEGED_EMAIL_SUFFIX}.example.test`,
      `${r}-h@example.test`,
      `${r}-i@nblao.invalid`,
      PRIVILEGED_EMAIL_SUFFIX, // no local part
    ]
    const mismatches: string[] = []
    let checked = 0
    for (const email of emails) {
      for (const role of STAFF_ROLES) {
        let accepted = false
        try {
          const row = await h.prisma.staffUser.create({ data: { email, displayName: 'Parity', role } })
          accepted = true
          await h.prisma.staffUser.delete({ where: { id: row.id } })
        } catch {
          accepted = false
        }
        checked += 1
        if (accepted !== roleMatchesNamespace(role, email)) mismatches.push(`${role} ${email}: database ${accepted ? 'accepted' : 'refused'}`)
      }
    }
    expect(checked).toBe(emails.length * STAFF_ROLES.length)
    expect(mismatches).toEqual([])
  })

  it('refuses a role change that would break the rule, also in the database directly', async () => {
    const manager = await h.staff('ns-manager', 'MANAGER')
    const admin = await h.staff('ns-admin', 'ADMIN')
    await expect(h.prisma.staffUser.update({ where: { id: manager.id }, data: { role: 'ADMIN' } })).rejects.toThrow()
    await expect(h.prisma.staffUser.update({ where: { id: admin.id }, data: { role: 'SALES' } })).rejects.toThrow()
    await expect(h.prisma.staffUser.update({ where: { id: admin.id }, data: { role: 'SUPER_ADMIN' } })).resolves.toMatchObject({ role: 'SUPER_ADMIN' })
    await h.prisma.staffUser.update({ where: { id: admin.id }, data: { role: 'ADMIN' } })
  })
})

describe('first Super Admin (CLI)', () => {
  it('must use the reserved namespace, and is refused once any Super Admin exists', async () => {
    const outside = createFirstSuperAdmin(h.prisma, h.hasher, { email: h.email('first-sa'), displayName: 'First SA', password: PASSWORD }, new Date(h.clock.ms))
    await expect(outside).rejects.toThrow(CliRefusal)
    await expect(outside).rejects.toThrow(PRIVILEGED_EMAIL_SUFFIX)

    const existingSuperAdmins = await h.prisma.staffUser.count({ where: { role: 'SUPER_ADMIN' } })
    if (existingSuperAdmins === 0) {
      const created = await createFirstSuperAdmin(h.prisma, h.hasher, { email: h.staffEmail('first-sa', 'SUPER_ADMIN'), displayName: 'First SA', password: PASSWORD }, new Date(h.clock.ms))
      expect(created.email.endsWith(PRIVILEGED_EMAIL_SUFFIX)).toBe(true)
      expect(await h.prisma.staffUser.findUniqueOrThrow({ where: { id: created.id } })).toMatchObject({ role: 'SUPER_ADMIN', mustChangePassword: true })
    }
    await expect(
      createFirstSuperAdmin(h.prisma, h.hasher, { email: h.staffEmail('second-sa', 'SUPER_ADMIN'), displayName: 'Second SA', password: PASSWORD }, new Date(h.clock.ms)),
    ).rejects.toThrow(/already exists/)
    expect(existingSuperAdmins, 'nblao_test should have no Super Admin outside fixtures, so the success path above ran').toBe(0)
  })
})
