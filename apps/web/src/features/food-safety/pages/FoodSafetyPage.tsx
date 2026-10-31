import { COLD_UNITS, type Equipment, type TemperatureLog } from '@dm/shared'
import { ShieldCheck, Thermometer, ThermometerSnowflake } from 'lucide-react'
import { StatCard } from '@/components/common/StatCard'
import { ChecklistsPanel } from '@/features/checklists/components/ChecklistsPanel'
import { ModuleTabs } from '@/features/records/components/ModuleTabs'
import { RecordList } from '@/features/records/components/RecordList'
import { useModuleContext } from '@/features/records/context'
import { useRecords } from '@/features/records/queries'
import { inspectionsModule, temperatureModule } from '../modules'

/** Manager: temperature log, cleaning checklists and inspections (food-safety self-control). */
export function FoodSafetyPage() {
  const ctx = useModuleContext()
  const equipment = useRecords<Equipment>('equipment')
  const temps = useRecords<TemperatureLog>('temperatureLogs')
  const cold = (equipment.data ?? []).filter(
    (e) => COLD_UNITS.includes(e.kind) && e.tempMin != null && e.tempMax != null,
  )
  const today = ctx?.today ?? ''
  const todays = (temps.data ?? []).filter((t) => t.date === today)
  const unlogged = cold.filter((u) => !todays.some((t) => t.equipmentId === u.id)).length
  const outOfRange = todays.filter((t) => !t.ok).length

  return (
    <ModuleTabs
      title="Food safety"
      description="Temperature records, cleaning and inspections, kept for the authority's self-inspection."
      loading={!ctx || equipment.isPending}
      top={
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard
            label="Cold units"
            icon={ThermometerSnowflake}
            loading={equipment.isPending}
            value={cold.length}
            caption="Fridges and freezers with a range"
          />
          <StatCard
            label="Not logged today"
            icon={Thermometer}
            loading={temps.isPending}
            value={unlogged}
            caption="Cold units without a reading today"
            badge={unlogged ? { text: 'Log now', tone: 'warning' } : undefined}
          />
          <StatCard
            label="Out of range today"
            icon={ShieldCheck}
            loading={temps.isPending}
            value={outOfRange}
            caption="Readings outside the allowed range"
            badge={outOfRange ? { text: 'Check the unit', tone: 'danger' } : undefined}
          />
        </div>
      }
      tabs={
        ctx
          ? [
              {
                value: 'temperatures',
                label: 'Temperatures',
                content: <RecordList module={temperatureModule(ctx, cold)} header={false} />,
              },
              {
                value: 'cleaning',
                label: 'Cleaning',
                content: <ChecklistsPanel today={ctx.today} kinds={['Cleaning']} />,
              },
              {
                value: 'inspections',
                label: 'Inspections',
                content: <RecordList module={inspectionsModule(ctx)} header={false} />,
              },
            ]
          : []
      }
    />
  )
}
