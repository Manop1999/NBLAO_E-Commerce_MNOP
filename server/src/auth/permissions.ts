/**
 * Permission codes for server-side authorization.
 *
 * Which roles receive which codes (decision D12) lives in roles.ts. Nothing is granted by default.
 */
export const PERMISSION_CODES = [
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
  'customers.invite',
  'customers.assign',
  'customers.reset_password',
  'customers.export',
  'customers.export_contact',
  'customers.import',
  'addresses.export',
  'staff.manage',
  'staff.reset_password',
  'staff.mfa_reset',
  'teams.manage',
  'staff.export',
  'staff.export_contact',
  'staff.import',
  'roles.view',
  'roles.assign',
  'permissions.manage',
  'orders.view',
  'orders.update_status',
  'orders.export',
  'orders.export_customer_data',
  'orders.export_notes',
  'rfq.view',
  'rfq.assign',
  'rfq.export',
  'quotes.write',
  'quotes.send',
  'payments.record',
  'payments.verify',
  'payments.refund',
  'payments.export',
  'payments.export_reference',
  'promotions.manage',
  'coupons.manage',
  'loyalty.manage',
  'loyalty.adjust',
  'reviews.moderate',
  'audit.view',
  'audit.view_security',
  'audit.export',
  'import.start',
  'import.preview',
  'import.confirm',
  'import.view_own',
  'import.view_all',
  'settings.write',
  'content.write',
  'reports.view',
] as const

export type PermissionCode = (typeof PERMISSION_CODES)[number]

const KNOWN: ReadonlySet<string> = new Set(PERMISSION_CODES)

export const isPermissionCode = (value: string): value is PermissionCode => KNOWN.has(value)

/**
 * Deny-by-default check. Returns true only when `code` is a known permission AND appears verbatim in `grants`.
 * There are no wildcards: `*`, `catalog.*` and similar grants match nothing. Matching is case-sensitive and
 * does not trim whitespace.
 */
export function can(grants: Iterable<string> | null | undefined, code: string): boolean {
  if (!grants || !isPermissionCode(code)) return false
  for (const grant of grants) {
    if (grant === code) return true
  }
  return false
}
