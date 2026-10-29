// Shared by the browser app and the /api functions, so keep this free of imports.

// The publishable key is meant to ship in the browser; Row Level Security protects the data.
// Never put a secret (sb_secret_…) or service_role key here.
export const SUPABASE_URL = 'https://jpcatyopkpnudgdyncas.supabase.co'
export const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_un15T1jZ2JXF4Cygq-JSUQ_stzVNyYz'

/** Model behind the shared free AI. The server can override it with GEMINI_MODEL. */
export const DEFAULT_GEMINI_MODEL = 'gemini-3.5-flash-lite'

/**
 * Tried in order when the main model is overloaded, out of free quota, slow or unknown.
 * Free-tier quotas are per model, so falling back also helps when one model's quota is used up.
 * The server can override the list with GEMINI_FALLBACK_MODELS (comma separated).
 */
export const DEFAULT_GEMINI_FALLBACKS = ['gemini-flash-lite-latest', 'gemini-3.1-flash-lite']
