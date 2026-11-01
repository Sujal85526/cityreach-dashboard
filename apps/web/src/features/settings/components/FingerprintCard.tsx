import { DEVICE_LABEL_MAX, type DeviceCredential } from '@cityreach/shared'
import { Fingerprint, Info, Loader2, Smartphone, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { useDevices, useRemoveDevice, useSetUpFingerprint } from '@/features/auth/queries'
import { formatDate } from '@/lib/format'
import { detectSupport, WebAuthnError, type WebAuthnSupport } from '@/lib/webauthn'
import { SettingsCard } from './SettingsCard'

/** A readable default name for this device, e.g. "iPhone" or "Windows PC". */
export function guessDeviceLabel(userAgent = navigator.userAgent): string {
  if (/iPhone/.test(userAgent)) return 'iPhone'
  if (/iPad/.test(userAgent)) return 'iPad'
  if (/Android/.test(userAgent)) return 'Android phone'
  if (/Windows/.test(userAgent)) return 'Windows PC'
  if (/Mac/.test(userAgent)) return 'Mac'
  if (/Linux/.test(userAgent)) return 'Linux PC'
  return 'This device'
}

/**
 * Settings > Security: set up a fingerprint (or Face ID / Windows Hello) on this device, see
 * the devices registered for this account, and remove them.
 */
export function FingerprintCard() {
  const devices = useDevices()
  const setUp = useSetUpFingerprint()
  const remove = useRemoveDevice()
  const [support, setSupport] = useState<WebAuthnSupport | null>(null)
  const [label, setLabel] = useState(() => guessDeviceLabel())
  const [toRemove, setToRemove] = useState<DeviceCredential | null>(null)

  useEffect(() => {
    let active = true
    void detectSupport().then((result) => active && setSupport(result))
    return () => {
      active = false
    }
  }, [])

  const register = () => {
    setUp.mutate(label, {
      onSuccess: () =>
        toast.success('Fingerprint set up. You can now sign in with it on this device.'),
      onError: (error) => {
        const softCodes = ['cancelled', 'timeout', 'already_registered']
        if (error instanceof WebAuthnError && softCodes.includes(error.code))
          toast.info(error.message)
        else
          toast.error(error instanceof Error ? error.message : 'Could not set up the fingerprint.')
      },
    })
  }

  return (
    <SettingsCard
      title="Fingerprint sign-in"
      description="Use this device's fingerprint, Face ID or Windows Hello instead of typing your password."
    >
      {support === null ? (
        <Skeleton className="h-10 w-64" />
      ) : support.available ? (
        <div className="flex max-w-lg flex-wrap items-end gap-3">
          <div className="min-w-0 flex-1 basis-48 space-y-2">
            <Label htmlFor="device-label">Name this device</Label>
            <Input
              id="device-label"
              value={label}
              maxLength={DEVICE_LABEL_MAX}
              onChange={(e) => setLabel(e.target.value)}
              autoComplete="off"
            />
          </div>
          <Button
            onClick={register}
            disabled={setUp.isPending || !label.trim()}
            className="max-sm:w-full"
          >
            {setUp.isPending ? (
              <Loader2 className="animate-spin" aria-hidden />
            ) : (
              <Fingerprint aria-hidden />
            )}
            {setUp.isPending
              ? 'Waiting for your fingerprint…'
              : 'Set up fingerprint on this device'}
          </Button>
        </div>
      ) : (
        <p className="flex items-start gap-3 rounded-xl bg-muted p-4 text-sm" role="status">
          <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
          <span>
            <span className="block font-medium">
              Fingerprint sign-in is not available on this device or browser.
            </span>
            <span className="text-muted-foreground">{support.message}</span>
          </span>
        </p>
      )}

      <div className="space-y-2">
        <h3 className="text-sm font-medium">Registered devices</h3>
        {devices.isPending ? (
          <Skeleton className="h-14 w-full" />
        ) : devices.data && devices.data.length > 0 ? (
          <ul className="divide-y rounded-xl border">
            {devices.data.map((d) => (
              <li key={d.id} className="flex items-center gap-3 p-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-primary">
                  <Smartphone className="size-4" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{d.label}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    Added {formatDate(d.createdAt)} ·{' '}
                    {d.lastUsedAt ? `last used ${formatDate(d.lastUsedAt)}` : 'not used yet'} ·{' '}
                    {d.rpId}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setToRemove(d)}
                  aria-label={`Remove ${d.label}`}
                >
                  <Trash2 aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
            No fingerprint set up yet. Once one is set up it is listed here, and you can use
            Sign in with fingerprint on the login screen.
          </p>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Your fingerprint never leaves the device. This demo has no server, so the sign-in check runs
        in your browser: it shows how the flow works, it is not server-side security.
      </p>

      <ConfirmDialog
        open={toRemove !== null}
        onOpenChange={(open) => !open && setToRemove(null)}
        title="Remove this device?"
        description={`${toRemove?.label ?? 'This device'} will no longer sign in with a fingerprint. You can set it up again later.`}
        confirmLabel="Remove device"
        destructive
        pending={remove.isPending}
        onConfirm={() =>
          toRemove &&
          remove.mutate(toRemove.id, {
            onSuccess: () => {
              toast.success('Device removed')
              setToRemove(null)
            },
            onError: (e) => toast.error(e instanceof Error ? e.message : 'Could not remove it.'),
          })
        }
      />
    </SettingsCard>
  )
}
