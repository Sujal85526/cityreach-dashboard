import { zonedDateTime, type Branch } from '@dm/shared'
import { Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { errorMessage } from '@/lib/errors'
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
import { formatDate } from '@/lib/format'
import { addDays, type DayRow } from '../model'
import { useSaveCorrection } from '../queries'

type Choice = 'present' | 'absent' | 'leave' | 'off'
const CHOICES: Record<Choice, string> = {
  present: 'Present (enter times)',
  absent: 'Absent',
  leave: 'Leave',
  off: 'Off',
}

/** "07:18" for an instant, in the shop's timezone. */
const toHHmm = (d: Date | null, tz: string) =>
  d
    ? new Intl.DateTimeFormat('en-GB', {
        timeZone: tz,
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      }).format(d)
    : ''

interface Props {
  row: DayRow | null
  dateKey: string
  branch: Branch
  onClose: () => void
}

/** Manager correction: mark Leave / Off / Absent or fix clock times. On Time vs Late is recalculated. */
export function CorrectionDialog({ row, dateKey, branch, onClose }: Props) {
  const tz = branch.rules.timeZone
  const save = useSaveCorrection()
  const [choice, setChoice] = useState<Choice>('present')
  const [inTime, setInTime] = useState('')
  const [outTime, setOutTime] = useState('')

  useEffect(() => {
    if (!row) return
    const s = row.status
    setChoice(s === 'absent' || s === 'leave' || s === 'off' ? s : 'present')
    setInTime(toHHmm(row.record?.clockInAt ?? null, tz) || row.shift?.start || '')
    setOutTime(toHHmm(row.record?.clockOutAt ?? null, tz))
  }, [row, tz])

  if (!row) return null

  const submit = () => {
    const clockInAt = choice === 'present' && inTime ? zonedDateTime(dateKey, inTime, tz) : null
    // A clock-out earlier than the clock-in belongs to the next day (night shift).
    const outDay = outTime && inTime && outTime <= inTime ? addDays(dateKey, 1) : dateKey
    const clockOutAt = choice === 'present' && outTime ? zonedDateTime(outDay, outTime, tz) : null
    save.mutate(
      {
        branch,
        correction: {
          employee: row.employee,
          dateKey,
          shift: row.shift,
          shiftStartAt: row.shiftStartAt,
          status: choice === 'present' ? 'on_time' : choice,
          clockInAt,
          clockOutAt,
          existing: row.record !== null,
        },
      },
      {
        onSuccess: () => {
          toast.success('Attendance updated')
          onClose()
        },
        onError: (e) => toast.error(errorMessage(e)),
      },
    )
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit attendance</DialogTitle>
          <DialogDescription>
            {row.employee.name} · {formatDate(new Date(`${dateKey}T12:00:00`))}. The change is
            logged.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={choice} onValueChange={(v) => setChoice(v as Choice)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(CHOICES) as Choice[]).map((c) => (
                  <SelectItem key={c} value={c}>
                    {CHOICES[c]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {choice === 'present' && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="in">Clock in</Label>
                <Input
                  id="in"
                  type="time"
                  value={inTime}
                  onChange={(e) => setInTime(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="out">Clock out (optional)</Label>
                <Input
                  id="out"
                  type="time"
                  value={outTime}
                  onChange={(e) => setOutTime(e.target.value)}
                />
              </div>
              <p className="col-span-2 text-xs text-muted-foreground">
                On Time or Late is worked out from the shift start ({row.shift?.start ?? 'no shift'}
                ) and the grace period.
              </p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={save.isPending}>
            {save.isPending && <Loader2 className="animate-spin" />} Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
