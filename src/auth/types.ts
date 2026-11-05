import type { AuthSource } from './source'

export interface AuthUser {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string
  company: string
  role: 'customer' | 'admin'
  memberSince: string
  /** API mode only: PENDING until NB LAO approves the account, then ACTIVE. */
  status?: 'PENDING' | 'ACTIVE'
}

export interface RegisterData {
  firstName: string
  lastName: string
  email: string
  phone: string
  company: string
  password: string
}

export type StaffRole = 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER' | 'SALES' | 'WAREHOUSE'
export type StaffStage = 'PASSWORD_CHANGE_REQUIRED' | 'MFA_ENROLLMENT_REQUIRED' | 'MFA_REQUIRED' | 'FULL'

/** What the server says about the signed-in staff member. The browser never decides any of it. */
export interface StaffSession {
  id: string
  email: string
  displayName: string
  role: StaffRole
  teamId: string | null
  mfaEnabled: boolean
  mfaRequired: boolean
  stage: StaffStage
  permissions: string[]
  /** 2FA verified recently enough for sensitive actions until this time (ISO), or null. */
  stepUpUntil: string | null
}

export interface AuthResult {
  success: boolean
  error?: string
  /** Machine-readable reason from the API (e.g. `account_inactive`, `password_policy`). */
  code?: string
}

export interface AuthCtx {
  source: AuthSource
  /** False until the first server session check has answered (API mode); always true in demo mode. */
  ready: boolean
  /** The signed-in customer; in demo mode also the demo admin (role "admin"), as before. */
  user: AuthUser | null
  /** A customer is signed in (staff sessions never count, so staff cannot use customer pages). */
  isAuthenticated: boolean
  /** A staff member with full Admin Portal access is signed in. */
  isAdmin: boolean
  staff: StaffSession | null
  login: (email: string, password: string, rememberMe?: boolean) => Promise<AuthResult>
  adminLogin: (email: string, password: string) => Promise<AuthResult & { stage?: StaffStage }>
  register: (data: RegisterData) => Promise<AuthResult & { pendingApproval?: boolean }>
  logout: () => Promise<void>
  adminLogout: () => Promise<void>
  /** Re-reads the staff session from the server (API mode). */
  refreshStaff: () => Promise<StaffSession | null>
}
