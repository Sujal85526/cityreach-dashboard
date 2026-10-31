import { useCountUp } from '@/hooks/use-count-up'

/** A number that counts up when it first appears. Pass `format` for money or units. */
export function CountUp({
  value,
  format = (n: number) => Math.round(n).toLocaleString('en-GB'),
}: {
  value: number
  format?: (n: number) => string
}) {
  const shown = useCountUp(value)
  return <span className="tabular-nums">{format(shown)}</span>
}
