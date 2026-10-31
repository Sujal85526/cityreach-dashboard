import type { Supplier } from '@cityreach/shared'
import { Mail, Pencil, Phone, Plus, Trash2, Truck } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { DataTable, type Column } from '@/components/common/DataTable'
import { EmptyState, ErrorState } from '@/components/common/EmptyState'
import { PageHeader } from '@/components/common/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useInventory } from '@/features/inventory/queries'
import { errorMessage } from '@/lib/errors'
import { SupplierDialog } from '../components/SupplierDialog'
import { useDeleteSupplier, useSuppliers } from '../queries'

export function SuppliersPage() {
  const suppliers = useSuppliers()
  const items = useInventory().data ?? []
  const remove = useDeleteSupplier()
  const [editing, setEditing] = useState<{ open: boolean; supplier?: Supplier }>({ open: false })
  const [deleting, setDeleting] = useState<Supplier | null>(null)

  if (suppliers.error)
    return <ErrorState error={suppliers.error} onRetry={() => void suppliers.refetch()} />

  const columns: Column<Supplier>[] = [
    {
      key: 'name',
      header: 'Supplier',
      cell: (s) => (
        <div>
          <div className="font-medium">{s.name}</div>
          <div className="text-xs text-muted-foreground">{s.categories.join(', ') || '—'}</div>
        </div>
      ),
    },
    {
      key: 'contact',
      header: 'Contact',
      className: 'hidden sm:table-cell',
      cell: (s) => s.contactName || '—',
    },
    {
      key: 'reach',
      header: 'Phone / email',
      className: 'hidden md:table-cell',
      cell: (s) => (
        <div className="space-y-0.5 text-sm">
          {s.phone && (
            <a
              href={`tel:${s.phone}`}
              className="flex items-center gap-1 hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              <Phone className="size-3.5" /> {s.phone}
            </a>
          )}
          {s.email && (
            <a
              href={`mailto:${s.email}`}
              className="flex items-center gap-1 hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              <Mail className="size-3.5" /> {s.email}
            </a>
          )}
          {!s.phone && !s.email && '—'}
        </div>
      ),
    },
    {
      key: 'items',
      header: 'Items',
      cell: (s) => (
        <span className="tabular-nums">{items.filter((i) => i.supplierId === s.id).length}</span>
      ),
    },
    {
      key: 'actions',
      header: '',
      className: 'w-24 text-right',
      cell: (s) => (
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Edit ${s.name}`}
            onClick={(e) => (e.stopPropagation(), setEditing({ open: true, supplier: s }))}
          >
            <Pencil />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Delete ${s.name}`}
            onClick={(e) => (e.stopPropagation(), setDeleting(s))}
          >
            <Trash2 />
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <PageHeader
        title="Suppliers"
        description="Who you order from. Item counts come from Inventory."
        actions={
          <Button onClick={() => setEditing({ open: true })}>
            <Plus /> Add supplier
          </Button>
        }
      />
      <Card>
        <CardContent>
          <DataTable
            columns={columns}
            rows={suppliers.data}
            rowKey={(s) => s.id}
            loading={suppliers.isPending}
            onRowClick={(s) => setEditing({ open: true, supplier: s })}
            empty={
              <EmptyState
                icon={Truck}
                title="No suppliers yet"
                description="Add the companies you order stock from."
              />
            }
          />
        </CardContent>
      </Card>
      <SupplierDialog
        open={editing.open}
        supplier={editing.supplier}
        onOpenChange={(open) => setEditing((s) => ({ ...s, open }))}
      />
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Delete ${deleting?.name ?? ''}?`}
        description="You can only delete a supplier that no inventory item uses."
        confirmLabel="Delete supplier"
        destructive
        pending={remove.isPending}
        onConfirm={() =>
          deleting &&
          remove.mutate(deleting, {
            onSuccess: () => {
              toast.success(`${deleting.name} deleted`)
              setDeleting(null)
            },
            onError: (e) => {
              toast.error(errorMessage(e))
              setDeleting(null)
            },
          })
        }
      />
    </div>
  )
}
