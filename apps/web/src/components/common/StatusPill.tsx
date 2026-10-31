import { cn } from '@/lib/utils'

export type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral'

const TONE_CLASSES: Record<Tone, string> = {
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-danger',
  info: 'bg-info-soft text-info',
  neutral: 'bg-muted text-muted-foreground',
}

/**
 * Every status in the app maps to a label and tone here, and only here.
 * Keys are the lowercase enum values from @cityreach/shared.
 */
const STATUS: Record<string, { label: string; tone: Tone }> = {
  // attendance
  on_time: { label: 'On Time', tone: 'success' },
  late: { label: 'Late', tone: 'warning' },
  absent: { label: 'Absent', tone: 'danger' },
  leave: { label: 'Leave', tone: 'info' },
  off: { label: 'Off', tone: 'neutral' },
  upcoming: { label: 'Upcoming', tone: 'neutral' },
  not_in_yet: { label: 'Not in yet', tone: 'info' },
  // employment
  active: { label: 'Active', tone: 'success' },
  on_leave: { label: 'On Leave', tone: 'warning' },
  inactive: { label: 'Inactive', tone: 'neutral' },
  // tasks
  pending: { label: 'Pending', tone: 'info' },
  in_progress: { label: 'In Progress', tone: 'warning' },
  completed: { label: 'Completed', tone: 'success' },
  overdue: { label: 'Overdue', tone: 'danger' },
  // leave requests
  approved: { label: 'Approved', tone: 'success' },
  rejected: { label: 'Rejected', tone: 'danger' },
  cancelled: { label: 'Cancelled', tone: 'neutral' },
  // payslips
  draft: { label: 'Draft', tone: 'info' },
  paid: { label: 'Paid', tone: 'success' },
  // priority
  low: { label: 'Low', tone: 'neutral' },
  medium: { label: 'Medium', tone: 'warning' },
  high: { label: 'High', tone: 'danger' },
  // stock
  in_stock: { label: 'In Stock', tone: 'success' },
  critical: { label: 'Critical', tone: 'danger' },
}

// Stock "low" shares the key with priority "low"; stock callers pass kind="stock".
const STOCK_OVERRIDES: Record<string, { label: string; tone: Tone }> = {
  low: { label: 'Low', tone: 'warning' },
}

interface StatusPillProps {
  status: string
  kind?: 'stock'
  className?: string
}

export function StatusPill({ status, kind, className }: StatusPillProps) {
  const meta = (kind === 'stock' ? STOCK_OVERRIDES[status] : undefined) ??
    STATUS[status] ?? { label: status, tone: 'neutral' as const }
  return (
    <TonePill tone={meta.tone} className={className}>
      {meta.label}
    </TonePill>
  )
}

export function TonePill({
  tone,
  className,
  children,
}: {
  tone: Tone
  className?: string
  children: React.ReactNode
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap',
        TONE_CLASSES[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}
