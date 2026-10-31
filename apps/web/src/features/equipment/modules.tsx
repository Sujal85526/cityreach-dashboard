import {
  COLD_UNITS,
  COLLECTIONS,
  daysUntil,
  EQUIPMENT_KINDS,
  EQUIPMENT_STATUSES,
  equipmentSchema,
  maintenanceSchema,
  nextServiceOn,
  type Equipment,
  type Maintenance,
} from '@cityreach/shared'
import { doc } from 'firebase/firestore'
import { Hammer, Wrench } from 'lucide-react'
import { TonePill } from '@/components/common/StatusPill'
import type { ModuleContext } from '@/features/operations/modules'
import type { RecordModule } from '@/features/records/components/RecordList'
import { db } from '@/lib/firebase'
import { formatDay, formatMoney } from '@/lib/format'

const STATUS_LABEL = {
  working: ['Working', 'success'],
  needs_repair: ['Needs repair', 'warning'],
  out_of_service: ['Out of service', 'danger'],
} as const

/** Service status for the list: overdue, due within 14 days, or the date. */
export function ServiceBadge({ e, today }: { e: Equipment; today: string }) {
  const next = nextServiceOn(e.lastServiceOn, e.purchasedOn, e.serviceEveryDays)
  if (!next) return <span className="text-muted-foreground">—</span>
  const left = daysUntil(next, today)
  return (
    <div className="space-y-0.5">
      {left < 0 ? (
        <TonePill tone="danger">Service overdue</TonePill>
      ) : left <= 14 ? (
        <TonePill tone="warning">Service in {left} d</TonePill>
      ) : (
        <TonePill tone="success">OK</TonePill>
      )}
      <div className="text-xs text-muted-foreground">{formatDay(next)}</div>
    </div>
  )
}

export const equipmentModule = ({ today }: ModuleContext): RecordModule<Equipment> => ({
  coll: 'equipment',
  noun: 'machine',
  title: 'Equipment',
  description:
    'Machines, warranties and service dates. Fridges and freezers get a temperature range.',
  icon: Wrench,
  schema: equipmentSchema.pick({
    name: true,
    kind: true,
    serial: true,
    purchasedOn: true,
    warrantyUntil: true,
    serviceEveryDays: true,
    lastServiceOn: true,
    status: true,
    tempMin: true,
    tempMax: true,
  }),
  fields: [
    { key: 'name', label: 'Name', type: 'text', placeholder: 'e.g. La Marzocco Linea' },
    { key: 'kind', label: 'Type', type: 'select', options: EQUIPMENT_KINDS },
    {
      key: 'status',
      label: 'Status',
      type: 'select',
      options: EQUIPMENT_STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s][0] })),
    },
    { key: 'serial', label: 'Serial number', type: 'text', optional: true },
    { key: 'purchasedOn', label: 'Bought on', type: 'date', optional: true },
    { key: 'warrantyUntil', label: 'Warranty until', type: 'date', optional: true },
    {
      key: 'serviceEveryDays',
      label: 'Service every (days)',
      type: 'number',
      min: 7,
      optional: true,
      hint: 'e.g. 90 for quarterly',
    },
    { key: 'lastServiceOn', label: 'Last service', type: 'date', optional: true },
    {
      key: 'tempMin',
      label: 'Lowest °C',
      type: 'number',
      step: 0.5,
      optional: true,
      when: (v) => COLD_UNITS.includes(v.kind ?? ''),
    },
    {
      key: 'tempMax',
      label: 'Highest °C',
      type: 'number',
      step: 0.5,
      optional: true,
      when: (v) => COLD_UNITS.includes(v.kind ?? ''),
    },
  ],
  defaults: () => ({
    kind: 'Espresso machine',
    status: 'working',
    serviceEveryDays: '90',
    lastServiceOn: today,
  }),
  prepare: (d) => ({
    ...d,
    serial: d.serial ?? '',
    tempMin: d.tempMin ?? null,
    tempMax: d.tempMax ?? null,
  }),
  columns: [
    {
      key: 'name',
      header: 'Machine',
      className: 'whitespace-normal',
      cell: (r) => (
        <div>
          <div className="font-medium">{r.name}</div>
          <div className="text-xs text-muted-foreground">
            {r.kind}
            {r.tempMin != null && r.tempMax != null ? ` · ${r.tempMin}–${r.tempMax} °C` : ''}
          </div>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (r) => (
        <TonePill tone={STATUS_LABEL[r.status][1]}>{STATUS_LABEL[r.status][0]}</TonePill>
      ),
    },
    { key: 'service', header: 'Next service', cell: (r) => <ServiceBadge e={r} today={today} /> },
    {
      key: 'warranty',
      header: 'Warranty',
      className: 'hidden md:table-cell',
      cell: (r) =>
        !r.warrantyUntil ? (
          '—'
        ) : r.warrantyUntil < today ? (
          <TonePill tone="neutral">Expired</TonePill>
        ) : (
          `Until ${formatDay(r.warrantyUntil)}`
        ),
    },
  ],
  searchText: (r) => `${r.name} ${r.kind} ${r.serial}`,
  describe: (d) => String(d.name),
})

/**
 * Service and repair log. A service moves the machine's last-service date; a breakdown marks it as
 * needing repair, a repair puts it back to working (same batch).
 */
export const maintenanceModule = (
  { today }: ModuleContext,
  equipment: Equipment[],
): RecordModule<Maintenance> => ({
  coll: 'maintenance',
  noun: 'service / repair',
  title: 'Service & repairs',
  description: 'Every service, repair and breakdown with its cost.',
  icon: Hammer,
  schema: maintenanceSchema.pick({
    equipmentId: true,
    date: true,
    kind: true,
    cost: true,
    notes: true,
  }),
  fields: [
    {
      key: 'equipmentId',
      label: 'Machine',
      type: 'reference',
      nameKey: 'equipmentName',
      options: equipment.map((e) => ({ value: e.id, label: e.name })),
    },
    { key: 'kind', label: 'Type', type: 'select', options: ['Service', 'Repair', 'Breakdown'] },
    { key: 'date', label: 'Date', type: 'date' },
    { key: 'cost', label: 'Cost (AED)', type: 'money', min: 0 },
    { key: 'notes', label: 'Notes', type: 'textarea', optional: true },
  ],
  defaults: () => ({ date: today, kind: 'Service', cost: '0' }),
  columns: [
    { key: 'date', header: 'Date', cell: (r) => formatDay(r.date) },
    {
      key: 'machine',
      header: 'Machine',
      cell: (r) => <span className="font-medium">{r.equipmentName}</span>,
    },
    {
      key: 'kind',
      header: 'Type',
      cell: (r) => (
        <TonePill
          tone={r.kind === 'Breakdown' ? 'danger' : r.kind === 'Repair' ? 'warning' : 'info'}
        >
          {r.kind}
        </TonePill>
      ),
    },
    {
      key: 'cost',
      header: 'Cost',
      className: 'hidden sm:table-cell',
      cell: (r) => formatMoney(r.cost),
    },
    {
      key: 'notes',
      header: 'Notes',
      className: 'hidden md:table-cell whitespace-normal',
      cell: (r) => <div className="line-clamp-2 max-w-sm">{r.notes}</div>,
    },
  ],
  searchText: (r) => `${r.equipmentName} ${r.kind} ${r.notes}`,
  describe: (d) => `${String(d.kind)} of ${String(d.equipmentName)}`,
  extra: (batch, _entity, d) => {
    const ref = doc(db, COLLECTIONS.equipment, String(d.equipmentId))
    if (d.kind === 'Service') batch.update(ref, { lastServiceOn: d.date, status: 'working' })
    if (d.kind === 'Repair') batch.update(ref, { status: 'working' })
    if (d.kind === 'Breakdown') batch.update(ref, { status: 'needs_repair' })
  },
  alsoRefresh: [['records', COLLECTIONS.equipment]],
})
