import { Camera, RotateCcw, ScanFace } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { errorMessage } from '@/lib/errors'
import { mockSelfie } from '../capture'

/**
 * Demo camera: a simulated viewfinder with a "Take photo" button that produces a generated
 * portrait. No real camera or permission is involved. Reports `null` until a photo is taken.
 */
export function SelfieCamera({
  photo,
  onPhoto,
}: {
  photo: string | null
  onPhoto: (dataUrl: string | null) => void
  onUnavailable?: () => void
}) {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const id = setTimeout(() => setReady(true), 600)
    return () => clearTimeout(id)
  }, [])

  const take = () => {
    try {
      onPhoto(mockSelfie())
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  return (
    <div className="space-y-3">
      <div className="relative mx-auto aspect-square w-full max-w-64 overflow-hidden rounded-2xl bg-brand text-brand-cream">
        {photo ? (
          <img src={photo} alt="Your clock-in photo" className="absolute inset-0 size-full" />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
            <ScanFace
              className={ready ? 'size-16 opacity-80' : 'size-16 animate-pulse opacity-40'}
              aria-hidden
            />
            <span className="text-xs tracking-wide text-brand-cream/70">
              {ready ? 'Demo camera ready' : 'Starting camera…'}
            </span>
            {[
              'top-3 left-3 border-t-2 border-l-2',
              'top-3 right-3 border-t-2 border-r-2',
              'bottom-3 left-3 border-b-2 border-l-2',
              'bottom-3 right-3 border-b-2 border-r-2',
            ].map((c) => (
              <span
                key={c}
                className={`absolute size-5 rounded-sm border-brand-cream/60 ${c}`}
                aria-hidden
              />
            ))}
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
          disabled={!ready}
        >
          <Camera /> Take photo
        </Button>
      )}
    </div>
  )
}
