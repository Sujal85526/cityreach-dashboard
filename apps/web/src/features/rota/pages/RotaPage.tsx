import { addDays, type SwapRequest } from '@dm/shared'
import { CalendarCheck2, ChevronLeft, ChevronRight, Repeat } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { EmptyState, ErrorState } from '@/components/common/EmptyState'
import { PageHeader } from '@/components/common/PageHeader'
import { StatusPill } from '@/components/common/StatusPill'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useEmployees } from '@/features/employees/queries'
import { useBranch, useShifts } from '@/features/settings/queries'
import { useToday } from '@/hooks/use-today'
import { errorMessage } from '@/lib/errors'
import { formatDay, formatTimeOfDay } from '@/lib/format'
import { cn } from '@/lib/utils'
import { dayHeading, plannedShiftId, weekDays, weekStartOf } from '../model'
import { useDecideSwap, usePublishWeek, useRota, useSetRotaDay, useSwaps } from '../queries'

const USUAL = 'usual'
const OFF = 'off'

/**
 * Manager: the week's rota (each cell = that person's shift that day, or off). Changing a cell
 * overrides their usual shift for that day; "Publish week" writes the whole week so staff see it.
 * Clock-in and the absence check follow the rota.
 */
export function RotaPage() {
  const today = useToday()
  const [weekStart, setWeekStart] = useState(weekStartOf(today))
  const days = weekDays(weekStart)
  const branch = useBranch().data
  const employees = useEmployees()
  const shifts = useShifts()
  const rota = useRota(weekStart, addDays(weekStart, 6))
  const swaps = useSwaps()
  const setDay = useSetRotaDay()
  const publish = usePublishWeek()
  const decide = useDecideSwap()

  const error = employees.error ?? shifts.error ?? rota.error ?? swaps.error
  if (error) return <ErrorState error={error} onRetry={() => void rota.refetch()} />
  if (!branch || !employees.data || !shifts.data || !rota.data || !swaps.data)
    return <Skeleton className="h-96 w-full rounded-xl" />
  const tz = branch.rules.timeZone
  const staff = employees.data.filter((e) => e.status !== 'inactive' && e.role === 'employee')
  const published = staff.every((e) =>
    days.every((d) => rota.data.some((r) => r.employeeId === e.id && r.date === d)),
  )
  const pending = swaps.data.filter((s) => s.status === 'pending')

  // Short, so it fits the cell; the dashed border marks it as the usual shift.
  const usualName = (shiftId: string | null) =>
    shifts.data.find((x) => x.id === shiftId)?.name ?? 'Off'

  const decideSwap = (req: SwapRequest, approve: boolean) => {
    const plan = (uid: string) => {
      const e = employees.data.find((x) => x.id === uid)
      return plannedShiftId(e?.shiftId ?? null, rota.data, uid, req.date, shifts.data, tz)
    }
    decide.mutate(
      { req, approve, plans: { fromShiftId: plan(req.fromId), toShiftId: plan(req.toId) }, branch },
      {
        onSuccess: () => toast.success(approve ? 'Swap approved: rota updated' : 'Swap rejected'),
        onError: (e) => toast.error(errorMessage(e)),
      },
    )
  }

  return (
    <div className="space-y-4">
      {pending.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Repeat className="size-4" /> Swap requests
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {pending.map((s) => (
              <div
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 text-sm"
              >
                <div>
                  <div className="font-medium">
                    {s.fromName} ↔ {s.toName} · {formatDay(s.date)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {s.reason || 'No reason given'}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => decideSwap(s, false)}
                    disabled={decide.isPending}
                  >
                    Reject
                  </Button>
                  <Button size="sm" onClick={() => decideSwap(s, true)} disabled={decide.isPending}>
                    Approve
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <PageHeader
            title={`Week of ${formatDay(weekStart)}`}
            description={
              published
                ? 'Published: staff can see this week.'
                : 'Not published yet: staff see only their own usual shift.'
            }
            actions={
              <>
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
                <Button
                  disabled={published || publish.isPending}
                  onClick={() =>
                    publish.mutate(
                      {
                        weekStart,
                        employees: staff,
                        shifts: shifts.data,
                        existing: rota.data,
                        branch,
                      },
                      {
                        onSuccess: (n) => toast.success(`Week published (${n} days planned)`),
                        onError: (e) => toast.error(errorMessage(e)),
                      },
                    )
                  }
                >
                  <CalendarCheck2 /> {published ? 'Published' : 'Publish week'}
                </Button>
              </>
            }
          />
        </CardHeader>
        <CardContent>
          {staff.length === 0 ? (
            <EmptyState icon={CalendarCheck2} title="No staff yet" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground uppercase">
                    <th className="p-2 font-medium">Employee</th>
                    {days.map((d) => (
                      <th key={d} className={cn('p-2 font-medium', d === today && 'text-primary')}>
                        {dayHeading(d)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {staff.map((e) => (
                    <tr key={e.id} className="border-t">
                      <td className="p-2 font-medium whitespace-nowrap">{e.name}</td>
                      {days.map((d) => {
                        const entry = rota.data.find((r) => r.employeeId === e.id && r.date === d)
                        const planned = plannedShiftId(
                          e.shiftId,
                          rota.data,
                          e.id,
                          d,
                          shifts.data,
                          tz,
                        )
                        return (
                          <td key={d} className="p-1">
                            <select
                              aria-label={`${e.name} on ${dayHeading(d)}`}
                              value={entry ? (entry.shiftId ?? OFF) : USUAL}
                              disabled={setDay.isPending}
                              onChange={(ev) => {
                                const v = ev.target.value
                                setDay.mutate(
                                  {
                                    employee: e,
                                    date: d,
                                    shiftId: v === USUAL ? 'usual' : v === OFF ? null : v,
                                  },
                                  { onError: (err) => toast.error(errorMessage(err)) },
                                )
                              }}
                              className={cn(
                                'h-9 w-full rounded-md border px-1.5 text-xs',
                                planned ? 'bg-success-soft' : 'bg-muted',
                                !entry && 'border-dashed',
                              )}
                            >
                              <option value={USUAL}>
                                {usualName(plannedShiftId(e.shiftId, [], e.id, d, shifts.data, tz))}
                              </option>
                              {shifts.data.map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.name} {formatTimeOfDay(s.start)}
                                </option>
                              ))}
                              <option value={OFF}>Off</option>
                            </select>
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            Dashed = their usual shift. Green = working. Clock-in and absences follow this rota.
          </p>
        </CardContent>
      </Card>

      {swaps.data.some((s) => s.status !== 'pending') && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Past swap requests</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {swaps.data
              .filter((s) => s.status !== 'pending')
              .slice(0, 10)
              .map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-3 py-1">
                  <span>
                    {s.fromName} ↔ {s.toName} · {formatDay(s.date)}
                  </span>
                  <StatusPill status={s.status} />
                </div>
              ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
