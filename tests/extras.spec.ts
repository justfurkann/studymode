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

test('Hangi öğrenci tipisin: no account, level and school, 10 questions, a shareable result and story image', async ({ page, browser }) => {
  const errors = watchErrors(page)
  await page.goto('/ogrenci-tipi')
  await page.getByRole('button', { name: /Teste başla/ }).click()
  await page.getByRole('button', { name: /^Üniversite/ }).click()
  await page.getByLabel('Üniversite ara').fill('odtu')
  await page.getByRole('listitem').filter({ hasText: 'Orta Doğu Teknik Üniversitesi' }).first().click()
  await expect(page.getByRole('heading', { name: 'Cuma akşamı. Hafta sonu planın?' })).toBeVisible()
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
  await expect(page.getByRole('heading', { name: 'Bu tam sen' })).toBeVisible()
  await expect(page.getByText(/02\.00'de, herkes uyurken/)).toBeVisible()
  await expect(page.getByText('Sana özel taktik:')).toBeVisible()
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
  await expect(friend.getByRole('heading', { level: 1, name: 'Gece Kuşu Düşünür' })).toBeVisible()
  await friend.getByRole('button', { name: /Sen de çöz/ }).click()
  await expect(friend.getByRole('heading', { name: /nerede okuyorsun/ })).toBeVisible()
  await friend.getByRole('button', { name: /^Lise/ }).click()
  await expect(friend.getByRole('heading', { name: 'Cuma akşamı. Hafta sonu planın?' })).toBeVisible()
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
  await expect(page.getByRole('heading', { level: 1, name: 'Gece Kuşu Düşünür' })).toBeVisible()
  // Leave and come back: still there.
  await page.goto('/ayarlar')
  await page.reload()
  await expect(page.locator('.student-type-panel')).toContainText('Gece Kuşu Düşünür')
  await page.locator('.sidebar').getByRole('button', { name: 'Daha fazla' }).click()
  await expect(page.locator('.sidebar .side-quiz')).toContainText('Gece Kuşu Düşünür')
  await page.goto('/ogrenci-tipi')
  await expect(page.getByRole('link', { name: /Son sonucun/ })).toContainText('Gece Kuşu Düşünür')
  await page.getByRole('link', { name: /Son sonucun/ }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Gece Kuşu Düşünür' })).toBeVisible()
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
  await expect(page.locator('.student-type-panel')).toContainText('Meraklı Kaşif')
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
  await expect(page.getByRole('heading', { level: 1, name: 'Gece Kuşu Düşünür' })).toBeVisible()
  await expect.poll(() => JSON.stringify(updates)).toContain('"type":"gecekusu"')
})

/** Signed in as `role`, with the account's metadata kept by the fake server (PUT /user merges into it). */
async function signedInAs(page: Page, role: 'admin' | 'normal' | 'vip', metadata: Record<string, unknown> = {}, tables: Record<string, unknown[]> = {}) {
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
    const corner = g.getImageData(el.naturalWidth - 40, el.naturalHeight - 22, 1, 1).data
    const middle = g.getImageData(400, 200, 1, 1).data
    return { src: el.src.slice(0, 23), corner: [...corner].slice(0, 3), middle: [...middle].slice(0, 3) }
  })
  expect(info.src).toBe('data:image/jpeg;base64,')
  // The corner sits on the dark label; the middle is still the picture.
  expect(Math.max(...info.corner)).toBeLessThan(140)
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
