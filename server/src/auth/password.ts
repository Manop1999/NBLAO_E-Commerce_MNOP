/**
 * Password hashing (Argon2id, OWASP minimum parameters) and the password policy:
 * 12–128 characters, not equal to or containing the email (or its local part), not on the common-password
 * list. No composition rules.
 */
import { hash, parseOptions, verify, type Algorithm, type Options } from '@node-rs/argon2'
import { COMMON_PASSWORDS } from './commonPasswords.ts'

/** `Algorithm.Argon2id` (a const enum, which isolated modules cannot read). */
const ARGON2ID = 2 as Algorithm

export interface HashParameters {
  memoryCost: number
  timeCost: number
  parallelism: number
}

/** 19 MiB, 2 iterations, 1 lane (OWASP Password Storage Cheat Sheet minimum for Argon2id). */
export const DEFAULT_HASH_PARAMETERS: HashParameters = { memoryCost: 19_456, timeCost: 2, parallelism: 1 }

export const PASSWORD_MIN_LENGTH = 12
export const PASSWORD_MAX_LENGTH = 128

export type PasswordProblem = 'too_short' | 'too_long' | 'contains_email' | 'too_common'

/** Returns the reasons a new password is refused (empty when acceptable). Length counts Unicode code points. */
export function checkPasswordPolicy(password: string, email?: string): PasswordProblem[] {
  const problems: PasswordProblem[] = []
  const length = [...password].length
  if (length < PASSWORD_MIN_LENGTH) problems.push('too_short')
  if (length > PASSWORD_MAX_LENGTH) problems.push('too_long')
  const lower = password.toLowerCase()
  if (email) {
    const normalized = email.trim().toLowerCase()
    const local = normalized.split('@')[0] ?? ''
    if (lower.includes(normalized) || (local.length >= 4 && lower.includes(local))) problems.push('contains_email')
  }
  if (COMMON_PASSWORDS.has(lower) || /^(.)\1+$/.test(password)) problems.push('too_common')
  return problems
}

export class PasswordHasher {
  readonly parameters: HashParameters
  private dummyHash: Promise<string> | undefined

  constructor(parameters: HashParameters = DEFAULT_HASH_PARAMETERS) {
    this.parameters = parameters
  }

  private options(): Options {
    return { algorithm: ARGON2ID, ...this.parameters }
  }

  hash(password: string): Promise<string> {
    return hash(password, this.options())
  }

  async verify(passwordHash: string, password: string): Promise<boolean> {
    try {
      return await verify(passwordHash, password)
    } catch {
      return false
    }
  }

  /**
   * Spends the same time as a real verification when there is no account (or no password yet), so response
   * timing does not reveal which emails exist.
   */
  async verifyDummy(password: string): Promise<false> {
    this.dummyHash ??= this.hash('nblao-dummy-password-for-timing')
    await this.verify(await this.dummyHash, password)
    return false
  }

  /** True when a stored hash uses other parameters than the current ones (upgrade it after a good login). */
  needsRehash(passwordHash: string): boolean {
    try {
      const parsed = parseOptions(passwordHash)
      return (
        parsed.algorithm !== ARGON2ID ||
        parsed.memoryCost !== this.parameters.memoryCost ||
        parsed.timeCost !== this.parameters.timeCost ||
        parsed.parallelism !== this.parameters.parallelism
      )
    } catch {
      return true
    }
  }
}
