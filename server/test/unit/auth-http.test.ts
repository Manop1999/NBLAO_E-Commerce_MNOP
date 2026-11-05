import { Writable } from 'node:stream'
import { afterEach, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildApp } from '../../src/app'
import { cookieName, cookieOptions } from '../../src/auth/http'
import { PasswordHasher } from '../../src/auth/password'

// No database: these requests are all refused (or rejected by validation) before any query runs.
const prismaThatMustNotBeUsed = new Proxy({}, { get: () => { throw new Error('database must not be touched') } })

const ORIGIN = 'http://127.0.0.1:5174'
let app: FastifyInstance | undefined
let logs: string[] = []

const make = () => {
  logs = []
  const stream = new Writable({ write(chunk, _encoding, done) { logs.push(String(chunk)); done() } })
  app = buildApp({
    logLevel: 'info',
    logStream: stream,
    checkDatabase: () => Promise.resolve(),
    auth: {
      ctx: { prisma: prismaThatMustNotBeUsed as never, hasher: new PasswordHasher({ memoryCost: 1024, timeCost: 1, parallelism: 1 }), totpKey: Buffer.alloc(32), now: () => new Date() },
      http: { cookieSecure: false, allowedOrigins: [ORIGIN] },
    },
  })
  return app
}

afterEach(async () => {
  await app?.close()
  app = undefined
})

describe('cookies', () => {
  it('uses plain names over http and __Host- names with Secure over https', () => {
    expect(cookieName('STAFF', false)).toBe('nblao_staff')
    expect(cookieName('CUSTOMER', false)).toBe('nblao_customer')
    expect(cookieName('STAFF', true)).toBe('__Host-nblao_staff')
    expect(cookieName('CUSTOMER', true)).toBe('__Host-nblao_customer')
  })

  it('are HttpOnly with path /, Strict for staff and Lax for customers', () => {
    expect(cookieOptions('STAFF', false)).toEqual({ httpOnly: true, secure: false, path: '/', sameSite: 'strict' })
    expect(cookieOptions('CUSTOMER', true, 60)).toEqual({ httpOnly: true, secure: true, path: '/', sameSite: 'lax', maxAge: 60 })
  })
})

describe('origin check and JSON-only bodies (CSRF layer 1)', () => {
  const login = (headers: Record<string, string>, payload: string) =>
    make().inject({ method: 'POST', url: '/api/auth/staff/login', headers, payload })

  it('refuses state-changing requests without an allowed Origin', async () => {
    const variants: Record<string, string>[] = [{}, { origin: 'https://evil.example' }, { origin: 'null' }, { origin: `${ORIGIN}/` }]
    for (const headers of variants) {
      const response = await login({ 'content-type': 'application/json', ...headers }, '{"email":"a@example.test","password":"x"}')
      expect(response.statusCode, JSON.stringify(headers)).toBe(403)
      expect(response.json()).toEqual({ error: { code: 'origin_rejected', message: 'Request origin is not allowed' } })
    }
    const crossSite = await login({ 'content-type': 'application/json', origin: ORIGIN, 'sec-fetch-site': 'cross-site' }, '{}')
    expect(crossSite.statusCode).toBe(403)
  })

  it('refuses form and text bodies even from the allowed origin', async () => {
    for (const type of ['text/plain', 'application/x-www-form-urlencoded', 'multipart/form-data; boundary=x']) {
      const response = await login({ 'content-type': type, origin: ORIGIN }, 'email=a&password=b')
      expect(response.statusCode, type).toBe(415)
    }
  })

  it('validates bodies strictly without echoing submitted values', async () => {
    const response = await login({ 'content-type': 'application/json', origin: ORIGIN }, JSON.stringify({ email: 'not-an-email', password: 'Sup3r-Secret-Value', role: 'SUPER_ADMIN' }))
    expect(response.statusCode).toBe(400)
    expect(response.json().error.code).toBe('invalid_request')
    expect(response.body).not.toContain('Sup3r-Secret-Value')
    expect(response.body).not.toContain('not-an-email')
  })

  it('leaves GET routes and other prefixes alone and adds no CORS headers', async () => {
    const instance = make()
    const health = await instance.inject({ method: 'GET', url: '/api/health', headers: { origin: 'https://evil.example' } })
    expect(health.statusCode).toBe(200)
    expect(health.headers['access-control-allow-origin']).toBeUndefined()
    const preflight = await instance.inject({ method: 'OPTIONS', url: '/api/auth/staff/login', headers: { origin: 'https://evil.example', 'access-control-request-method': 'POST' } })
    expect(preflight.headers['access-control-allow-origin']).toBeUndefined()
  })
})

describe('logging', () => {
  it('never writes cookies, CSRF tokens or submitted passwords to the log', async () => {
    const instance = make()
    await instance.inject({
      method: 'POST',
      url: '/api/auth/staff/login',
      headers: { 'content-type': 'application/json', origin: ORIGIN, cookie: 'nblao_staff=cookie-value-123', 'x-csrf-token': 'csrf-value-456', authorization: 'Bearer bearer-789' },
      payload: JSON.stringify({ email: 'a@example.test', password: 'logged-password-000' }),
    })
    await instance.inject({ method: 'GET', url: '/api/auth/staff/session', headers: { cookie: 'nblao_staff=not-a-valid-token' } }).catch(() => undefined)
    const text = logs.join('\n')
    expect(text.length).toBeGreaterThan(0)
    for (const secret of ['cookie-value-123', 'csrf-value-456', 'bearer-789', 'logged-password-000', 'not-a-valid-token']) expect(text).not.toContain(secret)
  })
})
