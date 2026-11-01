import { ArrowLeft } from 'lucide-react'
import { Link, Navigate, useParams } from 'react-router'
import { ErrorState } from '@/components/common/EmptyState'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { BusinessHoursForm } from '../components/BusinessHoursForm'
import { BranchesPage } from '@/features/branches/pages/BranchesPage'
import { LeaveTypesForm } from '../components/LeaveTypesForm'
import { NotificationPrefsForm } from '../components/NotificationPrefsForm'
import { PerformanceWeightsForm } from '../components/PerformanceWeightsForm'
import { RulesForm } from '../components/RulesForm'
import { SecuritySection } from '../components/SecuritySection'
import { ShiftsCard } from '../components/ShiftsCard'
import { ShopInfoForm } from '../components/ShopInfoForm'
import { ShopLocationForm } from '../components/ShopLocationForm'
import { TaskCategoriesForm } from '../components/TaskCategoriesForm'
import { useBranch } from '../queries'

export function SettingsSectionPage() {
  const { section } = useParams()
  const branch = useBranch()

  if (branch.error) return <ErrorState error={branch.error} onRetry={() => void branch.refetch()} />
  if (branch.isPending) return <Skeleton className="h-64 w-full max-w-3xl rounded-xl" />
  // BranchGate guarantees the branch exists for manager routes.
  const b = branch.data
  if (!b) return <Navigate to="/settings" replace />

  // `key` remounts forms after a save so their local state starts from the saved values.
  const key = b.updatedAt.getTime()
  const body = {
    shop: <ShopInfoForm key={key} branch={b} />,
    hours: (
      <>
        <BusinessHoursForm key={key} branch={b} />
        <ShiftsCard />
      </>
    ),
    location: <ShopLocationForm key={key} branch={b} />,
    rules: <RulesForm key={key} branch={b} />,
    leave: <LeaveTypesForm key={key} branch={b} />,
    branches: <BranchesPage />,
    tasks: <TaskCategoriesForm key={key} branch={b} />,
    notifications: <NotificationPrefsForm key={key} branch={b} />,
    performance: <PerformanceWeightsForm key={key} branch={b} />,
    security: <SecuritySection />,
  }[section ?? '']

  if (!body) return <Navigate to="/settings" replace />
  return (
    <div className="max-w-3xl space-y-4">
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link to="/settings">
          <ArrowLeft /> Settings
        </Link>
      </Button>
      {body}
    </div>
  )
}
