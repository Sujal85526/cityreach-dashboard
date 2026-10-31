import { TASK_STATUSES, type Task, type TaskStatus } from '@dm/shared'
import { Plus } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { MOVE_LABEL, TaskCard } from './TaskCard'

const DOT: Record<TaskStatus, string> = {
  pending: 'bg-info',
  in_progress: 'bg-warning',
  completed: 'bg-success',
  overdue: 'bg-danger',
}

export interface BoardItem {
  task: Task
  status: TaskStatus
}

interface Props {
  items: BoardItem[]
  timeZone: string
  onOpen: (task: Task) => void
  onMove: (task: Task, to: TaskStatus) => void
  onAdd: () => void
}

/**
 * Four columns like the prototype. Drag a card (or use its menu) to change status. Overdue is
 * decided by the deadline, so nothing can be dropped there; dropping an overdue card on
 * Completed finishes it.
 */
export function TaskBoard({ items, timeZone, onOpen, onMove, onAdd }: Props) {
  const [over, setOver] = useState<TaskStatus | null>(null)
  const byId = new Map(items.map((i) => [i.task.id, i.task]))

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {TASK_STATUSES.map((status) => {
        const column = items.filter((i) => i.status === status)
        const droppable = status !== 'overdue'
        return (
          <section
            key={status}
            aria-label={`${MOVE_LABEL[status]} tasks`}
            onDragOver={(e) => {
              if (!droppable) return
              e.preventDefault()
              setOver(status)
            }}
            onDragLeave={() => setOver(null)}
            onDrop={(e) => {
              setOver(null)
              const task = byId.get(e.dataTransfer.getData('text/task-id'))
              if (task && droppable) onMove(task, status)
            }}
            className={cn(
              'flex min-h-40 flex-col gap-3 rounded-xl bg-muted/50 p-3 transition-colors',
              over === status && 'bg-primary/10 ring-2 ring-primary/40',
            )}
          >
            <header className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-medium">
                <span className={cn('size-2 rounded-full', DOT[status])} />
                {MOVE_LABEL[status]}
                <span className="rounded-full bg-background px-2 text-xs text-muted-foreground">
                  {column.length}
                </span>
              </h3>
              {status === 'pending' && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  aria-label="New task"
                  onClick={onAdd}
                >
                  <Plus />
                </Button>
              )}
            </header>
            {column.map(({ task, status: s }) => (
              <TaskCard
                key={task.id}
                task={task}
                status={s}
                timeZone={timeZone}
                onOpen={() => onOpen(task)}
                onMove={(to) => onMove(task, to)}
              />
            ))}
            {column.length === 0 && (
              <p className="py-6 text-center text-xs text-muted-foreground">No tasks</p>
            )}
          </section>
        )
      })}
    </div>
  )
}
