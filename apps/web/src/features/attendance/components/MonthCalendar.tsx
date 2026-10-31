import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { addDays, type DaySummary } from '../model'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const LEGEND = [
  { label: 'On time', cls: 'bg-success' },
  { label: 'Late', cls: 'bg-warning' },
  { label: 'Absent', cls: 'bg-danger' },
]

interface Props {
  month: string // "YYYY-MM"
  selected: string
  today: string
  summaries: Map<string, DaySummary>
  onSelect: (dateKey: string) => void
}

/** Month grid with a dot per outcome; click a day to open it in the table. */
export function MonthCalendar({ month, selected, today, summaries, onSelect }: Props) {
  const first = `${month}-01`
  const lead = new Date(`${first}T12:00:00Z`).getUTCDay()
  const daysInMonth = new Date(
    Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0),
  ).getUTCDate()
  const cells = [
    ...Array<null>(lead).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => addDays(first, i)),
  ]
  const title = new Intl.DateTimeFormat('en-GB', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${first}T12:00:00Z`))

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Previous month"
          onClick={() => onSelect(addDays(first, -1))}
        >
          <ChevronLeft />
        </Button>
        <span className="text-sm font-medium">{title}</span>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Next month"
          disabled={addDays(first, daysInMonth) > today}
          onClick={() => onSelect(addDays(first, daysInMonth))}
        >
          <ChevronRight />
        </Button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs max-md:gap-px">
        {WEEKDAYS.map((d) => (
          <div key={d} className="py-1 text-muted-foreground">
            {d}
          </div>
        ))}
        {cells.map((dateKey, i) => {
          if (!dateKey) return <div key={`pad-${i}`} />
          const s = summaries.get(dateKey)
          const future = dateKey > today
          return (
            <button
              key={dateKey}
              type="button"
              disabled={future}
              onClick={() => onSelect(dateKey)}
              aria-label={`${dateKey}${s ? `: ${s.present} present, ${s.late} late, ${s.absent} absent` : ''}`}
              aria-pressed={dateKey === selected}
              className={cn(
                'flex aspect-square flex-col items-center justify-center gap-1 rounded-md transition-colors',
                dateKey === selected ? 'bg-primary text-primary-foreground' : 'hover:bg-muted',
                future && 'opacity-40',
              )}
            >
              <span>{Number(dateKey.slice(8))}</span>
              {s && s.scheduled > 0 && (
                <span className="flex gap-0.5">
                  {s.present - s.late > 0 && <span className="size-1.5 rounded-full bg-success" />}
                  {s.late > 0 && <span className="size-1.5 rounded-full bg-warning" />}
                  {s.absent > 0 && <span className="size-1.5 rounded-full bg-danger" />}
                </span>
              )}
            </button>
          )
        })}
      </div>
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        {LEGEND.map((l) => (
          <span key={l.label} className="flex items-center gap-1.5">
            <span className={cn('size-2 rounded-full', l.cls)} /> {l.label}
          </span>
        ))}
      </div>
    </div>
  )
}
