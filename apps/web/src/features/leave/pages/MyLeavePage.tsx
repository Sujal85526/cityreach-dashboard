import { toDateKey } from '@dm/shared'
import { Plus, Wallet } from 'lucide-react'
import { useState } from 'react'
import { ErrorState } from '@/components/common/EmptyState'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useCurrentUser } from '@/features/auth/session'
import { useEmployee } from '@/features/employees/queries'
import { useBranch, useShifts } from '@/features/settings/queries'
import { MyPayslips } from '@/features/payslips/components/MyPayslips'
import { BalanceGrid } from '../components/BalanceGrid'
import { MyRequestList } from '../components/MyRequestList'
import { PaySummary } from '../components/PaySummary'
import { RequestLeaveDialog } from '../components/RequestLeaveDialog'
import { balancesFor } from '../model'
import { useMyAttendanceRange, useMyLeave } from '../queries'

/** Employee (phone-first): leave balances, request leave, my requests, my pay this month. */
export function MyLeavePage() {
  const { uid } = useCurrentUser()
  const me = useEmployee(uid)
  const branch = useBranch()
  const shifts = useShifts()
  const leave = useMyLeave()
  const tz = branch.data?.rules.timeZone ?? 'UTC'
  const today = toDateKey(new Date(), tz)
  const month = today.slice(0, 7)
  const records = useMyAttendanceRange(`${month}-01`, `${month}-31`)
  const [asking, setAsking] = useState(false)

  const error = me.error ?? branch.error ?? shifts.error ?? leave.error
  if (error) return <ErrorState error={error} />
  if (!me.data || !branch.data || !shifts.data || !leave.data)
    return <Skeleton className="mx-auto h-72 w-full max-w-2xl rounded-xl" />

  const shift = shifts.data.find((s) => s.id === me.data?.shiftId) ?? null
  const balances = balancesFor(me.data, branch.data, leave.data, Number(today.slice(0, 4)))
  const monthName = new Intl.DateTimeFormat('en-GB', { month: 'long', timeZone: 'UTC' }).format(
    new Date(`${month}-15T12:00:00Z`),
  )

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle className="text-base">My leave · {today.slice(0, 4)}</CardTitle>
          <Button onClick={() => setAsking(true)} className="h-11">
            <Plus /> Request leave
          </Button>
        </CardHeader>
        <CardContent>
          <BalanceGrid balances={balances} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">My requests</CardTitle>
        </CardHeader>
        <CardContent>
          <MyRequestList requests={leave.data} />
        </CardContent>
      </Card>

      {me.data.salary != null && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Wallet className="size-4" /> My pay · {monthName} (so far)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {records.data ? (
              <PaySummary salary={me.data.salary} records={records.data} />
            ) : (
              <Skeleton className="h-28 w-full" />
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">My payslips</CardTitle>
        </CardHeader>
        <CardContent>
          <MyPayslips />
        </CardContent>
      </Card>

      {asking && (
        <RequestLeaveDialog
          open
          onOpenChange={setAsking}
          ctx={{ me: me.data, shift, branch: branch.data }}
          balances={balances}
        />
      )}
    </div>
  )
}
