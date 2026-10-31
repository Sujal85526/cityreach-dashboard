import {
  COLLECTIONS,
  userAccessSchema,
  type Role,
  type User,
  type UserAccess,
} from '@cityreach/shared'
import { collection, doc, getDoc, getDocs, query, where } from '@/lib/store'
import { db } from '@/lib/store'
import { fromDoc } from '@/lib/from-doc'

export interface SessionUser {
  uid: string
  email: string
  name: string
  access: UserAccess
}

/**
 * There is no password: the demo remembers which person you are acting as (a role switcher).
 * Role and branch still come from the person's profile in the store.
 */
const STORAGE_KEY = 'cityreach-session'
const listeners = new Set<() => void>()

const readUid = () => {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

async function loadSession(uid: string): Promise<SessionUser | null> {
  const snap = await getDoc(doc(db, COLLECTIONS.users, uid))
  const parsed = userAccessSchema.safeParse(snap.data())
  if (!snap.exists() || !parsed.success || parsed.data.status === 'inactive') return null
  return {
    uid,
    email: String(snap.get('email') ?? ''),
    name: String(snap.get('name') ?? ''),
    access: parsed.data,
  }
}

/** Calls back with the current person (role and branch included), or null; again after every switch. */
export function subscribeToSession(callback: (user: SessionUser | null) => void) {
  let active = true
  const emit = () => {
    const uid = readUid()
    if (!uid) return callback(null)
    void loadSession(uid).then((user) => active && callback(user))
  }
  listeners.add(emit)
  emit()
  return () => {
    active = false
    listeners.delete(emit)
  }
}

export interface DemoPerson {
  uid: string
  name: string
  role: Role
  position: string
}

/** Everyone who can be picked on the landing screen. */
export async function listDemoPeople(): Promise<DemoPerson[]> {
  const snap = await getDocs(
    query(collection(db, COLLECTIONS.users), where('status', '==', 'active')),
  )
  return snap.docs
    .filter((d) => !d.get('extraBranch')) // staff of the owner's other branches aren't sign-in choices
    .map((d) => fromDoc<User>(d))
    .map((u) => ({ uid: u.id, name: u.name, role: u.role, position: u.position }))
}

/** Acts as the given person; no password. */
export async function signInAs(uid: string): Promise<SessionUser> {
  const session = await loadSession(uid)
  if (!session) throw new Error('That person is not available in the demo.')
  localStorage.setItem(STORAGE_KEY, uid)
  listeners.forEach((l) => l())
  return session
}

export async function signOut() {
  localStorage.removeItem(STORAGE_KEY)
  listeners.forEach((l) => l())
}

export async function getProfile(uid: string): Promise<User | null> {
  const snap = await getDoc(doc(db, COLLECTIONS.users, uid))
  return snap.exists() ? fromDoc<User>(snap) : null
}
