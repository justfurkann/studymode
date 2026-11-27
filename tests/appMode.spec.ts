import { expect, test, type Page } from '@playwright/test'

// `?app=ios` / `?app=android`: the phone app opens site pages in a browser view; no way to an outside
// payment there (store rules). The normal site must look exactly as before.

function watchErrors(page: Page) {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  return errors
}

const premiumNav = (page: Page) => page.locator('aside.sidebar').getByRole('link', { name: 'Premium' })

test('normal site: the Premium link and the price page are there', async ({ page }) => {
  const errors = watchErrors(page)
  await page.goto('/rehber')
  await expect(premiumNav(page)).toBeVisible()
  await expect(page.getByRole('link', { name: 'Premium’a git' })).toBeVisible()

  await page.goto('/kullanim-kosullari')
  await expect(page.locator('a[href="/fiyatlar"]').first()).toBeVisible()
  await expect(page.getByText('iPhone uygulamasında Premium App Store üzerinden alınır.')).toBeVisible()

  await page.goto('/fiyatlar')
  await expect(page.getByRole('heading', { name: 'Paketler ve fiyatlar' })).toBeVisible()
  await expect(page.getByTestId('app-premium-note')).toHaveCount(0)
  expect(errors).toEqual([])
})

test('?app=ios: no Premium link, and it stays hidden on the next pages', async ({ page }) => {
  const errors = watchErrors(page)
  await page.goto('/rehber?app=ios')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await expect(premiumNav(page)).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Premium’a git' })).toHaveCount(0)

  // The site's own links drop the parameter; the mode is kept for the tab.
  await page.goto('/kullanim-kosullari')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Kullanım')
  await expect(page.locator('a[href^="/fiyatlar"]')).toHaveCount(0)
  await expect(page.getByText('iPhone uygulamasında Premium App Store üzerinden alınır.')).toBeVisible()

  await page.goto('/gizlilik')
  await expect(page.locator('a[href^="/fiyatlar"]')).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'hesap silme sayfası' })).toHaveAttribute('href', '/hesap-sil')

  await page.goto('/fiyatlar')
  await expect(page.getByTestId('app-premium-note')).toHaveText('Premium’u uygulamadan alabilirsin.')
  await expect(page.locator('a[href*="shopier"]')).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Paketler ve fiyatlar' })).toHaveCount(0)

  await page.goto('/premium')
  await expect(page.getByTestId('app-premium-note')).toBeVisible()
  await expect(page.locator('a[href*="shopier"]')).toHaveCount(0)
  await expect(page.locator('a[href^="/fiyatlar"]')).toHaveCount(0)
  await expect(page.getByRole('link', { name: /Hemen al/ })).toHaveCount(0)
  expect(errors).toEqual([])
})

test('?app=android works the same; a new tab without it is the normal site', async ({ browser }) => {
  const context = await browser.newContext()
  const page = await context.newPage()
  await page.goto('/rehber?app=android')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await expect(premiumNav(page)).toHaveCount(0)
  const other = await context.newPage()
  await other.goto('/rehber')
  await expect(premiumNav(other)).toBeVisible()
  await context.close()
})

test('/hesap-sil opens without signing in and explains the deletion', async ({ page }) => {
  const errors = watchErrors(page)
  await page.goto('/hesap-sil')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Hesabını sil')
  await expect(page.getByRole('heading', { name: 'Telefon uygulamasından' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Neler kalır?' })).toBeVisible()
  await expect(page.getByText('Kullanılmış Premium kodlarının kaydı')).toBeVisible()
  await expect(page.locator('a[href^="mailto:"]')).toHaveCount(1)
  expect(errors).toEqual([])
})
