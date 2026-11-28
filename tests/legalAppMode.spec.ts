import { expect, test } from '@playwright/test'
import { readFileSync, writeFileSync } from 'node:fs'

// Kullanım koşulları and Gizlilik inside the phone app (`?app=ios` / `?app=android`) leave out the
// Shopier and code-sale paragraphs and tell that platform's own story instead. On the normal site the
// text must stay exactly as it was: it is compared, word for word, with the saved copy in
// tests/fixtures/legal-*.txt. After a deliberate change to the normal text, refresh the copies with
// `UPDATE_LEGAL_FIXTURES=1 npx playwright test tests/legalAppMode.spec.ts` and review the diff.

const PAGES = [
  { path: '/kullanim-kosullari', name: 'terms' },
  { path: '/gizlilik', name: 'privacy' },
] as const

const fixture = (name: string) => `tests/fixtures/legal-${name}.txt`

for (const { path, name } of PAGES) {
  test(`normal site: ${path} text is unchanged`, async ({ page }) => {
    await page.goto(path)
    const main = page.locator('main.legal')
    await expect(main.locator('h1')).toBeVisible()
    const text = await main.innerText()
    if (process.env.UPDATE_LEGAL_FIXTURES) writeFileSync(fixture(name), text)
    expect(text).toBe(readFileSync(fixture(name), 'utf8'))
    await expect(main).toContainText('Shopier')
  })
}

test('?app=ios: terms tell the App Store sale, no Shopier or code sale', async ({ page }) => {
  await page.goto('/kullanim-kosullari?app=ios')
  const main = page.locator('main.legal')
  await expect(main.locator('h1')).toBeVisible()
  await expect(main).not.toContainText('Shopier')
  await expect(main).not.toContainText('kodla satılır')
  await expect(main).not.toContainText('tek kullanımlıktır')
  await expect(main).not.toContainText('Henüz kullanılmamış bir kod')
  await expect(main).toContainText('iPhone uygulamasında Premium App Store üzerinden alınır.')
  await expect(main).toContainText('Sitede alınmış Premium da aynı hesapla uygulamada geçerlidir.')
  // Only information: no link to the site's sale.
  await expect(main.locator('a[href^="/fiyatlar"], a[href*="shopier"], a[href^="/kod"], a[href^="/premium"]')).toHaveCount(0)
})

test('?app=ios: privacy has App Store, not Shopier or codes', async ({ page }) => {
  await page.goto('/gizlilik?app=ios')
  const main = page.locator('main.legal')
  await expect(main.locator('h1')).toBeVisible()
  await expect(main).not.toContainText('Shopier')
  await expect(main).not.toContainText('Premium kodu')
  await expect(main).toContainText('Apple (App Store):')
  await expect(main.locator('a[href*="shopier"], a[href^="/fiyatlar"]')).toHaveCount(0)
})

test('?app=android: neutral text, no sale anywhere', async ({ page }) => {
  await page.goto('/kullanim-kosullari?app=android')
  const terms = page.locator('main.legal')
  await expect(terms.locator('h1')).toBeVisible()
  await expect(terms).not.toContainText('Shopier')
  await expect(terms).not.toContainText('kodla satılır')
  await expect(terms).not.toContainText('App Store')
  await expect(terms).toContainText('Bu uygulamada Premium satılmaz.')

  await page.goto('/gizlilik')
  const privacy = page.locator('main.legal')
  await expect(privacy.locator('h1')).toBeVisible()
  await expect(privacy).not.toContainText('Shopier')
  await expect(privacy).not.toContainText('Premium kodu')
  await expect(privacy).not.toContainText('App Store')
})
