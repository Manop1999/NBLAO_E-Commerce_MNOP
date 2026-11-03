import { afterEach, describe, expect, it, vi } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildApp } from '../../src/app'

let app: FastifyInstance | undefined
const make = (checkDatabase: () => Promise<void>, readyTimeoutMs?: number) => {
  app = buildApp({ logLevel: 'silent', checkDatabase, readyTimeoutMs })
  return app
}

afterEach(async () => {
  await app?.close()
  app = undefined
})

describe('GET /api/health', () => {
  it('returns 200 without touching the database', async () => {
    const checkDatabase = vi.fn(() => Promise.reject(new Error('database is down')))
    const response = await make(checkDatabase).inject({ method: 'GET', url: '/api/health' })
    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ status: 'ok' })
    expect(response.headers['cache-control']).toBe('no-store')
    expect(checkDatabase).not.toHaveBeenCalled()
  })
})

describe('GET /api/ready', () => {
  it('returns 200 when the database answers', async () => {
    const checkDatabase = vi.fn(() => Promise.resolve())
    const response = await make(checkDatabase).inject({ method: 'GET', url: '/api/ready' })
    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ status: 'ready', checks: { database: 'ok' } })
    expect(checkDatabase).toHaveBeenCalledOnce()
  })

  it('returns 503 without leaking error details when the database check fails', async () => {
    const secret = "Can't reach database server at 127.0.0.1:5432 password=s3cret"
    const response = await make(() => Promise.reject(new Error(secret))).inject({ method: 'GET', url: '/api/ready' })
    expect(response.statusCode).toBe(503)
    expect(response.json()).toEqual({ status: 'unavailable', checks: { database: 'unavailable' } })
    expect(response.body).not.toContain('s3cret')
    expect(response.headers['cache-control']).toBe('no-store')
  })

  it('returns 503 when the database check hangs past the timeout', async () => {
    const started = Date.now()
    const response = await make(() => new Promise<void>(() => {}), 50).inject({ method: 'GET', url: '/api/ready' })
    expect(response.statusCode).toBe(503)
    expect(Date.now() - started).toBeLessThan(2_000)
  })
})

describe('routes', () => {
  it('has no other API routes and no CORS headers yet', async () => {
    const instance = make(() => Promise.resolve())
    const products = await instance.inject({ method: 'GET', url: '/api/products' })
    expect(products.statusCode).toBe(404)
    const preflight = await instance.inject({
      method: 'OPTIONS',
      url: '/api/health',
      headers: { origin: 'https://example.com', 'access-control-request-method': 'GET' },
    })
    expect(preflight.headers['access-control-allow-origin']).toBeUndefined()
  })
})
