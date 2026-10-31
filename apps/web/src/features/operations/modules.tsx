import {
  handoverSchema,
  INCIDENT_TYPES,
  incidentSchema,
  SEVERITIES,
  type Branch,
  type Handover,
  type Incident,
} from '@cityreach/shared'
import { ArrowRightLeft, ShieldAlert } from 'lucide-react'
import { StatusPill, TonePill } from '@/components/common/StatusPill'
import type { SessionUser } from '@/features/auth/api'
import type { RecordModule } from '@/features/records/components/RecordList'
import { formatDay, formatMoney } from '@/lib/format'
import { addNotification } from '@/lib/notify'

export interface ModuleContext {
  today: string
  branch: Branch
  actor: SessionUser
  /** Managers edit and delete; staff only add. */
  isManager: boolean
}

const SEVERITY_TONE = { low: 'neutral', medium: 'warning', high: 'danger' } as const

/** Incidents: anyone on shift reports; the manager is notified and closes them with the action taken. */
export const incidentsModule = ({
  today,
  branch,
  actor,
  isManager,
}: ModuleContext): RecordModule<Incident> => ({
  coll: 'incidents',
  noun: 'incident',
  title: 'Incident reports',
  description: 'Injuries, complaints, breakages, food-safety or security problems.',
  icon: ShieldAlert,
  canEdit: isManager,
  schema: incidentSchema.pick({
    date: true,
    type: true,
    severity: true,
    description: true,
    actionTaken: true,
    status: true,
  }),
  fields: [
    { key: 'date', label: 'Date', type: 'date' },
    { key: 'type', label: 'Type', type: 'select', options: INCIDENT_TYPES },
    { key: 'severity', label: 'Severity', type: 'select', options: SEVERITIES },
    {
      key: 'status',
      label: 'Status',
      type: 'select',
      options: ['open', 'closed'],
      when: () => isManager,
    },
    { key: 'description', label: 'What happened', type: 'textarea' },
    { key: 'actionTaken', label: 'Action taken', type: 'textarea', optional: true },
  ],
  defaults: () => ({ date: today, type: 'Other', severity: 'low', status: 'open' }),
  prepare: (d) => ({ ...d, status: d.status ?? 'open', actionTaken: d.actionTaken ?? '' }),
  columns: [
    { key: 'date', header: 'Date', cell: (r) => formatDay(r.date) },
    {
      key: 'what',
      header: 'Incident',
      className: 'whitespace-normal',
      cell: (r) => (
        <div className="max-w-md">
          <div className="font-medium">{r.type}</div>
          <div className="line-clamp-2 text-xs text-muted-foreground">{r.description}</div>
        </div>
      ),
    },
    {
      key: 'severity',
      header: 'Severity',
      cell: (r) => <TonePill tone={SEVERITY_TONE[r.severity]}>{r.severity}</TonePill>,
    },
    {
      key: 'status',
      header: 'Status',
      className: 'hidden sm:table-cell',
      cell: (r) => <StatusPill status={r.status === 'open' ? 'pending' : 'completed'} />,
    },
    {
      key: 'by',
      header: 'Reported by',
      className: 'hidden md:table-cell',
      cell: (r) => r.createdByName,
    },
  ],
  searchText: (r) => `${r.type} ${r.description} ${r.createdByName}`,
  describe: (d) => `${String(d.type)} (${String(d.severity)})`,
  extra: (batch, entity, d) =>
    !isManager &&
    addNotification(batch, actor, branch, {
      type: 'incident_reported',
      tone: d.severity === 'high' ? 'danger' : 'warning',
      title: 'Incident reported',
      body: `${actor.name} reported: ${String(d.type).toLowerCase()} (${String(d.severity)}).`,
      entity,
    }),
})

/** Shift handover notes: what the next shift needs to know, and the cash count. */
export const handoversModule = ({ today, isManager }: ModuleContext): RecordModule<Handover> => ({
  coll: 'handovers',
  noun: 'handover note',
  title: 'Shift handovers',
  description: 'What the next shift needs to know.',
  icon: ArrowRightLeft,
  canEdit: isManager,
  schema: handoverSchema.pick({ date: true, shiftName: true, notes: true, cashCount: true }),
  fields: [
    { key: 'date', label: 'Date', type: 'date' },
    {
      key: 'shiftName',
      label: 'Shift',
      type: 'select',
      options: ['Morning', 'Evening', 'Night', 'Other'],
    },
    { key: 'notes', label: 'Notes for the next shift', type: 'textarea' },
    { key: 'cashCount', label: 'Cash in till (£)', type: 'money', optional: true },
  ],
  defaults: () => ({ date: today, shiftName: 'Morning' }),
  columns: [
    { key: 'date', header: 'Date', cell: (r) => `${formatDay(r.date)} · ${r.shiftName}` },
    {
      key: 'notes',
      header: 'Notes',
      className: 'whitespace-normal',
      cell: (r) => <div className="line-clamp-2 max-w-md">{r.notes}</div>,
    },
    {
      key: 'cash',
      header: 'Cash',
      className: 'hidden sm:table-cell',
      cell: (r) => (r.cashCount == null ? '—' : formatMoney(r.cashCount)),
    },
    { key: 'by', header: 'By', className: 'hidden md:table-cell', cell: (r) => r.createdByName },
  ],
  searchText: (r) => `${r.notes} ${r.createdByName} ${r.shiftName}`,
  describe: (d) => `${String(d.shiftName)} shift, ${String(d.date)}`,
})
