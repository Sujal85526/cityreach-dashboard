import type { Task, TaskStatus } from '@cityreach/shared'
import { CalendarClock, MoreHorizontal } from 'lucide-react'
import { EmployeeAvatar } from '@/components/common/EmployeeAvatar'
import { StatusPill } from '@/components/common/StatusPill'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { formatDue } from '@/lib/format'
import { cn } from '@/lib/utils'

export const MOVE_LABEL: Record<TaskStatus, string> = {
  pending: 'Pending',
  in_progress: 'In Progress',
  completed: 'Completed',
  overdue: 'Overdue',
}

interface Props {
  task: Task
  status: TaskStatus
  timeZone: string
  onOpen: () => void
  onMove: (to: TaskStatus) => void
}

/** Prototype card: priority + category, title, one-line description, assignee, due time. Draggable. */
export function TaskCard({ task, status, timeZone, onOpen, onMove }: Props) {
  const targets = (['pending', 'in_progress', 'completed'] as const).filter(
    (s) => s !== task.status,
  )
  return (
    <article
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/task-id', task.id)
        e.dataTransfer.effectAllowed = 'move'
      }}
      onClick={onOpen}
      className="cursor-pointer space-y-2 rounded-lg border bg-card p-3 shadow-xs transition-shadow hover:shadow-md active:cursor-grabbing"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <StatusPill status={task.priority} />
          <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
            {task.category}
          </span>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              aria-label={`Move "${task.title}"`}
            >
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuLabel>Move to</DropdownMenuLabel>
            {targets.map((to) => (
              <DropdownMenuItem key={to} onSelect={() => onMove(to)}>
                {MOVE_LABEL[to]}
              </DropdownMenuItem>
            ))}
            <DropdownMenuItem onSelect={onOpen}>Edit…</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div>
        <h4 className="text-sm leading-snug font-medium">{task.title}</h4>
        {task.description && (
          <p className="line-clamp-1 text-xs text-muted-foreground">{task.description}</p>
        )}
      </div>
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="flex min-w-0 items-center gap-1.5">
          <EmployeeAvatar name={task.assigneeName} id={task.assigneeId} size="sm" />
          <span className="truncate">{task.assigneeName.split(' ')[0]}</span>
        </span>
        <span
          className={cn(
            'flex items-center gap-1 whitespace-nowrap text-muted-foreground',
            status === 'overdue' && 'text-danger',
          )}
        >
          <CalendarClock className="size-3.5" />
          {formatDue(task.deadline, timeZone)}
        </span>
      </div>
    </article>
  )
}
