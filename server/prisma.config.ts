// Prisma CLI configuration. The CLI does not read .env by itself, so a local server/.env is loaded here when
// present (it never overrides variables that are already set). DATABASE_URL is only needed for commands that
// touch the database; `prisma generate` works without it.
//
// Every Prisma command that has a DATABASE_URL — including direct use such as `pnpm exec prisma migrate reset`
// or `prisma db push` — is checked by assertLocalDatabase() here, before Prisma can connect. The db:* scripts
// check the same target again.
import { existsSync } from 'node:fs'
import { defineConfig } from 'prisma/config'
import { assertLocalDatabase } from './src/db/assertLocalDatabase.ts'

if (existsSync('.env')) process.loadEnvFile('.env')

const databaseUrl = process.env.DATABASE_URL
if (databaseUrl) {
  assertLocalDatabase({ databaseUrl, nodeEnv: process.env.NODE_ENV, allowedDatabases: process.env.ALLOWED_LOCAL_DATABASES })
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  ...(databaseUrl ? { datasource: { url: databaseUrl } } : {}),
})
