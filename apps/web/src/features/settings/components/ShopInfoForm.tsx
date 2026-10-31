import { branchInfoSchema, type Branch, type BranchInfo } from '@cityreach/shared'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { errorMessage } from '@/lib/errors'
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
import { useUpdateBranch } from '../queries'
import { TIME_ZONES } from '../timezones'
import { SettingsCard } from './SettingsCard'

export const toBranchInfo = (b: Branch): BranchInfo => ({
  name: b.name,
  address: b.address,
  phone: b.phone,
  timeZone: b.rules.timeZone,
})

/** Name, address, phone and timezone fields; shared by Settings and the first-run setup. */
export function ShopInfoFields({ form }: { form: ReturnType<typeof useShopInfoForm> }) {
  const zones = TIME_ZONES.some((z) => z.value === form.watch('timeZone'))
    ? TIME_ZONES
    : [...TIME_ZONES, { value: form.watch('timeZone'), label: form.watch('timeZone') }]
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {(['name', 'phone', 'address'] as const).map((name) => (
        <FormField
          key={name}
          control={form.control}
          name={name}
          render={({ field }) => (
            <FormItem className={name === 'address' ? 'sm:col-span-2' : undefined}>
              <FormLabel>
                {{ name: 'Shop name', phone: 'Phone', address: 'Address' }[name]}
              </FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      ))}
      <FormField
        control={form.control}
        name="timeZone"
        render={({ field }) => (
          <FormItem className="sm:col-span-2">
            <FormLabel>Timezone (shift times and reports use it)</FormLabel>
            <Select value={field.value} onValueChange={field.onChange}>
              <FormControl>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {zones.map((z) => (
                  <SelectItem key={z.value} value={z.value}>
                    {z.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  )
}

export const useShopInfoForm = (defaults: BranchInfo) =>
  useForm<BranchInfo>({ resolver: zodResolver(branchInfoSchema), defaultValues: defaults })

export function ShopInfoForm({ branch }: { branch: Branch }) {
  const form = useShopInfoForm(toBranchInfo(branch))
  const update = useUpdateBranch()
  const onSubmit = form.handleSubmit(({ timeZone, ...info }) =>
    update.mutate(
      { patch: { ...info, rules: { ...branch.rules, timeZone } }, what: 'shop information' },
      {
        onSuccess: () => {
          form.reset({ ...info, timeZone })
          toast.success('Shop information saved')
        },
        onError: (e) => toast.error(errorMessage(e)),
      },
    ),
  )
  return (
    <Form {...form}>
      <SettingsCard
        title="Coffee shop information"
        description="Shown across the app and on reports."
        onSubmit={onSubmit}
        saving={update.isPending}
        dirty={form.formState.isDirty}
      >
        <ShopInfoFields form={form} />
      </SettingsCard>
    </Form>
  )
}
