/**
 * Fastify application factory. It has no database client of its own: readiness is checked through the
 * injected `checkDatabase`, so tests can run without PostgreSQL and the health route never touches it.
 *
 * Routes: GET /api/health and GET /api/ready (Phase 1B A5); with a `catalog` reader, the public read-only
 * GET /api/products and GET /api/brands (Phase 1D). No CORS, no auth, no write routes.
 */
import Fastify, { type FastifyInstance } from 'fastify'
import { registerCatalogRoutes } from './catalog/routes.ts'
import type { CatalogReader } from './catalog/reader.ts'
import type { AppConfig } from './config.ts'
import { installErrorHandlers } from './errors.ts'

export interface AppOptions {
  logLevel?: AppConfig['logLevel']
  /** Resolves when the database is usable; rejects (or times out) when it is not. */
  checkDatabase: () => Promise<void>
  /** How long /api/ready waits for the database before answering 503. */
  readyTimeoutMs?: number
  /** Public catalog reads. Omitted in tests that only cover health/readiness. */
  catalog?: CatalogReader
}

export const DEFAULT_READY_TIMEOUT_MS = 2_000

function withTimeout(task: Promise<void>, ms: number): Promise<void> {
  let timer: NodeJS.Timeout | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`timed out after ${ms} ms`)), ms)
  })
  return Promise.race([task, timeout]).finally(() => clearTimeout(timer))
}

export function buildApp(options: AppOptions): FastifyInstance {
  const app = Fastify({ logger: { level: options.logLevel ?? 'info' } })
  const readyTimeoutMs = options.readyTimeoutMs ?? DEFAULT_READY_TIMEOUT_MS

  installErrorHandlers(app)

  app.addHook('onSend', async (_request, reply) => {
    reply.header('cache-control', 'no-store')
  })

  // Liveness: the process is up and serving requests. Never depends on the database.
  app.get('/api/health', async () => ({ status: 'ok' }))

  // Readiness: the database answers. Details of a failure go to the log, not to the client.
  app.get('/api/ready', async (request, reply) => {
    try {
      await withTimeout(options.checkDatabase(), readyTimeoutMs)
      return { status: 'ready', checks: { database: 'ok' } }
    } catch (error) {
      request.log.warn({ reason: error instanceof Error ? error.message : String(error) }, 'database not ready')
      return reply.code(503).send({ status: 'unavailable', checks: { database: 'unavailable' } })
    }
  })

  if (options.catalog) registerCatalogRoutes(app, options.catalog)

  return app
}
