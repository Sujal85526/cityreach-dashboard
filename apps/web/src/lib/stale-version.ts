/**
 * After an update, a tab that was already open still points at page files from the old version,
 * and those files are gone. Reloading once fetches the new version and the app carries on.
 */
const RELOAD_KEY = 'cityreach-stale-reload'
const MIN_GAP_MS = 30_000

/** True for the errors a browser throws when a lazily loaded page file can't be fetched. */
export function isChunkLoadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : ''
  return (
    /Failed to fetch dynamically imported module/i.test(message) ||
    /error loading dynamically imported module/i.test(message) ||
    /Importing a module script failed/i.test(message) ||
    /Loading (CSS )?chunk [\w-]+ failed/i.test(message)
  )
}

/** Reloads the page, but at most once every 30 seconds so a real outage can't loop. */
export function reloadForNewVersion(): boolean {
  const last = Number(sessionStorage.getItem(RELOAD_KEY) ?? 0)
  if (Date.now() - last < MIN_GAP_MS) return false
  sessionStorage.setItem(RELOAD_KEY, String(Date.now()))
  window.location.reload()
  return true
}
