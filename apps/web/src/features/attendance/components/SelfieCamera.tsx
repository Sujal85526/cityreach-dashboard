import { Camera, CameraOff, RotateCcw } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { errorMessage } from '@/lib/errors'
import { snapshot } from '../capture'

type CameraState = 'starting' | 'live' | 'unavailable'

/**
 * Live front-camera preview with a "Take photo" button. There is no gallery upload, so the
 * photo is taken at the moment of clock-in. Reports `null` while there's no photo yet; when no
 * camera can be used, says so (the clock-in continues and the manager sees "No photo").
 */
export function SelfieCamera({
  photo,
  onPhoto,
  onUnavailable,
}: {
  photo: string | null
  onPhoto: (dataUrl: string | null) => void
  onUnavailable: () => void
}) {
  const video = useRef<HTMLVideoElement>(null)
  const [state, setState] = useState<CameraState>('starting')

  useEffect(() => {
    let stream: MediaStream | null = null
    let cancelled = false
    if (!navigator.mediaDevices?.getUserMedia) {
      setState('unavailable')
      onUnavailable()
      return
    }
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 } }, audio: false })
      .then((s) => {
        if (cancelled) return s.getTracks().forEach((t) => t.stop())
        stream = s
        if (video.current) video.current.srcObject = s
        setState('live')
      })
      .catch(() => {
        if (cancelled) return
        setState('unavailable')
        onUnavailable()
      })
    return () => {
      cancelled = true
      stream?.getTracks().forEach((t) => t.stop())
    }
    // Start the camera once per dialog; the callbacks are stable enough for that.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const take = () => {
    try {
      if (video.current) onPhoto(snapshot(video.current))
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  if (state === 'unavailable')
    return (
      <div className="flex items-start gap-3 rounded-lg bg-warning-soft p-3 text-left text-sm text-warning">
        <CameraOff className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>
          Camera not available. Allow camera access for this site to add your photo, or clock in
          without one. Your manager will see “No photo”.
        </span>
      </div>
    )

  return (
    <div className="space-y-3">
      <div className="relative mx-auto aspect-square w-full max-w-64 overflow-hidden rounded-xl bg-muted">
        <video
          ref={video}
          autoPlay
          playsInline
          muted
          className="size-full scale-x-[-1] object-cover"
          aria-label="Camera preview"
        />
        {photo && (
          <img src={photo} alt="Your clock-in photo" className="absolute inset-0 size-full" />
        )}
        {state === 'starting' && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
            Starting camera…
          </div>
        )}
      </div>
      {photo ? (
        <Button type="button" variant="outline" className="w-full" onClick={() => onPhoto(null)}>
          <RotateCcw /> Retake
        </Button>
      ) : (
        <Button
          type="button"
          variant="outline"
          className="h-11 w-full"
          onClick={take}
          disabled={state !== 'live'}
        >
          <Camera /> Take photo
        </Button>
      )}
    </div>
  )
}
