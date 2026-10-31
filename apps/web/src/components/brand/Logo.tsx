import { cn } from '@/lib/utils'
import { WORDMARK_FLIP, WORDMARK_PATH } from './wordmark-path'

/** The traced City Reach wordmark. Takes its colour from the text colour (currentColor). */
export function Wordmark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="1300 450 70800 6800"
      role="img"
      aria-label="City Reach"
      className={cn('h-4 w-auto', className)}
      fill="currentColor"
    >
      <g transform={WORDMARK_FLIP}>
        <path d={WORDMARK_PATH} />
      </g>
    </svg>
  )
}

/** The first letter of the wordmark as a compact mark (collapsed sidebar, avatars, favicon). */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="1100 -150 5800 7400"
      aria-hidden
      className={cn('size-5', className)}
      fill="currentColor"
      preserveAspectRatio="xMidYMid meet"
    >
      <g transform={WORDMARK_FLIP}>
        <path d={WORDMARK_PATH} />
      </g>
    </svg>
  )
}
