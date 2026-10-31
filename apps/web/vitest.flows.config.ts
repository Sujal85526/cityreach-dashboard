import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config.ts'

/**
 * End-to-end flow tests: the app's real api.ts functions against the Firebase emulators.
 * Run with `pnpm test:flows` while `pnpm emulators` is running. They use their own Firestore
 * project (demo-flow-test), so the seeded demo data is never touched.
 */
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      include: ['src/**/*.flow.ts'],
      environment: 'node',
      testTimeout: 20_000,
      fileParallelism: false,
      env: {
        VITE_USE_EMULATORS: 'true',
        VITE_FIREBASE_PROJECT_ID: 'demo-flow-test',
        VITE_FIREBASE_API_KEY: 'demo-key',
        VITE_FIREBASE_AUTH_DOMAIN: 'demo-flow-test.firebaseapp.com',
        VITE_FIREBASE_APP_ID: 'demo-app',
      },
    },
  }),
)
