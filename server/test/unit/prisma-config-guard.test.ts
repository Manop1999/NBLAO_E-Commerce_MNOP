import { afterEach, describe, expect, it, vi } from 'vitest'

// prisma.config.ts runs its guard at import time, as the Prisma CLI loads it. Each case imports a fresh copy.
const loadConfig = async () => {
  vi.resetModules()
  return (await import('../../prisma.config.ts')).default
}

const stub = (env: Record<string, string>) => {
  for (const [name, value] of Object.entries(env)) vi.stubEnv(name, value)
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('prisma.config.ts guard (direct Prisma CLI use)', () => {
  it('refuses a remote host before Prisma can connect', async () => {
    stub({ NODE_ENV: 'development', DATABASE_URL: 'postgresql://nblao_app:pw@db.example.com:5432/nblao_dev' })
    await expect(loadConfig()).rejects.toThrow(/Refusing database operation: database host must be one of/)
  })

  it('refuses a database outside the allow-list and production NODE_ENV', async () => {
    stub({ NODE_ENV: 'development', DATABASE_URL: 'postgresql://nblao_app:pw@127.0.0.1:5432/postgres' })
    await expect(loadConfig()).rejects.toThrow(/database must be one of/)
    stub({ NODE_ENV: 'production', DATABASE_URL: 'postgresql://nblao_app:pw@127.0.0.1:5432/nblao_dev' })
    await expect(loadConfig()).rejects.toThrow(/NODE_ENV must be one of/)
  })

  it('never puts the password in the refusal message', async () => {
    stub({ NODE_ENV: 'development', DATABASE_URL: 'postgresql://nblao_app:topsecret@db.example.com/nblao_dev' })
    await expect(loadConfig()).rejects.not.toThrow(/topsecret/)
  })

  it('accepts a local allow-listed database and passes exactly that URL to Prisma', async () => {
    const url = 'postgresql://nblao_app:pw@127.0.0.1:5432/nblao_test'
    stub({ NODE_ENV: 'test', DATABASE_URL: url })
    const config = await loadConfig()
    expect(config.datasource?.url).toBe(url)
  })

  it('has no datasource (so `prisma generate` still works) when DATABASE_URL is empty', async () => {
    stub({ NODE_ENV: 'test', DATABASE_URL: '' })
    const config = await loadConfig()
    expect(config.datasource).toBeUndefined()
  })
})
