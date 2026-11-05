/**
 * One error shape for every API response: `{ error: { code, message, issues? } }`.
 * Internal details (stack traces, SQL, Prisma messages) are logged, never sent to the client.
 */
import type { FastifyError, FastifyInstance } from 'fastify'

export interface ApiIssue {
  path: string
  message: string
}

export interface ApiErrorBody {
  error: { code: string; message: string; issues?: ApiIssue[]; stage?: string }
}

export class ApiError extends Error {
  readonly statusCode: number
  readonly code: string
  readonly issues: ApiIssue[] | undefined
  /** Session stage the client must complete first (403 stage_required only). */
  readonly stage: string | undefined

  constructor(statusCode: number, code: string, message: string, issues?: ApiIssue[], stage?: string) {
    super(message)
    this.name = 'ApiError'
    this.statusCode = statusCode
    this.code = code
    this.issues = issues
    this.stage = stage
  }
}

export const invalidQuery = (issues: ApiIssue[]): ApiError => new ApiError(400, 'invalid_query', 'Invalid query parameters', issues)

export function installErrorHandlers(app: FastifyInstance): void {
  app.setErrorHandler((error: FastifyError | ApiError, request, reply) => {
    if (error instanceof ApiError) {
      const body: ApiErrorBody = {
        error: { code: error.code, message: error.message, ...(error.issues ? { issues: error.issues } : {}), ...(error.stage ? { stage: error.stage } : {}) },
      }
      return reply.code(error.statusCode).send(body)
    }
    // Client errors raised by Fastify itself (malformed request, unsupported media type, payload too large).
    const status = typeof error.statusCode === 'number' ? error.statusCode : 500
    if (status >= 400 && status < 500) {
      return reply.code(status).send({ error: { code: 'bad_request', message: 'The request could not be processed' } } satisfies ApiErrorBody)
    }
    request.log.error({ err: error }, 'unhandled error')
    return reply.code(500).send({ error: { code: 'internal', message: 'Internal server error' } } satisfies ApiErrorBody)
  })

  app.setNotFoundHandler((_request, reply) => {
    return reply.code(404).send({ error: { code: 'not_found', message: 'Route not found' } } satisfies ApiErrorBody)
  })
}
