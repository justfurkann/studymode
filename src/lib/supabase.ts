import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from './config'

// VITE_SUPABASE_URL=off runs the app without accounts (local-only mode), e.g. for tests.
const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined) || SUPABASE_URL
const key = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) || SUPABASE_PUBLISHABLE_KEY

/**
 * True when the page was opened from the sign-up confirmation email.
 * Read before the client starts, because it removes the token from the URL.
 */
export const openedFromConfirmationEmail = typeof window !== 'undefined' && /(^|[#&])type=signup(&|$)/.test(window.location.hash)

/** Null when the app runs without a Supabase project (local-only mode). */
export const supabase: SupabaseClient | null = url === 'off' ? null : createClient(url, key)
