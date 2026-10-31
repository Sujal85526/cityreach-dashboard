import type { StoredDocument } from '@cityreach/shared'
import { Download, ExternalLink, Loader2, Pencil, Trash2 } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { DataTable, type Column } from '@/components/common/DataTable'
import { TonePill } from '@/components/common/StatusPill'
import { Button } from '@/components/ui/button'
import { errorMessage } from '@/lib/errors'
import { formatDate } from '@/lib/format'
import { loadDocumentFile } from '../api'
import { formatBytes } from '../compress'
import { useDeleteDocument } from '../queries'
import { DocumentDialog } from './DocumentDialog'
import { ExpiryBadge } from './ExpiryBadge'

/**
 * Documents with open / download / edit / delete. Used on the Documents page and on an employee's
 * profile (`employeeColumn` off there, since every row is that person's).
 */
export function DocumentTable({
  rows,
  loading,
  empty,
  today,
  employeeColumn = true,
}: {
  rows: StoredDocument[] | undefined
  loading: boolean
  empty: ReactNode
  today: string
  employeeColumn?: boolean
}) {
  const remove = useDeleteDocument()
  const [editing, setEditing] = useState<StoredDocument | null>(null)
  const [deleting, setDeleting] = useState<StoredDocument | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  /**
   * Open in a new tab. The tab is opened before the download starts, because browsers
   * (Safari especially) block tabs opened after waiting; if it is blocked, the file downloads.
   */
  const open = async (d: StoredDocument, download: boolean) => {
    const tab = download ? null : window.open('', '_blank')
    setBusy(d.id)
    try {
      const url = URL.createObjectURL(await loadDocumentFile(d))
      if (tab) tab.location.href = url
      else {
        const a = document.createElement('a')
        a.href = url
        a.download = d.fileName
        a.click()
      }
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (e) {
      tab?.close()
      toast.error(errorMessage(e))
    } finally {
      setBusy(null)
    }
  }

  const columns: Column<StoredDocument>[] = [
    {
      key: 'name',
      header: 'Document',
      className: 'whitespace-normal',
      cell: (d) => (
        <div className="min-w-0">
          <div className="font-medium">{d.name}</div>
          <div className="truncate text-xs text-muted-foreground">
            {employeeColumn && d.employeeName ? `${d.employeeName} · ` : ''}
            {d.note || d.fileName}
          </div>
        </div>
      ),
    },
    {
      key: 'category',
      header: 'Category',
      className: 'hidden sm:table-cell',
      cell: (d) => <TonePill tone="neutral">{d.category}</TonePill>,
    },
    { key: 'expires', header: 'Expires', cell: (d) => <ExpiryBadge doc={d} today={today} /> },
    {
      key: 'size',
      header: 'Size',
      className: 'hidden md:table-cell',
      cell: (d) =>
        d.storedSize < d.originalSize * 0.95 ? (
          <span title={`Original ${formatBytes(d.originalSize)}`}>
            {formatBytes(d.storedSize)}
            <span className="text-xs text-muted-foreground">
              {' '}
              (was {formatBytes(d.originalSize)})
            </span>
          </span>
        ) : (
          formatBytes(d.storedSize)
        ),
    },
    {
      key: 'added',
      header: 'Added',
      className: 'hidden lg:table-cell',
      cell: (d) => (
        <div>
          <div>{formatDate(d.createdAt)}</div>
          <div className="text-xs text-muted-foreground">{d.uploadedByName}</div>
        </div>
      ),
    },
    {
      key: 'actions',
      header: '',
      className: 'w-0 text-right',
      cell: (d) => (
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Open ${d.name}`}
            disabled={busy === d.id}
            onClick={() => void open(d, false)}
          >
            {busy === d.id ? <Loader2 className="animate-spin" /> : <ExternalLink />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Download ${d.name}`}
            disabled={busy === d.id}
            onClick={() => void open(d, true)}
          >
            <Download />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Edit ${d.name}`}
            onClick={() => setEditing(d)}
          >
            <Pencil />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Delete ${d.name}`}
            onClick={() => setDeleting(d)}
          >
            <Trash2 />
          </Button>
        </div>
      ),
    },
  ]

  return (
    <>
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(d) => d.id}
        loading={loading}
        empty={empty}
      />
      {editing && <DocumentDialog editing={editing} onClose={() => setEditing(null)} />}
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete this document?"
        description={`"${deleting?.name ?? ''}" will be removed for good.`}
        confirmLabel="Delete"
        destructive
        pending={remove.isPending}
        onConfirm={() =>
          deleting &&
          remove.mutate(deleting, {
            onSuccess: () => {
              toast.success('Document deleted')
              setDeleting(null)
            },
            onError: (e) => toast.error(errorMessage(e)),
          })
        }
      />
    </>
  )
}
