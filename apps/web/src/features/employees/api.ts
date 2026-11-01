import {
  canManageCredentials,
  COLLECTIONS,
  loginUpdateSchema,
  newEmployeeSchema,
  employeeFormSchema,
  noteTextSchema,
  type Attendance,
  type EmployeeForm,
  type LoginUpdate,
  type EmploymentStatus,
  type NewEmployee,
  type NoteKind,
  type Task,
  type User,
} from '@cityreach/shared'
import {
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  where,
  writeBatch,
  db,
} from '@/lib/store'
import {
  AuthError,
  assertLoginIdAvailable,
  buildCredential,
  setCredentialInBatch,
  updateCredential,
  type SessionUser,
} from '@/features/auth/api'
import { addActivity } from '@/lib/activity'
import { fromDoc } from '@/lib/from-doc'

const users = collection(db, COLLECTIONS.users)
const userRef = (uid: string) => doc(db, COLLECTIONS.users, uid)
const entity = (uid: string) => ({ collection: COLLECTIONS.users, id: uid })

/** Everyone in the branch (staff lists are small, so sorting happens here, not in an index). */
export async function listEmployees(branchId: string): Promise<User[]> {
  const snap = await getDocs(query(users, where('branchId', '==', branchId)))
  return snap.docs.map((d) => fromDoc<User>(d)).sort((a, b) => a.name.localeCompare(b.name))
}

export async function getEmployee(uid: string): Promise<User | null> {
  const snap = await getDoc(userRef(uid))
  return snap.exists() ? fromDoc<User>(snap) : null
}

// Manager queries filter by branchId too, so branches never see each other's people.

/** Last 30 attendance records, newest first. */
export async function listEmployeeAttendance(branchId: string, uid: string): Promise<Attendance[]> {
  const snap = await getDocs(
    query(
      collection(db, COLLECTIONS.attendance),
      where('branchId', '==', branchId),
      where('employeeId', '==', uid),
      orderBy('dateKey', 'desc'),
      limit(30),
    ),
  )
  return snap.docs.map((d) => fromDoc<Attendance>(d))
}

export async function listEmployeeTasks(branchId: string, uid: string): Promise<Task[]> {
  const snap = await getDocs(
    query(
      collection(db, COLLECTIONS.tasks),
      where('branchId', '==', branchId),
      where('assigneeId', '==', uid),
      limit(50),
    ),
  )
  return snap.docs
    .map((d) => fromDoc<Task>(d))
    .sort((a, b) => b.deadline.getTime() - a.deadline.getTime())
}

/**
 * Creates the profile, the login (ID + hashed password) and the activity entry in one batch.
 * The login ID must be new; the password is hashed before it is stored.
 */
export async function createEmployee(input: NewEmployee, actor: SessionUser): Promise<string> {
  const { email, loginId, password, ...form } = newEmployeeSchema.parse(input)
  await assertLoginIdAvailable(loginId)
  const credential = await buildCredential({ loginId, password }, actor.access.branchId)
  const uid = `emp-${Math.random().toString(36).slice(2, 8)}`
  const batch = writeBatch(db)
  setCredentialInBatch(batch, uid, credential)
  batch.set(userRef(uid), {
    ...form,
    email,
    branchId: actor.access.branchId,
    hiredAt: serverTimestamp(),
    stats: { attendancePct: 100, performanceScore: 0, updatedAt: serverTimestamp() },
    notes: [],
    warnings: [],
    achievements: [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  addActivity(batch, actor, {
    action: 'employee_added',
    summary: `${actor.name} added ${form.name} (${form.position})`,
    entity: entity(uid),
  })
  await batch.commit()
  return uid
}

/**
 * Saves profile changes. A new name is copied onto the employee's open tasks in the
 * same batch, because task lists show the denormalised `assigneeName`.
 */
export async function updateEmployee(
  current: User,
  input: EmployeeForm,
  actor: SessionUser,
  login?: LoginUpdate,
): Promise<void> {
  const form = employeeFormSchema.parse(input)
  const credentialChange = login ? loginUpdateSchema.parse(login) : null
  if (credentialChange && actor.uid !== current.id) {
    if (!canManageCredentials(actor.access.role, current.role))
      throw new AuthError('forbidden', "Only an owner can change a manager's login or password.")
    // Validates and reserves the ID first, so a clash stops the whole save.
    await updateCredential(current.id, {
      loginId: credentialChange.loginId,
      password: credentialChange.password || undefined,
    })
  }
  const batch = writeBatch(db)
  batch.update(userRef(current.id), { ...form, updatedAt: serverTimestamp() })

  if (form.name !== current.name) {
    const open = await getDocs(
      query(
        collection(db, COLLECTIONS.tasks),
        where('branchId', '==', current.branchId),
        where('assigneeId', '==', current.id),
        where('status', 'in', ['pending', 'in_progress', 'overdue']),
      ),
    )
    open.docs.forEach((t) =>
      batch.update(t.ref, { assigneeName: form.name, updatedAt: serverTimestamp() }),
    )
  }

  addActivity(batch, actor, {
    action: 'employee_updated',
    summary: `${actor.name} updated ${form.name}'s profile`,
    entity: entity(current.id),
  })
  await batch.commit()
}

/** Deactivate (never delete) or reactivate. Inactive users can no longer pick themselves in the role switcher. */
export async function setEmployeeStatus(
  employee: User,
  status: EmploymentStatus,
  actor: SessionUser,
): Promise<void> {
  if (employee.id === actor.uid) throw new Error("You can't change your own status.")
  const batch = writeBatch(db)
  batch.update(userRef(employee.id), { status, updatedAt: serverTimestamp() })
  addActivity(batch, actor, {
    action: status === 'inactive' ? 'employee_deactivated' : 'employee_status_changed',
    summary: `${actor.name} set ${employee.name} to ${status.replace('_', ' ')}`,
    entity: entity(employee.id),
  })
  await batch.commit()
}

/** Adds a manager note, warning or achievement to the profile. */
export async function addEmployeeNote(
  employee: User,
  kind: NoteKind,
  text: string,
  actor: SessionUser,
): Promise<void> {
  const note = {
    id: crypto.randomUUID(),
    text: noteTextSchema.parse(text.trim()),
    by: actor.name,
    at: Timestamp.now(),
  }
  const batch = writeBatch(db)
  batch.update(userRef(employee.id), { [kind]: arrayUnion(note), updatedAt: serverTimestamp() })
  const label = { notes: 'a note', warnings: 'a warning', achievements: 'an achievement' }[kind]
  addActivity(batch, actor, {
    action: `employee_${kind.slice(0, -1)}_added`,
    summary: `${actor.name} added ${label} for ${employee.name}`,
    entity: entity(employee.id),
  })
  await batch.commit()
}

/** The demo has no email service: pretend the reset link went out. */
export const sendPasswordReset = async (_email: string) => {
  await new Promise((resolve) => setTimeout(resolve, 400))
}
