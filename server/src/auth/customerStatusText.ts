/**
 * Wording of the "invalid status" API message. Dependency-free on purpose: the frontend translation tests import it
 * to prove that every status renders in English, Lao and Thai through the template in src/authTranslations.ts.
 *
 * The sentence always has this exact shape, and the status phrase comes from this closed list, so the frontend can
 * translate it with an anchored whole-message template (never by replacing words inside other text).
 */
export type CustomerStatusName = 'INVITED' | 'PENDING' | 'ACTIVE' | 'REJECTED' | 'SUSPENDED'

export const CUSTOMER_STATUS_PHRASES: Readonly<Record<CustomerStatusName, string>> = {
  INVITED: 'invited',
  PENDING: 'awaiting approval',
  ACTIVE: 'active',
  REJECTED: 'rejected',
  SUSPENDED: 'suspended',
}

export const INVALID_STATUS_TEMPLATE = 'This action is not possible while the account is {status}.'

export function invalidStatusMessage(status: CustomerStatusName): string {
  return INVALID_STATUS_TEMPLATE.replace('{status}', CUSTOMER_STATUS_PHRASES[status])
}
