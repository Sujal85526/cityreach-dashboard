import {
  EMPLOYMENT_STATUSES,
  newEmployeeSchema,
  employeeFormSchema,
  ROLES,
  type NewEmployee,
  type User,
} from '@cityreach/shared'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { useEffect } from 'react'
import { useForm, type Control, type FieldPath, type Resolver } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { errorMessage } from '@/lib/errors'
import { SuggestInput } from '@/components/common/SuggestInput'
import { Button } from '@/components/ui/button'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useCurrentUser } from '@/features/auth/session'
import { useShifts } from '@/features/settings/queries'
import { shiftLabel } from '@/lib/format'
import { useCreateEmployee, useUpdateEmployee } from '../queries'

const POSITIONS = ['Barista', 'Shift Lead', 'Cashier', 'Cleaner', 'Owner']
const NO_SHIFT = 'none'
const ROLE_LABEL = { owner: 'Owner', manager: 'Manager', employee: 'Employee' } as const
/** Only an owner can make someone an owner (firestore.rules enforce it too). */
const roleOptions = (actorIsOwner: boolean) =>
  actorIsOwner ? ROLE_LABEL : { manager: ROLE_LABEL.manager, employee: ROLE_LABEL.employee }
const STATUS_LABEL = { active: 'Active', on_leave: 'On Leave', inactive: 'Inactive' } as const

// One form shape for add and edit; edit ignores email/password (validated with employeeFormSchema).
type FormValues = NewEmployee
const EMPTY: FormValues = {
  name: '',
  email: '',
  password: '',
  phone: '',
  position: 'Barista',
  role: 'employee',
  status: 'active',
  shiftId: null,
  probationEndsOn: null,
}
// Editing never changes the login, so email/password are carried along unvalidated.
const editSchema = employeeFormSchema.extend({ email: z.string(), password: z.string() })

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Present when editing. */
  employee?: User
}

export function EmployeeFormDialog({ open, onOpenChange, employee }: Props) {
  const isEdit = Boolean(employee)
  const actorIsOwner = useCurrentUser().access.role === 'owner'
  const create = useCreateEmployee()
  const update = useUpdateEmployee()
  const shifts = useShifts()
  const form = useForm<FormValues>({
    resolver: zodResolver(isEdit ? editSchema : newEmployeeSchema) as Resolver<FormValues>,
    defaultValues: EMPTY,
  })

  useEffect(() => {
    if (open) form.reset(employee ? { ...EMPTY, ...employee, password: '' } : EMPTY)
  }, [open, employee, form])

  const pending = create.isPending || update.isPending
  const onSubmit = form.handleSubmit(async ({ email, password, ...values }) => {
    try {
      if (employee) await update.mutateAsync({ current: employee, input: values })
      else await create.mutateAsync({ ...values, email, password })
      toast.success(
        employee ? 'Employee updated' : `${values.name} added. Share the password with them.`,
      )
      onOpenChange(false)
    } catch (error) {
      toast.error(friendlyError(error))
    }
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit employee' : 'Add employee'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Changes apply immediately.'
              : 'Creates their login. They sign in with this email and password.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2" noValidate>
            <TextField
              control={form.control}
              name="name"
              label="Full name"
              className="sm:col-span-2"
            />
            {!isEdit && (
              <>
                <TextField control={form.control} name="email" label="Email" type="email" />
                <TextField
                  control={form.control}
                  name="password"
                  label="First password"
                  type="text"
                />
              </>
            )}
            <TextField control={form.control} name="phone" label="Phone" type="tel" />
            <FormField
              control={form.control}
              name="position"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Position</FormLabel>
                  <FormControl>
                    <SuggestInput {...field} suggestions={POSITIONS} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="shiftId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Shift</FormLabel>
                  <Select
                    value={field.value ?? NO_SHIFT}
                    onValueChange={(v) => field.onChange(v === NO_SHIFT ? null : v)}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={NO_SHIFT}>No fixed shift</SelectItem>
                      {shifts.data?.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {shiftLabel(s)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="probationEndsOn"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Probation ends (optional)</FormLabel>
                  <FormControl>
                    <Input
                      type="date"
                      value={field.value ?? ''}
                      onChange={(e) => field.onChange(e.target.value || null)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <SelectField
              control={form.control}
              name="role"
              label="Access"
              options={roleOptions(actorIsOwner) as typeof ROLE_LABEL}
              keys={ROLES}
            />
            {isEdit && (
              <SelectField
                control={form.control}
                name="status"
                label="Status"
                options={STATUS_LABEL}
                keys={EMPLOYMENT_STATUSES}
              />
            )}
            <DialogFooter className="sm:col-span-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending && <Loader2 className="animate-spin" />}
                {isEdit ? 'Save changes' : 'Add employee'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

function TextField({
  control,
  name,
  label,
  className,
  ...input
}: {
  control: Control<FormValues>
  name: FieldPath<FormValues>
  label: string
  className?: string
} & React.ComponentProps<'input'>) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={className}>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input {...input} {...field} value={(field.value as string | null) ?? ''} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}

function SelectField<K extends string>({
  control,
  name,
  label,
  options,
  keys,
}: {
  control: Control<FormValues>
  name: 'role' | 'status'
  label: string
  options: Record<K, string>
  keys: readonly K[]
}) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <Select value={field.value} onValueChange={field.onChange}>
            <FormControl>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {keys.map((k) => (
                <SelectItem key={k} value={k}>
                  {options[k]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}

function friendlyError(error: unknown): string {
  const code = (error as { code?: string }).code
  if (code === 'auth/email-already-in-use') return 'An account with this email already exists.'
  if (code === 'auth/invalid-email') return 'That email address is not valid.'
  if (code === 'auth/weak-password') return 'Choose a stronger password (at least 8 characters).'
  return errorMessage(error)
}
