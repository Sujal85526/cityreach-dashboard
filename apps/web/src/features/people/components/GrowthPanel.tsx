import type { User } from '@cityreach/shared'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { RecordList } from '@/features/records/components/RecordList'
import { useModuleContext } from '@/features/records/context'
import { goalsModule, trainingModule } from '../modules'

/** Training and goals for one employee (manager edits; the employee sees their own). */
export function GrowthPanel({ employee }: { employee: Pick<User, 'id' | 'name'> }) {
  const ctx = useModuleContext()
  if (!ctx) return <Skeleton className="h-48 w-full rounded-xl" />
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Card>
        <CardContent className="pt-6">
          <RecordList module={trainingModule(ctx, employee)} />
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6">
          <RecordList module={goalsModule(ctx, employee)} />
        </CardContent>
      </Card>
    </div>
  )
}
