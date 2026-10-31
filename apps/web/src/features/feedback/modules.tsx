import {
  FEEDBACK_CHANNELS,
  FEEDBACK_TOPICS,
  feedbackSchema,
  type Feedback,
} from '@cityreach/shared'
import { MessageSquareHeart, Star } from 'lucide-react'
import { StatusPill } from '@/components/common/StatusPill'
import type { ModuleContext } from '@/features/operations/modules'
import type { RecordModule } from '@/features/records/components/RecordList'
import { formatDay } from '@/lib/format'

export const Stars = ({ n }: { n: number }) => (
  <span className="flex" aria-label={`${n} of 5 stars`}>
    {[1, 2, 3, 4, 5].map((i) => (
      <Star
        key={i}
        className={i <= n ? 'size-4 fill-warning text-warning' : 'size-4 text-muted-foreground/40'}
      />
    ))}
  </span>
)

/** Customer feedback from any channel; complaints stay open until resolved. */
export const feedbackModule = ({ today }: ModuleContext): RecordModule<Feedback> => ({
  coll: 'feedback',
  noun: 'feedback',
  title: 'Customer feedback',
  description: 'Reviews and complaints from every channel, and how they were resolved.',
  icon: MessageSquareHeart,
  schema: feedbackSchema.pick({
    date: true,
    channel: true,
    rating: true,
    topic: true,
    comment: true,
    status: true,
    resolution: true,
  }),
  fields: [
    { key: 'date', label: 'Date', type: 'date' },
    { key: 'channel', label: 'Channel', type: 'select', options: FEEDBACK_CHANNELS },
    { key: 'rating', label: 'Rating', type: 'rating', wide: true },
    { key: 'topic', label: 'About', type: 'select', options: FEEDBACK_TOPICS },
    { key: 'status', label: 'Status', type: 'select', options: ['open', 'resolved'] },
    { key: 'comment', label: 'What they said', type: 'textarea' },
    { key: 'resolution', label: 'How it was resolved', type: 'textarea', optional: true },
  ],
  defaults: () => ({
    date: today,
    channel: 'In store',
    rating: '5',
    topic: 'Product',
    status: 'resolved',
  }),
  prepare: (d) => ({ ...d, resolution: d.resolution ?? '' }),
  columns: [
    {
      key: 'date',
      header: 'Date',
      cell: (r) => (
        <div>
          <div>{formatDay(r.date)}</div>
          <div className="text-xs text-muted-foreground">{r.channel}</div>
        </div>
      ),
    },
    { key: 'rating', header: 'Rating', cell: (r) => <Stars n={r.rating} /> },
    {
      key: 'comment',
      header: 'Feedback',
      className: 'whitespace-normal',
      cell: (r) => (
        <div className="max-w-md">
          <div className="text-xs text-muted-foreground">{r.topic}</div>
          <div className="line-clamp-2">{r.comment}</div>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      className: 'hidden sm:table-cell',
      cell: (r) => <StatusPill status={r.status === 'open' ? 'pending' : 'completed'} />,
    },
  ],
  searchText: (r) => `${r.comment} ${r.topic} ${r.channel} ${r.resolution}`,
  describe: (d) => `${String(d.rating)}★ ${String(d.topic)} (${String(d.channel)})`,
})
