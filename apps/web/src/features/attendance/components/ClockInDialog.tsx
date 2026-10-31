import { distanceMeters, isAtShop, type Branch, type GeoFix } from '@dm/shared'
import { Loader2, LogIn, MapPin, MapPinOff } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { PHOTO_RETENTION_DAYS, type ClockInCapture } from '../api'
import { isFix, readLocation, type LocationProblem } from '../capture'
import { SelfieCamera } from './SelfieCamera'

export const formatDistance = (m: number) =>
  m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`

/**
 * Clock-in step: reads the phone's location and takes a live photo, then clocks in.
 * Neither blocks the clock-in; a missing one is shown to the manager instead.
 */
export function ClockInDialog({
  open,
  onOpenChange,
  branch,
  pending,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  branch: Branch
  pending: boolean
  onConfirm: (capture: ClockInCapture) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Clock in</DialogTitle>
          <DialogDescription>
            Your location and photo are saved only when you clock in, and your manager can see them.
            Photos are deleted after {PHOTO_RETENTION_DAYS} days.
          </DialogDescription>
        </DialogHeader>
        {/* Mounted only while open, so the camera and GPS stop when the dialog closes. */}
        {open && <Steps branch={branch} pending={pending} onConfirm={onConfirm} />}
      </DialogContent>
    </Dialog>
  )
}

function Steps({
  branch,
  pending,
  onConfirm,
}: {
  branch: Branch
  pending: boolean
  onConfirm: (capture: ClockInCapture) => void
}) {
  const [location, setLocation] = useState<GeoFix | LocationProblem | null>(null)
  const [photo, setPhoto] = useState<string | null>(null)
  const [noCamera, setNoCamera] = useState(false)

  useEffect(() => {
    let alive = true
    void readLocation().then((r) => alive && setLocation(r))
    return () => {
      alive = false
    }
  }, [])

  const ready = location !== null && (photo !== null || noCamera)
  return (
    <div className="space-y-4">
      <LocationStatus location={location} branch={branch} />
      <SelfieCamera photo={photo} onPhoto={setPhoto} onUnavailable={() => setNoCamera(true)} />
      <Button
        size="lg"
        className="h-14 w-full text-base"
        disabled={!ready || pending}
        onClick={() => onConfirm({ location: isFix(location) ? location : null, photo })}
      >
        {pending ? <Loader2 className="animate-spin" /> : <LogIn />}
        {location === null
          ? 'Getting your location…'
          : photo || noCamera
            ? 'Clock in'
            : 'Take your photo first'}
      </Button>
    </div>
  )
}

function LocationStatus({
  location,
  branch,
}: {
  location: GeoFix | LocationProblem | null
  branch: Branch
}) {
  const row = (icon: React.ReactNode, text: string, tone: string) => (
    <div className={`flex items-start gap-2 rounded-lg p-3 text-left text-sm ${tone}`}>
      {icon}
      <span>{text}</span>
    </div>
  )
  const pin = <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden />
  if (location === null)
    return row(
      <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin" aria-hidden />,
      'Getting your location…',
      'bg-muted',
    )
  if (!isFix(location))
    return row(
      <MapPinOff className="mt-0.5 size-4 shrink-0" aria-hidden />,
      location === 'denied'
        ? 'Location not shared. Allow location for this site to record where you clock in. Your manager will see “No location”.'
        : 'Your location could not be read. Your manager will see “No location”.',
      'bg-warning-soft text-warning',
    )
  const shop = branch.location
  if (!shop) return row(pin, `Location recorded (±${Math.round(location.accuracy)} m).`, 'bg-muted')
  return isAtShop(location, shop)
    ? row(pin, 'You’re at the shop ✓', 'bg-success-soft text-success')
    : row(
        pin,
        `You’re ${formatDistance(distanceMeters(location, shop))} from the shop. You can still clock in; your manager will be notified.`,
        'bg-warning-soft text-warning',
      )
}
