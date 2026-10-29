import { expect, test, type Page } from '@playwright/test';
import { DEMO_NOTE } from '../src/lib/notes';
import { generateStudySet } from '../src/lib/study';

const biologyNotes = `Hücre Biyolojisi

Mitokondri: Hücresel solunum yoluyla hücrenin kullanabileceği enerjinin üretiminde görev alan organeldir. Hücrelerin enerji ihtiyacı işlevlerine göre değişebilir.

Ribozom: Genetik bilgiye göre amino asitleri birleştirerek protein sentezini gerçekleştiren hücresel yapıdır. Proteinler hücrede yapısal ve işlevsel görevler üstlenir.

Çekirdek: Ökaryot hücrelerde kalıtsal bilginin büyük bölümünü barındıran ve hücresel etkinliklerin düzenlenmesinde rol oynayan yapıdır. Genetik bilginin aktarılması canlılığın devamlılığı için gereklidir.

Lizozom: Hücre içi sindirimde görev alan enzimleri içeren ve bazı hücresel bileşenlerin parçalanmasını sağlayan organeldir. Hücresel atıkların işlenmesi hücre içi dengenin korunmasına katkı sağlar.

Hücre zarı: Hücreyi dış ortamdan ayıran ve madde alışverişini düzenleyen seçici geçirgen yapıdır. Hücreler çevreleriyle sürekli madde ve bilgi alışverişi yapar.`;

async function openUpload(page: Page) {
  await page.getByRole('button', { name: 'Yeni not ekle', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
}

async function pasteNote(page: Page) {
  await openUpload(page);
  await page.getByRole('tab', { name: 'Metin yapıştır' }).click();
  await page.getByRole('textbox', { name: 'Ders notun' }).fill(biologyNotes);
  await page.getByRole('textbox', { name: 'Not başlığı' }).fill('Hücre ve organeller');
  await page.getByRole('textbox', { name: /Ders adı/ }).fill('Biyoloji 101');
  await page.getByRole('button', { name: 'Çalışma setimi oluştur' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Hücre ve organeller' })).toBeVisible();
}

/** A genuine single-page PDF with an uncompressed text stream and valid xref. */
function makePdf(lines: string[]): Buffer {
  const escaped = lines.map(line => line.replace(/([\\()])/g, '\\$1'));
  const stream = `BT /F1 11 Tf 40 760 Td 16 TL\n${escaped.map(line => `(${line}) Tj T*`).join('\n')}\nET`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((body, index) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets.slice(1).map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('');
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf);
}

test('demo summary, quiz feedback and completed score persist', async ({ page }) => {
  const runtimeErrors: string[] = [];
  page.on('pageerror', error => runtimeErrors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Öğrenmeye yer aç.' })).toBeVisible();
  await page.getByRole('button', { name: 'Önce bir örneğe bak' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Öğrenme ve bellek' })).toBeVisible();
  await expect(page.locator('.summary-list li')).toHaveCount(generateStudySet(DEMO_NOTE.content).summary.length);
  await page.getByRole('tab', { name: /Mini test/ }).click();
  const questions = generateStudySet(DEMO_NOTE.content).quiz;
  expect(questions.length).toBeGreaterThan(0);
  for (const [index, question] of questions.entries()) {
    await expect(page.getByRole('button', { name: 'Cevabımı kontrol et' })).toBeDisabled();
    await page.getByRole('radio').nth(question.answerIndex).click();
    await page.getByRole('button', { name: 'Cevabımı kontrol et' }).click();
    await expect(page.locator('.answer-explanation')).toContainText('Evet, doğru hatırladın.');
    await expect(page.locator('.answer-explanation')).toContainText(question.explanation);
    await page.getByRole('button', { name: index === questions.length - 1 ? 'Sonucumu gör' : 'Sıradaki soru' }).click();
  }
  await expect(page.getByRole('heading', { name: 'Konu sende!' })).toBeVisible();
  await expect(page.locator('.result-score')).toContainText(`${questions.length}/${questions.length}`);
  await page.reload();
  await expect(page.locator('.stat').filter({ hasText: 'Tamamlanan test' })).toContainText('01');
  await expect(page.locator('.stat').filter({ hasText: 'Ortalama başarı' })).toContainText('%100');
  expect(runtimeErrors).toEqual([]);
});

test('pasted notes generate a set, persist, search and delete', async ({ page }) => {
  await page.goto('/');
  await pasteNote(page);
  await expect(page.locator('.summary-list')).toContainText('hücre');
  await page.getByRole('tab', { name: /Mini test/ }).click();
  await expect(page.getByRole('radio')).toHaveCount(4);
  await page.reload();
  await page.getByRole('button', { name: /^Notlarım/ }).click();
  await page.getByRole('textbox', { name: 'Notlarda ara' }).fill('biyoloji');
  await expect(page.getByRole('heading', { name: 'Hücre ve organeller' })).toBeVisible();
  await page.getByRole('textbox', { name: 'Notlarda ara' }).fill('matematik');
  await expect(page.getByText('Bu aramada not bulunamadı.')).toBeVisible();
  await page.getByRole('button', { name: 'Aramayı temizle' }).click();
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Hücre ve organeller notunu sil' }).click();
  await expect(page.getByRole('heading', { name: 'Hücre ve organeller' })).toHaveCount(0);
  await page.reload();
  await expect(page.locator('.stat').filter({ hasText: 'Çalışma notu' })).toContainText('00');
});

test('TXT file creates a usable study set and source view', async ({ page }) => {
  await page.goto('/');
  await openUpload(page);
  await page.getByLabel('Not dosyası').setInputFiles({ name: 'Biyoloji notlarım.txt', mimeType: 'text/plain', buffer: Buffer.from(biologyNotes) });
  await expect(page.getByRole('textbox', { name: 'Not başlığı' })).toHaveValue('Biyoloji notlarım');
  await page.getByRole('button', { name: 'Çalışma setimi oluştur' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Biyoloji notlarım' })).toBeVisible();
  await page.getByText('Kaynak notunu göster').click();
  await expect(page.locator('.source-note pre')).toContainText('Hücre zarı:');
});

test('real PDF text extraction produces a summary with local worker', async ({ page }) => {
  const remoteRequests: string[] = [];
  page.on('request', request => { if (/^https?:/.test(request.url()) && !request.url().startsWith('http://127.0.0.1:5173')) remoteRequests.push(request.url()); });
  await page.goto('/');
  await openUpload(page);
  const pdf = makePdf([
    'Physics Study Notes',
    'Energy: The capacity of a system to perform work or transfer heat.',
    'Velocity: The rate at which position changes over time in a direction.',
    'Force: An interaction that can change the motion of a physical body.',
    'Momentum: The quantity defined as the product of mass and velocity.',
    'Scientific models connect observations with measurable physical quantities.',
  ]);
  await page.getByLabel('Not dosyası').setInputFiles({ name: 'Physics notes.pdf', mimeType: 'application/pdf', buffer: pdf });
  await expect(page.getByRole('textbox', { name: 'Not başlığı' })).toHaveValue('Physics notes', { timeout: 15_000 });
  await expect(page.getByRole('alert')).toHaveCount(0);
  await page.getByRole('button', { name: 'Çalışma setimi oluştur' }).click();
  await expect(page.getByRole('heading', { name: 'Physics notes', level: 1 })).toBeVisible();
  await expect(page.locator('.summary-list')).toContainText('Energy:');
  await page.getByRole('tab', { name: /Mini test/ }).click();
  await expect(page.getByRole('radio')).toHaveCount(4);
  expect(remoteRequests).toEqual([]);
});

test('unsupported and corrupt files show useful errors without adding notes', async ({ page }) => {
  await page.goto('/');
  await openUpload(page);
  const input = page.getByLabel('Not dosyası');
  await input.setInputFiles({ name: 'scan.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('invalid') });
  await expect(page.getByRole('alert')).toContainText('PDF, TXT veya Markdown');
  await input.setInputFiles({ name: 'broken.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-broken') });
  await expect(page.getByRole('alert')).toContainText('PDF okunamadı');
  await expect(page.getByRole('button', { name: 'Çalışma setimi oluştur' })).toBeDisabled();
  await page.getByRole('button', { name: 'Pencereyi kapat' }).click();
  await expect(page.locator('.stat').filter({ hasText: 'Çalışma notu' })).toContainText('00');
});

test('short text fails validation and flashcards can be flipped', async ({ page }) => {
  await page.goto('/');
  await openUpload(page);
  await page.getByRole('tab', { name: 'Metin yapıştır' }).click();
  await page.getByRole('textbox', { name: 'Ders notun' }).fill('Çok kısa bir not.');
  await page.getByRole('textbox', { name: 'Not başlığı' }).fill('Kısa not');
  await page.getByRole('button', { name: 'Çalışma setimi oluştur' }).click();
  await expect(page.getByRole('alert')).toContainText('120');
  await page.getByRole('button', { name: 'Pencereyi kapat' }).click();
  await page.getByRole('button', { name: 'Önce bir örneğe bak' }).click();
  await page.getByRole('tab', { name: /Çalışma kartları/ }).click();
  await page.getByRole('button', { name: 'Kartın cevabını göster' }).click();
  await expect(page.getByRole('button', { name: 'Kartın sorusunu göster' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Sonraki kart' }).click();
  await expect(page.getByRole('button', { name: 'Kartın cevabını göster' })).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('.flashcard-controls')).toContainText('2 /');
});

test('mobile navigation, study view and upload fit viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Öğrenmeye yer aç.' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Menüyü aç' }).click();
  await page.getByRole('button', { name: 'Örnek çalışma seti', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Öğrenme ve bellek' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await openUpload(page);
  await expect(page.getByRole('dialog')).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
