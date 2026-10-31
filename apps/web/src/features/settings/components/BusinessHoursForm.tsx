import type { Branch } from '@dm/shared'
import { useState } from 'react'
import { toast } from 'sonner'
import { errorMessage } from '@/lib/errors'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { useUpdateBranch } from '../queries'
import { SettingsCard } from './SettingsCard'

export const DAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
]

export function BusinessHoursForm({ branch }: { branch: Branch }) {
  const [hours, setHours] = useState(() => [...branch.businessHours].sort((a, b) => a.day - b.day))
  const [dirty, setDirty] = useState(false)
  const update = useUpdateBranch()

  const change = (day: number, patch: Partial<(typeof hours)[number]>) => {
    setHours((h) => h.map((d) => (d.day === day ? { ...d, ...patch } : d)))
    setDirty(true)
  }

  const invalid = hours.some((d) => !d.closed && (!d.open || !d.close))
  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (invalid) return toast.error('Every open day needs an opening and closing time.')
    update.mutate(
      { patch: { businessHours: hours }, what: 'business hours' },
      {
        onSuccess: () => {
          setDirty(false)
          toast.success('Business hours saved')
        },
        onError: (err) => toast.error(errorMessage(err)),
      },
    )
  }

  return (
    <SettingsCard
      title="Business hours"
      description="When the shop is open. Closing after midnight is fine (e.g. 07:00–01:00)."
      onSubmit={onSubmit}
      saving={update.isPending}
      dirty={dirty}
    >
      <div className="divide-y">
        {hours.map((d) => (
          <div key={d.day} className="flex flex-wrap items-center gap-3 py-2">
            <span className="w-24 text-sm font-medium">{DAY_NAMES[d.day]}</span>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <Switch
                checked={!d.closed}
                onCheckedChange={(open) => change(d.day, { closed: !open })}
                aria-label={`${DAY_NAMES[d.day]} open`}
              />
              {d.closed ? 'Closed' : 'Open'}
            </label>
            {!d.closed && (
              <div className="flex items-center gap-2">
                <Input
                  type="time"
                  value={d.open}
                  onChange={(e) => change(d.day, { open: e.target.value })}
                  className="w-32"
                  aria-label={`${DAY_NAMES[d.day]} opening time`}
                />
                <span className="text-muted-foreground">–</span>
                <Input
                  type="time"
                  value={d.close}
                  onChange={(e) => change(d.day, { close: e.target.value })}
                  className="w-32"
                  aria-label={`${DAY_NAMES[d.day]} closing time`}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </SettingsCard>
  )
}
