import { displayTaskStatus, TASK_PRIORITIES, type Task, type TaskStatus } from '@dm/shared'
import { KanbanSquare, List, Plus, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { DataTable, type Column } from '@/components/common/DataTable'
import { EmployeeAvatar } from '@/components/common/EmployeeAvatar'
import { ErrorState } from '@/components/common/EmptyState'
import { PageHeader } from '@/components/common/PageHeader'
import { StatusPill } from '@/components/common/StatusPill'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useEmployees } from '@/features/employees/queries'
import { useBranch } from '@/features/settings/queries'
import { errorMessage } from '@/lib/errors'
import { formatDue } from '@/lib/format'
import { TaskBoard, type BoardItem } from '../components/TaskBoard'
import { TaskDialog } from '../components/TaskDialog'
import { useMoveTask, useTaskBoard } from '../queries'

const ALL = 'all'

export function TasksPage() {
  const board = useTaskBoard()
  const branch = useBranch().data
  const employees = useEmployees().data ?? []
  const move = useMoveTask()
  const [view, setView] = useState<'kanban' | 'list'>('kanban')
  const [search, setSearch] = useState('')
  const [assignee, setAssignee] = useState(ALL)
  const [priority, setPriority] = useState(ALL)
  const [dialog, setDialog] = useState<{ open: boolean; task?: Task }>({ open: false })
  const tz = branch?.rules.timeZone ?? 'UTC'

  const items: BoardItem[] = useMemo(() => {
    const now = new Date()
    const term = search.trim().toLowerCase()
    return (board.data ?? [])
      .filter((t) => assignee === ALL || t.assigneeId === assignee)
      .filter((t) => priority === ALL || t.priority === priority)
      .filter(
        (t) => !term || `${t.title} ${t.description} ${t.category}`.toLowerCase().includes(term),
      )
      .map((task) => ({ task, status: displayTaskStatus(task.status, task.deadline, now) }))
      .sort((a, b) => a.task.deadline.getTime() - b.task.deadline.getTime())
  }, [board.data, assignee, priority, search])

  const onMove = (task: Task, to: TaskStatus) =>
    branch &&
    move.mutate(
      { task, to, branch },
      {
        onError: (e) => toast.error(errorMessage(e)),
        onSuccess: () => to === 'completed' && toast.success('Task completed'),
      },
    )

  const columns: Column<BoardItem>[] = [
    {
      key: 'task',
      header: 'Task',
      cell: ({ task }) => (
        <div>
          <div className="font-medium">{task.title}</div>
          <div className="text-xs text-muted-foreground">{task.category}</div>
        </div>
      ),
    },
    {
      key: 'assignee',
      header: 'Assigned to',
      className: 'hidden sm:table-cell',
      cell: ({ task }) => (
        <span className="flex items-center gap-2">
          <EmployeeAvatar name={task.assigneeName} id={task.assigneeId} size="sm" />{' '}
          {task.assigneeName}
        </span>
      ),
    },
    {
      key: 'priority',
      header: 'Priority',
      className: 'hidden md:table-cell',
      cell: ({ task }) => <StatusPill status={task.priority} />,
    },
    {
      key: 'deadline',
      header: 'Deadline',
      className: 'hidden md:table-cell',
      cell: ({ task }) => formatDue(task.deadline, tz),
    },
    { key: 'status', header: 'Status', cell: ({ status }) => <StatusPill status={status} /> },
  ]

  return (
    <div className="space-y-4">
      <PageHeader
        title="Task management"
        description="Assign, prioritize and track work across your team."
        actions={
          <>
            <Tabs value={view} onValueChange={(v) => setView(v as typeof view)}>
              <TabsList>
                <TabsTrigger value="kanban">
                  <KanbanSquare /> Kanban
                </TabsTrigger>
                <TabsTrigger value="list">
                  <List /> List
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <Button onClick={() => setDialog({ open: true })}>
              <Plus /> New task
            </Button>
          </>
        }
      />

      <div className="flex flex-wrap gap-2">
        <div className="relative w-full sm:w-64">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tasks"
            className="pl-9"
            aria-label="Search tasks"
          />
        </div>
        <Select value={assignee} onValueChange={setAssignee}>
          <SelectTrigger className="w-44" aria-label="Filter by employee">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Everyone</SelectItem>
            {employees.map((e) => (
              <SelectItem key={e.id} value={e.id}>
                {e.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={priority} onValueChange={setPriority}>
          <SelectTrigger className="w-36" aria-label="Filter by priority">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Any priority</SelectItem>
            {TASK_PRIORITIES.map((p) => (
              <SelectItem key={p} value={p} className="capitalize">
                {p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {board.error ? (
        <ErrorState error={board.error} />
      ) : board.isPending ? (
        <Skeleton className="h-80 w-full rounded-xl" />
      ) : view === 'kanban' ? (
        <TaskBoard
          items={items}
          timeZone={tz}
          onOpen={(task) => setDialog({ open: true, task })}
          onMove={onMove}
          onAdd={() => setDialog({ open: true })}
        />
      ) : (
        <Card>
          <CardContent>
            <DataTable
              columns={columns}
              rows={items}
              rowKey={(i) => i.task.id}
              onRowClick={({ task }) => setDialog({ open: true, task })}
            />
          </CardContent>
        </Card>
      )}

      <TaskDialog
        open={dialog.open}
        task={dialog.task}
        defaults={{ assigneeId: assignee === ALL ? undefined : assignee }}
        onOpenChange={(open) => setDialog((d) => ({ ...d, open }))}
      />
    </div>
  )
}
