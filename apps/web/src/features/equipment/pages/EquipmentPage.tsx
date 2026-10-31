import type { Equipment } from '@dm/shared'
import { ModuleTabs } from '@/features/records/components/ModuleTabs'
import { RecordList } from '@/features/records/components/RecordList'
import { useModuleContext } from '@/features/records/context'
import { useRecords } from '@/features/records/queries'
import { equipmentModule, maintenanceModule } from '../modules'

/** Manager: machines with warranty and service dates, and the service / repair log. */
export function EquipmentPage() {
  const ctx = useModuleContext()
  const equipment = useRecords<Equipment>('equipment')
  return (
    <ModuleTabs
      title="Equipment"
      description="You're reminded before a service is due or a warranty ends. A breakdown marks the machine for repair."
      loading={!ctx || equipment.isPending}
      tabs={
        ctx
          ? [
              {
                value: 'equipment',
                label: 'Machines',
                content: <RecordList module={equipmentModule(ctx)} header={false} />,
              },
              {
                value: 'maintenance',
                label: 'Service & repairs',
                content: (
                  <RecordList
                    module={maintenanceModule(ctx, equipment.data ?? [])}
                    header={false}
                  />
                ),
              },
            ]
          : []
      }
    />
  )
}
