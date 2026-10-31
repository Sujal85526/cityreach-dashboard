import type { PurchaseOrder } from '@cityreach/shared'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CreditCard, PackageCheck, Plus, ShoppingCart, Truck } from 'lucide-react'
import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { DataTable, type Column } from '@/components/common/DataTable'
import { EmptyState, ErrorState } from '@/components/common/EmptyState'
import { PageHeader } from '@/components/common/PageHeader'
import { StatCard } from '@/components/common/StatCard'
import { TonePill } from '@/components/common/StatusPill'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useCurrentUser } from '@/features/auth/session'
import { receiveOrder } from '@/features/inventory/api'
import { useInventory } from '@/features/inventory/queries'
import { useRecords, useSaveRecord, useDeleteRecord } from '@/features/records/queries'
import { useBranch } from '@/features/settings/queries'
import { useSuppliers } from '@/features/suppliers/queries'
import { useToday } from '@/hooks/use-today'
import { errorMessage } from '@/lib/errors'
import { formatDay, formatMoney } from '@/lib/format'
import { qk, refreshLists } from '@/lib/query-keys'
import { OrderDialog, type OrderDraft, type OrderPrefill } from '../components/OrderDialog'

const STATUS = {
  draft: ['Draft', 'neutral'],
  ordered: ['Ordered', 'info'],
  received: ['Received', 'success'],
  cancelled: ['Cancelled', 'neutral'],
} as const

/**
 * Manager: purchase orders from draft to received (stock goes up automatically), with the
 * supplier's invoice and payment due date. Unpaid invoices due soon appear on the dashboard.
 */
export function PurchasingPage() {
  const today = useToday()
  const user = useCurrentUser()
  const branch = useBranch().data
  const orders = useRecords<PurchaseOrder>('purchaseOrders')
  const suppliers = useSuppliers()
  const items = useInventory()
  const save = useSaveRecord('purchaseOrders')
  const remove = useDeleteRecord('purchaseOrders')
  const queryClient = useQueryClient()
  const receive = useMutation({
    mutationFn: (o: PurchaseOrder) => {
      if (!branch) throw new Error('Still loading the shop settings.')
      return receiveOrder(o, today, branch, user)
    },
    onSuccess: () => refreshLists(queryClient, qk.recordsOf('purchaseOrders'), qk.inventory),
  })
  // Reorder suggestions open this page with a new order filled in.
  const location = useLocation()
  const navigate = useNavigate()
  const [prefill, setPrefill] = useState(
    (location.state as { reorder?: OrderPrefill } | null)?.reorder,
  )
  const [editing, setEditing] = useState<PurchaseOrder | 'new' | null>(prefill ? 'new' : null)
  const closeDialog = () => {
    setEditing(null)
    if (!prefill) return
    setPrefill(undefined)
    void navigate('.', { replace: true, state: null }) // a reload must not reopen it
  }

  const error = orders.error ?? suppliers.error ?? items.error
  if (error) return <ErrorState error={error} onRetry={() => void orders.refetch()} />
  const all = orders.data ?? []
  const open = all.filter((o) => o.status === 'ordered')
  const unpaid = all.filter((o) => o.status === 'received' && !o.paidOn)
  const unpaidTotal = unpaid.reduce((s, o) => s + o.total, 0)
  const overdue = unpaid.filter((o) => o.paymentDueOn && o.paymentDueOn < today).length

  const update = (
    o: PurchaseOrder,
    patch: Record<string, unknown>,
    summary: string,
    done: string,
  ) =>
    save.mutate(
      { existing: o, data: patch, options: { summary } },
      { onSuccess: () => toast.success(done), onError: (e) => toast.error(errorMessage(e)) },
    )

  const saveDraft = (d: OrderDraft) => {
    const existing = editing === 'new' ? null : editing
    save.mutate(
      {
        existing,
        data: existing
          ? { ...d }
          : {
              ...d,
              number: `PO-${today.replaceAll('-', '').slice(2)}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`,
              status: 'draft',
              orderedOn: null,
              receivedOn: null,
              paidOn: null,
            },
        options: {
          summary: `${existing ? 'updated' : 'created'} a purchase order for ${d.supplierName} (${formatMoney(d.total)})`,
        },
      },
      {
        onSuccess: () => {
          toast.success('Purchase order saved')
          closeDialog()
        },
        onError: (e) => toast.error(errorMessage(e)),
      },
    )
  }

  const columns: Column<PurchaseOrder>[] = [
    {
      key: 'order',
      header: 'Order',
      className: 'whitespace-normal',
      cell: (o) => (
        <div>
          <div className="font-medium">{o.supplierName}</div>
          <div className="text-xs text-muted-foreground">
            {o.number} · {o.lines.length} item{o.lines.length === 1 ? '' : 's'}
          </div>
        </div>
      ),
    },
    { key: 'total', header: 'Total', cell: (o) => formatMoney(o.total) },
    {
      key: 'status',
      header: 'Status',
      cell: (o) => <TonePill tone={STATUS[o.status][1]}>{STATUS[o.status][0]}</TonePill>,
    },
    {
      key: 'delivery',
      header: 'Delivery',
      className: 'hidden md:table-cell',
      cell: (o) =>
        o.receivedOn
          ? `Received ${formatDay(o.receivedOn)}`
          : o.expectedOn
            ? `Expected ${formatDay(o.expectedOn)}`
            : '—',
    },
    {
      key: 'payment',
      header: 'Payment',
      className: 'hidden sm:table-cell',
      cell: (o) =>
        o.status !== 'received' ? (
          '—'
        ) : o.paidOn ? (
          <TonePill tone="success">Paid {formatDay(o.paidOn)}</TonePill>
        ) : (
          <TonePill tone={o.paymentDueOn && o.paymentDueOn < today ? 'danger' : 'warning'}>
            {o.paymentDueOn ? `Due ${formatDay(o.paymentDueOn)}` : 'Unpaid'}
          </TonePill>
        ),
    },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      cell: (o) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" disabled={save.isPending || receive.isPending}>
              Actions
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {o.status === 'draft' && (
              <>
                <DropdownMenuItem onSelect={() => setEditing(o)}>Edit</DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() =>
                    update(
                      o,
                      { status: 'ordered', orderedOn: today },
                      `sent ${o.number} to ${o.supplierName}`,
                      'Marked as ordered',
                    )
                  }
                >
                  Mark as ordered
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() =>
                    remove.mutate({ record: o, summary: `deleted draft ${o.number}` })
                  }
                >
                  Delete draft
                </DropdownMenuItem>
              </>
            )}
            {o.status === 'ordered' && (
              <>
                <DropdownMenuItem
                  onSelect={() =>
                    receive.mutate(o, {
                      onSuccess: () => toast.success(`${o.number} received: stock updated`),
                      onError: (e) => toast.error(errorMessage(e)),
                    })
                  }
                >
                  Receive delivery (add to stock)
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() =>
                    update(o, { status: 'cancelled' }, `cancelled ${o.number}`, 'Order cancelled')
                  }
                >
                  Cancel order
                </DropdownMenuItem>
              </>
            )}
            {o.status === 'received' && !o.paidOn && (
              <DropdownMenuItem
                onSelect={() =>
                  update(
                    o,
                    { paidOn: today },
                    `paid ${o.supplierName} for ${o.number}`,
                    'Marked as paid',
                  )
                }
              >
                Mark invoice paid
              </DropdownMenuItem>
            )}
            {(o.status === 'received' && o.paidOn) || o.status === 'cancelled' ? (
              <DropdownMenuItem disabled>Nothing left to do</DropdownMenuItem>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ]

  const loading = orders.isPending
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 [&>*:last-child:nth-child(odd)]:col-span-2 sm:[&>*:last-child:nth-child(odd)]:col-span-1">
        <StatCard
          label="On order"
          icon={Truck}
          loading={loading}
          value={open.length}
          caption="Waiting for delivery"
        />
        <StatCard
          label="Unpaid invoices"
          icon={CreditCard}
          loading={loading}
          value={formatMoney(unpaidTotal)}
          caption={`${unpaid.length} invoices`}
          badge={overdue ? { text: `${overdue} overdue`, tone: 'danger' } : undefined}
        />
        <StatCard
          label="Orders"
          icon={PackageCheck}
          loading={loading}
          value={all.length}
          caption="All time"
        />
      </div>
      <Card>
        <CardHeader>
          <PageHeader
            title="Purchase orders"
            description="Draft → ordered → received (stock goes up) → paid."
            actions={
              <Button onClick={() => setEditing('new')} disabled={!suppliers.data?.length}>
                <Plus /> New order
              </Button>
            }
          />
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            rows={orders.data}
            rowKey={(o) => o.id}
            loading={loading}
            empty={
              <EmptyState
                icon={ShoppingCart}
                title="No purchase orders yet"
                description={
                  suppliers.data?.length ? undefined : 'Add a supplier first (Suppliers page).'
                }
              />
            }
          />
        </CardContent>
      </Card>
      {editing && suppliers.data && items.data && (
        <OrderDialog
          existing={editing === 'new' ? null : editing}
          prefill={prefill}
          suppliers={suppliers.data}
          items={items.data}
          pending={save.isPending}
          onSave={saveDraft}
          onClose={closeDialog}
        />
      )}
    </div>
  )
}
