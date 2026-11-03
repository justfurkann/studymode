import type { ChatTurn } from './ai/tasks'
import type { Course, Note } from './types'

/*
 * The study assistant ("Fosfor"): which notes go with a question, and the conversation kept per
 * course for this browser tab. The answer itself comes from the "chat" AI task.
 */

/** Characters of notes sent with a question: enough to answer from, small enough to answer fast. */
export const CONTEXT_BUDGET = 16_000
/** The note the student has open gets this much; the rest of the course shares what is left. */
const CURRENT_NOTE_CHARS = 9_000
const OTHER_NOTE_CHARS = 2_500

/** A note in a few lines: the summary when there is one, else the start of the text. */
function noteDigest(note: Note, maxChars: number): string {
  const s = note.summary
  const parts: string[] = []
  if (s?.overview?.trim()) parts.push(s.overview.trim())
  if (s?.points?.length) parts.push(s.points.map((p) => `- ${p}`).join('\n'))
  if (s?.keyTerms?.length) parts.push(s.keyTerms.map((k) => `- ${k.term}: ${k.definition}`).join('\n'))
  let digest = parts.join('\n')
  // Room left over goes to the note's own words, which hold the details a summary drops.
  if (digest.length < maxChars && note.content.trim()) {
    const room = maxChars - digest.length - 2
    if (room > 200) digest = [digest, note.content.trim().slice(0, room)].filter(Boolean).join('\n\n')
  }
  return digest.slice(0, maxChars)
}

/**
 * The notes sent with a question about `courseId`: the open note first (more of it), then the
 * course's other notes, newest first, until the budget is used. '' for a general question.
 */
export function buildAssistantContext(notes: Note[], courseId: string | null, currentNoteId: string | null, budget = CONTEXT_BUDGET): string {
  if (!courseId) return ''
  const inCourse = notes.filter((n) => n.courseId === courseId)
  const current = inCourse.find((n) => n.id === currentNoteId)
  const others = inCourse.filter((n) => n.id !== current?.id).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  const blocks: string[] = []
  let used = 0
  for (const note of current ? [current, ...others] : others) {
    const left = budget - used
    if (left < 300) break
    const size = Math.min(left - 60, note === current ? CURRENT_NOTE_CHARS : OTHER_NOTE_CHARS)
    const digest = noteDigest(note, size)
    if (!digest) continue
    const block = `### ${note.title}${note === current ? ' (şu an açık)' : ''}\n${digest}`
    blocks.push(block)
    used += block.length + 2
  }
  return blocks.join('\n\n')
}

/** The course and note the student is looking at, from the address (/not/:id, /ders/:id...). */
export function placeFromPath(pathname: string, notes: Note[], courses: Course[]): { courseId: string | null; noteId: string | null } {
  const note = pathname.match(/^\/not\/([^/]+)/)?.[1]
  if (note) {
    const found = notes.find((n) => n.id === note)
    if (found) return { courseId: found.courseId, noteId: found.id }
  }
  const course = pathname.match(/^\/ders\/([^/]+)/)?.[1]
  if (course && courses.some((c) => c.id === course)) return { courseId: course, noteId: null }
  return { courseId: null, noteId: null }
}

// ---------- The conversation, per course, for this tab ----------

export interface ChatMessage extends ChatTurn {
  id: string
}

const KEY = 'studymode.assistant.v1'
/** Kept per conversation; older turns drop off (the AI only sees the last few anyway). */
const MAX_MESSAGES = 40

type Store = Record<string, ChatMessage[]>

function read(): Store {
  try {
    const raw = sessionStorage.getItem(KEY)
    const parsed = raw ? (JSON.parse(raw) as unknown) : {}
    return parsed && typeof parsed === 'object' ? (parsed as Store) : {}
  } catch {
    return {}
  }
}

/** '' is the general conversation (no course picked). */
export function loadConversation(courseId: string): ChatMessage[] {
  const list = read()[courseId]
  return Array.isArray(list) ? list.filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.text === 'string') : []
}

export function saveConversation(courseId: string, messages: ChatMessage[]) {
  try {
    const all = read()
    all[courseId] = messages.slice(-MAX_MESSAGES)
    sessionStorage.setItem(KEY, JSON.stringify(all))
  } catch {
    // Storage full or blocked: the conversation still lives on screen.
  }
}

/** Splits **bold** out of a reply for display; everything else stays plain text. */
export function boldParts(text: string): Array<{ text: string; bold: boolean }> {
  const out: Array<{ text: string; bold: boolean }> = []
  const re = /\*\*([^*\n]+)\*\*/g
  let last = 0
  for (let m = re.exec(text); m; m = re.exec(text)) {
    if (m.index > last) out.push({ text: text.slice(last, m.index), bold: false })
    out.push({ text: m[1], bold: true })
    last = m.index + m[0].length
  }
  if (last < text.length) out.push({ text: text.slice(last), bold: false })
  return out
}
