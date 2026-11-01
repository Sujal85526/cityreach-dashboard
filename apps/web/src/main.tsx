import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { Providers } from './app/providers'
import { applyInitialTheme } from './hooks/use-theme'
import '@/lib/store/seed'
import './index.css'
import { reloadForNewVersion } from '@/lib/stale-version'

applyInitialTheme()

// A page file from an older version is gone after an update: fetch the new version instead.
window.addEventListener('vite:preloadError', (event) => {
  if (reloadForNewVersion()) event.preventDefault()
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Providers>
      <App />
    </Providers>
  </StrictMode>,
)
