import { periodLabel } from '@cityreach/shared'
import { Loader2, Star } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { errorMessage } from '@/lib/errors'
import { cn } from '@/lib/utils'
import type { ReportRow } from '../model'
import { useRateEmployee } from '../queries'

/** Weekly manager rating (1–5) and comment; counts for the "manager rating" part of the score. */
export function RateDialog({
  row,
  week,
  onClose,
}: {
  row: ReportRow | null
  week: string
  onClose: () => void
}) {
  const rate = useRateEmployee()
  const [rating, setRating] = useState<number | null>(null)
  const [comment, setComment] = useState('')
  useEffect(() => {
    setRating(row?.rating != null ? Math.round(row.rating) : null)
    setComment(row?.comment ?? '')
  }, [row])
  if (!row) return null

  const save = () =>
    rate.mutate(
      { employee: row.employee, week, rating, comment },
      {
        onSuccess: () => {
          toast.success(`Rating saved for ${row.employee.name}`)
          onClose()
        },
        onError: (e) => toast.error(errorMessage(e)),
      },
    )

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Rate {row.employee.name}</DialogTitle>
          <DialogDescription>
            Week of {periodLabel('weekly', week)}. Worth 15% of the score by default (Settings →
            Performance weights).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center gap-1" role="radiogroup" aria-label="Rating">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={rating === n}
                aria-label={`${n} of 5`}
                onClick={() => setRating(n)}
                className="rounded p-1 hover:bg-muted"
              >
                <Star
                  className={cn(
                    'size-7',
                    rating !== null && n <= rating
                      ? 'fill-warning text-warning'
                      : 'text-muted-foreground',
                  )}
                />
              </button>
            ))}
            {rating !== null && (
              <button
                type="button"
                className="ml-2 text-xs text-muted-foreground underline"
                onClick={() => setRating(null)}
              >
                Clear
              </button>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rate-comment">Comment (shown in the report)</Label>
            <Textarea
              id="rate-comment"
              rows={3}
              maxLength={300}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Great with customers; keep working on punctuality."
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={rate.isPending}>
            {rate.isPending && <Loader2 className="animate-spin" />} Save rating
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
