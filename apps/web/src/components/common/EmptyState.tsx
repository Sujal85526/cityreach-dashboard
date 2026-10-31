import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description?: string
  action?: ReactNode
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="animate-page-in flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed bg-muted/30 px-6 py-12 text-center">
      <span className="relative flex size-14 items-center justify-center rounded-2xl bg-accent text-primary">
        <Icon className="size-6" aria-hidden />
        <span className="absolute -inset-2 -z-10 rounded-3xl bg-accent/50" aria-hidden />
      </span>
      <div className="space-y-1">
        <p className="font-display text-lg font-medium">{title}</p>
        {description && <p className="max-w-sm text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  )
}

/** Error state with retry, for failed queries. */
export function ErrorState({ error, onRetry }: { error: Error; onRetry?: () => void }) {
  return (
    <div role="alert" className="rounded-2xl bg-danger-soft p-4 text-sm text-danger">
      <p className="font-medium">Couldn't load this data.</p>
      <p className="opacity-80">{error.message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="mt-2 font-medium underline">
          Try again
        </button>
      )}
    </div>
  )
}
