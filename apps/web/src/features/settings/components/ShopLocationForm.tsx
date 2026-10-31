import { DEFAULT_SHOP_RADIUS_METERS, type Branch } from '@dm/shared'
import { Crosshair, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { isFix, readLocation } from '@/features/attendance/capture'
import { errorMessage } from '@/lib/errors'
import { useUpdateBranch } from '../queries'
import { inRange, NumberField } from './NumberField'
import { SettingsCard } from './SettingsCard'

const coord = (v: string, limit: number) => {
  const n = Number(v)
  return v.trim() !== '' && Number.isFinite(n) && Math.abs(n) <= limit ? n : null
}

/**
 * Where the shop is, for the clock-in location check. Easiest: stand in the shop and tap
 * "Use my current location". Clock-ins farther than the radius are flagged, not blocked.
 */
export function ShopLocationForm({ branch }: { branch: Branch }) {
  const saved = branch.location ?? null
  const [lat, setLat] = useState(saved ? String(saved.lat) : '')
  const [lng, setLng] = useState(saved ? String(saved.lng) : '')
  const [radius, setRadius] = useState(saved?.radiusMeters ?? DEFAULT_SHOP_RADIUS_METERS)
  const [locating, setLocating] = useState(false)
  const update = useUpdateBranch()

  const dirty =
    lat !== (saved ? String(saved.lat) : '') ||
    lng !== (saved ? String(saved.lng) : '') ||
    radius !== (saved?.radiusMeters ?? DEFAULT_SHOP_RADIUS_METERS)

  const fillFromHere = async () => {
    setLocating(true)
    const r = await readLocation()
    setLocating(false)
    if (!isFix(r))
      return toast.error(
        r === 'denied'
          ? 'Allow location for this site in your browser, then try again.'
          : 'Your location could not be read. Enter it by hand.',
      )
    setLat(r.lat.toFixed(6))
    setLng(r.lng.toFixed(6))
    toast.success(`Location found (±${Math.round(r.accuracy)} m). Save to keep it.`)
  }

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const la = coord(lat, 90)
    const ln = coord(lng, 180)
    if (la === null || ln === null)
      return toast.error('Enter a latitude (−90 to 90) and longitude (−180 to 180).')
    if (!inRange(radius, 20, 5000)) return toast.error('Radius must be 20–5000 metres.')
    update.mutate(
      { patch: { location: { lat: la, lng: ln, radiusMeters: radius } }, what: 'shop location' },
      {
        onSuccess: () => toast.success('Shop location saved'),
        onError: (err) => toast.error(errorMessage(err)),
      },
    )
  }

  return (
    <SettingsCard
      title="Shop location"
      description="Clock-ins are checked against this. Staff farther away can still clock in, but you see the distance and get a notification."
      onSubmit={onSubmit}
      saving={update.isPending}
      dirty={dirty}
    >
      <Button
        type="button"
        variant="outline"
        onClick={() => void fillFromHere()}
        disabled={locating}
      >
        {locating ? <Loader2 className="animate-spin" /> : <Crosshair />}
        Use my current location
      </Button>
      <p className="text-xs text-muted-foreground">
        Do this while you are inside the shop, or paste the coordinates from Google Maps
        (right-click the shop → the numbers at the top).
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="lat">Latitude</Label>
          <Input
            id="lat"
            inputMode="decimal"
            value={lat}
            onChange={(e) => setLat(e.target.value)}
            placeholder="25.204849"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="lng">Longitude</Label>
          <Input
            id="lng"
            inputMode="decimal"
            value={lng}
            onChange={(e) => setLng(e.target.value)}
            placeholder="55.270783"
          />
        </div>
      </div>
      <NumberField
        id="radius"
        label="Allowed distance"
        suffix="metres"
        min={20}
        max={5000}
        value={radius}
        onChange={setRadius}
        hint="Clock-ins within this distance count as “At shop”. Phone GPS indoors is often 30–80 m off, so 100 m works for most shops."
      />
    </SettingsCard>
  )
}
