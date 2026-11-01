import { expect, test, type Page } from '@playwright/test'

function watchErrors(page: Page) {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  return errors
}

async function startDemo(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Örnek notla dene' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Öğrenme ve bellek' })).toBeVisible()
}

test('study receipt: a story-sized PNG of the day and the week', async ({ page }) => {
  const errors = watchErrors(page)
  await startDemo(page)
  await page.goto('/')
  await page.getByRole('button', { name: 'Çalışma fişi' }).click()
  const dialog = page.getByRole('dialog', { name: 'Çalışma fişi' })
  const image = dialog.getByRole('img', { name: /GÜNLÜK ÇALIŞMA FİŞİ/ })
  await expect(image).toBeVisible()
  expect(await image.evaluate((img: HTMLImageElement) => [img.naturalWidth, img.naturalHeight])).toEqual([1080, 1920])
  await dialog.getByRole('button', { name: 'Bu hafta' }).click()
  await expect(dialog.getByRole('img', { name: /HAFTALIK ÇALIŞMA FİŞİ/ })).toBeVisible()
  const download = page.waitForEvent('download')
  await dialog.getByRole('link', { name: 'PNG indir' }).click()
  expect((await download).suggestedFilename()).toBe('studymode-fis-haftalik.png')
  expect(errors).toEqual([])
})

test('night library: the player opens, plays and keeps the mix', async ({ page }) => {
  const errors = watchErrors(page)
  await startDemo(page)
  await page.getByRole('button', { name: /Ortam sesleri/ }).click()
  const player = page.getByRole('dialog', { name: 'Gece kütüphanesi' })
  await player.getByRole('button', { name: 'Çal', exact: true }).click()
  await expect(player.getByRole('button', { name: 'Durdur', exact: true })).toBeVisible()
  await player.getByLabel('Şömine sesi').fill('40')
  await page.keyboard.press('Escape')
  await expect(player).toBeHidden()
  // Still playing on another page.
  await page.getByRole('link', { name: 'Dersler' }).first().click()
  await expect(page.getByRole('button', { name: /Ortam sesi çalıyor/ })).toBeVisible()
  await page.reload()
  await page.getByRole('button', { name: /Ortam sesleri/ }).click()
  await expect(page.getByLabel('Şömine sesi')).toHaveValue('40')
  expect(errors).toEqual([])
})

test('night owl: after midnight a note (dismissable for the night) and shooting stars', async ({ page }) => {
  await page.clock.install({ time: new Date(2026, 10, 2, 2, 30) })
  await startDemo(page)
  await expect(page.getByRole('status').filter({ hasText: 'Gece kuşu modu' })).toContainText('Saat 02:30 ve hâlâ buradasın')
  await page.getByRole('button', { name: 'Gece kuşu notunu kapat' }).click()
  await expect(page.getByText('Gece kuşu modu')).toBeHidden()
  await page.reload()
  await expect(page.getByText('Örnek notla dene')).toBeHidden()
  await expect(page.getByText('Gece kuşu modu')).toBeHidden()
  await page.goto('/ayarlar')
  await expect(page.locator('.pixel-sky.is-night .sky-shooting').first()).toBeAttached()
})

test('stationery set: paper and highlighter colour apply and stay', async ({ page }) => {
  await startDemo(page)
  await page.goto('/ayarlar')
  await page.getByRole('button', { name: 'Sarı defter' }).click()
  await page.getByRole('button', { name: 'Nane' }).click()
  const root = page.locator('html')
  await expect(root).toHaveAttribute('data-paper', 'hukuk')
  await expect(root).toHaveAttribute('data-pen', 'nane')
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--hi').trim())).toBe('#7ff0b8')
  await page.reload()
  await expect(root).toHaveAttribute('data-pen', 'nane')
  await page.getByRole('button', { name: 'Kareli' }).click()
  await page.getByRole('button', { name: 'Sarı', exact: true }).click()
  await expect(root).not.toHaveAttribute('data-paper')
  await expect(root).not.toHaveAttribute('data-pen')
})

test('study pictures: tap to enlarge, full size, download; kept after a reload', async ({ page }) => {
  const errors = watchErrors(page)
  await startDemo(page)
  await page.goto(page.url().split('?')[0] + '?adim=gorsel')
  await page.getByRole('button', { name: 'Poster Oluştur' }).click()
  await page.getByRole('button', { name: /büyüt$/ }).first().click()
  const viewer = page.locator('.image-viewer')
  await expect(viewer).toBeVisible()
  await viewer.getByRole('button', { name: 'Tam boyut' }).click()
  await expect(viewer.getByRole('button', { name: 'Ekrana sığdır' })).toBeVisible()
  const download = page.waitForEvent('download')
  await viewer.getByRole('link', { name: 'İndir' }).click()
  expect((await download).suggestedFilename()).toMatch(/\.png$/)
  await page.keyboard.press('Escape')
  await expect(viewer).toBeHidden()
  await page.reload()
  await expect(page.getByRole('button', { name: /büyüt$/ })).toHaveCount(1)
  expect(errors).toEqual([])
})

test('concept map is drawn with real theme colours (lines and text visible in dark mode)', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' })
  await startDemo(page)
  await page.goto(page.url().split('?')[0] + '?adim=gorsel')
  const line = page.locator('.concept-map-svg line').first()
  const stroke = await line.evaluate((el) => getComputedStyle(el).stroke)
  expect(stroke).not.toBe('none')
  const fill = await page.locator('.concept-node-group text').first().evaluate((el) => getComputedStyle(el).fill)
  expect(fill).not.toBe('rgb(0, 0, 0)')
})

test('memory aid picture survives hiding and leaving the page', async ({ page }) => {
  await startDemo(page)
  const noteUrl = page.url().split('?')[0]
  await page.goto(noteUrl + '?adim=kodlama')
  await page.getByRole('button', { name: 'Görselleştir' }).first().click()
  await expect(page.getByRole('button', { name: /görsel şeması: büyüt/ }).first()).toBeVisible()
  await page.getByRole('button', { name: 'Görseli gizle' }).first().click()
  await expect(page.getByRole('button', { name: /görsel şeması: büyüt/ })).toHaveCount(0)
  await page.getByRole('button', { name: 'Görseli göster' }).first().click()
  await expect(page.getByRole('button', { name: /görsel şeması: büyüt/ }).first()).toBeVisible()
  await page.goto('/')
  await page.goto(noteUrl + '?adim=kodlama')
  await expect(page.getByRole('button', { name: /görsel şeması: büyüt/ }).first()).toBeVisible()
})

test('sign in: the password can be shown', async ({ page }) => {
  await page.goto('/giris')
  const password = page.getByLabel('Şifre', { exact: true })
  await password.fill('gizli-sifre')
  await expect(password).toHaveAttribute('type', 'password')
  await page.getByLabel('Şifreyi göster').check()
  await expect(password).toHaveAttribute('type', 'text')
})
