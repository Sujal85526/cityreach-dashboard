import { toDateKey, type User } from '@cityreach/shared'
import { FolderLock, Plus } from 'lucide-react'
import { useState } from 'react'
import { EmptyState, ErrorState } from '@/components/common/EmptyState'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useTimeZone } from '@/features/settings/queries'
import { useDocuments } from '../queries'
import { DocumentDialog } from './DocumentDialog'
import { DocumentTable } from './DocumentTable'

/** Employee profile (manager): their passport, right to work, DBS check, contract… with expiry status. */
export function EmployeeDocumentsCard({ employee }: { employee: Pick<User, 'id' | 'name'> }) {
  const docs = useDocuments()
  const today = toDateKey(new Date(), useTimeZone())
  const [uploading, setUploading] = useState(false)

  if (docs.error) return <ErrorState error={docs.error} onRetry={() => void docs.refetch()} />
  const mine = docs.data?.filter((d) => d.employeeId === employee.id)

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle className="text-base">Documents</CardTitle>
        <Button variant="outline" size="sm" onClick={() => setUploading(true)}>
          <Plus /> Add document
        </Button>
      </CardHeader>
      <CardContent>
        <DocumentTable
          rows={mine}
          loading={docs.isPending}
          today={today}
          employeeColumn={false}
          empty={
            <EmptyState
              icon={FolderLock}
              title="No documents yet"
              description="Add their passport, right to work, DBS check or contract to be reminded before they expire."
            />
          }
        />
      </CardContent>
      {uploading && <DocumentDialog forEmployee={employee} onClose={() => setUploading(false)} />}
    </Card>
  )
}
