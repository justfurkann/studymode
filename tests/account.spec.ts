import { expect, test, type Page } from '@playwright/test'

const SUPABASE = 'https://jpcatyopkpnudgdyncas.supabase.co'

async function signedIn(page: Page, user: Record<string, unknown>, premiumUntil: string | null = null) {
  await page.addInitScript((u) => {
    localStorage.setItem('sb-jpcatyopkpnudgdyncas-auth-token', JSON.stringify({ access_token: 'fake', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'r', user: u }))
  }, user)
  await page.route(`${SUPABASE}/auth/v1/**`, (route) => route.fulfill({ json: user }))
  await page.route(`${SUPABASE}/rest/v1/**`, (route) => {
    const req = route.request()
    if (req.url().includes('/rpc/ai_quota')) return route.fulfill({ json: { role: 'normal', used: 0, limit: 40, allowed: true, premium_until: premiumUntil } })
    return route.fulfill({ json: req.method() === 'GET' ? [] : null })
  })
}

test('Hesabı sil: strong confirmation, Premium warning, then the account is gone and the person is signed out', async ({ page }) => {
  const until = new Date(Date.now() + 20 * 86_400_000).toISOString()
  const user = { id: 'aaaaaaaa-0000-0000-0000-0000000000d1', aud: 'authenticated', role: 'authenticated', email: 'x1y2z3@privaterelay.appleid.com', user_metadata: {}, app_metadata: { provider: 'apple' }, created_at: '2026-10-01T00:00:00Z' }
  await signedIn(page, user, until)
  const requests: Array<{ auth: string | null; body: Record<string, unknown> }> = []
  await page.route('**/api/delete-account', async (route) => {
    requests.push({ auth: route.request().headers().authorization ?? null, body: route.request().postDataJSON() })
    await route.fulfill({ json: { ok: true, apple_revoked: false } })
  })

  await page.goto('/ayarlar')
  // Apple's hidden relay address is not shown as a random string.
  await expect(page.getByText('Apple (gizli e-posta)').first()).toBeVisible()
  await page.getByRole('button', { name: 'Hesabımı sil' }).click()
  const dialog = page.getByRole('dialog', { name: 'Hesabı sil' })
  await expect(dialog.getByText('Bu geri alınamaz.')).toBeVisible()
  const go = dialog.getByRole('button', { name: 'Hesabımı kalıcı olarak sil' })
  await expect(go).toBeDisabled()
  await dialog.getByLabel(/Onaylamak için/).fill('sil')
  // Premium time left: the person must tick that they understand.
  await expect(dialog.getByText(/Premium süren .* tarihine kadar devam ediyor/)).toBeVisible()
  await expect(go).toBeDisabled()
  await dialog.getByLabel('Kalan Premium süremin silineceğini anladım').check()
  await go.click()

  await expect.poll(() => requests.length).toBe(1)
  expect(requests[0].auth).toBe('Bearer fake')
  expect(requests[0].body).toEqual({ confirm: 'DELETE', premium_ok: true })
  await expect(page.getByText('Hesabın ve bütün verilerin silindi')).toBeVisible()
  await expect(page).toHaveURL(/127\.0\.0\.1:5173\/$/)
  expect(await page.evaluate(() => localStorage.getItem('sb-jpcatyopkpnudgdyncas-auth-token'))).toBeNull()
})

test('Hesabı sil: a server refusal is explained and nothing is signed out', async ({ page }) => {
  const user = { id: 'aaaaaaaa-0000-0000-0000-0000000000d2', aud: 'authenticated', role: 'authenticated', email: 'ali@example.com', user_metadata: { full_name: 'Ali Veli' }, app_metadata: {}, created_at: '2026-10-01T00:00:00Z' }
  await signedIn(page, user)
  await page.route('**/api/delete-account', (route) => route.fulfill({ status: 403, json: { error: 'admin_account' } }))
  await page.goto('/ayarlar')
  await page.getByRole('button', { name: 'Hesabımı sil' }).click()
  const dialog = page.getByRole('dialog', { name: 'Hesabı sil' })
  await expect(dialog.getByText(/tarihine kadar devam ediyor/)).toHaveCount(0)
  await dialog.getByLabel(/Onaylamak için/).fill('SİL')
  await dialog.getByRole('button', { name: 'Hesabımı kalıcı olarak sil' }).click()
  await expect(dialog.getByText('Yönetici hesabı buradan silinemez.')).toBeVisible()
  expect(await page.evaluate(() => localStorage.getItem('sb-jpcatyopkpnudgdyncas-auth-token'))).not.toBeNull()
})

test('a guest sees no "Hesabı sil"', async ({ page }) => {
  await page.goto('/ayarlar')
  await expect(page.getByRole('heading', { name: 'Ayarlar' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Hesabımı sil' })).toHaveCount(0)
})

test('"Apple ile devam et" signs in with Apple’s token and nonce, and saves the name Apple sends once', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('studymode.apple.force', '1'))
  await page.route(`${SUPABASE}/auth/v1/settings**`, (route) => route.fulfill({ json: { external: { email: true, google: false, apple: true } } }))
  // A stand-in for Apple's script: records init() and "signs in" with a name, as on a first sign-in.
  await page.route('https://appleid.cdn-apple.com/**', (route) =>
    route.fulfill({
      contentType: 'text/javascript',
      body: `window.AppleID = { auth: {
        init(o) { window.__apple = o },
        signIn() { return Promise.resolve({ authorization: { id_token: 'apple.header.sig', code: 'c' }, user: { name: { firstName: 'Elif', lastName: 'Su' } } }) } } }`,
    }),
  )
  const user = { id: 'aaaaaaaa-0000-0000-0000-0000000000a1', aud: 'authenticated', role: 'authenticated', email: 'abc@privaterelay.appleid.com', user_metadata: {}, app_metadata: { provider: 'apple' }, created_at: '2026-11-01T00:00:00Z' }
  let tokenBody: Record<string, string> | null = null
  let updated: Record<string, unknown> | null = null
  await page.route(`${SUPABASE}/auth/v1/token**`, async (route) => {
    tokenBody = route.request().postDataJSON()
    await route.fulfill({ json: { access_token: 'a', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'r', user } })
  })
  await page.route(`${SUPABASE}/auth/v1/user**`, async (route) => {
    if (route.request().method() === 'PUT') updated = route.request().postDataJSON()
    await route.fulfill({ json: updated ? { ...user, user_metadata: (updated as { data: object }).data } : user })
  })
  await page.route(`${SUPABASE}/rest/v1/**`, (route) => route.fulfill({ json: route.request().method() === 'GET' ? [] : null }))

  await page.goto('/giris')
  await expect(page.getByRole('button', { name: 'Google ile devam et' })).toHaveCount(0)
  await expect(page.getByText('ya da e-postayla')).toBeVisible()
  await page.getByRole('button', { name: 'Apple ile devam et' }).click()
  await expect.poll(() => tokenBody).not.toBeNull()
  expect(tokenBody!.provider).toBe('apple')
  expect(tokenBody!.id_token).toBe('apple.header.sig')
  const init = await page.evaluate(() => (window as unknown as { __apple: Record<string, unknown> }).__apple)
  expect(init.usePopup).toBe(true)
  expect(init.redirectURI).toBe('https://studymode.fun/giris')
  const hashed = await page.evaluate(async (n) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(n))), (b) => b.toString(16).padStart(2, '0')).join(''), tokenBody!.nonce)
  expect(init.nonce).toBe(hashed)
  await expect.poll(() => (updated as { data?: unknown } | null)?.data).toEqual({ first_name: 'Elif', last_name: 'Su', full_name: 'Elif Su' })
  await expect(page).toHaveURL(/127\.0\.0\.1:5173\/$/)
})

test('no Apple button while Apple is off in Supabase (or the site has no Services ID)', async ({ page }) => {
  await page.route(`${SUPABASE}/auth/v1/settings**`, (route) => route.fulfill({ json: { external: { email: true, google: true, apple: true } } }))
  await page.goto('/giris')
  await expect(page.getByRole('heading', { name: 'Giriş yap' })).toBeVisible()
  await expect(page.getByText('ya da e-postayla')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Apple ile devam et' })).toHaveCount(0)
})
