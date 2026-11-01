import { fromBase64Url, toBase64Url } from './base64url'
import type { AssertionResponse, RegistrationResponse } from './webauthn'

/**
 * Checks what a device sends back during WebAuthn registration and sign-in.
 *
 * This is the part a real server does. In this demo there is no server, so the auth API
 * (features/auth/api.ts) runs it in the browser against the local store. It is a faithful
 * implementation of the WebAuthn checks (challenge, origin, rpId hash, user-verified flag,
 * signature with the stored public key, signature counter), but it is demo-grade: the stored
 * public key, the counter and the challenge all live in the same browser, so someone who can
 * edit this browser's storage or code can skip it. Real security needs these checks to run on
 * a server the user does not control.
 */
export class WebAuthnVerifyError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'WebAuthnVerifyError'
  }
}

export interface Expected {
  /** The base64url challenge that was issued for this attempt. */
  challenge: string
  origin: string
  rpId: string
}

const FLAG_USER_PRESENT = 0x01
const FLAG_USER_VERIFIED = 0x04
const FLAG_ATTESTED = 0x40

const text = (bytes: Uint8Array) => new TextDecoder().decode(bytes)
const fail = (message: string): never => {
  throw new WebAuthnVerifyError(message)
}
const sha256 = async (data: BufferSource) => new Uint8Array(await crypto.subtle.digest('SHA-256', data))
const equal = (a: Uint8Array, b: Uint8Array) => a.length === b.length && a.every((v, i) => v === b[i])

function checkClientData(encoded: string, type: string, expected: Expected) {
  let data: { type?: unknown; challenge?: unknown; origin?: unknown }
  try {
    data = JSON.parse(text(fromBase64Url(encoded)))
  } catch {
    return fail('The sign-in response could not be read.')
  }
  if (data.type !== type) fail('The sign-in response was for a different action.')
  if (data.challenge !== expected.challenge)
    fail('The sign-in challenge did not match. Start again.')
  if (data.origin !== expected.origin)
    fail('The sign-in came from a different website than this one.')
}

/** Reads the fixed 37-byte head of authenticator data and checks it belongs to this site. */
async function checkAuthData(authData: Uint8Array, expected: Expected) {
  if (authData.length < 37) fail('The device response was too short.')
  const rpIdHash = authData.slice(0, 32)
  if (!equal(rpIdHash, await sha256(new TextEncoder().encode(expected.rpId))))
    fail('The device response was meant for a different site.')
  const flags = authData[32] as number
  if (!(flags & FLAG_USER_PRESENT)) fail('No user was present at the device.')
  if (!(flags & FLAG_USER_VERIFIED)) fail('The fingerprint or screen lock was not checked.')
  const signCount = new DataView(authData.buffer, authData.byteOffset + 33, 4).getUint32(0)
  return { flags, signCount }
}

/** Reads the credential id out of the "attested credential data" part of authenticator data. */
function credentialIdOf(authData: Uint8Array) {
  const length = new DataView(authData.buffer, authData.byteOffset + 53, 2).getUint16(0)
  return authData.slice(55, 55 + length)
}

export interface VerifiedRegistration {
  credentialId: string
  publicKey: string
  algorithm: number
  signCount: number
}

export async function verifyRegistration(
  response: RegistrationResponse,
  expected: Expected,
): Promise<VerifiedRegistration> {
  checkClientData(response.clientDataJSON, 'webauthn.create', expected)
  const authData = fromBase64Url(response.authenticatorData)
  const { flags, signCount } = await checkAuthData(authData, expected)
  if (!(flags & FLAG_ATTESTED) || authData.length < 55)
    fail('The device did not send a new credential.')
  if (toBase64Url(credentialIdOf(authData)) !== response.credentialId)
    fail('The credential id did not match.')
  await importPublicKey(response.publicKey, response.publicKeyAlgorithm)
  return {
    credentialId: response.credentialId,
    publicKey: response.publicKey,
    algorithm: response.publicKeyAlgorithm,
    signCount,
  }
}

export interface StoredPublicKey {
  publicKey: string
  algorithm: number
  signCount: number
}

/** Returns the device's new signature counter; throws if anything does not check out. */
export async function verifyAssertion(
  response: AssertionResponse,
  expected: Expected,
  stored: StoredPublicKey,
): Promise<{ signCount: number }> {
  checkClientData(response.clientDataJSON, 'webauthn.get', expected)
  const authData = fromBase64Url(response.authenticatorData)
  const { signCount } = await checkAuthData(authData, expected)

  const clientDataHash = await sha256(fromBase64Url(response.clientDataJSON))
  const signed = new Uint8Array(authData.length + clientDataHash.length)
  signed.set(authData)
  signed.set(clientDataHash, authData.length)

  const key = await importPublicKey(stored.publicKey, stored.algorithm)
  const signature = fromBase64Url(response.signature)
  const valid =
    stored.algorithm === -7
      ? await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, derToRaw(signature, 32), signed)
      : await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, signature, signed)
  if (!valid) fail('The fingerprint signature did not match this account.')

  // A counter that does not go up can mean the credential was cloned (zero = not supported).
  if ((stored.signCount > 0 || signCount > 0) && signCount <= stored.signCount)
    fail('This device credential looks copied, so it was refused.')
  return { signCount }
}

async function importPublicKey(spki: string, algorithm: number) {
  const bytes = fromBase64Url(spki)
  try {
    if (algorithm === -7)
      return await crypto.subtle.importKey('spki', bytes, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify'])
    if (algorithm === -257)
      return await crypto.subtle.importKey(
        'spki',
        bytes,
        { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
        false,
        ['verify'],
      )
  } catch {
    return fail('The device sent a public key that could not be used.')
  }
  return fail('The device used a signature type this demo does not support.')
}

/** ECDSA signatures arrive DER-encoded; WebCrypto wants the raw r || s. */
export function derToRaw(der: Uint8Array, size: number): Uint8Array<ArrayBuffer> {
  let offset = 2
  if (der[0] !== 0x30) fail('The signature was not in the expected format.')
  if ((der[1] as number) & 0x80) offset += (der[1] as number) & 0x7f
  const readInt = () => {
    if (der[offset] !== 0x02) fail('The signature was not in the expected format.')
    const length = der[offset + 1] as number
    const value = der.slice(offset + 2, offset + 2 + length)
    offset += 2 + length
    return value
  }
  const part = (value: Uint8Array) => {
    const trimmed = value.length > size ? value.slice(value.length - size) : value
    const out = new Uint8Array(size)
    out.set(trimmed, size - trimmed.length)
    return out
  }
  const raw = new Uint8Array(size * 2)
  raw.set(part(readInt()), 0)
  raw.set(part(readInt()), size)
  return raw
}
