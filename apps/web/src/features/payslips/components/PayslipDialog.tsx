import { SALARY_PAYMENT_METHODS, type Attendance, type Payslip, type User } from '@cityreach/shared'
import { Download, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { StatusPill } from '@/components/common/StatusPill'
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
import { formatMoney } from '@/features/leave/model'
import { errorMessage } from '@/lib/errors'
import { formatMinutes } from '@/lib/format'
import { computePayslip } from '../api'
import { downloadPayslipPdf, monthLabel } from '../pdf'
import { useSavePayslip } from '../queries'

const num = (v: string) => (v.trim() === '' ? 0 : Math.max(0, Number(v) || 0))

/**
 * Manager: the month's payslip for one employee. Earnings and deductions come from their pay
 * settings and attendance; bonus and other deductions are typed in. Save as draft, or mark paid.
 */
export function PayslipDialog({
  employee,
  month,
  records,
  existing,
  shopName,
  onClose,
}: {
  employee: User
  month: string
  records: Attendance[]
  existing: Payslip | null
  shopName: string
  onClose: () => void
}) {
  const [bonus, setBonus] = useState(existing ? String(existing.bonus || '') : '')
  const [other, setOther] = useState(existing ? String(existing.otherDeductions || '') : '')
  const [note, setNote] = useState(existing?.deductionNote ?? '')
  const [method, setMethod] = useState<(typeof SALARY_PAYMENT_METHODS)[number]>(
    existing?.paymentMethod ?? 'WPS',
  )
  const [paymentRef, setPaymentRef] = useState(existing?.paymentRef ?? '')
  const save = useSavePayslip()
  const extras = {
    bonus: num(bonus),
    otherDeductions: num(other),
    deductionNote: note,
    paymentMethod: method,
    paymentRef,
  }
  const p = computePayslip(employee, records, extras)

  const submit = (paid: boolean) =>
    save.mutate(
      { employee, month, records, extras, existing, paid },
      {
        onSuccess: () => {
          toast.success(paid ? 'Payslip saved and marked as paid' : 'Payslip saved')
          onClose()
        },
        onError: (e) => toast.error(errorMessage(e)),
      },
    )

  const line = (label: string, value: string, strong = false) => (
    <div className={`flex justify-between gap-3 ${strong ? 'border-t pt-2 font-medium' : ''}`}>
      <span className={strong ? '' : 'text-muted-foreground'}>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  )

  return (
    <Dialog open onOpenChange={(o) => !o && !save.isPending && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {employee.name} · {monthLabel(month)}
            {existing && <StatusPill status={existing.status} />}
          </DialogTitle>
          <DialogDescription>
            From their pay settings and this month's attendance. Saving again recalculates it.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5 text-sm">
          {line('Basic salary', formatMoney(p.salary))}
          {line('Allowances', formatMoney(p.allowances))}
          {line(
            `Overtime (${formatMinutes(p.overtimeMinutes)} × 125 %)`,
            formatMoney(p.overtimePay),
          )}
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="bonus" className="font-normal text-muted-foreground">
              Bonus
            </Label>
            <Input
              id="bonus"
              type="number"
              inputMode="decimal"
              min={0}
              value={bonus}
              onChange={(e) => setBonus(e.target.value)}
              className="h-8 w-28 text-right"
              placeholder="0"
            />
          </div>
          {line('Gross pay', formatMoney(p.gross), true)}
          {line(
            `Unpaid leave ${p.unpaidLeaveDays} d + absences ${p.absentDays} d`,
            `− ${formatMoney(p.leaveDeduction)}`,
          )}
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="other" className="font-normal text-muted-foreground">
              Other deductions
            </Label>
            <Input
              id="other"
              type="number"
              inputMode="decimal"
              min={0}
              value={other}
              onChange={(e) => setOther(e.target.value)}
              className="h-8 w-28 text-right"
              placeholder="0"
            />
          </div>
          {num(other) > 0 && (
            <Input
              value={note}
              maxLength={200}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Reason, e.g. salary advance"
              aria-label="Reason for other deductions"
              className="h-8"
            />
          )}
          <div className="flex justify-between gap-3 border-t pt-2 text-base font-semibold">
            <span>Net pay</span>
            <span className="tabular-nums">{formatMoney(p.net)}</span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="pay-method">Paid by</Label>
            <Select value={method} onValueChange={(v) => setMethod(v as typeof method)}>
              <SelectTrigger id="pay-method" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SALARY_PAYMENT_METHODS.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pay-ref">{method === 'WPS' ? 'WPS reference' : 'Reference'}</Label>
            <Input
              id="pay-ref"
              value={paymentRef}
              maxLength={60}
              onChange={(e) => setPaymentRef(e.target.value)}
              placeholder={method === 'Cash' ? 'Optional' : 'e.g. SIF / transfer no.'}
            />
          </div>
        </div>
        {employee.salary == null && (
          <p className="rounded-lg bg-warning-soft p-3 text-sm text-warning">
            No salary set for {employee.name}. Set it on their profile (Pay & leave → Edit).
          </p>
        )}
        <DialogFooter className="flex-wrap gap-2">
          {existing && (
            <Button
              variant="outline"
              onClick={() => void downloadPayslipPdf(existing, shopName)}
              disabled={save.isPending}
            >
              <Download /> PDF
            </Button>
          )}
          <Button variant="outline" onClick={() => submit(false)} disabled={save.isPending}>
            {existing ? 'Recalculate & save' : 'Save draft'}
          </Button>
          {existing?.status !== 'paid' && (
            <Button onClick={() => submit(true)} disabled={save.isPending}>
              {save.isPending && <Loader2 className="animate-spin" />}
              Save & mark paid
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
