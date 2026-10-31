/** Where a clock-in happened, compared with the shop's saved location (Settings → Shop location). */

export interface GeoPoint {
  lat: number
  lng: number
}

/** A phone's location reading: the point and its accuracy radius in metres. */
export interface GeoFix extends GeoPoint {
  accuracy: number
}

export interface ShopLocation extends GeoPoint {
  /** Clock-ins within this many metres count as "At shop". */
  radiusMeters: number
}

export const DEFAULT_SHOP_RADIUS_METERS = 100

const EARTH_RADIUS_M = 6_371_000
const rad = (deg: number) => (deg * Math.PI) / 180

/** Straight-line distance in whole metres (haversine). */
export function distanceMeters(a: GeoPoint, b: GeoPoint): number {
  const dLat = rad(b.lat - a.lat)
  const dLng = rad(b.lng - a.lng)
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return Math.round(2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h)))
}

/**
 * At the shop when the reading's accuracy circle reaches the shop radius. Indoor GPS is often
 * 30–80 m off, so honest staff aren't flagged; the accuracy credit is capped at the radius so a
 * vague reading (e.g. ±5 km on a laptop) can't count as "at shop".
 * Example: radius 100 m, reading 150 m away ±60 m → at shop; 400 m away ±60 m → away.
 */
export function isAtShop(fix: GeoFix, shop: ShopLocation): boolean {
  return distanceMeters(fix, shop) - Math.min(fix.accuracy, shop.radiusMeters) <= shop.radiusMeters
}

/** What is stored on the attendance record: the reading plus the verdict at that moment. */
export interface ClockLocation extends GeoFix {
  /** Metres from the shop; null when the shop location isn't set yet. */
  distance: number | null
  inside: boolean | null
}

export function toClockLocation(fix: GeoFix, shop: ShopLocation | null | undefined): ClockLocation {
  const round = (n: number) => Math.round(n * 1e6) / 1e6
  return {
    lat: round(fix.lat),
    lng: round(fix.lng),
    accuracy: Math.round(fix.accuracy),
    distance: shop ? distanceMeters(fix, shop) : null,
    inside: shop ? isAtShop(fix, shop) : null,
  }
}
