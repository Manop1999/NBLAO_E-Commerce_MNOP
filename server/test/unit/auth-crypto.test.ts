import { describe, expect, it } from 'vitest'
import { generateRecoveryCode, generateRecoveryCodes, hashRecoveryCode, normalizeRecoveryCode, RECOVERY_ALPHABET } from '../../src/auth/recoveryCodes'
import { open, seal, SecretBoxError } from '../../src/auth/secretBox'
import { csrfTokenFor, generateToken, hashToken, isWellFormedToken, safeEqual } from '../../src/auth/tokens'
import { base32Decode, base32Encode, formatManualKey, hotp, otpauthUri, timeStep, totpAt, verifyTotp } from '../../src/auth/totp'

describe('TOTP / HOTP', () => {
  const rfcSecret = Buffer.from('12345678901234567890', 'ascii')

  it('matches the RFC 4226 HOTP test values', () => {
    const expected = ['755224', '287082', '359152', '969429', '338314', '254676', '287922', '162583', '399871', '520489']
    expected.forEach((value, counter) => expect(hotp(rfcSecret, BigInt(counter))).toBe(value))
  })

  it('matches the RFC 6238 SHA-1 test vectors (8 digits)', () => {
    const vectors: [number, string][] = [
      [59, '94287082'],
      [1_111_111_109, '07081804'],
      [1_111_111_111, '14050471'],
      [1_234_567_890, '89005924'],
      [2_000_000_000, '69279037'],
      [20_000_000_000, '65353130'],
    ]
    for (const [seconds, value] of vectors) expect(hotp(rfcSecret, timeStep(seconds * 1000), 8)).toBe(value)
  })

  it('matches the RFC 6238 SHA-256 and SHA-512 vectors', () => {
    const sha256Secret = Buffer.from('12345678901234567890123456789012', 'ascii')
    const sha512Secret = Buffer.from('1234567890123456789012345678901234567890123456789012345678901234', 'ascii')
    expect(hotp(sha256Secret, timeStep(59_000), 8, 'sha256')).toBe('46119246')
    expect(hotp(sha512Secret, timeStep(59_000), 8, 'sha512')).toBe('90693936')
  })

  it('accepts the current step and one step either side, and nothing further', () => {
    const now = 1_700_000_000_000
    const at = (offsetSteps: number) => totpAt(rfcSecret, now + offsetSteps * 30_000)
    expect(verifyTotp(rfcSecret, at(0), now, null)).toBe(timeStep(now))
    expect(verifyTotp(rfcSecret, at(-1), now, null)).toBe(timeStep(now) - 1n)
    expect(verifyTotp(rfcSecret, at(1), now, null)).toBe(timeStep(now) + 1n)
    expect(verifyTotp(rfcSecret, at(-2), now, null)).toBeNull()
    expect(verifyTotp(rfcSecret, at(2), now, null)).toBeNull()
  })

  it('refuses a code from a step that was already used (replay)', () => {
    const now = 1_700_000_000_000
    const code = totpAt(rfcSecret, now)
    const step = verifyTotp(rfcSecret, code, now, null)
    expect(step).not.toBeNull()
    expect(verifyTotp(rfcSecret, code, now, step)).toBeNull()
    expect(verifyTotp(rfcSecret, totpAt(rfcSecret, now - 30_000), now, step)).toBeNull()
  })

  it('rejects malformed codes', () => {
    for (const code of ['', '12345', '1234567', 'abcdef', '12 34 5x']) expect(verifyTotp(rfcSecret, code, 0, null)).toBeNull()
  })

  it('round-trips base32 and builds an authenticator URI', () => {
    const secret = Buffer.from('0123456789abcdefghij')
    expect(base32Decode(base32Encode(secret))).toEqual(secret)
    expect(base32Encode(Buffer.from('foobar'))).toBe('MZXW6YTBOI')
    expect(base32Decode(formatManualKey(secret))).toEqual(secret)
    const uri = new URL(otpauthUri(secret, 'sa@example.test'))
    expect(uri.protocol).toBe('otpauth:')
    expect(uri.host).toBe('totp')
    expect(decodeURIComponent(uri.pathname)).toBe('/NB LAO:sa@example.test')
    expect(Object.fromEntries(uri.searchParams)).toEqual({ secret: base32Encode(secret), issuer: 'NB LAO', algorithm: 'SHA1', digits: '6', period: '30' })
  })
})

describe('secret box (AES-256-GCM)', () => {
  const key = Buffer.alloc(32, 9)
  const secret = Buffer.from('totp-secret-20-bytes')

  it('round-trips and never stores the plaintext', () => {
    const box = seal(key, secret, 'staff-1')
    expect(Buffer.from(box).includes(secret)).toBe(false)
    expect(open(key, box, 'staff-1')).toEqual(secret)
    expect(Buffer.from(seal(key, secret, 'staff-1')).equals(Buffer.from(box))).toBe(false)
  })

  it('detects tampering, another row id and another key', () => {
    const box = seal(key, secret, 'staff-1')
    for (const index of [0, 13, 30, box.length - 1]) {
      const tampered = new Uint8Array(box)
      tampered[index] = tampered[index]! ^ 1
      expect(() => open(key, tampered, 'staff-1')).toThrow(SecretBoxError)
    }
    expect(() => open(key, box, 'staff-2')).toThrow(SecretBoxError)
    expect(() => open(Buffer.alloc(32, 8), box, 'staff-1')).toThrow(SecretBoxError)
    expect(() => open(key, box.subarray(0, 20), 'staff-1')).toThrow(SecretBoxError)
    expect(() => seal(Buffer.alloc(16), secret, 'x')).toThrow(/32 bytes/)
  })
})

describe('tokens', () => {
  it('are 32 random bytes in base64url, hashed with SHA-256', () => {
    const token = generateToken()
    expect(isWellFormedToken(token)).toBe(true)
    expect(Buffer.from(token, 'base64url')).toHaveLength(32)
    expect(hashToken(token)).toHaveLength(32)
    expect(new Set(Array.from({ length: 200 }, generateToken)).size).toBe(200)
    for (const bad of ['', 'short', `${token}x`, token.replace(/.$/, '!'), 42, null]) expect(isWellFormedToken(bad)).toBe(false)
  })

  it('compare in constant time and derive a per-session CSRF token', () => {
    expect(safeEqual(Buffer.from('abc'), Buffer.from('abc'))).toBe(true)
    expect(safeEqual(Buffer.from('abc'), Buffer.from('abd'))).toBe(false)
    expect(safeEqual(Buffer.from('abc'), Buffer.from('abcd'))).toBe(false)
    const a = generateToken()
    const b = generateToken()
    expect(csrfTokenFor(a)).toBe(csrfTokenFor(a))
    expect(csrfTokenFor(a)).not.toBe(csrfTokenFor(b))
    expect(csrfTokenFor(a)).not.toContain(a)
  })
})

describe('recovery codes', () => {
  it('are ten unique XXXXX-XXXXX codes from the unambiguous alphabet', () => {
    const codes = generateRecoveryCodes()
    expect(codes).toHaveLength(10)
    expect(new Set(codes).size).toBe(10)
    for (const code of codes) expect(code).toMatch(new RegExp(`^[${RECOVERY_ALPHABET}]{5}-[${RECOVERY_ALPHABET}]{5}$`))
    expect(RECOVERY_ALPHABET).not.toMatch(/[01IOL]/)
  })

  it('normalise case, spaces and hyphens before hashing', () => {
    const code = generateRecoveryCode()
    const loose = ` ${code.toLowerCase().replace('-', ' ')} `
    expect(normalizeRecoveryCode(loose)).toBe(code.replace('-', ''))
    expect(Buffer.from(hashRecoveryCode(loose)).equals(Buffer.from(hashRecoveryCode(code)))).toBe(true)
    expect(hashRecoveryCode(code)).toHaveLength(32)
    for (const bad of ['', '123456', 'ABCDE-FGHI0', 'ABCDE-FGHIJK']) expect(normalizeRecoveryCode(bad)).toBeNull()
  })
})
