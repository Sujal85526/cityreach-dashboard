import {
  DEFAULT_REMIND_DAYS,
  DOCUMENT_CATEGORIES,
  EMPLOYEE_DOCUMENT_CATEGORIES,
  REMIND_DAYS_OPTIONS,
  type DocumentCategory,
  type DocumentDetails,
  type StoredDocument,
  type User,
} from '@cityreach/shared'
import { FileUp, Loader2 } from 'lucide-react'
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
import { useEmployees } from '@/features/employees/queries'
import { errorMessage } from '@/lib/errors'
import { formatBytes } from '../compress'
import { useUpdateDocument, useUploadDocument } from '../queries'

const baseName = (file: string) => file.replace(/\.[^.]+$/, '').slice(0, 120)
/** Select value for "not linked to an employee". */
const SHOP = 'shop'

/**
 * Upload a new document (no `editing`) or change an existing one. Staff papers (passport, right to work…)
 * are linked to an employee; from a profile, `forEmployee` fills that in.
 */
export function DocumentDialog({
  editing,
  forEmployee,
  onClose,
}: {
  editing?: StoredDocument
  forEmployee?: Pick<User, 'id' | 'name'>
  onClose: () => void
}) {
  const employees = useEmployees()
  const [file, setFile] = useState<File | null>(null)
  const [details, setDetails] = useState<DocumentDetails>({
    name: editing?.name ?? '',
    category: editing?.category ?? (forEmployee ? 'Passport' : 'Licence'),
    employeeId: editing?.employeeId ?? forEmployee?.id ?? null,
    note: editing?.note ?? '',
    expiresOn: editing?.expiresOn ?? null,
    remindDaysBefore: editing?.remindDaysBefore ?? DEFAULT_REMIND_DAYS,
  })
  const upload = useUploadDocument()
  const update = useUpdateDocument()
  const pending = upload.isPending || update.isPending
  const set = (patch: Partial<DocumentDetails>) => setDetails((d) => ({ ...d, ...patch }))

  const pick = (f: File | undefined) => {
    if (!f) return
    setFile(f)
    if (!details.name) set({ name: baseName(f.name) })
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const employeeName = details.employeeId
      ? (employees.data?.find((e) => e.id === details.employeeId)?.name ??
        (editing?.employeeId === details.employeeId ? editing.employeeName : null) ??
        forEmployee?.name ??
        null)
      : null
    const input = { ...details, name: details.name.trim(), note: details.note.trim(), employeeName }
    if (!input.name) return toast.error('Give the document a name.')
    if (editing)
      return update.mutate(
        { d: editing, input },
        {
          onSuccess: () => {
            toast.success('Document updated')
            onClose()
          },
          onError: (err) => toast.error(errorMessage(err)),
        },
      )
    if (!file) return toast.error('Choose a file to upload.')
    upload.mutate(
      { ...input, file },
      {
        onSuccess: ({ originalSize, storedSize }) => {
          const saved = Math.round((1 - storedSize / originalSize) * 100)
          toast.success(
            saved >= 5
              ? `Saved: ${formatBytes(originalSize)} → ${formatBytes(storedSize)} (${saved}% smaller)`
              : `Saved (${formatBytes(storedSize)})`,
          )
          onClose()
        },
        onError: (err) => toast.error(errorMessage(err)),
      },
    )
  }

  return (
    <Dialog open onOpenChange={(o) => !o && !pending && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} noValidate className="space-y-4">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit document' : 'Upload a document'}</DialogTitle>
            <DialogDescription>
              {forEmployee ? `${forEmployee.name}'s papers. ` : ''}Only managers can see documents.
              Files are compressed and kept in this browser; up to 1 MB each after compression.
            </DialogDescription>
          </DialogHeader>
          {!editing && (
            <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed p-5 text-center text-sm hover:bg-muted/50">
              <FileUp className="size-6 text-muted-foreground" aria-hidden />
              {file ? (
                <span>
                  <span className="font-medium">{file.name}</span>
                  <span className="text-muted-foreground"> · {formatBytes(file.size)}</span>
                </span>
              ) : (
                <span className="text-muted-foreground">Choose a PDF, photo or other file</span>
              )}
              <input
                type="file"
                className="sr-only"
                onChange={(e) => pick(e.target.files?.[0])}
                aria-label="File"
              />
            </label>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="doc-name">Name</Label>
            <Input
              id="doc-name"
              value={details.name}
              maxLength={120}
              onChange={(e) => set({ name: e.target.value })}
              placeholder="e.g. Premises licence 2026"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="doc-category">Category</Label>
            <Select
              value={details.category}
              onValueChange={(category) => set({ category: category as DocumentCategory })}
            >
              <SelectTrigger id="doc-category" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DOCUMENT_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {(details.employeeId || EMPLOYEE_DOCUMENT_CATEGORIES.includes(details.category)) && (
            <div className="space-y-1.5">
              <Label htmlFor="doc-employee">Employee</Label>
              <Select
                value={details.employeeId ?? SHOP}
                onValueChange={(v) => set({ employeeId: v === SHOP ? null : v })}
              >
                <SelectTrigger id="doc-employee" className="w-full">
                  <SelectValue placeholder="Choose an employee" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SHOP}>Not for an employee (shop document)</SelectItem>
                  {forEmployee && !employees.data?.some((e) => e.id === forEmployee.id) && (
                    <SelectItem value={forEmployee.id}>{forEmployee.name}</SelectItem>
                  )}
                  {(employees.data ?? [])
                    .filter((e) => e.status !== 'inactive' || e.id === details.employeeId)
                    .map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="doc-expires">Expires on (optional)</Label>
              <Input
                id="doc-expires"
                type="date"
                value={details.expiresOn ?? ''}
                onChange={(e) => set({ expiresOn: e.target.value || null })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="doc-remind">Remind me</Label>
              <Select
                value={String(details.remindDaysBefore)}
                onValueChange={(v) => set({ remindDaysBefore: Number(v) })}
                disabled={!details.expiresOn}
              >
                <SelectTrigger id="doc-remind" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REMIND_DAYS_OPTIONS.map((d) => (
                    <SelectItem key={d} value={String(d)}>
                      {d} days before
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="doc-note">Note (optional)</Label>
            <Textarea
              id="doc-note"
              value={details.note}
              maxLength={300}
              onChange={(e) => set({ note: e.target.value })}
              placeholder="e.g. Licence no. 123456, renew with the council"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="animate-spin" />}
              {editing ? 'Save' : upload.isPending ? 'Compressing and saving…' : 'Upload'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
