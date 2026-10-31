import { finalSettlement, toDateKey, type Branch, type User } from '@dm/shared'
import { Download } from 'lucide-react'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { balancesFor } from '@/features/leave/model'
import { useEmployeeLeave } from '@/features/leave/queries'
import { formatDay, formatMoney } from '@/lib/format'

/**
 * End of service: gratuity (UAE rules, on basic salary), unused annual leave paid out, salary for
 * the final month up to the last day, minus other deductions. A calculation to check and print,
 * not a payment.
 */
export function SettlementDialog({
  employee,
  branch,
  onClose,
}: {
  employee: User
  branch: Branch
  onClose: () => void
}) {
  const today = toDateKey(new Date(), branch.rules.timeZone)
  const leave = useEmployeeLeave(employee.id)
  const remaining =
    leave.data &&
    balancesFor(employee, branch, leave.data, Number(today.slice(0, 4))).find(
      (b) => b.type.id === 'annual',
    )?.remaining
  const [lastDay, setLastDay] = useState(today)
  const [unused, setUnused] = useState<string | null>(null)
  const [deductions, setDeductions] = useState('0')
  const unusedDays = unused ?? String(remaining ?? 0)
  const joinedOn = toDateKey(employee.hiredAt, branch.rules.timeZone)
  const r = finalSettlement({
    basicSalary: employee.salary ?? 0,
    allowances: employee.allowances ?? 0,
    joinedOn,
    lastDay,
    unusedLeaveDays: Number(unusedDays) || 0,
    otherDeductions: Number(deductions) || 0,
  })

  const lines: [string, string][] = [
    [`Gratuity (${r.years} years of service)`, formatMoney(r.gratuity)],
    [`Unused annual leave (${Number(unusedDays) || 0} days)`, formatMoney(r.leavePay)],
    [`Salary for ${r.daysThisMonth} days this month`, formatMoney(r.salaryDue)],
    ['Other deductions', `− ${formatMoney(Number(deductions) || 0)}`],
  ]

  const pdf = async () => {
    const { jsPDF } = await import('jspdf')
    const doc = new jsPDF({ unit: 'pt', format: 'a4' })
    doc.setFontSize(18).text(branch.name, 40, 50)
    doc.setFontSize(13).setTextColor(90).text('Final settlement (estimate)', 40, 72)
    doc.setTextColor(0).setFontSize(11)
    doc.text(`${employee.name} · ${employee.position}`, 40, 98)
    doc.text(`Joined ${formatDay(joinedOn)} · last day ${formatDay(lastDay)}`, 40, 114)
    doc.text(
      `Basic salary ${formatMoney(employee.salary ?? 0)} · allowances ${formatMoney(employee.allowances ?? 0)}`,
      40,
      130,
    )
    lines.forEach(([label, value], i) => {
      doc.text(label, 40, 162 + i * 20)
      doc.text(value, 480, 162 + i * 20, { align: 'right' })
    })
    doc.setFontSize(14).text(`Total: ${formatMoney(r.total)}`, 40, 162 + lines.length * 20 + 20)
    doc
      .setFontSize(8)
      .setTextColor(120)
      .text(
        'Gratuity: 21 days of basic pay per year for the first 5 years, 30 days after; capped at 2 years of pay; none under 1 year.',
        40,
        162 + lines.length * 20 + 44,
      )
    doc.save(`final-settlement_${employee.name.replace(/\s+/g, '-')}.pdf`)
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Final settlement: {employee.name}</DialogTitle>
          <DialogDescription>
            Joined {formatDay(joinedOn)}. UAE end-of-service rules on the basic salary
            {employee.salary == null ? ' (no salary set yet: add it under Pay & leave)' : ''}.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="s-last">Last day</Label>
            <Input
              id="s-last"
              type="date"
              value={lastDay}
              min={joinedOn}
              onChange={(e) => e.target.value && setLastDay(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="s-leave">Unused leave</Label>
            <Input
              id="s-leave"
              type="number"
              min={0}
              value={unusedDays}
              onChange={(e) => setUnused(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="s-ded">Deductions</Label>
            <Input
              id="s-ded"
              type="number"
              min={0}
              value={deductions}
              onChange={(e) => setDeductions(e.target.value)}
            />
          </div>
        </div>
        <dl className="space-y-1.5 text-sm">
          {lines.map(([label, value]) => (
            <div key={label} className="flex justify-between gap-3">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="tabular-nums">{value}</dd>
            </div>
          ))}
          <div className="flex justify-between gap-3 border-t pt-2 text-base font-semibold">
            <dt>Total</dt>
            <dd className="tabular-nums">{formatMoney(r.total)}</dd>
          </div>
        </dl>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button onClick={() => void pdf()}>
            <Download /> PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
