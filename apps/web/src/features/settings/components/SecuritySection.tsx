import { ChangePasswordForm } from './ChangePasswordForm'
import { FingerprintCard } from './FingerprintCard'

/** Settings > Security: the same for owners, managers and employees. */
export function SecuritySection() {
  return (
    <div className="space-y-4">
      <ChangePasswordForm />
      <FingerprintCard />
    </div>
  )
}
