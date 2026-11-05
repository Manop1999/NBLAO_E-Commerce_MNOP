/*
 * Authentication entry point. `useAuth()` has the same shape in both modes (see types.ts); which provider runs
 * is fixed at build time by VITE_AUTH_SOURCE (source.ts). The comparison below uses import.meta.env directly so
 * the bundler drops the unused provider: an API-mode build contains no demo credentials.
 */
import { createElement, useContext, type ReactNode } from 'react'
import { ApiAuthProvider } from './apiAuth'
import { AuthContext } from './context'
import { DemoAuthProvider } from './demoAuth'
import { AUTH_SOURCE } from './source'

export type { AuthResult, AuthUser, RegisterData, StaffRole, StaffSession, StaffStage } from './types'
export { AUTH_SOURCE } from './source'

export function AuthProvider({ children }: { children: ReactNode }) {
  if (import.meta.env.VITE_AUTH_SOURCE === 'api' && AUTH_SOURCE === 'api') return createElement(ApiAuthProvider, null, children)
  return createElement(DemoAuthProvider, null, children)
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
