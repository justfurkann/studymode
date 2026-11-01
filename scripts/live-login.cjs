// Signs a Playwright page in as the test account on the live site, through the test door
// (api/test-session.ts), because the sign-in form's bot check stops automated browsers.
// Needs STUDYMODE_TEST_SESSION_SECRET in the environment (never print it).
//
//   const { liveLogin } = require('./scripts/live-login.cjs')
//   await liveLogin(page)            // then page.goto('https://studymode.fun/...')
const BASE = process.env.STUDYMODE_URL || 'https://studymode.fun'
const STORAGE_KEY = 'sb-jpcatyopkpnudgdyncas-auth-token'

async function liveSession() {
  const secret = process.env.STUDYMODE_TEST_SESSION_SECRET
  if (!secret) throw new Error('STUDYMODE_TEST_SESSION_SECRET is not set in this environment')
  const res = await fetch(`${BASE}/api/test-session`, { method: 'POST', headers: { 'x-test-secret': secret } })
  if (!res.ok) throw new Error(`test door answered ${res.status}`)
  const s = await res.json()
  return { ...s, expires_at: s.expires_at ?? Math.floor(Date.now() / 1000) + (s.expires_in ?? 3600) }
}

async function liveLogin(page) {
  const session = await liveSession()
  await page.addInitScript(([key, value]) => localStorage.setItem(key, value), [STORAGE_KEY, JSON.stringify(session)])
  return session.user
}

module.exports = { liveLogin, liveSession }
