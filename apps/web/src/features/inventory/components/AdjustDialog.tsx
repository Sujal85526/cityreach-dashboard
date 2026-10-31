import {
  applyStockChange,
  stockStatus,
  type Branch,
  type InventoryItem,
  type StockChange,
} from '@cityreach/shared'
import { Loader2, Minus, Plus, ClipboardCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { StatusPill } from '@/components/common/StatusPill'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { errorMessage } from '@/lib/errors'
import { formatQty } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { MovementReason } from '../api'
import { useAdjustStock } from '../queries'

const MODES = [
  { id: 'delivery', label: 'Delivery received', icon: Plus, mode: 'add' },
  { id: 'usage', label: 'Used', icon: Minus, mode: 'remove' },
  { id: 'waste', label: 'Wasted / expired', icon: Minus, mode: 'remove' },
  { id: 'correction', label: 'Stock count', icon: ClipboardCheck, mode: 'count' },
] as const satisfies readonly {
  id: MovementReason
  label: string
  icon: unknown
  mode: StockChange['mode']
}[]

interface Props {
  item: InventoryItem | null
  branch: Branch
  onClose: () => void
}

/** Stock in / out / count with a live preview of the new quantity and status. */
export function AdjustDialog({ item, branch, onClose }: Props) {
  const adjust = useAdjustStock()
  const [reason, setReason] = useState<MovementReason>('delivery')
  const [amount, setAmount] = useState('')
  useEffect(() => {
    setReason('delivery')
    setAmount('')
  }, [item])
  if (!item) return null

  const mode = MODES.find((m) => m.id === reason) ?? MODES[0]
  const value = Number(amount)
  const valid =
    amount !== '' && !Number.isNaN(value) && value >= 0 && (mode.mode === 'count' || value > 0)
  const preview = valid ? applyStockChange(item.quantity, { mode: mode.mode, amount: value }) : null
  const previewStatus =
    preview && stockStatus(preview.quantity, item.minQuantity, branch.rules.inventory.criticalRatio)

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!valid)
      return toast.error(
        mode.mode === 'count' ? 'Enter the counted quantity.' : 'Enter an amount above 0.',
      )
    adjust.mutate(
      { itemId: item.id, change: { mode: mode.mode, amount: value }, reason, branch },
      {
        onSuccess: (r) => {
          toast.success(`${item.name}: ${formatQty(r.quantity, item.unit)}`)
          onClose()
        },
        onError: (err) => toast.error(errorMessage(err)),
      },
    )
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Adjust stock · {item.name}</DialogTitle>
          <DialogDescription>
            Now {formatQty(item.quantity, item.unit)} · minimum{' '}
            {formatQty(item.minQuantity, item.unit)}. Every change is logged.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4" noValidate>
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Type of change">
            {MODES.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={reason === id}
                onClick={() => setReason(id)}
                className={cn(
                  'flex items-center gap-2 rounded-lg border p-2.5 text-left text-sm transition-colors',
                  reason === id ? 'border-primary bg-primary/10 font-medium' : 'hover:bg-muted',
                )}
              >
                <Icon className="size-4" /> {label}
              </button>
            ))}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="adj-amount">
              {mode.mode === 'count' ? `Counted quantity (${item.unit})` : `Amount (${item.unit})`}
            </Label>
            <Input
              id="adj-amount"
              type="number"
              min={0}
              step="any"
              inputMode="decimal"
              autoFocus
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          {preview && previewStatus && (
            <div
              className="flex items-center justify-between rounded-lg bg-muted/60 p-3 text-sm"
              role="status"
            >
              <span>
                New stock: <strong>{formatQty(preview.quantity, item.unit)}</strong>{' '}
                <span className="text-muted-foreground">
                  ({preview.delta > 0 ? '+' : ''}
                  {Number(preview.delta.toFixed(3))})
                </span>
              </span>
              <StatusPill status={previewStatus} kind="stock" />
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={adjust.isPending || !valid}>
              {adjust.isPending && <Loader2 className="animate-spin" />} Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
