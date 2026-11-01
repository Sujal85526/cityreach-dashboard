/**
 * Login IDs of the seeded people the README documents. The shared password is kept out of the
 * app code on purpose (see README -> Demo logins); only tests know it.
 */
export interface DemoLogin {
  role: 'owner' | 'manager' | 'employee'
  /** Login ID the person types. */
  loginId: string
  /** Store id of the seeded user it belongs to. */
  uid: string
}

export const DEMO_LOGINS: readonly DemoLogin[] = [
  { role: 'owner', loginId: 'owner', uid: 'amara' },
  { role: 'manager', loginId: 'manager', uid: 'daniel' },
  { role: 'employee', loginId: 'employee', uid: 'maya' },
]

/**
 * Login ID of a seeded user: the three demo logins above, otherwise the user id itself
 * (`liam`, `noah`, `sq-hana`…), which is already unique across all branches.
 */
export const seedLoginId = (uid: string) => DEMO_LOGINS.find((d) => d.uid === uid)?.loginId ?? uid
