import { expect, test } from '@playwright/test'

test('receipt artwork fits long personalized content in all four themes', async ({ page }) => {
  await page.goto('/ogrenci-tipi')
  const result = await page.evaluate(async () => {
    // Exercise the real browser font metrics and canvas, rather than a mocked renderer.
    const { drawReceipt } = await import('/src/components/ReceiptCard.tsx')
    const { receiptLayout } = await import('/src/lib/receiptLayout.ts')
    await document.fonts.load('600 28px "Figtree Variable"')
    const failures: string[] = []
    for (const theme of ['klasik', 'gece', 'espresso', 'pembe'] as const) {
      const logo = new Image()
      logo.src = theme === 'gece' ? '/brand/svg/logo-dark.svg' : '/brand/svg/logo.svg'
      await logo.decode()
      const note = 'ÇokUzunBirKelimeyleBaşlayanBirNotVeArdındanBirazDahaMetin'
      const rows = Array.from({ length: 12 }, (_, i) => ({ qty: '120x', label: `UZUN BİR DERS BAŞLIĞI ${i}`, value: '999 KART' }))
      const printed: Array<{ text: string; x: number; y: number; left: number; right: number }> = []
      const original = CanvasRenderingContext2D.prototype.fillText
      let paperTransform: DOMMatrix | undefined
      CanvasRenderingContext2D.prototype.fillText = function(text, x, y) {
        const width = this.measureText(text).width
        const left = this.textAlign === 'right' ? x - width : this.textAlign === 'center' ? x - width / 2 : x
        paperTransform ??= this.getTransform()
        const relative = paperTransform.inverse().multiply(this.getTransform())
        const a = relative.transformPoint(new DOMPoint(left, y))
        const b = relative.transformPoint(new DOMPoint(left + width, y))
        printed.push({ text, x, y: a.y, left: a.x, right: b.x })
        original.call(this, text, x, y)
      }
      let canvas: HTMLCanvasElement
      try {
        canvas = drawReceipt({ title: 'HAFTALIK ÇALIŞMA FİŞİ', date: '01.11.2026', time: 'GECE 02:30', register: '#VİZE-HAFTASI', studentName: 'UZUN BİR İSİM VE BİRDEN FAZLA SOYADI', studentTag: 'BİLGİSAYAR MÜHENDİSLİĞİ · SON SINIF', customMotto: note, theme, stats: { reviews: 999999, focusMinutes: 999999, testAvg: 100, streak: 365, courseCount: 12, effort: 123456 }, rank: { grade: 'S+', label: 'EFSANE MESAİ' }, lines: rows, fallbackCourses: [], total: { qty: '', label: 'TOPLAM EMEK', value: '123456 PUAN' }, verdict: 'DURUM: AZ AMA ÖZ', footer: 'FİŞİ SAKLAYINIZ, SINAVDA LAZIM OLUR', empty: false, code: '0123456789' }, undefined, logo)
      } finally { CanvasRenderingContext2D.prototype.fillText = original }
      const footer = printed.find(p => p.text === 'FİŞİ SAKLAYINIZ, SINAVDA LAZIM OLUR')!
      const printedNote = printed.filter(p => note.includes(p.text) && Math.abs(p.left - 214) < .1)
      const layout = receiptLayout(12, Math.max(1, printedNote.length))
      if (canvas.width !== 1080 || canvas.height !== 1920) failures.push(`${theme}: dimensions`)
      if (footer.y >= layout.height - 50) failures.push(`${theme}: footer outside paper`)
      for (const p of printed.filter(p => p.text !== 'studymode.fun')) {
        if (p.left < 210 || p.right > 870) failures.push(`${theme}: text outside margins: ${p.text}`)
      }
      // Keep a concrete artifact available for visual inspection without writing to the repo.
      if (theme === 'klasik') { document.body.replaceChildren(canvas); document.body.style.margin = '0' }
    }
    return failures
  })
  expect(result).toEqual([])
})

test('mobile receipt shows its preview first and keeps personalizing and download usable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await page.getByRole('button', { name: 'Örnek notla dene' }).click()
  await expect(page.getByRole('heading', { name: 'Öğrenme ve bellek', exact: true })).toBeVisible()
  await page.goto('/')
  await page.getByRole('button', { name: 'Çalışma fişi' }).click()
  const dialog = page.getByRole('dialog', { name: 'Çalışma fişi' })
  await expect(dialog.locator('.receipt-preview img')).toBeVisible()
  const positions = await dialog.evaluate(el => ({
    preview: el.querySelector('.receipt-preview')!.getBoundingClientRect().top,
    controls: el.querySelector('.receipt-controls-col')!.getBoundingClientRect().top,
    width: el.getBoundingClientRect().width,
  }))
  expect(positions.preview).toBeLessThan(positions.controls)
  expect(positions.width).toBeLessThanOrEqual(390)
  await dialog.getByLabel('Günün Notu / Modu').fill('Bugün küçük de olsa bir adım attım.')
  await dialog.getByRole('button', { name: 'Kampüs Pembe' }).click()
  await expect(dialog.locator('.receipt-preview img')).toBeVisible()
  const download = page.waitForEvent('download')
  await dialog.getByRole('link', { name: 'PNG indir' }).click()
  expect((await download).suggestedFilename()).toBe('studymode-fis-gunluk.png')
})
