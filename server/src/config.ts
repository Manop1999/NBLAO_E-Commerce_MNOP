/**
 * Server configuration from environment variables, validated with zod. Invalid configuration stops the
 * process before anything listens or connects.
 *
 * Error messages name the variable and the problem but never echo values, because DATABASE_URL contains a
 * password.
 */
import { z } from 'zod'

/** The API only listens on loopback until hosting is approved (no CORS, no remote access). */
export const LOOPBACK_HOSTS = ['127.0.0.1', '::1'] as const

export const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'] as const

const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'test']),
  HOST: z.enum(LOOPBACK_HOSTS).default('127.0.0.1'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  LOG_LEVEL: z.enum(LOG_LEVELS).default('info'),
  DATABASE_URL: z.string().trim().min(1),
  ALLOWED_LOCAL_DATABASES: z.string().optional(),
})

export interface AppConfig {
  nodeEnv: 'development' | 'test'
  host: (typeof LOOPBACK_HOSTS)[number]
  port: number
  logLevel: (typeof LOG_LEVELS)[number]
  databaseUrl: string
  allowedDatabases: string | undefined
}

export class ConfigError extends Error {
  readonly issues: string[]

  constructor(issues: string[]) {
    super(`Invalid server configuration: ${issues.join('; ')}`)
    this.name = 'ConfigError'
    this.issues = issues
  }
}

export function loadConfig(env: Record<string, string | undefined>): AppConfig {
  // Empty strings count as unset, so `PORT=` in .env falls back to the default instead of failing oddly.
  const present = Object.fromEntries(Object.entries(env).filter(([, value]) => value !== undefined && value !== ''))
  const result = configSchema.safeParse(present)
  if (!result.success) {
    const issues = result.error.issues.map(issue => {
      const name = issue.path.join('.') || 'environment'
      return name in present ? `${name}: ${issue.message}` : `${name} is required`
    })
    throw new ConfigError(issues)
  }
  const value = result.data
  return {
    nodeEnv: value.NODE_ENV,
    host: value.HOST,
    port: value.PORT,
    logLevel: value.LOG_LEVEL,
    databaseUrl: value.DATABASE_URL,
    allowedDatabases: value.ALLOWED_LOCAL_DATABASES,
  }
}
