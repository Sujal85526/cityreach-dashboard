import type { EntityRef } from '@cityreach/shared'
import type { QueryConstraint, WriteBatch } from '@/lib/store'
import { Pencil, Plus, Trash2, type LucideIcon } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import type { ZodType } from 'zod'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { DataTable, type Column } from '@/components/common/DataTable'
import { EmptyState, ErrorState } from '@/components/common/EmptyState'
import { PageHeader } from '@/components/common/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useCurrentUser } from '@/features/auth/session'
import { errorMessage } from '@/lib/errors'
import type { StoredRecord } from '../api'
import { useDeleteRecord, useRecords, useSaveRecord } from '../queries'
import { RecordForm, toValues, type FieldDef, type Values } from './RecordForm'

/** Everything a simple record module needs: what to store, how to show it, how to describe it. */
export interface RecordModule<T extends StoredRecord> {
  coll: string
  /** "expense", "incident"… used in buttons and messages. */
  noun: string
  title: string
  description: string
  icon: LucideIcon
  fields: FieldDef[]
  schema: ZodType
  columns: Column<T>[]
  /** Form values for editing a record, when they differ from the stored fields (lists…). */
  toForm?: (r: T) => Values
  /** Starting values for a new record (dates, defaults). */
  defaults: () => Values
  /** Text searched by the search box. */
  searchText: (r: T) => string
  /** Activity line: "added an expense: Rent 1,200". */
  describe: (data: Record<string, unknown>) => string
  /** Fixed id for a new record (one per day…). */
  idFor?: (data: Record<string, unknown>, branchId: string) => string
  /** Adds computed fields before saving (e.g. whether a temperature is in range). */
  prepare?: (data: Record<string, unknown>) => Record<string, unknown>
  /** Extra writes in the same batch (notifications…). */
  extra?: (batch: WriteBatch, entity: EntityRef, data: Record<string, unknown>) => void
  /** Whether the current user may edit / delete (staff logs: managers only). */
  canEdit?: boolean
  /** Whether the current user may add. */
  canAdd?: boolean
  /** Rows to show (after search); defaults to all. */
  filter?: (r: T) => boolean
  /** Show only part of the collection (e.g. one employee's goals); `key` names the subset. */
  query?: { key: string; filters: QueryConstraint[] }
  /** Other caches to refresh after a save (e.g. the dashboard). */
  alsoRefresh?: readonly (readonly unknown[])[]
}

/**
 * List + search + add / edit / delete for one record collection. Each module only declares its
 * fields and columns (features/<module>/config.ts); storage, validation and rules are shared.
 */
export function RecordList<T extends StoredRecord>({
  module: m,
  toolbar,
  header = true,
}: {
  module: RecordModule<T>
  toolbar?: ReactNode
  header?: boolean
}) {
  const { branchId } = useCurrentUser().access
  const list = useRecords<T>(m.coll, m.query ?? {})
  const save = useSaveRecord(m.coll, m.alsoRefresh)
  const remove = useDeleteRecord(m.coll)
  const [editing, setEditing] = useState<T | 'new' | null>(null)
  const [deleting, setDeleting] = useState<T | null>(null)
  const [search, setSearch] = useState('')
  const canEdit = m.canEdit ?? true
  const canAdd = m.canAdd ?? true

  if (list.error) return <ErrorState error={list.error} onRetry={() => void list.refetch()} />
  const q = search.trim().toLowerCase()
  const rows = list.data?.filter(
    (r) => (!m.filter || m.filter(r)) && (!q || m.searchText(r).toLowerCase().includes(q)),
  )

  const actions: Column<T> = {
    key: 'actions',
    header: '',
    className: 'w-0 text-right',
    cell: (r) => (
      <div className="flex justify-end gap-1">
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Edit ${m.noun}`}
          onClick={() => setEditing(r)}
        >
          <Pencil />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Delete ${m.noun}`}
          onClick={() => setDeleting(r)}
        >
          <Trash2 />
        </Button>
      </div>
    ),
  }

  const submit = (input: Record<string, unknown>) => {
    const existing = editing === 'new' ? null : editing
    const data = m.prepare ? m.prepare(input) : input
    save.mutate(
      {
        existing,
        data,
        options: {
          summary: `${existing ? 'updated' : 'added'} ${m.noun}: ${m.describe(data)}`,
          id: existing ? undefined : m.idFor?.(data, branchId),
          extra: m.extra ? (batch, entity) => m.extra?.(batch, entity, data) : undefined,
        },
      },
      {
        onSuccess: () => {
          toast.success(`${m.noun[0]?.toUpperCase()}${m.noun.slice(1)} saved`)
          setEditing(null)
        },
        onError: (e) => toast.error(errorMessage(e)),
      },
    )
  }

  return (
    <div className="space-y-4">
      {header && (
        <PageHeader
          title={m.title}
          description={m.description}
          actions={
            canAdd && (
              <Button onClick={() => setEditing('new')}>
                <Plus /> Add {m.noun}
              </Button>
            )
          }
        />
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search"
          aria-label={`Search ${m.title}`}
          className="max-w-xs"
        />
        {toolbar}
        {!header && canAdd && (
          <Button className="ml-auto" onClick={() => setEditing('new')}>
            <Plus /> Add {m.noun}
          </Button>
        )}
      </div>
      <DataTable
        columns={canEdit ? [...m.columns, actions] : m.columns}
        rows={rows}
        rowKey={(r) => r.id}
        loading={list.isPending}
        empty={
          <EmptyState
            icon={m.icon}
            title={list.data?.length ? 'Nothing matches' : `No ${m.noun}s yet`}
          />
        }
      />
      {editing && (
        <RecordForm
          title={editing === 'new' ? `Add ${m.noun}` : `Edit ${m.noun}`}
          fields={m.fields}
          initial={
            editing === 'new'
              ? m.defaults()
              : (m.toForm?.(editing) ??
                toValues(m.fields, editing as unknown as Record<string, unknown>))
          }
          schema={m.schema}
          pending={save.isPending}
          onSubmit={submit}
          onClose={() => setEditing(null)}
        />
      )}
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Delete this ${m.noun}?`}
        description="It will be removed for good."
        confirmLabel="Delete"
        destructive
        pending={remove.isPending}
        onConfirm={() =>
          deleting &&
          remove.mutate(
            { record: deleting, summary: `deleted ${m.noun}` },
            {
              onSuccess: () => {
                toast.success('Deleted')
                setDeleting(null)
              },
              onError: (e) => toast.error(errorMessage(e)),
            },
          )
        }
      />
    </div>
  )
}
