import { stockStatus, type InventoryItem, type StockStatus } from '@cityreach/shared'
import {
  AlertTriangle,
  Boxes,
  MoreHorizontal,
  Package,
  PackageCheck,
  Plus,
  Search,
  TriangleAlert,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { DataTable, type Column } from '@/components/common/DataTable'
import { EmptyState, ErrorState } from '@/components/common/EmptyState'
import { PageHeader } from '@/components/common/PageHeader'
import { StatCard } from '@/components/common/StatCard'
import { StatusPill } from '@/components/common/StatusPill'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useBranch } from '@/features/settings/queries'
import { errorMessage } from '@/lib/errors'
import { formatAgo, formatQty } from '@/lib/format'
import { AdjustDialog } from '../components/AdjustDialog'
import { HistoryDialog } from '../components/HistoryDialog'
import { ItemDialog } from '../components/ItemDialog'
import { useDeleteItem, useInventory } from '../queries'

const ALL = 'all'
type Row = InventoryItem & { current: StockStatus }

export function InventoryPage() {
  const inventory = useInventory()
  const branch = useBranch().data
  const remove = useDeleteItem()
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState(ALL)
  const [editing, setEditing] = useState<{ open: boolean; item?: InventoryItem }>({ open: false })
  const [adjusting, setAdjusting] = useState<InventoryItem | null>(null)
  const [history, setHistory] = useState<InventoryItem | null>(null)
  const [deleting, setDeleting] = useState<InventoryItem | null>(null)

  // Status is recalculated with today's critical ratio, so a Settings change shows immediately.
  const rows: Row[] = useMemo(() => {
    const ratio = branch?.rules.inventory.criticalRatio ?? 0.5
    return (inventory.data ?? []).map((i) => ({
      ...i,
      current: stockStatus(i.quantity, i.minQuantity, ratio),
    }))
  }, [inventory.data, branch])
  const categories = useMemo(() => [...new Set(rows.map((r) => r.category))].sort(), [rows])
  const visible = rows.filter(
    (r) =>
      (category === ALL || r.category === category) &&
      (!search.trim() ||
        `${r.name} ${r.supplierName ?? ''}`.toLowerCase().includes(search.trim().toLowerCase())),
  )
  const count = (s: StockStatus) => rows.filter((r) => r.current === s).length
  const alerts = rows
    .filter((r) => r.current !== 'in_stock')
    .sort((a, b) =>
      a.current === b.current
        ? a.quantity / (a.minQuantity || 1) - b.quantity / (b.minQuantity || 1)
        : a.current === 'critical'
          ? -1
          : 1,
    )

  if (inventory.error)
    return <ErrorState error={inventory.error} onRetry={() => void inventory.refetch()} />
  const loading = inventory.isPending || !branch

  const columns: Column<Row>[] = [
    {
      key: 'item',
      header: 'Item',
      className: 'whitespace-normal',
      cell: (r) => <span className="font-medium">{r.name}</span>,
    },
    {
      key: 'category',
      header: 'Category',
      className: 'hidden md:table-cell',
      cell: (r) => r.category,
    },
    {
      key: 'qty',
      header: 'Quantity',
      cell: (r) => <span className="tabular-nums">{formatQty(r.quantity, r.unit)}</span>,
    },
    {
      key: 'min',
      header: 'Minimum',
      className: 'hidden sm:table-cell',
      cell: (r) => (
        <span className="tabular-nums text-muted-foreground">
          {formatQty(r.minQuantity, r.unit)}
        </span>
      ),
    },
    {
      key: 'supplier',
      header: 'Supplier',
      className: 'hidden lg:table-cell',
      cell: (r) => r.supplierName ?? '—',
    },
    {
      key: 'updated',
      header: 'Updated',
      className: 'hidden lg:table-cell',
      cell: (r) => <span className="text-muted-foreground">{formatAgo(r.updatedAt)}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      cell: (r) => <StatusPill status={r.current} kind="stock" />,
    },
    {
      key: 'actions',
      header: '',
      className: 'w-10 text-right',
      cell: (r) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="icon" aria-label={`Actions for ${r.name}`}>
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuItem onSelect={() => setAdjusting(r)}>Adjust stock</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setHistory(r)}>Stock history</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setEditing({ open: true, item: r })}>
              Edit details
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-danger focus:text-danger"
              onSelect={() => setDeleting(r)}
            >
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total items"
          icon={Boxes}
          loading={loading}
          value={rows.length}
          caption={`${categories.length} categories`}
        />
        <StatCard
          label="In stock"
          icon={PackageCheck}
          loading={loading}
          value={count('in_stock')}
          caption="At or above minimum"
        />
        <StatCard
          label="Low stock"
          icon={AlertTriangle}
          loading={loading}
          value={count('low')}
          caption="Below minimum"
          badge={count('low') ? { text: 'Reorder soon', tone: 'warning' } : undefined}
        />
        <StatCard
          label="Critical"
          icon={TriangleAlert}
          loading={loading}
          value={count('critical')}
          caption={`At or below ${Math.round((branch?.rules.inventory.criticalRatio ?? 0.5) * 100)}% of minimum`}
          badge={count('critical') ? { text: 'Reorder today', tone: 'danger' } : undefined}
        />
      </div>

      {alerts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Items below minimum threshold</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {alerts.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setAdjusting(r)}
                className="space-y-2 rounded-lg border p-3 text-left transition-colors hover:bg-muted/50"
              >
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  {r.category}
                  <StatusPill status={r.current} kind="stock" />
                </div>
                <div className="font-medium">{r.name}</div>
                <div className="flex items-baseline gap-2">
                  <span className="text-xl font-semibold tabular-nums">
                    {formatQty(r.quantity, r.unit)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Min. {formatQty(r.minQuantity, r.unit)}
                  </span>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{r.supplierName ?? 'No supplier'}</span>
                  <span>Updated {formatAgo(r.updatedAt)}</span>
                </div>
              </button>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <PageHeader
            title="All items"
            actions={
              <Button onClick={() => setEditing({ open: true })}>
                <Plus /> Add item
              </Button>
            }
          />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <div className="relative w-full sm:w-64">
              <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search items or suppliers"
                className="pl-9"
                aria-label="Search inventory"
              />
            </div>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="w-44" aria-label="Filter by category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All categories</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DataTable
            columns={columns}
            rows={visible}
            rowKey={(r) => r.id}
            loading={loading}
            onRowClick={(r) => setAdjusting(r)}
            empty={
              <EmptyState
                icon={Package}
                title={search || category !== ALL ? 'No items match' : 'No items yet'}
                description="Add the stock you want to track."
              />
            }
          />
        </CardContent>
      </Card>

      {branch && (
        <>
          <ItemDialog
            open={editing.open}
            item={editing.item}
            branch={branch}
            categories={categories}
            onOpenChange={(open) => setEditing((s) => ({ ...s, open }))}
          />
          <AdjustDialog item={adjusting} branch={branch} onClose={() => setAdjusting(null)} />
          <HistoryDialog
            item={history}
            timeZone={branch.rules.timeZone}
            onClose={() => setHistory(null)}
          />
        </>
      )}
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Delete ${deleting?.name ?? ''}?`}
        description="It stops being tracked. Its stock history stays in the log."
        confirmLabel="Delete item"
        destructive
        pending={remove.isPending}
        onConfirm={() =>
          deleting &&
          remove.mutate(deleting, {
            onSuccess: () => {
              toast.success(`${deleting.name} deleted`)
              setDeleting(null)
            },
            onError: (e) => toast.error(errorMessage(e)),
          })
        }
      />
    </div>
  )
}
