import { Loader2, LogOut } from 'lucide-react'
import { useState } from 'react'
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
import { formatClock, formatMinutes } from '@/lib/format'

/**
 * Shown when clocking out before the shift ends (beyond the grace period), like Keka:
 * how much is left, an optional reason, and a clear choice. The manager is notified.
 */
export function EarlyClockOutDialog({
  open,
  onOpenChange,
  shiftEndAt,
  minutesLeft,
  tz,
  pending,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  shiftEndAt: Date
  minutesLeft: number
  tz: string
  pending: boolean
  onConfirm: (reason: string) => void
}) {
  const [reason, setReason] = useState('')
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Leave before your shift ends?</DialogTitle>
          <DialogDescription>
            Your shift ends at {formatClock(shiftEndAt, tz)}:{' '}
            <span className="font-medium text-foreground">
              {formatMinutes(minutesLeft)} remaining
            </span>
            . Your manager will be notified that you left early.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="early-reason">Reason (optional)</Label>
          <Textarea
            id="early-reason"
            value={reason}
            maxLength={200}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Feeling unwell, approved by Amara"
          />
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Stay clocked in
          </Button>
          <Button variant="destructive" onClick={() => onConfirm(reason)} disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : <LogOut />}
            Clock out anyway
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
