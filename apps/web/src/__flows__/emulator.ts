/**
 * Test helpers that talk to the emulators' REST APIs as an administrator ("Bearer owner"
 * bypasses security rules), to set up data and to check what the app wrote.
 */
const PROJECT = 'demo-flow-test'
const AUTH_PROJECT = 'demo-digital-manager' // the auth emulator serves one project
const FIRESTORE = `http://127.0.0.1:8080/v1/projects/${PROJECT}/databases/(default)/documents`
const AUTH = 'http://127.0.0.1:9099'
const owner = { Authorization: 'Bearer owner', 'Content-Type': 'application/json' }

type Value = Record<string, unknown>

function toValue(v: unknown): Value {
  if (v === null || v === undefined) return { nullValue: null }
  if (v instanceof Date) return { timestampValue: v.toISOString() }
  if (typeof v === 'boolean') return { booleanValue: v }
  if (typeof v === 'number')
    return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v }
  if (typeof v === 'string') return { stringValue: v }
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toValue) } }
  return { mapValue: { fields: toFields(v as Record<string, unknown>) } }
}
const toFields = (o: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(o).map(([k, v]) => [k, toValue(v)]))

function fromValue(v: Value): unknown {
  if ('nullValue' in v) return null
  if ('timestampValue' in v) return new Date(v.timestampValue as string)
  if ('integerValue' in v) return Number(v.integerValue)
  if ('doubleValue' in v) return v.doubleValue
  if ('booleanValue' in v) return v.booleanValue
  if ('stringValue' in v) return v.stringValue
  if ('arrayValue' in v) return ((v.arrayValue as { values?: Value[] }).values ?? []).map(fromValue)
  if ('mapValue' in v)
    return fromFields((v.mapValue as { fields?: Record<string, Value> }).fields ?? {})
  return undefined
}
const fromFields = (f: Record<string, Value>) =>
  Object.fromEntries(Object.entries(f).map(([k, v]) => [k, fromValue(v)]))

export async function putDoc(path: string, data: Record<string, unknown>) {
  const res = await fetch(`${FIRESTORE}/${path}`, {
    method: 'PATCH',
    headers: owner,
    body: JSON.stringify({ fields: toFields(data) }),
  })
  if (!res.ok) throw new Error(`putDoc ${path}: ${res.status} ${await res.text()}`)
}

export async function getDoc(path: string): Promise<Record<string, unknown> | null> {
  const res = await fetch(`${FIRESTORE}/${path}`, { headers: owner })
  if (res.status === 404) return null
  const json = (await res.json()) as { fields?: Record<string, Value> }
  return fromFields(json.fields ?? {})
}

export async function listDocs(collection: string): Promise<Record<string, unknown>[]> {
  const res = await fetch(`${FIRESTORE}/${collection}?pageSize=500`, { headers: owner })
  const json = (await res.json()) as {
    documents?: { name: string; fields?: Record<string, Value> }[]
  }
  return (json.documents ?? []).map((d) => ({
    id: d.name.split('/').at(-1),
    ...fromFields(d.fields ?? {}),
  }))
}

/** Loads the repo's current firestore.rules into the test project (the emulator caches rules per project). */
export async function loadRules(content: string) {
  const res = await fetch(`http://127.0.0.1:8080/emulator/v1/projects/${PROJECT}:securityRules`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rules: { files: [{ name: 'firestore.rules', content }] } }),
  })
  if (!res.ok) throw new Error(`loadRules: ${res.status} ${await res.text()}`)
}

export async function clearFirestore() {
  await fetch(
    `http://127.0.0.1:8080/emulator/v1/projects/${PROJECT}/databases/(default)/documents`,
    { method: 'DELETE' },
  )
}

/** Creates a login in the auth emulator and returns its uid. */
export async function createLogin(email: string, password: string): Promise<string> {
  const res = await fetch(
    `${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    },
  )
  const json = (await res.json()) as { localId?: string; error?: { message: string } }
  if (!json.localId) throw new Error(`createLogin ${email}: ${json.error?.message}`)
  return json.localId
}

export async function deleteLogins(uids: string[]) {
  await Promise.all(
    uids.map((localId) =>
      fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/projects/${AUTH_PROJECT}/accounts:delete`, {
        method: 'POST',
        headers: owner,
        body: JSON.stringify({ localId }),
      }),
    ),
  )
}
