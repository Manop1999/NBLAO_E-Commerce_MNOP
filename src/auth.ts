import { createContext, useContext, useState, useEffect, ReactNode, createElement } from 'react'

export interface AuthUser {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string
  company: string
  role: 'customer' | 'admin'
  memberSince: string
}

export interface RegisterData {
  firstName: string
  lastName: string
  email: string
  phone: string
  company: string
  password: string
}

interface AuthCtx {
  user: AuthUser | null
  isAuthenticated: boolean
  isAdmin: boolean
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
  adminLogin: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
  register: (data: RegisterData) => Promise<{ success: boolean; error?: string }>
  logout: () => void
  adminLogout: () => void
}

// ─── Prototype credentials (replace with real API calls in production) ────────
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

const Ctx = createContext<AuthCtx | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(loadUser)

  useEffect(() => {
    const handleStorage = () => setUser(loadUser())
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [])

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    await new Promise(r => setTimeout(r, 800))
    const found = DEMO_CUSTOMERS.find(
      u => u.email.toLowerCase() === email.toLowerCase() && u.password === password
    )
    if (!found) return { success: false, error: 'Invalid email or password.' }
    const { password: _pw, ...authUser } = found
    localStorage.removeItem(ADMIN_SESSION_KEY)
    localStorage.setItem(SESSION_KEY, JSON.stringify(authUser))
    setUser(authUser)
    return { success: true }
  }

  const adminLogin = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    await new Promise(r => setTimeout(r, 800))
    if (
      email.toLowerCase() === DEMO_ADMIN.email.toLowerCase() &&
      password === DEMO_ADMIN.password
    ) {
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
      return { success: true }
    }
    return { success: false, error: 'Invalid admin credentials.' }
  }

  const register = async (data: RegisterData): Promise<{ success: boolean; error?: string }> => {
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

  const logout = () => {
    localStorage.removeItem(SESSION_KEY)
    setUser(null)
  }

  const adminLogout = () => {
    localStorage.removeItem(ADMIN_SESSION_KEY)
    setUser(null)
  }

  return createElement(
    Ctx.Provider,
    { value: { user, isAuthenticated: !!user, isAdmin: user?.role === 'admin', login, adminLogin, register, logout, adminLogout } },
    children
  )
}

export const useAuth = () => {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
