/**
 * AES-256-GCM encryption for TOTP secrets at rest. Layout: 12-byte IV | 16-byte tag | ciphertext.
 * The staff id is bound as additional authenticated data, so a ciphertext copied to another row fails.
 */
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

const IV_BYTES = 12
const TAG_BYTES = 16
export const SECRET_BOX_OVERHEAD = IV_BYTES + TAG_BYTES

export class SecretBoxError extends Error {
  constructor() {
    super('secret could not be decrypted')
    this.name = 'SecretBoxError'
  }
}

function checkKey(key: Uint8Array): void {
  if (key.length !== 32) throw new Error('encryption key must be 32 bytes')
}

export function seal(key: Uint8Array, plaintext: Uint8Array, associatedData: string): Uint8Array<ArrayBuffer> {
  checkKey(key)
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  cipher.setAAD(Buffer.from(associatedData, 'utf8'))
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()])
  return new Uint8Array(Buffer.concat([iv, cipher.getAuthTag(), ciphertext]))
}

export function open(key: Uint8Array, box: Uint8Array, associatedData: string): Buffer {
  checkKey(key)
  if (box.length <= SECRET_BOX_OVERHEAD) throw new SecretBoxError()
  const buffer = Buffer.from(box)
  const decipher = createDecipheriv('aes-256-gcm', key, buffer.subarray(0, IV_BYTES))
  decipher.setAAD(Buffer.from(associatedData, 'utf8'))
  decipher.setAuthTag(buffer.subarray(IV_BYTES, SECRET_BOX_OVERHEAD))
  try {
    return Buffer.concat([decipher.update(buffer.subarray(SECRET_BOX_OVERHEAD)), decipher.final()])
  } catch {
    throw new SecretBoxError()
  }
}
