import { saveList, type SaveResult } from './imageStore'
import brandSymbol from '../../public/brand/svg/symbol-yellow.svg?raw'
import type { Card, Note } from './types'

export interface ConceptNode {
  id: string
  label: string
  detail: string
  relation: string
  x: number
  y: number
  isRoot?: boolean
}

export interface ConceptDiagram {
  title: string
  centralTopic: string
  centralSummary: string
  nodes: ConceptNode[]
}

export interface GeneratedVisualItem {
  id: string
  title: string
  prompt: string
  imageUrl: string
  caption: string
  kind: 'ai_image' | 'poster'
  createdAt: string
}

/**
 * Builds a structured visual concept map (radial/hierarchical SVG layout) from a note's keyTerms and points.
 */
export function buildConceptDiagram(note: Note): ConceptDiagram {
  const centralTopic = note.title.trim() || 'Ana Konu'
  const centralSummary =
    note.summary?.overview?.slice(0, 140).trim() ||
    note.summary?.points?.[0]?.slice(0, 140).trim() ||
    'Notun temel kavramları ve birbirleriyle ilişkisi.'

  const rawItems: Array<{ label: string; detail: string; relation: string }> = []

  for (const kt of (note.summary?.keyTerms ?? []).slice(0, 6)) {
    rawItems.push({
      label: kt.term,
      detail: kt.definition,
      relation: 'Temel kavram',
    })
  }

  if (rawItems.length < 4) {
    for (const pt of (note.summary?.points ?? []).slice(0, 6 - rawItems.length)) {
      const words = pt.split(/\s+/).slice(0, 3).join(' ').replace(/[.,:;!?]+$/, '')
      rawItems.push({
        label: words || `Madde ${rawItems.length + 1}`,
        detail: pt,
        relation: 'Ana nokta',
      })
    }
  }

  if (rawItems.length === 0) {
    const lines = note.content
      .split(/\n+/)
      .map((l) => l.trim())
      .filter((l) => l.length > 10)
      .slice(0, 5)
    lines.forEach((line, idx) => {
      const colon = line.indexOf(':')
      rawItems.push({
        label: colon > 0 && colon < 30 ? line.slice(0, colon).trim() : `Kavram ${idx + 1}`,
        detail: colon > 0 && colon < 30 ? line.slice(colon + 1).trim() : line,
        relation: `Adım ${idx + 1}`,
      })
    })
  }

  // Radial coordinates around center (380, 220) inside a 760x440 SVG canvas
  const positions: ReadonlyArray<{ x: number; y: number }> = [
    { x: 150, y: 95 },
    { x: 610, y: 95 },
    { x: 135, y: 225 },
    { x: 625, y: 225 },
    { x: 165, y: 355 },
    { x: 595, y: 355 },
  ]

  const nodes: ConceptNode[] = rawItems.slice(0, 6).map((item, idx) => ({
    id: `node-${idx + 1}`,
    label: item.label.length > 28 ? `${item.label.slice(0, 26)}…` : item.label,
    detail: item.detail,
    relation: item.relation,
    x: positions[idx]?.x ?? 160,
    y: positions[idx]?.y ?? 100,
  }))

  return {
    title: `${centralTopic} · Kavram Haritası`,
    centralTopic,
    centralSummary,
    nodes,
  }
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function wrapText(text: string, maxCharsPerLine: number, maxLines = 3): string[] {
  const words = text.replace(/\s+/g, ' ').trim().split(' ')
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    if (!current) {
      current = word
    } else if (current.length + 1 + word.length <= maxCharsPerLine) {
      current = `${current} ${word}`
    } else {
      lines.push(current)
      current = word
      if (lines.length >= maxLines - 1) break
    }
  }
  if (current && lines.length < maxLines) {
    lines.push(current.length > maxCharsPerLine ? `${current.slice(0, maxCharsPerLine - 1)}…` : current)
  }
  return lines
}

/**
 * Generates a self-contained "Fosforlu" educational poster SVG data URL (`data:image/svg+xml;utf8,...`)
 * for a note concept, mnemonic, or summary so visuals work both offline and alongside Gemini Image models.
 */
export function renderEducationalPosterDataUrl(
  title: string,
  subtitle: string,
  items: Array<{ key: string; meaning: string }>,
  footer = 'Görsel Çalışma Kartı',
): string {
  const safeTitle = title.trim() || 'Kavram Şeması'
  const safeSub = subtitle.trim() || 'Önemli Noktalar'
  const rows = items.slice(0, 5)
  const height = Math.max(420, 175 + rows.length * 64)

  const rowBlocks = rows
    .map((item, idx) => {
      const y = 138 + idx * 62
      const keyText = escapeXml(item.key.slice(0, 26))
      const wrapped = wrapText(item.meaning, 54, 2)
      return `
      <g transform="translate(36, ${y})">
        <rect x="0" y="0" width="728" height="52" rx="10" fill="#ffffff" stroke="#1b2250" stroke-width="2" />
        <rect x="10" y="10" width="160" height="32" rx="6" fill="#ffe14d" stroke="#1b2250" stroke-width="1.5" />
        <text x="90" y="31" font-family="system-ui, -apple-system, sans-serif" font-size="13" font-weight="800" fill="#1b2250" text-anchor="middle">${keyText}</text>
        <text x="184" y="${wrapped.length > 1 ? 23 : 31}" font-family="system-ui, -apple-system, sans-serif" font-size="13" font-weight="600" fill="#1b2250">${escapeXml(wrapped[0] ?? '')}</text>
        ${wrapped[1] ? `<text x="184" y="41" font-family="system-ui, -apple-system, sans-serif" font-size="12" fill="#47507a">${escapeXml(wrapped[1])}</text>` : ''}
      </g>`
    })
    .join('\n')

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 ${height}" width="800" height="${height}">
    <defs>
      <pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse">
        <path d="M 24 0 L 0 0 0 24" fill="none" stroke="#e5e4dc" stroke-width="1" />
      </pattern>
    </defs>
    <rect width="800" height="${height}" fill="#fafaf6" />
    <rect width="800" height="${height}" fill="url(#grid)" />
    <rect x="18" y="18" width="764" height="${height - 36}" rx="16" fill="none" stroke="#1b2250" stroke-width="3" />
    <rect x="36" y="36" width="728" height="84" rx="12" fill="#1b2250" />
    <rect x="52" y="50" width="110" height="22" rx="5" fill="#ffe14d" />
    <text x="107" y="65" font-family="system-ui, -apple-system, sans-serif" font-size="11" font-weight="800" fill="#1b2250" text-anchor="middle">GÖRSEL ÖZET</text>
    <text x="52" y="96" font-family="system-ui, -apple-system, sans-serif" font-size="22" font-weight="800" fill="#ffffff">${escapeXml(safeTitle.slice(0, 48))}</text>
    <text x="748" y="66" font-family="system-ui, -apple-system, sans-serif" font-size="12" font-weight="600" fill="#ffe14d" text-anchor="end">${escapeXml(safeSub.slice(0, 40))}</text>
    ${rowBlocks}
    <text x="52" y="${height - 32}" font-family="system-ui, -apple-system, sans-serif" font-size="12" font-weight="700" fill="#52587a">${escapeXml(footer)}</text>
    <g transform="translate(${800 - 36 - 152}, ${height - 56})">
      <rect width="152" height="32" rx="16" fill="#11142a" fill-opacity="0.78" />
      <svg x="10" y="6" width="16" height="20" viewBox="0 0 176 221">${BRAND_S}</svg
      ><text x="34" y="21" font-family="system-ui, -apple-system, sans-serif" font-size="13" font-weight="700" fill="#ffffff">studymode.fun</text>
    </g>
  </svg>`

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

/** The yellow brand "S" (public/brand/svg/symbol-yellow.svg) without its outer <svg>, to inline in posters. */
const BRAND_S = brandSymbol.replace(/^[\s\S]*?<\/title>/, '').replace(/<\/svg>\s*$/, '').replace(/ id="[^"]*"/g, '')

const VISUAL_STORAGE_PREFIX = 'studymode.visuals.v1.'

export function readStoredVisuals(noteId: string): GeneratedVisualItem[] {
  try {
    const raw = localStorage.getItem(`${VISUAL_STORAGE_PREFIX}${noteId}`)
    if (!raw) return []
    const parsed = JSON.parse(raw) as GeneratedVisualItem[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

/** Keeps the newest 8; if the browser is out of space, older ones go first (see imageStore). */
export function saveStoredVisuals(noteId: string, items: GeneratedVisualItem[]): SaveResult {
  try {
    return saveList(`${VISUAL_STORAGE_PREFIX}${noteId}`, items.slice(0, 8))
  } catch {
    return 'failed'
  }
}

/** Converts a visual item or diagram node into a flashcard. */
export function visualToCard(
  visual: { title: string; caption: string },
  courseId: string,
  noteId: string,
): Omit<Card, 'id' | 'due' | 'interval' | 'ease' | 'reps' | 'lapses' | 'createdAt' | 'updatedAt'> {
  return {
    courseId,
    noteId,
    front: `${visual.title} şemasındaki temel kavram ve işlevi nedir?`,
    back: visual.caption,
    source: visual.title,
  }
}
