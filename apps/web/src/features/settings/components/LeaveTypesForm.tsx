import type { Branch, LeaveType } from '@cityreach/shared'
import { Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { leaveTypesOf } from '@/features/leave/model'
import { errorMessage } from '@/lib/errors'
import { useUpdateBranch } from '../queries'
import { SettingsCard } from './SettingsCard'

interface Row {
  id: string
  name: string
  /** Blank = no limit. */
  days: string
  paid: boolean
}

const toRow = (t: LeaveType): Row => ({
  id: t.id,
  name: t.name,
  days: t.daysPerYear === null ? '' : String(t.daysPerYear),
  paid: t.paid,
})
const newId = (name: string) =>
  `${
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .slice(0, 20) || 'leave'
  }-${Date.now().toString(36)}`

/**
 * The leave types staff can request, each with a default yearly allowance and whether it's paid.
 * Per-employee allowances are set on the employee's profile. Removing a type keeps past requests.
 */
export function LeaveTypesForm({ branch }: { branch: Branch }) {
  const saved = leaveTypesOf(branch).map(toRow)
  const [rows, setRows] = useState<Row[]>(saved)
  const update = useUpdateBranch()
  const dirty = JSON.stringify(rows) !== JSON.stringify(saved)
  const edit = (i: number, patch: Partial<Row>) =>
    setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)))

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const types: LeaveType[] = rows.map((r) => ({
      id: r.id || newId(r.name),
      name: r.name.trim(),
      daysPerYear: r.days.trim() === '' ? null : Number(r.days),
      paid: r.paid,
    }))
    if (types.some((t) => !t.name)) return toast.error('Every leave type needs a name.')
    if (
      types.some(
        (t) =>
          t.daysPerYear !== null &&
          !(Number.isInteger(t.daysPerYear) && t.daysPerYear >= 0 && t.daysPerYear <= 366),
      )
    )
      return toast.error(
        'Days per year must be a whole number from 0 to 366, or blank for no limit.',
      )
    if (types.length === 0) return toast.error('Keep at least one leave type.')
    update.mutate(
      { patch: { leaveTypes: types }, what: 'leave types' },
      {
        onSuccess: () => toast.success('Leave types saved'),
        onError: (err) => toast.error(errorMessage(err)),
      },
    )
  }

  return (
    <SettingsCard
      title="Leave types"
      description="What staff can request and how many days a year each person gets by default. Paid types beyond the balance become unpaid; unpaid days are deducted from salary (salary ÷ 30 per day)."
      onSubmit={onSubmit}
      saving={update.isPending}
      dirty={dirty}
    >
      <div className="hidden grid-cols-[1fr_7rem_4rem_2.5rem] gap-3 text-xs text-muted-foreground uppercase sm:grid">
        <span>Name</span>
        <span>Days / year</span>
        <span>Paid</span>
        <span />
      </div>
      <ul className="space-y-3">
        {rows.map((r, i) => (
          <li
            key={r.id || i}
            className="grid grid-cols-[1fr_6rem] items-center gap-3 sm:grid-cols-[1fr_7rem_4rem_2.5rem]"
          >
            <Input
              value={r.name}
              maxLength={40}
              onChange={(e) => edit(i, { name: e.target.value })}
              aria-label="Leave type name"
              className="col-span-2 sm:col-span-1"
            />
            <Input
              type="number"
              inputMode="numeric"
              min={0}
              max={366}
              value={r.days}
              placeholder="No limit"
              onChange={(e) => edit(i, { days: e.target.value })}
              aria-label={`${r.name} days per year`}
            />
            <Switch
              checked={r.paid}
              onCheckedChange={(paid) => edit(i, { paid })}
              aria-label={`${r.name} is paid`}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setRows(rows.filter((_, j) => j !== i))}
              aria-label={`Remove ${r.name}`}
            >
              <Trash2 />
            </Button>
          </li>
        ))}
      </ul>
      <Button
        type="button"
        variant="outline"
        onClick={() => setRows([...rows, { id: '', name: '', days: '5', paid: true }])}
      >
        <Plus /> Add leave type
      </Button>
    </SettingsCard>
  )
}
