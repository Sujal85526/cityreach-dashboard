import { COLLECTIONS } from '@cityreach/shared'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { listDevices, AuthError, type SessionUser } from '@/features/auth/api'
import { loginWithFingerprint, setUpFingerprint } from '@/features/auth/fingerprint'
import { collection, db, getDocs, resetDemoData } from '@/lib/store'
import '@/lib/store/seed'
import { fromBase64Url, toBase64Url } from './base64url'
import {
  createDeviceCredential,
  detectSupport,
  getDeviceAssertion,
  WebAuthnError,
  type WebAuthnEnv,
} from './webauthn'

/* A pretend fingerprint sensor: a real P-256 key pair that signs like a platform authenticator. */

const text = (s: string) => new TextEncoder().encode(s)
const sha256 = async (d: BufferSource) => new Uint8Array(await crypto.subtle.digest('SHA-256', d))
const concat = (...parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let at = 0
  for (const p of parts) {
    out.set(p, at)
    at += p.length
  }
  return out
}
const derInt = (raw: Uint8Array) => {
  let v = raw
  while (v.length > 1 && v[0] === 0) v = v.slice(1)
  if ((v[0] as number) & 0x80) v = concat(new Uint8Array([0]), v)
  return concat(new Uint8Array([0x02, v.length]), v)
}
const toDer = (raw: Uint8Array) => {
  const body = concat(derInt(raw.slice(0, 32)), derInt(raw.slice(32)))
  return concat(new Uint8Array([0x30, body.length]), body)
}
const buf = (b: Uint8Array) => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)

type Behaviour = {
  /** Reject like a browser would. */
  reject?: string
  /** Leave the user-verified flag off. */
  skipUv?: boolean
  /** Sign with a different key (a forged assertion). */
  forge?: boolean
  /** Wrong challenge in the client data. */
  wrongChallenge?: boolean
  /** Report this signature counter. */
  counter?: number
}

async function makeAuthenticator(origin: string, rpId: string) {
  const keys = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, [
    'sign',
    'verify',
  ])
  const stranger = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, [
    'sign',
    'verify',
  ])
  const spki = new Uint8Array(await crypto.subtle.exportKey('spki', keys.publicKey))
  const credentialId = crypto.getRandomValues(new Uint8Array(16))
  const state: { behaviour: Behaviour; counter: number; calls: unknown[] } = {
    behaviour: {},
    counter: 0,
    calls: [],
  }
  const rpHash = () => sha256(text(rpId))
  const clientData = (type: string, challenge: ArrayBuffer) =>
    text(
      JSON.stringify({
        type,
        challenge: state.behaviour.wrongChallenge ? 'AAAA' : toBase64Url(challenge),
        origin,
      }),
    )
  const flags = (extra: number) => (state.behaviour.skipUv ? 0x01 : 0x05) | extra
  const counterBytes = (n: number) =>
    new Uint8Array([n >>> 24, n >>> 16, n >>> 8, n].map((x) => x & 255))

  const fail = () => {
    const err = new Error('nope')
    err.name = state.behaviour.reject as string
    return Promise.reject(err)
  }

  const credentials = {
    async create(options: CredentialCreationOptions) {
      state.calls.push(options)
      if (state.behaviour.reject) return fail()
      const pk = options.publicKey as PublicKeyCredentialCreationOptions
      const authData = concat(
        await rpHash(),
        new Uint8Array([flags(0x40)]),
        counterBytes(0),
        new Uint8Array(16),
        new Uint8Array([0, credentialId.length]),
        credentialId,
        new Uint8Array([0xa0]), // an (empty) COSE key: not parsed by the verifier
      )
      return {
        rawId: buf(credentialId),
        response: {
          clientDataJSON: buf(clientData('webauthn.create', pk.challenge as ArrayBuffer)),
          getPublicKey: () => buf(spki),
          getAuthenticatorData: () => buf(authData),
          getPublicKeyAlgorithm: () => -7,
          getTransports: () => ['internal'],
        },
      } as unknown as Credential
    },
    async get(options: CredentialRequestOptions) {
      state.calls.push(options)
      if (state.behaviour.reject) return fail()
      const pk = options.publicKey as PublicKeyCredentialRequestOptions
      state.counter = state.behaviour.counter ?? state.counter + 1
      const authData = concat(
        await rpHash(),
        new Uint8Array([flags(0)]),
        counterBytes(state.counter),
      )
      const cd = clientData('webauthn.get', pk.challenge as ArrayBuffer)
      const signed = concat(authData, await sha256(cd))
      const raw = new Uint8Array(
        await crypto.subtle.sign(
          { name: 'ECDSA', hash: 'SHA-256' },
          (state.behaviour.forge ? stranger : keys).privateKey,
          signed,
        ),
      )
      return {
        rawId: buf(credentialId),
        response: {
          clientDataJSON: buf(cd),
          authenticatorData: buf(authData),
          signature: buf(toDer(raw)),
          userHandle: null,
        },
      } as unknown as Credential
    },
  }
  return { credentials, state, credentialId: toBase64Url(credentialId) }
}

const ORIGIN = 'https://cityreach-dashboard.vercel.app'
const envWith = (
  credentials: WebAuthnEnv['credentials'],
  over: Partial<WebAuthnEnv> = {},
): WebAuthnEnv => ({
  hostname: 'cityreach-dashboard.vercel.app',
  origin: ORIGIN,
  isSecureContext: true,
  credentials,
  hasPublicKeyCredential: true,
  isPlatformAuthenticatorAvailable: async () => true,
  now: Date.now,
  ...over,
})
const user = {
  uid: 'maya',
  name: 'Maya Patel',
  email: 'maya@cityreach.co.uk',
  access: { role: 'employee', branchId: 'central' },
} as SessionUser

const memory = new Map<string, string>()
beforeAll(() => {
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => memory.get(k) ?? null,
    setItem: (k: string, v: string) => void memory.set(k, v),
    removeItem: (k: string) => void memory.delete(k),
  })
})
beforeEach(() => {
  memory.clear()
  resetDemoData()
})

describe('feature detection', () => {
  it('is available with WebAuthn, a secure page and a platform authenticator', async () => {
    expect(await detectSupport(envWith({} as never))).toEqual({ available: true })
  })

  it('says why it is unavailable, and never throws', async () => {
    const noApi = await detectSupport(envWith(undefined, { hasPublicKeyCredential: false }))
    expect(noApi).toMatchObject({ available: false, reason: 'no_webauthn' })
    const http = await detectSupport(envWith({} as never, { isSecureContext: false }))
    expect(http).toMatchObject({ available: false, reason: 'insecure_context' })
    const noSensor = await detectSupport(
      envWith({} as never, { isPlatformAuthenticatorAvailable: async () => false }),
    )
    expect(noSensor).toMatchObject({ available: false, reason: 'no_platform_authenticator' })
    const broken = await detectSupport(
      envWith({} as never, {
        isPlatformAuthenticatorAvailable: () => Promise.reject(new Error('boom')),
      }),
    )
    expect(broken).toMatchObject({ available: false, reason: 'no_platform_authenticator' })
  })

  it('lets browsers that cannot answer the platform question try', async () => {
    expect(
      await detectSupport(envWith({} as never, { isPlatformAuthenticatorAvailable: undefined })),
    ).toEqual({
      available: true,
    })
  })
})

describe('registration', () => {
  it('asks for a platform authenticator with user verification and stores the key', async () => {
    const device = await makeAuthenticator(ORIGIN, 'cityreach-dashboard.vercel.app')
    const env = envWith(device.credentials)
    const saved = await setUpFingerprint(user, "Maya's phone", env)

    const asked = (device.state.calls[0] as CredentialCreationOptions)
      .publicKey as PublicKeyCredentialCreationOptions
    expect(asked.authenticatorSelection).toEqual({
      authenticatorAttachment: 'platform',
      userVerification: 'required',
      residentKey: 'preferred',
    })
    expect(asked.rp.id).toBe('cityreach-dashboard.vercel.app') // from the hostname, not hard-coded
    expect(saved).toMatchObject({
      id: device.credentialId,
      userId: 'maya',
      label: "Maya's phone",
      algorithm: -7,
    })
    expect((await listDevices('maya')).map((d) => d.id)).toEqual([device.credentialId])
    expect(
      JSON.stringify(
        await getDocs(collection(db, COLLECTIONS.deviceCredentials)).then((s) =>
          s.docs.map((d) => d.data()),
        ),
      ),
    ).toContain('publicKey')
  })

  it('uses localhost as the rpId on localhost', async () => {
    const device = await makeAuthenticator('http://localhost:5173', 'localhost')
    await setUpFingerprint(
      user,
      'Laptop',
      envWith(device.credentials, { hostname: 'localhost', origin: 'http://localhost:5173' }),
    )
    const asked = (device.state.calls[0] as CredentialCreationOptions)
      .publicKey as PublicKeyCredentialCreationOptions
    expect(asked.rp.id).toBe('localhost')
  })

  it.each([
    ['NotAllowedError', 'cancelled'],
    ['InvalidStateError', 'already_registered'],
    ['NotSupportedError', 'unsupported'],
    ['SecurityError', 'insecure'],
    ['SomethingElse', 'failed'],
  ])('turns %s into a friendly %s error and stores nothing', async (name, code) => {
    const device = await makeAuthenticator(ORIGIN, 'cityreach-dashboard.vercel.app')
    device.state.behaviour = { reject: name }
    const error = await setUpFingerprint(user, 'Phone', envWith(device.credentials)).catch(
      (e: unknown) => e,
    )
    expect(error).toBeInstanceOf(WebAuthnError)
    expect((error as WebAuthnError).code).toBe(code)
    expect((error as WebAuthnError).message).not.toMatch(/DOMException|Error:/)
    expect(await listDevices('maya')).toEqual([])
  })

  it('reports a timeout when the prompt ran out of time', async () => {
    const device = await makeAuthenticator(ORIGIN, 'cityreach-dashboard.vercel.app')
    device.state.behaviour = { reject: 'NotAllowedError' }
    let t = 0
    const env = envWith(device.credentials, { now: () => (t += 61_000) })
    const error = await setUpFingerprint(user, 'Phone', env).catch((e: unknown) => e)
    expect((error as WebAuthnError).code).toBe('timeout')
  })

  it('refuses to start when WebAuthn is not supported', async () => {
    const error = await createDeviceCredential(
      {
        challenge: 'AAAA',
        rp: { id: 'x', name: 'x' },
        user: { id: 'AAAA', name: 'x', displayName: 'x' },
        excludeCredentialIds: [],
        timeoutMs: 1,
      },
      envWith(undefined, { hasPublicKeyCredential: false }),
    ).catch((e: unknown) => e)
    expect((error as WebAuthnError).code).toBe('unsupported')
  })

  it('rejects a registration where the device skipped the fingerprint check', async () => {
    const device = await makeAuthenticator(ORIGIN, 'cityreach-dashboard.vercel.app')
    device.state.behaviour = { skipUv: true }
    const error = await setUpFingerprint(user, 'Phone', envWith(device.credentials)).catch(
      (e: unknown) => e,
    )
    expect(error).toBeInstanceOf(AuthError)
    expect((error as AuthError).message).toMatch(/fingerprint or screen lock was not checked/)
    expect(await listDevices('maya')).toEqual([])
  })
})

describe('signing in with a fingerprint', () => {
  const register = async () => {
    const device = await makeAuthenticator(ORIGIN, 'cityreach-dashboard.vercel.app')
    const env = envWith(device.credentials)
    await setUpFingerprint(user, 'Phone', env)
    return { device, env }
  }

  it('signs the person in when the assertion verifies', async () => {
    const { env, device } = await register()
    const session = await loginWithFingerprint(env)
    expect(session.uid).toBe('maya')
    expect(memory.get('cityreach-session')).toBe('maya')
    const asked = (device.state.calls.at(-1) as CredentialRequestOptions)
      .publicKey as PublicKeyCredentialRequestOptions
    expect(asked.userVerification).toBe('required')
    expect(asked.rpId).toBe('cityreach-dashboard.vercel.app')
    expect(asked.allowCredentials).toHaveLength(1)
    // And it can be done again: the counter keeps going up.
    expect((await loginWithFingerprint(env)).uid).toBe('maya')
    expect((await listDevices('maya'))[0]?.lastUsedAt).toBeInstanceOf(Date)
  })

  it('tells the person to set one up when this browser has none', async () => {
    const device = await makeAuthenticator(ORIGIN, 'cityreach-dashboard.vercel.app')
    const error = await loginWithFingerprint(envWith(device.credentials)).catch((e: unknown) => e)
    expect((error as WebAuthnError).code).toBe('unsupported')
    expect((error as WebAuthnError).message).toMatch(/Settings/)
    expect(device.state.calls).toHaveLength(0)
  })

  it('does not sign in when the prompt is cancelled', async () => {
    const { env, device } = await register()
    device.state.behaviour = { reject: 'NotAllowedError' }
    const error = await loginWithFingerprint(env).catch((e: unknown) => e)
    expect((error as WebAuthnError).code).toBe('cancelled')
    expect(memory.has('cityreach-session')).toBe(false)
  })

  it('does not sign in with a forged signature', async () => {
    const { env, device } = await register()
    device.state.behaviour = { forge: true }
    const error = await loginWithFingerprint(env).catch((e: unknown) => e)
    expect((error as AuthError).message).toMatch(/signature did not match/)
    expect(memory.has('cityreach-session')).toBe(false)
  })

  it('does not sign in when the device skipped user verification', async () => {
    const { env, device } = await register()
    device.state.behaviour = { skipUv: true }
    const error = await loginWithFingerprint(env).catch((e: unknown) => e)
    expect((error as AuthError).message).toMatch(/not checked/)
  })

  it('does not sign in with a wrong challenge', async () => {
    const { env, device } = await register()
    device.state.behaviour = { wrongChallenge: true }
    const error = await loginWithFingerprint(env).catch((e: unknown) => e)
    expect((error as AuthError).code).toBe('invalid_device')
    expect(memory.has('cityreach-session')).toBe(false)
  })

  it('refuses a replayed signature counter (a copied credential)', async () => {
    const { env, device } = await register()
    device.state.behaviour = { counter: 5 }
    await loginWithFingerprint(env)
    device.state.behaviour = { counter: 5 }
    const error = await loginWithFingerprint(env).catch((e: unknown) => e)
    expect((error as AuthError).message).toMatch(/copied/)
  })

  it('refuses an assertion made for another site or origin', async () => {
    const { device } = await register()
    const wrongSite = envWith(device.credentials, {
      hostname: 'evil.example',
      origin: 'https://evil.example',
    })
    // Nothing is registered for that domain in this browser, so there is nothing to offer.
    const error = await loginWithFingerprint(wrongSite).catch((e: unknown) => e)
    expect((error as WebAuthnError).code).toBe('unsupported')
  })

  it('does not sign in someone who has been switched off', async () => {
    const { env } = await register()
    const { updateDoc, doc } = await import('@/lib/store')
    await updateDoc(doc(db, COLLECTIONS.users, 'maya'), { status: 'inactive' })
    const error = await loginWithFingerprint(env).catch((e: unknown) => e)
    expect((error as AuthError).code).toBe('inactive')
  })

  it('removing the device stops it signing in', async () => {
    const { env, device } = await register()
    const { removeDevice } = await import('@/features/auth/api')
    await removeDevice(user, device.credentialId)
    const error = await loginWithFingerprint(env).catch((e: unknown) => e)
    expect((error as WebAuthnError).code).toBe('unsupported')
  })

  it('getDeviceAssertion maps a browser refusal without needing the store', async () => {
    const device = await makeAuthenticator(ORIGIN, 'cityreach-dashboard.vercel.app')
    device.state.behaviour = { reject: 'NotAllowedError' }
    const error = await getDeviceAssertion(
      {
        challenge: toBase64Url(new Uint8Array(32)),
        rpId: 'x',
        allowCredentialIds: [toBase64Url(fromBase64Url('AAAA'))],
        timeoutMs: 60_000,
      },
      envWith(device.credentials),
    ).catch((e: unknown) => e)
    expect((error as WebAuthnError).code).toBe('cancelled')
  })
})
