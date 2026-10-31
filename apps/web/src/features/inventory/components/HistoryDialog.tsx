import type { InventoryItem } from '@cityreach/shared'
import { History } from 'lucide-react'
import { EmptyState, ErrorState } from '@/components/common/EmptyState'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDateTime, formatQty } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useMovements } from '../queries'

const REASON: Record<string, string> = {
  delivery: 'Delivery',
  usage: 'Used',
  waste: 'Wasted',
  correction: 'Count / set',
}

/** Stock movement log for one item (the audit trail behind every quantity). */
export function HistoryDialog({
  item,
  timeZone,
  onClose,
}: {
  item: InventoryItem | null
  timeZone: string
  onClose: () => void
}) {
  const moves = useMovements(item?.id ?? null)
  if (!item) return null
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Stock history · {item.name}</DialogTitle>
          <DialogDescription>Last 20 changes, newest first.</DialogDescription>
        </DialogHeader>
        {moves.error ? (
          <ErrorState error={moves.error} />
        ) : moves.isPending ? (
          <Skeleton className="h-40 w-full" />
        ) : moves.data.length === 0 ? (
          <EmptyState icon={History} title="No changes recorded yet" />
        ) : (
          <ul className="max-h-96 divide-y overflow-y-auto">
            {moves.data.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <div>
                  <div className="font-medium">{REASON[m.reason] ?? m.reason}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatDateTime(m.createdAt, timeZone)}
                    {m.byName ? ` · ${m.byName}` : ''}
                  </div>
                </div>
                <div className="text-right">
                  <div
                    className={cn(
                      'font-medium tabular-nums',
                      m.delta > 0 ? 'text-success' : 'text-danger',
                    )}
                  >
                    {m.delta > 0 ? '+' : ''}
                    {Number(m.delta.toFixed(3))}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    → {formatQty(m.quantityAfter, item.unit)}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  )
}
