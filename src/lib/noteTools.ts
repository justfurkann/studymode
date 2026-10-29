import type { Note } from './types'

export function matchesNote(note: Note, query: string, tag = '') {
  const search = query.trim().toLocaleLowerCase('tr')
  return (!tag || note.summary?.tags?.includes(tag)) && (!search || [note.title, note.content, ...(note.summary?.tags ?? [])].join(' ').toLocaleLowerCase('tr').includes(search))
}

export function summaryMarkdown(note: Note) {
  const summary = note.summary
  if (!summary) return `# ${note.title}\n`
  return [`# ${note.title}`, summary.overview, '## Ana noktalar', ...summary.points.map(p => `- ${p}`), '## Kavramlar', ...summary.keyTerms.map(t => `- **${t.term}:** ${t.definition}`)].filter(Boolean).join('\n\n') + '\n'
}

const ASCII: Record<string, string> = { ç: 'c', Ç: 'C', ğ: 'g', Ğ: 'G', ı: 'i', İ: 'I', ö: 'o', Ö: 'O', ş: 's', Ş: 'S', ü: 'u', Ü: 'U' }

/** Some browsers drop a download name with non-ASCII letters and save the file as "download". */
export function safeFileName(name: string) {
  return name
    .replace(/[çÇğĞıİöÖşŞüÜ]/g, (c) => ASCII[c])
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7e]/g, '')
    .replace(/[\\/:*?"<>|]/g, '-')
    .trim() || 'studymode'
}

export function downloadText(name: string, text: string, type = 'text/markdown;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const link = document.createElement('a')
  link.href = url
  link.download = safeFileName(name)
  // Some browsers ignore the file name on links that are not in the page.
  link.style.display = 'none'
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Where a quoted passage sits in a note, and the nearest "Slayt 3"-style heading before it. */
export function findSourceMatch(content: string, excerpt: string): { start: number; end: number; sectionLabel: string | null } | null {
  const cleanExcerpt = excerpt.trim()
  if (!cleanExcerpt) return null

  const lowerContent = content.toLocaleLowerCase('tr-TR')
  const lowerExcerpt = cleanExcerpt.toLocaleLowerCase('tr-TR')
  let start = lowerContent.indexOf(lowerExcerpt)
  let end = start >= 0 ? start + cleanExcerpt.length : -1

  if (start < 0) {
    // Try matching a shorter prefix/core slice if the quote was slightly trimmed
    const probe = lowerExcerpt.slice(0, Math.min(48, lowerExcerpt.length)).trim()
    if (probe.length >= 12) {
      start = lowerContent.indexOf(probe)
      if (start >= 0) {
        end = Math.min(content.length, start + cleanExcerpt.length)
      }
    }
  }

  if (start < 0) return null

  const before = content.slice(0, start)
  const matches = [...before.matchAll(/(?:^|\n)\s*((?:Slayt|Sayfa|Bölüm|Hafta)\s+\d+[^\n]*)/gi)]
  const sectionLabel = matches.length > 0 ? matches[matches.length - 1][1].trim() : null

  return { start, end, sectionLabel }
}
