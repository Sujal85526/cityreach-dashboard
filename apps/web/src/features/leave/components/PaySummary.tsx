import { monthlyPay, payFacts, type Attendance } from '@dm/shared'
import { plural, formatMoney } from '../model'

/**
 * Salary for a month minus unpaid leave and absences (salary ÷ 30 per day). An estimate for the
 * manager and the employee, not a payslip.
 */
export function PaySummary({ salary, records }: { salary: number; records: Attendance[] }) {
  const { unpaidLeaveDays, absentDays } = payFacts(records)
  const pay = monthlyPay(salary, unpaidLeaveDays, absentDays)
  const rows: [string, string][] = [
    ['Monthly salary', formatMoney(salary)],
    ['Unpaid leave', plural(unpaidLeaveDays, 'day')],
    ['Absences', plural(absentDays, 'day')],
    [
      `Deduction (${formatMoney(pay.dailyRate)} a day)`,
      pay.deduction ? `− ${formatMoney(pay.deduction)}` : formatMoney(0),
    ],
  ]
  return (
    <dl className="space-y-1.5 text-sm">
      {rows.map(([label, value]) => (
        <div key={label} className="flex justify-between gap-3">
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="tabular-nums">{value}</dd>
        </div>
      ))}
      <div className="flex justify-between gap-3 border-t pt-2 font-medium">
        <dt>Estimated pay</dt>
        <dd className="tabular-nums">{formatMoney(pay.net)}</dd>
      </div>
    </dl>
  )
}
