import type { KeyboardEvent, ReactNode } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'

export interface Column<T> {
  key: string
  header: string
  cell: (row: T) => ReactNode
  className?: string
}

interface DataTableProps<T> {
  columns: Column<T>[]
  rows: T[] | undefined
  rowKey: (row: T) => string
  loading?: boolean
  empty?: ReactNode
  onRowClick?: (row: T) => void
}

const isEmpty = (node: ReactNode) =>
  node === null || node === undefined || node === false || node === ''

/**
 * Table from `sm` up; on phones every row becomes a card (first column as the title, the other
 * columns as label / value pairs, the unlabeled column as the row's actions), so nothing needs
 * sideways scrolling.
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  loading,
  empty,
  onRowClick,
}: DataTableProps<T>) {
  if (!loading && rows?.length === 0 && empty) return <>{empty}</>

  const [title, ...rest] = columns
  const actions = rest.filter((c) => c.header === '')
  const fields = rest.filter((c) => c.header !== '')

  return (
    <>
      <div className="hidden overflow-x-auto sm:block">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {columns.map((c) => (
                <TableHead key={c.key} className={c.className}>
                  {c.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading
              ? Array.from({ length: 5 }, (_, i) => (
                  <TableRow key={i}>
                    {columns.map((c) => (
                      <TableCell key={c.key}>
                        <Skeleton className="h-5 w-full max-w-32" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              : rows?.map((row) => (
                  <TableRow
                    key={rowKey(row)}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    className={cn(onRowClick && 'cursor-pointer')}
                  >
                    {columns.map((c) => (
                      <TableCell key={c.key} className={cn('py-3', c.className)}>
                        {c.cell(row)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
          </TableBody>
        </Table>
      </div>

      <ul className="space-y-3 sm:hidden">
        {loading
          ? Array.from({ length: 4 }, (_, i) => (
              <li key={i} className="space-y-3 rounded-xl border p-4">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-full" />
              </li>
            ))
          : title &&
            rows?.map((row) => {
              const click = onRowClick
                ? {
                    role: 'button' as const,
                    tabIndex: 0,
                    onClick: () => onRowClick(row),
                    onKeyDown: (e: KeyboardEvent) => {
                      if (e.key === 'Enter' || e.key === ' ') onRowClick(row)
                    },
                  }
                : {}
              return (
                <li
                  key={rowKey(row)}
                  className={cn(
                    'rounded-xl border bg-card p-4',
                    onRowClick && 'cursor-pointer active:bg-muted/60',
                  )}
                  {...click}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">{title.cell(row)}</div>
                    {actions.length > 0 && (
                      <div
                        className="flex shrink-0 items-center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {actions.map((a) => (
                          <div key={a.key}>{a.cell(row)}</div>
                        ))}
                      </div>
                    )}
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-sm empty:hidden">
                    {fields.map((c) => {
                      const node = c.cell(row)
                      if (isEmpty(node)) return null
                      return (
                        <div key={c.key} className="min-w-0">
                          <dt className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                            {c.header}
                          </dt>
                          <dd className="mt-0.5 [overflow-wrap:anywhere]">{node}</dd>
                        </div>
                      )
                    })}
                  </dl>
                </li>
              )
            })}
      </ul>
    </>
  )
}
