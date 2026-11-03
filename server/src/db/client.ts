/**
 * The only way the server creates a database client. assertLocalDatabase() runs first, so a remote host or
 * a database outside the allow-list is refused before any connection is attempted.
 */
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../generated/prisma/client.ts'
import { assertLocalDatabase, type LocalDatabaseTarget } from './assertLocalDatabase.ts'

export interface DatabaseSettings {
  databaseUrl: string
  nodeEnv: string | undefined
  allowedDatabases?: string | undefined
}

/** Fail fast when PostgreSQL is not reachable instead of waiting for the OS TCP timeout. */
export const CONNECT_TIMEOUT_MS = 3_000

export type ClientFactory = (databaseUrl: string) => PrismaClient

export const defaultClientFactory: ClientFactory = databaseUrl =>
  new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl, connectionTimeoutMillis: CONNECT_TIMEOUT_MS }) })

export function createDatabaseClient(
  settings: DatabaseSettings,
  factory: ClientFactory = defaultClientFactory,
): { prisma: PrismaClient; target: LocalDatabaseTarget } {
  const target = assertLocalDatabase({
    databaseUrl: settings.databaseUrl,
    nodeEnv: settings.nodeEnv,
    allowedDatabases: settings.allowedDatabases,
  })
  return { prisma: factory(settings.databaseUrl), target }
}

/** Readiness check: resolves when the database answers a trivial query, rejects otherwise. */
export async function pingDatabase(prisma: PrismaClient): Promise<void> {
  await prisma.$queryRaw`SELECT 1`
}
