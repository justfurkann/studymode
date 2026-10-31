import { strToU8, zipSync } from 'fflate'
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
  if (examInDays !== undefined) {
    await dialog.getByRole('button', { name: 'Sınav ekle' }).click()
    await dialog.getByLabel('Sınav tarihi').fill(isoDaysFromNow(examInDays))
  }
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
  await expect(page.getByRole('heading', { level: 1, name: /Önemlisini biz işaretleyelim/ })).toBeVisible()
  await page.getByRole('button', { name: 'Örnek notla dene' }).click()

  await expect(page.getByRole('heading', { level: 1, name: 'Öğrenme ve bellek' })).toBeVisible()
  // The full summary repeats the guide, so it starts collapsed.
  await expect(page.getByRole('heading', { name: 'Ana noktalar' })).toBeHidden()
  await page.getByRole('button', { name: 'Tam özeti tek sayfada gör' }).click()
  await expect(page.getByRole('heading', { name: 'Ana noktalar' })).toBeVisible()
  await expect(page.getByText('Aktif hatırlama').first()).toBeVisible()

  await page.getByRole('tab', { name: /Test/ }).click()
  const total = Number(await page.getByRole('tab', { name: /Test/ }).locator('.tab-count').textContent())
  for (let i = 0; i < total; i += 1) {
    // Always pick the last option so at least some answers are wrong.
    await page.getByRole('radio').last().click()
    await page.getByRole('button', { name: 'Kontrol et' }).click()
    await expect(page.locator('.explain strong').filter({ hasText: /Doğru!|Yanlış/ })).toBeVisible()
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
  await expect(page.getByText('Vizeye 5 gün')).toBeVisible()

  await pasteNote(page, 'Hücre ve organeller')
  await expect(page.getByRole('button', { name: /Yapay zekâ/ })).toBeDisabled()
  await page.getByRole('button', { name: 'Kaydet ve hazırla' }).click()

  await expect(page.getByRole('heading', { level: 1, name: 'Hücre ve organeller' })).toBeVisible()
  await expect(page.getByText('Basit mod', { exact: true })).toBeVisible()

  // Add a card by hand from the card manager.
  await page.getByRole('tab', { name: /Kartlar/ }).click()
  await page.getByText(/Kartları yönet/).click()
  await page.getByRole('button', { name: 'Kart ekle' }).click()
  const dialog = page.getByRole('dialog', { name: 'Yeni kart' })
  await dialog.getByLabel('Ön yüz (soru)').fill('ATP nerede üretilir?')
  await dialog.getByLabel('Arka yüz (cevap)').fill('Mitokondride.')
  await dialog.getByRole('button', { name: 'Kaydet' }).click()
  await expect(page.getByText('ATP nerede üretilir?').first()).toBeVisible()

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

  await expect(page.locator('.note-meta').getByText('Yapay zekâ', { exact: true })).toBeVisible()
  await expect(page.getByLabel('Kavramlar').getByText('Notlar hücre organellerini anlatıyor.')).toBeVisible()

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

  await page.getByRole('tab', { name: /Anlat/ }).click()
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
  await expect(page.getByLabel('Kavramlar').getByText('Gemini özeti.')).toBeVisible()
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

test('adding a second file after the first switches to the list', async ({ page }) => {
  await createCourse(page, 'Biyoloji 108')
  await page.getByRole('link', { name: 'Not ekle' }).last().click()
  await page.getByLabel('Not dosyası').setInputFiles({ name: 'hafta_1.txt', mimeType: 'text/plain', buffer: Buffer.from(biologyNotes) })
  await expect(page.getByLabel('Ders notun')).toHaveValue(/Mitokondri/)
  await page.getByLabel('Not başlığı').fill('1. hafta')
  await page.getByLabel('Not dosyası').setInputFiles({ name: 'hafta_2.txt', mimeType: 'text/plain', buffer: Buffer.from(biologyNotes) })
  await expect(page.getByText('2 dosya')).toBeVisible()
  await expect(page.getByLabel('hafta_1.txt başlığı')).toHaveValue('1. hafta')
  await expect(page.getByLabel('hafta_2.txt başlığı')).toHaveValue('hafta 2')
  await page.getByRole('button', { name: '2 notu kaydet ve hazırla' }).click()
  await expect(page.getByText('2 not')).toBeVisible()
})

test('mock exam from prepared questions, without AI', async ({ page }) => {
  const errors = watchErrors(page)
  await page.goto('/')
  await page.getByRole('button', { name: 'Örnek notla dene' }).click()
  await page.getByRole('link', { name: /Psikolojiye Giriş/ }).first().click()
  await page.getByRole('main').getByRole('link', { name: 'Sınav provası' }).click()

  await expect(page.getByRole('heading', { level: 1, name: 'Sınav provası' })).toBeVisible()
  await expect(page.getByRole('button', { name: /Hazır sorulardan karıştır/ })).toHaveAttribute('aria-pressed', 'true')
  await page.getByLabel('Soru sayısı').selectOption('5')
  await page.getByLabel('Süre').selectOption('15')
  await page.getByRole('button', { name: 'Sınavı başlat' }).click()

  await expect(page.getByLabel('Kalan süre')).toContainText(/1[45]:\d\d/)
  await expect(page.getByText('0/5 cevaplandı')).toBeVisible()
  await page.getByRole('radiogroup', { name: 'Soru 1 seçenekleri' }).getByRole('radio').first().click()
  await expect(page.getByText('1/5 cevaplandı')).toBeVisible()

  await page.getByRole('button', { name: 'Sınavı bitir' }).click()
  if (await page.getByRole('dialog', { name: 'İşlemi onayla' }).isVisible()) await page.getByRole('button', { name: 'Evet, devam et' }).click()
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
  await page.getByRole('main').getByRole('link', { name: 'Sınav provası' }).click()

  await expect(page.getByRole('button', { name: /Yapay zekâ yeni sorular yazsın/ })).toHaveAttribute('aria-pressed', 'true')
  await page.getByLabel('Test sorusu').selectOption('10')
  await page.getByLabel('Klasik soru').selectOption('2')
  await page.getByRole('group', { name: 'Zorluk' }).getByRole('button', { name: 'Zor' }).click()
  await page.getByLabel(/Hoca sınav hakkında ne dedi/).fill('Tanım soruları ağırlıklı olacak.')
  await page.getByLabel('Süre').selectOption('0')
  await page.getByPlaceholder(/Eski sınavlardan/).fill('1) Golgi cisimciğinin görevini açıklayınız.')
  await page.getByRole('button', { name: 'Sınavı başlat' }).click()

  await expect(page.getByText('Protein sentezi nerede olur?')).toBeVisible()
  expect(users[0]).toContain('Golgi cisimciğinin')
  expect(users[0]).toContain('difficulty="hard"')
  expect(users[0]).toContain('mcq="10" open="2"')
  expect(users[0]).toContain('Tanım soruları ağırlıklı olacak.')
  expect(users[0]).toContain('Mitokondri')
  await expect(page.getByLabel('Kalan süre')).toHaveCount(0)

  await page.getByRole('radiogroup', { name: 'Soru 1 seçenekleri' }).getByRole('radio', { name: /Ribozom/ }).click()
  await page.getByLabel('Soru 2 cevabın').fill('Enerji üretir.')
  await page.getByRole('button', { name: 'Sınavı bitir' }).click()
  if (await page.getByRole('dialog', { name: 'İşlemi onayla' }).isVisible()) await page.getByRole('button', { name: 'Evet, devam et' }).click()

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
  await expect(page.getByLabel('Şifre', { exact: true })).toHaveAttribute('autocomplete', 'new-password')
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

test('edit source, tags, course and summary; search and export', async ({ page }) => {
  await createCourse(page, 'Hedef ders')
  await page.goto('/')
  await createCourse(page, 'Biyoloji')
  await pasteNote(page, 'Hücre')
  await page.getByRole('button', { name: 'Kaydet ve hazırla' }).click()
  await page.getByRole('button', { name: 'Diğer işlemler' }).click()
  await page.getByRole('menuitem', { name: 'Notu düzenle' }).click()
  const editor = page.getByRole('dialog', { name: 'Notu düzenle' })
  await editor.getByLabel('Not başlığı').fill('Yeni hücre notu')
  await editor.getByRole('combobox', { name: 'Ders', exact: true }).selectOption({ label: 'Hedef ders' })
  await editor.getByLabel('Etiketler').fill('vize, hafta 3')
  await editor.getByLabel('Not içeriği').fill(biologyNotes + '\nYeni eklenen kaynak cümlesi burada yer alır.')
  await editor.getByRole('button', { name: 'Değişiklikleri kaydet' }).click()
  await expect(page.getByText(/Kaynak metin değişti/)).toBeVisible()
  await page.getByRole('button', { name: 'Diğer işlemler' }).click()
  await page.getByRole('menuitem', { name: 'Özeti düzenle' }).click()
  await page.getByLabel('Genel özet').fill('Düzenlenmiş açıklama.')
  await page.getByRole('button', { name: 'Özeti kaydet' }).click()
  await expect(page.getByLabel('Kavramlar').getByText('Düzenlenmiş açıklama.')).toBeVisible()
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Diğer işlemler' }).click()
  await page.getByRole('menuitem', { name: 'Markdown indir' }).click()
  expect((await download).suggestedFilename()).toBe('Yeni hucre notu.md')
  await page.reload()
  await expect(page.getByLabel('Kavramlar').getByText('Düzenlenmiş açıklama.')).toBeVisible()
  await page.getByRole('link', { name: 'Hedef ders', exact: true }).click()
  await page.getByLabel('Notlarda ara').fill('kaynak cümlesi')
  await page.getByRole('combobox', { name: 'Etiket', exact: true }).selectOption('vize')
  await expect(page.getByRole('link', { name: /Yeni hücre notu/ })).toBeVisible()
  await page.getByRole('link', { name: /Yeni hücre notu/ }).click()
  await page.getByRole('button', { name: 'Diğer işlemler' }).click()
  await page.getByRole('menuitem', { name: 'Notu sil' }).click()
  await expect(page.getByRole('dialog', { name: 'İşlemi onayla' })).toBeVisible()
  await page.getByRole('button', { name: 'Vazgeç', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Yeni hücre notu' })).toBeVisible()
})

test('review undo restores schedule and quiz draft survives tab change', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Örnek notla dene' }).click()
  await page.getByRole('tab', { name: /Test/ }).click()
  await page.getByRole('radio').first().click()
  await page.getByRole('button', { name: 'Kontrol et' }).click()
  await page.getByRole('button', { name: 'Sonraki soru' }).click()
  await page.getByRole('tab', { name: /Özet/ }).click()
  await page.getByRole('tab', { name: /Test/ }).click()
  await expect(page.getByText('Soru 2 / 5')).toBeVisible()
  await page.getByRole('tab', { name: /Kartlar/ }).click()
  await page.getByText(/Kartları yönet/).click()
  await page.getByRole('link', { name: 'Tekrar ekranında çalış' }).click()
  const original = await page.locator('.flashcard .front').textContent()
  const count = await page.getByText(/\d+ kart kaldı/).textContent()
  await page.getByRole('button', { name: /Cevabı göster/ }).click()
  await page.getByRole('button', { name: /^Kolay/ }).click()
  await page.getByRole('button', { name: 'Geri al', exact: true }).click()
  await expect(page.locator('.flashcard .front')).toHaveText(original!)
  await expect(page.getByText(/\d+ kart kaldı/)).toHaveText(count!)
  await page.reload()
  const data = await page.evaluate(() => JSON.parse(localStorage.getItem('studymode.data.v2')!))
  expect(data.cards.find((c: {front:string}) => c.front === original).reps).toBe(0)
  await page.getByRole('button', { name: 'Karıştır', exact: true }).click()
  await page.getByRole('checkbox', { name: 'Yalnızca zorlandıklarım' }).click()
  await expect(page.getByRole('heading', { name: 'Şu an tekrar edilecek kart yok' })).toBeVisible()
})

test('practice grading reports service errors and allows retry', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('studymode.settings.v1', JSON.stringify({ provider: 'google', keys: { google: 'test-only-key' }, models: { google: 'test-model' } })))
  let fail = true
  await page.route('https://generativelanguage.googleapis.com/**', route => {
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' }
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers })
    return route.fulfill({ status: fail ? 403 : 200, contentType: 'application/json', headers, body: fail ? '{}' : JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ results: [{ score: 0.6, feedback: 'Tekrar günlerini somutlaştır.' }] }) }] } }] }) })
  })
  await page.goto('/')
  await page.getByRole('button', { name: 'Örnek notla dene' }).click()
  await page.getByRole('tab', { name: /Anlat/ }).click()
  await page.getByLabel('Soru 1 için cevabın').fill('Notları kapatıp hatırlamayı dener, sonraki günlerde tekrar ederim.')
  await page.getByRole('button', { name: 'Cevabımı değerlendir' }).click()
  await expect(page.getByRole('alert')).toContainText('geçersiz')
  await expect(page.getByText('Geri bildirim · 0/100')).toHaveCount(0)
  fail = false
  await page.getByRole('button', { name: 'Cevabımı değerlendir' }).click()
  await expect(page.getByText('Geri bildirim · 60/100')).toBeVisible()
  await expect(page.getByText('Tekrar günlerini somutlaştır.')).toBeVisible()
})

test.describe('accounts', () => {
  const SUPABASE = 'https://jpcatyopkpnudgdyncas.supabase.co'

  test('sign-up asks for name and a repeated password', async ({ page }) => {
    const errors = watchErrors(page)
    let signup: { email: string; password: string; data: Record<string, string> } | null = null
    await page.route(`${SUPABASE}/auth/v1/signup**`, async (route) => {
      signup = route.request().postDataJSON()
      await route.fulfill({
        status: 200,
        json: { id: 'u1', aud: 'authenticated', role: '', email: signup!.email, email_confirmed_at: null, user_metadata: signup!.data, app_metadata: {}, identities: [{ id: 'i1' }], created_at: new Date().toISOString() },
      })
    })

    await page.goto('/giris')
    await page.getByRole('button', { name: 'Hesap oluştur' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Hesap oluştur' })).toBeVisible()
    await page.getByLabel('Ad', { exact: true }).fill(' Ayşe ')
    await page.getByLabel('Soyad').fill('Yılmaz')
    await page.getByLabel('E-posta').fill('ayse@example.com')
    await page.getByLabel('Şifre', { exact: true }).fill('uzunsifre1')
    await page.getByLabel('Şifre (tekrar)').fill('uzunsifre2')
    await expect(page.getByText('Şifreler aynı değil.')).toBeVisible()
    await page.getByRole('button', { name: 'Hesap oluştur' }).first().click()
    expect(signup).toBeNull()

    await page.getByLabel('Şifre (tekrar)').fill('uzunsifre1')
    await expect(page.getByText('Şifreler aynı değil.')).toHaveCount(0)
    await page.locator('form').getByRole('button', { name: 'Hesap oluştur' }).click()
    await expect(page.getByText(/ayse@example.com adresine gelen bağlantıya tıklayıp/)).toBeVisible()
    expect(signup!.data).toEqual({ first_name: 'Ayşe', last_name: 'Yılmaz', full_name: 'Ayşe Yılmaz' })
    expect(signup!.password).toBe('uzunsifre1')
    expect(errors).toEqual([])
  })

  test('sign-up rejects short passwords before calling the server', async ({ page }) => {
    let called = false
    await page.route(`${SUPABASE}/auth/v1/signup**`, (route) => ((called = true), route.abort()))
    await page.goto('/giris?mod=kayit')
    await page.getByLabel('Ad', { exact: true }).fill('Ali')
    await page.getByLabel('Soyad').fill('Veli')
    await page.getByLabel('E-posta').fill('ali@example.com')
    await page.getByLabel('Şifre', { exact: true }).fill('kisa')
    await page.getByLabel('Şifre (tekrar)').fill('kisa')
    await page.locator('form').evaluate((form: HTMLFormElement) => (form.noValidate = true))
    await page.locator('form').getByRole('button', { name: 'Hesap oluştur' }).click()
    await expect(page.getByText('Şifre en az 8 karakter olmalı.')).toBeVisible()
    expect(called).toBe(false)
  })

  test('forgot password sends a reset link back to the app', async ({ page }) => {
    let recover: { url: string; body: { email: string } } | null = null
    await page.route(`${SUPABASE}/auth/v1/recover**`, async (route) => {
      recover = { url: route.request().url(), body: route.request().postDataJSON() }
      await route.fulfill({ status: 200, json: {} })
    })
    await page.goto('/giris')
    await page.getByRole('button', { name: 'Şifremi unuttum' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Şifremi unuttum' })).toBeVisible()
    await expect(page.getByLabel('Şifre', { exact: true })).toHaveCount(0)
    await page.getByLabel('E-posta').fill('ayse@example.com')
    await page.getByRole('button', { name: 'Yenileme bağlantısı gönder' }).click()
    await expect(page.getByText(/şifre yenileme bağlantısı gönderdik/)).toBeVisible()
    expect(recover!.body.email).toBe('ayse@example.com')
    expect(decodeURIComponent(recover!.url)).toContain('redirect_to=http://127.0.0.1:5173')
  })

  test('expired email links and stale reset pages explain what to do', async ({ page }) => {
    await page.goto('/#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired')
    await expect(page.getByText(/Bağlantının süresi dolmuş/)).toBeVisible()
    await page.goto('/sifre-yenile')
    await expect(page.getByText('Bu bağlantı geçersiz ya da süresi dolmuş.', { exact: false })).toBeVisible()
    await page.getByRole('link', { name: 'Yeni bağlantı iste' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Şifremi unuttum' })).toBeVisible()
  })
})

test('step-by-step zero-to-mastery learning path guides the user through all 5 steps', async ({ page }) => {
  const errors = watchErrors(page)
  await page.goto('/')
  await page.getByRole('button', { name: 'Örnek notla dene' }).click()

  const steps = page.getByRole('tablist', { name: 'Çalışma adımları' })
  // A new note opens straight on the first step.
  await expect(steps.getByRole('tab', { name: /Özet/ })).toHaveAttribute('aria-selected', 'true')

  // Concepts, then the main points one by one.
  await page.getByRole('button', { name: /Devam: Ana noktalar/ }).click()
  await expect(page.getByText('%20 tamamlandı')).toBeVisible()
  await expect(page.getByText('Madde 1 / 5')).toBeVisible()
  for (let i = 1; i < 5; i += 1) await page.getByRole('button', { name: 'Anladım' }).click()
  await page.getByRole('button', { name: 'Teste geç' }).click()
  await expect(page.getByText('%40 tamamlandı')).toBeVisible()

  // The test comes before the cards and completes its step at any score.
  await expect(steps.getByRole('tab', { name: /Test/ })).toHaveAttribute('aria-selected', 'true')
  for (let i = 0; i < 5; i += 1) {
    await page.getByRole('radio').first().click()
    await page.getByRole('button', { name: 'Kontrol et' }).click()
    await page.getByRole('button', { name: /Sonraki soru|Sonucu gör/ }).click()
  }
  await expect(page.getByText('%60 tamamlandı')).toBeVisible()

  // Opening the note again (from a list, without a view in the address) goes to the next step: the cards.
  await page.goto(page.url().split('?')[0])
  await expect(steps.getByRole('tab', { name: /Kartlar/ })).toHaveAttribute('aria-selected', 'true')

  // One card at a time: optional hint, turn, "Bildim" / "Tekrar".
  await expect(page.getByText('Kart 1 / 6')).toBeVisible()
  await page.getByRole('button', { name: 'İpucu' }).click()
  await expect(page.locator('.card-hint')).toContainText('…')
  await page.getByRole('button', { name: 'Çevir' }).click()
  await page.getByRole('button', { name: 'Tekrar' }).click()
  // A card marked "Tekrar" comes back at the end of the round.
  await expect(page.getByText('Kart 1 / 6')).toBeVisible()
  for (let i = 0; i < 6; i += 1) {
    await page.getByRole('button', { name: 'Çevir' }).click()
    await page.getByRole('button', { name: 'Bildim' }).click()
  }
  await expect(page.getByText('Tur bitti')).toBeVisible()
  await expect(page.getByText(/6 kartın 5 tanesini ilk denemede bildin/)).toBeVisible()
  await expect(page.getByText('%80 tamamlandı')).toBeVisible()

  // Explain in your own words: needs a real answer before finishing.
  await page.getByRole('button', { name: /Sıradaki: Kendi cümlelerinle anlat/ }).click()
  await expect(page.getByRole('button', { name: /Bitir: Konuyu öğrendim/ })).toBeDisabled()
  await page.getByLabel('Soru 1 için cevabın').fill('Her gün kısa tekrar yapar, notu kapatıp hatırlamayı dener, yanlışlarımı incelerim.')
  await page.getByRole('button', { name: /Bitir: Konuyu öğrendim/ }).click()
  await expect(page.getByText('Bu notu bitirdin!')).toBeVisible()
  await expect(page.getByText('%100 tamamlandı')).toBeVisible()
  expect(errors).toEqual([])
})


test('finished mock exams are saved and can be reopened from the course page', async ({ page }) => {
  const errors = watchErrors(page)
  await page.goto('/')
  await page.getByRole('button', { name: 'Örnek notla dene' }).first().click()
  await page.getByRole('link', { name: /Psikolojiye Giriş/ }).first().click()
  const courseUrl = page.url()
  await page.getByRole('main').getByRole('link', { name: 'Sınav provası' }).click()
  await page.getByLabel('Soru sayısı').selectOption('5')
  await page.getByRole('button', { name: 'Sınavı başlat' }).click()
  for (let i = 1; i <= 5; i += 1) {
    await page.getByRole('radiogroup', { name: `Soru ${i} seçenekleri` }).getByRole('radio').first().click()
  }
  await page.getByRole('button', { name: 'Sınavı bitir' }).click()
  await expect(page.getByText('Sonuç kaydedildi')).toBeVisible()
  const score = await page.locator('.score').textContent()

  // Leaving the page used to lose the result; it must survive a reload.
  await page.goto(courseUrl)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Hazırlık durumu' })).toBeVisible()
  await expect(page.getByText('Sınav provaları')).toBeVisible()
  await expect(page.getByText(/Pekiştirilen kartlar: %\d+/)).toBeVisible()
  await page.getByRole('link', { name: new RegExp(`^${score}`) }).first().click()
  await expect(page.getByText(/Sınav provası · /)).toBeVisible()
  await expect(page.locator('.score')).toHaveText(score!)
  await expect(page.getByText('Test · ', { exact: false }).or(page.getByText(/Hazır sorular/))).toBeVisible()

  page.once('dialog', () => undefined)
  await page.getByRole('button', { name: 'Sil' }).click()
  await page.getByRole('button', { name: 'Evet, devam et' }).click()
  await expect(page.getByText('Sınav provaları')).toHaveCount(0)
  expect(errors).toEqual([])
})

test('empty sections guide a new visitor instead of showing blank screens', async ({ page }) => {
  await page.goto('/dersler')
  await expect(page.getByText('Henüz ders yok')).toBeVisible()
  await expect(page.getByRole('button', { name: 'İlk dersimi oluştur' })).toBeVisible()
  await page.goto('/tekrar')
  await expect(page.getByText('Henüz tekrar kartın yok')).toBeVisible()
  await page.getByRole('button', { name: 'Örnek notla dene' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Öğrenme ve bellek' })).toBeVisible()
})

test('guests see an invitation to the free AI where it would help', async ({ page }) => {
  await createCourse(page, 'Biyoloji 109')
  await page.getByRole('link', { name: 'Not ekle' }).last().click()
  const prompt = page.getByRole('note').filter({ hasText: 'Yapay zekâ ücretsiz, sadece hesap aç' })
  await expect(prompt).toBeVisible()
  await prompt.getByRole('link', { name: 'Ücretsiz hesap aç' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Hesap oluştur' })).toBeVisible()
})

test('PowerPoint and Word files can be uploaded as notes', async ({ page }) => {
  const errors = watchErrors(page)
  const slide = (lines: string[]) => strToU8(`<p:sld>${lines.map((l) => `<a:p><a:r><a:t>${l}</a:t></a:r></a:p>`).join('')}</p:sld>`)
  const pptx = zipSync({
    'ppt/slides/slide1.xml': slide(['Hücre Biyolojisi', 'Mitokondri: Hücresel solunum yoluyla enerji üreten organeldir.']),
    'ppt/slides/slide2.xml': slide(['Ribozom: Amino asitleri birleştirerek protein sentezini gerçekleştiren yapıdır.']),
  })
  const docx = zipSync({
    'word/document.xml': strToU8(`<w:document><w:body>${biologyNotes.split('\n').filter(Boolean).map((l) => `<w:p><w:r><w:t>${l}</w:t></w:r></w:p>`).join('')}</w:body></w:document>`),
  })
  await createCourse(page, 'Biyoloji 110')
  await page.getByRole('link', { name: 'Not ekle' }).last().click()
  await page.getByLabel('Not dosyası').setInputFiles({ name: 'hafta_3.pptx', mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', buffer: Buffer.from(pptx) })
  await expect(page.getByLabel('Ders notun')).toHaveValue(/Slayt 1\nHücre Biyolojisi[\s\S]*Slayt 2\nRibozom/)
  await page.getByLabel('Not dosyası').setInputFiles({ name: 'hafta_4.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: Buffer.from(docx) })
  await expect(page.getByText('2 dosya')).toBeVisible()
  await expect(page.getByLabel('hafta_4.docx başlığı')).toHaveValue('hafta 4')
  await page.getByRole('button', { name: '2 notu kaydet ve hazırla' }).click()
  await expect(page.getByText('2 not')).toBeVisible()
  expect(errors).toEqual([])
})

test('photo note extraction requires AI for guests and puts transcribed text into the editor first', async ({ page }) => {
  const errors = watchErrors(page)
  const tinyPng = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
    'base64',
  )

  await createCourse(page, 'Fizik 101')
  await page.getByRole('link', { name: 'Not ekle' }).last().click()

  // Guest without account/key sees clear message and AiSignupPrompt
  await page.getByLabel('Not dosyası').setInputFiles({ name: 'defter.png', mimeType: 'image/png', buffer: tinyPng })
  await expect(page.getByRole('alert')).toContainText('Fotoğraftan metin çıkarmak için')
  await expect(page.getByRole('note').filter({ hasText: 'Yapay zekâ ücretsiz, sadece hesap aç' })).toBeVisible()

  // Configure user's Gemini key and mock transcription response
  await page.evaluate(() => {
    localStorage.setItem(
      'studymode.settings.v1',
      JSON.stringify({
        provider: 'google',
        keys: { anthropic: '', openai: '', google: 'test-gemini-key' },
        models: { anthropic: 'claude-opus-5-5', openai: 'gpt-5-mini', google: 'gemini-3.5-flash-lite' },
        theme: 'system',
        dailyGoal: 20,
      }),
    )
  })
  await page.reload()

  const transcribedNote = `Kütle ve Enerji Eşdeğerliği: $E = mc^2$ formülü ile ifade edilir. Cisimlerin durgun kütle enerjisi ışık hızının karesiyle doğru orantılıdır.\n\n| Büyüklük | Sembol |\n| --- | --- |\n| Enerji | E |\n| Kütle | m |`
  await page.route('https://generativelanguage.googleapis.com/**', (route) => {
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' }
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers })
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers,
      body: JSON.stringify({
        candidates: [{ content: { parts: [{ text: JSON.stringify({ text: transcribedNote }) }] }, finishReason: 'STOP' }],
      }),
    })
  })

  await page.getByLabel('Not dosyası').setInputFiles({ name: 'tahta_notu.png', mimeType: 'image/png', buffer: tinyPng })
  // Extracted text appears in the textarea first so the user can edit before saving
  await expect(page.getByLabel('Ders notun')).toHaveValue(transcribedNote)
  await expect(page.getByLabel('Not başlığı')).toHaveValue('tahta notu')
  expect(errors).toEqual([])
})

test('daily card goal and study streak update on Today page after reviewing cards', async ({ page }) => {
  const errors = watchErrors(page)
  await page.goto('/')
  await page.getByRole('button', { name: 'Örnek notla dene' }).click()

  // Update daily card goal in Settings to 5
  await page.goto('/ayarlar')
  const goalInput = page.getByLabel('Günlük kart hedefi')
  await expect(goalInput).toHaveValue('20')
  await goalInput.fill('5')

  await page.goto('/')
  const streakPanel = page.getByRole('region', { name: 'Günlük hedef ve seri' })
  await expect(streakPanel).toBeVisible()
  await expect(streakPanel.getByText('0/5')).toBeVisible()
  await expect(streakPanel.getByText('Çalışma serisi: 0 gün')).toBeVisible()

  // Review 2 cards
  await page.getByRole('link', { name: 'Tekrara başla' }).click()
  for (let i = 0; i < 2; i += 1) {
    await page.getByRole('button', { name: /Cevabı göster/ }).click()
    await page.getByRole('button', { name: /^İyi/ }).click()
  }
  await page.getByRole('link', { name: 'Bitir' }).click()

  // Verify progress (2/5) and active streak ("1 gündür çalışıyorsun")
  await expect(streakPanel.getByText('2/5')).toBeVisible()
  await expect(streakPanel.getByText('1 gündür çalışıyorsun')).toBeVisible()
  expect(errors).toEqual([])
})

test('interactive explainer, source jump, dual mastery metrics, smart study plan, and mid-exam reload persistence work', async ({ page }) => {
  const errors = watchErrors(page)
  await page.goto('/')
  await page.getByRole('button', { name: 'Örnek notla dene' }).click()

  // 1. Mastery only shows up once the student has been measured.
  const meta = page.locator('.note-meta')
  await expect(meta).not.toContainText('Hâkimiyet')

  // 2. "Bu konuyu anlamadım" interactive explainer
  await page.getByRole('button', { name: 'Bu konuyu anlamadım' }).first().click()
  const helper = page.getByRole('region', { name: 'Konu açıklama seçenekleri' })
  await expect(helper).toBeVisible()
  await helper.getByRole('button', { name: 'Daha basit anlat' }).click()
  await expect(helper.getByRole('status')).toContainText('Kısaca ifade etmek gerekirse')

  // 3. "Kaynağında gör" jumps to Kaynak tab and highlights the quote
  await page.getByRole('tab', { name: /Test/ }).click()
  await page.getByRole('radio').first().click()
  await page.getByRole('button', { name: 'Kontrol et' }).click()
  await page.getByRole('button', { name: 'Kaynağında gör' }).click()
  await expect(page.getByRole('region', { name: 'Kaynak metin' })).toBeVisible()
  await expect(page.locator('#kaynak-vurgu')).toBeVisible()

  // 4. Navigate to course via back-link, test mid-exam sessionStorage persistence across page reload
  await page.getByRole('link', { name: /Psikolojiye Giriş/ }).first().click()
  await page.getByRole('main').getByRole('link', { name: 'Sınav provası' }).click()
  await page.getByLabel('Soru sayısı').selectOption('5')
  await page.getByRole('button', { name: 'Sınavı başlat' }).click()
  await page.getByRole('radiogroup', { name: 'Soru 1 seçenekleri' }).getByRole('radio').first().click()
  await expect(page.getByText('1/5 cevaplandı')).toBeVisible()

  await page.reload()
  await expect(page.getByText('1/5 cevaplandı')).toBeVisible()
  expect(errors).toEqual([])
})



test.describe('study progress is kept', () => {
  async function openDemo(page: Page) {
    await page.goto('/')
    await page.getByRole('button', { name: 'Örnek notla dene' }).first().click()
    await expect(page.getByRole('heading', { level: 1, name: 'Öğrenme ve bellek' })).toBeVisible()
  }

  test('written answers survive a reload and step 5 needs a real answer', async ({ page }) => {
    await openDemo(page)
    await page.getByRole('tab', { name: /Anlat/ }).click()
    const finish = page.getByRole('button', { name: /Bitir: Konuyu öğrendim/ })
    await expect(finish).toBeDisabled()
    await page.getByLabel('Soru 1 için cevabın').fill('Önce konuyu okur, sonra notu kapatıp kendi cümlelerimle anlatırım.')
    await expect(finish).toBeEnabled()
    await page.waitForTimeout(900) // autosave delay
    await page.reload()
    await page.getByRole('tab', { name: /Anlat/ }).click()
    await expect(page.getByLabel('Soru 1 için cevabın')).toHaveValue(/kendi cümlelerimle anlatırım/)
    // A written answer alone keeps today's streak alive.
    await page.goto('/')
    await expect(page.getByText('1 gündür çalışıyorsun')).toBeVisible()
  })

  test('card self-assessment counts as a review for the daily goal', async ({ page }) => {
    await openDemo(page)
    await page.getByRole('tab', { name: /Kartlar/ }).click()
    await page.getByRole('button', { name: 'Çevir' }).click()
    await page.getByRole('button', { name: 'Bildim' }).click()
    await page.goto('/')
    await expect(page.getByRole('progressbar', { name: 'Günlük kart ilerlemesi' })).toHaveAttribute('aria-valuenow', '1')
  })

  test('the last test result is shown when coming back, with a retake option', async ({ page }) => {
    await openDemo(page)
    const noteUrl = page.url()
    await page.getByRole('tab', { name: /Test/ }).click()
    const total = Number(await page.getByRole('tab', { name: /Test/ }).locator('.tab-count').textContent())
    for (let i = 0; i < total; i += 1) {
      await page.getByRole('radio').first().click()
      await page.getByRole('button', { name: 'Kontrol et' }).click()
      await page.getByRole('button', { name: /Sonraki soru|Sonucu gör/ }).click()
    }
    await page.goto('/')
    await page.goto(noteUrl)
    await page.getByRole('tab', { name: /Test/ }).click()
    await expect(page.getByText(/Son sonucun ·/)).toBeVisible()
    await page.getByRole('button', { name: 'Tekrar çöz' }).click()
    await expect(page.getByText(`Soru 1 / ${total}`)).toBeVisible()
  })

  test('the example course has an exam a week away', async ({ page }) => {
    await openDemo(page)
    await page.goto('/')
    await expect(page.getByText('Vizeye 7 gün').first()).toBeVisible()
  })

  test('an exam whose time ran out while away is submitted with the answers given', async ({ page }) => {
    await openDemo(page)
    await page.getByRole('link', { name: /Psikolojiye Giriş/ }).first().click()
    const courseId = page.url().split('/ders/')[1]
    await page.evaluate((id) => {
      sessionStorage.setItem(
        `studymode.exam.active.${id}`,
        JSON.stringify({
          questions: [{ id: 'q1', type: 'mcq', prompt: 'Süresi dolan soru?', options: ['Doğru', 'Yanlış'], answerIndex: 0, explanation: '', modelAnswer: '', source: null, noteTitle: null }],
          answers: [0],
          endsAt: Date.now() - 60_000,
          minutes: 15,
          startedAt: Date.now() - 16 * 60_000,
          examSource: 'local',
          format: 'test',
          difficulty: 'medium',
          useAi: false,
          noteIds: [],
        }),
      )
    }, courseId)
    await page.goto(`/ders/${courseId}/sinav`)
    await expect(page.getByText('Sınav sonucu')).toBeVisible()
    await expect(page.locator('.score')).toHaveText('100 puan')
    expect(await page.evaluate((id) => sessionStorage.getItem(`studymode.exam.active.${id}`), courseId)).toBeNull()
  })
})

test.describe('midterms and finals', () => {
  test('a course keeps a midterm and a final; the mock exam picks the notes the chosen exam covers', async ({ page }) => {
    const errors = watchErrors(page)
    await createCourse(page, 'Fizyoloji', 6)
    await expect(page.getByText('Vizeye 6 gün')).toBeVisible()
    const courseUrl = page.url()

    for (const title of ['Kalp', 'Böbrek']) {
      await pasteNote(page, title)
      await page.getByRole('button', { name: 'Kaydet ve hazırla' }).click()
      await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible()
      await page.goto(courseUrl)
    }
    // With only two notes and no tags the search row is just noise.
    await expect(page.getByLabel('Notlarda ara')).toBeHidden()

    // Add a final and limit the midterm to the first note.
    await page.getByRole('button', { name: 'Dersi düzenle' }).click()
    const dialog = page.getByRole('dialog', { name: 'Dersi düzenle' })
    await dialog.getByRole('button', { name: 'Sınav ekle' }).click()
    const finalRow = dialog.getByRole('group', { name: '2. sınav' })
    await expect(finalRow.getByLabel('Sınav türü')).toHaveValue('final')
    await finalRow.getByLabel('Sınav tarihi').fill(isoDaysFromNow(40))
    await finalRow.getByLabel('Ağırlık (%)').fill('60')
    const midterm = dialog.getByRole('group', { name: '1. sınav' })
    await midterm.getByText('Kapsam: tüm notlar').click()
    await midterm.getByLabel('Kalp').check()
    await dialog.getByRole('button', { name: 'Kaydet' }).click()

    const exams = page.getByRole('region', { name: 'Sınavlar' })
    await expect(exams).toContainText('Vizeye 6 gün')
    await expect(exams).toContainText('Finale 40 gün')
    await expect(exams).toContainText('%60')
    await expect(exams).toContainText('1 not')

    // Everything survives a reload.
    await page.reload()
    await expect(page.getByRole('region', { name: 'Sınavlar' })).toContainText('Finale 40 gün')

    // The midterm's practice exam only selects the note it covers; switching to the final selects all.
    await page.getByRole('link', { name: 'Vize için prova' }).click()
    await expect(page.getByRole('checkbox', { name: 'Kalp' })).toBeChecked()
    await expect(page.getByRole('checkbox', { name: 'Böbrek' })).not.toBeChecked()
    await page.getByLabel('Hangi sınava hazırlanıyorsun?').selectOption({ label: 'Finale 40 gün' })
    await expect(page.getByRole('checkbox', { name: 'Böbrek' })).toBeChecked()

    // Today lists each exam separately.
    await page.goto('/')
    await expect(page.getByText('Fizyoloji · Vize', { exact: true })).toBeVisible()
    await expect(page.getByText('Fizyoloji · Final', { exact: true })).toBeVisible()
    expect(errors).toEqual([])
  })

  test('a reviewed exam question links to the passage in its note', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Örnek notla dene' }).click()
    await page.getByRole('link', { name: /Psikolojiye Giriş/ }).first().click()
    await page.getByRole('main').getByRole('link', { name: 'Sınav provası' }).click()
    await page.getByLabel('Soru sayısı').selectOption('5')
    await page.getByLabel('Süre').selectOption('0')
    await page.getByRole('button', { name: 'Sınavı başlat' }).click()
    await page.getByRole('button', { name: 'Sınavı bitir' }).click()
    await page.getByRole('button', { name: 'Evet, devam et' }).click()
    await page.getByRole('link', { name: 'Kaynağında gör' }).first().click()
    await expect(page.getByRole('heading', { level: 1, name: 'Öğrenme ve bellek' })).toBeVisible()
    await expect(page.locator('#kaynak-vurgu')).toBeVisible()
  })
})

test('logged-out visitors get the landing page, which leads to sign-up and fits a phone', async ({ page }) => {
  const errors = watchErrors(page)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1, name: /Önemlisini biz işaretleyelim/ })).toBeVisible()
  // The app's own menus are not part of the landing page.
  await expect(page.getByRole('navigation', { name: 'Alt menü' })).toHaveCount(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false)
  await page.getByText('Ücretsiz mi?').click()
  await expect(page.getByText(/Hesap açınca yapay zekâ ücretsiz çalışır/)).toBeVisible()
  await page.getByRole('link', { name: 'Ücretsiz başla' }).first().click()
  await expect(page.getByRole('heading', { level: 1, name: 'Hesap oluştur' })).toBeVisible()
  expect(errors).toEqual([])
})

test('the landing page stays reachable once the app has data', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Örnek notla dene' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Öğrenme ve bellek' })).toBeVisible()
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1, name: 'Bugün' })).toBeVisible()
  await page.goto('/tanitim')
  await expect(page.getByRole('heading', { level: 1, name: /Önemlisini biz işaretleyelim/ })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Örnek notla dene' })).toHaveCount(0)
})

test('the mock exam tab lists courses and remembers how the exam will look', async ({ page }) => {
  const errors = watchErrors(page)
  await page.goto('/')
  await page.getByRole('button', { name: 'Örnek notla dene' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Öğrenme ve bellek' })).toBeVisible()

  await page.getByRole('complementary', { name: 'Ana menü' }).getByRole('link', { name: 'Sınavlar' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Sınavlar' })).toBeVisible()
  const row = page.getByRole('link', { name: 'Psikolojiye Giriş (örnek) için prova hazırla' })
  await expect(row).toContainText('Vizeye 7 gün')
  await expect(row).toContainText('Henüz prova yok')
  await row.click()

  await expect(page.getByRole('group', { name: 'Sınav nasıl olacak?' })).toBeVisible()
  await page.getByLabel('Soru sayısı').selectOption('5')
  await page.getByLabel('Süre').selectOption('45')
  await page.getByRole('button', { name: 'Sınavı başlat' }).click()
  await expect(page.getByText('0/5 cevaplandı')).toBeVisible()
  await page.getByRole('button', { name: 'Sınavı bitir' }).click()
  await page.getByRole('button', { name: 'Evet, devam et' }).click()
  await expect(page.getByText('Sınav sonucu')).toBeVisible()

  // Back in the tab: the course shows the result, and the next run starts from the same plan.
  await page.goto('/sinav')
  await expect(row).toContainText('Son prova: 0 puan')
  await row.click()
  await expect(page.getByLabel('Soru sayısı')).toHaveValue('5')
  await expect(page.getByLabel('Süre')).toHaveValue('45')
  expect(errors).toEqual([])
})

test('on a phone the mock exam tab is in the bottom bar and settings move to the top', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/dersler')
  await page.getByRole('navigation', { name: 'Alt menü' }).getByRole('link', { name: 'Sınavlar' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Sınavlar' })).toBeVisible()
  // With nothing entered yet the tab opens straight on adding exams.
  await expect(page.getByRole('form', { name: 'Dönemini kur' })).toBeVisible()
  await expect(page.getByText('Prova için önce bir ders ve not lazım')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false)
  await page.getByRole('link', { name: 'Ayarlar' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Ayarlar' })).toBeVisible()
})

test('fill-in-the-blank: one word bank with extra words, scored per blank', async ({ page }) => {
  const errors = watchErrors(page)
  const users: string[] = []
  await page.route('https://api.anthropic.com/**', async (route) => {
    const request = route.request()
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' }
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors })
    if (request.url().includes('/v1/models/')) return route.fulfill({ status: 200, headers: cors, json: { id: 'claude-opus-5-5', type: 'model', display_name: 'x', created_at: '2026-01-01T00:00:00Z' } })
    const body = request.postDataJSON() as { messages: Array<{ content: string }> }
    users.push(body.messages[0].content)
    const blank = (prompt: string, answer: string) => ({ type: 'blank', prompt, options: [], answerIndex: -1, explanation: '', modelAnswer: answer, source: '' })
    const out = {
      questions: [
        blank('Protein sentezi _____ üzerinde gerçekleşir.', 'Ribozom'),
        blank('Hücrenin enerji santrali _____ olarak bilinir.', 'Mitokondri'),
        blank('Proteinleri paketleyen organel _____ cisimciğidir.', 'Golgi'),
        blank('Hücre içi sindirimi _____ yapar.', 'Lizozom'),
      ],
      distractors: ['Sentrozom', 'Koful'],
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

  await createCourse(page, 'Biyoloji 110')
  await pasteNote(page, 'Organeller')
  await page.getByRole('button', { name: /Basit mod/ }).click()
  await page.getByRole('button', { name: 'Kaydet ve hazırla' }).click()
  await page.getByRole('link', { name: 'Biyoloji 110' }).click()
  await page.getByRole('main').getByRole('link', { name: 'Sınav provası' }).click()

  await page.getByLabel('Test sorusu').selectOption('0')
  await page.getByLabel('Boşluk doldurma').selectOption('4')
  await page.getByLabel('Boşta kalacak kelime').selectOption('2')
  await page.getByLabel('Süre').selectOption('0')
  await page.getByRole('button', { name: 'Sınavı başlat' }).click()

  const bank = page.getByRole('region', { name: 'Kelime havuzu' })
  await expect(bank.getByRole('listitem')).toHaveCount(6)
  expect(users[0]).toContain('blank="4" distractors="2"')

  await page.getByLabel('Soru 1 boşluğu').selectOption({ label: 'Ribozom' })
  await expect(bank.getByRole('listitem').filter({ hasText: 'Ribozom' })).toHaveClass(/used/)
  await page.getByLabel('Soru 2 boşluğu').selectOption({ label: 'Mitokondri' })
  await page.getByLabel('Soru 3 boşluğu').selectOption({ label: 'Golgi' })
  // A distractor in the last blank: wrong.
  await page.getByLabel('Soru 4 boşluğu').selectOption({ label: 'Koful' })
  await expect(page.getByText('4/4 cevaplandı')).toBeVisible()
  await page.getByRole('button', { name: 'Sınavı bitir' }).click()

  await expect(page.getByText('75 puan')).toBeVisible()
  await expect(page.getByText('Soru 4 · Boşluk doldurma')).toBeVisible()
  await page.getByRole('button', { name: 'Eksiklerimi karta çevir' }).click()
  await expect(page.getByRole('button', { name: 'Kartlara eklendi' })).toBeDisabled()
  expect(errors).toEqual([])
})

test.describe('mola: games and focus timer in the Tekrar tab', () => {
  async function storedCards(page: Page): Promise<Array<{ front: string; back: string; due: string }>> {
    return page.evaluate(() => JSON.parse(localStorage.getItem('studymode.data.v2') || '{}').cards ?? [])
  }
  const clean = (s: string) => s.replace(/\s+/g, ' ').trim()

  test('match game: found pairs turn green, the time becomes a record, streak counts but reviews do not', async ({ page }) => {
    const errors = watchErrors(page)
    await page.goto('/')
    await page.getByRole('button', { name: 'Örnek notla dene' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Öğrenme ve bellek' })).toBeVisible()
    const before = await storedCards(page)

    await page.goto('/tekrar')
    await page.getByRole('tab', { name: 'Mola' }).click()
    await expect(page).toHaveURL(/bolum=mola/)
    await expect(page.getByRole('heading', { level: 1, name: /Kısa bir mola/ })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Eşleştir' })).toContainText('Henüz rekor yok')
    await page.getByRole('button', { name: 'Eşleştir' }).click()

    const board = page.getByRole('group', { name: 'Eşleştirme kartları' })
    const tiles = board.getByRole('button')
    await expect(tiles.first()).toBeVisible()
    const count = await tiles.count()
    expect(count % 2).toBe(0)
    expect(count).toBeGreaterThanOrEqual(6)

    // One wrong pair first: two fronts never match, then a front with a wrong back.
    const texts = (await tiles.allInnerTexts()).map(clean)
    // Fronts may be shortened to the term ("“Öğrenme” ne anlama gelir?" → "Öğrenme"), answers to a prefix.
    const isFront = (text: string) => before.some((c) => clean(c.front).includes(text.replace(/…$/, '')))
    const owner = (text: string) => {
      const prefix = text.replace(/…$/, '')
      return isFront(text) ? before.findIndex((c) => clean(c.front).includes(prefix)) : before.findIndex((c) => clean(c.back).startsWith(prefix))
    }
    const firstFront = texts.findIndex(isFront)
    const wrongBack = texts.findIndex((t, i) => i !== firstFront && !isFront(t) && owner(t) !== owner(texts[firstFront]))
    await tiles.nth(firstFront).click()
    await expect(tiles.nth(firstFront)).toHaveAttribute('aria-pressed', 'true')
    await tiles.nth(wrongBack).click()
    await expect(page.getByText(/1 yanlış/)).toBeVisible()

    // Then every pair, matched by which card each tile came from.
    const done = new Set<number>()
    for (let i = 0; i < texts.length; i++) {
      if (done.has(i)) continue
      const j = texts.findIndex((t, k) => k !== i && !done.has(k) && owner(t) === owner(texts[i]))
      await tiles.nth(i).click()
      await tiles.nth(j).click()
      done.add(i).add(j)
    }

    await expect(page.getByText('Yeni rekor!')).toBeVisible()
    await expect(page.getByText('1 yanlış eşleşme (+2 sn)')).toBeVisible()
    await expect(page.getByText('İlk rekorun bu.')).toBeVisible()
    await page.getByRole('button', { name: 'Molaya dön' }).last().click()
    await expect(page.getByRole('button', { name: 'Eşleştir' })).toContainText(/Rekor: \d+,\d sn/)

    // Games keep the streak alive but never touch the review schedule or the daily card goal.
    const after = await storedCards(page)
    expect(after.map((c) => c.due)).toEqual(before.map((c) => c.due))
    await page.goto('/')
    const streakPanel = page.getByRole('region', { name: 'Günlük hedef ve seri' })
    await expect(streakPanel.getByText('1 gündür çalışıyorsun')).toBeVisible()
    await expect(streakPanel.getByText('0/20')).toBeVisible()
    expect(errors).toEqual([])
  })

  test('quick round: true or false against the clock, missed cards listed at the end', async ({ page }) => {
    const errors = watchErrors(page)
    await page.clock.install()
    await page.goto('/')
    await page.getByRole('button', { name: 'Örnek notla dene' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Öğrenme ve bellek' })).toBeVisible()
    const cards = await storedCards(page)

    await page.goto('/tekrar?bolum=mola')
    await page.getByRole('button', { name: 'Hızlı tur' }).click()
    await expect(page.getByText('Bu cevap bu soruya mı ait?')).toBeVisible()

    // Answer five correctly (third one onwards is worth two points), then one wrong on purpose.
    let expected = 0
    for (let i = 0; i < 6; i++) {
      // Wait for the previous card to fly off and the next one to settle.
      const card = page.locator('.quick-card:not(.is-leaving-left):not(.is-leaving-right)')
      await expect(card).toHaveCount(1)
      const prompt = clean(await card.locator('.front').innerText())
      const shown = clean(await card.locator('.back').innerText())
      const real = cards.find((c) => clean(c.front) === prompt)!
      const isTrue = clean(real.back).startsWith(shown.replace(/…$/, ''))
      const sayTrue = i < 5 ? isTrue : !isTrue
      await page.keyboard.press(sayTrue ? 'ArrowRight' : 'ArrowLeft')
      if (i < 5) expected += i >= 2 ? 2 : 1
      await expect(page.locator('.mola-stats')).toContainText(`${expected} puan`)
    }
    await expect(page.getByText(/^Yanlış\. .+ → /)).toBeVisible()
    await expect(page.getByRole('img', { name: 'Kalan hak: 2/3' })).toBeVisible()

    await page.clock.fastForward('01:05')
    await expect(page.getByText(`${expected} puan`, { exact: true })).toBeVisible()
    await expect(page.getByText('Yeni rekor!')).toBeVisible()
    await expect(page.getByText('6 sorudan 5 tanesini bildin.')).toBeVisible()
    await expect(page.getByText('Kaçırdıkların')).toBeVisible()
    expect(errors).toEqual([])
  })

  test('focus timer runs pomodoro rounds: focus, automatic break, next round, on any page', async ({ page }) => {
    const errors = watchErrors(page)
    await page.clock.install()
    await page.goto('/tekrar?bolum=mola')
    // Without cards the games are locked, the focus timer is not.
    await expect(page.getByRole('button', { name: 'Eşleştir' })).toBeDisabled()
    await page.getByRole('button', { name: 'Odak sayacı' }).click()
    await expect(page.locator('.focus-clock')).toHaveText('25:00')
    await page.getByRole('button', { name: '50 + 10 dk' }).click()
    await expect(page.locator('.focus-clock')).toHaveText('50:00')
    await page.getByRole('button', { name: '25 + 5 dk' }).click()
    await page.getByRole('button', { name: 'Başla' }).click()

    await page.clock.runFor('05:00')
    await expect(page.locator('.focus-clock')).toHaveText('20:00')
    await page.getByRole('button', { name: 'Duraklat' }).click()
    await page.clock.runFor('03:00')
    await expect(page.locator('.focus-clock')).toHaveText('20:00')
    await page.getByRole('button', { name: 'Devam et' }).click()

    // On another page a small pill keeps the time, and the round ends there too.
    await page.goto('/dersler')
    const pill = page.getByRole('link', { name: /^Odak sayacı: Odak, \d\d:\d\d kaldı/ })
    await expect(pill).toBeVisible()
    await page.clock.runFor('20:30')
    await expect(page.getByRole('link', { name: /^Odak sayacı: Mola, 0[45]:\d\d kaldı/ })).toBeVisible()

    // Back on the timer: the break started by itself, with game suggestions.
    await page.getByRole('link', { name: /^Odak sayacı: Mola/ }).click()
    await expect(page.getByText(/Tur bitti, 25 dakika odaklandın/)).toBeVisible()
    await expect(page.locator('.focus-phase')).toHaveText(/Kısa mola/)
    await expect(page.getByRole('region', { name: 'Mola önerileri' })).toBeVisible()
    await expect(page.getByRole('img', { name: 'Bu sette 1/4 tur tamam' })).toBeVisible()
    await expect(page.getByText('Bugün: 25 dk · 1 tur')).toBeVisible()

    // When the break ends, round 2 waits for the student.
    await page.clock.runFor('05:30')
    await expect(page.getByRole('button', { name: '2. turu başlat' })).toBeVisible()
    await page.getByRole('button', { name: '2. turu başlat' }).click()
    await page.clock.runFor('10:30')
    // Stopping early still adds the minutes that passed.
    await page.getByRole('button', { name: 'Bitir' }).click()
    await expect(page.getByText('Son 7 gün: 35 dk')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Başla' })).toBeVisible()

    // The finished round kept the streak alive.
    await page.goto('/')
    expect(errors).toEqual([])
  })

  test('quick round: swipe to answer, three wrong answers end it', async ({ page }) => {
    const errors = watchErrors(page)
    await page.goto('/')
    await page.getByRole('button', { name: 'Örnek notla dene' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Öğrenme ve bellek' })).toBeVisible()
    const cards = await storedCards(page)
    await page.goto('/tekrar?bolum=mola&oyun=hizli')
    await expect(page.getByRole('img', { name: 'Kalan hak: 3/3' })).toBeVisible()

    async function swipeWrong() {
      const card = page.locator('.quick-card:not(.is-leaving-left):not(.is-leaving-right)')
      await expect(card).toHaveCount(1)
      const prompt = clean(await card.locator('.front').innerText())
      const shown = clean(await card.locator('.back').innerText())
      const real = cards.find((c) => clean(c.front) === prompt)!
      const isTrue = clean(real.back).startsWith(shown.replace(/…$/, ''))
      // Swipe the opposite way on purpose.
      const box = (await card.boundingBox())!
      const y = box.y + box.height / 2
      const x = box.x + box.width / 2
      await page.mouse.move(x, y)
      await page.mouse.down()
      await page.mouse.move(x + (isTrue ? -60 : 60), y, { steps: 4 })
      await page.mouse.move(x + (isTrue ? -160 : 160), y, { steps: 4 })
      await page.mouse.up()
    }

    await swipeWrong()
    await expect(page.locator('.quick-flash.is-bad')).toHaveCount(1)
    await expect(page.getByRole('img', { name: 'Kalan hak: 2/3' })).toBeVisible()
    await swipeWrong()
    await expect(page.getByRole('img', { name: 'Kalan hak: 1/3' })).toBeVisible()
    await swipeWrong()
    await expect(page.getByText('Haklar bitti')).toBeVisible()
    await expect(page.getByText('Kaçırdıkların')).toBeVisible()
    expect(errors).toEqual([])
  })

  test('on a phone the Mola section fits and sounds can be turned on in Settings', async ({ page }) => {
    const errors = watchErrors(page)
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/')
    await page.getByRole('button', { name: 'Örnek notla dene' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Öğrenme ve bellek' })).toBeVisible()
    await page.getByRole('navigation', { name: 'Alt menü' }).getByRole('link', { name: 'Tekrar' }).click()
    await page.getByRole('tab', { name: 'Mola' }).click()
    await page.getByRole('button', { name: 'Eşleştir' }).click()
    await expect(page.getByRole('group', { name: 'Eşleştirme kartları' })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false)
    await page.getByRole('button', { name: 'Molaya dön' }).click()
    await page.getByRole('tab', { name: 'Tekrar' }).click()
    await expect(page).toHaveURL(/\/tekrar$/)

    await page.goto('/ayarlar')
    const sounds = page.getByLabel(/Küçük sesler/)
    await expect(sounds).not.toBeChecked()
    await sounds.check()
    await page.reload()
    await expect(page.getByLabel(/Küçük sesler/)).toBeChecked()
    expect(errors).toEqual([])
  })
})

test.describe('exams tab: semester setup, what to start with, calendar export', () => {
  test('the whole semester in one table becomes courses with exams, ordered by date', async ({ page }) => {
    const errors = watchErrors(page)
    await page.goto('/sinav')
    const form = page.getByRole('form', { name: 'Dönemini kur' })
    await expect(form).toBeVisible()

    const row = (n: number) => form.getByRole('group', { name: `${n}. ders` })
    await row(1).getByLabel('Ders adı').fill('Anatomi')
    await row(1).getByLabel('Vize').fill(isoDaysFromNow(5))
    await row(1).getByLabel('Final').fill(isoDaysFromNow(40))
    await row(2).getByLabel('Ders adı').fill('Fizyoloji')
    await row(2).getByLabel('Vize').fill(isoDaysFromNow(12))
    await form.getByRole('button', { name: 'Kaydet' }).click()
    await expect(page.getByText('2 ders oluşturuldu')).toBeVisible()
    await expect(form).toBeHidden()

    // The calendar is in date order.
    const calendar = page.getByRole('region', { name: 'Sınav takvimi' })
    const items = calendar.getByRole('link')
    await expect(items).toHaveCount(3)
    await expect(items.nth(0)).toContainText('Anatomi · Vize')
    await expect(items.nth(0)).toContainText('Vizeye 5 gün')
    await expect(items.nth(0)).toContainText('Henüz not yok')
    await expect(items.nth(1)).toContainText('Fizyoloji · Vize')
    await expect(items.nth(2)).toContainText('Anatomi · Final')

    // The most urgent exam has no notes yet, so the first step is adding one.
    const focus = page.getByRole('region', { name: 'Şimdi bununla başla' })
    await expect(focus).toContainText('Anatomi vizesine 5 gün kaldı')
    await focus.getByRole('link', { name: /Not ekle/ }).click()
    await expect(page).toHaveURL(/\/not-ekle\?ders=/)

    // Both courses wait on the Courses page, ready for notes.
    await page.goto('/dersler')
    await expect(page.getByRole('link', { name: /Anatomi/ })).toContainText('Not ekle')
    await expect(page.getByRole('link', { name: /Fizyoloji/ })).toContainText('Vizeye 12 gün')

    // Opening the table again shows what is there; a new date updates, an empty cell deletes nothing.
    await page.goto('/sinav')
    await page.getByRole('button', { name: 'Sınav ekle' }).click()
    await expect(row(1).getByLabel('Ders adı')).toHaveValue('Anatomi')
    await expect(row(1).getByLabel('Vize')).toHaveValue(isoDaysFromNow(5))
    await row(2).getByLabel('Final').fill(isoDaysFromNow(45))
    await form.getByRole('button', { name: 'Kaydet' }).click()
    await expect(page.getByText('1 ders güncellendi')).toBeVisible()
    await expect(calendar.getByRole('link')).toHaveCount(4)

    // A course page still has every exam.
    await page.getByRole('link', { name: /Anatomi Vize/ }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Anatomi' })).toBeVisible()
    expect(errors).toEqual([])
  })

  test('exams can be exported to the phone calendar', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Örnek notla dene' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Öğrenme ve bellek' })).toBeVisible()
    await page.goto('/sinav')
    const download = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Telefon takvimine ekle' }).click()
    const file = await download
    expect(file.suggestedFilename()).toBe('studymode-sinavlar.ics')
    const text = (await (await file.createReadStream()).toArray()).map(String).join('')
    expect(text).toContain('BEGIN:VEVENT')
    expect(text).toContain('Psikolojiye Giriş (örnek) · Vize')
    expect(text).toContain(`DTSTART;VALUE=DATE:${isoDaysFromNow(7).replaceAll('-', '')}`)
  })

  test('Today says which exam to start with and leads to the next step', async ({ page }) => {
    const errors = watchErrors(page)
    await page.goto('/')
    await page.getByRole('button', { name: 'Örnek notla dene' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Öğrenme ve bellek' })).toBeVisible()
    await page.goto('/')
    const focus = page.getByRole('region', { name: 'Şimdi bununla başla' })
    await expect(focus).toContainText('Psikolojiye Giriş (örnek) vizesine 7 gün kaldı')
    await expect(focus).toContainText('Hazırlığın: %')
    await expect(focus).toContainText('Öğrenme ve bellek')
    await focus.getByRole('link').click()
    await expect(page.getByRole('heading', { level: 1, name: 'Öğrenme ve bellek' })).toBeVisible()
    expect(errors).toEqual([])
  })
})

test.describe('sharing a course with a friend', () => {
  const SUPABASE = 'https://jpcatyopkpnudgdyncas.supabase.co'
  const TOKEN = 'AbCdEfGhIjKlMnOpQrStUv'
  const snapshot = {
    v: 1,
    course: { name: 'Anatomi', color: '#e5484d' },
    notes: [
      {
        title: 'Kemikler',
        content: 'Kemik dokusu ...',
        summary: { overview: 'Kemiklerin yapısı', points: ['Uzun kemikler'], keyTerms: [{ term: 'Osteon', definition: 'Kemiğin yapı birimi' }] },
        questions: [{ prompt: 'Kemiğin yapı birimi nedir?', options: ['Osteon', 'Nöron', 'Nefron', 'Sarkomer'], answerIndex: 0, explanation: 'Osteon.', source: null }],
        practice: [{ question: 'Kemik dokusunu anlat.', answer: 'Model cevap', hint: null }],
        generator: 'ai',
      },
      { title: 'Kaslar', content: 'Kas dokusu ...', summary: null, questions: [], practice: [], generator: null },
    ],
    cards: [
      { front: 'Osteon nedir?', back: 'Kemiğin yapı birimi', source: null, note: 0 },
      { front: 'Sarkomer nedir?', back: 'Kasın kasılma birimi', source: null, note: 1 },
    ],
    exams: [{ kind: 'vize', title: null, date: isoDaysFromNow(9), weight: 40, notes: [] }],
  }

  test('a friend previews the link and copies the course into their own list', async ({ page }) => {
    const errors = watchErrors(page)
    let asked = ''
    await page.route(`${SUPABASE}/rest/v1/rpc/get_course_share**`, async (route) => {
      asked = route.request().postDataJSON().share_token
      await route.fulfill({ json: [{ title: 'Anatomi', owner_name: 'Ayşe Yılmaz', snapshot, updated_at: new Date().toISOString() }] })
    })
    await page.goto(`/paylas/${TOKEN}`)
    await expect(page.getByText('Ayşe Yılmaz seninle bir ders paylaştı')).toBeVisible()
    expect(asked).toBe(TOKEN)
    await expect(page.getByRole('heading', { level: 1, name: 'Anatomi' })).toBeVisible()
    await expect(page.getByText('2 not', { exact: true })).toBeVisible()
    await expect(page.getByText('2 kart', { exact: true })).toBeVisible()
    await expect(page.getByText('Kemikler')).toBeVisible()
    await expect(page.getByText(/Hesapsız eklersen/)).toBeVisible()

    await page.getByRole('button', { name: 'Derslerime ekle' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Anatomi' })).toBeVisible()
    await expect(page.getByText('Anatomi derslerine eklendi')).toBeVisible()
    await expect(page.getByText('Vizeye 9 gün').first()).toBeVisible()
    await page.getByRole('link', { name: /Kemikler/ }).first().click()
    await expect(page.getByRole('heading', { level: 1, name: 'Kemikler' })).toBeVisible()

    // The copy starts fresh: both cards are due now, and nothing of the owner's progress came along.
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('studymode.data.v2') || '{}'))
    expect(stored.cards).toHaveLength(2)
    expect(stored.cards.every((c: { reps: number; lapses: number }) => c.reps === 0 && c.lapses === 0)).toBe(true)
    expect(stored.courseExams).toHaveLength(1)

    // Opening the link again says it is already added.
    await page.goto(`/paylas/${TOKEN}`)
    await expect(page.getByText('Bu dersi daha önce ekledin.')).toBeVisible()
    await page.getByRole('link', { name: 'Derse git' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Anatomi' })).toBeVisible()
    expect(errors).toEqual([])
  })

  test('a closed link, and a database without sharing yet, explain themselves', async ({ page }) => {
    await page.route(`${SUPABASE}/rest/v1/rpc/get_course_share**`, (route) => route.fulfill({ json: [] }))
    await page.goto(`/paylas/${TOKEN}`)
    await expect(page.getByText('Bu bağlantı çalışmıyor')).toBeVisible()

    await page.unroute(`${SUPABASE}/rest/v1/rpc/get_course_share**`)
    await page.route(`${SUPABASE}/rest/v1/rpc/get_course_share**`, (route) =>
      route.fulfill({ status: 404, json: { code: 'PGRST202', message: 'Could not find the function', details: null, hint: null } }),
    )
    await page.reload()
    await expect(page.getByText(/veritabanı güncellemesi bekleniyor/)).toBeVisible()

    await page.goto('/paylas/kisa')
    await expect(page.getByText('Bu bağlantı çalışmıyor')).toBeVisible()
  })

  test('guests are asked to sign in before creating a link', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Örnek notla dene' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Öğrenme ve bellek' })).toBeVisible()
    await page.goto('/dersler')
    await page.getByRole('link', { name: /Psikolojiye Giriş/ }).click()
    await page.getByRole('button', { name: 'Paylaş' }).click()
    const dialog = page.getByRole('dialog', { name: 'Dersi paylaş' })
    await expect(dialog.getByText(/Senin ilerlemen, yazılı cevapların ve puanların paylaşılmaz/)).toBeVisible()
    await expect(dialog.getByText(/giriş yapman gerekiyor/)).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Bağlantı oluştur' })).toHaveCount(0)
  })

  test('a signed-in owner creates a link with a QR code, updates it and closes it', async ({ page }) => {
    const errors = watchErrors(page)
    const user = { id: 'aaaaaaaa-0000-0000-0000-000000000001', aud: 'authenticated', role: 'authenticated', email: 'ayse@example.com', user_metadata: { full_name: 'Ayşe Yılmaz', first_name: 'Ayşe' }, app_metadata: {}, created_at: '2026-10-01T00:00:00Z' }
    await page.addInitScript((u) => {
      localStorage.setItem(
        'sb-jpcatyopkpnudgdyncas-auth-token',
        JSON.stringify({ access_token: 'fake', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'r', user: u }),
      )
    }, user)
    const T = '2026-10-01T00:00:00Z'
    const course = { id: 'cccccccc-0000-0000-0000-000000000001', user_id: user.id, name: 'Anatomi', color: '#e5484d', exam_date: null, created_at: T, updated_at: T }
    const note = { id: 'dddddddd-0000-0000-0000-000000000001', user_id: user.id, course_id: course.id, title: 'Kemikler', content: 'Kemik dokusu', summary: { overview: 'Özet', points: ['a'], keyTerms: [], completedSteps: ['tanis'] }, questions: [], practice: [{ id: 'p1', question: 'Anlat', answer: null, hint: null, draft: 'GİZLİ TASLAK' }], generator: 'ai', created_at: T, updated_at: T }
    let shares: Array<Record<string, unknown>> = []
    let inserted: Record<string, unknown> | null = null
    let patched = false
    await page.route(`${SUPABASE}/auth/v1/**`, (route) => route.fulfill({ json: user }))
    await page.route(`${SUPABASE}/rest/v1/**`, async (route) => {
      const req = route.request()
      const table = new URL(req.url()).pathname.split('/').pop()
      const single = (req.headers()['accept'] ?? '').includes('vnd.pgrst.object')
      if (table === 'course_shares') {
        if (req.method() === 'GET') return route.fulfill({ json: shares })
        if (req.method() === 'POST') {
          inserted = req.postDataJSON()
          const row = { id: 'ssssssss-0000-0000-0000-000000000001', token: inserted!.token, created_at: T, updated_at: T }
          shares = [row]
          return route.fulfill({ status: 201, json: single ? row : [row] })
        }
        if (req.method() === 'PATCH') {
          patched = true
          const row = { ...shares[0], updated_at: new Date().toISOString() }
          return route.fulfill({ json: single ? row : [row] })
        }
        if (req.method() === 'DELETE') {
          shares = []
          return route.fulfill({ status: 204, body: '' })
        }
      }
      if (req.method() === 'GET') return route.fulfill({ json: table === 'courses' ? [course] : table === 'notes' ? [note] : [] })
      return route.fulfill({ status: 201, json: [] })
    })

    await page.goto(`/ders/${course.id}`)
    await expect(page.getByRole('heading', { level: 1, name: 'Anatomi' })).toBeVisible()
    await page.getByRole('button', { name: 'Paylaş' }).click()
    const dialog = page.getByRole('dialog', { name: 'Dersi paylaş' })
    await expect(dialog.getByText(/Bağlantıya sahip olan herkes/)).toBeVisible()
    await dialog.getByRole('button', { name: 'Bağlantı oluştur' }).click()

    const link = dialog.getByLabel('Paylaşım bağlantısı', { exact: true })
    await expect(link).toHaveValue(/\/paylas\/[A-Za-z0-9]{22}$/)
    await expect(dialog.getByRole('img', { name: 'Paylaşım bağlantısının QR kodu' })).toBeVisible()
    // What went to the server: content and the owner's name, never progress, drafts or the email.
    expect(inserted!.course_id).toBe(course.id)
    expect(inserted!.owner_name).toBe('Ayşe Yılmaz')
    const sent = JSON.stringify(inserted!.snapshot)
    expect(sent).toContain('Kemikler')
    for (const secret of ['GİZLİ TASLAK', 'completedSteps', 'ayse@example.com']) expect(sent).not.toContain(secret)
    expect(JSON.stringify(inserted)).not.toContain('ayse@example.com')

    await dialog.getByRole('button', { name: /şimdiki hâliyle güncelle/ }).click()
    await expect(page.getByText('Bağlantı güncellendi')).toBeVisible()
    expect(patched).toBe(true)

    await dialog.getByRole('button', { name: 'Paylaşımı kapat' }).click()
    await expect(page.getByText(/Paylaşım kapatıldı/)).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Bağlantı oluştur' })).toBeVisible()
    expect(errors).toEqual([])
  })
})

test("the maker's signature is on the landing page, the sidebar and in Settings with social links", async ({ page }) => {
  const errors = watchErrors(page)
  await page.goto('/tanitim')
  await expect(page.getByRole('contentinfo').getByRole('link', { name: 'Made by JustFurkan' })).toHaveAttribute('href', '/hakkinda')
  await page.goto('/ayarlar')
  await expect(page.getByRole('complementary', { name: 'Ana menü' }).getByRole('link', { name: 'Made by JustFurkan' })).toBeVisible()
  const about = page.getByRole('region', { name: 'Hakkında' })
  await expect(about).toContainText('JustFurkan')
  await expect(about).toContainText("StudyMode'u kendi sınav dönemim için yaptım")
  await expect(about.getByRole('link', { name: "Instagram'dan yaz" })).toHaveAttribute('href', 'https://www.instagram.com/furkann_ztrk')
  const links = about.getByRole('list', { name: 'JustFurkan sosyal medya hesapları' }).getByRole('link')
  await expect(links).toHaveCount(6)
  await expect(about.getByRole('link', { name: 'LinkedIn: M. Furkan Öztürk' })).toHaveAttribute('href', 'https://www.linkedin.com/in/m-furkan-%C3%B6zt%C3%BCrk-43bb933a8')
  await expect(about.getByRole('link', { name: 'X: @furkan_ztrk_' })).toHaveAttribute('href', 'https://x.com/furkan_ztrk_')
  await expect(about.getByRole('link', { name: 'TikTok: @justfurkann_' })).toHaveAttribute('href', 'https://www.tiktok.com/@justfurkann_')
  await expect(about.getByRole('link', { name: 'YouTube: @justfurkann' })).toHaveAttribute('href', 'https://www.youtube.com/@justfurkann')
  await expect(about.getByRole('link', { name: 'GitHub: justfurkann' })).toHaveAttribute('target', '_blank')
  await expect(about.getByRole('img', { name: 'JustFurkan profil resmi' })).toBeVisible()
  // On a phone there is no sidebar: the signature sits at the bottom of every page instead.
  await page.setViewportSize({ width: 375, height: 812 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false)
  await page.goto('/dersler')
  const mobileSign = page.getByRole('main').getByRole('link', { name: 'Made by JustFurkan' })
  await mobileSign.scrollIntoViewIfNeeded()
  await expect(mobileSign).toBeVisible()
  expect(errors).toEqual([])
})

test('the maker page: Made by leads there, socials, and two small secrets', async ({ page }) => {
  const errors = watchErrors(page)
  await page.goto('/ayarlar')
  await page.getByRole('complementary', { name: 'Ana menü' }).getByRole('link', { name: 'Made by JustFurkan' }).click()
  await expect(page).toHaveURL(/\/hakkinda$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Selam, ben JustFurkan' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Instagram: @furkann_ztrk' })).toHaveAttribute('href', 'https://www.instagram.com/furkann_ztrk')
  await expect(page.getByRole('list', { name: 'JustFurkan sosyal medya hesapları' }).getByRole('link')).toHaveCount(6)

  // "Burayı nasıl buldun?"
  await page.getByRole('button', { name: 'Ayarları kurcalarken' }).click()
  await expect(page.getByText(/gerçek bir meraklısın/)).toBeVisible()
  await page.getByRole('button', { name: 'Tesadüfen' }).click()
  await expect(page.getByText('Tesadüf diye bir şey yok. Bu sayfa seni bekliyordu.')).toBeVisible()

  // Five taps on the photo unlock a hidden achievement.
  const photo = page.getByRole('button', { name: 'JustFurkan profil resmi' })
  for (let i = 0; i < 4; i++) await photo.click()
  await expect(page.getByText(/Gizli başarım/)).toHaveCount(0)
  await photo.click()
  await expect(page.getByText(/Gizli başarım açıldı/)).toBeVisible()

  // The Turkish spelling of the address works too, and the page fits a phone.
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/hakk%C4%B1nda')
  await expect(page.getByRole('heading', { level: 1, name: 'Selam, ben JustFurkan' })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false)
  await page.getByRole('link', { name: 'Uygulamaya git' }).click()
  await expect(page).not.toHaveURL(/hakk/)
  expect(errors).toEqual([])
})

test('opening another page starts at its top, not where the last page was scrolled', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 700 })
  await page.goto('/ayarlar')
  const sign = page.getByRole('main').getByRole('link', { name: 'Made by JustFurkan' })
  await sign.scrollIntoViewIfNeeded()
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(300)
  await sign.click()
  await expect(page.getByRole('heading', { level: 1, name: 'Selam, ben JustFurkan' })).toBeInViewport()
  expect(await page.evaluate(() => window.scrollY)).toBe(0)
})

test('feedback goes straight to the maker, from Settings and from the bottom of every page', async ({ page }) => {
  const errors = watchErrors(page)
  const sent: Array<Record<string, unknown>> = []
  await page.route('https://jpcatyopkpnudgdyncas.supabase.co/rest/v1/feedback**', async (route) => {
    sent.push(route.request().postDataJSON())
    await route.fulfill({ status: 201, body: '' })
  })
  await page.goto('/ayarlar')
  await page.getByRole('region', { name: 'Geri bildirim' }).getByRole('button', { name: 'Geri bildirim gönder' }).click()
  const dialog = page.getByRole('dialog', { name: 'Fikrin mi var, hata mı buldun?' })
  await dialog.getByRole('button', { name: 'Hata' }).click()
  await expect(dialog.getByRole('button', { name: 'Gönder' })).toBeDisabled()
  await dialog.getByLabel('Mesajın').fill('Sınav sekmesinde tarih seçerken ekran kaydı.')
  await dialog.getByLabel(/Sana nasıl dönelim/).fill('@birarkadas')
  await dialog.getByRole('button', { name: 'Gönder' }).click()
  await expect(dialog.getByText(/Teşekkürler!/)).toBeVisible()
  expect(sent).toHaveLength(1)
  expect(sent[0]).toMatchObject({ kind: 'hata', message: 'Sınav sekmesinde tarih seçerken ekran kaydı.', contact: '@birarkadas', page: '/ayarlar' })
  expect(String(sent[0].device)).toContain('x')
  await dialog.getByRole('button', { name: 'Kapat', exact: true }).last().click()

  // A second message right away is held back for a few seconds.
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/dersler')
  const link = page.getByRole('main').getByRole('button', { name: 'Fikir · Hata bildir' })
  await link.scrollIntoViewIfNeeded()
  await link.click()
  await page.getByLabel('Mesajın').fill('Bir fikir daha')
  await page.getByRole('button', { name: 'Gönder' }).click()
  await expect(page.getByText(/Az önce gönderdin/)).toBeVisible()
  expect(sent).toHaveLength(1)
  expect(errors).toEqual([])
})

test('after a new deploy, a missing app file explains itself instead of a raw error', async ({ page }) => {
  // Simulate an old tab: the lazily loaded AI code is gone from the server.
  await page.route('**/src/lib/ai/index.ts*', (route) => route.abort())
  await page.goto('/ayarlar')
  await page.getByRole('button', { name: 'ChatGPT' }).click()
  await page.getByLabel(/API anahtarı/).fill('sk-test-1234567890')
  await page.getByRole('button', { name: 'Doğrula ve kaydet' }).click()
  await expect(page.getByText(/Uygulamanın yeni bir sürümü yayınlandı/)).toBeVisible()
  await expect(page.getByText(/Failed to fetch dynamically imported module/)).toHaveCount(0)
  await expect(page.getByRole('status').filter({ hasText: 'Uygulamanın yeni sürümü hazır.' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Yenile' })).toBeVisible()
})

test('each service shows its full list of models, plus any other model by name', async ({ page }) => {
  await page.goto('/ayarlar')
  await page.getByRole('button', { name: 'ChatGPT' }).click()
  const model = page.getByRole('combobox', { name: 'Model' })
  await expect(model.locator('option')).toHaveText(['GPT-5 mini — dengeli', 'GPT-5 — en kaliteli', 'GPT-5 nano — en ucuz', 'Başka bir model (adını yaz)'])
  await model.selectOption('gpt-5')
  await page.getByRole('button', { name: 'Claude' }).click()
  await expect(page.getByRole('combobox', { name: 'Model' }).locator('option')).toHaveCount(4)
  await page.getByRole('button', { name: 'ChatGPT' }).click()
  await expect(page.getByRole('combobox', { name: 'Model' })).toHaveValue('gpt-5')
  await page.getByRole('combobox', { name: 'Model' }).selectOption({ label: 'Başka bir model (adını yaz)' })
  await page.getByLabel('Model adı').fill('gpt-6-preview')
  await page.reload()
  await page.getByRole('button', { name: 'ChatGPT' }).click()
  await expect(page.getByLabel('Model adı')).toHaveValue('gpt-6-preview')
})
