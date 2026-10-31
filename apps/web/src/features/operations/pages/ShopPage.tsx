import { COLD_UNITS, type Equipment } from '@dm/shared'
import { ChecklistsPanel } from '@/features/checklists/components/ChecklistsPanel'
import { temperatureModule } from '@/features/food-safety/modules'
import { ModuleTabs } from '@/features/records/components/ModuleTabs'
import { RecordList } from '@/features/records/components/RecordList'
import { useModuleContext } from '@/features/records/context'
import { useRecords } from '@/features/records/queries'
import { handoversModule, incidentsModule } from '../modules'

/** Employee (phone): tick today's checklists, log fridge temperatures, report incidents, leave a handover. */
export function ShopPage() {
  const ctx = useModuleContext()
  const equipment = useRecords<Equipment>('equipment')
  const cold = (equipment.data ?? []).filter(
    (e) => COLD_UNITS.includes(e.kind) && e.tempMin != null && e.tempMax != null,
  )
  return (
    <ModuleTabs
      title="Shop checklists & logs"
      description="Your part of running the shop today."
      loading={!ctx || equipment.isPending}
      tabs={
        ctx
          ? [
              {
                value: 'checklists',
                label: 'Checklists',
                content: <ChecklistsPanel today={ctx.today} />,
              },
              {
                value: 'temperatures',
                label: 'Temperatures',
                content: <RecordList module={temperatureModule(ctx, cold)} header={false} />,
              },
              {
                value: 'incidents',
                label: 'Report an incident',
                content: <RecordList module={incidentsModule(ctx)} header={false} />,
              },
              {
                value: 'handover',
                label: 'Handover',
                content: <RecordList module={handoversModule(ctx)} header={false} />,
              },
            ]
          : []
      }
    />
  )
}
