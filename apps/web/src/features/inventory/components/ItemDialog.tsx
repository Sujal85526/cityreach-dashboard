import type { Branch, InventoryItem } from '@cityreach/shared'
import { Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { SuggestInput } from '@/components/common/SuggestInput'
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
import { useSuppliers } from '@/features/suppliers/queries'
import { errorMessage } from '@/lib/errors'
import { useSaveItem } from '../queries'

const UNITS = ['L', 'ml', 'kg', 'g', 'pcs', 'btl', 'box', 'pack']
const NONE = 'none'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  branch: Branch
  item?: InventoryItem
  categories: string[]
}

/** Add / edit an inventory item. The starting quantity is set only when adding. */
export function ItemDialog({ open, onOpenChange, branch, item, categories }: Props) {
  const suppliers = useSuppliers().data ?? []
  const save = useSaveItem()
  const [f, setF] = useState({
    name: '',
    category: '',
    unit: 'pcs',
    quantity: '',
    minQuantity: '',
    supplierId: NONE,
  })

  useEffect(() => {
    if (!open) return
    setF(
      item
        ? {
            name: item.name,
            category: item.category,
            unit: item.unit,
            quantity: String(item.quantity),
            minQuantity: String(item.minQuantity),
            supplierId: item.supplierId ?? NONE,
          }
        : { name: '', category: '', unit: 'pcs', quantity: '', minQuantity: '', supplierId: NONE },
    )
  }, [open, item])

  const set = (patch: Partial<typeof f>) => setF({ ...f, ...patch })
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const quantity = Number(f.quantity)
    const minQuantity = Number(f.minQuantity)
    if (!f.name.trim() || !f.category.trim() || !f.unit.trim())
      return toast.error('Fill in name, category and unit.')
    if (
      f.quantity === '' ||
      f.minQuantity === '' ||
      quantity < 0 ||
      minQuantity < 0 ||
      Number.isNaN(quantity + minQuantity)
    )
      return toast.error('Quantities must be 0 or more.')
    const supplier = suppliers.find((s) => s.id === f.supplierId) ?? null
    save.mutate(
      {
        item,
        branch,
        supplier,
        input: {
          name: f.name.trim(),
          category: f.category.trim(),
          unit: f.unit.trim(),
          quantity,
          minQuantity,
          supplierId: supplier?.id ?? null,
        },
      },
      {
        onSuccess: () => {
          toast.success(item ? 'Item updated' : `${f.name.trim()} added`)
          onOpenChange(false)
        },
        onError: (err) => toast.error(errorMessage(err)),
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{item ? 'Edit item' : 'Add item'}</DialogTitle>
          <DialogDescription>
            {item
              ? 'To change the quantity, use Adjust stock so the change is logged.'
              : 'Status (In stock / Low / Critical) is set automatically from the minimum.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2" noValidate>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="i-name">Item</Label>
            <Input
              id="i-name"
              value={f.name}
              maxLength={80}
              onChange={(e) => set({ name: e.target.value })}
              placeholder="Oat Milk"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="i-cat">Category</Label>
            <SuggestInput
              id="i-cat"
              value={f.category}
              onChange={(category) => set({ category })}
              suggestions={categories}
              placeholder="Dairy"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="i-unit">Unit</Label>
            <SuggestInput
              id="i-unit"
              value={f.unit}
              maxLength={10}
              onChange={(unit) => set({ unit })}
              suggestions={UNITS}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="i-qty">{item ? 'Current quantity' : 'Quantity in stock'}</Label>
            <Input
              id="i-qty"
              type="number"
              min={0}
              step="any"
              inputMode="decimal"
              disabled={Boolean(item)}
              value={f.quantity}
              onChange={(e) => set({ quantity: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="i-min">Minimum quantity</Label>
            <Input
              id="i-min"
              type="number"
              min={0}
              step="any"
              inputMode="decimal"
              value={f.minQuantity}
              onChange={(e) => set({ minQuantity: e.target.value })}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Supplier</Label>
            <Select value={f.supplierId} onValueChange={(v) => set({ supplierId: v })}>
              <SelectTrigger className="w-full" aria-label="Supplier">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>No supplier</SelectItem>
                {suppliers.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending && <Loader2 className="animate-spin" />}
              {item ? 'Save changes' : 'Add item'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
