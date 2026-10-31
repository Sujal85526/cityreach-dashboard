import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Each build gets its own id, so the device cache (lib/query-cache.ts) starts fresh after a deploy.
  define: { 'import.meta.env.VITE_BUILD_ID': JSON.stringify(Date.now().toString(36)) },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    // Pages load on demand (app/router.tsx). Libraries get chunks of their own, so a deploy that
    // only changes app code leaves them cached on the phone: Firebase (~200 kB gzipped, needed
    // by every signed-in screen) and React. Charts and the PDF library load only where used.
    chunkSizeWarningLimit: 750,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'firebase', test: /node_modules[\\/](@firebase|firebase)[\\/]/ },
            {
              name: 'react',
              test: /node_modules[\\/](react|react-dom|react-router|scheduler)[\\/]/,
            },
          ],
        },
      },
    },
  },
})
