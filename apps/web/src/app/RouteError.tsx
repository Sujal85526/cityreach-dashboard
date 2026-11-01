import { useEffect } from 'react'
import { useRouteError } from 'react-router'
import { Button } from '@/components/ui/button'
import { isChunkLoadError, reloadForNewVersion } from '@/lib/stale-version'

/** Shown instead of the raw error page. A stale tab after an update reloads itself. */
export function RouteError() {
  const error = useRouteError()
  const isStale = isChunkLoadError(error)
  const reloading = isStale && typeof window !== 'undefined'

  useEffect(() => {
    if (isStale) reloadForNewVersion()
  }, [isStale])

  return (
    <div className="grid min-h-svh place-items-center bg-background p-6 text-foreground">
      <div className="max-w-sm space-y-4 text-center">
        <h1 className="font-display text-2xl">
          {reloading ? 'Updating to the latest version…' : 'Something went wrong'}
        </h1>
        <p className="text-sm text-muted-foreground">
          {reloading
            ? 'A new version is available. This page reloads by itself.'
            : 'The page could not be shown. Reloading usually fixes it.'}
        </p>
        <div className="flex justify-center gap-2">
          <Button onClick={() => window.location.reload()}>Reload</Button>
          <Button variant="outline" onClick={() => window.location.assign('/')}>
            Go to home
          </Button>
        </div>
      </div>
    </div>
  )
}
