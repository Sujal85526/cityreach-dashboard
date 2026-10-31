import { Loader2, Star } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import type { ZodType } from 'zod'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

export interface Option {
  value: string
  label: string
}

/**
 * One form field. `select` uses `options`; `reference` is a select whose options come from data
 * (employees, equipment, suppliers) and also stores the chosen label under `nameKey`.
 */
export interface FieldDef {
  key: string
  label: string
  type: 'text' | 'textarea' | 'number' | 'money' | 'date' | 'select' | 'reference' | 'rating'
  options?: readonly (string | Option)[]
  nameKey?: string
  placeholder?: string
  hint?: string
  min?: number
  max?: number
  step?: number
  /** Optional fields may be left empty (stored as null / ""). */
  optional?: boolean
  /** Takes the full row on wide screens. */
  wide?: boolean
  /** Shown only when this returns true for the current values. */
  when?: (values: Values) => boolean
}

export type Values = Record<string, string>

const asOption = (o: string | Option): Option =>
  typeof o === 'string' ? { value: o, label: o } : o
const isNumeric = (t: FieldDef['type']) => t === 'number' || t === 'money' || t === 'rating'

/** Record → form strings. */
export const toValues = (fields: FieldDef[], record: Record<string, unknown>): Values =>
  Object.fromEntries(
    fields.map((f) => {
      const v = record[f.key]
      return [f.key, v === null || v === undefined ? '' : String(v)]
    }),
  )

/** Form strings → record fields (numbers, nulls, copied reference names). */
export function fromValues(fields: FieldDef[], values: Values): Record<string, unknown> {
  const data: Record<string, unknown> = {}
  for (const f of fields) {
    if (f.when && !f.when(values)) continue
    const raw = (values[f.key] ?? '').trim()
    if (isNumeric(f.type)) data[f.key] = raw === '' ? null : Number(raw)
    else if (f.type === 'date' || f.type === 'reference') data[f.key] = raw === '' ? null : raw
    else data[f.key] = raw
    if (f.type === 'reference' && f.nameKey)
      data[f.nameKey] = f.options?.map(asOption).find((o) => o.value === raw)?.label ?? null
  }
  return data
}

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: FieldDef
  value: string
  onChange: (v: string) => void
}) {
  const id = `f-${field.key}`
  if (field.type === 'textarea')
    return (
      <Textarea
        id={id}
        value={value}
        placeholder={field.placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    )
  if (field.type === 'select' || field.type === 'reference')
    return (
      <Select value={value || undefined} onValueChange={onChange}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue placeholder={field.placeholder ?? 'Choose…'} />
        </SelectTrigger>
        <SelectContent>
          {(field.options ?? []).map(asOption).map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    )
  if (field.type === 'rating')
    return (
      <div className="flex gap-1" role="radiogroup" aria-label={field.label}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={Number(value) === n}
            aria-label={`${n} star${n === 1 ? '' : 's'}`}
            onClick={() => onChange(String(n))}
            className="rounded p-1 hover:bg-muted"
          >
            <Star
              className={cn(
                'size-6',
                Number(value) >= n ? 'fill-warning text-warning' : 'text-muted-foreground',
              )}
            />
          </button>
        ))}
      </div>
    )
  return (
    <Input
      id={id}
      type={field.type === 'date' ? 'date' : isNumeric(field.type) ? 'number' : 'text'}
      inputMode={isNumeric(field.type) ? 'decimal' : undefined}
      min={field.min}
      max={field.max}
      step={field.step ?? (field.type === 'money' ? 0.01 : undefined)}
      value={value}
      placeholder={field.placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}

/**
 * Add / edit dialog for a record, built from field definitions and checked with the module's zod
 * schema before saving (the same schema the shared package exports).
 */
export function RecordForm({
  title,
  description,
  fields,
  initial,
  schema,
  pending,
  onSubmit,
  onClose,
}: {
  title: string
  description?: string
  fields: FieldDef[]
  initial: Values
  schema: ZodType
  pending: boolean
  onSubmit: (data: Record<string, unknown>) => void
  onClose: () => void
}) {
  const [values, setValues] = useState<Values>(initial)
  const shown = fields.filter((f) => !f.when || f.when(values))

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const missing = shown.find((f) => !f.optional && (values[f.key] ?? '').trim() === '')
    if (missing) return toast.error(`${missing.label} is required.`)
    const data = fromValues(fields, values)
    const check = schema.safeParse(data)
    if (!check.success) {
      const issue = check.error.issues[0]
      const label = fields.find((f) => f.key === issue?.path[0])?.label ?? 'A field'
      return toast.error(`${label}: ${issue?.message ?? 'check the value'}`)
    }
    onSubmit(data)
  }

  return (
    <Dialog open onOpenChange={(o) => !o && !pending && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={submit} noValidate className="space-y-4">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            {shown.map((f) => (
              <div
                key={f.key}
                className={cn('space-y-1.5', (f.wide || f.type === 'textarea') && 'sm:col-span-2')}
              >
                <Label htmlFor={`f-${f.key}`}>
                  {f.label}
                  {f.optional && (
                    <span className="font-normal text-muted-foreground"> (optional)</span>
                  )}
                </Label>
                <FieldInput
                  field={f}
                  value={values[f.key] ?? ''}
                  onChange={(v) => setValues((cur) => ({ ...cur, [f.key]: v }))}
                />
                {f.hint && <p className="text-xs text-muted-foreground">{f.hint}</p>}
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
