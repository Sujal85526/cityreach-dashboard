import { DEMO_PASSWORD } from '@cityreach/shared'
import { describe, expect, it } from 'vitest'
import { hashPassword, verifyPassword } from './password'
import { SEED_PASSWORD_RECORD, SEED_SALT } from './store/seed/credentials'

// A low count keeps the suite quick; the real one is covered by the seed test below.
const FAST = { iterations: 1000 }

describe('password hashing', () => {
  it('verifies the right password and rejects a wrong one', async () => {
    const record = await hashPassword('correct horse', FAST)
    expect(await verifyPassword('correct horse', record)).toBe(true)
    expect(await verifyPassword('correct horsf', record)).toBe(false)
    expect(await verifyPassword('', record)).toBe(false)
  })

  it('never stores the password and uses a fresh salt each time', async () => {
    const a = await hashPassword('same password', FAST)
    const b = await hashPassword('same password', FAST)
    expect(JSON.stringify(a)).not.toContain('same password')
    expect(a.salt).not.toBe(b.salt)
    expect(a.hash).not.toBe(b.hash)
    expect(await verifyPassword('same password', b)).toBe(true)
  })

  it('rejects a record with a different algorithm or a truncated hash', async () => {
    const record = await hashPassword('x-password', FAST)
    expect(await verifyPassword('x-password', { ...record, algorithm: 'MD5' as never })).toBe(false)
    expect(await verifyPassword('x-password', { ...record, hash: record.hash.slice(0, 10) })).toBe(
      false,
    )
  })

  it('treats equivalent unicode spellings as the same password', async () => {
    const record = await hashPassword('café-password', FAST)
    expect(await verifyPassword('café-password', record)).toBe(true)
  })

  it('the seeded constant is really the hash of the public demo password', async () => {
    const derived = await hashPassword(DEMO_PASSWORD, {
      salt: new TextEncoder().encode(SEED_SALT),
      iterations: SEED_PASSWORD_RECORD.iterations,
    })
    expect(derived).toEqual(SEED_PASSWORD_RECORD)
  })
})
