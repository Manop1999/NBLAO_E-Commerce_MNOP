/**
 * CLI for `pnpm db:migrate`, `pnpm db:seed` and `pnpm db:reset`. All three refuse unless DATABASE_URL points at
 * a local, allow-listed database (assertLocalDatabase). Reset additionally requires `--yes`.
 */
import { UnsafeDatabaseTargetError } from '../src/db/assertLocalDatabase.ts'
import { guardTarget, migrate, reset, seed } from '../src/db/commands.ts'

const [command, ...flags] = process.argv.slice(2)
const env = process.env

async function main(): Promise<void> {
  switch (command) {
    case 'migrate': {
      const target = await migrate(env)
      console.log(`Migrations applied to ${target.database} on ${target.host}:${target.port}.`)
      return
    }
    case 'seed': {
      const summary = await seed(env)
      console.log(`Demo catalog seeded: ${JSON.stringify(summary)}`)
      return
    }
    case 'reset': {
      const target = guardTarget(env)
      if (!flags.includes('--yes')) {
        console.error(
          [
            `db:reset will DELETE ALL DATA in database "${target.database}" on ${target.host}:${target.port},`,
            're-apply every migration and re-seed the demo catalog. This cannot be undone.',
            'To continue, run: pnpm db:reset --yes',
          ].join('\n'),
        )
        process.exitCode = 1
        return
      }
      const summary = await reset(env)
      console.log(`Database ${target.database} reset and re-seeded: ${JSON.stringify(summary)}`)
      return
    }
    default:
      console.error('Usage: db.ts <migrate|seed|reset> [--yes]')
      process.exitCode = 1
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof UnsafeDatabaseTargetError ? error.message : error)
  process.exit(1)
})
