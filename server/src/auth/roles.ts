/**
 * Role → permission map (decision D12, Phase 1E plan §3) and the data scopes that go with it.
 *
 * Scopes are Prisma `where` fragments, so restrictions are applied by the database query and never by
 * filtering results afterwards. A `null` scope means "no access at all".
 */
import type { Prisma } from '../generated/prisma/client.ts'
import { PERMISSION_CODES, type PermissionCode } from './permissions.ts'

export const STAFF_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'SALES', 'WAREHOUSE'] as const
export type StaffRoleName = (typeof STAFF_ROLES)[number]

/** Roles that must enrol and verify TOTP before any admin endpoint works (D-2FA). */
export const MFA_MANDATORY_ROLES: ReadonlySet<StaffRoleName> = new Set(['SUPER_ADMIN', 'ADMIN', 'MANAGER'])

/** Roles only a Super Admin may create, change, disable or assign (D-STAFF). */
export const PRIVILEGED_ROLES: ReadonlySet<StaffRoleName> = new Set(['SUPER_ADMIN', 'ADMIN'])

const SUPER_ADMIN_ONLY: readonly PermissionCode[] = [
  'permissions.manage',
  'settings.write',
  'audit.export',
  'staff.reset_password',
  'staff.mfa_reset',
]

const MANAGER: readonly PermissionCode[] = [
  'catalog.view',
  'catalog.create',
  'catalog.edit',
  'catalog.archive',
  'catalog.export',
  'catalog.import',
  'prices.edit',
  'prices.export',
  'prices.import',
  'inventory.adjust',
  'inventory.export',
  'inventory.import',
  'customers.view',
  'customers.approve',
  // Managers request invitations instead of issuing them: a direct invitation has to look the email up across all
  // customers, which would tell a Manager about accounts outside their scope. Admins issue (customers.invite).
  'customers.request_invite',
  'customers.assign',
  'customers.reset_password',
  'orders.view',
  'orders.update_status',
  'rfq.view',
  'rfq.assign',
  'quotes.write',
  'quotes.send',
  'payments.record',
  'payments.verify',
  'promotions.manage',
  'coupons.manage',
  'loyalty.manage',
  'loyalty.adjust',
  'reviews.moderate',
  'content.write',
  'reports.view',
  'audit.view',
]

const SALES: readonly PermissionCode[] = ['catalog.view', 'customers.view', 'orders.view', 'orders.update_status', 'rfq.view', 'quotes.write', 'quotes.send']

const WAREHOUSE: readonly PermissionCode[] = ['catalog.view', 'inventory.adjust', 'inventory.export', 'orders.view', 'orders.update_status']

export const ROLE_PERMISSIONS: Readonly<Record<StaffRoleName, ReadonlySet<PermissionCode>>> = {
  SUPER_ADMIN: new Set(PERMISSION_CODES),
  ADMIN: new Set(PERMISSION_CODES.filter(code => !SUPER_ADMIN_ONLY.includes(code))),
  MANAGER: new Set(MANAGER),
  SALES: new Set(SALES),
  WAREHOUSE: new Set(WAREHOUSE),
}

/** Permissions of a role; unknown roles get nothing. */
export function permissionsFor(role: string): ReadonlySet<PermissionCode> {
  return (ROLE_PERMISSIONS as Record<string, ReadonlySet<PermissionCode> | undefined>)[role] ?? new Set()
}

export interface StaffActor {
  id: string
  role: StaffRoleName
  teamId: string | null
}

const UNASSIGNED: Prisma.CustomerWhereInput = { teamId: null, assignedStaffId: null }

/**
 * Which customers a staff member may see or act on (plan §3.1):
 * Super Admin / Admin all; Manager their team plus unassigned customers (only unassigned without a team);
 * Sales only customers assigned to them; Warehouse none.
 */
export function customerScope(actor: StaffActor): Prisma.CustomerWhereInput | null {
  switch (actor.role) {
    case 'SUPER_ADMIN':
    case 'ADMIN':
      return {}
    case 'MANAGER':
      return actor.teamId ? { OR: [{ teamId: actor.teamId }, UNASSIGNED] } : UNASSIGNED
    case 'SALES':
      return { assignedStaffId: actor.id }
    default:
      return null
  }
}

/** Whether one customer row (team/assignee) falls inside `customerScope(actor)`. Mirrors the query above. */
export function isCustomerInScope(actor: StaffActor, customer: { teamId: string | null; assignedStaffId: string | null }): boolean {
  switch (actor.role) {
    case 'SUPER_ADMIN':
    case 'ADMIN':
      return true
    case 'MANAGER': {
      const unassigned = customer.teamId === null && customer.assignedStaffId === null
      return unassigned || (actor.teamId !== null && customer.teamId === actor.teamId)
    }
    case 'SALES':
      return customer.assignedStaffId === actor.id
    default:
      return false
  }
}

/**
 * Which audit events a staff member may read (plan §9). Security events need `audit.view_security`
 * (Super Admin, Admin). Managers read operational events of their team, plus events with no team.
 */
export function auditScope(actor: StaffActor): Prisma.AuditEventWhereInput | null {
  const permissions = permissionsFor(actor.role)
  if (!permissions.has('audit.view')) return null
  if (permissions.has('audit.view_security')) return {}
  if (actor.role === 'MANAGER') {
    return { category: 'OPERATIONAL', OR: actor.teamId ? [{ teamId: actor.teamId }, { teamId: null }] : [{ teamId: null }] }
  }
  return null
}

/** Roles an Admin may see and manage (D-STAFF). */
export const ADMIN_MANAGEABLE_ROLES: readonly StaffRoleName[] = ['MANAGER', 'SALES', 'WAREHOUSE']

/**
 * Which staff accounts a staff member may list or inspect, as a database filter: Super Admin all; Admin only
 * Manager, Sales and Warehouse accounts (never Admin or Super Admin, including their own row through these
 * endpoints); everyone else none.
 */
export function staffVisibilityScope(actor: StaffActor): Prisma.StaffUserWhereInput | null {
  if (!permissionsFor(actor.role).has('staff.manage')) return null
  if (actor.role === 'SUPER_ADMIN') return {}
  return { role: { in: [...ADMIN_MANAGEABLE_ROLES] } }
}

/**
 * Staff management rules (D-STAFF). Returns null when allowed, or the refusal code.
 * - Only Super Admin manages Admin / Super Admin accounts or assigns those roles.
 * - Admin manages Manager, Sales and Warehouse accounts only.
 * - Nobody changes their own role or status.
 * The last-active-Super-Admin rule needs the database and is enforced in the staff service.
 */
export function staffManagementRefusal(
  actor: StaffActor,
  target: { id: string; role: StaffRoleName } | null,
  change: { role?: StaffRoleName | undefined; status?: string | undefined },
): 'forbidden' | 'self_change' | null {
  const permissions = permissionsFor(actor.role)
  if (!permissions.has('staff.manage')) return 'forbidden'
  if (target && target.id === actor.id && (change.role !== undefined || change.status !== undefined)) return 'self_change'
  if (actor.role === 'SUPER_ADMIN') return null
  if (target && PRIVILEGED_ROLES.has(target.role)) return 'forbidden'
  if (change.role !== undefined && PRIVILEGED_ROLES.has(change.role)) return 'forbidden'
  return null
}
