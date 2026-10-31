import { deleteApp, initializeApp } from 'firebase/app'
import {
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  getAuth,
  signOut,
  type Auth,
} from 'firebase/auth'
import { connectFirestoreEmulator, initializeFirestore } from 'firebase/firestore'

/**
 * The only Firebase connection in the web app. Feature `api.ts` files import from here.
 * With VITE_USE_EMULATORS=true everything talks to the local emulators (see firebase.json ports).
 */
const env = import.meta.env
const useEmulators = env.VITE_USE_EMULATORS === 'true'
const config = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  appId: env.VITE_FIREBASE_APP_ID,
}

export const app = initializeApp(config)
export const auth = getAuth(app)
// VITE_FIRESTORE_LONG_POLLING=true: plain requests instead of a streaming connection, for networks
// or test browsers that buffer streamed responses (pages would load forever). Off by default.
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: env.VITE_FIRESTORE_LONG_POLLING === 'true',
})

const connectAuth = (a: Auth) => connectAuthEmulator(a, 'http://127.0.0.1:9099', { disableWarnings: true })

if (useEmulators) {
  connectAuth(auth)
  connectFirestoreEmulator(db, '127.0.0.1', 8080)
}

/**
 * Creates a login for a new staff member and returns its uid.
 * Signing up through the main app would sign the manager out, so this uses a short-lived
 * second Firebase app instance (free-plan alternative to the Admin SDK).
 */
export async function createAuthAccount(email: string, password: string) {
  const secondary = initializeApp(config, `staff-${Date.now()}`)
  const secondaryAuth = getAuth(secondary)
  if (useEmulators) connectAuth(secondaryAuth)
  try {
    const { user } = await createUserWithEmailAndPassword(secondaryAuth, email, password)
    await signOut(secondaryAuth)
    return user.uid
  } finally {
    await deleteApp(secondary)
  }
}
