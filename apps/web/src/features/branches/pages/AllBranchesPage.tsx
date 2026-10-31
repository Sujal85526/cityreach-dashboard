import { branchTotals, labourLevel, type Branch, type BranchSummary } from '@cityreach/shared'
import { AlertTriangle, Building2, Loader2, TrendingUp, Users, Wallet } from 'lucide-react'
import { Link } from 'react-router'
import { EmptyState, ErrorState } from '@/components/common/EmptyState'
import { StatCard } from '@/components/common/StatCard'
import { TonePill, type Tone } from '@/components/common/StatusPill'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useCurrentUser } from '@/features/auth/session'
import { errorMessage } from '@/lib/errors'
import { formatMoney } from '@/lib/format'
import { toast } from 'sonner'
import { useBranchSummaries, useMyBranches, useOpenBranch } from '../queries'

const LABOUR_TONE: Record<string, Tone> = { good: 'success', watch: 'warning', high: 'danger' }

/** Owner: every branch side by side, this month's money and today's state. Read only. */
export function AllBranchesPage() {
  const actor = useCurrentUser()
  const branches = useMyBranches()
  const summaries = useBranchSummaries(branches.data ?? [])
  const open = useOpenBranch()

  if (actor.access.role !== 'owner')
    return (
      <EmptyState
        icon={Building2}
        title="For owners"
        description="All branches is only for the owner. Switch to the Owner role from the account menu to see every branch together."
        action={
          <Button variant="outline" asChild>
            <Link to="/">Back to dashboard</Link>
          </Button>
        }
      />
    )
  if (branches.error)
    return <ErrorState error={branches.error} onRetry={() => void branches.refetch()} />
  if (!branches.data) return <Skeleton className="h-64 w-full rounded-xl" />

  const loaded = summaries.flatMap((s) => (s.data ? [s.data] : []))
  const loading = loaded.length < branches.data.length && summaries.some((s) => s.isPending)
  const totals = branchTotals(loaded)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">All branches</h2>
        <p className="text-sm text-muted-foreground">
          This month's money and today's state for each of your {branches.data.length} branches.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
        <StatCard
          label="Sales this month"
          icon={Wallet}
          loading={loading}
          value={formatMoney(Math.round(totals.sales))}
          caption="All branches"
        />
        <StatCard
          label="Profit this month"
          icon={TrendingUp}
          loading={loading}
          value={formatMoney(Math.round(totals.profit))}
          caption={totals.margin === null ? 'No sales yet' : `${totals.margin} % of sales`}
          badge={totals.profit < 0 ? { text: 'Loss', tone: 'danger' } : undefined}
        />
        <StatCard
          label="Staff in today"
          icon={Users}
          loading={loading}
          value={`${totals.present} / ${totals.staff}`}
          caption={`${totals.absent} absent`}
        />
        <StatCard
          label="Needs attention"
          icon={AlertTriangle}
          loading={loading}
          value={totals.overdueTasks + totals.lowStock + totals.pendingLeave}
          caption={`${totals.overdueTasks} overdue tasks, ${totals.lowStock} low stock, ${totals.pendingLeave} leave`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {branches.data.map((branch, i) => (
          <BranchCard
            key={branch.id}
            branch={branch}
            isCurrent={branch.id === actor.access.branchId}
            summary={summaries[i]?.data}
            error={summaries[i]?.error ?? null}
            onRetry={() => void summaries[i]?.refetch()}
            opening={open.isPending && open.variables === branch.id}
            onOpen={() => open.mutate(branch.id, { onError: (e) => toast.error(errorMessage(e)) })}
          />
        ))}
      </div>
    </div>
  )
}

function BranchCard({
  branch,
  isCurrent,
  summary,
  error,
  onRetry,
  opening,
  onOpen,
}: {
  branch: Branch
  isCurrent: boolean
  summary: BranchSummary | undefined
  error: Error | null
  onRetry: () => void
  opening: boolean
  onOpen: () => void
}) {
  const labour = LABOUR_TONE[labourLevel(summary?.labourPercent ?? null)]
  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <CardTitle>{branch.name}</CardTitle>
          <CardDescription>{branch.address}</CardDescription>
        </div>
        {isCurrent ? (
          <TonePill tone="success">Open now</TonePill>
        ) : (
          <Button variant="outline" size="sm" onClick={onOpen} disabled={opening}>
            {opening && <Loader2 className="animate-spin" />} Switch to it
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {error ? (
          <ErrorState error={error} onRetry={onRetry} />
        ) : !summary ? (
          <Skeleton className="h-32 w-full" />
        ) : (
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
            <Figure label="Sales" value={formatMoney(Math.round(summary.sales))} />
            <Figure label="Profit" value={formatMoney(Math.round(summary.profit))} />
            <Figure
              label="Staff cost"
              value={
                summary.labourPercent === null ? (
                  '—'
                ) : labour ? (
                  <TonePill tone={labour}>{summary.labourPercent} % of sales</TonePill>
                ) : (
                  `${summary.labourPercent} %`
                )
              }
            />
            <Figure label="In today" value={`${summary.present} / ${summary.staff}`} />
            <Figure label="Absent / late" value={`${summary.absent} / ${summary.late}`} />
            <Figure
              label="Open tasks"
              value={`${summary.openTasks} (${summary.overdueTasks} overdue)`}
            />
            <Figure label="Low stock" value={summary.lowStock} />
            <Figure label="Leave to review" value={summary.pendingLeave} />
          </dl>
        )}
      </CardContent>
    </Card>
  )
}

function Figure({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  )
}
