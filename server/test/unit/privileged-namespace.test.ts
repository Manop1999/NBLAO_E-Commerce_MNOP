import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  assertNamespaceAllowed,
  isPrivilegedEmail,
  PRIVILEGED_EMAIL_DOMAIN,
  PRIVILEGED_EMAIL_SUFFIX,
  PRIVILEGED_NAMESPACE_IS_TEMPORARY,
  roleMatchesNamespace,
  TemporaryNamespaceInProductionError,
} from '../../src/auth/privilegedNamespace'
import { ConfigError, loadConfig } from '../../src/config'

const SERVER_DIR = path.resolve(import.meta.dirname, '../..')
const MIGRATION = path.join(SERVER_DIR, 'prisma/migrations/20261104000400_privileged_email_namespace/migration.sql')

describe('privileged email namespace rule', () => {
  it('is the temporary, never-deliverable .invalid placeholder for Phase 1E', () => {
    expect(PRIVILEGED_EMAIL_DOMAIN).toBe('admin.nblao.invalid')
    expect(PRIVILEGED_EMAIL_SUFFIX).toBe('@admin.nblao.invalid')
    expect(PRIVILEGED_NAMESPACE_IS_TEMPORARY).toBe(true)
  })

  it('accepts exactly "<at least one character>@admin.nblao.invalid" after normalising', () => {
    for (const email of ['superadmin@admin.nblao.invalid', 'admin@admin.nblao.invalid', ' Admin@ADMIN.NBLAO.INVALID ', 'a+admin@admin.nblao.invalid', 'x@admin.nblao.invalid']) {
      expect(isPrivilegedEmail(email), email).toBe(true)
    }
    for (const email of ['@admin.nblao.invalid', 'admin@admin.nblao.invalid.example.test', 'admin@sub.admin.nblao.invalid', 'admin@xadmin.nblao.invalid', 'admin@admin-nblao.invalid', 'admin@admin.nblao.invalidx', 'sales@example.test', 'admin@nblao.invalid', 'admin+admin@example.test']) {
      expect(isPrivilegedEmail(email), email).toBe(false)
    }
  })

  it('ties Super Admin and Admin to the namespace and everyone else to outside it ("if and only if")', () => {
    for (const role of ['SUPER_ADMIN', 'ADMIN']) {
      expect(roleMatchesNamespace(role, 'a@admin.nblao.invalid')).toBe(true)
      expect(roleMatchesNamespace(role, 'a@example.test')).toBe(false)
    }
    for (const role of ['MANAGER', 'SALES', 'WAREHOUSE']) {
      expect(roleMatchesNamespace(role, 'a@admin.nblao.invalid')).toBe(false)
      expect(roleMatchesNamespace(role, 'a@example.test')).toBe(true)
    }
  })

  it('uses the same suffix and roles in the PostgreSQL CHECK constraint as in the code', () => {
    const sql = readFileSync(MIGRATION, 'utf8')
    expect(sql).toContain(`CHECK (("role" IN ('SUPER_ADMIN', 'ADMIN')) = ("email" LIKE '_%${PRIVILEGED_EMAIL_SUFFIX}'));`)
    // LIKE wildcards must not appear inside the suffix itself, so LIKE and endsWith() mean the same thing.
    expect(PRIVILEGED_EMAIL_SUFFIX).not.toMatch(/[%_\\]/)
  })
})

describe('production guard for the temporary namespace', () => {
  it('refuses NODE_ENV=production (any letter case) and allows development and test', () => {
    for (const env of ['production', 'Production', ' PRODUCTION ']) expect(() => assertNamespaceAllowed(env)).toThrow(TemporaryNamespaceInProductionError)
    for (const env of ['development', 'test', undefined]) expect(() => assertNamespaceAllowed(env)).not.toThrow()
  })

  it('stops the server configuration with a clear reason before anything starts', () => {
    const env = { NODE_ENV: 'production', DATABASE_URL: 'postgresql://u:p@127.0.0.1:5432/nblao_dev', TOTP_ENCRYPTION_KEY: Buffer.alloc(32, 1).toString('base64') }
    let error: unknown
    try {
      loadConfig(env)
    } catch (caught) {
      error = caught
    }
    expect(error).toBeInstanceOf(ConfigError)
    expect((error as ConfigError).message).toMatch(/temporary local-development placeholder.*Phase 1H/)
  })
})

describe('no email is ever sent (local one-time links only)', () => {
  const sourceFiles = (dir: string): string[] =>
    readdirSync(dir).flatMap(name => {
      const full = path.join(dir, name)
      if (name === 'generated' || name === 'node_modules') return []
      return statSync(full).isDirectory() ? sourceFiles(full) : full.endsWith('.ts') ? [full] : []
    })

  it('has no mail library and no mail-sending code', () => {
    const pkg = JSON.parse(readFileSync(path.join(SERVER_DIR, 'package.json'), 'utf8')) as { dependencies: Record<string, string>; devDependencies: Record<string, string> }
    const deps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies })
    expect(deps.filter(name => /mail|smtp|sendgrid|postmark|ses|resend/i.test(name))).toEqual([])
    for (const file of [...sourceFiles(path.join(SERVER_DIR, 'src')), ...sourceFiles(path.join(SERVER_DIR, 'scripts'))]) {
      expect(readFileSync(file, 'utf8'), file).not.toMatch(/sendMail|createTransport|smtp:\/\/|nodemailer/i)
    }
  })
})
