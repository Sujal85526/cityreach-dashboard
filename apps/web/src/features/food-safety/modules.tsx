import {
  INSPECTION_RESULTS,
  inspectionSchema,
  temperatureLogSchema,
  temperatureOk,
  type Equipment,
  type Inspection,
  type TemperatureLog,
} from '@dm/shared'
import { ClipboardList, Thermometer } from 'lucide-react'
import { TonePill } from '@/components/common/StatusPill'
import type { ModuleContext } from '@/features/operations/modules'
import type { RecordModule } from '@/features/records/components/RecordList'
import { formatClock, formatDay } from '@/lib/format'
import { addNotification } from '@/lib/notify'

/**
 * Temperature log for fridges and freezers (ranges set on Equipment). A reading outside the range
 * is flagged and the manager is notified in the same batch.
 * Example: milk fridge 1–5 °C, reading 7 °C → out of range.
 */
export const temperatureModule = (
  { today, branch, actor, isManager }: ModuleContext,
  coldUnits: Equipment[],
): RecordModule<TemperatureLog> => {
  const unit = (id: unknown) => coldUnits.find((e) => e.id === id)
  return {
    coll: 'temperatureLogs',
    noun: 'temperature reading',
    title: 'Temperature log',
    description: 'Fridge and freezer readings. Out-of-range readings alert the manager.',
    icon: Thermometer,
    canEdit: isManager,
    schema: temperatureLogSchema.pick({ equipmentId: true, date: true, reading: true, note: true }),
    fields: [
      {
        key: 'equipmentId',
        label: 'Fridge / freezer',
        type: 'reference',
        nameKey: 'equipmentName',
        options: coldUnits.map((e) => ({
          value: e.id,
          label: `${e.name} (${e.tempMin} to ${e.tempMax} °C)`,
        })),
        hint: coldUnits.length
          ? undefined
          : 'Add fridges and freezers with a range on the Equipment page first.',
      },
      { key: 'reading', label: 'Reading (°C)', type: 'number', step: 0.1 },
      { key: 'date', label: 'Date', type: 'date' },
      { key: 'note', label: 'Note', type: 'text', optional: true },
    ],
    defaults: () => ({ date: today }),
    prepare: (d) => {
      const u = unit(d.equipmentId)
      const min = u?.tempMin ?? -60
      const max = u?.tempMax ?? 150
      return {
        ...d,
        equipmentName: u?.name ?? String(d.equipmentName ?? ''),
        min,
        max,
        ok: temperatureOk(Number(d.reading), min, max),
        note: d.note ?? '',
      }
    },
    columns: [
      {
        key: 'date',
        header: 'Date',
        cell: (r) => `${formatDay(r.date)} · ${formatClock(r.createdAt, branch.rules.timeZone)}`,
      },
      {
        key: 'unit',
        header: 'Unit',
        cell: (r) => <span className="font-medium">{r.equipmentName}</span>,
      },
      {
        key: 'reading',
        header: 'Reading',
        cell: (r) => (
          <span className="flex items-center gap-2">
            {r.reading} °C
            <TonePill tone={r.ok ? 'success' : 'danger'}>
              {r.ok ? 'OK' : `Out of range (${r.min} to ${r.max})`}
            </TonePill>
          </span>
        ),
      },
      { key: 'by', header: 'By', className: 'hidden sm:table-cell', cell: (r) => r.createdByName },
    ],
    searchText: (r) => `${r.equipmentName} ${r.createdByName} ${r.note}`,
    describe: (d) => `${String(d.equipmentName)} ${String(d.reading)} °C`,
    extra: (batch, entity, d) =>
      !d.ok &&
      addNotification(batch, actor, branch, {
        type: 'temperature_alert',
        tone: 'danger',
        title: 'Temperature out of range',
        body: `${String(d.equipmentName)} read ${String(d.reading)} °C (allowed ${String(d.min)} to ${String(d.max)} °C), logged by ${actor.name}.`,
        entity,
      }),
  }
}

const RESULT_TONE = {
  Pass: 'success',
  'Minor issues': 'warning',
  'Major issues': 'danger',
  Fail: 'danger',
} as const

/** Food-safety inspections (authority or internal) with findings and corrective actions. */
export const inspectionsModule = ({ today }: ModuleContext): RecordModule<Inspection> => ({
  coll: 'inspections',
  noun: 'inspection',
  title: 'Inspections',
  description: 'Authority visits and internal self-inspections, with what was fixed.',
  icon: ClipboardList,
  schema: inspectionSchema.pick({
    date: true,
    inspector: true,
    kind: true,
    result: true,
    score: true,
    findings: true,
    correctiveActions: true,
  }),
  fields: [
    { key: 'date', label: 'Date', type: 'date' },
    { key: 'kind', label: 'Kind', type: 'select', options: ['Authority', 'Internal'] },
    { key: 'inspector', label: 'Inspector', type: 'text', placeholder: 'e.g. ADAFSA / Hana' },
    { key: 'result', label: 'Result', type: 'select', options: INSPECTION_RESULTS },
    { key: 'score', label: 'Score (0–100)', type: 'number', min: 0, max: 100, optional: true },
    { key: 'findings', label: 'Findings', type: 'textarea', optional: true },
    { key: 'correctiveActions', label: 'Corrective actions', type: 'textarea', optional: true },
  ],
  defaults: () => ({ date: today, kind: 'Internal', result: 'Pass' }),
  columns: [
    { key: 'date', header: 'Date', cell: (r) => formatDay(r.date) },
    {
      key: 'who',
      header: 'Inspection',
      cell: (r) => (
        <div>
          <div className="font-medium">{r.kind}</div>
          <div className="text-xs text-muted-foreground">{r.inspector}</div>
        </div>
      ),
    },
    {
      key: 'result',
      header: 'Result',
      cell: (r) => (
        <TonePill tone={RESULT_TONE[r.result]}>
          {r.result}
          {r.score != null ? ` · ${r.score}` : ''}
        </TonePill>
      ),
    },
    {
      key: 'actions',
      header: 'Corrective actions',
      className: 'hidden md:table-cell whitespace-normal',
      cell: (r) => <div className="line-clamp-2 max-w-sm">{r.correctiveActions || '—'}</div>,
    },
  ],
  searchText: (r) => `${r.inspector} ${r.findings} ${r.correctiveActions}`,
  describe: (d) => `${String(d.kind)} inspection: ${String(d.result)}`,
})
