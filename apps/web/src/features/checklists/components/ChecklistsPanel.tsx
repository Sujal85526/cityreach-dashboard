import {
  CHECKLIST_KINDS,
  checklistTemplateSchema,
  type ChecklistRun,
  type ChecklistTemplate,
} from '@dm/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, ClipboardCheck, ListChecks, Settings2 } from 'lucide-react'
import { useState } from 'react'
import { z } from 'zod'
import { toast } from 'sonner'
import { EmptyState, ErrorState } from '@/components/common/EmptyState'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { useCurrentUser } from '@/features/auth/session'
import { RecordList, type RecordModule } from '@/features/records/components/RecordList'
import { useRecords } from '@/features/records/queries'
import { errorMessage } from '@/lib/errors'
import { qk, refreshLists } from '@/lib/query-keys'
import { cn } from '@/lib/utils'
import { listRuns, toggleItem } from '../api'

const templatesModule: RecordModule<ChecklistTemplate> = {
  coll: 'checklistTemplates',
  noun: 'checklist',
  title: 'Checklists',
  description: 'Opening, closing and cleaning routines. One item per line.',
  icon: ListChecks,
  schema: checklistTemplateSchema.pick({ name: true, kind: true }).extend({
    itemsText: z.string().trim().min(1, 'add at least one item').max(5000),
  }),
  fields: [
    { key: 'name', label: 'Name', type: 'text', placeholder: 'e.g. Opening' },
    { key: 'kind', label: 'Kind', type: 'select', options: CHECKLIST_KINDS },
    {
      key: 'itemsText',
      label: 'Items (one per line)',
      type: 'textarea',
      placeholder: 'Turn on espresso machine\nCheck fridge temperatures\nFill milk station',
    },
  ],
  toForm: (t) => ({ name: t.name, kind: t.kind, itemsText: t.items.join('\n') }),
  prepare: ({ itemsText, ...d }) => ({
    ...d,
    items: String(itemsText)
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .slice(0, 40),
  }),
  defaults: () => ({ kind: 'Opening' }),
  columns: [
    {
      key: 'name',
      header: 'Checklist',
      cell: (t) => <span className="font-medium">{t.name}</span>,
    },
    { key: 'kind', header: 'Kind', cell: (t) => t.kind },
    { key: 'items', header: 'Items', cell: (t) => t.items.length },
  ],
  searchText: (t) => `${t.name} ${t.items.join(' ')}`,
  describe: (d) => String(d.name),
}

/**
 * Today's checklists (staff and managers tick items; done by whom and when is kept). Managers can
 * switch to editing the templates.
 */
export function ChecklistsPanel({ today, kinds }: { today: string; kinds?: string[] }) {
  const user = useCurrentUser()
  const manager = user.access.role !== 'employee'
  const [managing, setManaging] = useState(false)
  const templates = useRecords<ChecklistTemplate>('checklistTemplates')
  const runs = useQuery({
    queryKey: qk.checklistRuns(user.access.branchId, today),
    queryFn: () => listRuns(user.access.branchId, today),
  })
  const queryClient = useQueryClient()
  const tick = useMutation({
    mutationFn: ({ t, index }: { t: ChecklistTemplate; index: number }) =>
      toggleItem(t, today, index, user),
    onSuccess: () => refreshLists(queryClient, qk.checklistRuns(user.access.branchId, today)),
    onError: (e) => toast.error(errorMessage(e)),
  })

  if (managing)
    return (
      <div className="space-y-3">
        <Button variant="outline" onClick={() => setManaging(false)}>
          <ClipboardCheck /> Back to today's checklists
        </Button>
        <RecordList module={templatesModule} />
      </div>
    )
  const error = templates.error ?? runs.error
  if (error) return <ErrorState error={error} />
  if (!templates.data || !runs.data) return <Skeleton className="h-40 w-full" />
  const shown = templates.data.filter((t) => !kinds || kinds.includes(t.kind))

  return (
    <div className="space-y-4">
      {manager && (
        <div className="flex justify-end">
          <Button variant="outline" onClick={() => setManaging(true)}>
            <Settings2 /> Edit checklists
          </Button>
        </div>
      )}
      {shown.length === 0 ? (
        <EmptyState
          icon={ListChecks}
          title="No checklists yet"
          description={
            manager
              ? 'Create opening, closing and cleaning checklists with "Edit checklists".'
              : "Your manager hasn't set any up yet."
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {shown.map((t) => {
            const run = runs.data.find((r) => r.templateId === t.id) as ChecklistRun | undefined
            const items =
              run?.items ?? t.items.map((text) => ({ text, done: false, by: null, at: null }))
            const done = items.filter((i) => i.done).length
            return (
              <div key={t.id} className="space-y-3 rounded-xl border p-4">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="font-medium">{t.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {t.kind} · {done}/{items.length} done
                    </div>
                  </div>
                  {run?.completedAt && (
                    <span className="flex items-center gap-1 text-xs text-success">
                      <CheckCircle2 className="size-4" /> Complete
                    </span>
                  )}
                </div>
                <Progress
                  value={items.length ? (done / items.length) * 100 : 0}
                  aria-label={`${t.name} progress`}
                />
                <ul className="space-y-1">
                  {items.map((item, index) => (
                    <li key={index}>
                      <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted/50">
                        <Checkbox
                          checked={item.done}
                          disabled={tick.isPending}
                          onCheckedChange={() => tick.mutate({ t, index })}
                        />
                        <span
                          className={cn(
                            'flex-1 text-sm',
                            item.done && 'text-muted-foreground line-through',
                          )}
                        >
                          {item.text}
                        </span>
                        {item.by && (
                          <span className="text-xs text-muted-foreground">{item.by}</span>
                        )}
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
