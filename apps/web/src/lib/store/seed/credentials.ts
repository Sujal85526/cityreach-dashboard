import { COLLECTIONS, DEMO_PASSWORD, seedLoginId, type Credential, type PasswordHash } from '@cityreach/shared'
import type { SeedDb } from './adapter'

/**
 * The seed is built synchronously, but hashing is async, so the demo password's hash is a
 * constant worked out once with `hashPassword(DEMO_PASSWORD, { salt: SEED_SALT })`. A test
 * re-derives it and fails if the password, salt or iteration count ever drift apart.
 * All seeded staff share this one hash (and salt) because they share the public demo password;
 * every password set in the app afterwards gets its own random salt.
 */
export const SEED_SALT = 'cityreach-demo-1'
export const SEED_PASSWORD_RECORD: PasswordHash = {
  algorithm: 'PBKDF2-SHA256',
  iterations: 210_000,
  salt: 'Y2l0eXJlYWNoLWRlbW8tMQ',
  hash: 'LbjmbIuGoWZaDrcRAciUCx0lkM_XV0_q5qdqrSt1X30',
}
export { DEMO_PASSWORD }

/** A login ID and the demo password for every seeded user of every branch. */
export function seedCredentials(db: SeedDb, now: Date) {
  const writer = db.bulkWriter()
  for (const [uid, user] of Object.entries(db.data[COLLECTIONS.users] ?? {})) {
    const credential: Omit<Credential, 'id'> = {
      loginId: seedLoginId(uid),
      branchId: String(user.branchId),
      password: SEED_PASSWORD_RECORD,
      failedAttempts: 0,
      lockedUntil: null,
      passwordChangedAt: now,
    }
    writer.set(db.collection(COLLECTIONS.credentials).doc(uid), { ...credential })
  }
}
