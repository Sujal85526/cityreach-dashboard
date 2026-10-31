/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_USE_EMULATORS: string
  readonly VITE_FIREBASE_PROJECT_ID: string
  readonly VITE_FIREBASE_API_KEY: string
  readonly VITE_FIREBASE_AUTH_DOMAIN: string
  readonly VITE_FIREBASE_APP_ID: string
  /** Optional: "true" forces long polling (see lib/firebase.ts). */
  readonly VITE_FIRESTORE_LONG_POLLING?: string
  /** Set at build time (vite.config.ts); resets the device cache after each deploy. */
  readonly VITE_BUILD_ID?: string
}
