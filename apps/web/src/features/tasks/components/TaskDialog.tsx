import { TASK_PRIORITIES, toDateKey, zonedDateTime, type Task, type TaskPriority } from '@cityreach/shared'
import { Loader2, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useEmployees } from '@/features/employees/queries'
import { useBranch } from '@/features/settings/queries'
import { errorMessage } from '@/lib/errors'
import { useDeleteTask, useSaveTask } from '../queries'

const PRIORITY_LABEL: Record<TaskPriority, string> = { low: 'Low', medium: 'Medium', high: 'High' }
const hhmm = (d: Date, tz: string) =>
  new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(d)

interface Form {
  title: string
  description: string
  category: string
  assigneeId: string
  priority: TaskPriority
  date: string
  time: string
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  task?: Task
  /** Prefill for "+" on a column or a filtered assignee. */
  defaults?: Partial<Pick<Form, 'assigneeId'>>
}

/** Create / edit a task (manager). Deadline is entered in the shop's timezone. */
export function TaskDialog({ open, onOpenChange, task, defaults }: Props) {
  const branch = useBranch().data
  const employees = useEmployees().data?.filter((e) => e.status !== 'inactive') ?? []
  const save = useSaveTask()
  const remove = useDeleteTask()
  const [form, setForm] = useState<Form | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const tz = branch?.rules.timeZone ?? 'UTC'

  useEffect(() => {
    if (!open || !branch) return
    const later = new Date(Date.now() + 2 * 3_600_000)
    setForm(
      task
        ? {
            title: task.title,
            description: task.description,
            category: task.category,
            assigneeId: task.assigneeId,
            priority: task.priority,
            date: toDateKey(task.deadline, tz),
            time: hhmm(task.deadline, tz),
          }
        : {
            title: '',
            description: '',
            category: branch.taskCategories[0] ?? 'General',
            assigneeId: defaults?.assigneeId ?? '',
            priority: 'medium',
            date: toDateKey(later, tz),
            time: `${hhmm(later, tz).slice(0, 2)}:00`,
          },
    )
  }, [open, task, branch, tz, defaults?.assigneeId])

  if (!form || !branch) return null
  const set = (patch: Partial<Form>) => setForm({ ...form, ...patch })
  const categories = branch.taskCategories.includes(form.category)
    ? branch.taskCategories
    : [...branch.taskCategories, form.category]

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const assignee = employees.find((x) => x.id === form.assigneeId)
    if (form.title.trim().length < 2) return toast.error('Give the task a title.')
    if (!assignee) return toast.error('Choose who should do it.')
    const deadline = zonedDateTime(form.date, form.time, tz)
    if (!task && deadline <= new Date()) return toast.error('The deadline must be in the future.')
    save.mutate(
      {
        task,
        assignee,
        branch,
        input: {
          title: form.title.trim(),
          description: form.description.trim(),
          category: form.category,
          assigneeId: assignee.id,
          priority: form.priority,
          deadline,
        },
      },
      {
        onSuccess: () => {
          toast.success(task ? 'Task updated' : `Task assigned to ${assignee.name}`)
          onOpenChange(false)
        },
        onError: (err) => toast.error(errorMessage(err)),
      },
    )
  }

  const doDelete = () =>
    task &&
    remove.mutate(task, {
      onSuccess: () => {
        toast.success('Task deleted')
        setConfirmDelete(false)
        onOpenChange(false)
      },
      onError: (err) => toast.error(errorMessage(err)),
    })

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{task ? 'Edit task' : 'New task'}</DialogTitle>
            <DialogDescription>
              {task
                ? 'Changes are visible to the employee right away.'
                : 'The employee is notified when you assign it.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2" noValidate>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="t-title">Task</Label>
              <Input
                id="t-title"
                value={form.title}
                maxLength={120}
                onChange={(e) => set({ title: e.target.value })}
                placeholder="Clean the espresso machine"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="t-desc">Details (optional)</Label>
              <Textarea
                id="t-desc"
                rows={2}
                maxLength={1000}
                value={form.description}
                onChange={(e) => set({ description: e.target.value })}
              />
            </div>
            <Field label="Assigned to">
              <Select value={form.assigneeId} onValueChange={(v) => set({ assigneeId: v })}>
                <SelectTrigger className="w-full" aria-label="Assigned to">
                  <SelectValue placeholder="Choose employee" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.name} · {e.position}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Category">
              <Select value={form.category} onValueChange={(v) => set({ category: v })}>
                <SelectTrigger className="w-full" aria-label="Category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Priority">
              <Select
                value={form.priority}
                onValueChange={(v) => set({ priority: v as TaskPriority })}
              >
                <SelectTrigger className="w-full" aria-label="Priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TASK_PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {PRIORITY_LABEL[p]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Deadline">
              <div className="flex flex-col gap-2 min-[420px]:flex-row">
                <Input
                  type="date"
                  aria-label="Deadline date"
                  value={form.date}
                  onChange={(e) => set({ date: e.target.value })}
                />
                <Input
                  type="time"
                  aria-label="Deadline time"
                  className="min-[420px]:w-36 min-[420px]:shrink-0"
                  value={form.time}
                  onChange={(e) => set({ time: e.target.value })}
                />
              </div>
            </Field>
            <DialogFooter className="sm:col-span-2 sm:justify-between">
              {task ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="text-danger"
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2 /> Delete
                </Button>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={save.isPending}>
                  {save.isPending && <Loader2 className="animate-spin" />}
                  {task ? 'Save changes' : 'Assign task'}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this task?"
        description="It disappears from the board and the employee's list. The deletion is logged."
        confirmLabel="Delete task"
        destructive
        pending={remove.isPending}
        onConfirm={doDelete}
      />
    </>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  )
}
