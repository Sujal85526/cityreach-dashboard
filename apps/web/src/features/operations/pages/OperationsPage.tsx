import { ChecklistsPanel } from '@/features/checklists/components/ChecklistsPanel'
import { useModuleContext } from '@/features/records/context'
import { ModuleTabs } from '@/features/records/components/ModuleTabs'
import { RecordList } from '@/features/records/components/RecordList'
import { handoversModule, incidentsModule } from '../modules'

/** Manager: today's checklists, shift handovers and incident reports. */
export function OperationsPage() {
  const ctx = useModuleContext()
  return (
    <ModuleTabs
      title="Checklists & logs"
      description="Opening / closing routines, notes between shifts and anything that went wrong."
      loading={!ctx}
      tabs={
        ctx
          ? [
              {
                value: 'checklists',
                label: 'Checklists',
                content: <ChecklistsPanel today={ctx.today} />,
              },
              {
                value: 'handovers',
                label: 'Handovers',
                content: <RecordList module={handoversModule(ctx)} header={false} />,
              },
              {
                value: 'incidents',
                label: 'Incidents',
                content: <RecordList module={incidentsModule(ctx)} header={false} />,
              },
            ]
          : []
      }
    />
  )
}
