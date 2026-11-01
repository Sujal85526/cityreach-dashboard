import {
  addDays,
  COLLECTIONS,
  isManagerRole,
  monthEnd,
  rotaShiftId,
  salesTotal,
  type Branch,
  type Expense,
  type Goal,
  type PurchaseOrder,
  type SalesDay,
  type Training,
} from '@cityreach/shared'
import type { QueryClient, QueryKey } from '@tanstack/react-query'
import { where } from '@/lib/store'
import { getRecord, listAttendanceRange, listMyAttendance } from '@/features/attendance/api'
import { getProfile, type SessionUser } from '@/features/auth/api'
import { listOwnedBranches, loadBranchSummary } from '@/features/branches/api'
import { listEmployees } from '@/features/employees/api'
import { listItems, listMovementsBetween } from '@/features/inventory/api'
import { listBranchLeave, listMyLeave } from '@/features/leave/api'
import { balancesFor } from '@/features/leave/model'
import { listMonthPayslips, listMyPayslips } from '@/features/payslips/api'
import { listRecords } from '@/features/records/api'
import { listMyRota } from '@/features/rota/api'
import { listShifts } from '@/features/settings/api'
import { listMyTasks, listOpenTasks } from '@/features/tasks/api'
import { qk } from '@/lib/query-keys'
import {
  myAttendanceAnswer,
  myGrowthAnswer,
  myLeaveAnswer,
  myPayAnswer,
  myShiftAnswer,
  myTasksAnswer,
  type Answer,
} from './answers'
import {
  attentionAnswer,
  bestDayAnswer,
  branchesAnswer,
  labourAnswer,
  leaveToReviewAnswer,
  lowStockAnswer,
  profitAnswer,
  reorderAnswer,
  salesAnswer,
  salesRange,
  teamTasksAnswer,
  teamTodayAnswer,
  wasteAnswer,
} from './answers-manager'
import { MANAGER_INTENTS, type Intent, type When } from './intents'

export interface AskContext {
  user: SessionUser
  branch: Branch
  today: string
  client: QueryClient
}

export const MANAGERS_ONLY =
  "That's something only managers can see. Ask your manager, or ask me about your own tasks, shifts, leave or pay."

const HELP_STAFF =
  'I can look up your tasks, shifts, attendance, leave, pay, training and goals, and explain how things work here.'
const HELP_MANAGER =
  "I can look up today's team, tasks, stock, reorders, leave requests, sales, profit, staff cost, waste and your best days, as well as your own tasks and shifts."

/** Reads through the query cache, so an answer reuses what the screens already loaded. */
const cached = <T>(c: AskContext, queryKey: QueryKey, queryFn: () => Promise<T>) =>
  c.client.fetchQuery({ queryKey, queryFn })

const salesBetween = (c: AskContext, from: string, to: string) =>
  cached(c, qk.records(COLLECTIONS.salesDays, c.branch.id, `${from}_${to}`), () =>
    listRecords<SalesDay>(COLLECTIONS.salesDays, c.branch.id, {
      filters: [where('date', '>=', from), where('date', '<=', to)],
      orderField: 'date',
      direction: 'asc',
    }),
  ).then((days) => days.map((d) => ({ date: d.date, total: salesTotal(d) })))

const employees = (c: AskContext) =>
  cached(c, qk.employeeList(c.branch.id), () => listEmployees(c.branch.id))
const items = (c: AskContext) =>
  cached(c, qk.inventoryItems(c.branch.id), () => listItems(c.branch.id))
const branchLeave = (c: AskContext) =>
  cached(c, qk.branchLeave(c.branch.id), () => listBranchLeave(c.branch.id))
const attendanceOn = (c: AskContext, date: string) =>
  cached(c, qk.attendanceRange(c.branch.id, date, date), () =>
    listAttendanceRange(c.branch.id, date, date),
  )
const movements = (c: AskContext, from: string, to: string) =>
  cached(c, qk.movementsBetween(c.branch.id, from, to), () =>
    listMovementsBetween(c.branch, from, to),
  )
const monthPayslips = (c: AskContext, month: string) =>
  cached(c, qk.monthPayslips(c.branch.id, month), () => listMonthPayslips(c.branch.id, month))
const orders = (c: AskContext) =>
  cached(c, qk.records(COLLECTIONS.purchaseOrders, c.branch.id, 'all'), () =>
    listRecords<PurchaseOrder>(COLLECTIONS.purchaseOrders, c.branch.id),
  )
/** Tasks change on other people's phones; always ask again. */
const openTasks = (c: AskContext) =>
  c.client.fetchQuery({
    queryKey: ['assistant', 'openTasks', c.branch.id],
    queryFn: () => listOpenTasks(c.branch.id),
    staleTime: 0,
  })

const myPlan = async (c: AskContext) => {
  const to = addDays(c.today, 6)
  const [profile, shifts, rota, leave] = await Promise.all([
    getProfile(c.user.uid),
    cached(c, qk.shifts(c.branch.id), () => listShifts(c.branch.id)),
    listMyRota(c.branch.id, c.user.uid, addDays(c.today, -1), to),
    cached(c, qk.myLeave(c.user.uid), () => listMyLeave(c.user.uid)),
  ])
  const usual = profile?.shiftId ?? null
  const onLeave = new Set(leave.filter((l) => l.status === 'approved').flatMap((l) => l.dates))
  const dates = [-1, 0, 1, 2, 3, 4, 5, 6].map((n) => addDays(c.today, n))
  const days = dates.map((date) => {
    const id = rotaShiftId(
      usual,
      rota.find((r) => r.date === date),
    )
    return { date, shift: shifts.find((s) => s.id === id) ?? null, onLeave: onLeave.has(date) }
  })
  return { days, flexible: usual === null }
}

const staticAnswer = (intent: Intent, c: AskContext): Answer | null => {
  const isManager = isManagerRole(c.user.access.role)
  const firstName = c.user.name.split(' ')[0] ?? ''
  switch (intent) {
    case 'greeting':
      return { text: `Hi ${firstName}! What would you like to know?` }
    case 'thanks':
      return { text: "You're welcome!" }
    case 'help':
      return { text: isManager ? HELP_MANAGER : HELP_STAFF }
    case 'howClockIn':
      return isManager
        ? {
            text: 'Staff clock in on their phone. You can see and correct records on Attendance.',
            link: { to: '/attendance', label: 'Open attendance' },
          }
        : {
            text: 'Open Clock in and press the button. It records the time and your location, and takes a quick photo.',
            link: { to: '/me', label: 'Open clock in' },
          }
    case 'howLeave':
      return isManager
        ? {
            text: 'Staff request leave on their phone, and you approve it on Leave & pay → Review.',
            link: { to: '/leave', label: 'Open leave & pay' },
          }
        : {
            text: 'Open Leave & pay, choose the type and dates, and send it. Your manager gets a notification.',
            link: { to: '/me/leave', label: 'Open leave' },
          }
    case 'howSwap':
      return isManager
        ? {
            text: 'Staff ask for a swap on their rota, and you approve or reject it on the Rota page.',
            link: { to: '/rota', label: 'Open rota' },
          }
        : {
            text: 'Open My rota, pick the day and the colleague, and send the request. Your manager approves it.',
            link: { to: '/me/rota', label: 'Open my rota' },
          }
    case 'howPassword':
      return {
        text: 'Change your password in Settings, Security (or the account menu, top right, then Password & fingerprint). Forgotten it? Ask your manager to reset it.',
        link: { to: isManager ? '/settings/security' : '/me/security', label: 'Open Security' },
      }
    default:
      return null
  }
}

/** Fetches what the question needs and builds the answer. Manager-only questions are refused here too, so the data layer never returns them to staff. */
export async function ask(intent: Intent, when: When | null, c: AskContext): Promise<Answer> {
  const fixed = staticAnswer(intent, c)
  if (fixed) return fixed
  // No real auth in the demo, so the data layer itself refuses staff asking for shop-wide data.
  if ((MANAGER_INTENTS as readonly string[]).includes(intent) && !isManagerRole(c.user.access.role))
    return { text: MANAGERS_ONLY }

  const { user, branch, today } = c
  const tz = branch.rules.timeZone
  const isManager = isManagerRole(user.access.role)
  const month = today.slice(0, 7)
  const monthStart = `${month}-01`

  switch (intent) {
    case 'myTasks': {
      const tasks = await c.client.fetchQuery({
        queryKey: ['assistant', 'myTasks', user.uid],
        queryFn: () => listMyTasks(user.uid),
        staleTime: 0,
      })
      return myTasksAnswer(tasks, when, today, tz, isManager ? '/tasks' : '/me/tasks')
    }
    case 'myShift': {
      const { days, flexible } = await myPlan(c)
      return myShiftAnswer(days, when, today, isManager ? '/rota' : '/me/rota', flexible)
    }
    case 'myAttendance': {
      const [record, records] = await Promise.all([
        getRecord(user.uid, today),
        cached(c, qk.myAttendance(user.uid), () => listMyAttendance(user.uid)),
      ])
      return myAttendanceAnswer(
        record,
        records,
        today,
        tz,
        isManager ? '/attendance' : '/me/attendance',
      )
    }
    case 'myLeave': {
      const [profile, requests] = await Promise.all([
        getProfile(user.uid),
        cached(c, qk.myLeave(user.uid), () => listMyLeave(user.uid)),
      ])
      const balances = balancesFor(profile ?? {}, branch, requests, Number(today.slice(0, 4)))
      return myLeaveAnswer(balances, requests, isManager ? '/leave' : '/me/leave')
    }
    case 'myPay': {
      const [payslips, profile] = await Promise.all([
        cached(c, qk.myPayslips(user.uid), () => listMyPayslips(user.uid)),
        getProfile(user.uid),
      ])
      return myPayAnswer(payslips, profile?.salary, isManager ? '/leave' : '/me/leave')
    }
    case 'myGrowth': {
      const mine = { filters: [where('employeeId', '==', user.uid)] }
      const [goals, training] = await Promise.all([
        listRecords<Goal>(COLLECTIONS.goals, branch.id, mine),
        listRecords<Training>(COLLECTIONS.training, branch.id, mine),
      ])
      return myGrowthAnswer(goals, training, today, isManager ? '/employees' : '/me/growth')
    }
    case 'teamToday': {
      const date = when === 'yesterday' ? addDays(today, -1) : today
      const [records, staff] = await Promise.all([attendanceOn(c, date), employees(c)])
      return teamTodayAnswer(records, staff.filter((s) => s.status === 'active').length, when)
    }
    case 'teamTasks':
      return teamTasksAnswer(await openTasks(c), today, tz)
    case 'lowStock':
      return lowStockAnswer(await items(c))
    case 'reorder': {
      const [stock, used] = await Promise.all([items(c), movements(c, addDays(today, -30), today)])
      return reorderAnswer(stock, used)
    }
    case 'leaveToReview':
      return leaveToReviewAnswer(await branchLeave(c))
    case 'sales': {
      const range = salesRange(when, today)
      return salesAnswer(await salesBetween(c, range.from, range.to), range.label)
    }
    case 'profit': {
      const end = monthEnd(month)
      const [sales, expenses, payslips] = await Promise.all([
        salesBetween(c, monthStart, end),
        cached(c, qk.records(COLLECTIONS.expenses, branch.id, `${monthStart}_${end}`), () =>
          listRecords<Expense>(COLLECTIONS.expenses, branch.id, {
            filters: [where('date', '>=', monthStart), where('date', '<=', end)],
            orderField: 'date',
            direction: 'asc',
          }),
        ),
        monthPayslips(c, month),
      ])
      return profitAnswer(
        sales.reduce((sum, d) => sum + d.total, 0),
        expenses.reduce((sum, e) => sum + e.amount, 0),
        payslips.reduce((sum, p) => sum + p.net, 0),
      )
    }
    case 'labour': {
      const [staff, payslips, sales] = await Promise.all([
        employees(c),
        monthPayslips(c, month),
        salesBetween(c, monthStart, today),
      ])
      return labourAnswer(
        staff.filter((s) => s.status !== 'inactive'),
        payslips,
        sales.reduce((sum, d) => sum + d.total, 0),
        today,
      )
    }
    case 'waste': {
      const [used, po, stock] = await Promise.all([
        movements(c, monthStart, monthEnd(month)),
        orders(c),
        items(c),
      ])
      return wasteAnswer(used, po, stock)
    }
    case 'bestDay':
      return bestDayAnswer(await salesBetween(c, addDays(today, -90), today))
    case 'attention': {
      const [records, tasks, stock, leave] = await Promise.all([
        attendanceOn(c, today),
        openTasks(c),
        items(c),
        branchLeave(c),
      ])
      const now = new Date()
      return attentionAnswer({
        absent: records.filter((r) => r.status === 'absent').length,
        overdueTasks: tasks.filter((t) => t.status === 'overdue' || t.deadline < now).length,
        lowStock: stock.filter((i) => i.status !== 'in_stock').length,
        pendingLeave: leave.filter((l) => l.status === 'pending').length,
      })
    }
    case 'branches': {
      if (user.access.role !== 'owner')
        return {
          text: 'Only the owner can see all branches together. Switch to the Owner role in the account menu to try it.',
        }
      const branches = await cached(c, qk.myBranches(user.uid), () => listOwnedBranches(user))
      const rows = await Promise.all(
        branches.map(async (b) => ({
          name: b.name,
          summary: await cached(c, qk.branchSummary(b.id), () => loadBranchSummary(b, user)),
        })),
      )
      return branchesAnswer(rows)
    }
    default:
      return { text: isManager ? HELP_MANAGER : HELP_STAFF }
  }
}
