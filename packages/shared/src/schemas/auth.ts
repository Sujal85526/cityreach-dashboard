import { z } from 'zod'

export const LOGIN_ID_MIN = 3
export const LOGIN_ID_MAX = 30
export const PASSWORD_MIN = 8
export const PASSWORD_MAX = 128

/**
 * Login IDs are case-insensitive: they are compared and stored in lower case
 * (see `normalizeLoginId`), so "Maya" and "maya" are the same ID.
 */
export const loginIdSchema = z
  .string()
  .trim()
  .min(LOGIN_ID_MIN, `Login ID must be at least ${LOGIN_ID_MIN} characters`)
  .max(LOGIN_ID_MAX, `Login ID must be at most ${LOGIN_ID_MAX} characters`)
  .regex(
    /^[A-Za-z0-9][A-Za-z0-9._-]*$/,
    'Use letters, numbers, dots, dashes or underscores, starting with a letter or number',
  )

export const normalizeLoginId = (value: string) => value.trim().toLowerCase()

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN, `Password must be at least ${PASSWORD_MIN} characters`)
  .max(PASSWORD_MAX, `Password must be at most ${PASSWORD_MAX} characters`)
  .refine((v) => v.trim().length > 0, 'Password cannot be only spaces')

/** The sign-in form: only presence is checked here; correctness is the API's job. */
export const loginFormSchema = z.object({
  loginId: z.string().trim().min(1, 'Enter your login ID'),
  password: z.string().min(1, 'Enter your password'),
})
export type LoginForm = z.infer<typeof loginFormSchema>

/** An employee changing their own password in Settings > Security. */
export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password'),
    newPassword: passwordSchema,
    confirmPassword: z.string().min(1, 'Type the new password again'),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    path: ['confirmPassword'],
    message: 'The two passwords do not match',
  })
  .refine((v) => v.newPassword !== v.currentPassword, {
    path: ['newPassword'],
    message: 'Choose a password you have not used just now',
  })
export type ChangePasswordForm = z.infer<typeof changePasswordSchema>

/** A manager editing someone's sign-in details: a new ID, a new password, or both. */
export const loginUpdateSchema = z.object({
  loginId: loginIdSchema,
  /** Empty = keep the current password. */
  password: z.union([z.literal(''), passwordSchema]),
})
export type LoginUpdate = z.infer<typeof loginUpdateSchema>

/** A salted password hash. The password itself is never stored. */
export interface PasswordHash {
  algorithm: 'PBKDF2-SHA256'
  iterations: number
  /** Base64url. */
  salt: string
  /** Base64url. */
  hash: string
}

/** Sign-in details of one user (doc id = user id); kept apart from the profile in `users`. */
export interface Credential {
  id: string
  /** Lower case. */
  loginId: string
  branchId: string
  password: PasswordHash
  failedAttempts: number
  lockedUntil: Date | null
  passwordChangedAt: Date
}

/** A fingerprint / Face ID / Windows Hello credential registered in this browser. */
export interface DeviceCredential {
  /** The credential id the device made, base64url. */
  id: string
  userId: string
  /** What the person called this device, e.g. "Sujal's iPhone". */
  label: string
  /** DER SubjectPublicKeyInfo, base64url. */
  publicKey: string
  /** COSE algorithm: -7 (ES256) or -257 (RS256). */
  algorithm: number
  signCount: number
  /** The site domain the credential belongs to (location.hostname when it was made). */
  rpId: string
  createdAt: Date
  lastUsedAt: Date | null
}

export const DEVICE_LABEL_MAX = 40
export const deviceLabelSchema = z
  .string()
  .trim()
  .min(1, 'Give this device a name')
  .max(DEVICE_LABEL_MAX, `At most ${DEVICE_LABEL_MAX} characters`)
