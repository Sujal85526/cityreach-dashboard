import type { Shift } from '@cityreach/shared'
import { CalendarClock, Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { errorMessage } from '@/lib/errors'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { EmptyState, ErrorState } from '@/components/common/EmptyState'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { shiftLabel } from '@/lib/format'
import { useDeleteShift, useShifts } from '../queries'
import { DAY_NAMES } from './BusinessHoursForm'
import { SettingsCard } from './SettingsCard'
import { ShiftDialog } from './ShiftDialog'

const daysLabel = (days: number[]) =>
  days.length === 7 ? 'Every day' : days.map((d) => DAY_NAMES[d]?.slice(0, 3)).join(', ')

export function ShiftsCard() {
  const shifts = useShifts()
  const remove = useDeleteShift()
  const [editing, setEditing] = useState<{ open: boolean; shift?: Shift }>({ open: false })
  const [deleting, setDeleting] = useState<Shift | null>(null)

  const confirmDelete = () =>
    deleting &&
    remove.mutate(deleting, {
      onSuccess: () => {
        toast.success(`${deleting.name} shift removed`)
        setDeleting(null)
      },
      onError: (e) => {
        toast.error(errorMessage(e))
        setDeleting(null)
      },
    })

  return (
    <SettingsCard
      title="Shifts"
      description="Assign one to each employee; lateness is measured against its start time."
    >
      {shifts.error ? (
        <ErrorState error={shifts.error} onRetry={() => void shifts.refetch()} />
      ) : shifts.isPending ? (
        <Skeleton className="h-24 w-full" />
      ) : shifts.data.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title="No shifts yet"
          description="Add the shifts your team works."
        />
      ) : (
        <ul className="divide-y">
          {shifts.data.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-3 py-2">
              <div>
                <div className="text-sm font-medium">{shiftLabel(s)}</div>
                <div className="text-xs text-muted-foreground">{daysLabel(s.days)}</div>
              </div>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Edit ${s.name}`}
                  onClick={() => setEditing({ open: true, shift: s })}
                >
                  <Pencil />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Delete ${s.name}`}
                  onClick={() => setDeleting(s)}
                >
                  <Trash2 />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <Button variant="outline" onClick={() => setEditing({ open: true })}>
        <Plus /> Add shift
      </Button>
      <ShiftDialog
        open={editing.open}
        shift={editing.shift}
        onOpenChange={(open) => setEditing((s) => ({ ...s, open }))}
      />
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Delete the ${deleting?.name ?? ''} shift?`}
        description="Past attendance keeps its recorded times. You can't delete a shift that employees are still assigned to."
        confirmLabel="Delete shift"
        destructive
        pending={remove.isPending}
        onConfirm={confirmDelete}
      />
    </SettingsCard>
  )
}
