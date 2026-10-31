import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { TonePill, type Tone } from './StatusPill'

interface StatCardProps {
  label: string
  value: ReactNode
  caption?: string
  icon: LucideIcon
  badge?: { text: string; tone: Tone }
  loading?: boolean
}

/** The prototype's stat card: label, big number, caption, icon tile, soft pill. */
export function StatCard({ label, value, caption, icon: Icon, badge, loading }: StatCardProps) {
  return (
    <Card className="gap-3 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">{label}</p>
          {loading ? (
            <Skeleton className="h-8 w-20" />
          ) : (
            <p className="text-3xl font-semibold tracking-tight">{value}</p>
          )}
          {caption && <p className="text-xs text-muted-foreground">{caption}</p>}
        </div>
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted">
          <Icon className="size-5 text-foreground/70" aria-hidden />
        </span>
      </div>
      {badge && !loading && (
        <div>
          <TonePill tone={badge.tone}>{badge.text}</TonePill>
        </div>
      )}
    </Card>
  )
}
