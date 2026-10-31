import { Download, FileText } from 'lucide-react'
import { EmptyState, ErrorState } from '@/components/common/EmptyState'
import { StatusPill } from '@/components/common/StatusPill'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { formatMoney } from '@/features/leave/model'
import { useBranch } from '@/features/settings/queries'
import { downloadPayslipPdf, monthLabel } from '../pdf'
import { useMyPayslips } from '../queries'

/** Employee: their saved payslips, newest first, each as a PDF. */
export function MyPayslips() {
  const slips = useMyPayslips()
  const shopName = useBranch().data?.name ?? 'Digital Manager'
  if (slips.error) return <ErrorState error={slips.error} />
  if (!slips.data) return <Skeleton className="h-24 w-full" />
  if (slips.data.length === 0)
    return (
      <EmptyState
        icon={FileText}
        title="No payslips yet"
        description="Your manager prepares them each month."
      />
    )
  return (
    <ul className="divide-y">
      {slips.data.map((s) => (
        <li key={s.id} className="flex items-center justify-between gap-3 py-3 text-sm">
          <div>
            <div className="font-medium">{monthLabel(s.month)}</div>
            <div className="text-xs text-muted-foreground">Net pay {formatMoney(s.net)}</div>
          </div>
          <div className="flex items-center gap-2">
            <StatusPill status={s.status} />
            <Button
              variant="outline"
              size="sm"
              className="h-9"
              onClick={() => void downloadPayslipPdf(s, shopName)}
            >
              <Download /> PDF
            </Button>
          </div>
        </li>
      ))}
    </ul>
  )
}
