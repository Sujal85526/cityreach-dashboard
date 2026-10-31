import { Database, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCurrentUser } from '@/features/auth/session'
import { refreshPerformance } from '@/features/performance/api'
import { errorMessage } from '@/lib/errors'
import { listEmployees } from '@/features/employees/api'
import { useBranch } from '../queries'
import { hasSampleData, loadSampleData, removeSampleData } from '../sample'

/** Settings card: load the demo café for a walkthrough, or remove it before real use. */
export function SampleDataCard() {
  const actor = useCurrentUser()
  const branch = useBranch().data
  const queryClient = useQueryClient()
  const [confirm, setConfirm] = useState(false)
  const status = useQuery({
    queryKey: ['sample', actor.access.branchId],
    queryFn: () => hasSampleData(actor.access.branchId),
  })

  const done = (message: string) => {
    toast.success(message)
    void queryClient.invalidateQueries()
  }
  const load = useMutation({
    mutationFn: async () => {
      if (!branch) throw new Error('Still loading, try again in a moment.')
      const count = await loadSampleData(branch, actor)
      // Scores and employee stats for the new history straight away.
      await refreshPerformance(branch, await listEmployees(branch.id), actor)
      return count
    },
    onSuccess: (n) => done(`Sample café loaded (${n} records)`),
    onError: (e) => toast.error(errorMessage(e)),
  })
  const remove = useMutation({
    mutationFn: () => {
      if (!branch) throw new Error('Still loading, try again in a moment.')
      return removeSampleData(branch, actor)
    },
    onSuccess: (n) => {
      setConfirm(false)
      done(`Sample data removed (${n} records)`)
    },
    onError: (e) => toast.error(errorMessage(e)),
  })

  const loaded = status.data === true
  return (
    <Card>
      <CardContent className="flex items-start gap-4">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Database className="size-5" aria-hidden />
        </span>
        <div className="flex-1 space-y-2">
          <div className="font-medium">Sample data</div>
          <p className="text-sm text-muted-foreground">
            {loaded
              ? 'The demo café is loaded. Remove it before using the app for real; your own records are kept.'
              : 'Fill the app with a demo café (8 staff, shifts, two weeks of attendance, stock, tasks) to show how it works.'}
          </p>
          {loaded ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirm(true)}
              disabled={remove.isPending}
            >
              Remove sample data
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={() => load.mutate()}
              disabled={load.isPending || status.isPending}
            >
              {load.isPending && <Loader2 className="animate-spin" />} Load sample data
            </Button>
          )}
        </div>
      </CardContent>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Remove the sample data?"
        description="Deletes the demo staff, their attendance, tasks, stock, suppliers and shifts. Anything you added yourself stays."
        confirmLabel="Remove sample data"
        destructive
        pending={remove.isPending}
        onConfirm={() => remove.mutate()}
      />
    </Card>
  )
}
