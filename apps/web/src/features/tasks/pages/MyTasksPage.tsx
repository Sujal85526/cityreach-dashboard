import { canEmployeeMoveTask, displayTaskStatus, type Task, type TaskStatus } from '@dm/shared'
import { CalendarClock, Check, ListChecks, Loader2, Play } from 'lucide-react'
import { toast } from 'sonner'
import { EmptyState, ErrorState } from '@/components/common/EmptyState'
import { StatusPill } from '@/components/common/StatusPill'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useBranch } from '@/features/settings/queries'
import { errorMessage } from '@/lib/errors'
import { formatDue } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useMoveTask, useMyTasks } from '../queries'

const DONE_DAYS = 7

/** Employee's tasks (phone-first): To do / In progress / Done, with Start and Complete buttons. */
export function MyTasksPage() {
  const tasks = useMyTasks()
  const branch = useBranch().data
  const move = useMoveTask()

  if (tasks.error) return <ErrorState error={tasks.error} />
  if (tasks.isPending || !branch) return <Skeleton className="mx-auto h-72 max-w-md rounded-xl" />

  const now = new Date()
  const tz = branch.rules.timeZone
  const withStatus = (tasks.data ?? []).map((task) => ({
    task,
    status: displayTaskStatus(task.status, task.deadline, now),
  }))
  const byDeadline = (a: { task: Task }, b: { task: Task }) =>
    a.task.deadline.getTime() - b.task.deadline.getTime()
  const groups = [
    {
      title: 'To do',
      items: withStatus
        .filter((i) => i.status === 'pending' || i.status === 'overdue')
        .sort(byDeadline),
    },
    {
      title: 'In progress',
      items: withStatus.filter((i) => i.status === 'in_progress').sort(byDeadline),
    },
    {
      title: 'Done recently',
      items: withStatus.filter(
        (i) =>
          i.status === 'completed' &&
          (i.task.completedAt?.getTime() ?? 0) > now.getTime() - DONE_DAYS * 86_400_000,
      ),
    },
  ]

  const doMove = (task: Task, to: TaskStatus) =>
    move.mutate(
      { task, to, branch },
      {
        onSuccess: () =>
          toast.success(to === 'completed' ? 'Nice work! Task completed.' : 'Task started'),
        onError: (e) => toast.error(errorMessage(e)),
      },
    )

  if (withStatus.length === 0)
    return (
      <div className="mx-auto max-w-md">
        <EmptyState
          icon={ListChecks}
          title="No tasks yet"
          description="Tasks your manager assigns you appear here."
        />
      </div>
    )

  return (
    <div className="mx-auto max-w-md space-y-4">
      {groups.map((g) => (
        <Card key={g.title}>
          <CardHeader>
            <CardTitle className="text-base">
              {g.title}{' '}
              <span className="font-normal text-muted-foreground">({g.items.length})</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {g.items.length === 0 && <p className="text-sm text-muted-foreground">Nothing here.</p>}
            {g.items.map(({ task, status }) => {
              const pending = move.isPending && move.variables?.task.id === task.id
              return (
                <div key={task.id} className="space-y-2 rounded-lg border p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-medium">{task.title}</div>
                      {task.description && (
                        <p className="text-sm text-muted-foreground">{task.description}</p>
                      )}
                    </div>
                    <StatusPill status={status} />
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <StatusPill status={task.priority} />
                    <span>{task.category}</span>
                    <span
                      className={cn(
                        'flex items-center gap-1',
                        status === 'overdue' && 'text-danger',
                      )}
                    >
                      <CalendarClock className="size-3.5" /> {formatDue(task.deadline, tz)}
                    </span>
                  </div>
                  {status !== 'completed' && (
                    <div className="flex gap-2">
                      {canEmployeeMoveTask(task.status, 'in_progress') && status !== 'overdue' && (
                        <Button
                          variant="outline"
                          className="h-11 flex-1"
                          disabled={pending}
                          onClick={() => doMove(task, 'in_progress')}
                        >
                          <Play /> Start
                        </Button>
                      )}
                      <Button
                        className="h-11 flex-1"
                        disabled={pending}
                        onClick={() => doMove(task, 'completed')}
                      >
                        {pending ? <Loader2 className="animate-spin" /> : <Check />} Complete
                      </Button>
                    </div>
                  )}
                </div>
              )
            })}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
