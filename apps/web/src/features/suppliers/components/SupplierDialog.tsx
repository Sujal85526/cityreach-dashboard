import type { Supplier } from '@dm/shared'
import { Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
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
import { errorMessage } from '@/lib/errors'
import { useSaveSupplier } from '../queries'

const EMPTY = { name: '', contactName: '', phone: '', email: '', categories: '' }

export function SupplierDialog({
  open,
  onOpenChange,
  supplier,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  supplier?: Supplier
}) {
  const save = useSaveSupplier()
  const [f, setF] = useState(EMPTY)
  useEffect(() => {
    if (open) setF(supplier ? { ...supplier, categories: supplier.categories.join(', ') } : EMPTY)
  }, [open, supplier])
  const set = (patch: Partial<typeof f>) => setF({ ...f, ...patch })

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!f.name.trim()) return toast.error('Enter the supplier name.')
    if (f.email && !/^\S+@\S+\.\S+$/.test(f.email))
      return toast.error('That email address is not valid.')
    save.mutate(
      {
        current: supplier ?? null,
        input: {
          name: f.name.trim(),
          contactName: f.contactName.trim(),
          phone: f.phone.trim(),
          email: f.email.trim(),
          categories: f.categories
            .split(',')
            .map((c) => c.trim())
            .filter(Boolean),
        },
      },
      {
        onSuccess: () => {
          toast.success(supplier ? 'Supplier updated' : `${f.name.trim()} added`)
          onOpenChange(false)
        },
        onError: (err) => toast.error(errorMessage(err)),
      },
    )
  }

  const field = (key: keyof typeof f, label: string, props: React.ComponentProps<'input'> = {}) => (
    <div className="space-y-1.5">
      <Label htmlFor={`s-${key}`}>{label}</Label>
      <Input
        id={`s-${key}`}
        value={f[key]}
        onChange={(e) => set({ [key]: e.target.value })}
        {...props}
      />
    </div>
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{supplier ? 'Edit supplier' : 'Add supplier'}</DialogTitle>
          <DialogDescription>
            Link items to a supplier from Inventory → Edit details.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2" noValidate>
          {field('name', 'Company', { maxLength: 80, placeholder: 'Green Valley' })}
          {field('contactName', 'Contact person', { maxLength: 80 })}
          {field('phone', 'Phone', { type: 'tel', maxLength: 20 })}
          {field('email', 'Email', { type: 'email' })}
          <div className="sm:col-span-2">
            {field('categories', 'Supplies (comma separated)', { placeholder: 'Dairy, Syrups' })}
          </div>
          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending && <Loader2 className="animate-spin" />}
              {supplier ? 'Save changes' : 'Add supplier'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
