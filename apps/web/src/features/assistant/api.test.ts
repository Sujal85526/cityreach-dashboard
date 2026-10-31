import type { Branch } from '@cityreach/shared'
import type { QueryClient } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'
import type { SessionUser } from '@/features/auth/api'
import { ask, MANAGERS_ONLY, type AskContext } from './api'
import { MANAGER_INTENTS } from './intents'

/** A query client that fails the test if anything tries to read data through it. */
const client = {
  fetchQuery: () => {
    throw new Error('the data layer was read')
  },
} as unknown as QueryClient

const context = (role: 'employee' | 'manager' | 'owner'): AskContext => ({
  user: { uid: 'u1', name: 'Test Person', email: 't@x.test', access: { role } } as SessionUser,
  branch: { id: 'b1', rules: { timeZone: 'Europe/London' } } as Branch,
  today: '2026-10-31',
  client,
})

describe('the data layer refuses staff asking for shop-wide data', () => {
  it.each(MANAGER_INTENTS)('%s returns nothing but the refusal', async (intent) => {
    const answer = await ask(intent, null, context('employee'))
    expect(answer).toEqual({ text: MANAGERS_ONLY })
  })

  it('still answers managers (it only fails because the fake client reads nothing)', async () => {
    await expect(ask('sales', null, context('manager'))).rejects.toThrow('the data layer was read')
  })

  it('refuses a manager who is not an owner the all-branches overview', async () => {
    const answer = await ask('branches', null, context('manager'))
    expect(answer.text).toContain('Only the owner')
    expect(answer.lines).toBeUndefined()
  })
})
