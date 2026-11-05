/**
 * Opaque random tokens (session cookies, invitation and reset links). Only SHA-256 digests are stored, so a
 * database copy cannot be used to sign in or redeem a link.
 */
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

export const TOKEN_BYTES = 32
/** 32 bytes as unpadded base64url. */
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/

export function generateToken(): string {
  return randomBytes(TOKEN_BYTES).toString('base64url')
}

export function isWellFormedToken(value: unknown): value is string {
  return typeof value === 'string' && TOKEN_PATTERN.test(value)
}

/** Bytes in the shape Prisma 7 expects for `Bytes` columns (a plain ArrayBuffer-backed Uint8Array). */
export const toBytes = (buffer: Uint8Array): Uint8Array<ArrayBuffer> => new Uint8Array(buffer)

export function hashToken(token: string): Uint8Array<ArrayBuffer> {
  return toBytes(createHash('sha256').update(token, 'utf8').digest())
}

/** Constant-time comparison; different lengths are simply unequal. */
export function safeEqual(a: Uint8Array, b: Uint8Array): boolean {
  return a.length === b.length && timingSafeEqual(a, b)
}

/**
 * CSRF synchronizer token for a session: an HMAC of the session token, so it needs no extra column, changes
 * whenever the session is rotated, and cannot be turned back into the session token.
 */
export function csrfTokenFor(sessionToken: string): string {
  return createHmac('sha256', sessionToken).update('nblao-csrf-v1').digest('base64url')
}
