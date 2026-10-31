import { addDays } from '@cityreach/shared'
import { ChevronLeft, ChevronRight, Loader2, Repeat } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { ErrorState } from '@/components/common/EmptyState'
import { StatusPill } from '@/components/common/StatusPill'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { useCurrentUser } from '@/features/auth/session'
import { useEmployee } from '@/features/employees/queries'
import { useBranch, useShifts } from '@/features/settings/queries'
import { useToday } from '@/hooks/use-today'
import { errorMessage } from '@/lib/errors'
import { formatDay, shiftLabel } from '@/lib/format'
import { cn } from '@/lib/utils'
import { dayHeading, plannedShiftId, weekDays, weekStartOf } from '../model'
import { useCancelSwap, useRequestSwap, useRota, useSwaps } from '../queries'

/**
 * Employee (phone): my shifts this week, who else is on (when the week is published), and asking
 * to swap a shift with a colleague (the manager approves).
 */
export function MyRotaPage() {
  const me = useCurrentUser()
  const today = useToday()
  const [weekStart, setWeekStart] = useState(weekStartOf(today))
  const days = weekDays(weekStart)
  const profile = useEmployee(me.uid)
  const branch = useBranch().data
  const shifts = useShifts()
  const rota = useRota(weekStart, addDays(weekStart, 6))
  const swaps = useSwaps()
  const request = useRequestSwap()
  const cancel = useCancelSwap()
  const [swap, setSwap] = useState<{ date: string; toId: string; reason: string } | null>(null)

  const error = profile.error ?? shifts.error ?? rota.error ?? swaps.error
  if (error) return <ErrorState error={error} />
  if (!branch || !profile.data || !shifts.data || !rota.data || !swaps.data)
    return <Skeleton className="mx-auto h-96 w-full max-w-2xl rounded-xl" />
  const tz = branch.rules.timeZone
  const mine = (d: string) =>
    plannedShiftId(profile.data?.shiftId ?? null, rota.data, me.uid, d, shifts.data, tz)
  const shiftName = (id: string | null) => {
    const s = shifts.data.find((x) => x.id === id)
    return s ? shiftLabel(s) : 'Off'
  }
  const colleagues = (d: string) => rota.data.filter((r) => r.date === d && r.employeeId !== me.uid)
  const myRequests = swaps.data.filter((s) => s.fromId === me.uid || s.toId === me.uid)

  const send = () => {
    if (!swap) return
    const to = colleagues(swap.date).find((c) => c.employeeId === swap.toId)
    if (!to) return toast.error('Choose a colleague.')
    request.mutate(
      {
        input: {
          date: swap.date,
          toId: to.employeeId,
          toName: to.employeeName,
          reason: swap.reason,
        },
        branch,
      },
      {
        onSuccess: () => {
          toast.success('Swap requested. Your manager will decide.')
          setSwap(null)
        },
        onError: (e) => toast.error(errorMessage(e)),
      },
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle className="text-base">Week of {formatDay(weekStart)}</CardTitle>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="icon"
              aria-label="Previous week"
              onClick={() => setWeekStart(addDays(weekStart, -7))}
            >
              <ChevronLeft />
            </Button>
            <Button
              variant="outline"
              size="icon"
              aria-label="Next week"
              onClick={() => setWeekStart(addDays(weekStart, 7))}
            >
              <ChevronRight />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <ul className="divide-y">
            {days.map((d) => {
              const shift = mine(d)
              const team = colleagues(d).filter((c) => c.shiftId)
              return (
                <li
                  key={d}
                  className={cn('space-y-1.5 py-3', d === today && 'rounded-lg bg-primary/5 px-2')}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-medium">{dayHeading(d)}</div>
                      <div className={cn('text-sm', shift ? '' : 'text-muted-foreground')}>
                        {shiftName(shift)}
                      </div>
                    </div>
                    {shift && d >= today && colleagues(d).length > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-9"
                        onClick={() => setSwap({ date: d, toId: '', reason: '' })}
                      >
                        <Repeat /> Swap
                      </Button>
                    )}
                  </div>
                  {team.length > 0 && (
                    <div className="text-xs text-muted-foreground">
                      Also on:{' '}
                      {team
                        .map(
                          (c) =>
                            `${c.employeeName} (${shifts.data.find((s) => s.id === c.shiftId)?.name ?? ''})`,
                        )
                        .join(', ')}
                    </div>
                  )}
                  {swap?.date === d && (
                    <div className="space-y-2 rounded-lg border p-3">
                      <Label htmlFor="swap-to">Swap with</Label>
                      <select
                        id="swap-to"
                        value={swap.toId}
                        onChange={(e) => setSwap({ ...swap, toId: e.target.value })}
                        className="h-11 w-full rounded-md border bg-transparent px-3 text-sm"
                      >
                        <option value="">Choose a colleague…</option>
                        {colleagues(d).map((c) => (
                          <option key={c.employeeId} value={c.employeeId}>
                            {c.employeeName} ({shiftName(c.shiftId)})
                          </option>
                        ))}
                      </select>
                      <Textarea
                        aria-label="Reason"
                        placeholder="Reason (optional)"
                        maxLength={200}
                        value={swap.reason}
                        onChange={(e) => setSwap({ ...swap, reason: e.target.value })}
                      />
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setSwap(null)}>
                          Cancel
                        </Button>
                        <Button onClick={send} disabled={request.isPending || !swap.toId}>
                          {request.isPending && <Loader2 className="animate-spin" />} Send request
                        </Button>
                      </div>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
          {rota.data.length === 0 && (
            <p className="mt-2 text-xs text-muted-foreground">
              This week isn't published yet, so you see your usual shift. Swaps open once it is.
            </p>
          )}
        </CardContent>
      </Card>

      {myRequests.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Swap requests</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {myRequests.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-3 py-1.5">
                <span>
                  {formatDay(s.date)}:{' '}
                  {s.fromId === me.uid
                    ? `with ${s.toName}`
                    : `${s.fromName} asked to swap with you`}
                </span>
                <span className="flex items-center gap-2">
                  <StatusPill status={s.status} />
                  {s.status === 'pending' && s.fromId === me.uid && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => cancel.mutate(s)}
                      disabled={cancel.isPending}
                    >
                      Withdraw
                    </Button>
                  )}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
