import {
  canManageCredentials,
  EMPLOYMENT_STATUSES,
  newEmployeeSchema,
  employeeFormSchema,
  loginIdSchema,
  passwordSchema,
  ROLES,
  type NewEmployee,
  type User,
} from '@cityreach/shared'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { useEffect, useMemo } from 'react'
import { useForm, type Control, type FieldPath, type Resolver } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { errorMessage } from '@/lib/errors'
import { PasswordInput } from '@/components/common/PasswordInput'
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
  FormDescription,
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
import { AuthError } from '@/features/auth/api'
import { useLoginId } from '@/features/auth/queries'
import { useCurrentUser } from '@/features/auth/session'
import { useShifts } from '@/features/settings/queries'
import { shiftLabel } from '@/lib/format'
import { useCreateEmployee, useUpdateEmployee } from '../queries'

const POSITIONS = ['Barista', 'Shift Lead', 'Cashier', 'Cleaner', 'Owner']
const NO_SHIFT = 'none'
const ROLE_LABEL = { owner: 'Owner', manager: 'Manager', employee: 'Employee' } as const
/** Only an owner can make someone an owner. */
const roleOptions = (actorIsOwner: boolean) =>
  actorIsOwner ? ROLE_LABEL : { manager: ROLE_LABEL.manager, employee: ROLE_LABEL.employee }
const STATUS_LABEL = { active: 'Active', on_leave: 'On Leave', inactive: 'Inactive' } as const

// One form shape for add and edit; edit ignores the email (validated with employeeFormSchema).
type FormValues = NewEmployee
const EMPTY: FormValues = {
  name: '',
  email: '',
  loginId: '',
  password: '',
  phone: '',
  position: 'Barista',
  role: 'employee',
  status: 'active',
  shiftId: null,
  probationEndsOn: null,
}
/**
 * Editing never changes the email, so it is carried along unvalidated. The login ID and the
 * (optional) new password are checked only when this person may change them.
 */
const editSchema = (canEditLogin: boolean) =>
  employeeFormSchema.extend({
    email: z.string(),
    loginId: canEditLogin ? loginIdSchema : z.string(),
    password: canEditLogin ? z.union([z.literal(''), passwordSchema]) : z.string(),
  })

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Present when editing. */
  employee?: User
}

export function EmployeeFormDialog({ open, onOpenChange, employee }: Props) {
  const isEdit = Boolean(employee)
  const actor = useCurrentUser()
  const actorIsOwner = actor.access.role === 'owner'
  // A manager looks after employees' logins; only an owner changes a manager's. Not your own here.
  const canEditLogin = Boolean(
    employee && employee.id !== actor.uid && canManageCredentials(actor.access.role, employee.role),
  )
  const loginId = useLoginId(employee?.id ?? '')
  const create = useCreateEmployee()
  const update = useUpdateEmployee()
  const shifts = useShifts()
  const schema = useMemo(
    () => (isEdit ? editSchema(canEditLogin) : newEmployeeSchema),
    [isEdit, canEditLogin],
  )
  const form = useForm<FormValues>({
    resolver: zodResolver(schema) as unknown as Resolver<FormValues>,
    defaultValues: EMPTY,
  })

  const currentLoginId = loginId.data ?? ''
  useEffect(() => {
    if (open) form.reset(employee ? { ...EMPTY, ...employee, loginId: currentLoginId } : EMPTY)
  }, [open, employee, form, currentLoginId])

  const pending = create.isPending || update.isPending
  const onSubmit = form.handleSubmit(async ({ email, loginId: id, password, ...values }) => {
    try {
      if (employee)
        await update.mutateAsync({
          current: employee,
          input: values,
          login: canEditLogin ? { loginId: id, password } : undefined,
        })
      else await create.mutateAsync({ ...values, email, loginId: id, password })
      toast.success(
        employee
          ? password
            ? 'Employee updated and password reset'
            : 'Employee updated'
          : `${values.name} added to the team`,
      )
      onOpenChange(false)
    } catch (error) {
      if (error instanceof AuthError && error.code === 'taken') {
        form.setError('loginId', { message: error.message }, { shouldFocus: true })
        return
      }
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
              : 'Adds them to the team and creates the login they sign in with.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={onSubmit} className="grid items-start gap-4 sm:grid-cols-2" noValidate>
            <TextField
              control={form.control}
              name="name"
              label="Full name"
              className="sm:col-span-2"
            />
            {!isEdit && (
              <TextField control={form.control} name="email" label="Email" type="email" />
            )}
            <TextField
              control={form.control}
              name="phone"
              label="Phone"
              type="tel"
              className={isEdit ? 'sm:col-span-2' : undefined}
            />
            {(!isEdit || canEditLogin) && (
              <div className="grid items-start gap-4 sm:col-span-2 sm:grid-cols-2">
                <TextField
                  control={form.control}
                  name="loginId"
                  label="Login ID"
                  autoComplete="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  hint="Letters, numbers, dots, dashes. Not case-sensitive."
                />
                <PasswordField
                  control={form.control}
                  label={isEdit ? 'New password (optional)' : 'Password'}
                  hint={
                    isEdit
                      ? 'Leave empty to keep the current password.'
                      : 'At least 8 characters. Share it with them safely.'
                  }
                />
              </div>
            )}
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
  hint,
  ...input
}: {
  control: Control<FormValues>
  name: FieldPath<FormValues>
  label: string
  className?: string
  hint?: string
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
          {hint && <FormDescription>{hint}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  )
}

function PasswordField({
  control,
  label,
  hint,
}: {
  control: Control<FormValues>
  label: string
  hint: string
}) {
  return (
    <FormField
      control={control}
      name="password"
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <PasswordInput {...field} autoComplete="new-password" />
          </FormControl>
          <FormDescription>{hint}</FormDescription>
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

const friendlyError = errorMessage
