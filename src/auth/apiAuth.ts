/*
 * Real sign-in against the local API (VITE_AUTH_SOURCE=api, local development only).
 *
 * Sessions live on the server in HttpOnly cookies that this code can never read. The browser keeps no session
 * data in localStorage: who is signed in is always the answer of GET /api/auth/{customer,staff}/session, checked
 * on start, when the window regains focus and after every sign-in step. Any 401 means "signed out".
 */
import { createElement, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { ApiRequestError, authApi, describeError } from './apiClient'
import { AuthContext } from './context'
import type { AuthResult, AuthUser, RegisterData, StaffSession, StaffStage } from './types'

interface CustomerSessionBody {
  customer: { id: string; email: string; firstName: string; lastName: string; phone: string; companyName: string; status: 'PENDING' | 'ACTIVE'; createdAt: string }
  csrfToken: string
}

interface StaffSessionBody {
  staff: { id: string; email: string; displayName: string; role: StaffSession['role']; teamId: string | null; mfaEnabled: boolean; mfaRequired: boolean }
  stage: StaffStage
  permissions: string[]
  csrfToken: string
  stepUpUntil: string | null
}

function toCustomerUser(body: CustomerSessionBody): AuthUser {
  const c = body.customer
  return {
    id: c.id,
    firstName: c.firstName,
    lastName: c.lastName,
    email: c.email,
    phone: c.phone,
    company: c.companyName,
    role: 'customer',
    memberSince: c.createdAt.slice(0, 10),
    status: c.status,
  }
}

function toStaffSession(body: StaffSessionBody): StaffSession {
  return { ...body.staff, stage: body.stage, permissions: body.permissions, stepUpUntil: body.stepUpUntil }
}

/** Staff with full access act as the "admin" user of the local demo commerce panels (Phase 1F moves those). */
function staffAsUser(staff: StaffSession): AuthUser {
  const [firstName = staff.displayName, ...rest] = staff.displayName.split(' ')
  return { id: staff.id, firstName, lastName: rest.join(' '), email: staff.email, phone: '', company: 'NB LAO', role: 'admin', memberSince: '' }
}

const isUnauthenticated = (error: unknown) => error instanceof ApiRequestError && error.status === 401

export function ApiAuthProvider({ children }: { children: ReactNode }) {
  const [customer, setCustomer] = useState<AuthUser | null>(null)
  const [staff, setStaff] = useState<StaffSession | null>(null)
  const [ready, setReady] = useState(false)

  const refreshCustomer = useCallback(async (): Promise<AuthUser | null> => {
    try {
      const body = await authApi.get<CustomerSessionBody>('/auth/customer/session')
      authApi.setCsrf('customer', body.csrfToken)
      const next = toCustomerUser(body)
      setCustomer(next)
      return next
    } catch (error) {
      if (!isUnauthenticated(error) && !(error instanceof ApiRequestError)) throw error
      authApi.setCsrf('customer', undefined)
      setCustomer(null)
      return null
    }
  }, [])

  const refreshStaff = useCallback(async (): Promise<StaffSession | null> => {
    try {
      const body = await authApi.get<StaffSessionBody>('/auth/staff/session')
      authApi.setCsrf('staff', body.csrfToken)
      const next = toStaffSession(body)
      setStaff(next)
      return next
    } catch (error) {
      if (!(error instanceof ApiRequestError)) throw error
      authApi.setCsrf('staff', undefined)
      setStaff(null)
      return null
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    void Promise.allSettled([refreshCustomer(), refreshStaff()]).then(() => {
      if (!cancelled) setReady(true)
    })
    const onFocus = () => {
      void refreshCustomer()
      void refreshStaff()
    }
    window.addEventListener('focus', onFocus)
    return () => {
      cancelled = true
      window.removeEventListener('focus', onFocus)
    }
  }, [refreshCustomer, refreshStaff])

  const login = useCallback(
    async (email: string, password: string, rememberMe = false): Promise<AuthResult> => {
      try {
        await authApi.post('/auth/customer/login', { email, password, rememberMe })
        await refreshCustomer()
        return { success: true }
      } catch (error) {
        return { success: false, error: describeError(error), code: error instanceof ApiRequestError ? error.code : undefined }
      }
    },
    [refreshCustomer],
  )

  const adminLogin = useCallback(
    async (email: string, password: string) => {
      try {
        const result = await authApi.post<{ stage: StaffStage }>('/auth/staff/login', { email, password })
        await refreshStaff()
        return { success: true, stage: result.stage }
      } catch (error) {
        return { success: false, error: describeError(error), code: error instanceof ApiRequestError ? error.code : undefined }
      }
    },
    [refreshStaff],
  )

  const register = useCallback(async (data: RegisterData) => {
    try {
      await authApi.post('/auth/customer/register', {
        email: data.email,
        password: data.password,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        companyName: data.company,
      })
      return { success: true, pendingApproval: true }
    } catch (error) {
      return { success: false, error: describeError(error), code: error instanceof ApiRequestError ? error.code : undefined }
    }
  }, [])

  const logout = useCallback(async () => {
    try {
      await authApi.post('/auth/customer/logout', {}, 'customer')
    } catch {
      // Signed out locally either way; the server session expires on its own.
    }
    authApi.setCsrf('customer', undefined)
    setCustomer(null)
  }, [])

  const adminLogout = useCallback(async () => {
    try {
      await authApi.post('/auth/staff/logout', {}, 'staff')
    } catch {
      // As above.
    }
    authApi.setCsrf('staff', undefined)
    setStaff(null)
  }, [])

  const value = useMemo(() => {
    const fullStaff = staff?.stage === 'FULL' ? staff : null
    return {
      source: 'api' as const,
      ready,
      user: customer ?? (fullStaff ? staffAsUser(fullStaff) : null),
      isAuthenticated: customer !== null,
      isAdmin: fullStaff !== null,
      staff,
      login,
      adminLogin,
      register,
      logout,
      adminLogout,
      refreshStaff,
    }
  }, [ready, customer, staff, login, adminLogin, register, logout, adminLogout, refreshStaff])

  return createElement(AuthContext.Provider, { value }, children)
}
