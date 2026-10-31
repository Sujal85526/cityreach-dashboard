import {
  COLLECTIONS,
  taskInputSchema,
  type Branch,
  type Task,
  type TaskInput,
  type TaskStatus,
  type User,
} from '@cityreach/shared'
import {
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  where,
  writeBatch,
  type Query,
} from 'firebase/firestore'
import type { SessionUser } from '@/features/auth/api'
import { addActivity } from '@/lib/activity'
import { db } from '@/lib/firebase'
import { fromDoc } from '@/lib/firestore'
import { addNotification } from '@/lib/notify'

const tasks = collection(db, COLLECTIONS.tasks)
const entity = (id: string) => ({ collection: COLLECTIONS.tasks, id })
const DAY_MS = 86_400_000
/** Completed tasks stay on the board for two weeks, then live in reports and profiles. */
export const BOARD_COMPLETED_DAYS = 14

type Listener = (tasks: Task[]) => void
type ErrorListener = (error: Error) => void

function listen(q: Query, onData: Listener, onError: ErrorListener) {
  return onSnapshot(q, (snap) => onData(snap.docs.map((d) => fromDoc<Task>(d))), onError)
}

/** Live board: every open task plus recently completed ones (two listeners, merged). */
export function subscribeBoard(branchId: string, onData: Listener, onError: ErrorListener) {
  let open: Task[] | null = null
  let done: Task[] | null = null
  const emit = () => open && done && onData([...open, ...done])
  const since = Timestamp.fromMillis(Date.now() - BOARD_COMPLETED_DAYS * DAY_MS)
  const stopOpen = listen(
    query(
      tasks,
      where('branchId', '==', branchId),
      where('status', 'in', ['pending', 'in_progress', 'overdue']),
    ),
    (t) => ((open = t), emit()),
    onError,
  )
  const stopDone = listen(
    query(
      tasks,
      where('branchId', '==', branchId),
      where('status', '==', 'completed'),
      where('completedAt', '>=', since),
      orderBy('completedAt', 'desc'),
    ),
    (t) => ((done = t), emit()),
    onError,
  )
  return () => {
    stopOpen()
    stopDone()
  }
}

/** Live list of the signed-in employee's tasks, latest deadlines first. */
export function subscribeMyTasks(uid: string, onData: Listener, onError: ErrorListener) {
  return listen(
    query(tasks, where('assigneeId', '==', uid), orderBy('deadline', 'desc'), limit(50)),
    onData,
    onError,
  )
}

/** Manager creates and assigns a task; the assignee gets a notification in the same batch. */
export async function createTask(
  input: TaskInput,
  assignee: User,
  branch: Branch,
  actor: SessionUser,
): Promise<void> {
  const t = taskInputSchema.parse(input)
  const ref = doc(tasks)
  const batch = writeBatch(db)
  batch.set(ref, {
    ...t,
    deadline: Timestamp.fromDate(t.deadline),
    branchId: actor.access.branchId,
    assigneeName: assignee.name,
    status: 'pending',
    completedAt: null,
    createdBy: actor.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  addActivity(batch, actor, {
    action: 'task_created',
    summary: `${actor.name} assigned "${t.title}" to ${assignee.name}`,
    entity: entity(ref.id),
  })
  addNotification(batch, actor, branch, {
    type: 'task_assigned',
    tone: 'info',
    title: 'New task',
    body: `${actor.name} assigned you "${t.title}".`,
    entity: entity(ref.id),
    recipientId: assignee.id,
  })
  await batch.commit()
}

/**
 * Manager edits a task. Moving an overdue task's deadline into the future reopens it as pending;
 * a new assignee is notified.
 */
export async function updateTask(
  task: Task,
  input: TaskInput,
  assignee: User,
  branch: Branch,
  actor: SessionUser,
): Promise<void> {
  const t = taskInputSchema.parse(input)
  const reopened = task.status === 'overdue' && t.deadline > new Date()
  const batch = writeBatch(db)
  batch.update(doc(tasks, task.id), {
    ...t,
    deadline: Timestamp.fromDate(t.deadline),
    assigneeName: assignee.name,
    ...(reopened ? { status: 'pending' } : {}),
    updatedAt: serverTimestamp(),
  })
  addActivity(batch, actor, {
    action: 'task_updated',
    summary: `${actor.name} updated "${t.title}"`,
    entity: entity(task.id),
  })
  if (assignee.id !== task.assigneeId)
    addNotification(batch, actor, branch, {
      type: 'task_assigned',
      tone: 'info',
      title: 'New task',
      body: `${actor.name} assigned you "${t.title}".`,
      entity: entity(task.id),
      recipientId: assignee.id,
    })
  await batch.commit()
}

const MOVE_VERB: Record<TaskStatus, string> = {
  pending: 'moved back to pending',
  in_progress: 'started',
  completed: 'completed',
  overdue: 'marked overdue',
}

/**
 * Status change from the board (manager) or My tasks (employee). Completion uses the server's
 * time and notifies the managers: "Sara completed the espresso machine cleaning task."
 */
export async function moveTask(
  task: Task,
  to: TaskStatus,
  branch: Branch,
  actor: SessionUser,
): Promise<void> {
  if (to === task.status) return
  const batch = writeBatch(db)
  batch.update(doc(tasks, task.id), {
    status: to,
    completedAt: to === 'completed' ? serverTimestamp() : null,
    updatedAt: serverTimestamp(),
  })
  const who =
    actor.uid === task.assigneeId ? actor.name : `${actor.name} (for ${task.assigneeName})`
  addActivity(batch, actor, {
    action: `task_${to}`,
    summary: `${who} ${MOVE_VERB[to]} "${task.title}"`,
    entity: entity(task.id),
  })
  if (to === 'completed' && actor.access.role === 'employee')
    addNotification(batch, actor, branch, {
      type: 'task_completed',
      tone: 'success',
      title: 'Task completed',
      body: `${actor.name} completed the "${task.title}" task.`,
      entity: entity(task.id),
    })
  await batch.commit()
}

export async function deleteTask(task: Task, actor: SessionUser): Promise<void> {
  const batch = writeBatch(db)
  batch.delete(doc(tasks, task.id))
  addActivity(batch, actor, {
    action: 'task_deleted',
    summary: `${actor.name} deleted "${task.title}"`,
    entity: null,
  })
  await batch.commit()
}

/**
 * Free-plan replacement for a scheduled "mark overdue" job (runs on manager open, every 10 min):
 * open tasks past their deadline become Overdue, and the managers are notified once per task.
 */
export async function markOverdueTasks(branch: Branch, actor: SessionUser, now = new Date()) {
  const snap = await getDocs(
    query(
      tasks,
      where('branchId', '==', branch.id),
      where('status', 'in', ['pending', 'in_progress']),
      where('deadline', '<', Timestamp.fromDate(now)),
    ),
  )
  const due = snap.docs.map((d) => fromDoc<Task>(d)).slice(0, 200)
  if (due.length === 0) return 0
  const batch = writeBatch(db)
  for (const t of due) {
    batch.update(doc(tasks, t.id), { status: 'overdue', updatedAt: serverTimestamp() })
    addNotification(batch, actor, branch, {
      type: 'task_overdue',
      tone: 'danger',
      title: 'Task overdue',
      body: `The deadline for "${t.title}" (${t.assigneeName}) has passed and the task is still incomplete.`,
      entity: entity(t.id),
    })
  }
  addActivity(batch, actor, {
    action: 'tasks_marked_overdue',
    summary: `Automatic check marked ${due.length} task(s) overdue`,
    entity: null,
  })
  await batch.commit()
  return due.length
}
