import type { Branch, LeaveRequest, Shift, User } from '@dm/shared'
import { Loader2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { errorMessage } from '@/lib/errors'
import { previewDecision } from '../api'
import { formatMoney, formatRange, plural } from '../model'
import { useDecideLeave } from '../queries'

/** Approve or reject one request; shows how many days will be paid and the pay impact. */
export function DecideDialog({
  request,
  employee,
  shift,
  history,
  branch,
  onClose,
}: {
  request: LeaveRequest
  employee: User
  shift: Shift | null
  history: LeaveRequest[]
  branch: Branch
  onClose: () => void
}) {
  const [comment, setComment] = useState('')
  const decide = useDecideLeave()
  const preview = previewDecision({ request, employee, history }, branch)
  const salary = employee.salary ?? null

  const submit = (approve: boolean) =>
    decide.mutate(
      {
        decision: { request, approve, comment, employee, shift, history },
        branch,
      },
      {
        onSuccess: () => {
          toast.success(approve ? 'Leave approved' : 'Leave rejected')
          onClose()
        },
        onError: (e) => toast.error(errorMessage(e)),
      },
    )

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {employee.name} · {request.typeName}
          </DialogTitle>
          <DialogDescription>
            {formatRange(request.from, request.to)} · {plural(request.dates.length, 'working day')}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          {request.reason && (
            <p>
              <span className="text-muted-foreground">Reason:</span> {request.reason}
            </p>
          )}
          <div className="rounded-lg bg-muted p-3">
            {preview.remaining === null
              ? preview.type.paid
                ? 'No limit for this type.'
                : 'Unpaid leave.'
              : `${plural(preview.remaining, 'day')} of ${preview.type.name.toLowerCase()} left before this request.`}
            <div className="mt-1 font-medium">
              If approved: {plural(preview.paidDays, 'day')} paid
              {preview.unpaidDays > 0 && `, ${plural(preview.unpaidDays, 'day')} unpaid`}
              {preview.unpaidDays > 0 &&
                salary !== null &&
                ` (− ${formatMoney(Math.round((salary / 30) * preview.unpaidDays * 100) / 100)})`}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="decision-comment">Comment to {employee.name} (optional)</Label>
            <Textarea
              id="decision-comment"
              value={comment}
              maxLength={300}
              onChange={(e) => setComment(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => submit(false)} disabled={decide.isPending}>
            Reject
          </Button>
          <Button onClick={() => submit(true)} disabled={decide.isPending}>
            {decide.isPending && <Loader2 className="animate-spin" />}
            Approve
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
