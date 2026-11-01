import { zodResolver } from '@hookform/resolvers/zod'
import { changePasswordSchema, type ChangePasswordForm as Values } from '@cityreach/shared'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { PasswordInput } from '@/components/common/PasswordInput'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { AuthError } from '@/features/auth/api'
import { useChangePassword } from '@/features/auth/queries'
import { errorMessage } from '@/lib/errors'
import { SettingsCard } from './SettingsCard'

const EMPTY: Values = { currentPassword: '', newPassword: '', confirmPassword: '' }

/** Anyone signed in can change their own password; they must know the current one. */
export function ChangePasswordForm() {
  const change = useChangePassword()
  const form = useForm<Values>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: EMPTY,
  })

  const onSubmit = form.handleSubmit(async ({ currentPassword, newPassword }) => {
    try {
      await change.mutateAsync({ currentPassword, newPassword })
      toast.success('Password changed')
      form.reset(EMPTY)
    } catch (error) {
      if (error instanceof AuthError && error.code === 'invalid')
        form.setError('currentPassword', { message: error.message }, { shouldFocus: true })
      else toast.error(errorMessage(error))
    }
  })

  const field = (
    name: keyof Values,
    label: string,
    autoComplete: 'current-password' | 'new-password',
  ) => (
    <FormField
      control={form.control}
      name={name}
      render={({ field: f }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <PasswordInput {...f} autoComplete={autoComplete} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  )

  return (
    <Form {...form}>
      <SettingsCard
        title="Password"
        description="Change the password you sign in with. At least 8 characters."
        onSubmit={onSubmit}
        saving={change.isPending}
        dirty={form.formState.isDirty}
        submitLabel="Change password"
      >
        <div className="grid max-w-sm gap-4">
          {field('currentPassword', 'Current password', 'current-password')}
          {field('newPassword', 'New password', 'new-password')}
          {field('confirmPassword', 'Confirm new password', 'new-password')}
        </div>
      </SettingsCard>
    </Form>
  )
}
