import type { GeoFix } from '@cityreach/shared'

/** Why there is no location reading; the clock-in still goes ahead and the manager sees it. */
export type LocationProblem = 'denied' | 'unavailable'

/**
 * One location reading from the phone (asks for permission the first time). Resolves with the
 * reading or the reason there isn't one; never rejects, so a clock-in is never blocked by GPS.
 */
export function readLocation(timeoutMs = 15_000): Promise<GeoFix | LocationProblem> {
  if (!('geolocation' in navigator)) return Promise.resolve('unavailable')
  return new Promise((resolve) =>
    navigator.geolocation.getCurrentPosition(
      (p) =>
        resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }),
      (e) => resolve(e.code === e.PERMISSION_DENIED ? 'denied' : 'unavailable'),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 0 },
    ),
  )
}

export const isFix = (r: GeoFix | LocationProblem | null): r is GeoFix =>
  r !== null && typeof r === 'object'

/** Size of the stored photo: a 320 px square JPEG is ≈ 20–40 kB, small enough for Firestore. */
const PHOTO_PX = 320

/**
 * Square JPEG from the live camera frame, the right way round (the preview is mirrored like a
 * selfie camera; the saved photo isn't, so signs behind the person read normally).
 */
export function snapshot(video: HTMLVideoElement): string {
  const side = Math.min(video.videoWidth, video.videoHeight)
  const canvas = document.createElement('canvas')
  canvas.width = PHOTO_PX
  canvas.height = PHOTO_PX
  const ctx = canvas.getContext('2d')
  if (!ctx || !side) throw new Error('The camera has no picture yet. Try again.')
  ctx.drawImage(
    video,
    (video.videoWidth - side) / 2,
    (video.videoHeight - side) / 2,
    side,
    side,
    0,
    0,
    PHOTO_PX,
    PHOTO_PX,
  )
  return canvas.toDataURL('image/jpeg', 0.7)
}
