import {
  CANDIDATE_STAGES,
  candidateSchema,
  GOAL_STATUSES,
  goalSchema,
  trainingSchema,
  type Candidate,
  type Goal,
  type StoredDocument,
  type Training,
  type User,
} from '@dm/shared'
import { where } from 'firebase/firestore'
import { GraduationCap, Target, UserPlus } from 'lucide-react'
import { TonePill } from '@/components/common/StatusPill'
import { Progress } from '@/components/ui/progress'
import type { ModuleContext } from '@/features/operations/modules'
import type { RecordModule } from '@/features/records/components/RecordList'
import { formatDay } from '@/lib/format'

export const STAGE = {
  applied: ['Applied', 'neutral'],
  interview: ['Interview', 'info'],
  offer: ['Offer', 'warning'],
  hired: ['Hired', 'success'],
  rejected: ['Rejected', 'danger'],
} as const

/** Candidates through the hiring stages; the CV lives in Documents (category CV). */
export const candidatesModule = (
  { today }: ModuleContext,
  cvs: StoredDocument[],
): RecordModule<Candidate> => ({
  coll: 'candidates',
  noun: 'candidate',
  title: 'Candidates',
  description: 'Applicants from CV to hire. Upload CVs in Documents with the category "CV".',
  icon: UserPlus,
  schema: candidateSchema.pick({
    name: true,
    phone: true,
    email: true,
    position: true,
    stage: true,
    source: true,
    interviewOn: true,
    notes: true,
    cvDocumentId: true,
  }),
  fields: [
    { key: 'name', label: 'Name', type: 'text' },
    {
      key: 'position',
      label: 'Position',
      type: 'select',
      options: ['Barista', 'Shift Lead', 'Cashier', 'Cleaner', 'Other'],
    },
    { key: 'phone', label: 'Phone', type: 'text', optional: true },
    { key: 'email', label: 'Email', type: 'text', optional: true },
    {
      key: 'stage',
      label: 'Stage',
      type: 'select',
      options: CANDIDATE_STAGES.map((s) => ({ value: s, label: STAGE[s][0] })),
    },
    {
      key: 'interviewOn',
      label: 'Interview on',
      type: 'date',
      optional: true,
      when: (v) => v.stage === 'interview' || !!v.interviewOn,
    },
    {
      key: 'source',
      label: 'Found via',
      type: 'text',
      optional: true,
      placeholder: 'e.g. Dubizzle, referral',
    },
    {
      key: 'cvDocumentId',
      label: 'CV',
      type: 'reference',
      optional: true,
      options: cvs.map((d) => ({ value: d.id, label: d.name })),
      hint: cvs.length ? undefined : 'No CVs uploaded yet (Documents → category CV).',
    },
    { key: 'notes', label: 'Notes', type: 'textarea', optional: true },
  ],
  defaults: () => ({ stage: 'applied', position: 'Barista', interviewOn: today }),
  prepare: (d) => ({
    ...d,
    phone: d.phone ?? '',
    email: d.email ?? '',
    source: d.source ?? '',
    notes: d.notes ?? '',
    interviewOn: d.interviewOn ?? null,
    cvDocumentId: d.cvDocumentId ?? null,
  }),
  columns: [
    {
      key: 'name',
      header: 'Candidate',
      className: 'whitespace-normal',
      cell: (r) => (
        <div>
          <div className="font-medium">{r.name}</div>
          <div className="text-xs text-muted-foreground">
            {[r.phone, r.email].filter(Boolean).join(' · ') || r.source}
          </div>
        </div>
      ),
    },
    {
      key: 'position',
      header: 'Position',
      className: 'hidden sm:table-cell',
      cell: (r) => r.position,
    },
    {
      key: 'stage',
      header: 'Stage',
      cell: (r) => <TonePill tone={STAGE[r.stage][1]}>{STAGE[r.stage][0]}</TonePill>,
    },
    {
      key: 'interview',
      header: 'Interview',
      className: 'hidden md:table-cell',
      cell: (r) => formatDay(r.interviewOn),
    },
    {
      key: 'cv',
      header: 'CV',
      className: 'hidden md:table-cell',
      cell: (r) =>
        r.cvDocumentId ? (cvs.find((d) => d.id === r.cvDocumentId)?.name ?? 'Attached') : '—',
    },
  ],
  searchText: (r) => `${r.name} ${r.position} ${r.source} ${r.notes}`,
  describe: (d) => `${String(d.name)} (${String(d.stage)})`,
})

/** Personal records are filtered to one employee and copy their name. */
const forEmployee = (employee: Pick<User, 'id' | 'name'>) => ({
  query: { key: employee.id, filters: [where('employeeId', '==', employee.id)] },
  prepare: (d: Record<string, unknown>) => ({
    ...d,
    employeeId: employee.id,
    employeeName: employee.name,
  }),
})

/** Training and certificates for one employee (certificate expiry is reminded like documents). */
export const trainingModule = (
  { today, isManager }: ModuleContext,
  employee: Pick<User, 'id' | 'name'>,
): RecordModule<Training> => ({
  coll: 'training',
  noun: 'training',
  title: 'Training & certificates',
  description: 'Courses done, e.g. food-safety training, with certificate expiry.',
  icon: GraduationCap,
  canEdit: isManager,
  canAdd: isManager,
  ...forEmployee(employee),
  prepare: (d) => ({
    ...forEmployee(employee).prepare(d),
    provider: d.provider ?? '',
    notes: d.notes ?? '',
    expiresOn: d.expiresOn ?? null,
  }),
  schema: trainingSchema.pick({
    title: true,
    provider: true,
    date: true,
    expiresOn: true,
    notes: true,
  }),
  fields: [
    {
      key: 'title',
      label: 'Training',
      type: 'text',
      wide: true,
      placeholder: 'e.g. Essential Food Safety Training',
    },
    { key: 'provider', label: 'Provider', type: 'text', optional: true },
    { key: 'date', label: 'Completed on', type: 'date' },
    { key: 'expiresOn', label: 'Certificate expires', type: 'date', optional: true },
    { key: 'notes', label: 'Notes', type: 'textarea', optional: true },
  ],
  defaults: () => ({ date: today }),
  columns: [
    {
      key: 'title',
      header: 'Training',
      className: 'whitespace-normal',
      cell: (r) => (
        <div>
          <div className="font-medium">{r.title}</div>
          <div className="text-xs text-muted-foreground">{r.provider}</div>
        </div>
      ),
    },
    { key: 'date', header: 'Completed', cell: (r) => formatDay(r.date) },
    {
      key: 'expires',
      header: 'Certificate',
      cell: (r) =>
        !r.expiresOn ? (
          '—'
        ) : r.expiresOn < today ? (
          <TonePill tone="danger">Expired {formatDay(r.expiresOn)}</TonePill>
        ) : (
          `Valid until ${formatDay(r.expiresOn)}`
        ),
    },
  ],
  searchText: (r) => `${r.title} ${r.provider}`,
  describe: (d) => `${String(d.title)} for ${employee.name}`,
})

const GOAL_LABEL = {
  not_started: ['Not started', 'neutral'],
  in_progress: ['In progress', 'info'],
  achieved: ['Achieved', 'success'],
  missed: ['Missed', 'danger'],
} as const

/** Goals agreed with an employee, with progress. */
export const goalsModule = (
  { isManager }: ModuleContext,
  employee: Pick<User, 'id' | 'name'>,
): RecordModule<Goal> => ({
  coll: 'goals',
  noun: 'goal',
  title: 'Goals',
  description: 'What they are working towards.',
  icon: Target,
  canEdit: isManager,
  canAdd: isManager,
  ...forEmployee(employee),
  schema: goalSchema.pick({ title: true, dueOn: true, status: true, progress: true }),
  fields: [
    { key: 'title', label: 'Goal', type: 'text', wide: true, placeholder: 'e.g. Learn latte art' },
    { key: 'dueOn', label: 'By', type: 'date', optional: true },
    {
      key: 'status',
      label: 'Status',
      type: 'select',
      options: GOAL_STATUSES.map((s) => ({ value: s, label: GOAL_LABEL[s][0] })),
    },
    { key: 'progress', label: 'Progress (%)', type: 'number', min: 0, max: 100 },
  ],
  defaults: () => ({ status: 'not_started', progress: '0' }),
  columns: [
    {
      key: 'title',
      header: 'Goal',
      className: 'whitespace-normal',
      cell: (r) => <span className="font-medium">{r.title}</span>,
    },
    {
      key: 'due',
      header: 'By',
      className: 'hidden sm:table-cell',
      cell: (r) => formatDay(r.dueOn),
    },
    {
      key: 'progress',
      header: 'Progress',
      cell: (r) => (
        <div className="flex w-32 items-center gap-2">
          <Progress value={r.progress} aria-label="Progress" />
          <span className="text-xs tabular-nums">{r.progress}%</span>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (r) => <TonePill tone={GOAL_LABEL[r.status][1]}>{GOAL_LABEL[r.status][0]}</TonePill>,
    },
  ],
  searchText: (r) => r.title,
  describe: (d) => `${String(d.title)} for ${employee.name}`,
})
