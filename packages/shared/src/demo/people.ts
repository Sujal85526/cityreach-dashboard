/**
 * The demo team and the rules for who works when. Kept apart from the builder so the app's seed
 * (rota, leave, swaps) and the generated attendance agree on every single day.
 */
import { addDays } from '../rules/expiry'

export const SHIFTS = [
  { id: 'morning', name: 'Morning', start: '07:00', end: '15:00' },
  { id: 'evening', name: 'Evening', start: '15:00', end: '23:00' },
  { id: 'night', name: 'Night', start: '23:00', end: '07:00' },
] as const
export type ShiftKey = (typeof SHIFTS)[number]['id']

/** The shop is open every day; people's days off come from the rota (see `rotaOverride`). */
export const WORK_DAYS = [0, 1, 2, 3, 4, 5, 6]

export interface Person {
  key: string
  name: string
  position: string
  /** Usual shift; null = flexible hours with no fixed shift (can clock in at any time). */
  shift: ShiftKey | null
  /** The shift their past attendance was recorded against (differs from `shift` only for flexible staff). */
  histShift: ShiftKey
  status: 'active' | 'on_leave'
  phone: string
  /** A date ("2025-03-01") or a number of days before today. */
  hired: string | number
  salary: number
  allowances: number
  /** Chance of arriving late on a day about 30 days ago; recent days are better. */
  lateRate: number
  absentRate: number
  /** Chance of staying 35–95 min after the shift ends. */
  overtimeRate: number
  /** Minutes late today (negative = early); null = nothing recorded. */
  todayOffset: number | null
}

export const SAMPLE_PEOPLE: Person[] = [
  {
    key: 'maya',
    name: 'Maya Patel',
    position: 'Barista',
    shift: null,
    histShift: 'morning',
    status: 'active',
    phone: '+44 7700 900 111',
    hired: '2025-03-03',
    salary: 2050,
    allowances: 50,
    lateRate: 0.1,
    absentRate: 0.02,
    overtimeRate: 0.1,
    todayOffset: null,
  },
  {
    key: 'liam',
    name: 'Liam Carter',
    position: 'Shift Lead',
    shift: 'morning',
    histShift: 'morning',
    status: 'active',
    phone: '+44 7700 900 112',
    hired: '2024-05-13',
    salary: 2650,
    allowances: 120,
    lateRate: 0.03,
    absentRate: 0,
    overtimeRate: 0.22,
    todayOffset: -8,
  },
  {
    key: 'noah',
    name: 'Noah Kim',
    position: 'Barista',
    shift: 'evening',
    histShift: 'evening',
    status: 'active',
    phone: '+44 7700 900 113',
    hired: '2025-06-02',
    salary: 1950,
    allowances: 50,
    lateRate: 0.14,
    absentRate: 0.04,
    overtimeRate: 0.08,
    todayOffset: 3,
  },
  {
    key: 'priya',
    name: 'Priya Nair',
    position: 'Cashier',
    shift: 'morning',
    histShift: 'morning',
    status: 'on_leave',
    phone: '+44 7700 900 114',
    hired: '2024-11-04',
    salary: 1900,
    allowances: 50,
    lateRate: 0.08,
    absentRate: 0.02,
    overtimeRate: 0.06,
    todayOffset: null,
  },
  {
    key: 'sofia',
    name: 'Sofia Rossi',
    position: 'Barista',
    shift: 'evening',
    histShift: 'evening',
    status: 'active',
    phone: '+44 7700 900 115',
    hired: '2025-01-20',
    salary: 2000,
    allowances: 50,
    lateRate: 0.05,
    absentRate: 0.02,
    overtimeRate: 0.12,
    todayOffset: 0,
  },
  {
    key: 'tomas',
    name: 'Tomás Silva',
    position: 'Cleaner',
    shift: 'night',
    histShift: 'night',
    status: 'active',
    phone: '+44 7700 900 116',
    hired: '2025-09-01',
    salary: 1800,
    allowances: 80,
    lateRate: 0.12,
    absentRate: 0.04,
    overtimeRate: 0.05,
    todayOffset: 4,
  },
  {
    key: 'ella',
    name: 'Ella Johansson',
    position: 'Cashier',
    shift: 'evening',
    histShift: 'evening',
    status: 'active',
    phone: '+44 7700 900 117',
    hired: '2025-08-11',
    salary: 1900,
    allowances: 50,
    lateRate: 0.08,
    absentRate: 0.02,
    overtimeRate: 0.07,
    todayOffset: 11,
  },
  {
    key: 'jamal',
    name: 'Jamal Reed',
    position: 'Barista',
    shift: 'morning',
    histShift: 'morning',
    status: 'active',
    phone: '+44 7700 900 118',
    hired: 130,
    salary: 1950,
    allowances: 50,
    lateRate: 0.14,
    absentRate: 0.03,
    overtimeRate: 0.1,
    todayOffset: -2,
  },
]

export interface SampleLeave {
  id: string
  key: string
  typeId: string
  /** Calendar days from today (negative = past), inclusive. */
  from: number
  to: number
  status: 'approved' | 'pending'
  reason: string
}

export const SAMPLE_LEAVES: SampleLeave[] = [
  { id: 'seed-leave-1', key: 'maya', typeId: 'annual', from: 16, to: 18, status: 'pending', reason: 'Long weekend away with family' },
  { id: 'seed-leave-2', key: 'priya', typeId: 'annual', from: -1, to: 3, status: 'approved', reason: 'Visiting family' },
  { id: 'seed-leave-3', key: 'jamal', typeId: 'annual', from: 9, to: 12, status: 'approved', reason: 'Holiday' },
  { id: 'seed-leave-4', key: 'sofia', typeId: 'sick', from: -6, to: -6, status: 'approved', reason: 'Stomach bug' },
  { id: 'seed-leave-5', key: 'ella', typeId: 'annual', from: -12, to: -11, status: 'approved', reason: 'Moving house' },
  { id: 'seed-leave-6', key: 'liam', typeId: 'annual', from: -40, to: -38, status: 'approved', reason: 'Family wedding' },
  { id: 'seed-leave-7', key: 'noah', typeId: 'sick', from: -33, to: -32, status: 'approved', reason: 'Flu' },
]

export const weekdayOf = (dateKey: string) => new Date(`${dateKey}T12:00:00Z`).getUTCDay()

/** Staff by shift, in rota order; each person gets two days off a week, staggered so nobody is short. */
const ROTA_GROUPS: Record<string, string[]> = {
  morning: ['liam', 'priya', 'jamal'],
  evening: ['noah', 'sofia', 'ella'],
  night: ['tomas'],
}

/**
 * The rota entry that departs from someone's usual week: their two days off (a null shift),
 * which rotate by one weekday every week and are staggered within a shift so at least two of the
 * three morning and evening staff are always in. The shop is open 7 days. Flexible staff (no usual
 * shift) never have rota entries.
 */
export function rotaOverride(
  key: string,
  dateKey: string,
): { shiftId: ShiftKey | null } | undefined {
  const shift = (Object.keys(ROTA_GROUPS) as ShiftKey[]).find((s) => ROTA_GROUPS[s]?.includes(key))
  if (!shift) return undefined
  const slot = ROTA_GROUPS[shift]?.indexOf(key) ?? 0
  const day = weekdayOf(dateKey)
  const monday = addDays(dateKey, -((day + 6) % 7))
  const week = Math.floor(Date.parse(`${monday}T00:00:00Z`) / (7 * 86_400_000))
  const first = (2 * slot + week + (shift === 'evening' ? 3 : shift === 'night' ? 5 : 0)) % 7
  return day === first || day === (first + 1) % 7 ? { shiftId: null } : undefined
}

/** Flexible staff were rostered Monday to Saturday in the past. */
const FLEXIBLE_DAYS = [1, 2, 3, 4, 5, 6]

/** The shift someone works on a date (rota first, then their usual week), or null on a day off. */
export function plannedShiftKey(p: Person, dateKey: string, today: string): ShiftKey | null {
  if (!p.shift) return dateKey < today && FLEXIBLE_DAYS.includes(weekdayOf(dateKey)) ? p.histShift : null
  const override = rotaOverride(p.key, dateKey)
  return override ? override.shiftId : p.shift
}

/** Dates of a leave request on which the person actually works. */
export function leaveDates(p: Person, leave: SampleLeave, today: string): string[] {
  const dates: string[] = []
  for (let d = leave.from; d <= leave.to; d++) {
    const dateKey = addDays(today, d)
    const works = p.shift
      ? plannedShiftKey(p, dateKey, today) !== null
      : FLEXIBLE_DAYS.includes(weekdayOf(dateKey))
    if (works) dates.push(dateKey)
  }
  return dates
}
