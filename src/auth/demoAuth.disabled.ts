/*
 * Stand-in for demoAuth.ts in builds made with VITE_AUTH_SOURCE=api (see the alias in vite.config.ts), so an
 * API-mode bundle contains no prototype credentials. It is never rendered: src/auth/index.ts picks the API
 * provider in those builds.
 */
import type { ReactNode } from 'react'

export function DemoAuthProvider(_props: { children: ReactNode }): never {
  throw new Error('Prototype sign-in is not part of this build (VITE_AUTH_SOURCE=api)')
}
