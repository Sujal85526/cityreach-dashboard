import { Fingerprint, Info, Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { useSignInWithFingerprint } from '../queries'
import { detectSupport, WebAuthnError, type WebAuthnSupport } from '@/lib/webauthn'

/**
 * "Sign in with fingerprint". Checks the device first and says plainly when it cannot be used
 * (no sensor, no https, old browser) instead of failing on click. Cancelling is not an error.
 */
export function FingerprintButton({ disabled }: { disabled?: boolean }) {
  const signIn = useSignInWithFingerprint()
  const [support, setSupport] = useState<WebAuthnSupport | null>(null)
  const [notice, setNotice] = useState<{ tone: 'info' | 'error'; text: string } | null>(null)

  useEffect(() => {
    let active = true
    void detectSupport().then((result) => active && setSupport(result))
    return () => {
      active = false
    }
  }, [])

  const run = () => {
    setNotice(null)
    signIn.mutate(undefined, {
      onError: (error) => {
        const soft =
          error instanceof WebAuthnError && (error.code === 'cancelled' || error.code === 'timeout')
        const text = error instanceof Error ? error.message : 'Fingerprint sign-in failed.'
        setNotice({
          tone:
            soft || (error instanceof WebAuthnError && error.code === 'unsupported')
              ? 'info'
              : 'error',
          text,
        })
      },
    })
  }

  const unavailable = support !== null && !support.available
  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="outline"
        size="lg"
        className="w-full"
        onClick={run}
        disabled={disabled || signIn.isPending || support === null || unavailable}
      >
        {signIn.isPending ? (
          <Loader2 className="animate-spin" aria-hidden />
        ) : (
          <Fingerprint aria-hidden />
        )}
        {signIn.isPending ? 'Waiting for your fingerprint…' : 'Sign in with fingerprint'}
      </Button>
      {unavailable && (
        <p className="flex items-start gap-2 text-sm text-muted-foreground" role="status">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            <span className="font-medium text-foreground">
              Not available on this device or browser.
            </span>{' '}
            {support.message}
          </span>
        </p>
      )}
      {notice && (
        <p
          role={notice.tone === 'error' ? 'alert' : 'status'}
          className={
            notice.tone === 'error'
              ? 'rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger'
              : 'rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground'
          }
        >
          {notice.text}
        </p>
      )}
    </div>
  )
}
