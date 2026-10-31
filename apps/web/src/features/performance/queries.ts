import { lastWeeks, toDateKey, weekRange } from '@dm/shared'
import { useQuery } from '@tanstack/react-query'
import { useBranch } from '@/features/settings/queries'
import { listSnapshots, TREND_WEEKS } from './api'

/** Average weekly score for the last 8 weeks (dashboard trend), from the saved snapshots. */
export function usePerformanceTrend() {
  const branch = useBranch().data
  return useQuery({
    queryKey: ['performance', 'trend', branch?.id, branch?.automation?.performanceDate],
    enabled: Boolean(branch),
    queryFn: async () => {
      if (!branch) return []
      const weeks = lastWeeks(toDateKey(new Date(), branch.rules.timeZone), TREND_WEEKS)
      const snaps = await listSnapshots(branch.id, weeks)
      return weeks.map((week) => {
        const scores = snaps.filter((s) => s.period === week && s.inputs).map((s) => s.score)
        return {
          label: new Intl.DateTimeFormat('en-GB', {
            day: 'numeric',
            month: 'short',
            timeZone: 'UTC',
          }).format(new Date(`${weekRange(week).from}T12:00:00Z`)),
          score: scores.length
            ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
            : null,
        }
      })
    },
  })
}
