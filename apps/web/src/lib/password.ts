import type { PasswordHash } from '@cityreach/shared'
import { fromBase64Url, toBase64Url } from './base64url'

/**
 * Password hashing for the demo store, with WebCrypto (PBKDF2-SHA256, a random salt per
 * password). Plain-text passwords are never stored or logged.
 *
 * Honest limit: the hash lives in this browser's localStorage next to everything else, so this
 * keeps the demo from holding passwords in the clear; it is not a substitute for server-side
 * authentication.
 */
export const PBKDF2_ITERATIONS = 210_000
const ALGORITHM = 'PBKDF2-SHA256' as const
const HASH_BITS = 256
const SALT_BYTES = 16

export type PasswordRecord = PasswordHash

async function derive(password: string, salt: Uint8Array<ArrayBuffer>, iterations: number) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password.normalize('NFKC')),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    key,
    HASH_BITS,
  )
  return new Uint8Array(bits)
}

/** Hashes with a fresh random salt (or the given salt, which only the seed and tests do). */
export async function hashPassword(
  password: string,
  options: { salt?: Uint8Array<ArrayBuffer>; iterations?: number } = {},
): Promise<PasswordRecord> {
  const salt = options.salt ?? crypto.getRandomValues(new Uint8Array(SALT_BYTES))
  const iterations = options.iterations ?? PBKDF2_ITERATIONS
  return {
    algorithm: ALGORITHM,
    iterations,
    salt: toBase64Url(salt),
    hash: toBase64Url(await derive(password, salt, iterations)),
  }
}

/** Compares in constant time, so the check does not leak how many leading bytes matched. */
export async function verifyPassword(password: string, record: PasswordRecord): Promise<boolean> {
  if (record.algorithm !== ALGORITHM) return false
  const expected = fromBase64Url(record.hash)
  const actual = await derive(password, fromBase64Url(record.salt), record.iterations)
  if (expected.length !== actual.length) return false
  let difference = 0
  for (let i = 0; i < actual.length; i++) difference |= (actual[i] as number) ^ (expected[i] as number)
  return difference === 0
}
