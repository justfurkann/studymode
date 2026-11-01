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

test('study receipt: a story-sized PNG of the day and the week with personalization', async ({ page }) => {
  const errors = watchErrors(page)
  await startDemo(page)
  await page.goto('/')
  await page.getByRole('button', { name: 'Çalışma fişi' }).click()
  const dialog = page.getByRole('dialog', { name: 'Çalışma fişi' })
  const image = dialog.getByRole('img', { name: /GÜNLÜK ÇALIŞMA FİŞİ/ })
  await expect(image).toBeVisible()
  expect(await image.evaluate((img: HTMLImageElement) => [img.naturalWidth, img.naturalHeight])).toEqual([1080, 1920])
  await dialog.getByLabel('Fişteki İsim / Lâkap').fill('Zeynep Kaya')
  await expect(dialog.getByRole('img', { name: /ZEYNEP KAYA/ })).toBeVisible()
  await dialog.getByRole('button', { name: 'Gece Vardiyası' }).click()
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
  expect((await download).suggestedFilename()).toMatch(/\.svg$/)
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

test('Hangi öğrenci tipisin: no account, level (no school step), 10 questions, a shareable result and story image', async ({ page, browser }) => {
  const errors = watchErrors(page)
  await page.goto('/ogrenci-tipi')
  await page.getByRole('button', { name: /Teste başla/ }).click()
  await page.getByRole('button', { name: /^Üniversite/ }).click()
  // The school is no longer asked here (it comes from the profile).
  await expect(page.getByRole('heading', { name: 'Arkadaşlarla buluşacaksınız. Grupta senin mesajın hangisi?' })).toBeVisible()
  // Back on the first question goes to the level step; forward again.
  await page.getByRole('button', { name: 'Geri', exact: true }).click()
  await expect(page.getByRole('heading', { name: /hangi aşamadasın/ })).toBeVisible()
  await page.getByRole('button', { name: /^Üniversite/ }).click()
  // A night owl who studies alone to understand.
  const picks = [3, 3, 0, 1, 3, 1, 1, 0, 1, 3]
  for (let i = 0; i < picks.length; i++) {
    await expect(page.getByText(`${i + 1} / 10`)).toBeVisible()
    await page.locator('.quiz-option').nth(picks[i]).click()
  }
  await expect(page.getByRole('heading', { level: 1, name: 'Gececi' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Bunlar tanıdık geliyor mu?' })).toBeVisible()
  await expect(page.getByText('Gündüz uykun varken gece birden yapacak şey buluyorsun.')).toBeVisible()
  await expect(page.getByText('Ufak bir not:')).toBeVisible()
  await expect(page.getByLabel('Çalışma profilin')).toContainText('Gece kuşu')
  const story = page.getByRole('img', { name: /Hikâye görseli/ })
  await expect(story).toBeVisible()
  expect(await story.evaluate((img: HTMLImageElement) => [img.naturalWidth, img.naturalHeight])).toEqual([1080, 1920])
  const download = page.waitForEvent('download')
  await page.getByRole('link', { name: 'Görseli indir' }).click()
  expect((await download).suggestedFilename()).toBe('ogrenci-tipim-gecekusu.png')
  await expect(page).toHaveURL(/tip=gecekusu/)

  // Own card from this browser is "Sen bir", not a friend's.
  await page.reload()
  await expect(page.getByText('Arkadaşın bu testi çözdü')).toHaveCount(0)
  // A friend opens the link on their own phone: same card, invited to take the quiz.
  const friend = await (await browser.newContext()).newPage()
  await friend.goto(page.url())
  await expect(friend.getByText('Arkadaşın bu testi çözdü')).toBeVisible()
  await expect(friend.getByRole('heading', { level: 1, name: 'Gececi' })).toBeVisible()
  await friend.getByRole('button', { name: /Sen de çöz/ }).click()
  await expect(friend.getByRole('heading', { name: /hangi aşamadasın/ })).toBeVisible()
  await friend.getByRole('button', { name: /^Lise/ }).click()
  await expect(friend.getByRole('heading', { name: 'Arkadaşlarla buluşacaksınız. Grupta senin mesajın hangisi?' })).toBeVisible()
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
  // The quiz lives under "Daha fazla" in the sidebar.
  await page.locator('.sidebar').getByRole('button', { name: 'Daha fazla' }).click()
  await page.locator('.sidebar .side-quiz').click()
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

test('Öğrenci tipi profilde kalır: misafirde bu tarayıcıda, Ayarlar ve yan menüde görünür', async ({ page }) => {
  await page.clock.install({ time: new Date(2026, 10, 2, 14, 0) })
  await startDemo(page)
  await page.goto('/ogrenci-tipi')
  await page.getByRole('button', { name: /Teste başla/ }).click()
  await page.getByRole('button', { name: /^Lise/ }).click()
  const picks = [3, 3, 0, 1, 3, 1, 1, 0, 1, 3]
  for (let i = 0; i < 10; i++) {
    await expect(page.getByText(`${i + 1} / 10`)).toBeVisible()
    await page.locator('.quiz-option').nth(picks[i]).click()
  }
  await expect(page.getByRole('heading', { level: 1, name: 'Gececi' })).toBeVisible()
  // Leave and come back: still there.
  await page.goto('/ayarlar')
  await page.reload()
  await expect(page.locator('.student-type-panel')).toContainText('Gececi')
  await page.locator('.sidebar').getByRole('button', { name: 'Daha fazla' }).click()
  await expect(page.locator('.sidebar .side-quiz')).toContainText('Gececi')
  await page.goto('/ogrenci-tipi')
  await expect(page.getByRole('link', { name: /Son sonucun/ })).toContainText('Gececi')
  await page.getByRole('link', { name: /Son sonucun/ }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Gececi' })).toBeVisible()
})

test('Öğrenci tipi ve başarımlar hesaba yazılır; başka cihazdaki sonuç ve başarımlar gelir', async ({ page }) => {
  const SUPABASE = 'https://jpcatyopkpnudgdyncas.supabase.co'
  await page.clock.install({ time: new Date(2026, 10, 2, 14, 0) })
  // This account took the quiz and found Dedektif on another device.
  const user = {
    id: 'aaaaaaaa-0000-0000-0000-000000000077', aud: 'authenticated', role: 'authenticated', email: 'zeynep@example.com', app_metadata: {}, created_at: '2026-10-01T00:00:00Z',
    user_metadata: {
      first_name: 'Zeynep',
      student_type: { type: 'kasif', percent: 91, axes: [-40, 90, -10, 20], level: 'universite', school: 'Ege', runnerUp: 'gecekusu', at: '2026-10-30T10:00:00.000Z' },
      achievements: { dedektif: '2026-10-30T10:00:00.000Z' },
    },
  }
  await page.addInitScript((u) => {
    localStorage.setItem('sb-jpcatyopkpnudgdyncas-auth-token', JSON.stringify({ access_token: 'fake', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'r', user: u }))
  }, user)
  const updates: Array<Record<string, unknown>> = []
  await page.route(`${SUPABASE}/auth/v1/**`, (route) => {
    if (route.request().method() === 'PUT') {
      const body = route.request().postDataJSON() as { data?: Record<string, unknown> }
      updates.push(body.data ?? {})
      user.user_metadata = { ...user.user_metadata, ...(body.data as object) } as typeof user.user_metadata
    }
    return route.fulfill({ json: user })
  })
  await page.route(`${SUPABASE}/rest/v1/**`, (route) => route.fulfill({ json: route.request().method() === 'GET' ? [] : [] }))

  await page.goto('/ayarlar')
  await expect(page.locator('.student-type-panel')).toContainText('Bir Sekme Daha')
  await expect(page.locator('.student-type-panel')).toContainText('Ege')
  await page.goto('/basarimlar')
  await expect(page.locator('#basarim-dedektif')).toHaveClass(/is-open/)
  // Found here: goes up to the account.
  await page.goto('/burasi-yok')
  await expect.poll(() => JSON.stringify(updates)).toContain('kayip-sayfa')

  // Taking the quiz again on this device updates the account.
  await page.goto('/ogrenci-tipi')
  await page.getByRole('button', { name: /Teste başla/ }).click()
  await page.getByRole('button', { name: /^Lise/ }).click()
  for (let i = 0; i < 10; i++) {
    await expect(page.getByText(`${i + 1} / 10`)).toBeVisible()
    await page.locator('.quiz-option').nth([3, 3, 0, 1, 3, 1, 1, 0, 1, 3][i]).click()
  }
  await expect(page.getByRole('heading', { level: 1, name: 'Gececi' })).toBeVisible()
  await expect.poll(() => JSON.stringify(updates)).toContain('"type":"gecekusu"')
})

/** Signed in as `role`, with the account's metadata kept by the fake server (PUT /user merges into it). */
async function signedInAs(
  page: Page,
  role: 'admin' | 'normal' | 'vip',
  metadata: Record<string, unknown> = {},
  tables: Record<string, unknown[]> = {},
  /** Database functions this test answers itself: name → (body) → JSON, or an Error for a failure. */
  rpc: Record<string, (body: Record<string, unknown>) => unknown> = {},
) {
  const SUPABASE = 'https://jpcatyopkpnudgdyncas.supabase.co'
  const user = { id: `aaaaaaaa-0000-0000-0000-0000000000${role === 'admin' ? '10' : '11'}`, aud: 'authenticated', role: 'authenticated', email: `${role}@example.com`, app_metadata: {}, created_at: '2026-10-01T00:00:00Z', user_metadata: { first_name: 'Furkan', ...metadata } as Record<string, unknown> }
  await page.addInitScript((u) => {
    localStorage.setItem('sb-jpcatyopkpnudgdyncas-auth-token', JSON.stringify({ access_token: 'fake', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'r', user: u }))
    localStorage.setItem('studymode.vipWelcomed.' + u.id, '1')
  }, user)
  const updates: Array<Record<string, unknown>> = []
  await page.route(`${SUPABASE}/auth/v1/**`, (route) => {
    if (route.request().method() === 'PUT') {
      const data = (route.request().postDataJSON() as { data?: Record<string, unknown> }).data ?? {}
      updates.push(data)
      user.user_metadata = { ...user.user_metadata, ...data }
    }
    return route.fulfill({ json: user })
  })
  await page.route(`${SUPABASE}/rest/v1/**`, (route) => {
    const path = new URL(route.request().url()).pathname
    const fn = path.includes('/rpc/') ? path.split('/').pop()! : ''
    if (fn && rpc[fn]) {
      const out = rpc[fn]((route.request().postDataJSON() as Record<string, unknown>) ?? {})
      return out instanceof Error ? route.fulfill({ status: 400, json: { message: out.message } }) : route.fulfill({ json: out ?? null })
    }
    if (path.endsWith('/rpc/ai_quota')) return route.fulfill({ json: { role, used: 0, limit: role === 'admin' ? null : 40, allowed: true } })
    if (path.endsWith('/rpc/plus_quota')) return route.fulfill({ json: { role, eligible: role !== 'normal', used: 2, limit: 30, allowed: true } })
    if (path.includes('/rpc/')) return route.fulfill({ status: 404, json: { code: 'PGRST202' } })
    const table = path.split('/').pop()!
    if (route.request().method() === 'GET') return route.fulfill({ json: tables[table] ?? [] })
    return route.fulfill({ status: 201, json: [] })
  })
  return { user, updates }
}

test('Yönetici: başarımı kendi hesabında verir ve geri alır; yenileyince durum korunur', async ({ page }) => {
  await page.clock.install({ time: new Date(2026, 10, 2, 14, 0) })
  const { user, updates } = await signedInAs(page, 'admin')
  await page.goto('/basarimlar')
  await page.getByLabel(/Yönetici modu/).check()
  const card = page.locator('#basarim-dedektif')
  // Admin mode shows the real name of a hidden one.
  await expect(card.getByRole('heading', { name: 'Dedektif' })).toBeVisible()
  await card.getByRole('button', { name: 'Dedektif: ver' }).click()
  await expect(card).toHaveClass(/is-open/)
  await expect.poll(() => JSON.stringify(user.user_metadata.achievements ?? {})).toContain('dedektif')

  await page.reload()
  await expect(page.locator('#basarim-dedektif')).toHaveClass(/is-open/)

  await page.getByLabel(/Yönetici modu/).check()
  await page.locator('#basarim-dedektif').getByRole('button', { name: 'Dedektif: geri al' }).click()
  await expect(page.locator('#basarim-dedektif')).toHaveClass(/is-locked/)
  // The account's list is overwritten, not merged: it no longer lists it, and remembers it was taken back.
  await expect.poll(() => JSON.stringify(user.user_metadata.achievements ?? {})).not.toContain('dedektif')
  expect(JSON.stringify(user.user_metadata.achievements_held)).toContain('dedektif')
  expect(user.user_metadata.first_name).toBe('Furkan')

  // A fresh device (empty browser storage) signs in: still taken back.
  await page.evaluate(() => {
    localStorage.removeItem('studymode.achievements.v1')
    localStorage.removeItem('studymode.achievementData.v1')
  })
  await page.reload()
  await expect(page.locator('#basarim-dedektif')).toHaveClass(/is-locked/)
  expect(updates.length).toBeGreaterThan(1)
})

test('Yönetici: normal kullanıcı yönetici modunu görmez', async ({ page }) => {
  await page.clock.install({ time: new Date(2026, 10, 2, 14, 0) })
  await signedInAs(page, 'normal')
  await page.goto('/basarimlar')
  await expect(page.getByRole('heading', { level: 1, name: 'Başarımlar' })).toBeVisible()
  await expect(page.getByLabel(/Yönetici modu/)).toHaveCount(0)
  await expect(page.getByRole('button', { name: /: ver$/ })).toHaveCount(0)
})

test('Yapay zekâ görseline studymode.fun filigranı basılır; poster de etiketli ve doğru uzantıyla iner', async ({ page }) => {
  await page.clock.install({ time: new Date(2026, 10, 2, 14, 0) })
  const T = '2026-10-01T00:00:00Z'
  await signedInAs(page, 'admin', {}, {
    courses: [{ id: 'c1', name: 'Biyoloji', color: '#4f46e5', exam_date: null, created_at: T, updated_at: T }],
    notes: [{ id: 'n1', course_id: 'c1', title: 'Hücre', content: 'Mitokondri hücrenin enerji santralidir. Ribozom protein üretir.', summary: { overview: 'Hücre', points: ['Mitokondri enerji üretir.'], keyTerms: [{ term: 'Mitokondri', definition: 'Enerji üreten organel.' }] }, questions: [], practice: [], generator: 'ai', created_at: T, updated_at: T }],
  })
  // A plain light-blue 800×450 picture stands in for the model's answer.
  const png = await page.evaluate(() => {
    const c = document.createElement('canvas')
    c.width = 800
    c.height = 450
    const g = c.getContext('2d')!
    g.fillStyle = '#cfe8ff'
    g.fillRect(0, 0, 800, 450)
    return c.toDataURL('image/png').split(',')[1]
  })
  await page.route('**/api/generate', (route) => {
    const body = route.request().postDataJSON() as { task: string }
    if (body.task === 'image') return route.fulfill({ json: { result: { imageBase64: png, mimeType: 'image/png', caption: 'Mitokondri şeması' }, engine: 'plus' } })
    return route.fulfill({ status: 404, json: { error: 'x' } })
  })
  await page.goto('/premium?arac=gorsel')
  await page.getByRole('button', { name: /AI Görsel Üret/ }).click()
  const img = page.locator('.visual-card-preview img').first()
  await expect(img).toBeVisible()
  const info = await img.evaluate(async (el: HTMLImageElement) => {
    await el.decode()
    const c = document.createElement('canvas')
    c.width = el.naturalWidth
    c.height = el.naturalHeight
    const g = c.getContext('2d')!
    g.drawImage(el, 0, 0)
    // The label's area in the bottom-right corner: mostly dark, with the yellow "S" in it.
    const W = el.naturalWidth
    const H = el.naturalHeight
    const area = g.getImageData(W - 138, H - 34, 126, 20).data
    let dark = 0
    let yellow = 0
    for (let i = 0; i < area.length; i += 4) {
      const [r, gg, b] = [area[i], area[i + 1], area[i + 2]]
      if (Math.max(r, gg, b) < 140) dark++
      if (r > 200 && gg > 170 && b < 130) yellow++
    }
    const middle = g.getImageData(400, 200, 1, 1).data
    return { src: el.src.slice(0, 23), dark: dark / (area.length / 4), yellow, middle: [...middle].slice(0, 3) }
  })
  expect(info.src).toBe('data:image/jpeg;base64,')
  // The corner sits on the dark label with the brand "S"; the middle is still the picture.
  expect(info.dark).toBeGreaterThan(0.3)
  expect(info.yellow).toBeGreaterThan(8)
  expect(Math.min(...info.middle)).toBeGreaterThan(180)

  // The poster carries the label inside the SVG and downloads as .svg.
  await page.getByRole('button', { name: /Poster Oluştur/ }).click()
  const poster = page.locator('.visual-card-preview img').first()
  expect(decodeURIComponent((await poster.getAttribute('src')) ?? '')).toContain('studymode.fun')
})

test('Tanıtım turu: ilk girişte bir kez, atlanabilir, Ayarlar’dan yeniden; açıkken başarım bildirimi bekler', async ({ page }) => {
  await page.clock.install({ time: new Date(2026, 10, 2, 14, 0) })
  await page.addInitScript(() => localStorage.setItem('studymode.tour.force', '1'))
  await startDemo(page)
  const bubble = page.getByRole('dialog', { name: /Tanıtım/ })
  await expect(bubble).toContainText('Not ekle')
  await expect(bubble).toContainText('1/5')
  // An achievement found during the tour waits.
  for (const key of ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown']) await page.keyboard.press(key)
  await page.getByRole('button', { name: /İleri/ }).click()
  await expect(bubble).toContainText('Bugün')
  await page.getByRole('button', { name: 'Önceki' }).click()
  await expect(bubble).toContainText('Not ekle')
  for (let i = 0; i < 4; i++) await page.getByRole('button', { name: /İleri/ }).click()
  await expect(bubble).toContainText('Daha fazla')
  await page.getByRole('button', { name: 'Başla' }).click()
  await expect(bubble).toHaveCount(0)

  // Seen: not again on reload.
  await page.reload()
  await page.waitForTimeout(2000)
  await expect(page.getByRole('dialog', { name: /Tanıtım/ })).toHaveCount(0)

  // Restart from Settings; Esc skips.
  await page.goto('/ayarlar')
  await page.getByRole('button', { name: 'Turu tekrar başlat' }).click()
  await expect(page.getByRole('dialog', { name: /Tanıtım/ })).toContainText('1/5')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: /Tanıtım/ })).toHaveCount(0)
})

test('Tanıtım turu: bildirim tur bitene kadar bekler', async ({ page }) => {
  await page.clock.install({ time: new Date(2026, 10, 2, 14, 0) })
  await startDemo(page)
  await page.goto('/ayarlar')
  await page.getByRole('button', { name: 'Turu tekrar başlat' }).click()
  await expect(page.getByRole('dialog', { name: /Tanıtım/ })).toBeVisible()
  await page.locator('.sidebar .brand-link').evaluate((el: HTMLElement) => {
    for (let i = 0; i < 7; i++) el.click()
  })
  await page.waitForTimeout(400)
  await expect(page.locator('.ach-toast')).toHaveCount(0)
  await page.getByRole('button', { name: 'Atla' }).click()
  await expect(page.locator('.ach-toast')).toContainText('Glitch Hunter')
})

test('Rehber: Daha fazla menüsünden ve Ayarlar’dan açılır; Premium bölümü ve Premium sayfasından bağlantı', async ({ page }) => {
  await page.clock.install({ time: new Date(2026, 10, 2, 14, 0) })
  await startDemo(page)
  await page.getByRole('button', { name: 'Daha fazla' }).click()
  await page.getByRole('link', { name: 'Rehber' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Rehber' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Nasıl ilerlemeli?' })).toBeVisible()
  // Every step shows the real screen (in the current theme) and links there.
  const shots = page.locator('.guide-flow .guide-shot img')
  await expect(shots).toHaveCount(5)
  await shots.first().scrollIntoViewIfNeeded()
  await expect.poll(() => shots.first().evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth)).toBe(520)
  expect(await shots.first().getAttribute('src')).toMatch(/^\/rehber\/adim-1-(light|dark)\.webp$/)
  await expect(page.locator('.guide-flow').getByRole('link', { name: 'Sınavlara git' })).toHaveAttribute('href', '/sinav')
  await expect(page.getByRole('heading', { name: 'Kartlar ve aralıklı tekrar' })).toBeVisible()
  await expect(page.getByRole('heading', { name: /Premium’u en iyi nasıl kullanırsın/ })).toBeVisible()
  await expect(page.locator('#premium')).toContainText('Akıllı arama hakkından düşmez')
  await page.goto('/premium')
  await page.getByRole('link', { name: /Premium’u en iyi nasıl kullanırsın/ }).click()
  await expect(page).toHaveURL(/\/rehber#premium$/)
  await page.goto('/ayarlar')
  await page.locator('main').getByRole('link', { name: 'Rehber' }).click()
  await expect(page).toHaveURL(/\/rehber$/)
})

test('Masaüstü: Ayarlar menünün en altında, hesap bilgisinin üstünde', async ({ page }) => {
  await page.clock.install({ time: new Date(2026, 10, 2, 14, 0) })
  await startDemo(page)
  const order = await page.locator('.sidebar').evaluate((side) =>
    [...side.querySelectorAll('a.nav-link, button.nav-link, .sidebar-footer')].map((el) => (el.classList.contains('sidebar-footer') ? 'FOOTER' : el.textContent!.trim())),
  )
  const settings = order.findIndex((t) => t.startsWith('Ayarlar'))
  expect(settings).toBeGreaterThan(order.findIndex((t) => t.startsWith('Daha fazla')))
  expect(settings).toBeGreaterThan(order.findIndex((t) => t.startsWith('Premium')))
  expect(order[settings + 1]).toBe('FOOTER')
})

test('Telefon: avatarda dişli rozeti, "Ayarlar ve hesap"; 360 px’te üst bar taşmaz', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 760 })
  await page.clock.install({ time: new Date(2026, 10, 2, 14, 0) })
  const T = '2026-10-01T00:00:00Z'
  await signedInAs(page, 'vip', {}, { courses: [{ id: 'c1', name: 'Biyoloji', color: '#4f46e5', exam_date: null, created_at: T, updated_at: T }] })
  await page.goto('/')
  const avatar = page.getByRole('link', { name: 'Ayarlar ve hesap' })
  await expect(avatar).toBeVisible()
  await expect(avatar.locator('.mobile-avatar-gear svg')).toBeVisible()
  // Nothing in the top bar sticks out of the screen.
  const overflow = await page.evaluate(() => {
    const bar = document.querySelector('.mobile-top')!
    const out = [...bar.querySelectorAll('*')].filter((el) => {
      const r = el.getBoundingClientRect()
      return r.width > 0 && (r.right > window.innerWidth + 0.5 || r.left < -0.5)
    })
    return { page: document.documentElement.scrollWidth - window.innerWidth, items: out.length }
  })
  expect(overflow).toEqual({ page: 0, items: 0 })
  await avatar.click()
  await expect(page).toHaveURL(/\/ayarlar$/)
  // The gear is enough; no extra Ayarlar link at the end of Bugün.
  await page.goto('/')
  await expect(page.locator('main').getByRole('link', { name: 'Ayarlar', exact: true })).toHaveCount(0)
})

test('Birden fazla dosya: tek not olarak birleştir; her dosya kendi başlığıyla', async ({ page }) => {
  const errors = watchErrors(page)
  await page.clock.install({ time: new Date(2026, 10, 2, 14, 0) })
  await startDemo(page)
  await page.goto('/not-ekle')
  const text = (topic: string) => Buffer.from(`${topic}\n\n${'Mitokondri hücrenin enerji santralidir. Ribozom protein üretir. Hücre zarı seçici geçirgendir. '.repeat(4)}`)
  await page.getByLabel('Not dosyası').setInputFiles([
    { name: 'hafta_1.txt', mimeType: 'text/plain', buffer: text('Hücre') },
    { name: 'hafta_2.txt', mimeType: 'text/plain', buffer: text('Organeller') },
    { name: 'hafta_3.txt', mimeType: 'text/plain', buffer: text('Zar') },
  ])
  await expect(page.getByText('3 dosya')).toBeVisible()
  // Default: separate notes, as before.
  await expect(page.getByRole('button', { name: 'Ayrı notlar (her dosya bir not)' })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('button', { name: '3 notu kaydet ve hazırla' })).toBeVisible()
  await page.getByRole('button', { name: 'Tek not olarak birleştir' }).click()
  const title = page.getByLabel('Birleşik notun başlığı')
  await expect(title).toHaveValue('hafta 1 + 2 not daha')
  await title.fill('Hücre: 1-3. haftalar')
  await expect(page.getByText(/Toplam [\d.]+ karakter/)).toBeVisible()
  await page.getByRole('button', { name: '3 dosyayı tek notta birleştir ve hazırla' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Hücre: 1-3. haftalar' })).toBeVisible()
  const id = page.url().match(/\/not\/([^/?]+)/)![1]
  const content = await page.evaluate((noteId) => JSON.parse(localStorage.getItem('studymode.data.v2')!).notes.find((n: { id: string }) => n.id === noteId).content, id)
  expect(content).toMatch(/^# hafta 1\n\nHücre/)
  expect(content.indexOf('# hafta 2')).toBeGreaterThan(0)
  expect(content.indexOf('# hafta 3')).toBeGreaterThan(content.indexOf('# hafta 2'))
  expect(errors).toEqual([])
})

test('Ders sayfası: notları seçip birleştir; eskiler kalır', async ({ page }) => {
  await page.clock.install({ time: new Date(2026, 10, 2, 14, 0) })
  await startDemo(page)
  // A second note in the example course.
  await page.goto('/not-ekle')
  await page.getByLabel('Not başlığı').fill('Bellek türleri')
  await page.getByRole('tab', { name: 'Metin yapıştır' }).click()
  await page.getByLabel('Ders notun').fill('Duyusal bellek çok kısa sürer. Kısa süreli bellek sınırlıdır. Uzun süreli bellek kalıcıdır ve anlamlı bağlarla güçlenir. '.repeat(3))
  await page.getByRole('button', { name: /Kaydet ve hazırla/ }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Bellek türleri' })).toBeVisible()
  await page.getByRole('link', { name: /Psikolojiye Giriş/ }).first().click()
  await page.getByRole('button', { name: 'Birleştir' }).click()
  await expect(page.getByRole('button', { name: 'En az 2 not seç' })).toBeDisabled()
  await page.locator('.merge-pick').filter({ hasText: 'Öğrenme ve bellek' }).click()
  await page.locator('.merge-pick').filter({ hasText: 'Bellek türleri' }).click()
  await page.getByLabel('Yeni notun başlığı').fill('Bellek: hepsi bir arada')
  await page.getByRole('button', { name: '2 notu birleştir' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Bellek: hepsi bir arada' })).toBeVisible()
  await expect(page.getByText('Bu not için çalışma seti hazırlanmadı')).toBeVisible()
  const notes = await page.evaluate(() => JSON.parse(localStorage.getItem('studymode.data.v2')!).notes.map((n: { title: string; content: string }) => ({ t: n.title, c: n.content })))
  expect(notes.map((n: { t: string }) => n.t).sort()).toEqual(['Bellek türleri', 'Bellek: hepsi bir arada', 'Öğrenme ve bellek'])
  const merged = notes.find((n: { t: string }) => n.t === 'Bellek: hepsi bir arada')!
  // Oldest first: the example note, then the new one.
  expect(merged.c.indexOf('# Öğrenme ve bellek')).toBe(0)
  expect(merged.c.indexOf('# Bellek türleri')).toBeGreaterThan(0)
})

/** A playable silent WAV of `seconds`. */
function wav(seconds: number) {
  const rate = 8000
  const n = Math.round(rate * seconds)
  const b = Buffer.alloc(44 + n * 2)
  b.write('RIFF', 0)
  b.writeUInt32LE(36 + n * 2, 4)
  b.write('WAVEfmt ', 8)
  b.writeUInt32LE(16, 16)
  b.writeUInt16LE(1, 20)
  b.writeUInt16LE(1, 22)
  b.writeUInt32LE(rate, 24)
  b.writeUInt32LE(rate * 2, 28)
  b.writeUInt16LE(2, 32)
  b.writeUInt16LE(16, 34)
  b.write('data', 36)
  b.writeUInt32LE(n * 2, 40)
  return b.toString('base64')
}

test('Stüdyo sesi: ilk parça gelince çalmaya başlar, kalanlar sıraya girer, en sonda indirilebilir', async ({ page }) => {
  await page.clock.install({ time: new Date(2026, 10, 2, 14, 0) })
  const T = '2026-10-01T00:00:00Z'
  await signedInAs(page, 'vip', {}, {
    courses: [{ id: 'c1', name: 'Biyoloji', color: '#4f46e5', exam_date: null, created_at: T, updated_at: T }],
    notes: [{ id: 'n1', course_id: 'c1', title: 'Hücre', content: 'Mitokondri enerji üretir.', summary: { overview: 'x', points: ['a'], keyTerms: [{ term: 'Mitokondri', definition: 'Enerji' }] }, questions: [], practice: [], generator: 'ai', created_at: T, updated_at: T }],
  })
  const long = 'Mitokondri hücrenin enerji santralidir ve ATP üretir; Krebs döngüsü matrikste döner, elektron taşıma zinciri iç zardadır. '
  const lines = Array.from({ length: 12 }, (_, i) => ({ speaker: i % 2 ? 'Mert' : 'Deniz', role: i % 2 ? 'student' : 'host', text: long.repeat(2), highlight: '' }))
  let ttsCalls = 0
  let ttsDone = 0
  await page.route('**/api/generate', async (route) => {
    const body = route.request().postDataJSON() as { task: string }
    if (body.task === 'podcast') return route.fulfill({ json: { result: { title: 'Hücre · Sesli not', summary: '', lines }, engine: 'plus' } })
    if (body.task === 'tts') {
      ttsCalls += 1
      // Later parts take a while, like the real voices do.
      if (ttsCalls > 1) await new Promise((r) => setTimeout(r, 2500))
      ttsDone += 1
      return route.fulfill({ json: { result: { audioBase64: wav(0.4), mimeType: 'audio/wav' }, engine: 'plus' } })
    }
    return route.fulfill({ status: 500, json: { error: 'x' } })
  })
  await page.goto('/not/n1?adim=podcast')
  await page.getByRole('button', { name: /Stüdyo sesiyle dinle/ }).click()
  const live = page.locator('.podcast-live')
  await expect(live).toBeVisible()
  // Playing (or ready for a tap) while the other parts are still being recorded.
  await expect(live).toContainText(/Çalıyor · bölüm 1\/\d|Başlatmak için dokun|kaydediliyor, hemen devam/)
  expect(ttsDone).toBeLessThan(3)
  await expect(page.getByRole('link', { name: /WAV İndir/ })).toBeVisible({ timeout: 15_000 })
  expect(ttsCalls).toBeGreaterThanOrEqual(3)
})

test('Kullanım koşulları: kendi sayfası; giriş ekranından, gizlilikten ve telefonda alt bilgiden ulaşılır', async ({ page }) => {
  await page.goto('/giris')
  await page.locator('.legal-note').getByRole('link', { name: 'kullanım koşullarını' }).click()
  await expect(page).toHaveURL(/\/kullanim-kosullari$/)
  await expect(page.getByRole('heading', { level: 1, name: /Kullanım\s*koşulları/ })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Kabul edilebilir kullanım' })).toBeVisible()
  await expect(page.getByText(/sınav başarısını garanti etmez/)).toBeVisible()
  await page.goto('/gizlilik')
  await expect(page.getByRole('contentinfo').getByRole('link', { name: 'Kullanım koşulları' })).toHaveAttribute('href', '/kullanim-kosullari')
  await page.setViewportSize({ width: 360, height: 760 })
  await page.goto('/dersler')
  await expect(page.locator('.mobile-foot').getByRole('link', { name: 'Koşullar' })).toHaveAttribute('href', '/kullanim-kosullari')
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360)
})

test('Bot doğrulaması: kutu işaretlenmeden giriş olmaz; jeton Supabase’e gider, her denemeden sonra kutu yenilenir', async ({ page }) => {
  const SUPABASE = 'https://jpcatyopkpnudgdyncas.supabase.co'
  // A stand-in for Cloudflare's script: a checkbox that hands out a new token each time it is ticked.
  await page.route('https://challenges.cloudflare.com/**', (route) =>
    route.fulfill({
      contentType: 'text/javascript',
      body: `window.__n = 0; window.turnstile = {
        render(el, o) { el.innerHTML = '<label><input type="checkbox" id="fake-ts"> Ben robot değilim</label>'; el.querySelector('input').onchange = (e) => e.target.checked && o.callback('tok-' + (++window.__n)); return 'w1' },
        reset() { const c = document.getElementById('fake-ts'); if (c) c.checked = false },
        remove() {},
      }`,
    }),
  )
  await page.addInitScript(() => localStorage.setItem('studymode.captcha.force', 'test-site-key'))
  const sent: Array<{ path: string; token: unknown }> = []
  await page.route(`${SUPABASE}/auth/v1/**`, async (route) => {
    const req = route.request()
    const url = new URL(req.url())
    if (req.method() === 'POST') {
      const body = req.postDataJSON() ?? {}
      sent.push({ path: url.pathname + url.search, token: body.gotrue_meta_security?.captcha_token })
      return route.fulfill({ status: 400, json: { code: 'invalid_credentials', message: 'Invalid login credentials' } })
    }
    return route.fulfill({ json: {} })
  })
  await page.goto('/giris')
  await page.getByLabel('E-posta').fill('ali@example.com')
  await page.getByLabel('Şifre', { exact: true }).fill('yanlis-sifre')
  await page.locator('form').getByRole('button', { name: 'Giriş yap' }).click()
  await expect(page.getByText(/Bot doğrulamasının bitmesini bekle/)).toBeVisible()
  expect(sent).toHaveLength(0)

  await page.locator('#fake-ts').check()
  await page.locator('form').getByRole('button', { name: 'Giriş yap' }).click()
  await expect(page.getByText('E-posta veya şifre hatalı.')).toBeVisible()
  expect(sent).toEqual([{ path: '/auth/v1/token?grant_type=password', token: 'tok-1' }])
  // A token works once: the box is cleared and must be ticked again.
  await expect(page.locator('#fake-ts')).not.toBeChecked()

  // Password reset sends a fresh token too.
  await page.getByRole('button', { name: 'Şifremi unuttum' }).click()
  await page.locator('#fake-ts').check()
  await page.getByRole('button', { name: 'Yenileme bağlantısı gönder' }).click()
  await expect.poll(() => sent.length).toBe(2)
  expect(sent[1].path).toMatch(/^\/auth\/v1\/recover/)
  expect(sent[1].token).toBe('tok-2')
})

test('Bot doğrulaması localhost’ta kapalı: giriş ekranı eskisi gibi, Cloudflare yüklenmez', async ({ page }) => {
  let loaded = false
  await page.route('https://challenges.cloudflare.com/**', (route) => ((loaded = true), route.abort()))
  await page.goto('/giris')
  await expect(page.getByRole('heading', { level: 1, name: 'Giriş yap' })).toBeVisible()
  await expect(page.locator('.captcha')).toHaveCount(0)
  expect(loaded).toBe(false)
})

test('Okul bilgisi: üye olunca bir kez sorulur, profile yazılır, Ayarlar’da görünür; test okul sormaz', async ({ page }) => {
  await page.clock.install({ time: new Date(2026, 10, 2, 14, 0) })
  await page.addInitScript(() => localStorage.setItem('studymode.education.force', '1'))
  const { user, updates } = await signedInAs(page, 'normal')
  await page.goto('/')
  const dialog = page.getByRole('dialog', { name: 'Seni biraz tanıyalım' })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: /^Üniversite/ }).click()
  await dialog.getByLabel('Üniversite ara').fill('odtu')
  await dialog.getByRole('listitem').filter({ hasText: 'Orta Doğu Teknik Üniversitesi' }).first().click()
  // Department and year are required for university students.
  await expect(dialog.getByRole('button', { name: /Devam/ })).toBeDisabled()
  await dialog.getByLabel('Bölüm').fill('Bilgisayar Mühendisliği')
  await dialog.getByRole('group', { name: 'Sınıf' }).getByRole('button', { name: '2. sınıf' }).click()
  await dialog.getByRole('button', { name: /Devam/ }).click()
  // The rest is optional.
  await dialog.getByLabel('Doğum yılın').selectOption('2005')
  await dialog.getByRole('group', { name: 'Cinsiyet' }).getByRole('button', { name: 'Kadın' }).click()
  await dialog.getByRole('group', { name: 'Nereden duydun?' }).getByRole('button', { name: 'Instagram' }).click()
  await dialog.getByRole('button', { name: 'Kaydet' }).click()
  await expect(dialog).toHaveCount(0)
  expect(updates.at(-1)?.education).toMatchObject({ level: 'universite', school: 'ODTÜ', department: 'Bilgisayar Mühendisliği', classYear: '2. sınıf', birthYear: 2005, gender: 'kadin', heardFrom: 'Instagram', v: 2 })
  // Other profile fields stay.
  expect(user.user_metadata.first_name).toBe('Furkan')

  // Not asked again; shown and changeable in Settings. (Moves inside the app: this fake session is
  // re-seeded on every full page load, while the real one keeps what was saved.)
  await page.waitForTimeout(2500)
  await expect(page.getByRole('dialog', { name: 'Seni biraz tanıyalım' })).toHaveCount(0)
  await page.locator('.sidebar').getByRole('link', { name: 'Ayarlar' }).click()
  await expect(page.locator('.edu-current')).toContainText('ODTÜ · Bilgisayar Mühendisliği · 2. sınıf')
  await page.locator('.edu-current').getByRole('button', { name: 'Değiştir' }).click()
  await page.getByRole('button', { name: /^Lise/ }).click()
  // Earlier optional answers are kept; just save.
  await expect(page.getByLabel('Doğum yılın')).toHaveValue('2005')
  await page.locator('.edu-form').getByRole('button', { name: 'Kaydet' }).click()
  await expect(page.locator('.edu-current')).toContainText('Lise')
  expect(updates.at(-1)?.education).toMatchObject({ level: 'lise', school: '', department: '', birthYear: 2005 })

  // The quiz takes level and school from the profile: straight to the first question.
  await page.locator('.sidebar').getByRole('button', { name: 'Daha fazla' }).click()
  await page.locator('.sidebar .side-quiz').click()
  await page.getByRole('button', { name: /Teste başla/ }).click()
  await expect(page.getByRole('heading', { name: 'Arkadaşlarla buluşacaksınız. Grupta senin mesajın hangisi?' })).toBeVisible()
})

test('Okul bilgisi: "Şimdi değil" denince bu cihazda birkaç gün sorulmaz', async ({ page }) => {
  await page.clock.install({ time: new Date(2026, 10, 2, 14, 0) })
  await page.addInitScript(() => localStorage.setItem('studymode.education.force', '1'))
  const { updates } = await signedInAs(page, 'normal')
  await page.goto('/')
  const dialog = page.getByRole('dialog', { name: 'Seni biraz tanıyalım' })
  await dialog.getByRole('button', { name: 'Şimdi değil' }).click()
  await expect(dialog).toHaveCount(0)
  await page.reload()
  await page.waitForTimeout(2500)
  await expect(page.getByRole('dialog', { name: 'Seni biraz tanıyalım' })).toHaveCount(0)
  expect(updates.filter((u) => 'education' in u)).toHaveLength(0)
})

test('Yönetim: kullanıcıların okulu ve okullar özeti görünür; veritabanı fonksiyonu yoksa liste yine açılır', async ({ page }) => {
  await page.clock.install({ time: new Date(2026, 10, 2, 14, 0) })
  await signedInAs(page, 'admin')
  const SUPABASE = 'https://jpcatyopkpnudgdyncas.supabase.co'
  const T = '2026-10-01T00:00:00Z'
  const users = [
    { id: 'u1', email: 'ayse@example.com', name: 'Ayşe', created_at: T, last_sign_in_at: T, role: 'normal', ai_today: 0, notes: 3, last_study: null },
    { id: 'u2', email: 'can@example.com', name: 'Can', created_at: T, last_sign_in_at: T, role: 'normal', ai_today: 1, notes: 0, last_study: null },
    { id: 'u3', email: 'ece@example.com', name: 'Ece', created_at: T, last_sign_in_at: T, role: 'vip', ai_today: 0, notes: 1, last_study: null },
  ]
  let schoolsReady = true
  await page.route(`${SUPABASE}/rest/v1/rpc/admin_*`, (route) => {
    const name = new URL(route.request().url()).pathname.split('/').pop()
    if (name === 'admin_users') return route.fulfill({ json: users })
    if (name === 'admin_schools')
      return schoolsReady
        ? route.fulfill({
            json: [
              { id: 'u1', level: 'universite', school: 'ODTÜ', department: 'Fizik', class_year: '2. sınıf', birth_year: 2005, gender: 'kadin', heard_from: 'Instagram' },
              { id: 'u3', level: 'universite', school: 'ODTÜ', department: 'Fizik', class_year: '3. sınıf', birth_year: 2003, gender: 'erkek', heard_from: 'Instagram' },
              { id: 'u2', level: 'lise', school: '', department: '', class_year: '', birth_year: null, gender: null, heard_from: 'TikTok' },
            ],
          })
        : route.fulfill({ status: 404, json: { code: 'PGRST202' } })
    return route.fulfill({ json: [] })
  })
  await page.goto('/yonetim')
  await expect(page.getByRole('region', { name: 'Okullar' })).toContainText('ODTÜ · 2')
  await expect(page.getByRole('region', { name: 'Okullar' })).toContainText('Lise · 1')
  await expect(page.locator('.admin-user').filter({ hasText: 'Ayşe' })).toContainText('ODTÜ · Fizik · 2. sınıf')
  const region = page.getByRole('region', { name: 'Okullar' })
  await expect(region).toContainText('Fizik · 2')
  await expect(region).toContainText('Instagram · 2')
  await expect(region).toContainText('TikTok · 1')
  await expect(region).toContainText('Kadın · 1')
  await expect(region).toContainText('19-22 · 1')
  await expect(region).toContainText('23-26 · 1')
  // Age and gender are never shown next to a person.
  await expect(page.locator('.admin-user').filter({ hasText: 'Ayşe' })).not.toContainText('Kadın')
  schoolsReady = false
  await page.reload()
  await expect(page.locator('.admin-user').filter({ hasText: 'Ayşe' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Okullar' })).toHaveCount(0)
})

test('Tanıtım turu kayıt ekranının önüne geçmez: tanıtımdan kayda giden yeni ziyaretçi formu doldurabilir', async ({ page }) => {
  await page.clock.install({ time: new Date(2026, 10, 2, 14, 0) })
  await page.addInitScript(() => localStorage.setItem('studymode.tour.force', '1'))
  await page.goto('/')
  await page.locator('a[href="/giris?mod=kayit"]').first().click()
  await expect(page.getByRole('heading', { level: 1, name: 'Hesap oluştur' })).toBeVisible()
  await page.waitForTimeout(3000)
  await expect(page.getByRole('dialog', { name: /Tanıtım/ })).toHaveCount(0)
  await page.getByLabel('Ad', { exact: true }).fill('Ali')
  await expect(page.getByLabel('Ad', { exact: true })).toHaveValue('Ali')

  // A tour already open closes when the sign-in page opens, and is not counted as seen.
  await page.goto('/')
  await page.getByRole('button', { name: 'Örnek notla dene' }).click()
  await expect(page.getByRole('dialog', { name: /Tanıtım/ })).toBeVisible()
  await page.goto('/giris')
  await page.waitForTimeout(2500)
  await expect(page.getByRole('dialog', { name: /Tanıtım/ })).toHaveCount(0)
  expect(await page.evaluate(() => localStorage.getItem('studymode.tour.v1'))).toBeNull()
})

test('Bugün: bir not yalnızca bir kez görünür; boş kalan listeler gizlenir', async ({ page }) => {
  await page.clock.install({ time: new Date(2026, 10, 2, 14, 0) })
  await startDemo(page)
  await page.goto('/')
  await expect(page.getByText('Şimdi bununla başla')).toBeVisible()
  const main = page.locator('main')
  // The example note appears once (in the focus card), not in four lists.
  await expect(main.getByText('Öğrenme ve bellek', { exact: false })).toHaveCount(1)
  await expect(main.getByRole('heading', { name: 'Adım adım öğrenmeye devam et' })).toHaveCount(0)
  await expect(main.getByRole('heading', { name: 'Son notlar' })).toHaveCount(0)
  await expect(main.getByRole('heading', { name: /bugün şu konuyu çalış/ })).toHaveCount(0)
  // The focus card names the exam: no separate list with the same exam.
  await expect(main.getByRole('heading', { name: 'Yaklaşan sınavlar' })).toHaveCount(0)
})

test('Podcast: sohbet gibi (Deniz solda, Mert sağda); düğmeler dokununca; ilerleme "Replik x / y"', async ({ page }) => {
  await page.clock.install({ time: new Date(2026, 10, 2, 14, 0) })
  await startDemo(page)
  await page.goto(page.url().split('?')[0] + '?adim=podcast')
  const turns = page.locator('.podcast-turn')
  await expect(turns.first()).toHaveClass(/is-host/)
  await expect(turns.nth(1)).toHaveClass(/is-student/)
  const left = await turns.first().boundingBox()
  const right = await turns.nth(1).boundingBox()
  expect(right!.x + right!.width).toBeGreaterThan(left!.x + left!.width)
  // Actions are tucked away until the bubble is touched.
  const listen = turns.nth(2).locator('.podcast-turn-actions')
  expect(await listen.evaluate((el) => getComputedStyle(el).opacity)).toBe('0')
  await turns.nth(2).locator('.podcast-turn-text').click()
  await expect(turns.nth(2)).toHaveClass(/is-open/)
  await expect.poll(() => listen.evaluate((el) => getComputedStyle(el).opacity)).toBe('1')
  // Device voice on line 3: the line is marked and the progress says so (speech is faked here).
  await page.evaluate(() => {
    const synth = window.speechSynthesis
    synth.speak = () => undefined
    synth.cancel = () => undefined
  })
  await turns.nth(2).getByRole('button', { name: '3. repliği seslendir' }).click()
  await expect(turns.nth(2)).toHaveClass(/is-playing/)
  await expect(page.locator('.podcast-progress')).toContainText(/Replik 3 \/ \d+/)
})

test('Seviye ve XP: Bugün’de rozet, Başarımlar’da kart ve döküm; seviye atlayınca kutlama', async ({ page }) => {
  await page.clock.install({ time: new Date(2026, 10, 2, 14, 0) })
  await startDemo(page)
  // Nothing studied yet but the example note: level 1.
  const setReviews = (n: number) =>
    page.evaluate((reviews) => {
      const d = JSON.parse(localStorage.getItem('studymode.data.v2')!)
      d.studyDays = [{ id: 's1', day: '2026-11-02', reviews, quizzes: 0, actions: 0, createdAt: '', updatedAt: '' }]
      localStorage.setItem('studymode.data.v2', JSON.stringify(d))
      // Achievements already seen, so their toasts do not hold the level one.
      localStorage.setItem('studymode.achievements.v1', JSON.stringify({ 'ilk-adim': '2026-11-02T10:00:00Z' }))
    }, n)
  await setReviews(10)
  await page.goto('/')
  await expect(page.getByRole('link', { name: /^Seviye 1, Çaylak/ })).toBeVisible()
  // First visit only remembers the level; then enough study to pass 100 XP.
  await page.waitForTimeout(500)
  await setReviews(40)
  await page.reload()
  const toast = page.locator('.level-toast')
  await expect(toast).toContainText('Seviye atladın', { timeout: 10_000 })
  await expect(toast).toContainText('Seviye 2')
  await toast.getByRole('button', { name: /Seviye 2/ }).click()
  await expect(page).toHaveURL(/\/basarimlar#seviye$/)
  const card = page.getByRole('region', { name: 'Seviye' })
  await expect(card).toContainText('Çaylak')
  await card.getByText('XP nereden geldi?').click()
  await expect(card).toContainText('Çevrilen kart')
  await expect(card).toContainText('+80')
})


test('Premium kodu: her hata kendi mesajıyla; doğru kodda Premium hemen açılır ve bitiş tarihi görünür', async ({ page }) => {
  await page.clock.install({ time: new Date(2026, 10, 2, 14, 0) })
  let until: string | null = null
  const answers = ['invalid', 'used', 'already_yours', 'too_many']
  await signedInAs(page, 'normal', {}, {}, {
    ai_quota: () => ({ role: 'normal', used: 0, limit: until ? 150 : 40, allowed: true, premium_until: until }),
    plus_quota: () => ({ role: 'normal', eligible: !!until, used: 0, limit: 30, allowed: true, premium_until: until }),
    redeem_code: (body) => {
      const next = answers.shift()
      if (next) return { ok: false, error: next }
      expect(String(body.code)).toBe('SM-7KQ2-X9PD-4M8T')
      until = '2026-12-02T14:00:00Z'
      return { ok: true, days: 30, premium_until: until }
    },
  })
  await page.goto('/premium')
  await expect(page.getByText(/Kilitli · Premium kodu/)).toBeVisible()
  const input = page.getByPlaceholder('SM-XXXX-XXXX-XXXX')
  const use = page.getByRole('button', { name: 'Kodu kullan' })
  for (const message of ['Bu kod geçerli değil.', 'Bu kod daha önce kullanılmış.', 'Bu kodu zaten kullandın.', 'Çok fazla yanlış deneme. Bir saat sonra yeniden dene.']) {
    await input.fill('sm-0000-0000-0000')
    await use.click()
    await expect(page.getByRole('alert')).toHaveText(message)
  }
  await input.fill('sm-7kq2-x9pd-4m8t')
  await expect(input).toHaveValue('SM-7KQ2-X9PD-4M8T')
  await use.click()
  await expect(page.getByText(/Premium açıldı! 2 Aralık 2026 tarihine kadar seninle/)).toBeVisible()
  // Premium opens right away (the allowance is read again), with the end date on the status line.
  await expect(page.getByText(/Premium açık · 2 Aralık 2026 tarihine kadar/)).toBeVisible()
  await page.goto('/ayarlar')
  await expect(page.locator('.premium-access')).toContainText('2 Aralık 2026 tarihine kadar')
  await expect(page.locator('.premium-access')).toContainText('30 gün kaldı')
})

test('Premium kodu: bitmesine 3 gün kala Bugün’de kapatılabilir hatırlatma', async ({ page }) => {
  await page.clock.install({ time: new Date(2026, 10, 2, 14, 0) })
  const T = '2026-10-01T00:00:00Z'
  await signedInAs(page, 'normal', {}, { courses: [{ id: 'c1', name: 'Biyoloji', color: '#4f46e5', exam_date: null, created_at: T, updated_at: T }] }, {
    ai_quota: () => ({ role: 'normal', used: 0, limit: 150, allowed: true, premium_until: '2026-11-04T20:00:00Z' }),
  })
  await page.goto('/')
  const reminder = page.locator('.premium-reminder')
  await expect(reminder).toContainText('Premium’ın 3 gün sonra bitiyor')
  // No Shopier link set yet: no "Yenile" button.
  await expect(reminder.getByRole('link', { name: 'Yenile' })).toHaveCount(0)
  await reminder.getByRole('button', { name: 'Hatırlatmayı kapat' }).click()
  await expect(reminder).toHaveCount(0)
  await page.reload()
  await expect(page.locator('.premium-reminder')).toHaveCount(0)
})

test('Yönetim: kod üret (yalnızca bir kez görünür), listede gör, kullanılmamışı iptal et; Premium kullanıcılar', async ({ page }) => {
  await page.clock.install({ time: new Date(2026, 10, 2, 14, 0) })
  const codes = [
    { id: 'k1', hint: 'SM-…-4M8T', days: 30, label: 'Shopier', created_at: '2026-11-01T10:00:00Z', redeemed_at: '2026-11-01T12:00:00Z', redeemed_email: 'ali@example.com', revoked_at: null },
    { id: 'k2', hint: 'SM-…-9QRS', days: 30, label: 'Shopier', created_at: '2026-11-01T10:00:00Z', redeemed_at: null, redeemed_email: null, revoked_at: null },
  ]
  const calls: Array<{ fn: string; body: Record<string, unknown> }> = []
  await signedInAs(page, 'admin', {}, {}, {
    admin_users: () => [],
    admin_feedback: () => [],
    admin_errors: () => [],
    admin_codes: () => codes,
    admin_premium: () => [{ id: 'u1', email: 'ali@example.com', until: '2026-12-01T12:00:00Z' }],
    admin_create_codes: (body) => {
      calls.push({ fn: 'create', body })
      return Array.from({ length: Number(body.how_many) }, (_, i) => ({ code: `SM-TEST-000${i}-ABCD`, hint: `SM-…-${i}ABC` }))
    },
    admin_revoke_code: (body) => {
      calls.push({ fn: 'revoke', body })
      codes[1].revoked_at = '2026-11-02T14:00:00Z'
      return null
    },
  })
  await page.goto('/yonetim')
  const section = page.getByRole('region', { name: 'Premium kodları' })
  await expect(section).toContainText('1 bekleyen · 1 kullanılmış · 1 Premium kullanıcı')
  await section.getByLabel('Kaç kod?').fill('3')
  await section.getByRole('button', { name: 'Özel' }).click()
  await section.getByLabel('Gün sayısı').fill('120')
  await section.getByLabel('Etiket (isteğe bağlı)').fill('Dönem paketi')
  await section.getByRole('button', { name: 'Kod üret' }).click()
  const made = section.getByRole('region', { name: 'Üretilen kodlar' }).or(section.locator('.codes-made'))
  await expect(made).toContainText('yalnızca şimdi görünür')
  await expect(made.locator('code')).toHaveCount(3)
  expect(calls[0]).toEqual({ fn: 'create', body: { how_many: 3, days: 120, label: 'Dönem paketi' } })
  const download = page.waitForEvent('download')
  await made.getByRole('button', { name: 'CSV indir' }).click()
  expect((await download).suggestedFilename()).toBe('premium-kodlari-120-gun.csv')
  // The used one has no cancel button; the waiting one does.
  await expect(section.getByRole('button', { name: 'SM-…-4M8T kodunu iptal et' })).toHaveCount(0)
  await section.getByRole('button', { name: 'SM-…-9QRS kodunu iptal et' }).click()
  expect(calls.at(-1)).toEqual({ fn: 'revoke', body: { code_id: 'k2' } })
  await expect(section).toContainText('İptal edildi')
  await expect(section.getByRole('region', { name: 'Premium kullanıcılar' }).or(section.locator('[aria-label="Premium kullanıcılar"]'))).toContainText('ali@example.com')
})

test('Yönetim: normal kullanıcı Premium kodları bölümünü görmez', async ({ page }) => {
  await page.clock.install({ time: new Date(2026, 10, 2, 14, 0) })
  await signedInAs(page, 'normal', {}, {}, { admin_codes: () => new Error('not admin') })
  await page.goto('/yonetim')
  await expect(page.locator('main')).toBeVisible()
  await expect(page.getByRole('region', { name: 'Premium kodları' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Kod üret' })).toHaveCount(0)
})
