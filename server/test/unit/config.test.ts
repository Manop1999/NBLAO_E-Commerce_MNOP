import { describe, expect, it } from 'vitest'
import { ConfigError, loadConfig } from '../../src/config'

const URL_WITH_SECRET = 'postgresql://nblao_app:s3cret-pw@127.0.0.1:5432/nblao_dev'
const base = { NODE_ENV: 'development', DATABASE_URL: URL_WITH_SECRET }

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
    })
  })

  it('reads explicit values and coerces the port', () => {
    const config = loadConfig({ ...base, NODE_ENV: 'test', HOST: '::1', PORT: '4000', LOG_LEVEL: 'warn', ALLOWED_LOCAL_DATABASES: 'nblao_test' })
    expect(config).toMatchObject({ nodeEnv: 'test', host: '::1', port: 4000, logLevel: 'warn', allowedDatabases: 'nblao_test' })
  })

  it('treats empty strings as unset', () => {
    expect(loadConfig({ ...base, PORT: '', HOST: '' })).toMatchObject({ port: 3001, host: '127.0.0.1' })
  })

  it('requires NODE_ENV and DATABASE_URL', () => {
    expect(configError({}).issues).toEqual(expect.arrayContaining(['NODE_ENV is required', 'DATABASE_URL is required']))
    expect(configError({ NODE_ENV: 'development', DATABASE_URL: '   ' }).issues.join()).toMatch(/DATABASE_URL/)
  })

  it('refuses production and other environments', () => {
    for (const NODE_ENV of ['production', 'staging', 'Development']) {
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
    const error = configError({ ...base, NODE_ENV: 'production', PORT: 'x' })
    expect(error.message).not.toContain('s3cret-pw')
    expect(error.message).not.toContain(URL_WITH_SECRET)
  })
})
