/**
 * 2FA recovery codes: 10 per enrolment, 10 characters each from an alphabet without look-alikes
 * (about 50 bits), shown once as `XXXXX-XXXXX`, stored as SHA-256 digests and usable once.
 */
import { createHash, randomInt } from 'node:crypto'

export const RECOVERY_CODE_COUNT = 10
export const RECOVERY_CODE_LENGTH = 10
/** No 0/O, 1/I/L. */
export const RECOVERY_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

export function generateRecoveryCode(): string {
  let code = ''
  for (let i = 0; i < RECOVERY_CODE_LENGTH; i += 1) code += RECOVERY_ALPHABET[randomInt(RECOVERY_ALPHABET.length)]
  return `${code.slice(0, 5)}-${code.slice(5)}`
}

export function generateRecoveryCodes(count = RECOVERY_CODE_COUNT): string[] {
  const codes = new Set<string>()
  while (codes.size < count) codes.add(generateRecoveryCode())
  return [...codes]
}

/** Upper-cases and removes spaces and hyphens; returns null when the input cannot be a recovery code. */
export function normalizeRecoveryCode(input: string): string | null {
  const normalized = input.replace(/[\s-]/g, '').toUpperCase()
  if (normalized.length !== RECOVERY_CODE_LENGTH) return null
  for (const char of normalized) if (!RECOVERY_ALPHABET.includes(char)) return null
  return normalized
}

export function hashRecoveryCode(code: string): Uint8Array<ArrayBuffer> {
  const normalized = normalizeRecoveryCode(code)
  if (!normalized) throw new Error('not a recovery code')
  return new Uint8Array(createHash('sha256').update(`nblao-recovery-v1:${normalized}`, 'utf8').digest())
}
