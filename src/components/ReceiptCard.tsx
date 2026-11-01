import { receiptLayout } from '../lib/receiptLayout'
import { Download, Share2, Sparkles, User } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { unlock } from '../lib/achievements'
import { displayName } from '../lib/auth'
import { educationLabel, useEducation } from '../lib/education'
import { readRecords } from '../lib/mola'
import {
  buildReceipt,
  MOOD_PRESETS,
  readReceiptPrefs,
  RECEIPT_THEMES,
  saveReceiptPrefs,
  type Receipt,
  type ReceiptPeriod,
  type ReceiptPrefs,
  type ReceiptThemeId,
} from '../lib/receipt'
import { useStore } from '../lib/store'
import { useStudentResult } from '../lib/studentProfile'
import { TYPES } from '../lib/studentType'
import { Modal } from './ui'

/*
 * "Çalışma fişi": a personalized thermal study receipt drawn on a 1080×1920 story canvas
 * so students can customize their name, department/tag, motto, and visual theme, and save
 * or share it directly to Instagram / WhatsApp stories.
 */

const W = 1080
const H = 1920
const SANS = '"Figtree Variable", system-ui, sans-serif'
const MONO = '"JetBrains Mono", "IBM Plex Mono", "SFMono-Regular", Consolas, monospace'

interface ThemePalette {
  deskBg: string
  deskGrid: string
  deskGlow: string
  paperBg: string
  paperAlt: string
  ink: string
  inkMuted: string
  border: string
  hi: string
  onHi: string
  stamp: string
  tape: string
}

const PALETTES: Record<ReceiptThemeId, ThemePalette> = {
  klasik: {
    deskBg: '#141938',
    deskGrid: 'rgba(255, 255, 255, 0.055)',
    deskGlow: 'rgba(255, 225, 77, 0.14)',
    paperBg: '#fbfaf4',
    paperAlt: '#f2f0e6',
    ink: '#181c32',
    inkMuted: '#565c7a',
    border: '#181c32',
    hi: '#ffe14d',
    onHi: '#181c32',
    stamp: '#253da1',
    tape: 'rgba(255, 225, 77, 0.82)',
  },
  gece: {
    deskBg: '#090c18',
    deskGrid: 'rgba(127, 240, 184, 0.06)',
    deskGlow: 'rgba(127, 240, 184, 0.15)',
    paperBg: '#13182e',
    paperAlt: '#1b2240',
    ink: '#f4f6ff',
    inkMuted: '#9aa5cc',
    border: '#364375',
    hi: '#7ff0b8',
    onHi: '#0d1326',
    stamp: '#7ff0b8',
    tape: 'rgba(127, 240, 184, 0.78)',
  },
  espresso: {
    deskBg: '#211713',
    deskGrid: 'rgba(255, 236, 209, 0.055)',
    deskGlow: 'rgba(245, 185, 66, 0.14)',
    paperBg: '#f8f2e7',
    paperAlt: '#ede3d2',
    ink: '#281a12',
    inkMuted: '#6e5648',
    border: '#281a12',
    hi: '#f5b942',
    onHi: '#281a12',
    stamp: '#8c3b1f',
    tape: 'rgba(245, 185, 66, 0.82)',
  },
  pembe: {
    deskBg: '#231326',
    deskGrid: 'rgba(255, 159, 207, 0.06)',
    deskGlow: 'rgba(255, 159, 207, 0.16)',
    paperBg: '#fff8fb',
    paperAlt: '#fcebf3',
    ink: '#29142b',
    inkMuted: '#734f78',
    border: '#29142b',
    hi: '#ff9fcf',
    onHi: '#29142b',
    stamp: '#b82572',
    tape: 'rgba(255, 159, 207, 0.85)',
  },
}

function seeded(seed: string) {
  let s = Number(seed) >>> 0 || 1
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s / 4294967296
  }
}

function penColor(): string {
  try {
    return getComputedStyle(document.documentElement).getPropertyValue('--hi').trim() || '#ffe14d'
  } catch {
    return '#ffe14d'
  }
}

function wrapTextByWidth(g: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean).flatMap(word => {
    const parts: string[] = []
    let part = ''
    for (const char of word) {
      if (part && g.measureText(part + char).width > maxWidth) { parts.push(part); part = '' }
      part += char
    }
    if (part) parts.push(part)
    return parts
  })
  if (!words.length) return []
  const out: string[] = []
  let line = words[0]
  for (let i = 1; i < words.length; i++) {
    const candidate = `${line} ${words[i]}`
    if (g.measureText(candidate).width <= maxWidth) {
      line = candidate
    } else {
      out.push(line)
      line = words[i]
    }
  }
  if (line) out.push(line)
  return out
}

/** Draw one continuous print area so every line, including the footer, stays on paper. */
export function drawReceipt(receipt: Receipt, pen = penColor(), logo?: CanvasImageSource): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = W; canvas.height = H
  const g = canvas.getContext('2d')
  if (!g) return canvas
  const base = PALETTES[receipt.theme ?? 'klasik'] ?? PALETTES.klasik
  const palette = { ...base, hi: receipt.theme === 'klasik' && pen ? pen : base.hi }
  const paperWidth = 780
  const pad = 64
  const inner = paperWidth - pad * 2
  const left = (W - paperWidth) / 2
  const muted = palette.inkMuted
  const rng = seeded(receipt.code)
  const fit = (text: string, width: number) => {
    if (g.measureText(text).width <= width) return text
    let out = text
    while (out.length && g.measureText(out + '…').width > width) out = out.slice(0, -1)
    return out + '…'
  }
  // Repeat counts and focus time have their own headline; avoid printing them twice.
  const detail = receipt.lines.filter(l => !['ÇEVRİLEN KART', 'ODAK SÜRESİ', 'SERİ'].includes(l.label))
  const lines = detail.length ? detail : receipt.fallbackCourses.map(label => ({ qty: '', label, value: 'HAZIRLIK' }))
  const note = receipt.customMotto || receipt.verdict
  g.font = `500 28px ${SANS}`
  const noteLines = wrapTextByWidth(g, note, inner - 132)
  const layout = receiptLayout(Math.max(1, lines.length), noteLines.length)
  const top = (H - layout.height * layout.scale) / 2 - 24

  // A quiet desk surface; a little texture gives the paper somewhere to sit.
  g.fillStyle = palette.deskBg; g.fillRect(0, 0, W, H)
  const light = g.createRadialGradient(W * .5, H * .42, 50, W * .5, H * .42, 1000)
  light.addColorStop(0, palette.deskGlow); light.addColorStop(1, 'transparent')
  g.fillStyle = light; g.fillRect(0, 0, W, H)
  g.strokeStyle = palette.deskGrid; g.lineWidth = 1; g.globalAlpha = .45
  for (let x = 0; x < W; x += 72) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke() }
  for (let y = 0; y < H; y += 72) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke() }
  g.globalAlpha = 1
  g.save()
  g.translate(W / 2, top); g.rotate(-.012); g.scale(layout.scale, layout.scale); g.translate(-W / 2, 0)

  // Fine serration and soft shadow, without a heavy outline around the paper.
  const tooth = 10
  g.beginPath(); g.moveTo(left, tooth)
  for (let x = left; x < left + paperWidth; x += tooth * 2) {
    g.lineTo(x + tooth, 0); g.lineTo(Math.min(x + tooth * 2, left + paperWidth), tooth)
  }
  g.lineTo(left + paperWidth, layout.height - tooth)
  for (let x = left + paperWidth; x > left; x -= tooth * 2) {
    g.lineTo(x - tooth, layout.height); g.lineTo(Math.max(x - tooth * 2, left), layout.height - tooth)
  }
  g.closePath()
  g.shadowColor = '#00000050'; g.shadowBlur = 48; g.shadowOffsetY = 18
  g.fillStyle = palette.paperBg; g.fill(); g.shadowColor = 'transparent'
  g.save(); g.clip()
  g.fillStyle = palette.ink; g.globalAlpha = .025
  for (let i = 0; i < 4500; i++) g.fillRect(left + rng() * paperWidth, rng() * layout.height, .9, .9)
  g.restore()

  const x = left + pad, right = left + paperWidth - pad
  const rule = (y: number, dashed = false) => {
    g.save(); g.strokeStyle = palette.border; g.globalAlpha = .22; g.lineWidth = 1
    if (dashed) g.setLineDash([5, 7])
    g.beginPath(); g.moveTo(x, y); g.lineTo(right, y); g.stroke(); g.restore()
  }
  // Approved brand artwork is drawn at its original aspect ratio.
  if (logo) g.drawImage(logo, x, 64, 274, 274 * 284 / 1298)
  else { g.font = `800 40px ${SANS}`; g.fillStyle = palette.ink; g.fillText('studymode', x, 108) }
  g.textAlign = 'right'; g.font = `400 19px ${MONO}`; g.fillStyle = muted
  g.fillText(receipt.date, right, 87); g.fillText(receipt.time, right, 116)
  rule(154)
  g.textAlign = 'left'; g.font = `500 21px ${MONO}`; g.fillStyle = muted
  g.fillText(receipt.title, x, 199)
  g.font = `700 42px ${SANS}`; g.fillStyle = palette.ink
  g.fillText(fit(receipt.studentName || (receipt.empty ? 'Bir yerden başlıyoruz.' : 'Bugün kendine zaman ayırdın.'), inner), x, 260)
  g.font = `400 23px ${SANS}`; g.fillStyle = muted
  g.fillText(fit(receipt.studentTag || receipt.register.replace('#', '').replaceAll('-', ' '), inner), x, 300)

  const metric = (mx: number, value: string, unit: string, label: string, available: number) => {
    g.font = `400 30px ${SANS}`
    const unitWidth = g.measureText(unit).width
    let size = 96
    g.font = `600 ${size}px ${SANS}`
    while (size > 32 && g.measureText(value).width + unitWidth + 10 > available) {
      size -= 4; g.font = `600 ${size}px ${SANS}`
    }
    g.fillStyle = palette.ink; g.textAlign = 'left'
    g.fillText(value, mx, 442)
    const width = g.measureText(value).width
    g.font = `400 30px ${SANS}`; g.fillStyle = muted
    g.fillText(unit, mx + width + 10, 440)
    g.font = `400 21px ${MONO}`; g.fillText(label, mx, 484)
  }
  metric(x, String(receipt.stats.focusMinutes), 'dk', 'ODAK SÜRESİ', 330)
  metric(x + 365, String(receipt.stats.reviews), 'kart', 'KART TEKRARI', inner - 365)
  // A single marker stroke anchors the headline, instead of four statistic boxes.
  g.fillStyle = palette.hi; g.globalAlpha = .75; g.fillRect(x, 505, 60, 5); g.globalAlpha = 1
  g.font = `400 23px ${SANS}`; g.fillStyle = muted
  g.fillText(`Test ort. ${receipt.stats.testAvg === null ? '—' : `%${receipt.stats.testAvg}`}`, x, 562)
  g.textAlign = 'right'; g.fillText(`${receipt.stats.streak} günlük seri`, right, 562)
  rule(596, true)
  g.font = `400 18px ${MONO}`; g.fillStyle = muted; g.textAlign = 'left'
  g.fillText(receipt.title.startsWith('HAFTALIK') ? 'HAFTANIN DÖKÜMÜ' : 'BUGÜNÜN DÖKÜMÜ', x, 625); g.textAlign = 'right'; g.fillText('KARŞILIĞI', right, 625)
  if (!lines.length) {
    g.textAlign = 'left'; g.font = `400 24px ${SANS}`
    g.fillText('İlk oturumunla burası dolacak.', x, layout.tableTop)
  }
  lines.forEach((item, i) => {
    const y = layout.tableTop + i * 48
    g.font = `500 24px ${MONO}`
    const value = fit(item.value, 210)
    const valueWidth = g.measureText(value).width
    const label = fit(`${item.qty ? `${item.qty}  ` : ''}${item.label}`, inner - valueWidth - 40)
    const labelWidth = g.measureText(label).width
    g.fillStyle = palette.ink; g.textAlign = 'left'; g.fillText(label, x, y)
    g.textAlign = 'right'; g.fillText(value, right, y)
    if (inner - valueWidth - labelWidth > 70) {
      g.save(); g.strokeStyle = muted; g.globalAlpha = .3; g.setLineDash([1, 7]); g.lineWidth = 1.5
      g.beginPath(); g.moveTo(x + labelWidth + 18, y - 6); g.lineTo(right - valueWidth - 18, y - 6); g.stroke(); g.restore()
    }
  })
  rule(layout.tableBottom, true)
  const y = layout.totalTop
  g.fillStyle = palette.hi; g.globalAlpha = receipt.theme === 'gece' ? .16 : .32
  g.fillRect(x - 10, y, inner + 20, 80); g.globalAlpha = 1
  g.fillStyle = palette.ink; g.textAlign = 'left'; g.font = `500 22px ${MONO}`
  g.fillText(receipt.total.label, x + 12, y + 49)
  g.textAlign = 'right'; g.font = `600 36px ${SANS}`; g.fillText(receipt.total.value, right - 12, y + 51)

  g.textAlign = 'left'; g.font = `400 18px ${MONO}`; g.fillStyle = muted
  g.fillText(receipt.customMotto ? 'GÜNÜN NOTU' : 'KASADAN BİR NOT', x, layout.noteTop)
  g.font = `500 28px ${SANS}`; g.fillStyle = palette.ink
  noteLines.forEach((line, i) => g.fillText(line, x, layout.noteTop + 43 + i * 34))
  // Small, lightly inked stamp: a keepsake detail, not a second headline.
  g.save(); g.translate(right - 42, layout.noteTop + 46); g.rotate(-.18)
  g.strokeStyle = palette.stamp; g.fillStyle = palette.stamp; g.globalAlpha = .65; g.lineWidth = 1.7
  g.beginPath(); g.arc(0, 0, 40, 0, Math.PI * 2); g.stroke()
  g.textAlign = 'center'; g.font = `500 11px ${MONO}`; g.fillText('BİR ADIM', 0, -4); g.fillText('DAHA', 0, 13); g.restore()

  const codeRng = seeded(receipt.code)
  const barcodeWidth = 320
  let bx = W / 2 - barcodeWidth / 2
  g.fillStyle = palette.ink; g.globalAlpha = .8
  while (bx < W / 2 + barcodeWidth / 2 - 6) {
    const bar = 1 + Math.floor(codeRng() * 3)
    if (codeRng() > .24) g.fillRect(bx, layout.barcodeTop, bar, 43)
    bx += bar + 2 + Math.floor(codeRng() * 3)
  }
  g.globalAlpha = 1; g.fillStyle = muted; g.font = `400 17px ${MONO}`; g.textAlign = 'center'
  g.fillText(receipt.code.split('').join(' '), W / 2, layout.serialY)
  g.font = `400 17px ${MONO}`; g.fillText(fit(receipt.footer, inner), W / 2, layout.footerY)
  g.restore()
  g.textAlign = 'center'; g.fillStyle = '#ffffff99'; g.font = `500 23px ${SANS}`
  g.fillText('studymode.fun', W / 2, H - 58)
  return canvas
}

export default function ReceiptDialog({ onClose }: { onClose: () => void }) {
  const { data, session } = useStore()
  const education = useEducation()
  const studentResult = useStudentResult()
  const [period, setPeriod] = useState<ReceiptPeriod>('gun')

  const defaultName = useMemo(() => displayName(session?.user) || '', [session])
  const defaultTag = useMemo(() => {
    if (education) return educationLabel(education)
    if (studentResult) {
      const found = TYPES[studentResult.type]
      if (found) return found.name
    }
    return ''
  }, [education, studentResult])

  const [prefs, setPrefs] = useState<ReceiptPrefs>(() => {
    const stored = readReceiptPrefs()
    return {
      studentName: stored.studentName || defaultName,
      studentTag: stored.studentTag || defaultTag,
      customMotto: stored.customMotto,
      theme: stored.theme,
    }
  })

  function updatePrefs(patch: Partial<ReceiptPrefs>) {
    setPrefs((prev) => {
      const next = { ...prev, ...patch }
      saveReceiptPrefs(next)
      return next
    })
  }

  const receipt = useMemo(
    () => buildReceipt(data, period, readRecords(), new Date(), prefs),
    [data, period, prefs],
  )

  useEffect(() => {
    unlock('fis')
  }, [])

  const [image, setImage] = useState<{ url: string; blob: Blob } | null>(null)

  useEffect(() => {
    let url = ''
    let cancelled = false
    // Canvas keeps the font it first draws with. Wait for the bundled font and
    // the approved logo so exported files match the preview on a cold load too.
    void (async () => {
      const logo = new Image()
      logo.src = receipt.theme === 'gece' ? '/brand/svg/logo-dark.svg' : '/brand/svg/logo.svg'
      const [, loadedLogo] = await Promise.all([
        document.fonts.load(`600 28px ${SANS}`).catch(() => []),
        logo.decode().then(() => logo).catch(() => undefined),
      ])
      if (cancelled) return
      drawReceipt(receipt, penColor(), loadedLogo).toBlob((blob) => {
        if (!blob || cancelled) return
        url = URL.createObjectURL(blob)
        setImage({ url, blob })
      }, 'image/png')
    })()
    return () => {
      cancelled = true
      if (url) URL.revokeObjectURL(url)
    }
  }, [receipt])

  const fileName = `studymode-fis-${period === 'gun' ? 'gunluk' : 'haftalik'}.png`
  const file = image ? new File([image.blob], fileName, { type: 'image/png' }) : null
  const canShare = !!file && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })

  async function share() {
    if (!file) return
    try {
      await navigator.share({ files: [file], text: 'Bugünkü çalışma fişim · studymode.fun' })
    } catch {
      // Closed the share sheet: nothing to do.
    }
  }

  return (
    <Modal title="Çalışma fişi" onClose={onClose}>
      <div className="receipt-dialog-grid">
        <div className="receipt-controls-col">
          <div className="segmented" role="group" aria-label="Fiş dönemi">
            <button type="button" aria-pressed={period === 'gun'} onClick={() => setPeriod('gun')}>
              Bugün
            </button>
            <button type="button" aria-pressed={period === 'hafta'} onClick={() => setPeriod('hafta')}>
              Bu hafta
            </button>
          </div>

          <div className="receipt-customizer">
            <div className="receipt-section-title">
              <User size={15} /> Fişi Kişiselleştir
            </div>
            <label className="field">
              <span>Fişteki İsim / Lâkap</span>
              <input
                className="input"
                value={prefs.studentName}
                onChange={(e) => updatePrefs({ studentName: e.target.value })}
                placeholder="Örn: Furkan Öztürk veya Gece Kuşu"
                maxLength={36}
              />
            </label>
            <label className="field">
              <span>Bölüm / Hedef / Unvan</span>
              <input
                className="input"
                value={prefs.studentTag}
                onChange={(e) => updatePrefs({ studentTag: e.target.value })}
                placeholder="Örn: Bilgisayar Müh. · 2. Sınıf / YKS Tayfa"
                maxLength={44}
              />
            </label>
            <label className="field">
              <span>Günün Notu / Modu</span>
              <input
                className="input"
                value={prefs.customMotto}
                onChange={(e) => updatePrefs({ customMotto: e.target.value })}
                placeholder="Örn: Kafeinle ayaktayız"
                maxLength={64}
              />
            </label>
            <div className="receipt-mood-chips" role="group" aria-label="Hazır durum notları">
              {MOOD_PRESETS.map((mood) => (
                <button
                  key={mood}
                  type="button"
                  className={`receipt-mood-chip ${prefs.customMotto === mood ? 'is-active' : ''}`}
                  onClick={() => updatePrefs({ customMotto: prefs.customMotto === mood ? '' : mood })}
                >
                  {mood}
                </button>
              ))}
            </div>
          </div>

          <div className="receipt-customizer">
            <div className="receipt-section-title">
              <Sparkles size={15} /> Fiş Teması
            </div>
            <div className="receipt-theme-grid" role="group" aria-label="Fiş teması">
              {RECEIPT_THEMES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className="receipt-theme-btn"
                  aria-pressed={prefs.theme === t.id}
                  onClick={() => updatePrefs({ theme: t.id })}
                >
                  <span className="receipt-theme-dot" style={{ background: t.swatch }} />
                  <span>{t.label}</span>
                </button>
              ))}
            </div>
          </div>

          <p className="subtle" style={{ fontSize: '0.8125rem', margin: 0 }}>
            Story boyutunda (1080×1920) yüksek çözünürlüklü PNG. Not içeriklerin fişte yer almaz; yalnızca seçtiğin kimlik ve çalışma istatistiklerin görünür.
          </p>

          <div className="btn-row" style={{ marginTop: 4 }}>
            {canShare && (
              <button type="button" className="btn btn-primary" onClick={share}>
                <Share2 size={18} /> Paylaş
              </button>
            )}
            <a
              className={`btn ${canShare ? '' : 'btn-primary'}`}
              href={image?.url}
              download={fileName}
              aria-disabled={!image}
            >
              <Download size={18} /> PNG indir
            </a>
          </div>
        </div>

        <div className="receipt-preview">
          {image ? (
            <img
              src={image.url}
              alt={`${prefs.studentName.trim() ? `${prefs.studentName.trim().toLocaleUpperCase('tr-TR')} · ` : ''}${receipt.title}: ${receipt.lines.map((l) => `${l.qty} ${l.label} ${l.value}`).join(', ')}. ${receipt.verdict}`}
            />
          ) : (
            <div className="receipt-loading" />
          )}
        </div>
      </div>
    </Modal>
  )
}
