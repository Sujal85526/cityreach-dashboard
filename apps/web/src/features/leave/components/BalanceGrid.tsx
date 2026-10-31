import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import { plural, type TypeBalance } from '../model'

/** One tile per leave type: days left of the yearly allowance, used and pending. */
export function BalanceGrid({
  balances,
  className,
}: {
  balances: TypeBalance[]
  className?: string
}) {
  return (
    <div className={cn('grid gap-3 sm:grid-cols-2 lg:grid-cols-3', className)}>
      {balances.map(({ type, allowed, used, pending, remaining }) => (
        <div key={type.id} className="space-y-2 rounded-lg border p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="text-sm font-medium">{type.name}</div>
            <span className="text-xs text-muted-foreground">{type.paid ? 'Paid' : 'Unpaid'}</span>
          </div>
          {allowed === null ? (
            <div className="text-sm text-muted-foreground">
              No limit · {plural(used, 'day')} taken this year
            </div>
          ) : (
            <>
              <div>
                <span className="text-2xl font-semibold tabular-nums">{remaining}</span>
                <span className="text-sm text-muted-foreground"> of {allowed} days left</span>
              </div>
              <Progress
                value={allowed ? ((used + pending) / allowed) * 100 : 100}
                aria-label={`${type.name} used`}
              />
              <div className="text-xs text-muted-foreground">
                {used} used{pending ? ` · ${pending} waiting for approval` : ''}
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  )
}
