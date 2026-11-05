/**
 * Reserved email namespace for privileged staff accounts (Super Admin, Admin).
 *
 * Why: an Admin must not be able to find out whether an email belongs to a Super Admin or Admin. With a reserved
 * namespace, every address in it is refused for Admins by a fixed rule *before any database lookup* (same answer
 * whether or not the account exists), and every address outside it can only collide with a Manager, Sales or
 * Warehouse account the Admin can already see.
 *
 * The rule ("if and only if"): a staff account has the role SUPER_ADMIN or ADMIN exactly when its normalised
 * (trimmed, lower-case) email has at least one character followed by PRIVILEGED_EMAIL_SUFFIX. The PostgreSQL CHECK
 * constraint `staff_users_privileged_namespace` (migration 20261104000400_privileged_email_namespace) enforces the
 * identical rule as `email LIKE '_%@admin.nblao.invalid'`; tests prove both agree.
 *
 * TEMPORARY: `.invalid` is reserved by RFC 2606 and can never receive mail. It is only for Phase 1E local
 * development; no email is ever sent (accounts use one-time setup/reset links shown to the operator). Phase 1H
 * must replace it with a verified domain owned and controlled by NB LAO, through a planned migration and an
 * account verification process. The server refuses to start in production with this namespace.
 */
import { normalizeEmail } from './context.ts'
import type { StaffRoleName } from './roles.ts'

export const PRIVILEGED_EMAIL_DOMAIN = 'admin.nblao.invalid'
export const PRIVILEGED_EMAIL_SUFFIX = `@${PRIVILEGED_EMAIL_DOMAIN}`
/** True while the namespace is the local-only placeholder that must be replaced before production. */
export const PRIVILEGED_NAMESPACE_IS_TEMPORARY = PRIVILEGED_EMAIL_DOMAIN.endsWith('.invalid')

const PRIVILEGED_ROLES: ReadonlySet<string> = new Set(['SUPER_ADMIN', 'ADMIN'])

/** Is this (raw or normalised) email inside the reserved privileged namespace? Same rule as the CHECK constraint. */
export function isPrivilegedEmail(email: string): boolean {
  const normalized = normalizeEmail(email)
  return normalized.length > PRIVILEGED_EMAIL_SUFFIX.length && normalized.endsWith(PRIVILEGED_EMAIL_SUFFIX)
}

export function isPrivilegedRole(role: string): role is Extract<StaffRoleName, 'SUPER_ADMIN' | 'ADMIN'> {
  return PRIVILEGED_ROLES.has(role)
}

/** Does this role/email pair satisfy the namespace rule (the CHECK constraint)? */
export function roleMatchesNamespace(role: string, email: string): boolean {
  return isPrivilegedRole(role) === isPrivilegedEmail(email)
}

export class TemporaryNamespaceInProductionError extends Error {
  constructor() {
    super(
      `The privileged staff email namespace "${PRIVILEGED_EMAIL_SUFFIX}" is a temporary local-development placeholder and cannot be used in production. ` +
        'Phase 1H must replace it with a verified domain owned and controlled by NB LAO (planned migration and account verification).',
    )
    this.name = 'TemporaryNamespaceInProductionError'
  }
}

/** Production guard: refuses to run with the temporary `.invalid` namespace when NODE_ENV is production. */
export function assertNamespaceAllowed(nodeEnv: string | undefined): void {
  if (PRIVILEGED_NAMESPACE_IS_TEMPORARY && (nodeEnv ?? '').trim().toLowerCase() === 'production') {
    throw new TemporaryNamespaceInProductionError()
  }
}
