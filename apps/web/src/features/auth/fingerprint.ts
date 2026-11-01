import {
  beginDeviceLogin,
  beginDeviceRegistration,
  finishDeviceLogin,
  finishDeviceRegistration,
  type SessionUser,
} from './api'
import {
  browserEnv,
  createDeviceCredential,
  getDeviceAssertion,
  relyingPartyOf,
  WebAuthnError,
  type WebAuthnEnv,
} from '@/lib/webauthn'

/**
 * The two fingerprint flows, each as: ask the API for a challenge -> let the browser prompt
 * the person -> hand the device's answer back to the API to verify. Only the API steps would
 * become network calls with a real backend; the browser step stays as it is.
 */

export async function setUpFingerprint(
  actor: SessionUser,
  label: string,
  env: WebAuthnEnv = browserEnv(),
) {
  const rp = relyingPartyOf(env)
  const options = await beginDeviceRegistration(actor, rp)
  const response = await createDeviceCredential(options, env)
  return finishDeviceRegistration(actor, response, label, rp)
}

export async function loginWithFingerprint(env: WebAuthnEnv = browserEnv()) {
  const rp = relyingPartyOf(env)
  const options = await beginDeviceLogin(rp)
  if (!options)
    throw new WebAuthnError(
      'unsupported',
      'No fingerprint is set up on this browser yet. Sign in with your ID and password, then open Settings → Security to set one up.',
    )
  const response = await getDeviceAssertion(options, env)
  return finishDeviceLogin(response, rp)
}
