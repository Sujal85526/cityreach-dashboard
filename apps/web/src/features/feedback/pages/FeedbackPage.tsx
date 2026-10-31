import type { Feedback } from '@cityreach/shared'
import { MessageSquareWarning, Star, ThumbsUp } from 'lucide-react'
import { StatCard } from '@/components/common/StatCard'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent } from '@/components/ui/card'
import { RecordList } from '@/features/records/components/RecordList'
import { useModuleContext } from '@/features/records/context'
import { useRecords } from '@/features/records/queries'
import { feedbackModule } from '../modules'

/** Manager: customer feedback with the average rating and complaints still open. */
export function FeedbackPage() {
  const ctx = useModuleContext()
  const list = useRecords<Feedback>('feedback')
  const all = list.data ?? []
  const average = all.length ? all.reduce((s, f) => s + f.rating, 0) / all.length : null
  const open = all.filter((f) => f.status === 'open').length
  const positive = all.filter((f) => f.rating >= 4).length
  if (!ctx) return <Skeleton className="h-64 w-full rounded-xl" />
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 [&>*:last-child:nth-child(odd)]:col-span-2 sm:[&>*:last-child:nth-child(odd)]:col-span-1">
        <StatCard
          label="Average rating"
          icon={Star}
          loading={list.isPending}
          value={average === null ? '—' : `${average.toFixed(1)} / 5`}
          caption={`${all.length} reviews`}
        />
        <StatCard
          label="Happy customers"
          icon={ThumbsUp}
          loading={list.isPending}
          value={all.length ? `${Math.round((positive / all.length) * 100)}%` : '—'}
          caption="4 or 5 stars"
        />
        <StatCard
          label="Open complaints"
          icon={MessageSquareWarning}
          loading={list.isPending}
          value={open}
          caption="Waiting for a resolution"
          badge={open ? { text: 'Follow up', tone: 'warning' } : undefined}
        />
      </div>
      <Card>
        <CardContent className="pt-6">
          <RecordList module={feedbackModule(ctx)} />
        </CardContent>
      </Card>
    </div>
  )
}
