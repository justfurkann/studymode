import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// The publishable key is meant to ship in the browser; Row Level Security protects the data.
// Never put a secret (sb_secret_…) or service_role key here.
const DEFAULT_URL = 'https://jpcatyopkpnudgdyncas.supabase.co'
const DEFAULT_KEY = 'sb_publishable_un15T1jZ2JXF4Cygq-JSUQ_stzVNyYz'

// VITE_SUPABASE_URL=off runs the app without accounts (local-only mode), e.g. for tests.
const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined) || DEFAULT_URL
const key = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) || DEFAULT_KEY

/** Null when the app runs without a Supabase project (local-only mode). */
export const supabase: SupabaseClient | null = url === 'off' ? null : createClient(url, key)
