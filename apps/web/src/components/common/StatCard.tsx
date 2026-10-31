import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { CountUp } from './CountUp'
import { TonePill, type Tone } from './StatusPill'

interface StatCardProps {
  label: string
  /** Numbers count up on first show; anything else renders as given. */
  value: ReactNode
  caption?: string
  icon: LucideIcon
  badge?: { text: string; tone: Tone }
  loading?: boolean
}

/** Stat card: label, big number, caption, icon tile, soft pill. */
export function StatCard({ label, value, caption, icon: Icon, badge, loading }: StatCardProps) {
  return (
    <Card className="group gap-2 p-4 transition duration-300 sm:gap-3 sm:p-5 hover:-translate-y-0.5 hover:shadow-lg">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1.5">
          <p className="text-xs text-muted-foreground sm:text-sm">{label}</p>
          {loading ? (
            <Skeleton className="h-9 w-24" />
          ) : (
            <p className="font-display text-3xl leading-none sm:text-4xl font-medium tracking-tight">
              {typeof value === 'number' ? <CountUp value={value} /> : value}
            </p>
          )}
          {caption && <p className="pt-0.5 text-xs text-muted-foreground">{caption}</p>}
        </div>
        <span className="hidden size-10 shrink-0 items-center justify-center rounded-xl bg-accent sm:flex text-primary transition-transform duration-300 group-hover:scale-105">
          <Icon className="size-5" aria-hidden />
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
