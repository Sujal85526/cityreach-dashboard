import {
  addDays,
  COLLECTIONS,
  nextServiceOn,
  toDateKey,
  type Branch,
  type Equipment,
  type Training,
  type User,
} from '@cityreach/shared'
import { doc, where, writeBatch } from '@/lib/store'
import type { SessionUser } from '@/features/auth/api'
import { listRecords } from '@/features/records/api'
import { db } from '@/lib/store'
import { formatDay } from '@/lib/format'
import { addNotification } from '@/lib/notify'

const SERVICE_DAYS = 7
const WARRANTY_DAYS = 30
const CERTIFICATE_DAYS = 30
const PROBATION_DAYS = 14

/**
 * Daily, on manager open: one notification per date for equipment service due (7 days ahead or
 * overdue), warranties ending (30 days), staff certificates expiring (30 days) and probation ending
 * (14 days). The date is saved on the record so the same reminder is never sent twice; a new date
 * (serviced, renewed, extended) gets its own reminder.
 */
export async function checkDateReminders(
  branch: Branch,
  employees: User[],
  actor: SessionUser,
): Promise<number> {
  const today = toDateKey(new Date(), branch.rules.timeZone)
  const [equipment, training] = await Promise.all([
    listRecords<Equipment>(COLLECTIONS.equipment, branch.id),
    listRecords<Training>(COLLECTIONS.training, branch.id, {
      filters: [where('expiresOn', '<=', addDays(today, CERTIFICATE_DAYS))],
      orderField: 'expiresOn',
      direction: 'asc',
    }),
  ])
  const batch = writeBatch(db)
  let sent = 0
  const notify = (title: string, body: string, entity: { collection: string; id: string }) => {
    addNotification(batch, actor, branch, {
      type: 'equipment_service',
      tone: 'warning',
      title,
      body,
      entity,
    })
    sent++
  }

  for (const e of equipment) {
    const ref = doc(db, COLLECTIONS.equipment, e.id)
    const next = nextServiceOn(e.lastServiceOn, e.purchasedOn, e.serviceEveryDays)
    if (next && next <= addDays(today, SERVICE_DAYS) && e.serviceRemindedFor !== next) {
      notify(
        'Service due',
        `${e.name} ${next < today ? 'was due for a service on' : 'is due for a service on'} ${formatDay(next)}.`,
        { collection: COLLECTIONS.equipment, id: e.id },
      )
      batch.update(ref, { serviceRemindedFor: next })
    }
    const w = e.warrantyUntil
    if (w && w >= today && w <= addDays(today, WARRANTY_DAYS) && e.warrantyRemindedFor !== w) {
      notify('Warranty ending', `${e.name}'s warranty ends on ${formatDay(w)}.`, {
        collection: COLLECTIONS.equipment,
        id: e.id,
      })
      batch.update(ref, { warrantyRemindedFor: w })
    }
  }

  for (const t of training)
    if (t.expiresOn && t.remindedFor !== t.expiresOn) {
      addNotification(batch, actor, branch, {
        type: 'document_expiry',
        tone: t.expiresOn < today ? 'danger' : 'warning',
        title: 'Certificate expiring',
        body: `${t.employeeName}'s ${t.title} certificate ${t.expiresOn < today ? 'expired' : 'expires'} on ${formatDay(t.expiresOn)}.`,
        entity: { collection: COLLECTIONS.training, id: t.id },
      })
      batch.update(doc(db, COLLECTIONS.training, t.id), { remindedFor: t.expiresOn })
      sent++
    }

  for (const u of employees) {
    const end = u.probationEndsOn
    if (
      end &&
      end >= today &&
      end <= addDays(today, PROBATION_DAYS) &&
      u.probationRemindedFor !== end &&
      u.status !== 'inactive'
    ) {
      addNotification(batch, actor, branch, {
        type: 'probation_ending',
        tone: 'info',
        title: 'Probation ending',
        body: `${u.name}'s probation ends on ${formatDay(end)}: confirm or extend.`,
        entity: { collection: COLLECTIONS.users, id: u.id },
      })
      batch.update(doc(db, COLLECTIONS.users, u.id), { probationRemindedFor: end })
      sent++
    }
  }

  if (sent) await batch.commit()
  return sent
}
