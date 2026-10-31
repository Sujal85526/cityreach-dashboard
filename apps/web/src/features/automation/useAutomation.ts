import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { useCurrentUser } from '@/features/auth/session'
import { useEmployees } from '@/features/employees/queries'
import { useBranch, useShifts } from '@/features/settings/queries'
import { isManagerRole, toDateKey } from '@cityreach/shared'
import { refreshPerformance } from '@/features/performance/api'
import { saveLastWeekReport } from '@/features/reports/api'
import { markOverdueTasks } from '@/features/tasks/api'
import { deleteOldPhotos } from '@/features/attendance/api'
import { checkDocumentExpiry } from '@/features/documents/api'
import { markAbsences } from './api'
import { checkDateReminders } from './reminders'

const EVERY_MS = 10 * 60_000
/** Let the dashboard's own reads finish first; the daily recalculation is heavy on the network. */
const START_DELAY_MS = 5_000

/**
 * Runs the rule-based checks while a manager has the app open (5 s after open, then every 10 min).
 * This is what a scheduled Cloud Function would do on the paid plan; see docs/ARCHITECTURE.md.
 */
export function useAutomation() {
  const actor = useCurrentUser()
  const queryClient = useQueryClient()
  const branch = useBranch().data
  const shifts = useShifts().data
  const employees = useEmployees().data
  const isReady = isManagerRole(actor.access.role) && !!branch && !!shifts && !!employees
  // Every refetch builds new objects (Timestamps become new Dates), so these can't be effect
  // dependencies: each save that refreshes the employee list would restart all the checks.
  const latest = useRef({ branch, shifts, employees })
  useEffect(() => {
    latest.current = { branch, shifts, employees }
  })

  useEffect(() => {
    if (!isReady) return
    let cancelled = false
    const run = async () => {
      const { branch, shifts, employees } = latest.current
      if (!branch || !shifts || !employees) return
      try {
        const [absences] = await Promise.all([
          markAbsences({ branch, shifts, employees }, actor),
          // The task board is live, so overdue changes show up without a refetch.
          markOverdueTasks(branch, actor),
          checkDocumentExpiry(branch, actor),
        ])
        if (absences > 0 && !cancelled)
          void queryClient.invalidateQueries({ queryKey: ['attendance'] })
        // Daily: clock-in photos past 90 days are deleted, then snapshots + employee stats (after
        // absences, so they count). Weekly: last week's report.
        if (branch.automation?.performanceDate !== toDateKey(new Date(), branch.rules.timeZone)) {
          await Promise.all([
            deleteOldPhotos(branch.id),
            checkDateReminders(branch, employees, actor),
          ])
          await refreshPerformance(branch, employees, actor)
          await saveLastWeekReport(branch, employees, actor)
          if (!cancelled) void queryClient.invalidateQueries()
        }
      } catch {
        // A failed background check retries on the next interval; it never blocks the UI.
      }
    }
    const first = setTimeout(() => void run(), START_DELAY_MS)
    const timer = setInterval(() => void run(), EVERY_MS)
    return () => {
      cancelled = true
      clearTimeout(first)
      clearInterval(timer)
    }
  }, [isReady, actor, queryClient])
}
