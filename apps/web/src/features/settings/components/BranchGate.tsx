import { DEFAULT_BRANCH_RULES } from '@cityreach/shared'
import { Coffee } from 'lucide-react'
import { Outlet } from 'react-router'
import { toast } from 'sonner'
import { errorMessage } from '@/lib/errors'
import { FullScreenLoader } from '@/app/guards'
import { ErrorState } from '@/components/common/EmptyState'
import { Form } from '@/components/ui/form'
import { useCreateBranch, useBranch } from '../queries'
import { SettingsCard } from './SettingsCard'
import { ShopInfoFields, useShopInfoForm } from './ShopInfoForm'

/**
 * Manager routes need the branch document. On a fresh production project it doesn't exist yet,
 * so the first manager sets the shop up here (defaults for every other setting).
 */
export function BranchGate() {
  const branch = useBranch()
  if (branch.isPending) return <FullScreenLoader />
  if (branch.error)
    return (
      <div className="p-6">
        <ErrorState error={branch.error} onRetry={() => void branch.refetch()} />
      </div>
    )
  return branch.data ? <Outlet /> : <BranchSetup />
}

function BranchSetup() {
  const create = useCreateBranch()
  const form = useShopInfoForm({
    name: '',
    address: '',
    phone: '',
    timeZone: DEFAULT_BRANCH_RULES.timeZone,
  })
  const onSubmit = form.handleSubmit((info) =>
    create.mutate(info, {
      onSuccess: () => toast.success('Your shop is ready'),
      onError: (e) => toast.error(errorMessage(e)),
    }),
  )

  return (
    <div className="flex min-h-svh items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-xl space-y-4">
        <div className="flex items-center gap-2 text-lg font-semibold">
          <Coffee className="size-5 text-primary" /> Welcome to Digital Manager
        </div>
        <Form {...form}>
          <SettingsCard
            title="Set up your coffee shop"
            description="One-time setup. Hours, rules and categories start with sensible defaults you can change in Settings."
            onSubmit={onSubmit}
            saving={create.isPending}
            submitLabel="Create shop"
          >
            <ShopInfoFields form={form} />
          </SettingsCard>
        </Form>
      </div>
    </div>
  )
}
