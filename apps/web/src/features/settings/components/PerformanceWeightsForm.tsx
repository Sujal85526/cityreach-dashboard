import type { Branch } from '@dm/shared'
import { useState } from 'react'
import { toast } from 'sonner'
import { errorMessage } from '@/lib/errors'
import { useUpdateBranch } from '../queries'
import { inRange, NumberField } from './NumberField'
import { SettingsCard } from './SettingsCard'

const FIELDS = [
  { key: 'attendance', label: 'Attendance', hint: 'Shifts attended ÷ shifts scheduled' },
  { key: 'punctuality', label: 'Punctuality', hint: 'On-time arrivals ÷ shifts attended' },
  { key: 'tasks', label: 'Task completion', hint: 'Tasks completed ÷ tasks assigned' },
  {
    key: 'manager',
    label: 'Manager rating',
    hint: 'Weekly rating 1–5 ÷ 5. If not rated, this weight is shared by the others.',
  },
] as const
type Key = (typeof FIELDS)[number]['key']

const toPercent = (w: Branch['rules']['performance']) =>
  Object.fromEntries(FIELDS.map(({ key }) => [key, Math.round(w[key] * 100)])) as Record<
    Key,
    number
  >

/** Weights of the transparent performance score (docs/PRODUCT.md §6); must add up to 100 %. */
export function PerformanceWeightsForm({ branch }: { branch: Branch }) {
  const initial = toPercent(branch.rules.performance)
  const [weights, setWeights] = useState(initial)
  const update = useUpdateBranch()
  const total = FIELDS.reduce((sum, { key }) => sum + (weights[key] || 0), 0)
  const dirty = FIELDS.some(({ key }) => weights[key] !== initial[key])

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (FIELDS.some(({ key }) => !inRange(weights[key], 0, 100)) || total !== 100)
      return toast.error('Weights must be whole numbers that add up to 100 %.')
    const performance = Object.fromEntries(
      FIELDS.map(({ key }) => [key, weights[key] / 100]),
    ) as Record<Key, number>
    update.mutate(
      { patch: { rules: { ...branch.rules, performance } }, what: 'performance weights' },
      {
        onSuccess: () => toast.success('Weights saved'),
        onError: (err) => toast.error(errorMessage(err)),
      },
    )
  }

  return (
    <SettingsCard
      title="Performance weights"
      description="Score = Σ weight × measure, out of 100. No AI: the formula is shown on every report."
      onSubmit={onSubmit}
      saving={update.isPending}
      dirty={dirty}
    >
      <div className="grid gap-6 sm:grid-cols-2">
        {FIELDS.map(({ key, label, hint }) => (
          <NumberField
            key={key}
            id={`w-${key}`}
            label={label}
            hint={hint}
            suffix="%"
            min={0}
            max={100}
            value={weights[key]}
            onChange={(v) => setWeights({ ...weights, [key]: v })}
          />
        ))}
      </div>
      <p className={total === 100 ? 'text-sm text-success' : 'text-sm text-danger'} role="status">
        Total: {Number.isNaN(total) ? '—' : total} % {total === 100 ? '✓' : '(must be 100 %)'}
      </p>
    </SettingsCard>
  )
}
