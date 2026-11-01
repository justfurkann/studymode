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
const PAPER_W = 840
const SANS = '"Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
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
  const words = text.trim().split(/\s+/).filter(Boolean)
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

function roundRectPath(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath()
  g.moveTo(x + r, y)
  g.lineTo(x + w - r, y)
  g.quadraticCurveTo(x + w, y, x + w, y + r)
  g.lineTo(x + w, y + h - r)
  g.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  g.lineTo(x + r, y + h)
  g.quadraticCurveTo(x, y + h, x, y + h - r)
  g.lineTo(x, y + r)
  g.quadraticCurveTo(x, y, x + r, y)
  g.closePath()
}

/** Draws the personalized receipt and returns the 1080×1920 story canvas. */
export function drawReceipt(receipt: Receipt, pen = penColor()): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const g = canvas.getContext('2d')
  if (!g) return canvas

  const rng = seeded(receipt.code)
  const basePalette = PALETTES[receipt.theme ?? 'klasik'] ?? PALETTES.klasik
  const hiColor = receipt.theme === 'klasik' && pen ? pen : basePalette.hi
  const palette: ThemePalette = { ...basePalette, hi: hiColor }

  // 1. Desk backdrop with grid paper & subtle radial spotlight
  g.fillStyle = palette.deskBg
  g.fillRect(0, 0, W, H)

  const glow = g.createRadialGradient(W / 2, H * 0.45, 80, W / 2, H * 0.45, 760)
  glow.addColorStop(0, palette.deskGlow)
  glow.addColorStop(1, 'rgba(0,0,0,0)')
  g.fillStyle = glow
  g.fillRect(0, 0, W, H)

  g.strokeStyle = palette.deskGrid
  g.lineWidth = 2
  for (let x = 0; x <= W; x += 44) {
    g.beginPath()
    g.moveTo(x, 0)
    g.lineTo(x, H)
    g.stroke()
  }
  for (let y = 0; y <= H; y += 44) {
    g.beginPath()
    g.moveTo(0, y)
    g.lineTo(W, y)
    g.stroke()
  }

  // 2. Prepare display rows so the receipt is always well-proportioned
  const displayLines = receipt.lines.length
    ? receipt.lines
    : receipt.fallbackCourses.length
      ? receipt.fallbackCourses.map((c) => ({ qty: '1x', label: c, value: 'HAZIRLIK' }))
      : [
          { qty: '1x', label: 'MASA HAZIRLIĞI', value: 'TAMAM' },
          { qty: '1x', label: 'HEDEF ODAK', value: 'AKTİF' },
        ]

  const pad = 56
  const innerW = PAPER_W - pad * 2
  const rowH = 50
  const itemSectionH = Math.max(3, displayLines.length) * rowH + (receipt.empty ? 68 : 16)
  const paperH = Math.min(1620, Math.max(1260, 990 + itemSectionH))
  const left = (W - PAPER_W) / 2
  const top = Math.max(110, (H - paperH) / 2 - 20)

  g.save()
  g.translate(W / 2, top + paperH / 2)
  g.rotate(-0.012)
  g.translate(-W / 2, -(top + paperH / 2))

  // 3. Torn zigzag top & bottom receipt paper with deep drop shadow
  const tooth = 16
  g.beginPath()
  g.moveTo(left, top + tooth)
  for (let x = left; x < left + PAPER_W; x += tooth * 2) {
    g.lineTo(x + tooth, top)
    g.lineTo(Math.min(x + tooth * 2, left + PAPER_W), top + tooth)
  }
  g.lineTo(left + PAPER_W, top + paperH - tooth)
  for (let x = left + PAPER_W; x > left; x -= tooth * 2) {
    g.lineTo(x - tooth, top + paperH)
    g.lineTo(Math.max(x - tooth * 2, left), top + paperH - tooth)
  }
  g.closePath()

  g.shadowColor = 'rgba(0, 0, 0, 0.48)'
  g.shadowBlur = 48
  g.shadowOffsetY = 22
  g.fillStyle = palette.paperBg
  g.fill()
  g.shadowColor = 'transparent'

  g.lineWidth = 3
  g.strokeStyle = palette.border
  g.stroke()

  // Masking tape strip at the top center
  g.save()
  g.translate(W / 2, top + 6)
  g.rotate(0.03)
  g.fillStyle = palette.tape
  roundRectPath(g, -130, -22, 260, 44, 6)
  g.fill()
  g.strokeStyle = palette.border
  g.lineWidth = 2.5
  g.stroke()
  g.restore()

  let y = top + 78

  // 4. Receipt Header: Brand pill + Title + Register metadata
  g.font = `800 22px ${MONO}`
  const pillText = 'STUDYMODE.FUN · AKADEMİK KAYIT'
  const pillW = Math.max(410, g.measureText(pillText).width + 44)
  roundRectPath(g, W / 2 - pillW / 2, y - 28, pillW, 40, 20)
  g.fillStyle = palette.hi
  g.fill()
  g.lineWidth = 2.5
  g.strokeStyle = palette.border
  g.stroke()

  g.fillStyle = palette.onHi
  g.textAlign = 'center'
  g.fillText(pillText, W / 2, y - 1)
  y += 66

  g.fillStyle = palette.ink
  g.font = `900 46px ${SANS}`
  g.textAlign = 'center'
  g.fillText(receipt.title, W / 2, y)
  y += 40

  g.fillStyle = palette.inkMuted
  g.font = `600 23px ${MONO}`
  g.fillText(`${receipt.date}  ·  SAAT ${receipt.time}  ·  ${receipt.register}`, W / 2, y)
  y += 34

  // Dashed divider
  const drawDashedRule = (yy: number) => {
    g.save()
    g.strokeStyle = palette.border
    g.globalAlpha = 0.35
    g.lineWidth = 2.5
    g.setLineDash([10, 8])
    g.beginPath()
    g.moveTo(left + pad, yy)
    g.lineTo(left + PAPER_W - pad, yy)
    g.stroke()
    g.restore()
  }

  // 5. Personal Student Identity Card ("ÖĞRENCİ KARTI")
  const idCardH = 148
  roundRectPath(g, left + pad, y, innerW, idCardH, 18)
  g.fillStyle = palette.paperAlt
  g.fill()
  g.lineWidth = 2.5
  g.strokeStyle = palette.border
  g.stroke()

  // Left side of Student ID Card: Name + Tag
  const displayStudentName = receipt.studentName || 'İSİMSİZ SAVAŞÇI'
  const displayStudentTag =
    receipt.studentTag ||
    (receipt.register === '#GECE-VARDİYASI' ? 'GECE VARDİYASI EKİBİ' : 'STUDYMODE ÖĞRENCİSİ')

  g.fillStyle = palette.inkMuted
  g.font = `700 19px ${MONO}`
  g.textAlign = 'left'
  g.fillText('ÖĞRENCİ KİMLİĞİ', left + pad + 26, y + 36)

  g.fillStyle = palette.ink
  g.font = `800 34px ${SANS}`
  g.fillText(displayStudentName.slice(0, 22), left + pad + 26, y + 80)

  g.fillStyle = palette.inkMuted
  g.font = `600 22px ${SANS}`
  g.fillText(displayStudentTag.slice(0, 34), left + pad + 26, y + 118)

  // Right side of Student ID Card: Grade / Rank Badge
  const badgeW = 148
  const badgeH = 104
  const badgeX = left + PAPER_W - pad - badgeW - 22
  const badgeY = y + (idCardH - badgeH) / 2
  roundRectPath(g, badgeX, badgeY, badgeW, badgeH, 14)
  g.fillStyle = palette.hi
  g.fill()
  g.lineWidth = 2.5
  g.strokeStyle = palette.border
  g.stroke()

  g.fillStyle = palette.onHi
  g.textAlign = 'center'
  g.font = `900 44px ${SANS}`
  g.fillText(receipt.rank.grade, badgeX + badgeW / 2, badgeY + 54)
  g.font = `800 16px ${MONO}`
  g.fillText(receipt.rank.label, badgeX + badgeW / 2, badgeY + 84)

  y += idCardH + 24

  // 6. 4-Box KPI Metric Strip
  const kpis = [
    { label: 'KART TEKRARI', value: `${receipt.stats.reviews}` },
    { label: 'ODAK SÜRESİ', value: `${receipt.stats.focusMinutes} DK` },
    { label: 'TEST ORT.', value: receipt.stats.testAvg !== null ? `%${receipt.stats.testAvg}` : '—' },
    { label: 'SERİ', value: `${receipt.stats.streak} GÜN` },
  ]
  const gap = 14
  const boxW = (innerW - gap * 3) / 4
  const boxH = 104
  kpis.forEach((kpi, i) => {
    const bx = left + pad + i * (boxW + gap)
    roundRectPath(g, bx, y, boxW, boxH, 14)
    g.fillStyle = palette.paperBg
    g.fill()
    g.lineWidth = 2
    g.strokeStyle = palette.border
    g.stroke()

    g.fillStyle = palette.inkMuted
    g.font = `700 16px ${MONO}`
    g.textAlign = 'center'
    g.fillText(kpi.label, bx + boxW / 2, y + 34)

    g.fillStyle = palette.ink
    g.font = `800 30px ${SANS}`
    g.fillText(kpi.value, bx + boxW / 2, y + 78)
  })

  y += boxH + 30
  drawDashedRule(y)
  y += 38

  // 7. Itemized Table Header & Rows
  g.fillStyle = palette.inkMuted
  g.font = `700 20px ${MONO}`
  g.textAlign = 'left'
  g.fillText('KALEM / DERS ADI', left + pad, y)
  g.textAlign = 'right'
  g.fillText('KARŞILIK', left + PAPER_W - pad, y)
  y += 20
  drawDashedRule(y)
  y += 42

  for (const item of displayLines) {
    const leftText = `${item.qty ? `${item.qty} ` : ''}${item.label}`
    const rightText = item.value

    g.font = `700 26px ${MONO}`
    g.fillStyle = palette.ink
    g.textAlign = 'left'
    g.fillText(leftText, left + pad, y)

    g.textAlign = 'right'
    g.fillText(rightText, left + PAPER_W - pad, y)

    // Dotted leader between leftText and rightText
    const lw = g.measureText(leftText).width
    const rw = g.measureText(rightText).width
    const dotStart = left + pad + lw + 16
    const dotEnd = left + PAPER_W - pad - rw - 16
    if (dotEnd > dotStart + 20) {
      g.save()
      g.strokeStyle = palette.inkMuted
      g.globalAlpha = 0.4
      g.lineWidth = 2.5
      g.setLineDash([3, 9])
      g.beginPath()
      g.moveTo(dotStart, y - 7)
      g.lineTo(dotEnd, y - 7)
      g.stroke()
      g.restore()
    }
    y += rowH
  }

  if (receipt.empty) {
    g.fillStyle = palette.inkMuted
    g.font = `600 21px ${MONO}`
    g.textAlign = 'center'
    g.fillText('HENÜZ KART ÇEVRİLMEDİ · İLK TEKRARLA PUANLAR İŞLENİR', W / 2, y + 8)
    y += 44
  }

  y += 6
  drawDashedRule(y)
  y += 26

  // 8. Highlighted Total Effort Banner
  const totalBoxH = 74
  roundRectPath(g, left + pad, y, innerW, totalBoxH, 14)
  g.fillStyle = palette.hi
  g.fill()
  g.lineWidth = 3
  g.strokeStyle = palette.border
  g.stroke()

  g.fillStyle = palette.onHi
  g.font = `900 32px ${SANS}`
  g.textAlign = 'left'
  g.fillText(receipt.total.label, left + pad + 24, y + 48)
  g.textAlign = 'right'
  g.fillText(receipt.total.value, left + PAPER_W - pad - 24, y + 48)
  y += totalBoxH + 28

  // 9. Verdict / Personal Motto Box (left) + Non-overlapping Stamp Seal (right)
  const quoteBoxW = innerW - 190
  const quoteBoxH = 132
  roundRectPath(g, left + pad, y, quoteBoxW, quoteBoxH, 14)
  g.fillStyle = palette.paperAlt
  g.fill()
  g.lineWidth = 2
  g.strokeStyle = palette.border
  g.stroke()

  const headlineNote = receipt.customMotto ? `“${receipt.customMotto}”` : receipt.verdict
  g.fillStyle = palette.inkMuted
  g.font = `700 17px ${MONO}`
  g.textAlign = 'left'
  g.fillText(receipt.customMotto ? 'GÜNÜN NOTU & DURUM' : 'KASA RAPORU', left + pad + 22, y + 34)

  g.fillStyle = palette.ink
  g.font = `800 24px ${SANS}`
  const wrappedQuote = wrapTextByWidth(g, headlineNote, quoteBoxW - 44).slice(0, 2)
  wrappedQuote.forEach((line, idx) => {
    g.fillText(line, left + pad + 22, y + 72 + idx * 32)
  })
  if (receipt.customMotto) {
    g.fillStyle = palette.inkMuted
    g.font = `600 17px ${MONO}`
    g.fillText(receipt.verdict, left + pad + 22, y + 118)
  }

  // Dedicated Stamp Seal on the right (never overlaps text or barcode)
  const sx = left + PAPER_W - pad - 82
  const sy = y + quoteBoxH / 2
  g.save()
  g.translate(sx, sy)
  g.rotate(-0.22)
  g.strokeStyle = palette.stamp
  g.fillStyle = palette.stamp
  g.lineWidth = 4
  g.beginPath()
  g.arc(0, 0, 68, 0, Math.PI * 2)
  g.stroke()
  g.lineWidth = 2
  g.beginPath()
  g.arc(0, 0, 56, 0, Math.PI * 2)
  g.stroke()
  g.font = `800 14px ${MONO}`
  g.textAlign = 'center'
  g.fillText('STUDYMODE', 0, -20)
  g.font = `900 22px ${SANS}`
  g.fillText('ONAYLI', 0, 8)
  g.font = `700 13px ${MONO}`
  g.fillText('KAYIT', 0, 28)
  g.restore()

  y += quoteBoxH + 34

  // 10. Barcode & Serial Code
  const codeRng = seeded(receipt.code)
  let bx = left + pad + 24
  const bw = innerW - 48
  const barH = 82
  g.fillStyle = palette.ink
  while (bx < left + pad + 24 + bw - 6) {
    const width = 2 + Math.floor(codeRng() * 4) * 2
    if (codeRng() > 0.32) g.fillRect(bx, y, width, barH)
    bx += width + 2 + Math.floor(codeRng() * 3) * 2
  }
  y += barH + 34

  g.fillStyle = palette.inkMuted
  g.font = `700 22px ${MONO}`
  g.textAlign = 'center'
  g.fillText(receipt.code.split('').join(' '), W / 2, y)
  y += 34

  g.fillStyle = palette.inkMuted
  g.font = `600 19px ${MONO}`
  g.fillText(receipt.footer, W / 2, y)

  // Subtle paper grain
  g.fillStyle = palette.ink
  g.globalAlpha = 0.025
  for (let i = 0; i < 350; i++) {
    g.fillRect(left + rng() * PAPER_W, top + rng() * paperH, 2, 2)
  }

  g.restore()

  // Bottom story watermark
  g.fillStyle = palette.hi
  g.font = `800 36px ${SANS}`
  g.textAlign = 'center'
  g.fillText('studymode.fun', W / 2, H - 68)
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
    drawReceipt(receipt).toBlob((blob) => {
      if (!blob || cancelled) return
      url = URL.createObjectURL(blob)
      setImage({ url, blob })
    }, 'image/png')
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
              alt={`${receipt.title}: ${receipt.lines.map((l) => `${l.qty} ${l.label} ${l.value}`).join(', ')}. ${receipt.verdict}`}
            />
          ) : (
            <div className="receipt-loading" />
          )}
        </div>
      </div>
    </Modal>
  )
}
