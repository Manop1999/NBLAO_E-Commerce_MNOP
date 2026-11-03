/**
 * Local development entry point (`pnpm dev`). Order matters: configuration is validated, then the database
 * target is checked by assertLocalDatabase() (inside createDatabaseClient), and only then does anything
 * connect or listen.
 */
import { buildApp } from './app.ts'
import { createPrismaCatalogReader } from './catalog/reader.ts'
import { ConfigError, loadConfig } from './config.ts'
import { UnsafeDatabaseTargetError } from './db/assertLocalDatabase.ts'
import { createDatabaseClient, pingDatabase } from './db/client.ts'

async function main(): Promise<void> {
  const config = loadConfig(process.env)
  const { prisma, target } = createDatabaseClient(config)
  const app = buildApp({
    logLevel: config.logLevel,
    checkDatabase: () => pingDatabase(prisma),
    catalog: createPrismaCatalogReader(prisma),
  })

  const shutdown = async (signal: string) => {
    app.log.info({ signal }, 'shutting down')
    await app.close()
    await prisma.$disconnect()
    process.exit(0)
  }
  process.once('SIGINT', () => void shutdown('SIGINT'))
  process.once('SIGTERM', () => void shutdown('SIGTERM'))

  app.log.info({ database: target.database, databaseHost: target.host }, 'database target accepted')
  await app.listen({ host: config.host, port: config.port })
}

main().catch((error: unknown) => {
  // Configuration and guard errors are expected and never contain secrets; print them without a stack.
  if (error instanceof ConfigError || error instanceof UnsafeDatabaseTargetError) {
    console.error(error.message)
  } else {
    console.error(error)
  }
  process.exit(1)
})
