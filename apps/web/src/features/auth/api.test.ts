import { DEMO_LOGINS, DEMO_PASSWORD, COLLECTIONS } from '@cityreach/shared'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmployee, updateEmployee } from '@/features/employees/api'
import { collection, db, getDocs, resetDemoData, updateDoc, doc, Timestamp } from '@/lib/store'
import '@/lib/store/seed'
import {
  AuthError,
  changeOwnPassword,
  getLoginId,
  getProfile,
  LOCK_SECONDS,
  MAX_FAILED_ATTEMPTS,
  signInWithPassword,
  signOut,
  subscribeToSession,
  type SessionUser,
} from './api'

const memory = new Map<string, string>()
beforeAll(() => {
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => memory.get(k) ?? null,
    setItem: (k: string, v: string) => void memory.set(k, v),
    removeItem: (k: string) => void memory.delete(k),
  })
})
beforeEach(() => {
  memory.clear()
  resetDemoData()
})

const as = (uid: string, role: 'owner' | 'manager' | 'employee') =>
  ({ uid, name: uid, email: `${uid}@x.test`, access: { role, branchId: 'central' } }) as SessionUser
const rejection = (p: Promise<unknown>) =>
  p.then(
    () => null,
    (e: unknown) => e as AuthError,
  )
const person = {
  email: 'new.hire@cityreach.demo',
  phone: '',
  position: 'Barista',
  role: 'employee' as const,
  status: 'active' as const,
  shiftId: null,
  probationEndsOn: null,
}

describe('seeded logins', () => {
  it('gives every seeded user, branches included, a login ID that works with the demo password', async () => {
    const users = await getDocs(collection(db, COLLECTIONS.users))
    const credentials = await getDocs(collection(db, COLLECTIONS.credentials))
    expect(credentials.size).toBe(users.size)
    const ids = credentials.docs.map((d) => d.get('loginId'))
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).toEqual(expect.arrayContaining(['owner', 'manager', 'employee', 'liam', 'sq-hana']))
  })

  it.each(DEMO_LOGINS)('signs in the demo $role', async ({ loginId, uid, role }) => {
    const session = await signInWithPassword(loginId, DEMO_PASSWORD)
    expect(session.uid).toBe(uid)
    expect(session.access.role).toBe(role === 'employee' ? 'employee' : session.access.role)
    expect(memory.get('cityreach-session')).toBe(uid)
  })

  it('has no plain-text password anywhere in the store', async () => {
    const all = await getDocs(collection(db, COLLECTIONS.credentials))
    expect(JSON.stringify(all.docs.map((d) => d.data()))).not.toContain(DEMO_PASSWORD)
  })
})

describe('signing in', () => {
  it('ignores case and surrounding spaces in the ID', async () => {
    expect((await signInWithPassword('  Owner ', DEMO_PASSWORD)).uid).toBe('amara')
  })

  it('gives the same answer for a wrong password and an unknown ID', async () => {
    const wrong = await rejection(signInWithPassword('owner', 'not-it-at-all'))
    const unknown = await rejection(signInWithPassword('nobody-here', DEMO_PASSWORD))
    expect(wrong).toBeInstanceOf(AuthError)
    expect(wrong?.code).toBe('invalid')
    expect(unknown?.message).toBe(wrong?.message)
    expect(memory.has('cityreach-session')).toBe(false)
  })

  it('locks the account after repeated failures, even for the right password', async () => {
    for (let i = 0; i < MAX_FAILED_ATTEMPTS - 1; i++)
      expect((await rejection(signInWithPassword('manager', 'bad-password')))?.code).toBe('invalid')
    const last = await rejection(signInWithPassword('manager', 'bad-password'))
    expect(last?.code).toBe('locked')
    expect(last?.retryAfterSeconds).toBe(LOCK_SECONDS)
    const stillLocked = await rejection(signInWithPassword('manager', DEMO_PASSWORD))
    expect(stillLocked?.code).toBe('locked')
    // After the wait the right password works again and the counter is clear.
    await updateDoc(doc(db, COLLECTIONS.credentials, 'daniel'), {
      lockedUntil: Timestamp.fromMillis(Date.now() - 1000),
    })
    expect((await signInWithPassword('manager', DEMO_PASSWORD)).uid).toBe('daniel')
  })

  it('refuses a deactivated person with the right password', async () => {
    await updateDoc(doc(db, COLLECTIONS.users, 'maya'), { status: 'inactive' })
    expect((await rejection(signInWithPassword('employee', DEMO_PASSWORD)))?.code).toBe('inactive')
  })

  it('sign-out ends the session', async () => {
    await signInWithPassword('owner', DEMO_PASSWORD)
    await signOut()
    const seen: (SessionUser | null)[] = []
    subscribeToSession((u) => seen.push(u))()
    expect(seen[0]).toBeNull()
  })
})

describe('creating an employee with a login', () => {
  it('lets the new employee sign in with the ID and password they were given', async () => {
    const uid = await createEmployee(
      { ...person, name: 'Nina Hart', loginId: 'Nina.Hart', password: 'welcome-2025' },
      as('daniel', 'manager'),
    )
    expect(await getLoginId(uid)).toBe('nina.hart')
    expect((await signInWithPassword('nina.hart', 'welcome-2025')).uid).toBe(uid)
    expect((await rejection(signInWithPassword('nina.hart', DEMO_PASSWORD)))?.code).toBe('invalid')
  })

  it('refuses a login ID that is already taken, in any letter case', async () => {
    const taken = await rejection(
      createEmployee(
        { ...person, name: 'Copy Cat', loginId: 'LIAM', password: 'welcome-2025' },
        as('daniel', 'manager'),
      ),
    )
    expect(taken?.code).toBe('taken')
    expect(taken?.message).toContain('already taken')
  })

  it('refuses a short password and a malformed ID', async () => {
    await expect(
      createEmployee(
        { ...person, name: 'Short Pw', loginId: 'short.pw', password: 'abc' },
        as('daniel', 'manager'),
      ),
    ).rejects.toThrow()
    await expect(
      createEmployee(
        { ...person, name: 'Bad Id', loginId: 'a b', password: 'welcome-2025' },
        as('daniel', 'manager'),
      ),
    ).rejects.toThrow()
  })
})

describe('resetting and changing passwords', () => {
  it('lets a manager reset an employee password, but not a manager’s', async () => {
    const maya = await getProfile('maya')
    const daniel = await getProfile('daniel')
    if (!maya || !daniel) throw new Error('seed missing')
    const form = (u: typeof maya) => ({
      name: u.name,
      phone: u.phone,
      position: u.position,
      role: u.role,
      status: u.status,
      shiftId: u.shiftId,
      probationEndsOn: u.probationEndsOn ?? null,
    })
    await updateEmployee(maya, form(maya), as('daniel', 'manager'), {
      loginId: 'maya.p',
      password: 'fresh-pass-1',
    })
    expect((await signInWithPassword('maya.p', 'fresh-pass-1')).uid).toBe('maya')
    const refused = await rejection(
      updateEmployee(daniel, form(daniel), as('liam', 'manager'), {
        loginId: 'manager',
        password: 'fresh-pass-1',
      }),
    )
    expect(refused?.code).toBe('forbidden')
    // The owner may.
    await updateEmployee(daniel, form(daniel), as('amara', 'owner'), {
      loginId: 'manager',
      password: 'fresh-pass-2',
    })
    expect((await signInWithPassword('manager', 'fresh-pass-2')).uid).toBe('daniel')
  })

  it('refuses to move a login ID onto one that exists', async () => {
    const maya = await getProfile('maya')
    if (!maya) throw new Error('seed missing')
    const clash = await rejection(
      updateEmployee(
        maya,
        {
          name: maya.name,
          phone: maya.phone,
          position: maya.position,
          role: maya.role,
          status: maya.status,
          shiftId: maya.shiftId,
          probationEndsOn: null,
        },
        as('daniel', 'manager'),
        { loginId: 'liam', password: '' },
      ),
    )
    expect(clash?.code).toBe('taken')
  })

  it('lets someone change their own password only with the current one', async () => {
    const maya = as('maya', 'employee')
    expect(
      (await rejection(changeOwnPassword(maya, 'wrong-current', 'brand-new-pass')))?.code,
    ).toBe('invalid')
    await changeOwnPassword(maya, DEMO_PASSWORD, 'brand-new-pass')
    expect((await rejection(signInWithPassword('employee', DEMO_PASSWORD)))?.code).toBe('invalid')
    expect((await signInWithPassword('employee', 'brand-new-pass')).uid).toBe('maya')
  })

  it('Reset demo data brings the demo password back', async () => {
    await changeOwnPassword(as('maya', 'employee'), DEMO_PASSWORD, 'brand-new-pass')
    resetDemoData()
    expect((await signInWithPassword('employee', DEMO_PASSWORD)).uid).toBe('maya')
  })
})
