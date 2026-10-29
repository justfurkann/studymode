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

export function downloadText(name: string, text: string, type = 'text/markdown;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const link = document.createElement('a')
  link.href = url
  link.download = name.replace(/[\\/:*?"<>|]/g, '-')
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
