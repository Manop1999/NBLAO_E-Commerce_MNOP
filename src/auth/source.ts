/*
 * Which sign-in system the app uses, fixed at build time by VITE_AUTH_SOURCE:
 * - "demo" (default; the GitHub Pages build): prototype sign-in stored only in this browser, as before Phase 1E.
 * - "api": real server-side sessions from the local Fastify API through the Vite dev proxy. Local development
 *   only; scripts/verify-build-output.mjs refuses to publish such a build.
 */
export type AuthSource = 'demo' | 'api'

export function parseAuthSource(raw: string | undefined): AuthSource {
  if (raw === undefined || raw === '' || raw === 'demo') return 'demo'
  if (raw === 'api') return 'api'
  throw new Error(`VITE_AUTH_SOURCE must be "demo" or "api" (got ${JSON.stringify(raw)})`)
}

export const AUTH_SOURCE: AuthSource = parseAuthSource(import.meta.env.VITE_AUTH_SOURCE)
