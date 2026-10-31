import { lastUnitPrices, monthEnd, wasteReport } from '@cityreach/shared'
import { Package, Trash2, Wallet } from 'lucide-react'
import { useMemo, useState } from 'react'
import { DataTable, type Column } from '@/components/common/DataTable'
import { EmptyState, ErrorState } from '@/components/common/EmptyState'
import { StatCard } from '@/components/common/StatCard'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useInventory } from '@/features/inventory/queries'
import { useToday } from '@/hooks/use-today'
import { formatMoney, formatQty } from '@/lib/format'
import { useMovementsBetween, usePurchaseOrders } from '../queries'
import { MonthPicker } from './MonthPicker'

type Row = ReturnType<typeof wasteReport>['items'][number] & { unit: string }
const columns: Column<Row>[] = [
  { key: 'item', header: 'Item', cell: (r) => <span className="font-medium">{r.itemName}</span> },
  { key: 'quantity', header: 'Wasted', cell: (r) => formatQty(r.quantity, r.unit) },
  { key: 'times', header: 'Times', cell: (r) => r.times },
  {
    key: 'cost',
    header: 'Cost',
    cell: (r) =>
      r.cost === null ? (
        <span className="text-muted-foreground">No price yet</span>
      ) : (
        formatMoney(r.cost)
      ),
  },
]

/** A month's waste per item and what it cost, from "Wasted / expired" stock changes. */
export function WasteTab() {
  const today = useToday()
  const [month, setMonth] = useState(today.slice(0, 7))
  const movements = useMovementsBetween(`${month}-01`, monthEnd(month))
  const orders = usePurchaseOrders()
  const items = useInventory()

  const report = useMemo(
    () => wasteReport(movements.data ?? [], lastUnitPrices(orders.data ?? [])),
    [movements.data, orders.data],
  )
  const rows = useMemo(() => {
    const units = new Map(items.data?.map((i) => [i.id, i.unit]))
    return report.items.map((r) => ({ ...r, unit: units.get(r.itemId) ?? '' }))
  }, [report, items.data])

  const error = movements.error ?? orders.error ?? items.error
  const loading = !movements.data || !orders.data || !items.data
  if (error) return <ErrorState error={error} onRetry={() => void movements.refetch()} />

  return (
    <>
      <div className="flex justify-end">
        <MonthPicker month={month} max={today.slice(0, 7)} onChange={setMonth} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard
          label="Cost of waste"
          icon={Wallet}
          loading={loading}
          value={formatMoney(report.totalCost)}
          caption={
            report.unpriced
              ? `${report.unpriced} items have no price yet`
              : 'At the last price paid'
          }
        />
        <StatCard
          label="Items wasted"
          icon={Package}
          loading={loading}
          value={report.items.length}
          caption={`${report.items.reduce((sum, i) => sum + i.times, 0)} times recorded`}
        />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Waste by item</CardTitle>
          <CardDescription>
            Cost uses the last price on a received purchase order. Record waste in Inventory →
            Adjust stock → Wasted / expired.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            rows={rows}
            rowKey={(r) => r.itemId}
            loading={loading}
            empty={
              <EmptyState
                icon={Trash2}
                title="No waste recorded this month"
                description="Stock marked as wasted or expired shows up here."
              />
            }
          />
        </CardContent>
      </Card>
    </>
  )
}
