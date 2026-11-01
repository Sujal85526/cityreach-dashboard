import {
  COLLECTIONS,
  normalizeLoginId,
  userAccessSchema,
  type Credential,
  type DeviceCredential,
  type User,
  type UserAccess,
  deviceLabelSchema,
  loginIdSchema,
  passwordSchema,
} from '@cityreach/shared'
import {
  collection,
  db,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  type WriteBatch,
} from '@/lib/store'
import { fromBase64Url, toBase64Url } from '@/lib/base64url'
import { fromDoc } from '@/lib/from-doc'
import { hashPassword, verifyPassword, type PasswordRecord } from '@/lib/password'
import { verifyAssertion, verifyRegistration, WebAuthnVerifyError } from '@/lib/webauthn-verify'
import type {
  AssertionOptions,
  AssertionResponse,
  RegistrationOptions,
  RegistrationResponse,
} from '@/lib/webauthn'

export interface SessionUser {
  uid: string
  email: string
  name: string
  access: UserAccess
}

/**
 * The session is just "which person is signed in", kept in localStorage. Role and branch still
 * come from that person's profile in the store. Signing in (password or fingerprint) ends in
 * `startSession`.
 *
 * Everything below `getProfile` is the part of the app that a real backend would own: checking
 * passwords, issuing and verifying fingerprint challenges, and starting a server session. The
 * UI only calls the functions below (through queries.ts) and the browser-only WebAuthn module
 * (lib/webauthn.ts); swapping this file for server calls changes nothing else.
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

function startSession(session: SessionUser) {
  localStorage.setItem(STORAGE_KEY, session.uid)
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

/* ---------- passwords ---------- */

export type AuthErrorCode =
  'invalid' | 'locked' | 'inactive' | 'taken' | 'forbidden' | 'invalid_device'

/** An expected sign-in failure, with a message that is safe to show as it is. */
export class AuthError extends Error {
  readonly code: AuthErrorCode
  readonly retryAfterSeconds?: number
  constructor(code: AuthErrorCode, message: string, retryAfterSeconds?: number) {
    super(message)
    this.name = 'AuthError'
    this.code = code
    this.retryAfterSeconds = retryAfterSeconds
  }
}

/** After this many wrong passwords in a row the account waits before it accepts another try. */
export const MAX_FAILED_ATTEMPTS = 5
export const LOCK_SECONDS = 30
const INVALID = 'Incorrect ID or password.'

const credentialRef = (uid: string) => doc(db, COLLECTIONS.credentials, uid)
const credentials = collection(db, COLLECTIONS.credentials)

async function findCredentialByLoginId(loginId: string): Promise<Credential | null> {
  const snap = await getDocs(query(credentials, where('loginId', '==', normalizeLoginId(loginId))))
  const found = snap.docs[0]
  return found ? fromDoc<Credential>(found) : null
}

/** A fixed hash to check against when the ID is unknown, so a miss takes as long as a hit. */
let decoy: Promise<PasswordRecord> | undefined
const decoyHash = () => (decoy ??= hashPassword('not-a-real-password'))

const secondsLeft = (until: Date) => Math.max(1, Math.ceil((until.getTime() - Date.now()) / 1000))

/** Signs in with a login ID and password. Wrong ID and wrong password look the same. */
export async function signInWithPassword(loginId: string, password: string): Promise<SessionUser> {
  const credential = await findCredentialByLoginId(loginId)
  if (!credential) {
    await verifyPassword(password, await decoyHash())
    throw new AuthError('invalid', INVALID)
  }
  if (credential.lockedUntil && credential.lockedUntil.getTime() > Date.now()) {
    const wait = secondsLeft(credential.lockedUntil)
    throw new AuthError(
      'locked',
      `Too many wrong attempts. Try again in ${wait} second${wait === 1 ? '' : 's'}.`,
      wait,
    )
  }
  if (!(await verifyPassword(password, credential.password))) {
    const failedAttempts = credential.failedAttempts + 1
    const lock = failedAttempts >= MAX_FAILED_ATTEMPTS
    await updateDoc(credentialRef(credential.id), {
      failedAttempts: lock ? 0 : failedAttempts,
      lockedUntil: lock ? Timestamp.fromMillis(Date.now() + LOCK_SECONDS * 1000) : null,
    })
    if (lock)
      throw new AuthError(
        'locked',
        `Too many wrong attempts. Try again in ${LOCK_SECONDS} seconds.`,
        LOCK_SECONDS,
      )
    throw new AuthError('invalid', INVALID)
  }
  const session = await loadSession(credential.id)
  if (!session) throw new AuthError('inactive', 'This account is switched off. Ask your manager.')
  if (credential.failedAttempts > 0 || credential.lockedUntil)
    await updateDoc(credentialRef(credential.id), { failedAttempts: 0, lockedUntil: null })
  return startSession(session)
}

/** The login ID of a user, or null if they have none. For managers looking at a profile. */
export async function getLoginId(uid: string): Promise<string | null> {
  const snap = await getDoc(credentialRef(uid))
  return snap.exists() ? String(snap.get('loginId')) : null
}

/**
 * Throws if another user already has this login ID. In a real backend this is a unique index;
 * here the store is single-threaded, so checking right before the write is enough.
 */
export async function assertLoginIdAvailable(loginId: string, exceptUid?: string) {
  const parsed = loginIdSchema.safeParse(loginId)
  if (!parsed.success)
    throw new AuthError('taken', parsed.error.issues[0]?.message ?? 'Invalid login ID')
  const existing = await findCredentialByLoginId(loginId)
  if (existing && existing.id !== exceptUid)
    throw new AuthError('taken', `The login ID "${normalizeLoginId(loginId)}" is already taken.`)
}

/** The fields to store for a new login. Hashes the password; the plain text is not kept. */
export async function buildCredential(
  input: { loginId: string; password: string },
  branchId: string,
): Promise<Omit<Credential, 'id'>> {
  return {
    loginId: normalizeLoginId(input.loginId),
    branchId,
    password: await hashPassword(passwordSchema.parse(input.password)),
    failedAttempts: 0,
    lockedUntil: null,
    passwordChangedAt: new Date(),
  }
}

/** Adds the write of a brand-new login to a batch (used when an employee is created). */
export function setCredentialInBatch(
  batch: WriteBatch,
  uid: string,
  credential: Omit<Credential, 'id'>,
) {
  batch.set(credentialRef(uid), { ...credential })
}

/** Changes the login ID and/or sets a new password for someone else (a manager's reset). */
export async function updateCredential(
  uid: string,
  patch: { loginId?: string; password?: string },
) {
  const current = await getDoc(credentialRef(uid))
  if (!current.exists()) throw new AuthError('invalid', 'This person has no login yet.')
  const changes: Record<string, unknown> = {}
  if (patch.loginId !== undefined && normalizeLoginId(patch.loginId) !== current.get('loginId')) {
    await assertLoginIdAvailable(patch.loginId, uid)
    changes.loginId = normalizeLoginId(patch.loginId)
  }
  if (patch.password) {
    changes.password = await hashPassword(passwordSchema.parse(patch.password))
    changes.passwordChangedAt = serverTimestamp()
    changes.failedAttempts = 0
    changes.lockedUntil = null
  }
  if (Object.keys(changes).length) await updateDoc(credentialRef(uid), changes)
}

/** Someone changing their own password: they must know the current one. */
export async function changeOwnPassword(
  actor: SessionUser,
  currentPassword: string,
  newPassword: string,
) {
  const snap = await getDoc(credentialRef(actor.uid))
  if (!snap.exists()) throw new AuthError('invalid', 'This account has no password to change.')
  const credential = fromDoc<Credential>(snap)
  if (!(await verifyPassword(currentPassword, credential.password)))
    throw new AuthError('invalid', 'Your current password is not right.')
  await updateDoc(credentialRef(actor.uid), {
    password: await hashPassword(passwordSchema.parse(newPassword)),
    passwordChangedAt: serverTimestamp(),
    failedAttempts: 0,
    lockedUntil: null,
  })
}

/* ---------- fingerprint / device sign-in ---------- */

const devices = collection(db, COLLECTIONS.deviceCredentials)
const deviceRef = (id: string) => doc(db, COLLECTIONS.deviceCredentials, id)

/** Where the page is served from. A server knows this itself; here the page tells us. */
export interface RelyingParty {
  rpId: string
  origin: string
}

const CHALLENGE_TTL_MS = 2 * 60_000
const PROMPT_TIMEOUT_MS = 60_000
interface Pending {
  kind: 'register' | 'login'
  uid: string | null
  expires: number
}
/** Challenges handed out and not used yet. A server would keep these in its session or cache. */
const pending = new Map<string, Pending>()

function issueChallenge(kind: Pending['kind'], uid: string | null) {
  const now = Date.now()
  for (const [c, p] of pending) if (p.expires < now) pending.delete(c)
  const challenge = toBase64Url(crypto.getRandomValues(new Uint8Array(32)))
  pending.set(challenge, { kind, uid, expires: now + CHALLENGE_TTL_MS })
  return challenge
}

/** A challenge works once: it is removed the moment it is checked, pass or fail. */
function takeChallenge(challenge: string, kind: Pending['kind']) {
  const found = pending.get(challenge)
  pending.delete(challenge)
  if (!found || found.kind !== kind || found.expires < Date.now())
    throw new AuthError('invalid_device', 'That fingerprint check expired. Please try again.')
  return found
}

const asDevice = (snap: Parameters<typeof fromDoc>[0]) => fromDoc<DeviceCredential>(snap)

export async function listDevices(uid: string): Promise<DeviceCredential[]> {
  const snap = await getDocs(query(devices, where('userId', '==', uid)))
  return snap.docs.map(asDevice).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
}

/** How many devices are registered in this browser: tells the login screen what to expect. */
export async function countKnownDevices(): Promise<number> {
  return (await getDocs(devices)).size
}

/** Step 1 of setting up a fingerprint: a challenge and the options for the device prompt. */
export async function beginDeviceRegistration(
  actor: SessionUser,
  rp: RelyingParty,
): Promise<RegistrationOptions> {
  const existing = await listDevices(actor.uid)
  return {
    challenge: issueChallenge('register', actor.uid),
    rp: { id: rp.rpId, name: 'City Reach' },
    user: {
      id: toBase64Url(new TextEncoder().encode(actor.uid)),
      name: actor.email || actor.uid,
      displayName: actor.name,
    },
    excludeCredentialIds: existing.filter((d) => d.rpId === rp.rpId).map((d) => d.id),
    timeoutMs: PROMPT_TIMEOUT_MS,
  }
}

/** Step 2: check the device's answer and keep its public key against this person. */
export async function finishDeviceRegistration(
  actor: SessionUser,
  response: RegistrationResponse,
  label: string,
  rp: RelyingParty,
): Promise<DeviceCredential> {
  const challenge = JSON.parse(
    new TextDecoder().decode(fromBase64Url(response.clientDataJSON)),
  ) as { challenge?: string }
  const issued = takeChallenge(String(challenge.challenge), 'register')
  if (issued.uid !== actor.uid)
    throw new AuthError('forbidden', 'That setup belongs to someone else.')
  let verified
  try {
    verified = await verifyRegistration(response, { challenge: String(challenge.challenge), ...rp })
  } catch (error) {
    throw toAuthError(error)
  }
  const taken = await getDoc(deviceRef(verified.credentialId))
  if (taken.exists() && taken.get('userId') !== actor.uid)
    throw new AuthError('forbidden', 'This device credential is already used by someone else.')
  const record = {
    userId: actor.uid,
    label: deviceLabelSchema.parse(label),
    publicKey: verified.publicKey,
    algorithm: verified.algorithm,
    signCount: verified.signCount,
    rpId: rp.rpId,
    createdAt: serverTimestamp(),
    lastUsedAt: null,
  }
  await setDoc(deviceRef(verified.credentialId), record)
  return asDevice(await getDoc(deviceRef(verified.credentialId)))
}

export async function removeDevice(actor: SessionUser, credentialId: string) {
  const snap = await getDoc(deviceRef(credentialId))
  if (!snap.exists()) return
  if (snap.get('userId') !== actor.uid)
    throw new AuthError('forbidden', 'You can only remove your own devices.')
  await deleteDoc(deviceRef(credentialId))
}

/**
 * Step 1 of signing in with a fingerprint: a challenge, and the credentials this browser knows
 * for this site. Returns null when none is registered here (the screen explains what to do).
 */
export async function beginDeviceLogin(rp: RelyingParty): Promise<AssertionOptions | null> {
  const known = (await getDocs(devices)).docs.map(asDevice).filter((d) => d.rpId === rp.rpId)
  if (known.length === 0) return null
  return {
    challenge: issueChallenge('login', null),
    rpId: rp.rpId,
    allowCredentialIds: known.map((d) => d.id),
    timeoutMs: PROMPT_TIMEOUT_MS,
  }
}

/** Step 2: verify the device's signed answer; if it holds up, start that person's session. */
export async function finishDeviceLogin(
  response: AssertionResponse,
  rp: RelyingParty,
): Promise<SessionUser> {
  const parsed = JSON.parse(new TextDecoder().decode(fromBase64Url(response.clientDataJSON))) as {
    challenge?: string
  }
  takeChallenge(String(parsed.challenge), 'login')
  const snap = await getDoc(deviceRef(response.credentialId))
  if (!snap.exists() || snap.get('rpId') !== rp.rpId)
    throw new AuthError('invalid_device', 'This fingerprint is not set up on this browser.')
  const device = asDevice(snap)
  try {
    const { signCount } = await verifyAssertion(
      response,
      { challenge: String(parsed.challenge), ...rp },
      device,
    )
    await updateDoc(deviceRef(device.id), { signCount, lastUsedAt: serverTimestamp() })
  } catch (error) {
    throw toAuthError(error)
  }
  const session = await loadSession(device.userId)
  if (!session) throw new AuthError('inactive', 'This account is switched off. Ask your manager.')
  return startSession(session)
}

function toAuthError(error: unknown) {
  if (error instanceof WebAuthnVerifyError)
    return new AuthError('invalid_device', `Fingerprint sign-in was refused: ${error.message}`)
  return error
}
