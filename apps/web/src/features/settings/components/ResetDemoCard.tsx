import { Loader2, RotateCcw } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { resetDemoData } from '@/lib/store'

/** Settings card: wipe every change made in the demo and start again from the sample business. */
export function ResetDemoCard() {
  const queryClient = useQueryClient()
  const [confirm, setConfirm] = useState(false)
  const reset = useMutation({
    mutationFn: async () => {
      await new Promise((resolve) => setTimeout(resolve, 500))
      resetDemoData()
    },
    onSuccess: () => {
      setConfirm(false)
      toast.success('Demo data reset to its starting point')
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
          <div className="font-medium">Demo data</div>
          <p className="text-sm text-muted-foreground">
            Everything you change here is saved in this browser only. Reset brings back the original
            staff, attendance, tasks, stock, sales and documents, the demo passwords, and removes
            any fingerprints you set up. The sample dates refresh each day automatically.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setConfirm(true)}
            disabled={reset.isPending}
          >
            {reset.isPending && <Loader2 className="animate-spin" />} Reset demo data
          </Button>
        </div>
      </CardContent>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Reset the demo data?"
        description="Your changes are discarded and the original sample business comes back."
        confirmLabel="Reset demo data"
        destructive
        pending={reset.isPending}
        onConfirm={() => reset.mutate()}
      />
    </Card>
  )
}
