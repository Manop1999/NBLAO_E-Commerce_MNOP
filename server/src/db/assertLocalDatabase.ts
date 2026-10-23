/**
 * Guard that must run before any migration or database-writing command.
 *
 * It refuses unless ALL of these hold:
 * - `DATABASE_URL` is a `postgres:`/`postgresql:` URL whose host is exactly `localhost`, `127.0.0.1` or `::1`,
 *   with no `host`, `hostaddr` or `service` query parameter (in any letter case) that could redirect the
 *   connection elsewhere;
 * - the database name is on the allow-list (`nblao_dev`, `nblao_test`); `ALLOWED_LOCAL_DATABASES` may only
 *   narrow that list, never widen it;
 * - `NODE_ENV` is `development` or `test`.
 *
 * It never connects to anything and never includes the password in its errors.
 */

export const LOCAL_HOSTS = ['localhost', '127.0.0.1', '::1'] as const
export const DEFAULT_ALLOWED_DATABASES = ['nblao_dev', 'nblao_test'] as const
export const ALLOWED_NODE_ENVS = ['development', 'test'] as const
/** Query parameters refused in any letter case because they can redirect the connection. */
export const REDIRECTING_QUERY_PARAMS: readonly string[] = ['host', 'hostaddr', 'service']

export interface GuardInput {
  databaseUrl: string | undefined
  nodeEnv: string | undefined
  /** Optional comma-separated subset of DEFAULT_ALLOWED_DATABASES (e.g. the ALLOWED_LOCAL_DATABASES env var). */
  allowedDatabases?: string | undefined
}

export interface LocalDatabaseTarget {
  host: string
  port: number
  database: string
  user: string
}

export class UnsafeDatabaseTargetError extends Error {
  readonly reasons: string[]

  constructor(reasons: string[]) {
    super(`Refusing database operation: ${reasons.join('; ')}`)
    this.name = 'UnsafeDatabaseTargetError'
    this.reasons = reasons
  }
}

const isOneOf = (list: readonly string[], value: string): boolean => list.includes(value)

function resolveAllowedDatabases(raw: string | undefined, reasons: string[]): readonly string[] {
  if (raw === undefined || raw.trim() === '') return DEFAULT_ALLOWED_DATABASES
  const requested = raw.split(',').map(name => name.trim()).filter(Boolean)
  const widened = requested.filter(name => !isOneOf(DEFAULT_ALLOWED_DATABASES, name))
  if (widened.length > 0) {
    reasons.push(`ALLOWED_LOCAL_DATABASES may only narrow the allow-list; not permitted: ${widened.join(', ')}`)
  }
  return requested.filter(name => isOneOf(DEFAULT_ALLOWED_DATABASES, name))
}

export function assertLocalDatabase(input: GuardInput): LocalDatabaseTarget {
  const reasons: string[] = []

  if (input.nodeEnv === undefined || !isOneOf(ALLOWED_NODE_ENVS, input.nodeEnv)) {
    reasons.push(`NODE_ENV must be one of ${ALLOWED_NODE_ENVS.join(', ')} (got ${input.nodeEnv === undefined ? 'unset' : JSON.stringify(input.nodeEnv)})`)
  }

  const allowed = resolveAllowedDatabases(input.allowedDatabases, reasons)

  if (!input.databaseUrl) {
    reasons.push('DATABASE_URL is not set')
    throw new UnsafeDatabaseTargetError(reasons)
  }

  let url: URL
  try {
    url = new URL(input.databaseUrl)
  } catch {
    // Do not echo the raw value: it may contain a password.
    reasons.push('DATABASE_URL is not a valid URL')
    throw new UnsafeDatabaseTargetError(reasons)
  }

  if (url.protocol !== 'postgres:' && url.protocol !== 'postgresql:') {
    reasons.push(`DATABASE_URL must use postgres:// or postgresql:// (got ${url.protocol})`)
  }

  // IPv6 hosts come back bracketed ("[::1]") for non-special URL schemes.
  const host = url.hostname.replace(/^\[(.*)\]$/, '$1')
  if (!isOneOf(LOCAL_HOSTS, host)) {
    reasons.push(`database host must be one of ${LOCAL_HOSTS.join(', ')} (got ${host || 'empty'})`)
  }

  // Parameters that can send the connection somewhere else (`service` via pg_service.conf). Compared without
  // regard to case so spellings such as `HOST` or `Service` are refused too.
  for (const name of new Set(url.searchParams.keys())) {
    if (REDIRECTING_QUERY_PARAMS.includes(name.toLowerCase())) reasons.push(`the "${name}" query parameter is not allowed`)
  }

  let database = ''
  try {
    database = decodeURIComponent(url.pathname.replace(/^\//, ''))
  } catch {
    reasons.push('database name is not valid')
  }
  if (!database || database.includes('/')) {
    reasons.push('DATABASE_URL must name exactly one database')
  } else if (!allowed.includes(database)) {
    reasons.push(`database must be one of ${allowed.join(', ') || '(none allowed)'} (got ${database})`)
  }

  if (reasons.length > 0) throw new UnsafeDatabaseTargetError(reasons)

  let user = url.username
  try {
    user = decodeURIComponent(url.username)
  } catch {
    // keep the raw (still non-secret) username
  }

  return { host, port: url.port ? Number(url.port) : 5432, database, user }
}
