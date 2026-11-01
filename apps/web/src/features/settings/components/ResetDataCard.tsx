import { Loader2, RotateCcw } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { resetDemoData } from '@/lib/store'

/** Settings card: wipe every change made here and start again from the original data. */
export function ResetDataCard() {
  const queryClient = useQueryClient()
  const [confirm, setConfirm] = useState(false)
  const reset = useMutation({
    mutationFn: async () => {
      await new Promise((resolve) => setTimeout(resolve, 500))
      resetDemoData()
    },
    onSuccess: () => {
      setConfirm(false)
      toast.success('Data reset to its starting point')
      void queryClient.invalidateQueries()
    },
  })

  return (
    <Card>
      <CardContent className="flex items-start gap-4">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent text-primary">
          <RotateCcw className="size-5" aria-hidden />
        </span>
        <div className="flex-1 space-y-2">
          <div className="font-medium">Reset data</div>
          <p className="text-sm text-muted-foreground">
            Everything you change here is saved in this browser. Reset brings back the original
            staff, attendance, tasks, stock, sales and documents, the original passwords, and
            removes any fingerprints you set up. Dates refresh each day automatically.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setConfirm(true)}
            disabled={reset.isPending}
          >
            {reset.isPending && <Loader2 className="animate-spin" />} Reset data
          </Button>
        </div>
      </CardContent>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Reset all data?"
        description="Your changes are discarded and the original data comes back."
        confirmLabel="Reset data"
        destructive
        pending={reset.isPending}
        onConfirm={() => reset.mutate()}
      />
    </Card>
  )
}
