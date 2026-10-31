import type { LeaveRequest } from '@dm/shared'
import { CalendarDays } from 'lucide-react'
import { toast } from 'sonner'
import { EmptyState } from '@/components/common/EmptyState'
import { StatusPill } from '@/components/common/StatusPill'
import { Button } from '@/components/ui/button'
import { errorMessage } from '@/lib/errors'
import { formatRange, plural } from '../model'
import { useCancelLeave } from '../queries'

/** The employee's own requests with their status; pending ones can be withdrawn. */
export function MyRequestList({ requests }: { requests: LeaveRequest[] }) {
  const cancel = useCancelLeave()
  if (requests.length === 0) return <EmptyState icon={CalendarDays} title="No leave requests yet" />
  return (
    <ul className="divide-y">
      {requests.map((r) => (
        <li key={r.id} className="flex items-start justify-between gap-3 py-3 text-sm">
          <div className="min-w-0 space-y-0.5">
            <div className="font-medium">
              {r.typeName} · {formatRange(r.from, r.to)}
            </div>
            <div className="text-xs text-muted-foreground">
              {plural(r.dates.length, 'working day')}
              {r.status === 'approved' && r.paidDays !== null && r.paidDays < r.dates.length
                ? ` · ${plural(r.dates.length - r.paidDays, 'day')} unpaid`
                : ''}
              {r.reason ? ` · ${r.reason}` : ''}
            </div>
            {r.managerComment && (
              <div className="text-xs">
                <span className="text-muted-foreground">Manager:</span> {r.managerComment}
              </div>
            )}
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <StatusPill status={r.status} />
            {r.status === 'pending' && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                disabled={cancel.isPending}
                onClick={() =>
                  cancel.mutate(r, {
                    onSuccess: () => toast.success('Request withdrawn'),
                    onError: (e) => toast.error(errorMessage(e)),
                  })
                }
              >
                Withdraw
              </Button>
            )}
          </div>
        </li>
      ))}
    </ul>
  )
}
