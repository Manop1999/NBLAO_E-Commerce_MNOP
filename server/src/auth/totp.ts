/**
 * TOTP (RFC 6238) on top of HOTP (RFC 4226) with node:crypto only: SHA-1, 6 digits, 30-second steps, one
 * step of clock drift either way. Compatible with Google Authenticator, Microsoft Authenticator and Authy.
 */
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

export const TOTP_STEP_SECONDS = 30
export const TOTP_DIGITS = 6
export const TOTP_WINDOW = 1
export const TOTP_SECRET_BYTES = 20
export const TOTP_ISSUER = 'NB LAO'

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

export function base32Encode(bytes: Uint8Array): string {
  let bits = 0
  let value = 0
  let output = ''
  for (const byte of bytes) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) output += BASE32_ALPHABET[(value << (5 - bits)) & 31]
  return output
}

export function base32Decode(text: string): Buffer {
  const clean = text.replace(/[\s=-]/g, '').toUpperCase()
  let bits = 0
  let value = 0
  const output: number[] = []
  for (const char of clean) {
    const index = BASE32_ALPHABET.indexOf(char)
    if (index < 0) throw new Error('invalid base32 character')
    value = (value << 5) | index
    bits += 5
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 255)
      bits -= 8
    }
  }
  return Buffer.from(output)
}

export function generateTotpSecret(): Buffer {
  return randomBytes(TOTP_SECRET_BYTES)
}

/** RFC 4226 HOTP. `algorithm` exists for the RFC 6238 test vectors; the app always uses SHA-1. */
export function hotp(secret: Uint8Array, counter: bigint, digits = TOTP_DIGITS, algorithm: 'sha1' | 'sha256' | 'sha512' = 'sha1'): string {
  const message = Buffer.alloc(8)
  message.writeBigUInt64BE(counter)
  const digest = createHmac(algorithm, secret).update(message).digest()
  const offset = digest[digest.length - 1]! & 0x0f
  const binary = ((digest[offset]! & 0x7f) << 24) | (digest[offset + 1]! << 16) | (digest[offset + 2]! << 8) | digest[offset + 3]!
  return String(binary % 10 ** digits).padStart(digits, '0')
}

export function timeStep(nowMs: number): bigint {
  return BigInt(Math.floor(nowMs / 1000 / TOTP_STEP_SECONDS))
}

export function totpAt(secret: Uint8Array, nowMs: number): string {
  return hotp(secret, timeStep(nowMs))
}

/**
 * Checks a code against the current step ±1. Returns the matching step, or null. A step at or before
 * `lastUsedStep` is never accepted again (replay protection), so a code works at most once.
 */
export function verifyTotp(secret: Uint8Array, code: string, nowMs: number, lastUsedStep: bigint | null): bigint | null {
  const normalized = code.replace(/\s/g, '')
  if (!/^\d{6}$/.test(normalized)) return null
  const current = timeStep(nowMs)
  const expected = Buffer.from(normalized)
  let matched: bigint | null = null
  // Check every candidate (no early exit) so timing does not reveal which step matched.
  for (let offset = -TOTP_WINDOW; offset <= TOTP_WINDOW; offset += 1) {
    const step = current + BigInt(offset)
    if (step < 0n) continue
    const candidate = Buffer.from(hotp(secret, step))
    if (timingSafeEqual(candidate, expected) && (lastUsedStep === null || step > lastUsedStep) && matched === null) matched = step
  }
  return matched
}

/** `otpauth://` URI for authenticator apps (the QR code encodes exactly this). */
export function otpauthUri(secret: Uint8Array, accountName: string): string {
  const label = `${encodeURIComponent(TOTP_ISSUER)}:${encodeURIComponent(accountName)}`
  const params = new URLSearchParams({
    secret: base32Encode(secret),
    issuer: TOTP_ISSUER,
    algorithm: 'SHA1',
    digits: String(TOTP_DIGITS),
    period: String(TOTP_STEP_SECONDS),
  })
  return `otpauth://totp/${label}?${params.toString()}`
}

/** Manual-entry key, grouped in fours for readability. */
export function formatManualKey(secret: Uint8Array): string {
  return base32Encode(secret).replace(/(.{4})(?=.)/g, '$1 ')
}
