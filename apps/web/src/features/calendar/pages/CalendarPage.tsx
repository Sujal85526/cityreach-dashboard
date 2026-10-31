import type { Candidate, Equipment, PurchaseOrder, Training } from '@cityreach/shared'
import { addDays, toDateKey } from '@cityreach/shared'
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  FileWarning,
  Landmark,
  Truck,
  UserCheck,
  Wallet,
  Wrench,
  type LucideIcon,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { ErrorState } from '@/components/common/EmptyState'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useDocuments } from '@/features/documents/queries'
import { useEmployees } from '@/features/employees/queries'
import { useBranchLeave } from '@/features/leave/queries'
import { useRecords } from '@/features/records/queries'
import { useBranch, useTimeZone } from '@/features/settings/queries'
import { cn } from '@/lib/utils'
import { calendarEvents, EVENT_KINDS, lastDayOf, shiftMonth, type EventKind } from '../events'

const KIND: Record<EventKind, { label: string; className: string; icon: LucideIcon }> = {
  leave: { label: 'On leave', className: 'bg-success-soft text-success', icon: CalendarDays },
  pending: {
    label: 'Leave waiting for approval',
    className: 'bg-warning-soft text-warning',
    icon: CalendarDays,
  },
  expiry: { label: 'Expires', className: 'bg-danger-soft text-danger', icon: FileWarning },
  salary: { label: 'Salary day', className: 'bg-info-soft text-info', icon: Wallet },
  delivery: { label: 'Delivery', className: 'bg-primary/10 text-primary', icon: Truck },
  payment: { label: 'Supplier payment', className: 'bg-warning-soft text-warning', icon: Wallet },
  service: { label: 'Machine service', className: 'bg-muted text-foreground', icon: Wrench },
  vat: { label: 'VAT return', className: 'bg-danger-soft text-danger', icon: Landmark },
  people: { label: 'Interview / probation', className: 'bg-info-soft text-info', icon: UserCheck },
}
function EventIcon({ kind }: { kind: EventKind }) {
  const Icon = KIND[kind].icon
  return <Icon className="size-4" aria-hidden />
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MAX_CHIPS = 3

const monthTitle = (month: string) =>
  new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(`${month}-15T12:00:00Z`),
  )
const dayLabel = (dateKey: string) =>
  new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(new Date(`${dateKey}T12:00:00Z`))

/**
 * Manager: one month at a glance: leave, expiries (documents, certificates), salary day, supplier
 * deliveries and payments, machine services, the VAT return, interviews and probation ends.
 * Click a day to see everything on it. Every list here is already cached by its own screen.
 */
export function CalendarPage() {
  const branch = useBranch().data
  const today = toDateKey(new Date(), useTimeZone())
  const [month, setMonth] = useState(today.slice(0, 7))
  const [picked, setPicked] = useState<string | null>(null)
  const leave = useBranchLeave()
  const docs = useDocuments()
  const employees = useEmployees()
  const orders = useRecords<PurchaseOrder>('purchaseOrders')
  const equipment = useRecords<Equipment>('equipment')
  const training = useRecords<Training>('training')
  const candidates = useRecords<Candidate>('candidates')

  const events = useMemo(
    () =>
      branch
        ? calendarEvents({
            month,
            branch,
            leave: leave.data ?? [],
            documents: docs.data ?? [],
            orders: orders.data ?? [],
            equipment: equipment.data ?? [],
            training: training.data ?? [],
            candidates: candidates.data ?? [],
            employees: employees.data ?? [],
          })
        : new Map<string, never[]>(),
    [
      month,
      branch,
      leave.data,
      docs.data,
      orders.data,
      equipment.data,
      training.data,
      candidates.data,
      employees.data,
    ],
  )

  const queries = [leave, docs, employees, orders, equipment, training, candidates]
  const error = queries.find((q) => q.error)?.error
  if (error)
    return <ErrorState error={error} onRetry={() => queries.forEach((q) => void q.refetch())} />
  const loading = !branch || queries.some((q) => !q.data)

  const first = `${month}-01`
  const lead = (new Date(`${first}T12:00:00Z`).getUTCDay() + 6) % 7 // Monday first
  const last = lastDayOf(month)
  const days: (string | null)[] = Array.from({ length: lead }, () => null)
  for (let d = first; d <= last; d = addDays(d, 1)) days.push(d)
  while (days.length % 7) days.push(null)
  const selected = picked && picked.startsWith(month) ? picked : null
  const selectedEvents = selected ? (events.get(selected) ?? []) : []

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarDays className="size-4" /> {monthTitle(month)}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              aria-label="Previous month"
              onClick={() => setMonth(shiftMonth(month, -1))}
            >
              <ChevronLeft />
            </Button>
            <Button variant="outline" onClick={() => setMonth(today.slice(0, 7))}>
              Today
            </Button>
            <Button
              variant="outline"
              size="icon"
              aria-label="Next month"
              onClick={() => setMonth(shiftMonth(month, 1))}
            >
              <ChevronRight />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-3 text-xs">
            {EVENT_KINDS.map((k) => (
              <span key={k} className="flex items-center gap-1.5">
                <span className={cn('size-3 rounded-sm', KIND[k].className)} />
                {KIND[k].label}
              </span>
            ))}
          </div>
          {loading ? (
            <Skeleton className="h-96 w-full" />
          ) : (
            <div className="grid grid-cols-7 overflow-hidden rounded-lg border text-xs">
              {WEEKDAYS.map((w) => (
                <div key={w} className="border-b bg-muted/50 p-2 font-medium text-muted-foreground">
                  {w}
                </div>
              ))}
              {days.map((day, i) => {
                const list = day ? (events.get(day) ?? []) : []
                return (
                  <button
                    key={day ?? `pad-${i}`}
                    type="button"
                    disabled={!day}
                    onClick={() => day && setPicked(day)}
                    className={cn(
                      'min-h-16 border-b border-l p-1 text-left align-top sm:min-h-24 sm:p-1.5',
                      i % 7 === 0 && 'border-l-0',
                      !day && 'bg-muted/30',
                      day !== null &&
                        day === selected &&
                        'bg-primary/5 ring-2 ring-primary ring-inset',
                    )}
                    aria-label={day ? `${dayLabel(day)}: ${list.length} events` : undefined}
                  >
                    {day && (
                      <>
                        <div
                          className={cn(
                            'mb-1 flex size-6 items-center justify-center rounded-full font-medium',
                            day === today && 'bg-primary text-primary-foreground',
                          )}
                        >
                          {Number(day.slice(8))}
                        </div>
                        <div className="hidden space-y-0.5 sm:block">
                          {list.slice(0, MAX_CHIPS).map((e, j) => (
                            <div
                              key={j}
                              className={cn('truncate rounded px-1 py-0.5', KIND[e.kind].className)}
                            >
                              {e.text}
                            </div>
                          ))}
                          {list.length > MAX_CHIPS && (
                            <div className="px-1 text-muted-foreground">
                              +{list.length - MAX_CHIPS} more
                            </div>
                          )}
                        </div>
                        {/* Phones: dots instead of text; tap the day for the list. */}
                        <div className="flex flex-wrap gap-0.5 sm:hidden">
                          {list.slice(0, 4).map((e, j) => (
                            <span
                              key={j}
                              className={cn('size-2 rounded-full', KIND[e.kind].className)}
                            />
                          ))}
                        </div>
                      </>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {selected && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{dayLabel(selected)}</CardTitle>
          </CardHeader>
          <CardContent>
            {selectedEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing on this day.</p>
            ) : (
              <ul className="space-y-2">
                {selectedEvents.map((e, j) => (
                  <li key={j}>
                    <Link
                      to={e.to}
                      className="flex items-center gap-3 rounded-lg border p-3 text-sm hover:bg-muted/50"
                    >
                      <span
                        className={cn(
                          'flex size-8 items-center justify-center rounded-lg',
                          KIND[e.kind].className,
                        )}
                      >
                        <EventIcon kind={e.kind} />
                      </span>
                      <span className="flex-1">{e.text}</span>
                      <ChevronRight className="size-4 text-muted-foreground" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
