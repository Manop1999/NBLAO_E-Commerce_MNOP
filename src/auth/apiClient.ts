/*
 * Small JSON client for /api/auth and /api/admin (API mode only). Same-origin requests through the Vite dev
 * proxy, so the HttpOnly session cookies travel automatically and are never readable here. State-changing
 * requests carry the CSRF token the server returned with the session.
 *
 * Nothing is stored in localStorage or sessionStorage: the CSRF token lives in memory only.
 */

export class ApiRequestError extends Error {
  readonly status: number
  readonly code: string
  readonly issues: { path: string; message: string }[]
  readonly stage: string | undefined

  constructor(status: number, code: string, message: string, issues: { path: string; message: string }[] = [], stage?: string) {
    super(message)
    this.name = 'ApiRequestError'
    this.status = status
    this.code = code
    this.issues = issues
    this.stage = stage
  }
}

export type CsrfScope = 'staff' | 'customer'

export interface ApiClientOptions {
  fetch?: typeof fetch
  basePath?: string
}

export function createAuthApiClient(options: ApiClientOptions = {}) {
  const doFetch = options.fetch ?? ((input, init) => globalThis.fetch(input, init))
  const basePath = options.basePath ?? '/api'
  const csrf: Record<CsrfScope, string | undefined> = { staff: undefined, customer: undefined }

  async function request<T>(method: 'GET' | 'POST' | 'PATCH', path: string, body?: unknown, scope?: CsrfScope): Promise<T> {
    const headers: Record<string, string> = { accept: 'application/json' }
    if (body !== undefined) headers['content-type'] = 'application/json'
    const token = scope ? csrf[scope] : undefined
    if (method !== 'GET' && token) headers['x-csrf-token'] = token
    let response: Response
    try {
      response = await doFetch(`${basePath}${path}`, {
        method,
        headers,
        credentials: 'same-origin',
        cache: 'no-store',
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      })
    } catch {
      throw new ApiRequestError(0, 'network', 'The NB LAO service could not be reached. Is the local API running?')
    }
    if (response.status === 204) return undefined as T
    let data: unknown
    try {
      data = await response.json()
    } catch {
      throw new ApiRequestError(response.status, 'invalid_response', 'The service returned an unexpected answer')
    }
    if (!response.ok) {
      const error = (data as { error?: { code?: string; message?: string; issues?: { path: string; message: string }[]; stage?: string } }).error
      throw new ApiRequestError(response.status, error?.code ?? 'error', error?.message ?? `Request failed (${response.status})`, error?.issues ?? [], error?.stage)
    }
    return data as T
  }

  return {
    get: <T>(path: string) => request<T>('GET', path),
    post: <T>(path: string, body: unknown = {}, scope?: CsrfScope) => request<T>('POST', path, body, scope),
    patch: <T>(path: string, body: unknown, scope?: CsrfScope) => request<T>('PATCH', path, body, scope),
    setCsrf(scope: CsrfScope, token: string | undefined) {
      csrf[scope] = token
    },
    hasCsrf: (scope: CsrfScope) => csrf[scope] !== undefined,
  }
}

export type AuthApiClient = ReturnType<typeof createAuthApiClient>

/** The one client the app uses (API mode). */
export const authApi = createAuthApiClient()

/** Human-readable text for password-policy problems returned by the server. */
export function passwordProblemText(problem: string): string {
  switch (problem) {
    case 'too_short':
      return 'Use at least 12 characters.'
    case 'too_long':
      return 'Use at most 128 characters.'
    case 'contains_email':
      return 'The password must not contain your email address.'
    case 'too_common':
      return 'This password is too common. Choose a longer, less predictable one.'
    case 'same_as_current':
      return 'Choose a password different from the current one.'
    default:
      return 'The password does not meet the password rules.'
  }
}

export function describeError(error: unknown): string {
  if (error instanceof ApiRequestError) {
    if (error.code === 'password_policy') return error.issues.map(issue => passwordProblemText(issue.message)).join(' ')
    if (error.code === 'invalid_request' && error.issues.length > 0) return 'Please check the highlighted information and try again.'
    return error.message
  }
  return 'Something went wrong. Please try again.'
}
