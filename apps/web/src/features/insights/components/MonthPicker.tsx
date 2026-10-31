import { Input } from '@/components/ui/input'

export function MonthPicker({
  month,
  max,
  onChange,
}: {
  month: string
  max: string
  onChange: (month: string) => void
}) {
  return (
    <Input
      type="month"
      value={month}
      max={max}
      onChange={(e) => e.target.value && onChange(e.target.value)}
      className="w-auto"
      aria-label="Month"
    />
  )
}
