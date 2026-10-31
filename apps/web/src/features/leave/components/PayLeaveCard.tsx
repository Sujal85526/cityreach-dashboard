import { toDateKey, type Branch, type User } from '@dm/shared'
import { Loader2, Pencil } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { ErrorState } from '@/components/common/EmptyState'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import { Skeleton } from '@/components/ui/skeleton'
import { useAttendanceRange } from '@/features/attendance/queries'
import { errorMessage } from '@/lib/errors'
import { balancesFor, leaveTypesOf } from '../model'
import { useEmployeeLeave, useSavePayAndLeave } from '../queries'
import { BalanceGrid } from './BalanceGrid'
import { PaySummary } from './PaySummary'

/** Employee profile (manager): salary, this month's pay estimate and leave balances. */
export function PayLeaveCard({ employee, branch }: { employee: User; branch: Branch }) {
  const today = toDateKey(new Date(), branch.rules.timeZone)
  const month = today.slice(0, 7)
  const leave = useEmployeeLeave(employee.id)
  const records = useAttendanceRange(`${month}-01`, today)
  const [editing, setEditing] = useState(false)
  const salary = employee.salary ?? null

  if (leave.error) return <ErrorState error={leave.error} onRetry={() => void leave.refetch()} />
  const mine = records.data?.filter((r) => r.employeeId === employee.id)

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle className="text-base">Pay & leave</CardTitle>
        <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
          <Pencil /> Edit
        </Button>
      </CardHeader>
      <CardContent className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-2">
          <div className="text-xs text-muted-foreground uppercase">This month so far</div>
          {salary === null ? (
            <p className="text-sm text-muted-foreground">
              No salary set. Tap Edit to add it and see deductions.
            </p>
          ) : mine ? (
            <PaySummary salary={salary} records={mine} />
          ) : (
            <Skeleton className="h-28 w-full" />
          )}
        </div>
        <div className="space-y-2 lg:col-span-2">
          <div className="text-xs text-muted-foreground uppercase">
            Leave balance · {today.slice(0, 4)}
          </div>
          {leave.data ? (
            <BalanceGrid
              balances={balancesFor(employee, branch, leave.data, Number(today.slice(0, 4)))}
              className="lg:grid-cols-2 xl:grid-cols-3"
            />
          ) : (
            <Skeleton className="h-40 w-full" />
          )}
        </div>
      </CardContent>
      {editing && (
        <PayLeaveDialog employee={employee} branch={branch} onClose={() => setEditing(false)} />
      )}
    </Card>
  )
}

function PayLeaveDialog({
  employee,
  branch,
  onClose,
}: {
  employee: User
  branch: Branch
  onClose: () => void
}) {
  const types = leaveTypesOf(branch).filter((t) => t.daysPerYear !== null)
  const [salary, setSalary] = useState(employee.salary != null ? String(employee.salary) : '')
  const [extra, setExtra] = useState(employee.allowances ? String(employee.allowances) : '')
  // Blank = the type's default from Settings.
  const [allowances, setAllowances] = useState<Record<string, string>>(
    Object.fromEntries(
      types.map((t) => [t.id, employee.leaveAllowances?.[t.id]?.toString() ?? '']),
    ),
  )
  const save = useSavePayAndLeave()

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const leaveAllowances = Object.fromEntries(
      Object.entries(allowances)
        .filter(([, v]) => v.trim() !== '')
        .map(([k, v]) => [k, Number(v)]),
    )
    save.mutate(
      {
        employee,
        input: {
          salary: salary.trim() === '' ? null : Number(salary),
          allowances: extra.trim() === '' ? 0 : Number(extra),
          leaveAllowances,
        },
      },
      {
        onSuccess: () => {
          toast.success('Pay and leave saved')
          onClose()
        },
        onError: (err) => toast.error(errorMessage(err)),
      },
    )
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} noValidate className="space-y-4">
          <DialogHeader>
            <DialogTitle>{employee.name}: pay & leave</DialogTitle>
            <DialogDescription>
              {employee.name} can see their own salary and balances. Leave a type blank to use the
              default from Settings.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="salary">Monthly basic salary (AED)</Label>
            <Input
              id="salary"
              type="number"
              inputMode="decimal"
              min={0}
              value={salary}
              onChange={(e) => setSalary(e.target.value)}
              placeholder="e.g. 3000"
            />
            <p className="text-xs text-muted-foreground">
              Basic salary. A day's pay is salary ÷ 30; unpaid leave and absences are deducted at
              that rate.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="allowances">Monthly allowances (AED)</Label>
            <Input
              id="allowances"
              type="number"
              inputMode="decimal"
              min={0}
              value={extra}
              onChange={(e) => setExtra(e.target.value)}
              placeholder="e.g. 500 (housing, transport)"
            />
          </div>
          <div className="space-y-2">
            <Label>Leave days per year</Label>
            <div className="grid grid-cols-2 gap-3">
              {types.map((t) => (
                <div key={t.id} className="space-y-1">
                  <Label htmlFor={`allow-${t.id}`} className="text-xs font-normal">
                    {t.name}
                  </Label>
                  <Input
                    id={`allow-${t.id}`}
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={366}
                    value={allowances[t.id] ?? ''}
                    placeholder={String(t.daysPerYear)}
                    onChange={(e) => setAllowances({ ...allowances, [t.id]: e.target.value })}
                  />
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending && <Loader2 className="animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
