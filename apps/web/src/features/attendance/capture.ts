import type { GeoFix } from '@cityreach/shared'

/** Why there is no location reading; the clock-in still goes ahead and the manager sees it. */
export type LocationProblem = 'denied' | 'unavailable'

/** The demo shop's door (Albion Street, Manchester); the seeded branch location matches. */
export const DEMO_SHOP_FIX = { lat: 53.4808, lng: -2.2426 }

/**
 * Demo location reading: a believable fix a few metres from the shop, after a short "GPS"
 * delay. No browser permission is asked for and nothing leaves the device.
 */
export function readLocation(_timeoutMs?: number): Promise<GeoFix | LocationProblem> {
  const jitter = () => (Math.random() - 0.5) * 0.0004 // about ±22 m
  return new Promise((resolve) =>
    setTimeout(
      () =>
        resolve({
          lat: DEMO_SHOP_FIX.lat + jitter(),
          lng: DEMO_SHOP_FIX.lng + jitter(),
          accuracy: Math.round(8 + Math.random() * 14),
        }),
      700,
    ),
  )
}

export const isFix = (r: GeoFix | LocationProblem | null): r is GeoFix =>
  r !== null && typeof r === 'object'

/** Size of the stored photo: a small square JPEG, a few kB, so it fits easily in local storage. */
const PHOTO_PX = 240

/**
 * Demo "selfie": a generated portrait placeholder (soft ink backdrop, head and shoulders in
 * warm white) stamped with the time, standing in for a camera photo.
 */
export function mockSelfie(now = new Date()): string {
  const canvas = document.createElement('canvas')
  canvas.width = PHOTO_PX
  canvas.height = PHOTO_PX
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not create the demo photo. Try again.')
  const css = getComputedStyle(document.documentElement)
  const brand = css.getPropertyValue('--brand').trim() || '#1f1c19'
  const cream = css.getPropertyValue('--brand-cream').trim() || '#fbf9f6'

  const bg = ctx.createLinearGradient(0, 0, PHOTO_PX, PHOTO_PX)
  bg.addColorStop(0, brand)
  bg.addColorStop(1, '#5a524a')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, PHOTO_PX, PHOTO_PX)
  ctx.fillStyle = cream
  ctx.globalAlpha = 0.92
  ctx.beginPath()
  ctx.arc(PHOTO_PX / 2, PHOTO_PX * 0.4, PHOTO_PX * 0.17, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.ellipse(PHOTO_PX / 2, PHOTO_PX * 0.98, PHOTO_PX * 0.34, PHOTO_PX * 0.34, 0, Math.PI, 0)
  ctx.fill()
  ctx.globalAlpha = 1
  ctx.fillStyle = cream
  ctx.font = '11px ui-monospace, monospace'
  ctx.fillText(
    now.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Europe/London',
    }),
    10,
    20,
  )
  return canvas.toDataURL('image/jpeg', 0.7)
}
