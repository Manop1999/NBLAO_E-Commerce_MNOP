/**
 * Local authentication commands (never for production):
 *   pnpm auth:setup-keys            add TOTP_ENCRYPTION_KEY to server/.env if it is missing
 *   pnpm auth:create-super-admin    create the first Super Admin (refuses if one exists)
 *   pnpm auth:reset-super-admin-mfa remove a Super Admin's 2FA when no other Super Admin can do it
 *   pnpm auth:cleanup               delete expired sessions and used/expired links (never audit events)
 *
 * Passwords are only read from a hidden interactive prompt: never from arguments, environment variables or
 * pipes, and never printed or logged. Database commands go through createDatabaseClient(), so
 * assertLocalDatabase() refuses anything but an allow-listed local database.
 */
import path from 'node:path'
import { createInterface } from 'node:readline/promises'
import { CliRefusal, cleanupExpired, createFirstSuperAdmin, ensureTotpKey, resetSuperAdminMfa } from '../src/auth/cli.ts'
import { PasswordHasher } from '../src/auth/password.ts'
import { PRIVILEGED_EMAIL_SUFFIX } from '../src/auth/privilegedNamespace.ts'
import { UnsafeDatabaseTargetError } from '../src/db/assertLocalDatabase.ts'
import { createDatabaseClient } from '../src/db/client.ts'

const SERVER_DIR = path.resolve(import.meta.dirname, '..')
const [command] = process.argv.slice(2)

function requireTerminal(): void {
  if (!process.stdin.isTTY || !process.stdout.isTTY) throw new CliRefusal('This command needs an interactive terminal (passwords are never read from pipes or arguments).')
}

async function ask(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  try {
    return (await rl.question(question)).trim()
  } finally {
    rl.close()
  }
}

/** Reads a line without echoing it. */
function askHidden(question: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const stdin = process.stdin
    process.stdout.write(question)
    stdin.setRawMode(true)
    stdin.resume()
    stdin.setEncoding('utf8')
    let value = ''
    const onData = (chunk: string) => {
      for (const char of chunk) {
        if (char === '\r' || char === '\n') {
          stdin.setRawMode(false)
          stdin.pause()
          stdin.off('data', onData)
          process.stdout.write('\n')
          resolve(value)
          return
        }
        if (char === '\u0003') {
          stdin.setRawMode(false)
          stdin.off('data', onData)
          process.stdout.write('\n')
          reject(new CliRefusal('Cancelled.'))
          return
        }
        if (char === '\u007f' || char === '\b') value = value.slice(0, -1)
        else value += char
      }
    }
    stdin.on('data', onData)
  })
}

function database() {
  return createDatabaseClient({ databaseUrl: process.env.DATABASE_URL ?? '', nodeEnv: process.env.NODE_ENV, allowedDatabases: process.env.ALLOWED_LOCAL_DATABASES })
}

async function main(): Promise<void> {
  switch (command) {
    case 'setup-keys': {
      const result = ensureTotpKey(path.join(SERVER_DIR, '.env'))
      console.log(result === 'created' ? 'Added TOTP_ENCRYPTION_KEY to server/.env (value not shown).' : 'TOTP_ENCRYPTION_KEY is already set in server/.env; it was not changed.')
      return
    }
    case 'create-super-admin': {
      requireTerminal()
      const { prisma, target } = database()
      try {
        console.log(`Creating the first Super Admin in ${target.database} on ${target.host}:${target.port}.`)
        const email = await ask(`Email (must end in ${PRIVILEGED_EMAIL_SUFFIX}): `)
        const displayName = await ask('Display name: ')
        const password = await askHidden('Password (12+ characters, hidden): ')
        if ((await askHidden('Repeat password: ')) !== password) throw new CliRefusal('The passwords do not match.')
        const created = await createFirstSuperAdmin(prisma, new PasswordHasher(), { email, displayName, password }, new Date())
        console.log(`Super Admin ${created.email} created. At first sign-in you must change the password and set up 2FA.`)
      } finally {
        await prisma.$disconnect()
      }
      return
    }
    case 'reset-super-admin-mfa': {
      requireTerminal()
      const { prisma, target } = database()
      try {
        const email = await ask(`Super Admin email in ${target.database}: `)
        if ((await ask('Type RESET to remove this account\'s 2FA and sign it out everywhere: ')) !== 'RESET') throw new CliRefusal('Cancelled.')
        await resetSuperAdminMfa(prisma, email, new Date())
        console.log('2FA removed. The account must set up 2FA again at the next sign-in.')
      } finally {
        await prisma.$disconnect()
      }
      return
    }
    case 'cleanup': {
      const { prisma, target } = database()
      try {
        const result = await cleanupExpired(prisma, new Date())
        console.log(`Removed ${result.sessions} old sessions and ${result.tokens} old links from ${target.database}. Audit events are kept.`)
      } finally {
        await prisma.$disconnect()
      }
      return
    }
    default:
      console.error('Usage: auth.ts <setup-keys|create-super-admin|reset-super-admin-mfa|cleanup>')
      process.exitCode = 1
  }
}

main().catch((error: unknown) => {
  if (error instanceof CliRefusal || error instanceof UnsafeDatabaseTargetError) console.error(error.message)
  else console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
