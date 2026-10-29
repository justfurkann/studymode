import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from './config'

// VITE_SUPABASE_URL=off runs the app without accounts (local-only mode), e.g. for tests.
const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined) || SUPABASE_URL
const key = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) || SUPABASE_PUBLISHABLE_KEY

// Links in auth emails carry their type (or an error) in the URL. Read them before the client
// starts, because it removes the token from the URL.
const linkParams = new URLSearchParams(
  typeof window === 'undefined' ? '' : `${window.location.search.slice(1)}&${window.location.hash.replace(/^#/, '')}`,
)

/** True when the page was opened from the sign-up confirmation email. */
export const openedFromConfirmationEmail = linkParams.get('type') === 'signup'

/** True when the page was opened from a password reset email. */
export const openedFromRecoveryEmail = linkParams.get('type') === 'recovery'

/** Set when an email link was expired or already used. */
export const authLinkError = linkParams.get('error_code') ?? linkParams.get('error') ?? null

/** Null when the app runs without a Supabase project (local-only mode). */
export const supabase: SupabaseClient | null = url === 'off' ? null : createClient(url, key)
