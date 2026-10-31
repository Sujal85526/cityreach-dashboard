import { NOTIFICATION_TYPES, type Branch, type NotificationType } from '@cityreach/shared'
import { useState } from 'react'
import { toast } from 'sonner'
import { errorMessage } from '@/lib/errors'
import { Switch } from '@/components/ui/switch'
import { useUpdateBranch } from '../queries'
import { SettingsCard } from './SettingsCard'

const LABELS: Record<NotificationType, { title: string; example: string }> = {
  late_arrival: { title: 'Late arrival', example: '"Ahmed arrived 18 minutes late."' },
  absence: { title: 'Absence', example: '"Omar did not clock in for the Evening shift."' },
  early_leave: {
    title: 'Left early',
    example: '"Ahmed clocked out 2h 15m before his shift ended (feeling unwell)."',
  },
  leave_requested: {
    title: 'Leave request',
    example: '"Omar asked for annual leave: 2 Nov – 4 Nov (3 days)."',
  },
  leave_decided: {
    title: 'Leave decision (to employees)',
    example: '"Your annual leave for 2 Nov – 4 Nov is approved."',
  },
  document_expiry: {
    title: 'Document expiring / expired',
    example: '"Trade license expires on 15 Jan 2027."',
  },
  temperature_alert: {
    title: 'Temperature out of range',
    example: '"Milk fridge read 9 °C (allowed 1–5 °C)."',
  },
  equipment_service: {
    title: 'Equipment service / warranty',
    example: '"Espresso machine service is due on 3 Nov."',
  },
  incident_reported: { title: 'Incident reported', example: '"Omar reported an injury (high)."' },
  swap_requested: {
    title: 'Shift swap request',
    example: '"Layla asked to swap 24 Oct with Omar."',
  },
  probation_ending: {
    title: 'Probation ending',
    example: '"Karim\'s probation ends on 5 Nov."',
  },
  clock_in_away: {
    title: 'Clock-in away from the shop',
    example: '"Layla clocked in 2.3 km from the shop."',
  },
  task_assigned: {
    title: 'Task assigned (to employees)',
    example: '"Amara assigned you \'Clean the grinder\'."',
  },
  task_completed: {
    title: 'Task completed',
    example: '"Sara completed the espresso machine cleaning task."',
  },
  task_overdue: {
    title: 'Task overdue',
    example: '"Task deadline has passed and the task is still incomplete."',
  },
  stock_low: {
    title: 'Low stock',
    example: '"Whole Milk has fallen below its minimum stock level."',
  },
  stock_critical: { title: 'Critical stock', example: '"Chocolate Powder is critically low."' },
  report_ready: { title: 'Report ready', example: '"Weekly performance report is ready."' },
  top_performer: { title: 'Top performer', example: '"Sara is this week\'s top performer."' },
}

/** Which rule-based alerts reach the manager (docs/PRODUCT.md §8). */
export function NotificationPrefsForm({ branch }: { branch: Branch }) {
  const [prefs, setPrefs] = useState(branch.notificationPrefs)
  const update = useUpdateBranch()
  const dirty = NOTIFICATION_TYPES.some((t) => prefs[t] !== branch.notificationPrefs[t])

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    update.mutate(
      { patch: { notificationPrefs: prefs }, what: 'notification preferences' },
      {
        onSuccess: () => toast.success('Preferences saved'),
        onError: (err) => toast.error(errorMessage(err)),
      },
    )
  }

  return (
    <SettingsCard
      title="Notification preferences"
      description="Alerts are created automatically by rules. Turn off the ones you don't need."
      onSubmit={onSubmit}
      saving={update.isPending}
      dirty={dirty}
    >
      <ul className="divide-y">
        {NOTIFICATION_TYPES.map((type) => (
          <li key={type} className="flex items-center justify-between gap-4 py-3">
            <div>
              <div className="text-sm font-medium">{LABELS[type].title}</div>
              <div className="text-xs text-muted-foreground">{LABELS[type].example}</div>
            </div>
            <Switch
              checked={prefs[type] ?? true}
              onCheckedChange={(on) => setPrefs({ ...prefs, [type]: on })}
              aria-label={LABELS[type].title}
            />
          </li>
        ))}
      </ul>
    </SettingsCard>
  )
}
