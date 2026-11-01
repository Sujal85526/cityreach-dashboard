import { fromBase64Url, toBase64Url } from './base64url'

/**
 * The browser side of fingerprint / Face ID / Windows Hello sign-in (WebAuthn).
 *
 * This file only talks to the browser. It takes plain options (strings, numbers) and returns
 * plain results, and it checks nothing about them: issuing the challenge, storing the public
 * key and verifying what the device sends back belong to the auth API
 * (features/auth/api.ts), which is the part a real backend would replace.
 *
 * The fingerprint itself never leaves the device. The OS asks for it, then the device signs our
 * challenge with a private key it keeps; we only ever see the signature.
 */

export type WebAuthnErrorCode =
  | 'unsupported' // no WebAuthn, or no fingerprint / screen-lock sensor on this device
  | 'insecure' // not https / localhost, or the page's domain is not allowed to use it
  | 'cancelled' // the person dismissed the prompt
  | 'timeout' // the prompt ran out of time
  | 'already_registered' // this device already has a credential for this person
  | 'failed' // anything else

export class WebAuthnError extends Error {
  readonly code: WebAuthnErrorCode
  constructor(code: WebAuthnErrorCode, message: string) {
    super(message)
    this.name = 'WebAuthnError'
    this.code = code
  }
}

/** Everything read from the browser, so tests can hand in a fake one. */
export interface WebAuthnEnv {
  hostname: string
  origin: string
  isSecureContext: boolean
  credentials: Pick<CredentialsContainer, 'create' | 'get'> | undefined
  hasPublicKeyCredential: boolean
  isPlatformAuthenticatorAvailable: (() => Promise<boolean>) | undefined
  now: () => number
}

export function browserEnv(): WebAuthnEnv {
  if (typeof window === 'undefined') {
    return {
      hostname: '',
      origin: '',
      isSecureContext: false,
      credentials: undefined,
      hasPublicKeyCredential: false,
      isPlatformAuthenticatorAvailable: undefined,
      now: Date.now,
    }
  }
  const pkc = window.PublicKeyCredential as
    | (typeof PublicKeyCredential & {
        isUserVerifyingPlatformAuthenticatorAvailable?: () => Promise<boolean>
      })
    | undefined
  return {
    // Never hard-coded: works on localhost, the production domain and every Vercel preview URL.
    hostname: window.location.hostname,
    origin: window.location.origin,
    isSecureContext: window.isSecureContext,
    credentials: typeof navigator !== 'undefined' ? navigator.credentials : undefined,
    hasPublicKeyCredential: Boolean(pkc),
    isPlatformAuthenticatorAvailable: pkc?.isUserVerifyingPlatformAuthenticatorAvailable
      ? () => pkc.isUserVerifyingPlatformAuthenticatorAvailable!()
      : undefined,
    now: Date.now,
  }
}

/** The relying party this page is: WebAuthn ties every credential to the site's domain. */
export const relyingPartyOf = (env: WebAuthnEnv) => ({ rpId: env.hostname, origin: env.origin })

export type WebAuthnSupport =
  | { available: true }
  | {
      available: false
      reason: 'no_webauthn' | 'insecure_context' | 'no_platform_authenticator'
      message: string
    }

/** Whether this browser and device can offer fingerprint sign-in. Never throws. */
export async function detectSupport(env: WebAuthnEnv = browserEnv()): Promise<WebAuthnSupport> {
  if (!env.hasPublicKeyCredential || !env.credentials)
    return {
      available: false,
      reason: 'no_webauthn',
      message: 'This browser does not support fingerprint sign-in. Try Safari, Chrome, Edge or Firefox.',
    }
  if (!env.isSecureContext)
    return {
      available: false,
      reason: 'insecure_context',
      message: 'Fingerprint sign-in needs a secure page (https:// or localhost).',
    }
  if (env.isPlatformAuthenticatorAvailable) {
    let platform = false
    try {
      platform = await env.isPlatformAuthenticatorAvailable()
    } catch {
      platform = false
    }
    if (!platform)
      return {
        available: false,
        reason: 'no_platform_authenticator',
        message:
          'This device has no fingerprint, Face ID or screen-lock sensor set up. Turn on Touch ID, Windows Hello or an Android fingerprint in the device settings.',
      }
  }
  // Older browsers cannot answer the platform question: let them try; errors are handled below.
  return { available: true }
}

/* ---------- plain objects in and out ---------- */

export interface RegistrationOptions {
  /** Base64url bytes the device will sign into the new credential. */
  challenge: string
  rp: { id: string; name: string }
  /** `id` is an opaque base64url handle, not a name. */
  user: { id: string; name: string; displayName: string }
  /** Credentials this person already has, so the device does not make a second one. */
  excludeCredentialIds: string[]
  timeoutMs: number
}

export interface RegistrationResponse {
  credentialId: string
  clientDataJSON: string
  authenticatorData: string
  /** DER SubjectPublicKeyInfo, base64url. */
  publicKey: string
  /** COSE algorithm: -7 (ES256) or -257 (RS256). */
  publicKeyAlgorithm: number
  transports: string[]
}

export interface AssertionOptions {
  challenge: string
  rpId: string
  allowCredentialIds: string[]
  timeoutMs: number
}

export interface AssertionResponse {
  credentialId: string
  clientDataJSON: string
  authenticatorData: string
  signature: string
  userHandle: string | null
}

export const SUPPORTED_ALGORITHMS = [-7, -257] as const

/** Turns the browser's error into one a person can act on. */
function toWebAuthnError(error: unknown, env: WebAuthnEnv, startedAt: number, timeoutMs: number) {
  if (error instanceof WebAuthnError) return error
  const name = (error as { name?: string } | null)?.name
  switch (name) {
    case 'NotAllowedError':
    case 'AbortError':
      // Browsers report "dismissed" and "timed out" the same way: tell them apart by the clock.
      return env.now() - startedAt >= timeoutMs - 1000
        ? new WebAuthnError('timeout', 'That took too long. Try again when you are ready.')
        : new WebAuthnError('cancelled', 'Fingerprint check was cancelled. Nothing was changed.')
    case 'InvalidStateError':
      return new WebAuthnError(
        'already_registered',
        'This device already has a fingerprint set up for this account.',
      )
    case 'SecurityError':
      return new WebAuthnError(
        'insecure',
        `Fingerprint sign-in is not allowed on ${env.hostname || 'this page'}. Use https:// or localhost.`,
      )
    case 'NotSupportedError':
    case 'ConstraintError':
      return new WebAuthnError(
        'unsupported',
        'This device cannot check a fingerprint or screen lock for this site.',
      )
    default:
      return new WebAuthnError('failed', 'The fingerprint check failed. Try again.')
  }
}

const ensureUsable = (env: WebAuthnEnv) => {
  if (!env.hasPublicKeyCredential || !env.credentials)
    throw new WebAuthnError('unsupported', 'This browser does not support fingerprint sign-in.')
  if (!env.isSecureContext)
    throw new WebAuthnError('insecure', 'Fingerprint sign-in needs https:// or localhost.')
  return env.credentials
}

const bufferOf = (bytes: Uint8Array<ArrayBuffer>) => bytes.buffer

/** Asks the device to create a fingerprint / Face ID / Windows Hello credential for this site. */
export async function createDeviceCredential(
  options: RegistrationOptions,
  env: WebAuthnEnv = browserEnv(),
): Promise<RegistrationResponse> {
  const credentials = ensureUsable(env)
  const startedAt = env.now()
  try {
    const created = (await credentials.create({
      publicKey: {
        challenge: bufferOf(fromBase64Url(options.challenge)),
        rp: options.rp,
        user: {
          id: bufferOf(fromBase64Url(options.user.id)),
          name: options.user.name,
          displayName: options.user.displayName,
        },
        pubKeyCredParams: SUPPORTED_ALGORITHMS.map((alg) => ({ type: 'public-key', alg })),
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'required',
          residentKey: 'preferred',
        },
        excludeCredentials: options.excludeCredentialIds.map((id) => ({
          type: 'public-key',
          id: bufferOf(fromBase64Url(id)),
        })),
        attestation: 'none',
        timeout: options.timeoutMs,
      },
    })) as PublicKeyCredential | null
    if (!created) throw new WebAuthnError('cancelled', 'No fingerprint was registered.')
    const response = created.response as AuthenticatorAttestationResponse
    const publicKey = response.getPublicKey?.()
    const authenticatorData = response.getAuthenticatorData?.()
    if (!publicKey || !authenticatorData)
      throw new WebAuthnError(
        'unsupported',
        'This browser did not hand over the details needed to set up a fingerprint. Update it or try another browser.',
      )
    return {
      credentialId: toBase64Url(created.rawId),
      clientDataJSON: toBase64Url(response.clientDataJSON),
      authenticatorData: toBase64Url(authenticatorData),
      publicKey: toBase64Url(publicKey),
      publicKeyAlgorithm: response.getPublicKeyAlgorithm?.() ?? -7,
      transports: response.getTransports?.() ?? [],
    }
  } catch (error) {
    throw toWebAuthnError(error, env, startedAt, options.timeoutMs)
  }
}

/** Asks the device to prove (fingerprint, Face ID, Windows Hello) that its owner is here. */
export async function getDeviceAssertion(
  options: AssertionOptions,
  env: WebAuthnEnv = browserEnv(),
): Promise<AssertionResponse> {
  const credentials = ensureUsable(env)
  const startedAt = env.now()
  try {
    const got = (await credentials.get({
      publicKey: {
        challenge: bufferOf(fromBase64Url(options.challenge)),
        rpId: options.rpId,
        allowCredentials: options.allowCredentialIds.map((id) => ({
          type: 'public-key',
          id: bufferOf(fromBase64Url(id)),
        })),
        userVerification: 'required',
        timeout: options.timeoutMs,
      },
    })) as PublicKeyCredential | null
    if (!got) throw new WebAuthnError('cancelled', 'No fingerprint was checked.')
    const response = got.response as AuthenticatorAssertionResponse
    return {
      credentialId: toBase64Url(got.rawId),
      clientDataJSON: toBase64Url(response.clientDataJSON),
      authenticatorData: toBase64Url(response.authenticatorData),
      signature: toBase64Url(response.signature),
      userHandle: response.userHandle ? toBase64Url(response.userHandle) : null,
    }
  } catch (error) {
    throw toWebAuthnError(error, env, startedAt, options.timeoutMs)
  }
}
