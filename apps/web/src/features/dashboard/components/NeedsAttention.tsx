import type { Candidate, Equipment, Incident, PurchaseOrder, TemperatureLog } from '@cityreach/shared'
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  FileWarning,
  Landmark,
  ListTodo,
  Repeat,
  ShieldAlert,
  Thermometer,
  TimerOff,
  UserCheck,
  UserPlus,
  Wallet,
  Wrench,
  type LucideIcon,
} from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useDocuments } from '@/features/documents/queries'
import { useEmployees } from '@/features/employees/queries'
import { useBranchLeave } from '@/features/leave/queries'
import { useMonthPayslips } from '@/features/payslips/queries'
import { useRecords } from '@/features/records/queries'
import { useSwaps } from '@/features/rota/queries'
import { useBranch } from '@/features/settings/queries'
import { cn } from '@/lib/utils'
import { attentionItems, type AttentionKind } from '../attention'

const ICON: Record<AttentionKind, LucideIcon> = {
  leave: CalendarDays,
  swap: Repeat,
  document: FileWarning,
  stock: AlertTriangle,
  task: ListTodo,
  absence: TimerOff,
  temperature: Thermometer,
  incident: ShieldAlert,
  equipment: Wrench,
  invoice: CreditCard,
  vat: Landmark,
  payslip: Wallet,
  probation: UserCheck,
  interview: UserPlus,
}
const TONE = {
  danger: 'bg-danger-soft text-danger',
  warning: 'bg-warning-soft text-warning',
  info: 'bg-info-soft text-info',
}

/**
 * What the manager should deal with first, in one place (see attention.ts for the rules). Each
 * line links to where it's handled; "All clear" when there is nothing to do.
 */
export function NeedsAttention({
  today,
  absent,
  overdueTasks,
  lowStock,
  criticalStock,
}: {
  today: string
  absent: number | null
  overdueTasks: number | null
  lowStock: number | null
  criticalStock: number
}) {
  const [showAll, setShowAll] = useState(false)
  const branch = useBranch().data
  const leave = useBranchLeave()
  const swaps = useSwaps()
  const docs = useDocuments()
  const employees = useEmployees()
  const payslips = useMonthPayslips(today.slice(0, 7))
  const incidents = useRecords<Incident>('incidents')
  const temperatures = useRecords<TemperatureLog>('temperatureLogs')
  const equipment = useRecords<Equipment>('equipment')
  const orders = useRecords<PurchaseOrder>('purchaseOrders')
  const candidates = useRecords<Candidate>('candidates')

  const ready =
    branch &&
    leave.data &&
    swaps.data &&
    docs.data &&
    employees.data &&
    payslips.data &&
    incidents.data &&
    temperatures.data &&
    equipment.data &&
    orders.data &&
    candidates.data &&
    absent !== null &&
    overdueTasks !== null &&
    lowStock !== null
  const items = ready
    ? attentionItems({
        today,
        branch,
        leave: leave.data,
        swaps: swaps.data,
        documents: docs.data,
        employees: employees.data,
        payslips: payslips.data,
        incidents: incidents.data,
        temperatures: temperatures.data,
        equipment: equipment.data,
        orders: orders.data,
        candidates: candidates.data,
        absent,
        overdueTasks,
        lowStock,
        criticalStock,
      })
    : []

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Needs your attention</CardTitle>
      </CardHeader>
      <CardContent>
        {!ready ? (
          <Skeleton className="h-20 w-full" />
        ) : items.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-success">
            <CheckCircle2 className="size-4" aria-hidden /> All clear: nothing needs you right now.
          </div>
        ) : (
          <ul className="grid gap-2 md:grid-cols-2">
            {(showAll ? items : items.slice(0, 6)).map((item) => {
              const Icon = ICON[item.kind]
              return (
                <li key={item.text}>
                  <Link
                    to={item.to}
                    className="group flex items-center gap-3 rounded-xl border p-3 text-sm transition-colors hover:border-primary/30 hover:bg-muted/50"
                  >
                    <span
                      className={cn(
                        'flex size-9 shrink-0 items-center justify-center rounded-xl',
                        TONE[item.tone],
                      )}
                    >
                      <Icon className="size-4" aria-hidden />
                    </span>
                    <span className="flex-1">{item.text}</span>
                    <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
        {ready && items.length > 6 && (
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="mt-3 text-sm font-medium text-primary hover:underline"
          >
            {showAll ? 'Show fewer' : `Show ${items.length - 6} more`}
          </button>
        )}
      </CardContent>
    </Card>
  )
}
