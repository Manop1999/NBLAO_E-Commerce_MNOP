/**
 * Environment for database integration tests. They only ever use TEST_DATABASE_URL, and the allow-list is
 * narrowed to nblao_test, so assertLocalDatabase() refuses nblao_dev or anything else.
 */
import { existsSync } from 'node:fs'
import path from 'node:path'

const SERVER_DIR = path.resolve(import.meta.dirname, '../..')

export interface TestDbEnv {
  DATABASE_URL: string
  NODE_ENV: 'test'
  ALLOWED_LOCAL_DATABASES: 'nblao_test'
}

export function testDbEnv(): TestDbEnv {
  const envFile = path.join(SERVER_DIR, '.env')
  if (!process.env.TEST_DATABASE_URL && existsSync(envFile)) process.loadEnvFile(envFile)
  const url = process.env.TEST_DATABASE_URL
  if (!url) throw new Error('TEST_DATABASE_URL is not set (see server/.env.example)')
  return { DATABASE_URL: url, NODE_ENV: 'test', ALLOWED_LOCAL_DATABASES: 'nblao_test' }
}
