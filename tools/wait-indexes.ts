/**
 * Waits until every Firestore index on the production project is built (READY).
 * New indexes take a few minutes after `firebase deploy`; until then pages that need them show
 * "The query requires an index… currently building". Run after every deploy that adds indexes:
 *   pnpm indexes:wait
 * Uses the Firebase CLI login on this computer (`npx firebase login`).
 */
import { execSync } from 'node:child_process'
import { setDefaultResultOrder } from 'node:dns'
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'

// Some networks have no IPv6 route; Node would otherwise try it first and fail.
setDefaultResultOrder('ipv4first')

const PROJECT = 'digital-manager-f916d'
const TIMEOUT_MS = 20 * 60_000
const EVERY_MS = 20_000

function token(): string {
  // Any CLI call refreshes the saved access token first.
  execSync(`npx firebase projects:list --json`, { stdio: 'ignore' })
  const config = JSON.parse(
    readFileSync(`${homedir()}/.config/configstore/firebase-tools.json`, 'utf8'),
  ) as { tokens?: { access_token?: string } }
  const t = config.tokens?.access_token
  if (!t) throw new Error('Not logged in to the Firebase CLI. Run: npx firebase login')
  return t
}

interface Index {
  name: string
  state: string
  fields: { fieldPath: string }[]
}

async function notReady(): Promise<string[]> {
  const res = await fetch(
    `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/collectionGroups/-/indexes`,
    { headers: { Authorization: `Bearer ${token()}` } },
  )
  if (!res.ok) throw new Error(`Firestore said ${res.status}: ${await res.text()}`)
  const { indexes = [] } = (await res.json()) as { indexes?: Index[] }
  return indexes
    .filter((i) => i.state !== 'READY')
    .map((i) => {
      const group = i.name.split('/collectionGroups/')[1]?.split('/')[0]
      const fields = i.fields.map((f) => f.fieldPath).filter((f) => f !== '__name__')
      return `${group} (${fields.join(', ')}): ${i.state}`
    })
}

const started = Date.now()
for (;;) {
  // A dropped connection is retried on the next round, not treated as a failure.
  const pending = await notReady().catch((e: unknown) => {
    console.log(
      `Couldn't reach Firebase (${e instanceof Error ? e.message : String(e)}); retrying…`,
    )
    return null
  })
  if (pending?.length === 0) {
    console.log(`All indexes are READY (${Math.round((Date.now() - started) / 1000)} s).`)
    break
  }
  if (Date.now() - started > TIMEOUT_MS) {
    console.error(
      `Not confirmed after 20 min:\n  ${pending?.join('\n  ') ?? 'Firebase unreachable'}`,
    )
    process.exit(1)
  }
  if (pending) console.log(`Building: ${pending.join('; ')}`)
  await new Promise((r) => setTimeout(r, EVERY_MS))
}
