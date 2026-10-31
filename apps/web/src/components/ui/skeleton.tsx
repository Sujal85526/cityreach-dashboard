import { cn } from 'cn'

function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="skeleton"
      className={cn(
        'rounded-md bg-[linear-gradient(90deg,var(--muted)_25%,var(--accent)_50%,var(--muted)_75%)] bg-[length:200%_100%] motion-safe:animate-[shimmer_1.6s_linear_infinite]',
        className,
      )}
      {...props}
    />
  )
}

export { Skeleton }
