import { SecuritySection } from '../components/SecuritySection'

/** The employee's own Security page (/me/security): password and fingerprint. */
export function MySecurityPage() {
  return (
    <div className="max-w-3xl">
      <SecuritySection />
    </div>
  )
}
