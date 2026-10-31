import type { Branch, Task, TaskInput, TaskStatus, User } from '@cityreach/shared'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useCurrentUser } from '@/features/auth/session'
import { useLive } from '@/lib/live'
import { qk, refreshLists } from '@/lib/query-keys'
import {
  createTask,
  deleteTask,
  moveTask,
  subscribeBoard,
  subscribeMyTasks,
  updateTask,
} from './api'

/** Live: the manager's board updates as staff start and finish tasks. */
export function useTaskBoard() {
  const { branchId } = useCurrentUser().access
  return useLive<Task[]>(`board:${branchId}`, (onData, onError) =>
    subscribeBoard(branchId, onData, onError),
  )
}

/** Live: the employee's own tasks. */
export function useMyTasks() {
  const { uid } = useCurrentUser()
  return useLive<Task[]>(`mine:${uid}`, (onData, onError) => subscribeMyTasks(uid, onData, onError))
}

/** Lists are live; only the cached employee-profile task tables need refreshing. */
function useTaskMutation<TInput>(fn: (input: TInput) => Promise<void>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => refreshLists(queryClient, qk.employees),
  })
}

export function useSaveTask() {
  const actor = useCurrentUser()
  return useTaskMutation(
    ({
      task,
      input,
      assignee,
      branch,
    }: {
      task?: Task
      input: TaskInput
      assignee: User
      branch: Branch
    }) =>
      task
        ? updateTask(task, input, assignee, branch, actor)
        : createTask(input, assignee, branch, actor),
  )
}

export function useMoveTask() {
  const actor = useCurrentUser()
  return useTaskMutation(({ task, to, branch }: { task: Task; to: TaskStatus; branch: Branch }) =>
    moveTask(task, to, branch, actor),
  )
}

export function useDeleteTask() {
  const actor = useCurrentUser()
  return useTaskMutation((task: Task) => deleteTask(task, actor))
}
