import { Progress } from '@/components/ui/progress'
import { useNow } from '@/hooks/use-now'
import { formatClock } from '@/lib/format'

const pad = (n: number) => String(n).padStart(2, '0')
/** 5437 s → "01:30:37". */
const hms = (seconds: number) => {
  const s = Math.max(0, Math.floor(seconds))
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`
}

/** Live clock, in its own component so only it re-renders every second. */
export function LiveClock({ tz }: { tz: string }) {
  const now = useNow(1000)
  return <div className="text-4xl font-semibold tabular-nums">{formatClock(now, tz)}</div>
}

/**
 * While clocked in (like Keka): time worked since clock-in, ticking every second, and how much
 * of the shift is left. Clock-in is server time; the phone's clock may be a few seconds behind.
 */
export function ShiftTimer({
  clockInAt,
  shiftStartAt,
  shiftEndAt,
  tz,
}: {
  clockInAt: Date
  shiftStartAt: Date | null
  shiftEndAt: Date | null
  tz: string
}) {
  const now = useNow(1000).getTime()
  const worked = (now - clockInAt.getTime()) / 1000
  const left = shiftEndAt ? (shiftEndAt.getTime() - now) / 1000 : null
  const from = (shiftStartAt ?? clockInAt).getTime()
  const progress = shiftEndAt
    ? Math.min(100, Math.max(0, ((now - from) / (shiftEndAt.getTime() - from)) * 100))
    : null

  return (
    <div className="space-y-3 rounded-lg bg-success-soft p-3">
      <div>
        <div className="text-xs text-muted-foreground">Working for</div>
        <div className="text-3xl font-semibold text-success tabular-nums">{hms(worked)}</div>
      </div>
      {shiftEndAt && left !== null && progress !== null && (
        <div className="space-y-1.5">
          <Progress value={progress} aria-label="Shift progress" />
          <div className="text-xs text-muted-foreground">
            {left > 0 ? (
              <>
                Shift ends at {formatClock(shiftEndAt, tz)} ·{' '}
                <span className="font-medium text-foreground tabular-nums">{hms(left)}</span> left
              </>
            ) : (
              <>Shift ended at {formatClock(shiftEndAt, tz)}. Clock out when you leave.</>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
