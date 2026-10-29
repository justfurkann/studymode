import { expect, test, type Page } from '@playwright/test'

const biologyNotes = `Hücre Biyolojisi

Mitokondri: Hücresel solunum yoluyla hücrenin kullanabileceği enerjinin üretiminde görev alan organeldir. Hücrelerin enerji ihtiyacı işlevlerine göre değişebilir.

Ribozom: Genetik bilgiye göre amino asitleri birleştirerek protein sentezini gerçekleştiren hücresel yapıdır. Proteinler hücrede yapısal ve işlevsel görevler üstlenir.

Çekirdek: Ökaryot hücrelerde kalıtsal bilginin büyük bölümünü barındıran ve hücresel etkinliklerin düzenlenmesinde rol oynayan yapıdır. Genetik bilginin aktarılması canlılığın devamlılığı için gereklidir.

Lizozom: Hücre içi sindirimde görev alan enzimleri içeren ve bazı hücresel bileşenlerin parçalanmasını sağlayan organeldir. Hücresel atıkların işlenmesi hücre içi dengenin korunmasına katkı sağlar.

Hücre zarı: Hücreyi dış ortamdan ayıran ve madde alışverişini düzenleyen seçici geçirgen yapıdır. Hücreler çevreleriyle sürekli madde ve bilgi alışverişi yapar.`

function watchErrors(page: Page) {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  return errors
}

function isoDaysFromNow(days: number) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

async function createCourse(page: Page, name: string, examInDays?: number) {
  await page.goto('/dersler')
  await page.getByRole('button', { name: 'Yeni ders' }).click()
  const dialog = page.getByRole('dialog', { name: 'Yeni ders' })
  await dialog.getByLabel('Ders adı').fill(name)
  if (examInDays !== undefined) await dialog.getByLabel(/sınav tarihi/i).fill(isoDaysFromNow(examInDays))
  await dialog.getByRole('button', { name: 'Dersi oluştur' }).click()
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible()
}

async function pasteNote(page: Page, title: string) {
  await page.getByRole('link', { name: 'Not ekle' }).last().click()
  await page.getByLabel('Not başlığı').fill(title)
  await page.getByRole('tab', { name: 'Metin yapıştır' }).click()
  await page.getByLabel('Ders notun').fill(biologyNotes)
}

test('demo note: summary, quiz, converting mistakes to cards', async ({ page }) => {
  const errors = watchErrors(page)
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /Hoş geldin/ })).toBeVisible()
  await page.getByRole('button', { name: 'Örnek notla dene' }).click()

  await expect(page.getByRole('heading', { level: 1, name: 'Öğrenme ve bellek' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Ana noktalar' })).toBeVisible()
  await expect(page.getByText('Aktif hatırlama').first()).toBeVisible()

  await page.getByRole('tab', { name: /Test/ }).click()
  const total = Number(await page.getByRole('tab', { name: /Test/ }).locator('.tab-count').textContent())
  for (let i = 0; i < total; i += 1) {
    // Always pick the last option so at least some answers are wrong.
    await page.getByRole('radio').last().click()
    await page.getByRole('button', { name: 'Kontrol et' }).click()
    await expect(page.getByText(/Doğru!|Yanlış/)).toBeVisible()
    await page.getByRole('button', { name: /Sonraki soru|Sonucu gör/ }).click()
  }
  await expect(page.getByText('Sonuç')).toBeVisible()

  const cardsBefore = Number(await page.getByRole('tab', { name: /Kartlar/ }).locator('.tab-count').textContent())
  await page.getByRole('button', { name: 'Yanlışlarımı karta çevir' }).click()
  await expect(page.getByRole('button', { name: 'Kartlara eklendi' })).toBeDisabled()
  const cardsAfter = Number(await page.getByRole('tab', { name: /Kartlar/ }).locator('.tab-count').textContent())
  expect(cardsAfter).toBeGreaterThan(cardsBefore)

  // The low score shows up on the Today page as a weak topic.
  await page.getByRole('link', { name: 'Bugün' }).first().click()
  await expect(page.getByRole('heading', { name: 'Tekrar çalışman gereken konular' })).toBeVisible()
  expect(errors).toEqual([])
})

test('course with exam, pasted note in simple mode, spaced review and persistence', async ({ page }) => {
  const errors = watchErrors(page)
  await createCourse(page, 'Biyoloji 101', 5)
  await expect(page.getByText('Sınava 5 gün')).toBeVisible()

  await pasteNote(page, 'Hücre ve organeller')
  await expect(page.getByRole('button', { name: /Yapay zekâ/ })).toBeDisabled()
  await page.getByRole('button', { name: 'Kaydet ve hazırla' }).click()

  await expect(page.getByRole('heading', { level: 1, name: 'Hücre ve organeller' })).toBeVisible()
  await expect(page.getByText('Basit mod', { exact: true })).toBeVisible()

  // Add a card by hand.
  await page.getByRole('tab', { name: /Kartlar/ }).click()
  await page.getByRole('button', { name: 'Kart ekle' }).click()
  const dialog = page.getByRole('dialog', { name: 'Yeni kart' })
  await dialog.getByLabel('Ön yüz (soru)').fill('ATP nerede üretilir?')
  await dialog.getByLabel('Arka yüz (cevap)').fill('Mitokondride.')
  await dialog.getByRole('button', { name: 'Kaydet' }).click()
  await expect(page.getByText('ATP nerede üretilir?')).toBeVisible()

  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Yaklaşan sınavlar' })).toBeVisible()
  const due = Number(await page.locator('.hero .count').textContent())
  expect(due).toBeGreaterThan(1)

  await page.getByRole('link', { name: 'Tekrara başla' }).click()
  await expect(page.getByText(`${due} kart kaldı`)).toBeVisible()
  await page.getByRole('button', { name: /Cevabı göster/ }).click()
  await page.getByRole('button', { name: /^İyi/ }).click()
  await expect(page.getByText(`${due - 1} kart kaldı`)).toBeVisible()

  // "Bilemedim" keeps the card in this session.
  await page.keyboard.press('Space')
  await page.keyboard.press('1')
  await expect(page.getByText(`${due - 1} kart kaldı`)).toBeVisible()

  // One card is scheduled for later, the forgotten one comes back in 10 minutes; both survive a reload.
  await page.reload()
  await page.goto('/')
  await expect(page.locator('.hero .count')).toHaveText(String(due - 2))
  await page.goto('/dersler')
  await expect(page.getByRole('link', { name: /Biyoloji 101/ })).toBeVisible()
  expect(errors).toEqual([])
})

test('PDF upload fills the note text', async ({ page }) => {
  await createCourse(page, 'Biyoloji 102')
  await page.getByRole('link', { name: 'Not ekle' }).last().click()
  await page.getByLabel('Not dosyası').setInputFiles({ name: 'hucre_notlari.pdf', mimeType: 'application/pdf', buffer: makePdf(biologyNotes.split('\n').filter(Boolean)) })
  await expect(page.getByLabel('Ders notun')).toHaveValue(/Mitokondri/)
  await expect(page.getByLabel('Not başlığı')).toHaveValue('hucre notlari')
})

test('AI mode: key check and generation through the Claude API', async ({ page }) => {
  const errors = watchErrors(page)
  const requests: Array<{ method: string; url: string; body: unknown; headers: Record<string, string> }> = []
  await page.route('https://api.anthropic.com/**', async (route) => {
    const request = route.request()
    requests.push({ method: request.method(), url: request.url(), body: request.method() === 'POST' ? request.postDataJSON() : null, headers: await request.allHeaders() })
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' }
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors })
    if (request.url().includes('/v1/models/')) {
      return route.fulfill({ status: 200, headers: cors, json: { id: 'claude-opus-5-5', type: 'model', display_name: 'Claude Opus 5.5', created_at: '2026-01-01T00:00:00Z' } })
    }
    const set = {
      summary: { overview: 'Notlar hücre organellerini anlatıyor.', points: ['Mitokondri enerji üretir.', 'Ribozom protein sentezler.'], keyTerms: [{ term: 'Ribozom', definition: 'Protein sentezleyen yapı.' }] },
      cards: [{ front: 'Hangi organel enerji üretir?', back: 'Mitokondri.', source: 'Mitokondri: Hücresel solunum yoluyla' }],
      questions: [{ prompt: 'Protein sentezi hangi yapıda olur?', options: ['Lizozom', 'Ribozom', 'Çekirdek', 'Hücre zarı'], answerIndex: 1, explanation: 'Ribozom amino asitleri birleştirir.', source: 'Ribozom: Genetik bilgiye göre' }],
      practice: [{ question: 'Mitokondri ve ribozomun görevlerini karşılaştır.', answer: 'Mitokondri enerji, ribozom protein üretir.', hint: 'Enerji ve protein.' }],
    }
    return route.fulfill({
      status: 200,
      headers: cors,
      json: {
        id: 'msg_test',
        type: 'message',
        role: 'assistant',
        model: 'claude-opus-5-5',
        content: [{ type: 'text', text: JSON.stringify(set) }],
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage: { input_tokens: 10, output_tokens: 10 },
      },
    })
  })

  await page.goto('/ayarlar')
  await page.getByRole('group', { name: 'Yapay zekâ servisi' }).getByRole('button', { name: 'Claude' }).click()
  await page.getByPlaceholder('sk-ant-…').fill('sk-ant-test-key')
  await page.getByRole('button', { name: 'Doğrula ve kaydet' }).click()
  await expect(page.getByText('Anahtar çalışıyor ve kaydedildi.')).toBeVisible()

  await createCourse(page, 'Biyoloji 103')
  await pasteNote(page, 'Organeller (AI)')
  await expect(page.getByRole('button', { name: /Yapay zekâ/ })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'Kaydet ve hazırla' }).click()

  await expect(page.getByText('Yapay zekâ ile hazırlandı')).toBeVisible()
  await expect(page.getByText('Notlar hücre organellerini anlatıyor.')).toBeVisible()

  const message = requests.find((r) => r.method === 'POST' && /\/v1\/messages(\?|$)/.test(r.url))
  expect(message).toBeTruthy()
  const body = message!.body as { model: string; fallbacks: string; messages: Array<{ content: string }> }
  expect(body.model).toBe('claude-opus-5-5')
  expect(body.fallbacks).toBe('default')
  expect(body.messages[0].content).toContain('Mitokondri')
  expect(message!.headers.authorization).toBe('Bearer sk-ant-test-key')

  await page.getByRole('tab', { name: /Test/ }).click()
  await page.getByRole('radio', { name: /Ribozom/ }).click()
  await page.getByRole('button', { name: 'Kontrol et' }).click()
  await expect(page.getByText('Doğru!')).toBeVisible()
  await expect(page.getByText('“Ribozom: Genetik bilgiye göre”')).toBeVisible()

  await page.getByRole('tab', { name: /Uygula/ }).click()
  await page.getByRole('button', { name: 'Örnek cevabı göster' }).click()
  await expect(page.getByText('Mitokondri enerji, ribozom protein üretir.')).toBeVisible()
  expect(errors).toEqual([])
})

test('AI mode with an own Gemini key uses JSON mode and validates the reply', async ({ page }) => {
  const errors = watchErrors(page)
  const bodies: unknown[] = []
  const set = {
    summary: { overview: 'Gemini özeti.', points: ['Ribozom protein sentezler.'], keyTerms: [] },
    cards: [{ front: 'Ribozom ne yapar?', back: 'Protein sentezler.', source: '' }],
    questions: [{ prompt: 'Enerji hangi organelde üretilir?', options: ['Mitokondri', 'Ribozom', 'Lizozom', 'Zar'], answerIndex: 0, explanation: 'Notta yazıyor.', source: '' }],
    practice: [],
  }
  await page.route('https://generativelanguage.googleapis.com/**', async (route) => {
    const request = route.request()
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' }
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors })
    if (request.method() === 'GET') return route.fulfill({ status: 200, headers: cors, json: { name: 'models/gemini-3.8-flash' } })
    bodies.push(request.postDataJSON())
    // First reply has the wrong shape; the app should retry once.
    const text = bodies.length === 1 ? '{"nope":1}' : '```json\n' + JSON.stringify(set) + '\n```'
    return route.fulfill({ status: 200, headers: cors, json: { candidates: [{ content: { parts: [{ text }] }, finishReason: 'STOP' }] } })
  })

  await page.goto('/ayarlar')
  await page.getByRole('group', { name: 'Yapay zekâ servisi' }).getByRole('button', { name: 'Gemini' }).click()
  await page.getByPlaceholder('AIza…').fill('AIza-test')
  await page.getByRole('button', { name: 'Doğrula ve kaydet' }).click()
  await expect(page.getByText('Gemini (Google) bağlı')).toBeVisible()

  await createCourse(page, 'Biyoloji 105')
  await pasteNote(page, 'Organeller (Gemini)')
  await page.getByRole('button', { name: 'Kaydet ve hazırla' }).click()
  await expect(page.getByText('Gemini özeti.')).toBeVisible()
  expect(bodies).toHaveLength(2)
  const body = bodies[0] as { generationConfig: { responseMimeType: string }; systemInstruction: { parts: Array<{ text: string }> } }
  expect(body.generationConfig.responseMimeType).toBe('application/json')
  expect(body.systemInstruction.parts[0].text).toContain('JSON Schema')
  expect(errors).toEqual([])
})

test('free AI asks for sign-in when logged out', async ({ page }) => {
  await createCourse(page, 'Biyoloji 106')
  await page.getByRole('link', { name: 'Not ekle' }).last().click()
  await expect(page.getByRole('button', { name: /Yapay zekâ/ })).toBeDisabled()
  await expect(page.getByText('Ücretsiz yapay zekâ için giriş yapman gerekiyor.')).toBeVisible()
  await expect(page.getByRole('button', { name: /Basit mod/ })).toHaveAttribute('aria-pressed', 'true')
})

test('theme switch and mobile navigation', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/ayarlar')
  await page.getByRole('button', { name: 'Koyu' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')

  const bar = page.getByRole('navigation', { name: 'Alt menü' })
  await expect(bar).toBeVisible()
  await bar.getByRole('link', { name: 'Dersler' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Dersler' })).toBeVisible()
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
  expect(overflow).toBe(false)
})

test('several files at once become separate notes', async ({ page }) => {
  const errors = watchErrors(page)
  await createCourse(page, 'Biyoloji 104')
  await page.getByRole('link', { name: 'Not ekle' }).last().click()
  await page.getByLabel('Not dosyası').setInputFiles([
    { name: 'hafta_1.txt', mimeType: 'text/plain', buffer: Buffer.from(biologyNotes) },
    { name: 'hafta_2.md', mimeType: 'text/markdown', buffer: Buffer.from(biologyNotes.replace('Hücre Biyolojisi', '# Organeller')) },
    { name: 'bos.txt', mimeType: 'text/plain', buffer: Buffer.from('kısa') },
  ])
  await expect(page.getByText('3 dosya')).toBeVisible()
  await expect(page.getByLabel('hafta_1.txt başlığı')).toHaveValue('hafta 1')
  await page.getByLabel('hafta_2.md başlığı').fill('2. hafta – Organeller')
  await expect(page.getByText('Çok kısa')).toBeVisible()
  await page.getByRole('button', { name: '2 notu kaydet ve hazırla' }).click()

  await expect(page.getByRole('heading', { level: 1, name: 'Biyoloji 104' })).toBeVisible()
  await expect(page.getByRole('link', { name: /hafta 1/ })).toBeVisible()
  await expect(page.getByRole('link', { name: /2\. hafta – Organeller/ })).toBeVisible()
  await expect(page.getByText('2 not')).toBeVisible()
  expect(errors).toEqual([])
})

test('mock exam from prepared questions, without AI', async ({ page }) => {
  const errors = watchErrors(page)
  await page.goto('/')
  await page.getByRole('button', { name: 'Örnek notla dene' }).click()
  await page.getByRole('link', { name: /Psikolojiye Giriş/ }).first().click()
  await page.getByRole('link', { name: 'Sınav provası' }).click()

  await expect(page.getByRole('heading', { level: 1, name: 'Sınav provası' })).toBeVisible()
  await expect(page.getByRole('button', { name: /Hazır sorulardan karıştır/ })).toHaveAttribute('aria-pressed', 'true')
  await page.getByLabel('Soru sayısı').selectOption('5')
  await page.getByLabel('Süre').selectOption('15')
  await page.getByRole('button', { name: 'Sınavı başlat' }).click()

  await expect(page.getByLabel('Kalan süre')).toContainText(/1[45]:\d\d/)
  await expect(page.getByText('0/5 cevaplandı')).toBeVisible()
  await page.getByRole('radiogroup', { name: 'Soru 1 seçenekleri' }).getByRole('radio').first().click()
  await expect(page.getByText('1/5 cevaplandı')).toBeVisible()

  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Sınavı bitir' }).click()
  await expect(page.getByText('Sınav sonucu')).toBeVisible()
  await expect(page.getByText(/\d+ puan/)).toBeVisible()
  await expect(page.getByText('Boş bıraktın').first()).toBeVisible()
  await page.getByRole('button', { name: 'Eksiklerimi karta çevir' }).click()
  await expect(page.getByRole('button', { name: 'Kartlara eklendi' })).toBeDisabled()
  expect(errors).toEqual([])
})

test('AI mock exam with past questions, written answers graded by AI', async ({ page }) => {
  const errors = watchErrors(page)
  const systems: string[] = []
  const users: string[] = []
  await page.route('https://api.anthropic.com/**', async (route) => {
    const request = route.request()
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' }
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors })
    if (request.url().includes('/v1/models/')) return route.fulfill({ status: 200, headers: cors, json: { id: 'claude-opus-5-5', type: 'model', display_name: 'x', created_at: '2026-01-01T00:00:00Z' } })
    const body = request.postDataJSON() as { system: string; messages: Array<{ content: string }> }
    systems.push(body.system)
    users.push(body.messages[0].content)
    let out: unknown
    if (body.system.startsWith('You write a realistic practice exam')) {
      out = {
        questions: [
          { type: 'mcq', prompt: 'Protein sentezi nerede olur?', options: ['Lizozom', 'Ribozom', 'Çekirdek', 'Zar'], answerIndex: 1, explanation: 'Ribozom.', modelAnswer: '', source: 'Ribozom: Genetik bilgiye göre' },
          { type: 'open', prompt: 'Mitokondrinin görevini açıkla.', options: [], answerIndex: -1, explanation: 'Enerji üretimi, hücresel solunum.', modelAnswer: 'Hücresel solunumla enerji üretir.', source: 'Mitokondri: Hücresel solunum' },
        ],
      }
    } else {
      out = { results: [{ score: 0.5, feedback: 'Enerjiyi söyledin ama hücresel solunumu atladın.' }] }
    }
    return route.fulfill({
      status: 200,
      headers: cors,
      json: { id: 'msg', type: 'message', role: 'assistant', model: 'claude-opus-5-5', content: [{ type: 'text', text: JSON.stringify(out) }], stop_reason: 'end_turn', stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1 } },
    })
  })

  await page.goto('/ayarlar')
  await page.getByRole('group', { name: 'Yapay zekâ servisi' }).getByRole('button', { name: 'Claude' }).click()
  await page.getByPlaceholder('sk-ant-…').fill('sk-ant-test-key')
  await page.getByRole('button', { name: 'Doğrula ve kaydet' }).click()
  await expect(page.getByText('Anahtar çalışıyor ve kaydedildi.')).toBeVisible()

  await createCourse(page, 'Biyoloji 107')
  await pasteNote(page, 'Organeller')
  await page.getByRole('button', { name: /Basit mod/ }).click()
  await page.getByRole('button', { name: 'Kaydet ve hazırla' }).click()
  await page.getByRole('link', { name: 'Biyoloji 107' }).click()
  await page.getByRole('link', { name: 'Sınav provası' }).click()

  await expect(page.getByRole('button', { name: /Yapay zekâ yeni sorular yazsın/ })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('group', { name: 'Sınav türü' }).getByRole('button', { name: 'Karışık' }).click()
  await page.getByRole('group', { name: 'Zorluk' }).getByRole('button', { name: 'Zor' }).click()
  await page.getByLabel('Süre').selectOption('0')
  await page.getByPlaceholder(/Eski sınavlardan/).fill('1) Golgi cisimciğinin görevini açıklayınız.')
  await page.getByRole('button', { name: 'Sınavı başlat' }).click()

  await expect(page.getByText('Protein sentezi nerede olur?')).toBeVisible()
  expect(users[0]).toContain('Golgi cisimciğinin')
  expect(users[0]).toContain('difficulty="hard"')
  expect(users[0]).toContain('Mitokondri')
  await expect(page.getByLabel('Kalan süre')).toHaveCount(0)

  await page.getByRole('radiogroup', { name: 'Soru 1 seçenekleri' }).getByRole('radio', { name: /Ribozom/ }).click()
  await page.getByLabel('Soru 2 cevabın').fill('Enerji üretir.')
  await page.getByRole('button', { name: 'Sınavı bitir' }).click()

  await expect(page.getByText('75 puan')).toBeVisible()
  await expect(page.getByText('Enerjiyi söyledin ama hücresel solunumu atladın.')).toBeVisible()
  await expect(page.getByText('50/100')).toBeVisible()
  expect(systems.some((s) => s.startsWith('You grade'))).toBe(true)
  expect(errors).toEqual([])
})

test('account entry point leads to the sign-in form', async ({ page }) => {
  const errors = watchErrors(page)
  await page.goto('/ayarlar')
  await page.getByRole('link', { name: 'Giriş yap veya hesap oluştur' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Giriş yap' })).toBeVisible()
  await page.getByRole('button', { name: 'Hesap oluştur' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Hesap oluştur' })).toBeVisible()
  await expect(page.getByLabel('Şifre')).toHaveAttribute('autocomplete', 'new-password')
  expect(errors).toEqual([])
})

/** A single-page PDF with an uncompressed text stream. */
function makePdf(lines: string[]): Buffer {
  const ascii = lines.map((line) => line.normalize('NFD').replace(/[^\x20-\x7e]/g, '').replace(/([\\()])/g, '\\$1'))
  const stream = `BT /F1 9 Tf 30 780 Td 12 TL\n${ascii.map((line) => `(${line}) Tj T*`).join('\n')}\nET`
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
  ]
  let pdf = '%PDF-1.4\n'
  const offsets = [0]
  objects.forEach((body, index) => {
    offsets.push(Buffer.byteLength(pdf))
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`
  })
  const xref = Buffer.byteLength(pdf)
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  pdf += offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return Buffer.from(pdf)
}
