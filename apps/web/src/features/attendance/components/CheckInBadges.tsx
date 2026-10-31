import type { Attendance, AttendancePhoto } from '@dm/shared'
import { Camera, CameraOff, MapPin, MapPinOff } from 'lucide-react'
import { useState } from 'react'
import { TonePill } from '@/components/common/StatusPill'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDateTime, formatMinutes } from '@/lib/format'
import { useAttendancePhoto } from '../queries'
import { formatDistance } from './ClockInDialog'

/**
 * What the phone recorded at clock-in, for the manager: at the shop or how far away, the live
 * photo (opens on tap), and an early clock-out. Records from before these checks, or entered by
 * the manager, show nothing.
 */
export function CheckInBadges({ record, tz }: { record: Attendance; tz: string }) {
  const [viewing, setViewing] = useState(false)
  const loc = record.clockInLocation
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {loc === null ? (
        <TonePill tone="neutral">
          <MapPinOff className="mr-1 size-3" aria-hidden /> No location
        </TonePill>
      ) : loc ? (
        <TonePill tone={loc.inside === false ? 'warning' : 'success'}>
          <MapPin className="mr-1 size-3" aria-hidden />
          {loc.inside === false && loc.distance !== null
            ? `${formatDistance(loc.distance)} away`
            : loc.inside
              ? 'At shop'
              : 'Located'}
        </TonePill>
      ) : null}
      {record.photo === true && (
        <button
          type="button"
          onClick={() => setViewing(true)}
          className="inline-flex items-center rounded-full bg-info-soft px-2.5 py-0.5 text-xs font-medium text-info hover:underline"
          aria-label={`View ${record.employeeName}'s clock-in photo`}
        >
          <Camera className="mr-1 size-3" aria-hidden /> Photo
        </button>
      )}
      {record.photo === false && (
        <TonePill tone="neutral">
          <CameraOff className="mr-1 size-3" aria-hidden /> No photo
        </TonePill>
      )}
      {record.status === 'leave' && record.leavePaid === false && (
        <TonePill tone="warning">Unpaid leave</TonePill>
      )}
      {!!record.earlyLeaveMinutes && (
        <TonePill tone="warning">Left {formatMinutes(record.earlyLeaveMinutes)} early</TonePill>
      )}
      {viewing && <PhotoDialog record={record} tz={tz} onClose={() => setViewing(false)} />}
    </div>
  )
}

function PhotoDialog({
  record,
  tz,
  onClose,
}: {
  record: Attendance
  tz: string
  onClose: () => void
}) {
  const photo = useAttendancePhoto(record.id)
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{record.employeeName}</DialogTitle>
          <DialogDescription>
            Clock-in photo{record.clockInAt ? ` · ${formatDateTime(record.clockInAt, tz)}` : ''}
          </DialogDescription>
        </DialogHeader>
        <PhotoBody photo={photo.data} loading={photo.isPending} />
        <LocationDetails record={record} />
      </DialogContent>
    </Dialog>
  )
}

function PhotoBody({
  photo,
  loading,
}: {
  photo: AttendancePhoto | null | undefined
  loading: boolean
}) {
  if (loading) return <Skeleton className="aspect-square w-full rounded-xl" />
  if (!photo)
    return (
      <p className="rounded-lg bg-muted p-4 text-sm text-muted-foreground">
        The photo is no longer available (photos are kept for 90 days).
      </p>
    )
  return (
    <img
      src={photo.image}
      alt={`Clock-in photo`}
      className="aspect-square w-full rounded-xl object-cover"
    />
  )
}

function LocationDetails({ record }: { record: Attendance }) {
  const rows = [
    ['Clock-in', record.clockInLocation],
    ['Clock-out', record.clockOutLocation],
  ] as const
  return (
    <dl className="space-y-1 text-sm">
      {rows.map(([label, loc]) =>
        loc === undefined ? null : (
          <div key={label} className="flex justify-between gap-3">
            <dt className="text-muted-foreground">{label} location</dt>
            <dd className="text-right">
              {loc === null ? (
                'Not shared'
              ) : (
                <a
                  href={`https://www.google.com/maps?q=${loc.lat},${loc.lng}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary hover:underline"
                >
                  {loc.distance === null
                    ? `Map (±${loc.accuracy} m)`
                    : `${loc.inside ? 'At shop' : `${formatDistance(loc.distance)} away`} (±${loc.accuracy} m)`}
                </a>
              )}
            </dd>
          </div>
        ),
      )}
      {record.earlyLeaveReason && (
        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground">Reason for leaving early</dt>
          <dd className="text-right">{record.earlyLeaveReason}</dd>
        </div>
      )}
    </dl>
  )
}
