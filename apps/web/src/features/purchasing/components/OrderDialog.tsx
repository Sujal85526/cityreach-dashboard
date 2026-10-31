import {
  orderLineSchema,
  orderTotal,
  type InventoryItem,
  type OrderLineInput,
  type PurchaseOrder,
  type Supplier,
} from '@dm/shared'
import { Loader2, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { formatMoney } from '@/lib/format'

export interface OrderDraft {
  supplierId: string
  supplierName: string
  expectedOn: string | null
  lines: OrderLineInput[]
  total: number
  invoiceNumber: string
  paymentDueOn: string | null
  note: string
}

/**
 * New or draft purchase order: a supplier, the items with quantities and prices (the supplier's
 * own items are suggested first), expected delivery, and the supplier's invoice and due date.
 */
export function OrderDialog({
  existing,
  suppliers,
  items,
  pending,
  onSave,
  onClose,
}: {
  existing: PurchaseOrder | null
  suppliers: Supplier[]
  items: InventoryItem[]
  pending: boolean
  onSave: (draft: OrderDraft) => void
  onClose: () => void
}) {
  const [supplierId, setSupplierId] = useState(existing?.supplierId ?? suppliers[0]?.id ?? '')
  const [expectedOn, setExpectedOn] = useState(existing?.expectedOn ?? '')
  const [invoiceNumber, setInvoiceNumber] = useState(existing?.invoiceNumber ?? '')
  const [paymentDueOn, setPaymentDueOn] = useState(existing?.paymentDueOn ?? '')
  const [note, setNote] = useState(existing?.note ?? '')
  const [lines, setLines] = useState<{ itemId: string; quantity: string; unitPrice: string }[]>(
    existing?.lines.map((l) => ({
      itemId: l.itemId,
      quantity: String(l.quantity),
      unitPrice: String(l.unitPrice),
    })) ?? [{ itemId: '', quantity: '1', unitPrice: '0' }],
  )
  const supplierItems = [...items].sort(
    (a, b) => Number(b.supplierId === supplierId) - Number(a.supplierId === supplierId),
  )
  const parsed = lines.map((l) => {
    const item = items.find((i) => i.id === l.itemId)
    return {
      itemId: l.itemId,
      itemName: item?.name ?? '',
      unit: item?.unit ?? '',
      quantity: Number(l.quantity),
      unitPrice: Number(l.unitPrice),
    }
  })
  const total = orderTotal(parsed.filter((l) => l.itemId))
  const setLine = (i: number, patch: Partial<(typeof lines)[number]>) =>
    setLines(lines.map((l, j) => (j === i ? { ...l, ...patch } : l)))

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const supplier = suppliers.find((s) => s.id === supplierId)
    if (!supplier) return toast.error('Choose a supplier.')
    const valid = parsed.filter((l) => l.itemId)
    if (valid.length === 0) return toast.error('Add at least one item.')
    if (valid.some((l) => !orderLineSchema.safeParse(l).success))
      return toast.error('Each item needs a quantity above 0 and a price of 0 or more.')
    onSave({
      supplierId,
      supplierName: supplier.name,
      expectedOn: expectedOn || null,
      lines: valid,
      total,
      invoiceNumber: invoiceNumber.trim(),
      paymentDueOn: paymentDueOn || null,
      note: note.trim(),
    })
  }

  return (
    <Dialog open onOpenChange={(o) => !o && !pending && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <form onSubmit={submit} noValidate className="space-y-4">
          <DialogHeader>
            <DialogTitle>{existing ? `Edit ${existing.number}` : 'New purchase order'}</DialogTitle>
            <DialogDescription>
              Receiving it later adds every item to stock automatically.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="po-supplier">Supplier</Label>
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger id="po-supplier" className="w-full">
                  <SelectValue placeholder="Choose a supplier" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="po-expected">Expected delivery</Label>
              <Input
                id="po-expected"
                type="date"
                value={expectedOn}
                onChange={(e) => setExpectedOn(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Items</Label>
            {lines.map((l, i) => {
              const item = items.find((it) => it.id === l.itemId)
              return (
                <div key={i} className="grid grid-cols-[1fr_5rem_6rem_2.25rem] items-center gap-2">
                  <Select
                    value={l.itemId || undefined}
                    onValueChange={(itemId) => setLine(i, { itemId })}
                  >
                    <SelectTrigger className="w-full" aria-label={`Item ${i + 1}`}>
                      <SelectValue placeholder="Item" />
                    </SelectTrigger>
                    <SelectContent>
                      {supplierItems.map((it) => (
                        <SelectItem key={it.id} value={it.id}>
                          {it.name} ({it.unit})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    value={l.quantity}
                    onChange={(e) => setLine(i, { quantity: e.target.value })}
                    aria-label={`Quantity${item ? ` (${item.unit})` : ''}`}
                  />
                  <Input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step={0.01}
                    value={l.unitPrice}
                    onChange={(e) => setLine(i, { unitPrice: e.target.value })}
                    aria-label="Price per unit (AED)"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Remove item"
                    onClick={() => setLines(lines.filter((_, j) => j !== i))}
                    disabled={lines.length === 1}
                  >
                    <Trash2 />
                  </Button>
                </div>
              )
            })}
            <div className="flex items-center justify-between">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setLines([...lines, { itemId: '', quantity: '1', unitPrice: '0' }])}
              >
                <Plus /> Add item
              </Button>
              <span className="text-sm">
                Total <span className="font-semibold tabular-nums">{formatMoney(total)}</span>
              </span>
            </div>
            <p className="text-xs text-muted-foreground">Quantity · price per unit (AED)</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="po-invoice">Supplier invoice no. (optional)</Label>
              <Input
                id="po-invoice"
                value={invoiceNumber}
                maxLength={60}
                onChange={(e) => setInvoiceNumber(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="po-due">Payment due (optional)</Label>
              <Input
                id="po-due"
                type="date"
                value={paymentDueOn}
                onChange={(e) => setPaymentDueOn(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="po-note">Note (optional)</Label>
            <Textarea
              id="po-note"
              value={note}
              maxLength={300}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
