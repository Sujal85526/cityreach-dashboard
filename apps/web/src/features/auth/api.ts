import {
  COLLECTIONS,
  isManagerRole,
  userAccessSchema,
  type User,
  type UserAccess,
} from '@cityreach/shared'
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  type User as FirebaseUser,
} from 'firebase/auth'
import {
  doc,
  getDoc,
  serverTimestamp,
  updateDoc,
  type DocumentSnapshot,
  type FirestoreError,
} from 'firebase/firestore'
import { z } from 'zod'
import { auth, db } from '@/lib/firebase'
import { fromDoc } from '@/lib/firestore'

export interface SessionUser {
  uid: string
  email: string
  name: string
  access: UserAccess
}

/**
 * The last known role and branch on this device, so opening the app doesn't wait for the database
 * (the first request on a connection takes seconds). Only for choosing the screens: firestore.rules
 * check the real role on every request, and the profile is re-read in the background.
 */
const cachedSessionSchema = z.object({
  uid: z.string(),
  email: z.string(),
  name: z.string(),
  access: userAccessSchema,
})
const sessionKey = (uid: string) => `dm-session-${uid}`

function readCachedSession(uid: string): SessionUser | null {
  try {
    const parsed = cachedSessionSchema.safeParse(
      JSON.parse(localStorage.getItem(sessionKey(uid)) ?? 'null'),
    )
    return parsed.success && parsed.data.access.status !== 'inactive' ? parsed.data : null
  } catch {
    return null // blocked storage (private mode) just means no head start
  }
}

function writeCachedSession(session: SessionUser) {
  try {
    localStorage.setItem(sessionKey(session.uid), JSON.stringify(session))
  } catch {
    // Same: no head start next time.
  }
}

/** Call before reloading after changing the user's own role or branch. */
export function forgetCachedSession(uid: string) {
  try {
    localStorage.removeItem(sessionKey(uid))
  } catch {
    // Nothing stored, then.
  }
}

/**
 * Reads role, branch and status from users/{uid}. Null when the account has no profile or is
 * deactivated; rejects when the read itself fails (no network).
 */
async function fetchSession(user: FirebaseUser): Promise<SessionUser | null> {
  // Rules refuse deactivated accounts their own profile: that means no access, not a network error.
  const snap = await getDoc(doc(db, COLLECTIONS.users, user.uid)).catch((error: FirestoreError) => {
    if (error.code === 'permission-denied') return null
    throw error
  })
  const parsed = userAccessSchema.safeParse(snap?.data())
  if (!snap || !parsed.success || parsed.data.status === 'inactive') {
    forgetCachedSession(user.uid)
    return null
  }
  if (isManagerRole(parsed.data.role)) await completeManagerProfile(snap)
  const session: SessionUser = {
    uid: user.uid,
    email: user.email ?? '',
    name: (snap.get('name') as string | undefined) ?? user.email ?? '',
    access: parsed.data,
  }
  writeCachedSession(session)
  return session
}

/** Sign-in and the auth listener both ask for the session at the same moment: one read serves both. */
let loading: { uid: string; session: Promise<SessionUser | null> } | null = null

function loadSession(user: FirebaseUser) {
  if (loading?.uid === user.uid) return loading.session
  const session = fetchSession(user).finally(() => {
    loading = null
  })
  loading = { uid: user.uid, session }
  return session
}

/**
 * The first manager of a new project is created by hand with only branchId, role, status, name
 * and email (docs/DEPLOYMENT.md). On their first sign-in the rest of the profile is filled in
 * with defaults so every screen has what it expects. Later sign-ins change nothing.
 */
async function completeManagerProfile(snap: DocumentSnapshot) {
  const defaults: Record<string, unknown> = {
    phone: '',
    position: 'Owner',
    shiftId: null,
    hiredAt: serverTimestamp(),
    stats: { attendancePct: 100, performanceScore: 0, updatedAt: serverTimestamp() },
    notes: [],
    warnings: [],
    achievements: [],
    createdAt: serverTimestamp(),
  }
  const missing = Object.fromEntries(
    Object.entries(defaults).filter(([key]) => snap.get(key) === undefined),
  )
  if (Object.keys(missing).length === 0) return
  await updateDoc(snap.ref, { ...missing, updatedAt: serverTimestamp() }).catch(() => {
    // Not fatal: the manager can still sign in; screens tolerate the missing fields until next time.
  })
}

/** Calls back with the signed-in user (with role and branch), or null. Returns the unsubscribe function. */
export function subscribeToSession(callback: (user: SessionUser | null) => void) {
  return onAuthStateChanged(auth, (user) => {
    if (!user) {
      callback(null)
      return
    }
    const cached = readCachedSession(user.uid)
    if (cached) callback(cached)
    loadSession(user).then(
      (fresh) => {
        if (auth.currentUser?.uid !== user.uid) return // signed out while reading
        if (JSON.stringify(fresh) !== JSON.stringify(cached)) callback(fresh)
      },
      () => {
        if (!cached) callback(null) // no network and nothing known: back to the login page
      },
    )
  })
}

/** Signs in and rejects accounts without a role (e.g. created outside the app). */
export async function signIn(email: string, password: string): Promise<SessionUser> {
  const { user } = await signInWithEmailAndPassword(auth, email, password)
  // Known on this device: open straight away; the auth listener re-checks the profile meanwhile.
  const session = readCachedSession(user.uid) ?? (await loadSession(user).catch(() => null))
  if (!session) {
    await firebaseSignOut(auth)
    throw new Error(
      'This account has no access to Digital Manager or has been deactivated. Ask your manager.',
    )
  }
  return session
}

export const signOut = () => firebaseSignOut(auth)

export async function getProfile(uid: string): Promise<User | null> {
  const snap = await getDoc(doc(db, COLLECTIONS.users, uid))
  return snap.exists() ? fromDoc<User>(snap) : null
}
