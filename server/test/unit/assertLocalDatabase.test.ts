import { describe, expect, it } from 'vitest'
import { assertLocalDatabase, UnsafeDatabaseTargetError } from '../../src/db/assertLocalDatabase'

const check = (databaseUrl: string | undefined, nodeEnv: string | undefined = 'test', allowedDatabases?: string) =>
  assertLocalDatabase({ databaseUrl, nodeEnv, allowedDatabases })

const refusal = (fn: () => unknown): UnsafeDatabaseTargetError => {
  try {
    fn()
  } catch (error) {
    if (error instanceof UnsafeDatabaseTargetError) return error
    throw error
  }
  throw new Error('expected the guard to refuse')
}

describe('assertLocalDatabase: accepted targets', () => {
  it('accepts localhost, 127.0.0.1 and ::1 with an allow-listed database in development or test', () => {
    expect(check('postgresql://nblao_dev:secret@localhost:5432/nblao_dev', 'development')).toEqual({
      host: 'localhost',
      port: 5432,
      database: 'nblao_dev',
      user: 'nblao_dev',
    })
    expect(check('postgres://nblao_dev@127.0.0.1/nblao_test')).toMatchObject({ host: '127.0.0.1', port: 5432, database: 'nblao_test' })
    expect(check('postgresql://nblao_dev@[::1]:5433/nblao_test')).toMatchObject({ host: '::1', port: 5433 })
  })

  it('allows harmless query parameters such as schema or sslmode', () => {
    expect(check('postgresql://u@localhost/nblao_test?schema=test_run_1&sslmode=disable').database).toBe('nblao_test')
  })
})

describe('assertLocalDatabase: refused hosts', () => {
  it('refuses remote hosts and private network addresses', () => {
    for (const host of ['db.example.com', '10.0.0.5', '192.168.1.10', '0.0.0.0', 'prod-db']) {
      expect(() => check(`postgresql://u@${host}:5432/nblao_test`)).toThrow(/database host must be one of/)
    }
  })

  it('refuses look-alike localhost names', () => {
    for (const host of ['localhost.evil.com', 'localhost.', '127.0.0.1.nip.io', 'mylocalhost', '127.1', '[::ffff:127.0.0.1]']) {
      expect(() => check(`postgresql://u@${host}/nblao_test`)).toThrow(UnsafeDatabaseTargetError)
    }
  })

  it('refuses host or hostaddr query parameters that could redirect the connection', () => {
    expect(() => check('postgresql://u@localhost/nblao_test?host=db.example.com')).toThrow(/"host" query parameter is not allowed/)
    expect(() => check('postgresql://u@localhost/nblao_test?hostaddr=10.0.0.5')).toThrow(/"hostaddr" query parameter is not allowed/)
    expect(() => check('postgresql://u@localhost/nblao_test?host=%2Fvar%2Frun%2Fpostgresql')).toThrow(/"host" query parameter/)
  })

  it('refuses redirecting query parameters in any letter case', () => {
    const cases: [string, RegExp][] = [
      ['HOST=db.example.com', /"HOST" query parameter is not allowed/],
      ['Host=db.example.com', /"Host" query parameter is not allowed/],
      ['HOSTADDR=10.0.0.5', /"HOSTADDR" query parameter is not allowed/],
      ['hostAddr=10.0.0.5', /"hostAddr" query parameter is not allowed/],
    ]
    for (const [query, message] of cases) {
      expect(() => check(`postgresql://u@localhost/nblao_test?${query}`)).toThrow(message)
    }
  })

  it('refuses the service query parameter (it can point at another host via pg_service.conf)', () => {
    expect(() => check('postgresql://u@localhost/nblao_test?service=prod')).toThrow(/"service" query parameter is not allowed/)
    expect(() => check('postgresql://u@localhost/nblao_test?SERVICE=prod')).toThrow(/"SERVICE" query parameter is not allowed/)
    expect(() => check('postgresql://u@localhost/nblao_test?sslmode=disable&Service=prod')).toThrow(/"Service" query parameter/)
  })

  it('refuses multi-host lists, percent-encoded hosts and out-of-range ports', () => {
    expect(() => check('postgresql://u@localhost,db.example.com/nblao_test')).toThrow(/database host must be one of/)
    expect(() => check('postgresql://u@localhost:5432,db.example.com:5432/nblao_test')).toThrow(UnsafeDatabaseTargetError)
    expect(() => check('postgresql://u@%6Cocalhost/nblao_test')).toThrow(/database host must be one of/)
    expect(() => check('postgresql://u@LOCALHOST/nblao_test')).toThrow(/database host must be one of/)
    expect(() => check('postgresql://u@localhost:99999/nblao_test')).toThrow(/not a valid URL/)
  })
})

describe('assertLocalDatabase: refused databases and URLs', () => {
  it('refuses databases that are not allow-listed', () => {
    for (const db of ['postgres', 'nblao_prod', 'template1', 'NBLAO_DEV']) {
      expect(() => check(`postgresql://u@localhost/${db}`)).toThrow(/database must be one of/)
    }
    expect(() => check('postgresql://u@localhost/')).toThrow(/exactly one database/)
    expect(() => check('postgresql://u@localhost')).toThrow(/exactly one database/)
    expect(() => check('postgresql://u@localhost/nblao_test/extra')).toThrow(/exactly one database/)
  })

  it('refuses missing, invalid or non-PostgreSQL URLs', () => {
    expect(() => check(undefined)).toThrow(/DATABASE_URL is not set/)
    expect(() => check('')).toThrow(/DATABASE_URL is not set/)
    expect(() => check('not a url')).toThrow(/not a valid URL/)
    expect(() => check('mysql://u@localhost/nblao_test')).toThrow(/postgres:\/\/ or postgresql:\/\//)
    expect(() => check('http://localhost/nblao_test')).toThrow(/postgres:\/\/ or postgresql:\/\//)
  })
})

describe('assertLocalDatabase: environment', () => {
  it('refuses any NODE_ENV other than development or test', () => {
    // Call the guard directly: the `check` helper's default would turn `undefined` into 'test'.
    for (const nodeEnv of ['production', 'staging', 'prod', 'Development', '', undefined]) {
      expect(() => assertLocalDatabase({ databaseUrl: 'postgresql://u@localhost/nblao_test', nodeEnv })).toThrow(/NODE_ENV must be one of/)
    }
  })
})

describe('assertLocalDatabase: allow-list configuration', () => {
  it('lets ALLOWED_LOCAL_DATABASES narrow the allow-list', () => {
    expect(check('postgresql://u@localhost/nblao_test', 'test', 'nblao_test').database).toBe('nblao_test')
    expect(check('postgresql://u@localhost/nblao_test', 'test', ' nblao_test , ').database).toBe('nblao_test')
    expect(() => check('postgresql://u@localhost/nblao_dev', 'test', 'nblao_test')).toThrow(/database must be one of nblao_test/)
  })

  it('never lets ALLOWED_LOCAL_DATABASES widen the allow-list', () => {
    expect(() => check('postgresql://u@localhost/other_db', 'test', 'nblao_test,other_db')).toThrow(/may only narrow/)
    expect(() => check('postgresql://u@localhost/nblao_test', 'test', 'nblao_test,postgres')).toThrow(/may only narrow/)
  })

  it('uses the default allow-list when the setting is empty', () => {
    expect(check('postgresql://u@localhost/nblao_dev', 'development', '').database).toBe('nblao_dev')
    expect(check('postgresql://u@localhost/nblao_dev', 'development', '   ').database).toBe('nblao_dev')
  })
})

describe('assertLocalDatabase: error reporting', () => {
  it('reports every problem at once', () => {
    const error = refusal(() => check('postgresql://u:pw@db.example.com/nblao_prod', 'production'))
    expect(error.reasons.length).toBeGreaterThanOrEqual(3)
    expect(error.name).toBe('UnsafeDatabaseTargetError')
  })

  it('never includes the database password in any error message', () => {
    const secret = 'S3cr3t-P@ss'
    const urls = [
      `postgresql://u:${encodeURIComponent(secret)}@db.example.com/prod`,
      `postgresql://u:${encodeURIComponent(secret)}@localhost/prod?host=evil`,
      `postgresql://u:${secret} not a url`,
      `mysql://u:${encodeURIComponent(secret)}@localhost/nblao_test`,
    ]
    for (const url of urls) {
      const error = refusal(() => check(url, 'production'))
      expect(error.message).not.toContain(secret)
      expect(error.message).not.toContain(encodeURIComponent(secret))
      expect(error.reasons.join(' ')).not.toContain(secret)
    }
  })

  it('does not return the password in the accepted target', () => {
    const target = check('postgresql://nblao_dev:topsecret@localhost/nblao_dev', 'development')
    expect(JSON.stringify(target)).not.toContain('topsecret')
  })
})
