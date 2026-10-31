import { DEFAULT_EARLY_LEAVE_GRACE_MINUTES, type Branch } from '@cityreach/shared'
import { useState } from 'react'
import { toast } from 'sonner'
import { errorMessage } from '@/lib/errors'
import { useUpdateBranch } from '../queries'
import { inRange, NumberField } from './NumberField'
import { SettingsCard } from './SettingsCard'

/** Attendance thresholds and the inventory critical ratio (docs/PRODUCT.md §3 and §5). */
export function RulesForm({ branch }: { branch: Branch }) {
  const { attendance, inventory } = branch.rules
  const [grace, setGrace] = useState(attendance.graceMinutes)
  const [absent, setAbsent] = useState(attendance.absentAfterMinutes)
  const savedEarly = attendance.earlyLeaveGraceMinutes ?? DEFAULT_EARLY_LEAVE_GRACE_MINUTES
  const [early, setEarly] = useState(savedEarly)
  const [critical, setCritical] = useState(Math.round(inventory.criticalRatio * 100))
  const update = useUpdateBranch()

  const dirty =
    grace !== attendance.graceMinutes ||
    absent !== attendance.absentAfterMinutes ||
    early !== savedEarly ||
    critical !== Math.round(inventory.criticalRatio * 100)

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (
      !inRange(grace, 0, 120) ||
      !inRange(absent, 5, 480) ||
      !inRange(early, 0, 120) ||
      !inRange(critical, 1, 100)
    )
      return toast.error(
        'Check the values: grace 0–120 min, absent 5–480 min, leaving early 0–120 min, critical 1–100 %.',
      )
    if (absent <= grace) return toast.error('"Absent after" must be longer than the grace period.')
    update.mutate(
      {
        patch: {
          rules: {
            ...branch.rules,
            attendance: {
              graceMinutes: grace,
              absentAfterMinutes: absent,
              earlyLeaveGraceMinutes: early,
            },
            inventory: { criticalRatio: critical / 100 },
          },
        },
        what: 'attendance and stock rules',
      },
      {
        onSuccess: () => toast.success('Rules saved'),
        onError: (err) => toast.error(errorMessage(err)),
      },
    )
  }

  return (
    <SettingsCard
      title="Attendance & stock rules"
      description="Used by the automatic checks. Changes apply to new records; past records keep their status."
      onSubmit={onSubmit}
      saving={update.isPending}
      dirty={dirty}
    >
      <div className="grid gap-6 sm:grid-cols-2">
        <NumberField
          id="grace"
          label="Grace period"
          suffix="minutes"
          min={0}
          max={120}
          value={grace}
          onChange={setGrace}
          hint={`Clock-in up to ${grace || 0} min after the shift starts counts as On Time. Example: shift 07:00, clock-in 07:18 → Late – 18 min.`}
        />
        <NumberField
          id="absent"
          label="Absent after"
          suffix="minutes"
          min={5}
          max={480}
          value={absent}
          onChange={setAbsent}
          hint="No clock-in this long after the shift starts → Absent."
        />
        <NumberField
          id="early"
          label="Leaving early grace"
          suffix="minutes"
          min={0}
          max={120}
          value={early}
          onChange={setEarly}
          hint={`Clocking out more than ${early || 0} min before the shift ends → “Left early” and you're notified. Example: shift ends 15:00, clock-out 12:45 → Left 2h 15m early.`}
        />
        <NumberField
          id="critical"
          label="Critical stock level"
          suffix="% of minimum"
          min={1}
          max={100}
          value={critical}
          onChange={setCritical}
          hint={`Below the minimum → Low. At or below ${critical || 0} % of the minimum → Critical.`}
        />
      </div>
    </SettingsCard>
  )
}
