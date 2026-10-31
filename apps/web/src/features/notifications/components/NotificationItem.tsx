import type { Notification } from '@dm/shared'
import { TonePill } from '@/components/common/StatusPill'
import { formatAgo } from '@/lib/format'
import { cn } from '@/lib/utils'

const TONE_LABEL = {
  success: 'Success',
  warning: 'Warning',
  danger: 'Alert',
  info: 'Info',
} as const

/** One notification row: title, tone pill, message, relative time; unread rows are highlighted. */
export function NotificationItem({
  n,
  onClick,
  compact,
}: {
  n: Notification
  onClick: () => void
  compact?: boolean
}) {
  const unread = n.readAt === null
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full gap-3 rounded-lg p-3 text-left transition-colors hover:bg-muted',
        unread && 'bg-primary/5',
      )}
    >
      <span
        className={cn(
          'mt-1.5 size-2 shrink-0 rounded-full',
          unread ? 'bg-primary' : 'bg-transparent',
        )}
        aria-label={unread ? 'Unread' : undefined}
      />
      <span className="min-w-0 flex-1 space-y-0.5">
        <span className="flex flex-wrap items-center gap-2">
          <span className={cn('text-sm', unread ? 'font-semibold' : 'font-medium')}>{n.title}</span>
          {!compact && <TonePill tone={n.tone}>{TONE_LABEL[n.tone]}</TonePill>}
        </span>
        <span className={cn('block text-sm text-muted-foreground', compact && 'line-clamp-2')}>
          {n.body}
        </span>
        <span className="block text-xs text-muted-foreground">{formatAgo(n.createdAt)}</span>
      </span>
    </button>
  )
}
