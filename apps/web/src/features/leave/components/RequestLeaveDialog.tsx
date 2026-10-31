import { leaveDates, splitPaidDays, toDateKey, type LeaveRequestInput } from '@dm/shared'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { errorMessage } from '@/lib/errors'
import type { LeaveContext } from '../api'
import { leaveTypesOf, plural, workDaysOf, type TypeBalance } from '../model'
import { useRequestLeave } from '../queries'

/** Employee: pick a type and dates; shows the working days and how many will be unpaid. */
export function RequestLeaveDialog({
  open,
  onOpenChange,
  ctx,
  balances,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  ctx: LeaveContext
  balances: TypeBalance[]
}) {
  const today = toDateKey(new Date(), ctx.branch.rules.timeZone)
  const types = leaveTypesOf(ctx.branch)
  const [form, setForm] = useState<LeaveRequestInput>({
    typeId: types[0]?.id ?? 'annual',
    from: today,
    to: today,
    reason: '',
  })
  const request = useRequestLeave()
  const set = (patch: Partial<LeaveRequestInput>) => setForm((f) => ({ ...f, ...patch }))

  const balance = balances.find((b) => b.type.id === form.typeId)
  const days =
    form.from <= form.to
      ? leaveDates(form.from, form.to, workDaysOf(ctx.shift, ctx.branch)).length
      : 0
  const split = balance ? splitPaidDays(days, balance.type, balance.remaining) : null

  const submit = () =>
    request.mutate(
      { input: form, ctx },
      {
        onSuccess: () => {
          toast.success('Leave requested. Your manager has been notified.')
          onOpenChange(false)
        },
        onError: (e) => toast.error(errorMessage(e)),
      },
    )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Request leave</DialogTitle>
          <DialogDescription>
            Your manager approves or rejects it; you'll get a notification.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="leave-type">Type</Label>
            <Select value={form.typeId} onValueChange={(typeId) => set({ typeId })}>
              <SelectTrigger id="leave-type" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {types.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="leave-from">From</Label>
              <Input
                id="leave-from"
                type="date"
                value={form.from}
                onChange={(e) =>
                  e.target.value &&
                  set({
                    from: e.target.value,
                    to: form.to < e.target.value ? e.target.value : form.to,
                  })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="leave-to">To</Label>
              <Input
                id="leave-to"
                type="date"
                value={form.to}
                min={form.from}
                onChange={(e) => e.target.value && set({ to: e.target.value })}
              />
            </div>
          </div>
          <p className="rounded-lg bg-muted p-3 text-sm">
            {days === 0 ? 'No working days in these dates.' : `${plural(days, 'working day')}`}
            {split && days > 0 && (
              <>
                {balance?.remaining !== null && ` · ${balance?.remaining} left of this type`}
                {split.unpaidDays > 0 && (
                  <span className="mt-1 block text-warning">
                    {split.paidDays
                      ? `${plural(split.paidDays, 'day')} paid, ${plural(split.unpaidDays, 'day')} unpaid (deducted from salary).`
                      : 'Unpaid: deducted from salary.'}
                  </span>
                )}
              </>
            )}
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="leave-reason">Reason (optional)</Label>
            <Textarea
              id="leave-reason"
              value={form.reason}
              maxLength={300}
              onChange={(e) => set({ reason: e.target.value })}
              placeholder="e.g. Family visit"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={request.isPending || days === 0}>
            {request.isPending && <Loader2 className="animate-spin" />}
            Send request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
