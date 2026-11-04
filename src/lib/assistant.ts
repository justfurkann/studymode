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

// ---------- The conversation, per course, kept on this device ----------

export interface ChatMessage extends ChatTurn {
  id: string
  /** The answer was saved as a study card (assistant messages only). */
  carded?: boolean
}

const KEY = 'studymode.assistant.v2'
const OLD_KEY = 'studymode.assistant.v1'
/** Kept per conversation; older turns drop off (the AI only sees the last few anyway). */
const MAX_MESSAGES = 40
/** A conversation nobody touched for a week starts fresh: by then the question has moved on. */
export const CONVERSATION_TTL_MS = 7 * 24 * 60 * 60 * 1000

type Store = Record<string, { at: number; messages: ChatMessage[] }>

function read(now = Date.now()): Store {
  try {
    const raw = localStorage.getItem(KEY)
    const parsed = raw ? (JSON.parse(raw) as unknown) : {}
    if (!parsed || typeof parsed !== 'object') return {}
    const out: Store = {}
    for (const [course, entry] of Object.entries(parsed as Store)) {
      if (entry && Array.isArray(entry.messages) && typeof entry.at === 'number' && now - entry.at < CONVERSATION_TTL_MS) out[course] = entry
    }
    return out
  } catch {
    return {}
  }
}

/** '' is the general conversation (no course picked). */
export function loadConversation(courseId: string, now = Date.now()): ChatMessage[] {
  const list = read(now)[courseId]?.messages
  return Array.isArray(list) ? list.filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.text === 'string') : []
}

export function saveConversation(courseId: string, messages: ChatMessage[], now = Date.now()) {
  try {
    const all = read(now)
    if (messages.length) all[courseId] = { at: now, messages: messages.slice(-MAX_MESSAGES) }
    else delete all[courseId]
    localStorage.setItem(KEY, JSON.stringify(all))
    sessionStorage.removeItem(OLD_KEY)
  } catch {
    // Storage full or blocked: the conversation still lives on screen.
  }
}

/** Forgets every conversation on this device (signing out). */
export function clearConversations() {
  try {
    localStorage.removeItem(KEY)
    sessionStorage.removeItem(OLD_KEY)
  } catch {
    // Nothing to clear.
  }
}

// ---------- Showing a reply ----------

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

export type ReplyBlock = { kind: 'p'; text: string } | { kind: 'ul' | 'ol'; items: string[] }

/** A reply as paragraphs and lists ("- " / "• " items, "1." / "1)" items), the only formatting Fosfor is asked to use. */
export function replyBlocks(text: string): ReplyBlock[] {
  const blocks: ReplyBlock[] = []
  let para: string[] = []
  const flush = () => {
    if (para.length) blocks.push({ kind: 'p', text: para.join('\n') })
    para = []
  }
  for (const raw of text.replace(/\r/g, '').split('\n')) {
    const line = raw.trim()
    const bullet = line.match(/^[-•*]\s+(.+)$/)
    const numbered = line.match(/^\d{1,2}[.)]\s+(.+)$/)
    const kind = bullet ? 'ul' : numbered ? 'ol' : null
    if (kind) {
      flush()
      const item = (bullet ?? numbered)![1]
      const prev = blocks[blocks.length - 1]
      if (prev && prev.kind === kind) prev.items.push(item)
      else blocks.push({ kind, items: [item] })
    } else if (!line) {
      flush()
    } else {
      para.push(line)
    }
  }
  flush()
  return blocks
}

/** A reply as plain text for copying or a card: no ** marks, lists kept as lines. */
export function plainReply(text: string): string {
  return text.replace(/\*\*([^*\n]+)\*\*/g, '$1').trim()
}

/** A study card from a question and Fosfor's answer to it. */
export function cardFromAnswer(question: string, answer: string): { front: string; back: string } {
  const front = question.trim().replace(/\s+/g, ' ')
  return { front: front.length > 200 ? `${front.slice(0, 197)}…` : front, back: plainReply(answer).slice(0, 1200) }
}

// ---------- What to suggest ----------

export type SuggestionIcon = 'list' | 'quiz' | 'bulb' | 'target' | 'map' | 'clock'
export interface Suggestion {
  label: string
  icon: SuggestionIcon
}

/** Starter questions for where the student is: a note open, a course picked, or nothing. */
export function suggestionsFor(where: 'note' | 'course' | 'general'): Suggestion[] {
  if (where === 'note')
    return [
      { label: 'Bu notu 3 maddede özetle', icon: 'list' },
      { label: 'Bu nottan bana soru sor', icon: 'quiz' },
      { label: 'En zor kısmı basitçe anlat', icon: 'bulb' },
      { label: 'Sınavda ne çıkabilir?', icon: 'target' },
    ]
  if (where === 'course')
    return [
      { label: 'Bu dersin ana konuları ne?', icon: 'map' },
      { label: 'Bana bir soru sor', icon: 'quiz' },
      { label: 'Sınavda ne çıkabilir?', icon: 'target' },
      { label: 'Nereden başlamalıyım?', icon: 'bulb' },
    ]
  return [
    { label: 'Nasıl daha verimli çalışırım?', icon: 'bulb' },
    { label: 'Sınava 3 gün kaldı, plan yap', icon: 'clock' },
    { label: 'Aralıklı tekrar nedir?', icon: 'list' },
  ]
}

/** The question asked when the student selects a bit of text and taps "Fosfor’a sor". */
export const SELECTION_MAX = 400
export function selectionQuestion(selected: string): string {
  const text = selected.replace(/\s+/g, ' ').trim()
  const short = text.length > SELECTION_MAX ? `${text.slice(0, SELECTION_MAX - 1)}…` : text
  return text.split(' ').length <= 4 ? `“${short}” ne demek? Kısaca açıkla.` : `Şu kısmı basitçe açıklar mısın?\n“${short}”`
}
