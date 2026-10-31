export const STOCK_STATUSES = ['in_stock', 'low', 'critical'] as const
export type StockStatus = (typeof STOCK_STATUSES)[number]

const SEVERITY: Record<StockStatus, number> = { in_stock: 0, low: 1, critical: 2 }

/**
 * Stock status from quantity vs. minimum.
 * Below minimum → low; at or below `criticalRatio` × minimum → critical.
 * Example: oat milk 14 L, min 15 L, ratio 0.5 → 'low'.
 */
export function stockStatus(
  quantity: number,
  minQuantity: number,
  criticalRatio: number,
): StockStatus {
  if (quantity <= minQuantity * criticalRatio) return 'critical'
  if (quantity < minQuantity) return 'low'
  return 'in_stock'
}

/** Alert only when stock gets worse (in_stock → low, low → critical), not on every update. */
export function shouldAlertStockChange(prev: StockStatus, next: StockStatus): boolean {
  return SEVERITY[next] > SEVERITY[prev]
}

export type StockChange =
  | { mode: 'add'; amount: number } // delivery received
  | { mode: 'remove'; amount: number } // used or wasted
  | { mode: 'count'; amount: number } // physical count: set the exact quantity

/**
 * New quantity and the signed change for a stock update. Never goes below zero.
 * Example: 14 L oat milk, remove 4 → { quantity: 10, delta: -4 }; count 20 → { quantity: 20, delta: +6 }.
 */
export function applyStockChange(
  current: number,
  change: StockChange,
): { quantity: number; delta: number } {
  const target =
    change.mode === 'add'
      ? current + change.amount
      : change.mode === 'remove'
        ? current - change.amount
        : change.amount
  const quantity = Math.max(0, Math.round(target * 1000) / 1000)
  return { quantity, delta: Math.round((quantity - current) * 1000) / 1000 }
}
