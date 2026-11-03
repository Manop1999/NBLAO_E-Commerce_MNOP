// Applies committed migrations to nblao_test before the database tests run. Never resets or drops anything.
import { migrate } from '../../src/db/commands.ts'
import { testDbEnv } from './testEnv.ts'

export default async function setup(): Promise<void> {
  await migrate(testDbEnv())
}
