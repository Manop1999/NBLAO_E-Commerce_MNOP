/*
 * Prototype sign-in (VITE_AUTH_SOURCE=demo, the GitHub Pages build). Unchanged behaviour from before Phase 1E:
 * accounts live in this browser only and are NOT secure. The real sign-in is apiAuth.ts (local API only).
 *
 * Phase 1E fix (F4): a demo admin session no longer counts as a signed-in customer.
 */
import { createElement, useEffect, useState, type ReactNode } from 'react'
import { AuthContext } from './context'
import type { AuthResult, AuthUser, RegisterData, StaffSession } from './types'

// ─── Prototype credentials (demo build only; never used in API mode) ────────
const DEMO_CUSTOMERS: (AuthUser & { password: string })[] = [
  {
    id: 'C-001',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@company.com',
    phone: '+856 20 1234 5678',
    company: 'Lao Power Co., Ltd.',
    role: 'customer',
    memberSince: '2023-01-15',
    password: 'demo123',
  },
]

const DEMO_ADMIN = {
  id: 'A-001',
  firstName: 'Admin',
  lastName: 'User',
  email: 'admin@nblao.la',
  password: 'admin123',
  role: 'admin' as const,
  company: 'NB Lao Sole Co., Ltd.',
  phone: '+856 21 314 556',
  memberSince: '2012-01-01',
}

const SESSION_KEY = 'nblao_session'
const ADMIN_SESSION_KEY = 'nblao_admin_session'

function loadUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY) || localStorage.getItem(ADMIN_SESSION_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function demoStaff(user: AuthUser | null): StaffSession | null {
  if (user?.role !== 'admin') return null
  return {
    id: user.id,
    email: user.email,
    displayName: `${user.firstName} ${user.lastName}`,
    role: 'ADMIN',
    teamId: null,
    mfaEnabled: false,
    mfaRequired: false,
    stage: 'FULL',
    permissions: [],
    stepUpUntil: null,
  }
}

export function DemoAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(loadUser)

  useEffect(() => {
    const handleStorage = () => setUser(loadUser())
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [])

  const login = async (email: string, password: string): Promise<AuthResult> => {
    await new Promise(r => setTimeout(r, 800))
    const found = DEMO_CUSTOMERS.find(u => u.email.toLowerCase() === email.toLowerCase() && u.password === password)
    if (!found) return { success: false, error: 'Invalid email or password.' }
    const { password: _pw, ...authUser } = found
    localStorage.removeItem(ADMIN_SESSION_KEY)
    localStorage.setItem(SESSION_KEY, JSON.stringify(authUser))
    setUser(authUser)
    return { success: true }
  }

  const adminLogin = async (email: string, password: string) => {
    await new Promise(r => setTimeout(r, 800))
    if (email.toLowerCase() === DEMO_ADMIN.email.toLowerCase() && password === DEMO_ADMIN.password) {
      const adminUser: AuthUser = {
        id: DEMO_ADMIN.id,
        firstName: DEMO_ADMIN.firstName,
        lastName: DEMO_ADMIN.lastName,
        email: DEMO_ADMIN.email,
        phone: DEMO_ADMIN.phone,
        company: DEMO_ADMIN.company,
        role: 'admin',
        memberSince: DEMO_ADMIN.memberSince,
      }
      localStorage.removeItem(SESSION_KEY)
      localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(adminUser))
      setUser(adminUser)
      return { success: true, stage: 'FULL' as const }
    }
    return { success: false, error: 'Invalid admin credentials.' }
  }

  const register = async (data: RegisterData): Promise<AuthResult> => {
    await new Promise(r => setTimeout(r, 1000))
    if (DEMO_CUSTOMERS.find(u => u.email.toLowerCase() === data.email.toLowerCase())) {
      return { success: false, error: 'An account with this email already exists.' }
    }
    const newUser: AuthUser = {
      id: `C-${Date.now()}`,
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      phone: data.phone,
      company: data.company,
      role: 'customer',
      memberSince: new Date().toISOString().slice(0, 10),
    }
    DEMO_CUSTOMERS.push({ ...newUser, password: data.password })
    localStorage.removeItem(ADMIN_SESSION_KEY)
    localStorage.setItem(SESSION_KEY, JSON.stringify(newUser))
    setUser(newUser)
    return { success: true }
  }

  const logout = async () => {
    localStorage.removeItem(SESSION_KEY)
    setUser(null)
  }

  const adminLogout = async () => {
    localStorage.removeItem(ADMIN_SESSION_KEY)
    setUser(null)
  }

  const staff = demoStaff(user)
  return createElement(
    AuthContext.Provider,
    {
      value: {
        source: 'demo',
        ready: true,
        user,
        isAuthenticated: user?.role === 'customer',
        isAdmin: user?.role === 'admin',
        staff,
        login,
        adminLogin,
        register,
        logout,
        adminLogout,
        refreshStaff: async () => staff,
      },
    },
    children,
  )
}
