import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface NumberFieldProps {
  id: string
  label: string
  hint: string
  value: number
  onChange: (value: number) => void
  min: number
  max: number
  suffix: string
}

/** Labelled number input with a unit and an explanation, used by the rule settings. */
export function NumberField({
  id,
  label,
  hint,
  value,
  onChange,
  min,
  max,
  suffix,
}: NumberFieldProps) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-2">
        <Input
          id={id}
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          value={Number.isNaN(value) ? '' : value}
          onChange={(e) => onChange(e.target.valueAsNumber)}
          className="w-28"
        />
        <span className="text-sm text-muted-foreground">{suffix}</span>
      </div>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  )
}

export const inRange = (v: number, min: number, max: number) =>
  Number.isInteger(v) && v >= min && v <= max
