import { beforeAll, describe, expect, it } from 'vitest'
import type { SessionUser } from '@/features/auth/api'
import { resetDemoData } from '@/lib/store'
import '@/lib/store/seed'
import { listOwnedBranches, loadBranchSummary } from './api'

const as = (uid: string, role: 'owner' | 'manager' | 'employee') =>
  ({ uid, name: uid, email: '', access: { role, branchId: 'central' } }) as SessionUser

beforeAll(() => resetDemoData())

describe('all branches is owner-only in the data layer too', () => {
  it('lists every branch the owner owns, the default one included', async () => {
    const branches = await listOwnedBranches(as('amara', 'owner'))
    expect(branches.map((b) => b.id).sort()).toEqual(['central', 'didsbury', 'salford-quays'])
  })

  it.each(['manager', 'employee'] as const)('refuses a %s', async (role) => {
    await expect(listOwnedBranches(as('daniel', role))).rejects.toThrow('Only an owner')
    const [central] = await listOwnedBranches(as('amara', 'owner'))
    if (!central) throw new Error('seed has no branch')
    await expect(loadBranchSummary(central, as('daniel', role))).rejects.toThrow('Only an owner')
  })

  it('refuses an owner who does not own that branch', async () => {
    const [central] = await listOwnedBranches(as('amara', 'owner'))
    if (!central) throw new Error('seed has no branch')
    await expect(loadBranchSummary(central, as('someone-else', 'owner'))).rejects.toThrow(
      'do not own',
    )
  })

  it('summarises each seeded branch with its own staff and sales', async () => {
    const branches = await listOwnedBranches(as('amara', 'owner'))
    const rows = await Promise.all(
      branches.map(async (b) => [b.id, await loadBranchSummary(b, as('amara', 'owner'))] as const),
    )
    const byId = Object.fromEntries(rows)
    expect(byId['salford-quays']?.staff).toBe(5)
    expect(byId['didsbury']?.staff).toBe(4)
    expect(byId['didsbury']?.sales).toBeGreaterThan(0)
    expect(byId['central']?.sales).toBeGreaterThan(0)
  })
})
