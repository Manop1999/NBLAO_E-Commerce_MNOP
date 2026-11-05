import { describe, expect, it } from 'vitest'
import { ConfigError, DEFAULT_ALLOWED_ORIGINS, loadConfig } from '../../src/config'

const URL_WITH_SECRET = 'postgresql://nblao_app:s3cret-pw@127.0.0.1:5432/nblao_dev'
const KEY = Buffer.alloc(32, 7).toString('base64')
const base = { NODE_ENV: 'development', DATABASE_URL: URL_WITH_SECRET, TOTP_ENCRYPTION_KEY: KEY }

const configError = (env: Record<string, string | undefined>): ConfigError => {
  try {
    loadConfig(env)
  } catch (error) {
    if (error instanceof ConfigError) return error
    throw error
  }
  throw new Error('expected a ConfigError')
}

describe('loadConfig', () => {
  it('applies loopback-only defaults', () => {
    expect(loadConfig(base)).toEqual({
      nodeEnv: 'development',
      host: '127.0.0.1',
      port: 3001,
      logLevel: 'info',
      databaseUrl: URL_WITH_SECRET,
      allowedDatabases: undefined,
      allowedOrigins: [...DEFAULT_ALLOWED_ORIGINS],
      cookieSecure: false,
      totpEncryptionKey: Buffer.alloc(32, 7),
    })
  })

  it('reads explicit values and coerces the port', () => {
    const config = loadConfig({ ...base, NODE_ENV: 'test', HOST: '::1', PORT: '4000', LOG_LEVEL: 'warn', ALLOWED_LOCAL_DATABASES: 'nblao_test' })
    expect(config).toMatchObject({ nodeEnv: 'test', host: '::1', port: 4000, logLevel: 'warn', allowedDatabases: 'nblao_test' })
  })

  it('treats empty strings as unset', () => {
    expect(loadConfig({ ...base, PORT: '', HOST: '' })).toMatchObject({ port: 3001, host: '127.0.0.1' })
  })

  it('requires NODE_ENV, DATABASE_URL and TOTP_ENCRYPTION_KEY', () => {
    expect(configError({}).issues).toEqual(expect.arrayContaining(['NODE_ENV is required', 'DATABASE_URL is required', 'TOTP_ENCRYPTION_KEY is required']))
    expect(configError({ ...base, DATABASE_URL: '   ' }).issues.join()).toMatch(/DATABASE_URL/)
  })

  it('refuses production and other environments', () => {
    // Production is refused first by the temporary privileged-namespace guard (with the reason), then by the schema.
    expect(configError({ ...base, NODE_ENV: 'production' }).message).toMatch(/temporary local-development placeholder/)
    for (const NODE_ENV of ['staging', 'Development']) {
      expect(configError({ ...base, NODE_ENV }).issues.join()).toMatch(/^NODE_ENV:/)
    }
  })

  it('refuses non-loopback bind addresses', () => {
    for (const HOST of ['0.0.0.0', '::', '192.168.1.10', 'localhost.example.com']) {
      expect(configError({ ...base, HOST }).issues.join()).toMatch(/^HOST:/)
    }
  })

  it('refuses invalid ports and log levels', () => {
    for (const PORT of ['0', '65536', 'abc', '3001.5']) expect(configError({ ...base, PORT }).issues.join()).toMatch(/^PORT:/)
    expect(configError({ ...base, LOG_LEVEL: 'verbose' }).issues.join()).toMatch(/^LOG_LEVEL:/)
  })

  it('never includes the database password or URL in error messages', () => {
    const error = configError({ ...base, NODE_ENV: 'staging', PORT: 'x' })
    expect(error.message).not.toContain('s3cret-pw')
    expect(error.message).not.toContain(URL_WITH_SECRET)
  })
})

describe('loadConfig: authentication settings', () => {
  it('accepts only a 32-byte base64 TOTP key and never echoes it', () => {
    const short = Buffer.alloc(16, 1).toString('base64')
    const long = Buffer.alloc(33, 1).toString('base64')
    for (const value of [short, long, 'not base64!', `${KEY}x`]) {
      const error = configError({ ...base, TOTP_ENCRYPTION_KEY: value })
      expect(error.issues.join()).toMatch(/^TOTP_ENCRYPTION_KEY:/)
      expect(error.message).not.toContain(value)
    }
  })

  it('reads an exact list of loopback origins', () => {
    const config = loadConfig({ ...base, ALLOWED_ORIGINS: 'http://127.0.0.1:5174, http://localhost:9000' })
    expect(config.allowedOrigins).toEqual(['http://127.0.0.1:5174', 'http://localhost:9000'])
  })

  it('refuses wildcard, remote, path or malformed origins', () => {
    for (const ALLOWED_ORIGINS of ['*', 'https://example.com', 'http://127.0.0.1:5174/', 'http://127.0.0.1:5174/app', 'http://user@localhost:5174', '127.0.0.1:5174', 'file:///tmp', 'http://192.168.1.2:5174']) {
      expect(configError({ ...base, ALLOWED_ORIGINS }).issues.join(), ALLOWED_ORIGINS).toMatch(/^ALLOWED_ORIGINS:/)
    }
  })

  it('reads COOKIE_SECURE as a strict boolean', () => {
    expect(loadConfig({ ...base, COOKIE_SECURE: 'true' }).cookieSecure).toBe(true)
    expect(loadConfig({ ...base, COOKIE_SECURE: 'false' }).cookieSecure).toBe(false)
    expect(configError({ ...base, COOKIE_SECURE: 'yes' }).issues.join()).toMatch(/^COOKIE_SECURE:/)
  })
})
