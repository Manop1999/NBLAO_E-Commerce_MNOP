import { describe, expect, it, vi } from 'vitest'
import { UnsafeDatabaseTargetError } from '../../src/db/assertLocalDatabase'
import { createDatabaseClient, type ClientFactory } from '../../src/db/client'
import { migrate, reset, seed } from '../../src/db/commands'

const REMOTE = 'postgresql://nblao_app:pw@db.example.com:5432/nblao_dev'
const WRONG_DB = 'postgresql://nblao_app:pw@127.0.0.1:5432/postgres'
const LOCAL = 'postgresql://nblao_app:pw@127.0.0.1:5432/nblao_dev'

describe('createDatabaseClient', () => {
  it('runs assertLocalDatabase before creating (and so connecting) a client', () => {
    const factory = vi.fn<ClientFactory>()
    for (const [databaseUrl, nodeEnv] of [
      [REMOTE, 'development'],
      [WRONG_DB, 'development'],
      [LOCAL, 'production'],
      ['postgresql://u@127.0.0.1/nblao_dev?host=db.example.com', 'development'],
    ] as const) {
      expect(() => createDatabaseClient({ databaseUrl, nodeEnv }, factory)).toThrow(UnsafeDatabaseTargetError)
    }
    expect(factory).not.toHaveBeenCalled()
  })

  it('creates the client for an allowed local target', () => {
    const fake = {} as ReturnType<ClientFactory>
    const factory = vi.fn<ClientFactory>(() => fake)
    const result = createDatabaseClient({ databaseUrl: LOCAL, nodeEnv: 'development' }, factory)
    expect(result.prisma).toBe(fake)
    expect(result.target).toMatchObject({ host: '127.0.0.1', database: 'nblao_dev' })
    expect(factory).toHaveBeenCalledWith(LOCAL)
  })

  it('honours a narrowed allow-list', () => {
    const factory = vi.fn<ClientFactory>()
    expect(() => createDatabaseClient({ databaseUrl: LOCAL, nodeEnv: 'test', allowedDatabases: 'nblao_test' }, factory)).toThrow(/nblao_test/)
    expect(factory).not.toHaveBeenCalled()
  })
})

describe('database-writing commands', () => {
  it('refuse remote or unlisted targets before running Prisma or connecting', async () => {
    for (const DATABASE_URL of [REMOTE, WRONG_DB, undefined]) {
      const env = { DATABASE_URL, NODE_ENV: 'development' }
      await expect(migrate(env)).rejects.toBeInstanceOf(UnsafeDatabaseTargetError)
      await expect(seed(env)).rejects.toBeInstanceOf(UnsafeDatabaseTargetError)
      await expect(reset(env)).rejects.toBeInstanceOf(UnsafeDatabaseTargetError)
    }
  })

  it('refuse production even for a local database', async () => {
    await expect(migrate({ DATABASE_URL: LOCAL, NODE_ENV: 'production' })).rejects.toThrow(/NODE_ENV/)
  })
})
