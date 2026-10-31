import type { Payslip, User } from '@cityreach/shared'
import { Download, FileText, Wallet } from 'lucide-react'
import { useState } from 'react'
import { DataTable, type Column } from '@/components/common/DataTable'
import { EmptyState, ErrorState } from '@/components/common/EmptyState'
import { PageHeader } from '@/components/common/PageHeader'
import { StatusPill } from '@/components/common/StatusPill'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAttendanceRange } from '@/features/attendance/queries'
import { computePayslip } from '@/features/payslips/api'
import { PayslipDialog } from '@/features/payslips/components/PayslipDialog'
import { useMonthPayslips } from '@/features/payslips/queries'
import { useBranch } from '@/features/settings/queries'
import { downloadCsv, toCsv } from '@/lib/csv'
import { formatMinutes } from '@/lib/format'
import { formatMoney } from '../model'

interface PayRow {
  employee: User
  salary: number | null
  allowances: number
  overtimeMinutes: number
  overtimePay: number
  unpaidLeaveDays: number
  absentDays: number
  deductions: number
  net: number | null
  payslip: Payslip | null
}

/**
 * The month's pay for every active employee: basic + allowances + overtime (+ bonus on the
 * payslip) − unpaid leave and absences (salary ÷ 30 a day) − other deductions. A saved payslip's
 * figures are shown as saved; otherwise the live estimate. Absences count once the automatic
 * check has saved them (it runs when a manager opens the app).
 */
export function PayTable({
  employees,
  month,
  onMonth,
  maxMonth,
}: {
  employees: User[]
  month: string
  onMonth: (month: string) => void
  maxMonth: string
}) {
  const records = useAttendanceRange(`${month}-01`, `${month}-31`)
  const payslips = useMonthPayslips(month)
  const shopName = useBranch().data?.name ?? 'Digital Manager'
  const [open, setOpen] = useState<User | null>(null)

  const error = records.error ?? payslips.error
  if (error) return <ErrorState error={error} onRetry={() => void records.refetch()} />

  const rows: PayRow[] | undefined =
    records.data && payslips.data
      ? employees
          .filter((e) => e.status !== 'inactive')
          .map((employee) => {
            const saved = payslips.data.find((s) => s.employeeId === employee.id) ?? null
            if (saved)
              return {
                employee,
                salary: saved.salary,
                allowances: saved.allowances,
                overtimeMinutes: saved.overtimeMinutes,
                overtimePay: saved.overtimePay,
                unpaidLeaveDays: saved.unpaidLeaveDays,
                absentDays: saved.absentDays,
                deductions: saved.leaveDeduction + saved.otherDeductions,
                net: saved.net,
                payslip: saved,
              }
            const p = computePayslip(employee, records.data, {
              bonus: 0,
              otherDeductions: 0,
              deductionNote: '',
              paymentMethod: 'WPS',
              paymentRef: '',
            })
            return {
              employee,
              salary: employee.salary ?? null,
              allowances: p.allowances,
              overtimeMinutes: p.overtimeMinutes,
              overtimePay: p.overtimePay,
              unpaidLeaveDays: p.unpaidLeaveDays,
              absentDays: p.absentDays,
              deductions: p.deductions,
              net: employee.salary == null ? null : p.net,
              payslip: null,
            }
          })
          .sort((a, b) => a.employee.name.localeCompare(b.employee.name))
      : undefined

  const money = (n: number | null) => (n === null ? '—' : formatMoney(n))
  const columns: Column<PayRow>[] = [
    {
      key: 'name',
      header: 'Employee',
      cell: (r) => <span className="font-medium">{r.employee.name}</span>,
    },
    {
      key: 'salary',
      header: 'Basic',
      cell: (r) => (r.salary === null ? 'Not set' : money(r.salary)),
    },
    {
      key: 'allowances',
      header: 'Allowances',
      className: 'hidden lg:table-cell',
      cell: (r) => money(r.allowances),
    },
    {
      key: 'overtime',
      header: 'Overtime',
      className: 'hidden lg:table-cell',
      cell: (r) =>
        r.overtimeMinutes ? (
          <span>
            {money(r.overtimePay)}
            <span className="text-xs text-muted-foreground">
              {' '}
              ({formatMinutes(r.overtimeMinutes)})
            </span>
          </span>
        ) : (
          '—'
        ),
    },
    {
      key: 'days',
      header: 'Unpaid / absent',
      className: 'hidden md:table-cell',
      cell: (r) => `${r.unpaidLeaveDays} / ${r.absentDays} d`,
    },
    {
      key: 'deductions',
      header: 'Deductions',
      className: 'hidden md:table-cell',
      cell: (r) => (r.deductions ? `− ${money(r.deductions)}` : money(0)),
    },
    {
      key: 'net',
      header: 'Net pay',
      cell: (r) => <span className="font-medium">{money(r.net)}</span>,
    },
    {
      key: 'payslip',
      header: 'Payslip',
      className: 'text-right',
      cell: (r) => (
        <div className="flex items-center justify-end gap-2">
          {r.payslip && <StatusPill status={r.payslip.status} />}
          <Button
            size="sm"
            variant={r.payslip ? 'outline' : 'default'}
            onClick={() => setOpen(r.employee)}
          >
            <FileText /> {r.payslip ? 'Open' : 'Prepare'}
          </Button>
        </div>
      ),
    },
  ]

  const exportCsv = () =>
    rows &&
    downloadCsv(
      `digital-manager_pay_${month}.csv`,
      toCsv(
        [
          'month',
          'employee',
          'basic_salary',
          'allowances',
          'overtime_minutes',
          'overtime_pay',
          'unpaid_leave_days',
          'absent_days',
          'deductions',
          'net_pay',
          'payslip_status',
        ],
        rows.map((r) => [
          month,
          r.employee.name,
          r.salary,
          r.allowances,
          r.overtimeMinutes,
          r.overtimePay,
          r.unpaidLeaveDays,
          r.absentDays,
          r.deductions,
          r.net,
          r.payslip?.status ?? 'not prepared',
        ]),
      ),
    )

  return (
    <div className="space-y-4">
      <PageHeader
        title="Pay & payslips"
        description="Basic + allowances + overtime (125 %) − unpaid leave and absences (salary ÷ 30 a day). Prepare each payslip, then mark it paid; employees see their own."
        actions={
          <>
            <Input
              type="month"
              value={month}
              max={maxMonth}
              onChange={(e) => e.target.value && onMonth(e.target.value)}
              className="w-auto"
              aria-label="Month"
            />
            <Button variant="outline" onClick={exportCsv} disabled={!rows}>
              <Download /> CSV
            </Button>
          </>
        }
      />
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(r) => r.employee.id}
        loading={!rows}
        empty={<EmptyState icon={Wallet} title="No active employees" />}
      />
      {open && records.data && (
        <PayslipDialog
          employee={open}
          month={month}
          records={records.data}
          existing={payslips.data?.find((s) => s.employeeId === open.id) ?? null}
          shopName={shopName}
          onClose={() => setOpen(null)}
        />
      )}
    </div>
  )
}
