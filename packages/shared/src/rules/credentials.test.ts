import { describe, expect, it } from 'vitest'
import { changePasswordSchema, loginIdSchema, passwordSchema } from '../schemas/auth'
import { newEmployeeSchema } from '../schemas/user'
import { canManageCredentials } from './credentials'

describe('who manages whose login', () => {
  it('owners manage everyone, managers only employees, employees nobody', () => {
    expect(canManageCredentials('owner', 'manager')).toBe(true)
    expect(canManageCredentials('manager', 'employee')).toBe(true)
    expect(canManageCredentials('manager', 'manager')).toBe(false)
    expect(canManageCredentials('manager', 'owner')).toBe(false)
    expect(canManageCredentials('employee', 'employee')).toBe(false)
  })
})

describe('login validation', () => {
  it('enforces the login ID shape and length', () => {
    expect(loginIdSchema.safeParse('maya.p').success).toBe(true)
    expect(loginIdSchema.safeParse('ab').success).toBe(false)
    expect(loginIdSchema.safeParse('has space').success).toBe(false)
    expect(loginIdSchema.safeParse('-leading').success).toBe(false)
    expect(loginIdSchema.safeParse('x'.repeat(31)).success).toBe(false)
  })

  it('enforces the password length', () => {
    expect(passwordSchema.safeParse('1234567').success).toBe(false)
    expect(passwordSchema.safeParse('12345678').success).toBe(true)
    expect(passwordSchema.safeParse('        ').success).toBe(false)
  })

  it('needs matching new passwords that differ from the old one', () => {
    const ok = {
      currentPassword: 'old-password',
      newPassword: 'new-password',
      confirmPassword: 'new-password',
    }
    expect(changePasswordSchema.safeParse(ok).success).toBe(true)
    expect(changePasswordSchema.safeParse({ ...ok, confirmPassword: 'other-pass' }).success).toBe(
      false,
    )
    expect(
      changePasswordSchema.safeParse({
        ...ok,
        newPassword: 'old-password',
        confirmPassword: 'old-password',
      }).success,
    ).toBe(false)
  })

  it('a new employee needs a login ID and a password', () => {
    const base = {
      name: 'Nina Hart',
      email: 'n@x.test',
      phone: '',
      position: 'Barista',
      role: 'employee',
      status: 'active',
      shiftId: null,
    }
    expect(newEmployeeSchema.safeParse(base).success).toBe(false)
    expect(
      newEmployeeSchema.safeParse({ ...base, loginId: 'nina', password: 'long-enough' }).success,
    ).toBe(true)
  })
})
