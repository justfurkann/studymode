import type { User } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'
import { authErrorMessage, displayName, firstName, nameMetadata, passwordProblem } from './auth'

const user = (meta: Record<string, unknown>) => ({ email: 'ali@example.com', user_metadata: meta }) as unknown as User

describe('displayName', () => {
  it('prefers the full name, then first and last name, then email', () => {
    expect(displayName(user({ full_name: 'Ali Veli' }))).toBe('Ali Veli')
    expect(displayName(user({ first_name: 'Ali', last_name: '' }))).toBe('Ali')
    expect(displayName(user({}))).toBe('ali@example.com')
    expect(displayName(null)).toBe('')
  })

  it('builds metadata from trimmed names', () => {
    expect(nameMetadata(' Ayşe ', ' Yılmaz ')).toEqual({ first_name: 'Ayşe', last_name: 'Yılmaz', full_name: 'Ayşe Yılmaz' })
  })
})

describe('passwordProblem', () => {
  it('checks length and that both entries match', () => {
    expect(passwordProblem('kısa', 'kısa')).toMatch(/en az 8/)
    expect(passwordProblem('uzunsifre1', 'uzunsifre2')).toBe('Şifreler aynı değil.')
    expect(passwordProblem('uzunsifre1', 'uzunsifre1')).toBe('')
  })
})

describe('authErrorMessage', () => {
  it('translates common Supabase errors', () => {
    expect(authErrorMessage(new Error('Invalid login credentials'))).toBe('E-posta veya şifre hatalı.')
    expect(authErrorMessage(new Error('User already registered'))).toMatch(/zaten bir hesap/)
    expect(authErrorMessage(new Error('email rate limit exceeded'))).toMatch(/Çok fazla deneme/)
    expect(authErrorMessage(new Error('New password should be different from the old password.'))).toMatch(/eskisiyle aynı/)
    expect(authErrorMessage('otp_expired')).toMatch(/süresi dolmuş/)
  })
})

describe('names from Google sign-in', () => {
  const user = (meta: Record<string, string>) => ({ id: 'u', email: 'a@b.com', user_metadata: meta, app_metadata: {}, aud: 'authenticated', created_at: '' }) as never
  it('uses the given name and the full name Google sends', () => {
    expect(firstName(user({ full_name: 'Mehmet Furkan Öztürk', name: 'Mehmet Furkan Öztürk' }))).toBe('Mehmet')
    expect(firstName(user({ given_name: 'Furkan', full_name: 'Furkan Öztürk' }))).toBe('Furkan')
    expect(firstName(user({ first_name: 'Ayşe' }))).toBe('Ayşe')
    expect(displayName(user({ name: 'Ayşe Yılmaz' }))).toBe('Ayşe Yılmaz')
  })
})
