/** Shared dependencies of the authentication services. Everything time-related goes through `now()`. */
import type { Prisma, PrismaClient } from '../generated/prisma/client.ts'
import type { PasswordHasher } from './password.ts'

export type Db = PrismaClient | Prisma.TransactionClient

export interface AuthContext {
  prisma: PrismaClient
  hasher: PasswordHasher
  /** 32-byte key for TOTP secrets at rest. */
  totpKey: Buffer
  now: () => Date
}

/** Lower-cases and trims an email so lookups match the lower-case CHECK in the database. */
export const normalizeEmail = (email: string): string => email.trim().toLowerCase()
