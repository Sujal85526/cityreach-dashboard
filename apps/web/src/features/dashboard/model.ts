import { displayTaskStatus, toDateKey, type Task, type User } from '@dm/shared'
import { addDays } from '@/features/attendance/model'

/** Task numbers for today's stat cards (local dates in the shop's timezone). */
export function taskStats(tasks: Task[], tz: string, now: Date) {
  const today = toDateKey(now, tz)
  const completedToday = tasks.filter(
    (t) => t.completedAt && toDateKey(t.completedAt, tz) === today,
  )
  const open = tasks
    .map((t) => ({ ...t, shown: displayTaskStatus(t.status, t.deadline, now) }))
    .filter((t) => t.shown !== 'completed')
  const openDueToday = open.filter((t) => toDateKey(t.deadline, tz) === today)
  return {
    completedToday: completedToday.length,
    plannedToday: completedToday.length + openDueToday.length,
    open: open.length,
    highPriority: open.filter((t) => t.priority === 'high').length,
    overdue: open.filter((t) => t.shown === 'overdue').length,
    upcoming: open
      .filter((t) => t.shown !== 'overdue')
      .sort((a, b) => a.deadline.getTime() - b.deadline.getTime())
      .slice(0, 5),
  }
}

/** Past 7 days: tasks due each day, split into completed vs not completed. */
export function taskWeek(tasks: Task[], tz: string, today: string) {
  return Array.from({ length: 7 }, (_, i) => addDays(today, i - 6)).map((day) => {
    const due = tasks.filter((t) => toDateKey(t.deadline, tz) === day)
    const completed = due.filter((t) => t.status === 'completed').length
    return {
      day: new Intl.DateTimeFormat('en-GB', { weekday: 'short', timeZone: 'UTC' }).format(
        new Date(`${day}T12:00:00Z`),
      ),
      completed,
      pending: due.length - completed,
    }
  })
}

/** Average of the staff's latest performance scores (managers and inactive staff excluded). */
export function averageScore(employees: User[]): number | null {
  const scores = employees
    .filter((e) => e.role === 'employee' && e.status !== 'inactive' && e.stats.performanceScore > 0)
    .map((e) => e.stats.performanceScore)
  return scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null
}
