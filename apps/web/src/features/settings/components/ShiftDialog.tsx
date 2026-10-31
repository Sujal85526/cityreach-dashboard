import { shiftInputSchema, type Shift, type ShiftInput } from '@cityreach/shared'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { errorMessage } from '@/lib/errors'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { useSaveShift } from '../queries'
import { DAY_NAMES } from './BusinessHoursForm'

const EMPTY: ShiftInput = { name: '', start: '07:00', end: '15:00', days: [1, 2, 3, 4, 5, 6] }

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  shift?: Shift
}

export function ShiftDialog({ open, onOpenChange, shift }: Props) {
  const save = useSaveShift()
  const form = useForm<ShiftInput>({
    resolver: zodResolver(shiftInputSchema),
    defaultValues: EMPTY,
  })

  useEffect(() => {
    if (open)
      form.reset(
        shift ? { name: shift.name, start: shift.start, end: shift.end, days: shift.days } : EMPTY,
      )
  }, [open, shift, form])

  const onSubmit = form.handleSubmit((input) =>
    save.mutate(
      { id: shift?.id ?? null, input: { ...input, days: [...input.days].sort((a, b) => a - b) } },
      {
        onSuccess: () => {
          toast.success(shift ? 'Shift updated' : 'Shift added')
          onOpenChange(false)
        },
        onError: (e) => toast.error(errorMessage(e)),
      },
    ),
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{shift ? 'Edit shift' : 'Add shift'}</DialogTitle>
          <DialogDescription>
            Lateness is measured from the start time. A shift may end after midnight.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Morning" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              {(['start', 'end'] as const).map((name) => (
                <FormField
                  key={name}
                  control={form.control}
                  name={name}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{name === 'start' ? 'Starts' : 'Ends'}</FormLabel>
                      <FormControl>
                        <Input type="time" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ))}
            </div>
            <FormField
              control={form.control}
              name="days"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Days</FormLabel>
                  <div className="flex flex-wrap gap-3">
                    {DAY_NAMES.map((day, i) => (
                      <label key={day} className="flex items-center gap-1.5 text-sm">
                        <Checkbox
                          checked={field.value.includes(i)}
                          onCheckedChange={(on) =>
                            field.onChange(
                              on ? [...field.value, i] : field.value.filter((d) => d !== i),
                            )
                          }
                        />
                        {day.slice(0, 3)}
                      </label>
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={save.isPending}>
                {save.isPending && <Loader2 className="animate-spin" />} Save shift
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
