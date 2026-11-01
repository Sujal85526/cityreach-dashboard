import { ArrowLeft, HandCoins, KeyRound, Mail, Pencil, Phone, UserX } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { useLoginId } from '@/features/auth/queries'
import { EmployeeAvatar } from '@/components/common/EmployeeAvatar'
import { EmptyState, ErrorState } from '@/components/common/EmptyState'
import { StatusPill } from '@/components/common/StatusPill'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { EmployeeDocumentsCard } from '@/features/documents/components/EmployeeDocumentsCard'
import { PayLeaveCard } from '@/features/leave/components/PayLeaveCard'
import { GrowthPanel } from '@/features/people/components/GrowthPanel'
import { SettlementDialog } from '@/features/people/components/SettlementDialog'
import { useBranch, useShifts } from '@/features/settings/queries'
import { formatDate, shiftLabel } from '@/lib/format'
import { EmployeeActions } from '../components/EmployeeActions'
import { EmployeeFormDialog } from '../components/EmployeeFormDialog'
import { NotesPanel } from '../components/NotesPanel'
import { AttendanceHistory, TaskHistory } from '../components/ProfileTables'
import { useEmployee } from '../queries'

export function EmployeeProfilePage() {
  const { uid = '' } = useParams()
  const employee = useEmployee(uid)
  const loginId = useLoginId(uid)
  const shifts = useShifts()
  const branch = useBranch()
  const [editing, setEditing] = useState(false)
  const [settling, setSettling] = useState(false)

  const back = (
    <Button variant="ghost" size="sm" asChild className="-ml-2">
      <Link to="/employees">
        <ArrowLeft /> Employees
      </Link>
    </Button>
  )

  if (employee.error)
    return <ErrorState error={employee.error} onRetry={() => void employee.refetch()} />
  if (employee.isPending) return <Skeleton className="h-48 w-full rounded-xl" />
  const e = employee.data
  if (!e) return <EmptyState icon={UserX} title="Employee not found" action={back} />

  const shift = shifts.data?.find((s) => s.id === e.shiftId)
  const facts = [
    { label: 'Position', value: e.position },
    { label: 'Shift', value: shift ? shiftLabel(shift) : 'No fixed shift' },
    {
      label: 'Access',
      value: { owner: 'Owner', manager: 'Manager', employee: 'Employee' }[e.role],
    },
    { label: 'Joined', value: formatDate(e.hiredAt) },
  ]

  return (
    <div className="space-y-4">
      {back}
      <Card>
        <CardContent className="flex flex-col gap-6 lg:flex-row lg:items-center">
          <div className="flex flex-1 items-center gap-4">
            <EmployeeAvatar name={e.name} id={e.id} size="lg" />
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-semibold">{e.name}</h2>
                <StatusPill status={e.status} />
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Mail className="size-3.5" /> {e.email}
                </span>
                {loginId.data && (
                  <span className="flex items-center gap-1">
                    <KeyRound className="size-3.5" aria-hidden /> ID {loginId.data}
                  </span>
                )}
                {e.phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="size-3.5" /> {e.phone}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:flex sm:gap-6">
            <Stat label="Performance" value={`${e.stats.performanceScore}/100`} />
            <Stat label="Attendance" value={`${e.stats.attendancePct}%`} />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setEditing(true)}>
              <Pencil /> Edit
            </Button>
            <Button variant="outline" onClick={() => setSettling(true)}>
              <HandCoins /> Final settlement
            </Button>
            <EmployeeActions employee={e} onEdit={() => setEditing(true)} />
          </div>
        </CardContent>
        <CardContent className="grid grid-cols-2 gap-4 border-t pt-4 sm:grid-cols-4">
          {facts.map((f) => (
            <div key={f.label}>
              <div className="text-xs text-muted-foreground uppercase">{f.label}</div>
              <div className="text-sm font-medium">{f.value}</div>
            </div>
          ))}
        </CardContent>
      </Card>

      {branch.data && <PayLeaveCard employee={e} branch={branch.data} />}

      <Tabs defaultValue="attendance">
        <TabsList>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="growth">Training & goals</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
        </TabsList>
        <TabsContent value="attendance">
          <Card>
            <CardContent>
              <AttendanceHistory uid={e.id} />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="tasks">
          <Card>
            <CardContent>
              <TaskHistory uid={e.id} />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="growth">
          <GrowthPanel employee={e} />
        </TabsContent>
        <TabsContent value="documents">
          <EmployeeDocumentsCard employee={e} />
        </TabsContent>
        <TabsContent value="notes" className="grid gap-4 lg:grid-cols-3">
          <NotesPanel employee={e} kind="notes" />
          <NotesPanel employee={e} kind="warnings" />
          <NotesPanel employee={e} kind="achievements" />
        </TabsContent>
      </Tabs>

      <EmployeeFormDialog open={editing} onOpenChange={setEditing} employee={e} />
      {settling && branch.data && (
        <SettlementDialog employee={e} branch={branch.data} onClose={() => setSettling(false)} />
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/60 px-4 py-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold tabular-nums">{value}</div>
    </div>
  )
}
