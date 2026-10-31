import type { Shift, User } from '@cityreach/shared'
import { Plus, Search, Users } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { DataTable, type Column } from '@/components/common/DataTable'
import { EmployeeAvatar } from '@/components/common/EmployeeAvatar'
import { EmptyState, ErrorState } from '@/components/common/EmptyState'
import { PageHeader } from '@/components/common/PageHeader'
import { StatusPill } from '@/components/common/StatusPill'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { useShifts } from '@/features/settings/queries'
import { shiftLabel } from '@/lib/format'
import { EmployeeActions } from '../components/EmployeeActions'
import { EmployeeFormDialog } from '../components/EmployeeFormDialog'
import { useEmployees } from '../queries'

export function EmployeesPage() {
  const navigate = useNavigate()
  const employees = useEmployees()
  const shifts = useShifts()
  const [search, setSearch] = useState('')
  const [dialog, setDialog] = useState<{ open: boolean; employee?: User }>({ open: false })

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase()
    return employees.data?.filter(
      (e) => !term || `${e.name} ${e.email} ${e.position}`.toLowerCase().includes(term),
    )
  }, [employees.data, search])

  const edit = useCallback((employee: User) => setDialog({ open: true, employee }), [])
  const columns = useColumns(shifts.data, edit)

  return (
    <div className="space-y-4">
      <PageHeader
        title="Team"
        description={employees.data ? `${employees.data.length} people` : undefined}
        actions={
          <Button onClick={() => setDialog({ open: true })}>
            <Plus /> Add employee
          </Button>
        }
      />
      <Card>
        <CardContent className="space-y-4">
          <div className="relative max-w-sm">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, email or role"
              className="pl-9"
              aria-label="Search employees"
            />
          </div>
          {employees.error ? (
            <ErrorState error={employees.error} onRetry={() => void employees.refetch()} />
          ) : (
            <DataTable
              columns={columns}
              rows={rows}
              rowKey={(e) => e.id}
              loading={employees.isPending}
              onRowClick={(e) => navigate(`/employees/${e.id}`)}
              empty={
                <EmptyState
                  icon={Users}
                  title={search ? 'No one matches that search' : 'No employees yet'}
                  description={search ? undefined : 'Add your first team member to get started.'}
                />
              }
            />
          )}
        </CardContent>
      </Card>
      <EmployeeFormDialog
        open={dialog.open}
        employee={dialog.employee}
        onOpenChange={(open) => setDialog((d) => ({ ...d, open }))}
      />
    </div>
  )
}

function useColumns(shifts: Shift[] | undefined, onEdit: (e: User) => void): Column<User>[] {
  return useMemo(() => {
    const shiftById = new Map(shifts?.map((s) => [s.id, s]))
    return [
      {
        key: 'employee',
        header: 'Employee',
        className: 'whitespace-normal',
        cell: (e) => (
          <div className="flex items-center gap-3">
            <EmployeeAvatar name={e.name} id={e.id} />
            <div className="min-w-0">
              <div className="font-medium">{e.name}</div>
              <div className="text-xs break-all text-muted-foreground">{e.email}</div>
            </div>
          </div>
        ),
      },
      { key: 'role', header: 'Role', className: 'hidden sm:table-cell', cell: (e) => e.position },
      {
        key: 'shift',
        header: 'Shift',
        className: 'hidden md:table-cell',
        cell: (e) => {
          const shift = e.shiftId ? shiftById.get(e.shiftId) : undefined
          return <span className="text-muted-foreground">{shift ? shiftLabel(shift) : '—'}</span>
        },
      },
      { key: 'status', header: 'Status', cell: (e) => <StatusPill status={e.status} /> },
      {
        key: 'performance',
        header: 'Performance',
        className: 'hidden xl:table-cell',
        cell: (e) => (
          <div className="flex w-36 items-center gap-2">
            <Progress value={e.stats.performanceScore} className="h-1.5" />
            <span className="w-8 text-right text-sm tabular-nums">{e.stats.performanceScore}</span>
          </div>
        ),
      },
      {
        key: 'attendance',
        header: 'Attendance',
        className: 'hidden sm:table-cell',
        cell: (e) => <span className="tabular-nums">{e.stats.attendancePct}%</span>,
      },
      {
        key: 'actions',
        header: '',
        className: 'w-10 text-right',
        cell: (e) => <EmployeeActions employee={e} onEdit={onEdit} />,
      },
    ]
  }, [shifts, onEdit])
}
