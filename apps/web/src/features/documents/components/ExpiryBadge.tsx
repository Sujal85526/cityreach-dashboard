import { daysUntil, DEFAULT_REMIND_DAYS, expiryState, type StoredDocument } from '@dm/shared'
import { TonePill } from '@/components/common/StatusPill'
import { formatDate } from '@/lib/format'

const localDate = (dateKey: string) => formatDate(new Date(`${dateKey}T12:00:00`))

/** Expired · Expires in 12 days · Valid until 15 Jan 2027 (nothing when it doesn't expire). */
export function ExpiryBadge({ doc, today }: { doc: StoredDocument; today: string }) {
  if (!doc.expiresOn) return <span className="text-muted-foreground">—</span>
  const left = daysUntil(doc.expiresOn, today)
  const state = expiryState(doc.expiresOn, today, doc.remindDaysBefore ?? DEFAULT_REMIND_DAYS)
  return (
    <div className="space-y-0.5">
      {state === 'expired' ? (
        <TonePill tone="danger">Expired</TonePill>
      ) : state === 'expiring_soon' ? (
        <TonePill tone="warning">
          {left === 0 ? 'Expires today' : `Expires in ${left} day${left === 1 ? '' : 's'}`}
        </TonePill>
      ) : (
        <TonePill tone="success">Valid</TonePill>
      )}
      <div className="text-xs text-muted-foreground">{localDate(doc.expiresOn)}</div>
    </div>
  )
}

/** Documents that need attention (expired or inside their reminder window). */
export function needsAttention(doc: StoredDocument, today: string) {
  return (
    !!doc.expiresOn &&
    expiryState(doc.expiresOn, today, doc.remindDaysBefore ?? DEFAULT_REMIND_DAYS) !== 'valid'
  )
}
