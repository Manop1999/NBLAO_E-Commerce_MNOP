import { describe, expect, it } from 'vitest'
import { ApiRequestError, createAuthApiClient, describeError, passwordProblemText } from '../apiClient'
import { parseAuthSource } from '../source'

function recorder(respond: (url: string, init: RequestInit) => Response) {
  const calls: { url: string; init: RequestInit }[] = []
  const fetch = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
    calls.push({ url: String(input), init })
    return respond(String(input), init)
  }) as typeof globalThis.fetch
  return { calls, fetch }
}

describe('VITE_AUTH_SOURCE', () => {
  it('defaults to demo and accepts only demo or api', () => {
    expect(parseAuthSource(undefined)).toBe('demo')
    expect(parseAuthSource('')).toBe('demo')
    expect(parseAuthSource('demo')).toBe('demo')
    expect(parseAuthSource('api')).toBe('api')
    for (const value of ['API', 'prod', 'true']) expect(() => parseAuthSource(value)).toThrow(/VITE_AUTH_SOURCE/)
  })
})

describe('auth API client', () => {
  it('sends same-origin JSON and the CSRF token only for its own scope', async () => {
    const { calls, fetch } = recorder(() => Response.json({ ok: true }))
    const client = createAuthApiClient({ fetch })
    client.setCsrf('staff', 'staff-csrf')
    client.setCsrf('customer', 'customer-csrf')
    await client.post('/auth/staff/logout', {}, 'staff')
    await client.post('/auth/customer/password', { a: 1 }, 'customer')
    await client.post('/auth/staff/login', { email: 'x' })
    await client.get('/auth/staff/session')
    const headers = calls.map(call => call.init.headers as Record<string, string>)
    expect(calls.map(call => call.url)).toEqual(['/api/auth/staff/logout', '/api/auth/customer/password', '/api/auth/staff/login', '/api/auth/staff/session'])
    expect(headers[0]!['x-csrf-token']).toBe('staff-csrf')
    expect(headers[1]!['x-csrf-token']).toBe('customer-csrf')
    expect(headers[2]!['x-csrf-token']).toBeUndefined()
    expect(headers[3]!['x-csrf-token']).toBeUndefined()
    expect(headers[1]!['content-type']).toBe('application/json')
    for (const call of calls) expect(call.init).toMatchObject({ credentials: 'same-origin', cache: 'no-store' })
  })

  it('turns error envelopes into ApiRequestError and a 401 into an unauthenticated error', async () => {
    const { fetch } = recorder(() => Response.json({ error: { code: 'unauthenticated', message: 'Sign in required' } }, { status: 401 }))
    const client = createAuthApiClient({ fetch })
    const error = await client.get('/auth/customer/session').catch(e => e)
    expect(error).toBeInstanceOf(ApiRequestError)
    expect(error).toMatchObject({ status: 401, code: 'unauthenticated' })
  })

  it('reports network failures without details and handles 204', async () => {
    const failing = createAuthApiClient({ fetch: (async () => { throw new TypeError('connect ECONNREFUSED 127.0.0.1:3001') }) as typeof globalThis.fetch })
    const error = (await failing.get('/auth/staff/session').catch((e: unknown) => e)) as ApiRequestError
    expect(error).toMatchObject({ status: 0, code: 'network' })
    expect(String(error.message)).not.toContain('127.0.0.1')
    const empty = createAuthApiClient({ fetch: (async () => new Response(null, { status: 204 })) as typeof globalThis.fetch })
    expect(await empty.post('/auth/staff/logout')).toBeUndefined()
  })

  it('describes password-policy problems in plain words', () => {
    const error = new ApiRequestError(422, 'password_policy', 'x', [{ path: 'password', message: 'too_short' }, { path: 'password', message: 'too_common' }])
    expect(describeError(error)).toBe(`${passwordProblemText('too_short')} ${passwordProblemText('too_common')}`)
    expect(describeError(new Error('boom'))).toBe('Something went wrong. Please try again.')
  })

  it('never touches browser storage', async () => {
    const touched: string[] = []
    const storage = new Proxy({}, { get: (_t, key) => { touched.push(String(key)); return () => null } })
    const previous = { local: globalThis.localStorage, session: globalThis.sessionStorage }
    Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true })
    Object.defineProperty(globalThis, 'sessionStorage', { value: storage, configurable: true })
    try {
      const { fetch } = recorder(() => Response.json({ csrfToken: 't' }))
      const client = createAuthApiClient({ fetch })
      client.setCsrf('staff', 't')
      await client.post('/auth/staff/logout', {}, 'staff')
      expect(touched).toEqual([])
    } finally {
      Object.defineProperty(globalThis, 'localStorage', { value: previous.local, configurable: true })
      Object.defineProperty(globalThis, 'sessionStorage', { value: previous.session, configurable: true })
    }
  })
})
