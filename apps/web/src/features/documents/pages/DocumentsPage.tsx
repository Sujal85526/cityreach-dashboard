import {
  DEFAULT_REMIND_DAYS,
  DOCUMENT_CATEGORIES,
  expiryState,
  toDateKey,
  type StoredDocument,
} from '@cityreach/shared'
import { CalendarClock, CalendarX, FileText, FolderLock, Plus } from 'lucide-react'
import { useState } from 'react'
import { EmptyState, ErrorState } from '@/components/common/EmptyState'
import { PageHeader } from '@/components/common/PageHeader'
import { StatCard } from '@/components/common/StatCard'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useTimeZone } from '@/features/settings/queries'
import { formatBytes } from '../compress'
import { DocumentDialog } from '../components/DocumentDialog'
import { DocumentTable } from '../components/DocumentTable'
import { needsAttention } from '../components/ExpiryBadge'
import { useDocuments } from '../queries'

const ALL = 'all'
/** Category filter value for "expired or expiring soon". */
const ATTENTION = 'attention'

/** Manager-only document store: licenses, contracts, paperwork. */
export function DocumentsPage() {
  const docs = useDocuments()
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<string>(ALL)
  const [uploading, setUploading] = useState(false)
  const today = toDateKey(new Date(), useTimeZone())

  if (docs.error) return <ErrorState error={docs.error} onRetry={() => void docs.refetch()} />

  const q = search.trim().toLowerCase()
  const rows = docs.data?.filter(
    (d) =>
      (category === ALL ||
        d.category === category ||
        (category === ATTENTION && needsAttention(d, today))) &&
      (!q || `${d.name} ${d.note} ${d.fileName} ${d.employeeName ?? ''}`.toLowerCase().includes(q)),
  )
  const stored = (docs.data ?? []).reduce((sum, d) => sum + d.storedSize, 0)
  const stateOf = (d: StoredDocument) =>
    d.expiresOn ? expiryState(d.expiresOn, today, d.remindDaysBefore ?? DEFAULT_REMIND_DAYS) : null
  const expired = (docs.data ?? []).filter((d) => stateOf(d) === 'expired').length
  const expiring = (docs.data ?? []).filter((d) => stateOf(d) === 'expiring_soon').length

  const loading = docs.isPending
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Documents"
          icon={FileText}
          loading={loading}
          value={docs.data?.length ?? 0}
          caption={`${formatBytes(stored)} stored`}
        />
        <StatCard
          label="Expiring soon"
          icon={CalendarClock}
          loading={loading}
          value={expiring}
          caption="Inside their reminder window"
          badge={expiring ? { text: 'Renew', tone: 'warning' } : undefined}
        />
        <StatCard
          label="Expired"
          icon={CalendarX}
          loading={loading}
          value={expired}
          caption="Past their expiry date"
          badge={expired ? { text: 'Action needed', tone: 'danger' } : undefined}
        />
      </div>
      <Card>
        <CardHeader>
          <PageHeader
            title="Documents"
            description="Licences, certificates, contracts and staff papers (passports, right to work, DBS checks). Only managers can see them; you're reminded before anything expires."
            actions={
              <Button onClick={() => setUploading(true)}>
                <Plus /> Upload
              </Button>
            }
          />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search documents"
              aria-label="Search documents"
              className="max-w-xs"
            />
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="w-56" aria-label="Category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All categories</SelectItem>
                <SelectItem value={ATTENTION}>Expired or expiring soon</SelectItem>
                {DOCUMENT_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DocumentTable
            rows={rows}
            loading={docs.isPending}
            today={today}
            empty={
              <EmptyState
                icon={FolderLock}
                title={docs.data?.length ? 'No documents match' : 'No documents yet'}
                action={
                  docs.data?.length ? undefined : (
                    <Button onClick={() => setUploading(true)}>
                      <Plus /> Upload the first one
                    </Button>
                  )
                }
              />
            }
          />
        </CardContent>
      </Card>

      {uploading && <DocumentDialog onClose={() => setUploading(false)} />}
    </div>
  )
}
