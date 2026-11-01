import type { Role } from '../constants/collections'

/**
 * Who may set or reset whose login ID and password. A manager looks after employees; only an
 * owner can touch a manager's or another owner's sign-in. Nobody uses this on themselves:
 * people change their own password from Settings > Security.
 */
export function canManageCredentials(actor: Role, target: Role): boolean {
  if (actor === 'owner') return true
  if (actor === 'manager') return target === 'employee'
  return false
}
