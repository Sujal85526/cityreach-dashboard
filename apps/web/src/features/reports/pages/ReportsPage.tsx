import {
  periodKeyOf,
  periodLabel,
  periodRange,
  previousPeriod,
  shiftDate,
  toDateKey,
  type PeriodType,
} from '@dm/shared'
import {
  Award,
  FileSpreadsheet,
  CalendarCheck,
  ChevronLeft,
  ChevronRight,
  Download,
  Gauge,
  ListChecks,
  ListX,
  Loader2,
  RefreshCw,
  Star,
  TrendingUp,
  TriangleAlert,
} from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { DataTable, type Column } from '@/components/common/DataTable'
import { EmployeeAvatar } from '@/components/common/EmployeeAvatar'
import { ErrorState } from '@/components/common/EmptyState'
import { StatCard } from '@/components/common/StatCard'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { TaskWeekChart } from '@/features/dashboard/components/TaskWeekChart'
import { useBranch } from '@/features/settings/queries'
import { errorMessage } from '@/lib/errors'
import { RateDialog } from '../components/RateDialog'
import { TrendChart } from '../components/TrendChart'
import type { ReportRow } from '../model'
import { EXPORTS, exportCsv, type ExportKind } from '../export'
import { downloadReportPdf } from '../pdf'
import { useRecalculate, useReport } from '../queries'

/** Weekly / monthly performance report (docs/PRODUCT.md §6–7), computed from the records. */
export function ReportsPage() {
  const branch = useBranch().data
  const tz = branch?.rules.timeZone ?? 'UTC'
  const today = toDateKey(new Date(), tz)
  const [type, setType] = useState<PeriodType>('weekly')
  const [keys, setKeys] = useState<Record<PeriodType, string>>({
    weekly: periodKeyOf('weekly', today),
    monthly: periodKeyOf('monthly', today),
  })
  const key = keys[type]
  const report = useReport(type, key)
  const recalc = useRecalculate()
  const [rating, setRating] = useState<ReportRow | null>(null)
  const [exporting, setExporting] = useState(false)

  const isCurrent = key === periodKeyOf(type, today)
  const next = periodKeyOf(type, shiftDate(periodRange(type, key).to, 1))
  const move = (k: string) => setKeys((s) => ({ ...s, [type]: k }))
  const r = report.data

  const exportPdf = async () => {
    if (!r || !branch) return
    setExporting(true)
    try {
      await downloadReportPdf(r, {
        type,
        key,
        shopName: branch.name,
        weights: branch.rules.performance,
      })
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setExporting(false)
    }
  }

  const exportData = async (kind: ExportKind) => {
    if (!branch) return
    try {
      await exportCsv(kind, type, key, branch)
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  const columns: Column<ReportRow>[] = [
    {
      key: 'employee',
      header: 'Employee',
      className: 'whitespace-normal',
      cell: (row) => (
        <div className="flex items-center gap-3">
          <EmployeeAvatar
            name={row.employee.name}
            id={row.employee.id}
            className="hidden sm:flex"
          />
          <div>
            <div className="font-medium">{row.employee.name}</div>
            <div className="text-xs text-muted-foreground">{row.employee.position}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'score',
      header: 'Performance',
      cell: (row) => (
        <div className="flex w-20 items-center gap-2 sm:w-32">
          <Progress value={row.score} className="h-1.5" />
          <span className="w-8 text-right text-sm tabular-nums">{row.score}</span>
        </div>
      ),
    },
    {
      key: 'att',
      header: 'Attendance',
      className: 'hidden sm:table-cell',
      cell: (row) => `${row.attendancePct}%`,
    },
    {
      key: 'done',
      header: 'Tasks done',
      className: 'hidden md:table-cell',
      cell: (row) =>
        row.tasksMissed ? `${row.tasksDone} (${row.tasksMissed} missed)` : row.tasksDone,
    },
    {
      key: 'late',
      header: 'Late arrivals',
      className: 'hidden md:table-cell',
      cell: (row) => row.lateArrivals,
    },
    {
      key: 'comment',
      header: 'Manager comment',
      className: 'hidden xl:table-cell whitespace-normal max-w-64',
      cell: (row) => (
        <span className="text-sm text-muted-foreground">
          {row.rating !== null && (
            <span className="mr-1 font-medium text-foreground">
              {Number(row.rating.toFixed(1))}★
            </span>
          )}
          {row.comment ?? (row.rating === null ? '—' : '')}
        </span>
      ),
    },
    ...(type === 'weekly'
      ? [
          {
            key: 'rate',
            header: '',
            className: 'w-12 text-right sm:w-16',
            cell: (row: ReportRow) => (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setRating(row)}
                aria-label={`Rate ${row.employee.name}`}
              >
                <Star /> <span className="hidden xl:inline">Rate</span>
              </Button>
            ),
          },
        ]
      : []),
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Performance reports</h2>
          <p className="text-sm text-muted-foreground">
            Rule-based scores from attendance, punctuality, tasks and your ratings.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() =>
              recalc.mutate(undefined, {
                onSuccess: () => toast.success('Scores recalculated'),
                onError: (e) => toast.error(errorMessage(e)),
              })
            }
            disabled={recalc.isPending}
          >
            {recalc.isPending ? <Loader2 className="animate-spin" /> : <RefreshCw />} Recalculate
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" disabled={!branch}>
                <FileSpreadsheet /> Export CSV
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Raw data for {periodLabel(type, key)}</DropdownMenuLabel>
              {(Object.keys(EXPORTS) as ExportKind[]).map((kind) => (
                <DropdownMenuItem key={kind} onSelect={() => void exportData(kind)}>
                  {EXPORTS[kind]}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button onClick={exportPdf} disabled={!r || exporting}>
            {exporting ? <Loader2 className="animate-spin" /> : <Download />} Download PDF
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={type} onValueChange={(v) => setType(v as PeriodType)}>
          <TabsList>
            <TabsTrigger value="weekly">Weekly report</TabsTrigger>
            <TabsTrigger value="monthly">Monthly report</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Previous period"
            onClick={() => move(previousPeriod(type, key))}
          >
            <ChevronLeft />
          </Button>
          <span className="min-w-44 text-center text-sm font-medium" aria-live="polite">
            {periodLabel(type, key)}
            {isCurrent && <span className="text-muted-foreground"> (so far)</span>}
          </span>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Next period"
            disabled={isCurrent}
            onClick={() => move(next)}
          >
            <ChevronRight />
          </Button>
        </div>
      </div>

      {report.error ? (
        <ErrorState error={report.error} onRetry={() => void report.refetch()} />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Performance score"
              icon={Gauge}
              loading={!r}
              value={r?.summary.averageScore != null ? `${r.summary.averageScore} / 100` : '—'}
              caption="Team average"
            />
            <StatCard
              label="Attendance"
              icon={CalendarCheck}
              loading={!r}
              value={`${r?.summary.attendancePct ?? 0}%`}
              caption={
                r
                  ? `${r.summary.lateArrivals} late arrivals · ${r.summary.absences} absences`
                  : undefined
              }
            />
            <StatCard
              label="Tasks completed"
              icon={ListChecks}
              loading={!r}
              value={r?.summary.tasksCompleted ?? 0}
              caption="On or before the deadline"
            />
            <StatCard
              label="Tasks missed"
              icon={ListX}
              loading={!r}
              value={r?.summary.tasksMissed ?? 0}
              caption={r ? `${r.summary.inventoryAlerts} stock alerts in this period` : undefined}
              badge={
                r?.summary.tasksMissed ? { text: 'Overdue or late', tone: 'danger' } : undefined
              }
            />
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <Highlight
              icon={Award}
              tone="text-success"
              title="Top performer"
              row={r?.highlights.top}
              loading={!r}
              detail={(x) => `${x.score}/100 · ${x.attendancePct}% attendance`}
            />
            <Highlight
              icon={TrendingUp}
              tone="text-info"
              title="Most improved"
              row={r?.highlights.improved}
              loading={!r}
              detail={(x) =>
                `+${'delta' in x ? String(x.delta) : ''} points vs the previous ${type === 'weekly' ? 'week' : 'month'}`
              }
            />
            <Highlight
              icon={TriangleAlert}
              tone="text-warning"
              title="Needs improvement"
              row={r?.highlights.attention}
              loading={!r}
              detail={(x) => `${x.score}/100${x.weakest ? ` · lowest on ${x.weakest}` : ''}`}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Performance trend (8 weeks)</CardTitle>
              </CardHeader>
              <CardContent>
                {r ? <TrendChart data={r.trend} /> : <Skeleton className="h-56" />}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Task completion</CardTitle>
              </CardHeader>
              <CardContent>
                {r ? (
                  <TaskWeekChart
                    data={r.taskChart.map((d) => ({
                      day: d.label,
                      completed: d.completed,
                      pending: d.missed,
                    }))}
                    pendingLabel="Missed"
                  />
                ) : (
                  <Skeleton className="h-56" />
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Employee report card</CardTitle>
            </CardHeader>
            <CardContent>
              <DataTable
                columns={columns}
                rows={r?.rows}
                rowKey={(row) => row.employee.id}
                loading={!r}
              />
            </CardContent>
          </Card>
        </>
      )}
      {type === 'weekly' && <RateDialog row={rating} week={key} onClose={() => setRating(null)} />}
    </div>
  )
}

function Highlight<T extends ReportRow>({
  icon: Icon,
  tone,
  title,
  row,
  loading,
  detail,
}: {
  icon: typeof Award
  tone: string
  title: string
  row: T | null | undefined
  loading: boolean
  detail: (row: T) => string
}) {
  return (
    <Card className="gap-2 p-5">
      <div className={`flex items-center gap-2 text-sm font-medium ${tone}`}>
        <Icon className="size-4" /> {title}
      </div>
      {loading ? (
        <Skeleton className="h-10 w-40" />
      ) : row ? (
        <div className="flex items-center gap-3">
          <EmployeeAvatar
            name={row.employee.name}
            id={row.employee.id}
            className="hidden sm:flex"
          />
          <div>
            <div className="font-medium">{row.employee.name}</div>
            <div className="text-xs text-muted-foreground">{detail(row)}</div>
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Not enough data for this period.</p>
      )}
    </Card>
  )
}
