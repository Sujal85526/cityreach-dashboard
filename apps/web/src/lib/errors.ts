/** A message a user can act on, instead of raw Firebase / security-rule text. */
export function errorMessage(error: unknown): string {
  const code = (error as { code?: string } | null)?.code
  if (code === 'permission-denied')
    return "That action isn't allowed for your account. If this keeps happening, ask your manager."
  if (code === 'unavailable') return "You're offline. Check your connection and try again."
  return error instanceof Error ? error.message : 'Something went wrong. Try again.'
}
