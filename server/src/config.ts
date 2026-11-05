/**
 * Server configuration from environment variables, validated with zod. Invalid configuration stops the
 * process before anything listens or connects.
 *
 * Error messages name the variable and the problem but never echo values, because DATABASE_URL contains a
 * password and TOTP_ENCRYPTION_KEY is a secret.
 */
import { z } from 'zod'
import { assertNamespaceAllowed, TemporaryNamespaceInProductionError } from './auth/privilegedNamespace.ts'

/** The API only listens on loopback until hosting is approved (no CORS, no remote access). */
export const LOOPBACK_HOSTS = ['127.0.0.1', '::1'] as const

export const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'] as const

/** Browser origins allowed to send state-changing requests: the local Vite dev server and preview. */
export const DEFAULT_ALLOWED_ORIGINS = [
  'http://127.0.0.1:5174',
  'http://localhost:5174',
  'http://127.0.0.1:8443',
  'http://localhost:8443',
] as const

const LOOPBACK_ORIGIN_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]'])

/** An exact `http(s)://host:port` origin on a loopback host. No wildcards, paths, credentials or queries. */
function isLoopbackOrigin(value: string): boolean {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return false
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return false
  if (url.username || url.password || url.search || url.hash || url.pathname !== '/') return false
  if (!LOOPBACK_ORIGIN_HOSTS.has(url.hostname)) return false
  // URL normalises away a trailing slash; the configured value must already be the bare origin.
  return url.origin === value
}

const originList = z
  .string()
  .transform(value => value.split(',').map(origin => origin.trim()).filter(Boolean))
  .pipe(z.array(z.string().refine(isLoopbackOrigin, 'every entry must be an exact loopback origin such as http://127.0.0.1:5174')).min(1))

const totpKey = z
  .string()
  .trim()
  .refine(value => /^[A-Za-z0-9+/]+={0,2}$/.test(value) && Buffer.from(value, 'base64').length === 32, 'must be 32 random bytes encoded as base64 (run pnpm auth:setup-keys)')
  .transform(value => Buffer.from(value, 'base64'))

const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'test']),
  HOST: z.enum(LOOPBACK_HOSTS).default('127.0.0.1'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  LOG_LEVEL: z.enum(LOG_LEVELS).default('info'),
  DATABASE_URL: z.string().trim().min(1),
  ALLOWED_LOCAL_DATABASES: z.string().optional(),
  ALLOWED_ORIGINS: originList.optional(),
  // Secure cookies need HTTPS. Plain-http loopback development is the only environment allowed today, so the
  // default is false; production (Phase 1H) will require true.
  COOKIE_SECURE: z.enum(['true', 'false']).default('false'),
  TOTP_ENCRYPTION_KEY: totpKey,
})

export interface AppConfig {
  nodeEnv: 'development' | 'test'
  host: (typeof LOOPBACK_HOSTS)[number]
  port: number
  logLevel: (typeof LOG_LEVELS)[number]
  databaseUrl: string
  allowedDatabases: string | undefined
  allowedOrigins: string[]
  cookieSecure: boolean
  /** 32-byte AES-256-GCM key for TOTP secrets. Never logged or returned. */
  totpEncryptionKey: Buffer
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
  // Explicit production guard for the temporary privileged-email namespace (checked first, so the reason is clear
  // even though NODE_ENV=production is also refused below).
  try {
    assertNamespaceAllowed(env.NODE_ENV)
  } catch (error) {
    if (error instanceof TemporaryNamespaceInProductionError) throw new ConfigError([error.message])
    throw error
  }
  // Empty strings count as unset, so `PORT=` in .env falls back to the default instead of failing oddly.
  const present = Object.fromEntries(Object.entries(env).filter(([, value]) => value !== undefined && value !== ''))
  const result = configSchema.safeParse(present)
  if (!result.success) {
    const issues = result.error.issues.map(issue => {
      const name = String(issue.path[0] ?? 'environment')
      return name in present ? `${name}: ${issue.message}` : `${name} is required`
    })
    throw new ConfigError([...new Set(issues)])
  }
  const value = result.data
  return {
    nodeEnv: value.NODE_ENV,
    host: value.HOST,
    port: value.PORT,
    logLevel: value.LOG_LEVEL,
    databaseUrl: value.DATABASE_URL,
    allowedDatabases: value.ALLOWED_LOCAL_DATABASES,
    allowedOrigins: value.ALLOWED_ORIGINS ?? [...DEFAULT_ALLOWED_ORIGINS],
    cookieSecure: value.COOKIE_SECURE === 'true',
    totpEncryptionKey: value.TOTP_ENCRYPTION_KEY,
  }
}
