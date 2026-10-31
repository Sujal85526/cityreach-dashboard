import { useState } from 'react'
import { Input } from '@/components/ui/input'

const VALID = /^\d{4}-(0[1-9]|1[0-2])$/

/**
 * A month field. Browsers without a month picker (Safari on desktop) show plain text, so what is
 * typed is kept as a draft and only a complete "YYYY-MM" up to `max` is passed on.
 */
export function MonthPicker({
  month,
  max,
  onChange,
}: {
  month: string
  max: string
  onChange: (month: string) => void
}) {
  const [draft, setDraft] = useState(month)
  return (
    <Input
      type="month"
      value={draft}
      max={max}
      placeholder="YYYY-MM"
      inputMode="numeric"
      pattern="\d{4}-\d{2}"
      aria-label="Month"
      aria-invalid={draft !== '' && !VALID.test(draft)}
      onChange={(e) => {
        setDraft(e.target.value)
        if (VALID.test(e.target.value) && e.target.value <= max) onChange(e.target.value)
      }}
      className="w-auto"
    />
  )
}
