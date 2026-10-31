import {
  monthEnd,
  monthProfit,
  nextVatDue,
  salesTotal,
  type Branch,
  type Expense,
  type SalesDay,
} from '@cityreach/shared'
import { where } from '@/lib/store'
import { Landmark, Receipt, TrendingUp, Users, Wallet } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { StatCard } from '@/components/common/StatCard'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useMonthPayslips } from '@/features/payslips/queries'
import { RecordList } from '@/features/records/components/RecordList'
import { useRecords } from '@/features/records/queries'
import { useBranch, useUpdateBranch } from '@/features/settings/queries'
import { useToday } from '@/hooks/use-today'
import { errorMessage } from '@/lib/errors'
import { formatDay, formatMoney } from '@/lib/format'
import { expensesModule, salesModule } from '../modules'

/** UK VAT is 20 %; sales prices include it, so the VAT in a sale is 20/120 of it. */
const VAT_IN_PRICE = 20 / 120

/**
 * Manager: the month's money at a glance (sales, expenses, payroll, profit, VAT estimate),
 * the next VAT return date, and the daily sales and expenses lists.
 */
export function FinancePage() {
  const today = useToday()
  const [month, setMonth] = useState(today.slice(0, 7))
  const range = [where('date', '>=', `${month}-01`), where('date', '<=', monthEnd(month))]
  const sales = useRecords<SalesDay>('salesDays', {
    key: month,
    filters: range,
    // Matches the (branchId, date ASC) index; the order doesn't matter for month totals.
    orderField: 'date',
    direction: 'asc',
  })
  const expenses = useRecords<Expense>('expenses', {
    key: month,
    filters: range,
    // Matches the (branchId, date ASC) index; the order doesn't matter for month totals.
    orderField: 'date',
    direction: 'asc',
  })
  const payslips = useMonthPayslips(month)
  const branch = useBranch().data

  const loading = !sales.data || !expenses.data || !payslips.data
  const salesSum = (sales.data ?? []).reduce((s, d) => s + salesTotal(d), 0)
  const expenseSum = (expenses.data ?? []).reduce((s, e) => s + e.amount, 0)
  const payroll = (payslips.data ?? []).reduce((s, p) => s + p.net, 0)
  const { profit, margin } = monthProfit({ sales: salesSum, expenses: expenseSum, payroll })
  const vatOut = salesSum * VAT_IN_PRICE
  const vatIn = (expenses.data ?? []).reduce((s, e) => s + e.vat, 0)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Sales & finance</h2>
          <p className="text-sm text-muted-foreground">
            Payroll is the net pay of the month's payslips.
          </p>
        </div>
        <Input
          type="month"
          value={month}
          max={today.slice(0, 7)}
          onChange={(e) => e.target.value && setMonth(e.target.value)}
          className="w-auto"
          aria-label="Month"
        />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard
          label="Sales"
          icon={Wallet}
          loading={loading}
          value={formatMoney(salesSum)}
          caption={`${sales.data?.length ?? 0} days entered`}
        />
        <StatCard
          label="Expenses"
          icon={Receipt}
          loading={loading}
          value={formatMoney(expenseSum)}
          caption={`${expenses.data?.length ?? 0} expenses`}
        />
        <StatCard
          label="Payroll"
          icon={Users}
          loading={loading}
          value={formatMoney(payroll)}
          caption={`${payslips.data?.length ?? 0} payslips`}
        />
        <StatCard
          label="Profit"
          icon={TrendingUp}
          loading={loading}
          value={formatMoney(profit)}
          caption={margin === null ? 'No sales yet' : `${margin} % of sales`}
          badge={profit < 0 ? { text: 'Loss', tone: 'danger' } : undefined}
        />
      </div>

      {branch && (
        <VatCard branch={branch} today={today} vatOut={vatOut} vatIn={vatIn} loading={loading} />
      )}

      <Tabs defaultValue="sales">
        <TabsList>
          <TabsTrigger value="sales">Daily sales</TabsTrigger>
          <TabsTrigger value="expenses">Expenses</TabsTrigger>
        </TabsList>
        <TabsContent value="sales">
          <Card>
            <CardContent className="pt-6">
              <RecordList module={salesModule(today)} />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="expenses">
          <Card>
            <CardContent className="pt-6">
              <RecordList module={expensesModule(today)} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

/** VAT estimate for the month and the next return date (28 days after each period ends). */
function VatCard({
  branch,
  today,
  vatOut,
  vatIn,
  loading,
}: {
  branch: Branch
  today: string
  vatOut: number
  vatIn: number
  loading: boolean
}) {
  const vat = branch.vat ?? null
  const [editing, setEditing] = useState(false)
  const [periodEnd, setPeriodEnd] = useState(vat?.periodEnd ?? `${today.slice(0, 4)}-03`)
  const [months, setMonths] = useState<1 | 3>(vat?.months ?? 3)
  const update = useUpdateBranch()

  const save = (registered: boolean) =>
    update.mutate(
      { patch: { vat: registered ? { periodEnd, months } : null }, what: 'VAT settings' },
      {
        onSuccess: () => {
          toast.success('VAT settings saved')
          setEditing(false)
        },
        onError: (e) => toast.error(errorMessage(e)),
      },
    )

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Landmark className="size-4" /> VAT
        </CardTitle>
        <Button variant="outline" size="sm" onClick={() => setEditing(!editing)}>
          {vat ? 'Change' : 'Set up'}
        </Button>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {vat ? (
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <div className="text-muted-foreground">Next return due</div>
              <div className="text-lg font-semibold">
                {formatDay(nextVatDue(today, vat.periodEnd, vat.months))}
              </div>
              <div className="text-xs text-muted-foreground">
                {vat.months === 3 ? 'Quarterly' : 'Monthly'} periods, due 28 days after each ends
              </div>
            </div>
            <div>
              <div className="text-muted-foreground">This month (estimate)</div>
              <div className="text-lg font-semibold">
                {loading ? '…' : formatMoney(Math.round((vatOut - vatIn) * 100) / 100)}
              </div>
              <div className="text-xs text-muted-foreground">
                VAT in sales {formatMoney(Math.round(vatOut * 100) / 100)} − VAT on expenses{' '}
                {formatMoney(vatIn)}
              </div>
            </div>
          </div>
        ) : (
          <p className="text-muted-foreground">
            Not set up. If the shop is VAT registered, add its tax periods to see the next return
            date here and on the calendar.
          </p>
        )}
        {editing && (
          <div className="flex flex-wrap items-end gap-3 rounded-lg border p-3">
            <div className="space-y-1.5">
              <Label htmlFor="vat-end">A period ends in</Label>
              <Input
                id="vat-end"
                type="month"
                value={periodEnd}
                onChange={(e) => e.target.value && setPeriodEnd(e.target.value)}
                className="w-auto"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="vat-months">Period length</Label>
              <select
                id="vat-months"
                value={months}
                onChange={(e) => setMonths(Number(e.target.value) as 1 | 3)}
                className="h-9 rounded-md border bg-transparent px-3 text-sm"
              >
                <option value={3}>Quarterly</option>
                <option value={1}>Monthly</option>
              </select>
            </div>
            <Button onClick={() => save(true)} disabled={update.isPending}>
              Save
            </Button>
            {vat && (
              <Button variant="ghost" onClick={() => save(false)} disabled={update.isPending}>
                Not VAT registered
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
