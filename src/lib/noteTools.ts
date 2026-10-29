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
