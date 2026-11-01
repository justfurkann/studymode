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

test('Tam özet: easy to find at the top of Özet; the example note shows a detailed write-up', async ({ page }) => {
  const errors = watchErrors(page)
  await startDemo(page)
  await page.getByRole('button', { name: /^Tam özet Konunun ayrıntılı anlatımı/ }).click()
  await expect(page).toHaveURL(/adim=tam/)
  await expect(page.getByRole('heading', { level: 2, name: 'Öğrenme ve bellek' })).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'İçindekiler' })).toBeVisible()
  await expect(page.getByRole('heading', { name: /Bellek sistemleri/ })).toBeVisible()
  await expect(page.getByText('Örnek:').first()).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Sınavda dikkat' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Ana noktalar' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Kavramlar' })).toBeVisible()
  // Not signed in: no AI button, and the old bottom link leads here too.
  await expect(page.getByRole('button', { name: /yeniden yaz/ })).toHaveCount(0)
  await page.getByRole('button', { name: 'Adım adım çalışmaya dön' }).click()
  await expect(page).not.toHaveURL(/adim=tam/)
  await page.getByRole('button', { name: 'Tam özeti tek sayfada gör' }).click()
  await expect(page).toHaveURL(/adim=tam/)
  await page.getByRole('button', { name: 'Okudum, teste geç' }).click()
  await expect(page).toHaveURL(/sekme=test/)
  expect(errors).toEqual([])
})

test('Tam özet: a signed-in student has the AI write the detailed summary, part by part for a long note, and it is saved', async ({ page }) => {
  const SUPABASE = 'https://jpcatyopkpnudgdyncas.supabase.co'
  const user = { id: 'aaaaaaaa-0000-0000-0000-000000000009', aud: 'authenticated', role: 'authenticated', email: 'ali@example.com', user_metadata: { first_name: 'Ali' }, app_metadata: {}, created_at: '2026-10-01T00:00:00Z' }
  await page.addInitScript((u) => {
    localStorage.setItem('sb-jpcatyopkpnudgdyncas-auth-token', JSON.stringify({ access_token: 'fake', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'r', user: u }))
  }, user)
  const T = '2026-10-01T00:00:00Z'
  const course = { id: 'cccccccc-0000-0000-0000-000000000009', user_id: user.id, name: 'Fizyoloji', color: '#e5484d', exam_date: null, created_at: T, updated_at: T }
  // Long enough to be written in two parts.
  const content = Array.from({ length: 40 }, (_, i) => `Bölüm ${i + 1}: ${'Kalp kası kasılır ve kanı pompalar. '.repeat(10)}`).join('\n\n')
  const note = { id: 'dddddddd-0000-0000-0000-000000000009', user_id: user.id, course_id: course.id, title: 'Dolaşım', content, summary: { overview: 'Kısa özet', points: ['Kalp kanı pompalar.'], keyTerms: [{ term: 'Kalp', definition: 'Kanı pompalayan organ.' }] }, questions: [], practice: [], generator: 'ai', created_at: T, updated_at: T }
  const saved: unknown[] = []
  await page.route(`${SUPABASE}/auth/v1/**`, (route) => route.fulfill({ json: user }))
  await page.route(`${SUPABASE}/rest/v1/**`, async (route) => {
    const req = route.request()
    const table = new URL(req.url()).pathname.split('/').pop()
    if (req.method() === 'GET') return route.fulfill({ json: table === 'courses' ? [course] : table === 'notes' ? [note] : [] })
    if (table === 'notes') saved.push(req.postDataJSON())
    return route.fulfill({ status: 201, json: [] })
  })
  const parts: string[] = []
  await page.route('**/api/generate', async (route) => {
    const body = route.request().postDataJSON()
    expect(body.task).toBe('detail')
    parts.push(body.input.part)
    const n = parts.length
    await route.fulfill({
      json: {
        result: {
          intro: n === 1 ? 'Dolaşım sistemi kalbin kanı vücuda pompalamasını anlatır.' : 'Devamı.',
          sections: [{ heading: `Kalp ${n}`, paragraphs: [`Kalp kası bölüm ${n} açıklaması.`], bullets: ['Kalp kanı pompalar.'], example: n === 1 ? 'Koşarken nabız artar.' : '' }],
          takeaways: ['Atardamar ile toplardamarı karıştırma.'],
        },
      },
    })
  })
  await page.goto(`/not/${note.id}?adim=tam`)
  await page.getByRole('button', { name: 'Ayrıntılı özet hazırla' }).click()
  await expect(page.getByRole('heading', { name: /Kalp 1/ })).toBeVisible()
  await expect(page.getByRole('heading', { name: /Kalp 2/ })).toBeVisible()
  expect(parts).toEqual(['Bölüm 1/2', 'Bölüm 2/2'])
  await expect(page.getByText('Dolaşım sistemi kalbin kanı vücuda pompalamasını anlatır.')).toBeVisible()
  await expect(page.getByText('Koşarken nabız artar.')).toBeVisible()
  // Same takeaway from both parts appears once.
  await expect(page.getByText('Atardamar ile toplardamarı karıştırma.')).toHaveCount(1)
  await expect.poll(() => JSON.stringify(saved)).toContain('"detailed"')
  await expect(page.getByRole('button', { name: 'Ayrıntılı özeti yeniden yaz' })).toBeVisible()
})

test('Hangi öğrenci tipisin: no account, level and school, 10 questions, a shareable result and story image', async ({ page }) => {
  const errors = watchErrors(page)
  await page.goto('/ogrenci-tipi')
  await page.getByRole('button', { name: /Teste başla/ }).click()
  await page.getByRole('button', { name: /^Üniversite/ }).click()
  await page.getByLabel('Üniversite ara').fill('odtu')
  await page.getByRole('listitem').filter({ hasText: 'Orta Doğu Teknik Üniversitesi' }).first().click()
  await expect(page.getByRole('heading', { name: 'Vizeye bir hafta var. İlk hamlen?' })).toBeVisible()
  // Back on the first question goes to the school step; forward again.
  await page.getByRole('button', { name: 'Geri' }).click()
  await expect(page.getByRole('heading', { name: 'Hangi üniversitedesin?' })).toBeVisible()
  await page.getByRole('button', { name: /Atla/ }).click()
  // A night owl who studies alone to understand.
  const picks = [3, 3, 0, 1, 3, 1, 1, 0, 1, 3]
  for (let i = 0; i < picks.length; i++) {
    await expect(page.getByText(`${i + 1} / 10`)).toBeVisible()
    await page.locator('.quiz-option').nth(picks[i]).click()
  }
  await expect(page.getByRole('heading', { level: 1, name: 'Gece Kuşu Düşünür' })).toBeVisible()
  await expect(page.getByText('Sana özel taktik:')).toBeVisible()
  await expect(page.getByLabel('Çalışma profilin')).toContainText('Gece kuşu')
  const story = page.getByRole('img', { name: /Hikâye görseli/ })
  await expect(story).toBeVisible()
  expect(await story.evaluate((img: HTMLImageElement) => [img.naturalWidth, img.naturalHeight])).toEqual([1080, 1920])
  const download = page.waitForEvent('download')
  await page.getByRole('link', { name: 'Görseli indir' }).click()
  expect((await download).suggestedFilename()).toBe('ogrenci-tipim-gecekusu.png')
  await expect(page).toHaveURL(/tip=gecekusu/)

  // A friend opens the link: same card, invited to take the quiz.
  const friend = await page.context().newPage()
  await friend.goto(page.url())
  await expect(friend.getByText('Arkadaşın bu testi çözdü')).toBeVisible()
  await expect(friend.getByRole('heading', { level: 1, name: 'Gece Kuşu Düşünür' })).toBeVisible()
  await friend.getByRole('button', { name: /Sen de çöz/ }).click()
  await expect(friend.getByRole('heading', { name: /nerede okuyorsun/ })).toBeVisible()
  await friend.getByRole('button', { name: /^Lise/ }).click()
  await expect(friend.getByRole('heading', { name: 'Yazılıya bir hafta var. İlk hamlen?' })).toBeVisible()
  expect(errors).toEqual([])
})

test('Hangi öğrenci tipisin: reachable from the landing page and from Mola', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('link', { name: /Hangi öğrenci tipisin/ }).click()
  await expect(page).toHaveURL(/\/ogrenci-tipi$/)
  await page.goto('/')
  await page.getByRole('button', { name: 'Örnek notla dene' }).click()
  await page.goto('/tekrar?bolum=mola')
  await page.getByRole('button', { name: 'Hangi öğrenci tipisin?' }).click()
  await expect(page.getByRole('heading', { level: 1, name: /öğrenci\s*tipisin/ })).toBeVisible()
})

test('Başarımlar: hidden discoveries across the site, a toast, and the collection', async ({ page }) => {
  const errors = watchErrors(page)
  // Mid-afternoon, so no clock achievement gets in the way.
  await page.clock.install({ time: new Date(2026, 10, 2, 14, 0) })
  await startDemo(page)
  await page.goto('/basarimlar')
  await expect(page.getByRole('heading', { level: 1, name: 'Başarımlar' })).toBeVisible()
  await page.getByRole('button', { name: 'Gizliler' }).click()
  await expect(page.getByText('Kimsenin sonuna kadar okumadığı o sayfa.')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Dedektif' })).toHaveCount(0)

  // Dedektif: the last full stop of the privacy policy.
  await page.goto('/gizlilik')
  await page.getByRole('button', { name: 'Nokta' }).click()
  const toast = page.locator('.ach-toast')
  await expect(toast).toContainText('Dedektif')
  await expect(toast).toContainText('Destansı')
  await toast.getByRole('button', { name: /Dedektif/ }).click()
  await expect(page).toHaveURL(/\/basarimlar#dedektif$/)
  await expect(page.locator('#basarim-dedektif')).toContainText('Gizlilik politikasının sonundaki')

  // Glitch Hunter: seven quick taps on the logo; the page glitches.
  await page.locator('.sidebar .brand-link').click({ clickCount: 1 })
  for (let i = 0; i < 6; i++) await page.locator('.sidebar .brand-link').click()
  await expect(page.locator('html')).toHaveClass(/is-glitching/)
  await expect(page.locator('.ach-toast')).toContainText('Glitch Hunter')

  // Kayıp Sayfa: an address that does not exist still shows today's page.
  await page.goto('/burasi-yok')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await page.goto('/basarimlar')
  for (const name of ['Dedektif', 'Glitch Hunter', 'Kayıp Sayfa']) await expect(page.getByRole('heading', { name })).toBeVisible()
  await expect(page.getByRole('link', { name: /Başarımlar/ }).first()).toContainText(/[3-9]\/20/)
  expect(errors).toEqual([])
})

test('Başarımlar: the keyboard code and the quiz count too; the sidebar shows the quiz card', async ({ page }) => {
  await page.clock.install({ time: new Date(2026, 10, 2, 14, 0) })
  await startDemo(page)
  for (const key of ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a']) await page.keyboard.press(key)
  await expect(page.locator('.ach-toast')).toContainText('Glitch Hunter')
  await page.getByRole('link', { name: /Hangi öğrenci tipisin\? 1 dakikada öğren/ }).first().click()
  await expect(page).toHaveURL(/\/ogrenci-tipi$/)
  await page.getByRole('button', { name: /Teste başla/ }).click()
  await page.getByRole('button', { name: /^Lise/ }).click()
  for (let i = 0; i < 10; i++) {
    await expect(page.getByText(`${i + 1} / 10`)).toBeVisible()
    await page.locator('.quiz-option').first().click()
  }
  await expect(page.locator('.quiz-result-card h1')).toBeVisible()
  await page.goto('/basarimlar')
  await expect(page.getByRole('heading', { name: 'Kendini Tanı' })).toBeVisible()
  await expect(page.locator('#basarim-kendini-tani')).toHaveClass(/is-open/)
})
