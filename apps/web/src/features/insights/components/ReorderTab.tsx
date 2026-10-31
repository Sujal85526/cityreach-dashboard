import {
  addDays,
  lastUnitPrices,
  reorderSuggestions,
  REORDER_COVER_DAYS,
  REORDER_WARN_DAYS,
  REORDER_WINDOW_DAYS,
} from '@cityreach/shared'
import { PackageCheck, ShoppingCart } from 'lucide-react'
import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router'
import { EmptyState, ErrorState } from '@/components/common/EmptyState'
import { TonePill } from '@/components/common/StatusPill'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useInventory } from '@/features/inventory/queries'
import type { OrderPrefill } from '@/features/purchasing/components/OrderDialog'
import { useToday } from '@/hooks/use-today'
import { formatQty } from '@/lib/format'
import { useMovementsBetween, usePurchaseOrders } from '../queries'

type Suggestion = ReturnType<typeof reorderSuggestions>[number]

const groupBySupplier = (rows: Suggestion[]) => {
  const groups = new Map<string, { id: string | null; name: string; rows: Suggestion[] }>()
  for (const row of rows) {
    const key = row.supplierId ?? 'none'
    const group = groups.get(key) ?? {
      id: row.supplierId,
      name: row.supplierName ?? 'No supplier set',
      rows: [],
    }
    group.rows.push(row)
    groups.set(key, group)
  }
  return [...groups.values()].sort((a, b) => Number(a.id === null) - Number(b.id === null))
}

/** What to buy now, per supplier, with a button that starts the purchase order. */
export function ReorderTab() {
  const today = useToday()
  const navigate = useNavigate()
  const items = useInventory()
  const movements = useMovementsBetween(addDays(today, -REORDER_WINDOW_DAYS), today)
  const orders = usePurchaseOrders()

  const suggestions = useMemo(
    () => reorderSuggestions(items.data ?? [], movements.data ?? [], new Date()),
    [items.data, movements.data],
  )
  const prices = useMemo(() => lastUnitPrices(orders.data ?? []), [orders.data])

  const error = items.error ?? movements.error ?? orders.error
  if (error) return <ErrorState error={error} onRetry={() => void items.refetch()} />
  if (!items.data || !movements.data || !orders.data)
    return <Skeleton className="h-64 w-full rounded-xl" />

  const startOrder = (supplierId: string, rows: Suggestion[]) => {
    const reorder: OrderPrefill = {
      supplierId,
      lines: rows.map((r) => ({
        itemId: r.id,
        quantity: r.orderQuantity,
        unitPrice: prices.get(r.id) ?? 0,
      })),
    }
    void navigate('/purchasing', { state: { reorder } })
  }

  return (
    <>
      <p className="max-w-2xl text-sm text-muted-foreground">
        Based on the last {REORDER_WINDOW_DAYS} days of use. An item shows here when it is below its
        minimum or will last {REORDER_WARN_DAYS} days or fewer; the amount brings it to the minimum
        plus {REORDER_COVER_DAYS} days of use.
      </p>
      {suggestions.length === 0 && (
        <EmptyState
          icon={PackageCheck}
          title="Nothing to order right now"
          description="Every item is above its minimum and will last more than a week."
        />
      )}
      {groupBySupplier(suggestions).map((group) => (
        <Card key={group.id ?? 'none'}>
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
            <CardTitle>{group.name}</CardTitle>
            {group.id ? (
              <Button onClick={() => startOrder(group.id ?? '', group.rows)}>
                <ShoppingCart /> Create purchase order
              </Button>
            ) : (
              <Button variant="outline" asChild>
                <Link to="/inventory">Set a supplier</Link>
              </Button>
            )}
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {group.rows.map((row) => (
                <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <div className="min-w-0">
                    <p className="font-medium">{row.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatQty(row.quantity, row.unit)} left, minimum{' '}
                      {formatQty(row.minQuantity, row.unit)}
                      {row.dailyUse > 0 && ` · uses ${formatQty(row.dailyUse, row.unit)} a day`}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {row.daysLeft !== null && (
                      <TonePill tone={row.daysLeft <= 3 ? 'danger' : 'warning'}>
                        {row.daysLeft === 0 ? 'Runs out today' : `${row.daysLeft} days left`}
                      </TonePill>
                    )}
                    <span className="font-medium whitespace-nowrap">
                      Order {formatQty(row.orderQuantity, row.unit)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ))}
    </>
  )
}
