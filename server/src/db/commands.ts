/**
 * Database-writing commands. Each one calls assertLocalDatabase() before doing anything, and the Prisma CLI
 * child process receives exactly the DATABASE_URL that was checked.
 */
import { spawn } from 'node:child_process'
import path from 'node:path'
import { assertLocalDatabase, type LocalDatabaseTarget } from './assertLocalDatabase.ts'
import { createDatabaseClient } from './client.ts'
import { loadDemoCatalog, seedDemoCatalog, type SeedSummary } from './seed.ts'

export interface CommandEnv {
  DATABASE_URL?: string | undefined
  NODE_ENV?: string | undefined
  ALLOWED_LOCAL_DATABASES?: string | undefined
}

const SERVER_DIR = path.resolve(import.meta.dirname, '../..')

export function guardTarget(env: CommandEnv): LocalDatabaseTarget {
  return assertLocalDatabase({ databaseUrl: env.DATABASE_URL, nodeEnv: env.NODE_ENV, allowedDatabases: env.ALLOWED_LOCAL_DATABASES })
}

function runPrisma(args: string[], env: CommandEnv): Promise<void> {
  const prismaCli = path.join(SERVER_DIR, 'node_modules', 'prisma', 'build', 'index.js')
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [prismaCli, ...args], {
      cwd: SERVER_DIR,
      stdio: 'inherit',
      env: { ...process.env, DATABASE_URL: env.DATABASE_URL, NODE_ENV: env.NODE_ENV },
    })
    child.on('error', reject)
    child.on('exit', code => (code === 0 ? resolve() : reject(new Error(`prisma ${args.join(' ')} exited with code ${code}`))))
  })
}

/** Applies committed migrations (never creates new ones). */
export async function migrate(env: CommandEnv): Promise<LocalDatabaseTarget> {
  const target = guardTarget(env)
  await runPrisma(['migrate', 'deploy'], env)
  return target
}

export async function seed(env: CommandEnv): Promise<SeedSummary> {
  guardTarget(env)
  const { prisma } = createDatabaseClient({ databaseUrl: env.DATABASE_URL ?? '', nodeEnv: env.NODE_ENV, allowedDatabases: env.ALLOWED_LOCAL_DATABASES })
  try {
    return await seedDemoCatalog(prisma, await loadDemoCatalog())
  } finally {
    await prisma.$disconnect()
  }
}

/** Drops every table in the target database, re-applies all migrations and re-seeds the demo catalog. */
export async function reset(env: CommandEnv): Promise<SeedSummary> {
  guardTarget(env)
  await runPrisma(['migrate', 'reset', '--force'], env)
  return seed(env)
}
