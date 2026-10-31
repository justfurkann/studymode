import { z } from 'zod'
import { examsForCourse, isLegacyExam } from './courseExams'
import { daysUntil } from './srs'
import { supabase } from './supabase'
import type { CourseExamKind, StudyData, Summary } from './types'

/*
 * Sharing a course with a friend: the course is saved as a snapshot behind an unguessable link.
 * The friend copies it into their own account. Only content travels (notes, summaries, cards,
 * questions, upcoming exam dates); the owner's progress, written answers and scores never do.
 */

export const MAX_SHARE_BYTES = 2_500_000
export const TOKEN_LENGTH = 22
const IMPORTED_KEY = 'studymode.importedShares.v1'

const SummarySchema = z.object({
  overview: z.string(),
  points: z.array(z.string()),
  keyTerms: z.array(z.object({ term: z.string(), definition: z.string() })),
  tags: z.array(z.string()).optional(),
})

const SnapshotSchema = z.object({
  v: z.literal(1),
  course: z.object({ name: z.string().min(1).max(120), color: z.string().max(20) }),
  notes: z
    .array(
      z.object({
        title: z.string().max(300),
        content: z.string(),
        summary: SummarySchema.nullable(),
        questions: z.array(
          z.object({
            prompt: z.string(),
            options: z.array(z.string()),
            answerIndex: z.number().int().min(0),
            explanation: z.string(),
            source: z.string().nullable(),
          }),
        ),
        practice: z.array(z.object({ question: z.string(), answer: z.string().nullable(), hint: z.string().nullable() })),
        generator: z.enum(['ai', 'local']).nullable(),
      }),
    )
    .max(200),
  cards: z.array(z.object({ front: z.string(), back: z.string(), source: z.string().nullable(), note: z.number().int().min(0).nullable() })).max(5000),
  exams: z
    .array(
      z.object({
        kind: z.enum(['vize', 'final', 'butunleme', 'quiz', 'diger']),
        title: z.string().max(80).nullable(),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        weight: z.number().min(0).max(100).nullable(),
        notes: z.array(z.number().int().min(0)),
      }),
    )
    .max(20),
})

export type ShareSnapshot = z.infer<typeof SnapshotSchema>

/** What a friend may see: content only, no progress (completed steps, ticked terms, drafts, grades). */
function cleanSummary(summary: Summary | null): ShareSnapshot['notes'][number]['summary'] {
  if (!summary) return null
  return { overview: summary.overview, points: summary.points, keyTerms: summary.keyTerms, ...(summary.tags?.length ? { tags: summary.tags } : {}) }
}

export function buildSnapshot(data: StudyData, courseId: string, now = new Date()): ShareSnapshot | null {
  const course = data.courses.find((c) => c.id === courseId)
  if (!course) return null
  const notes = data.notes.filter((n) => n.courseId === courseId).sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  const index = new Map(notes.map((n, i) => [n.id, i]))
  return {
    v: 1,
    course: { name: course.name, color: course.color },
    notes: notes.map((n) => ({
      title: n.title,
      content: n.content,
      summary: cleanSummary(n.summary),
      questions: n.questions.map(({ prompt, options, answerIndex, explanation, source }) => ({ prompt, options, answerIndex, explanation, source })),
      practice: n.practice.map(({ question, answer, hint }) => ({ question, answer, hint })),
      generator: n.generator,
    })),
    cards: data.cards
      .filter((c) => c.courseId === courseId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map((c) => ({ front: c.front, back: c.back, source: c.source, note: c.noteId !== null && index.has(c.noteId) ? index.get(c.noteId)! : null })),
    // Friends in the same class get the upcoming exam dates too; past ones are noise.
    exams: examsForCourse(data, courseId)
      .filter((e) => !isLegacyExam(e) && (daysUntil(e.date, now) ?? -1) >= 0)
      .map((e) => ({
        kind: e.kind as CourseExamKind,
        title: e.title,
        date: e.date,
        weight: e.weight,
        notes: e.noteIds.filter((id) => index.has(id)).map((id) => index.get(id)!),
      })),
  }
}

export function snapshotBytes(snapshot: ShareSnapshot): number {
  return new TextEncoder().encode(JSON.stringify(snapshot)).length
}

export function parseSnapshot(value: unknown): ShareSnapshot | null {
  const parsed = SnapshotSchema.safeParse(value)
  if (!parsed.success) return null
  const s = parsed.data
  // Indexes must point at notes that exist.
  const ok = (i: number | null) => i === null || i < s.notes.length
  return s.cards.every((c) => ok(c.note)) && s.exams.every((e) => e.notes.every(ok)) ? s : null
}

export function snapshotCounts(s: ShareSnapshot) {
  return { notes: s.notes.length, cards: s.cards.length, questions: s.notes.reduce((n, note) => n + note.questions.length, 0), exams: s.exams.length }
}

/** 22 characters from 62 symbols: about 131 bits, not guessable. */
export function newToken(length = TOKEN_LENGTH): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let out = ''
  while (out.length < length) {
    for (const byte of crypto.getRandomValues(new Uint8Array(length * 2))) {
      // 248 = 4 × 62: dropping larger bytes keeps every symbol equally likely.
      if (byte < 248 && out.length < length) out += alphabet[byte % 62]
    }
  }
  return out
}

export const shareUrl = (token: string, origin = window.location.origin) => `${origin}/paylas/${token}`

// ---------- Server ----------

export class ShareError extends Error {}

const NOT_READY = 'Paylaşım özelliği için veritabanı güncellemesi bekleniyor. Biraz sonra yeniden dene.'

function explain(error: { code?: string; message?: string } | null, fallback: string): ShareError {
  if (error && ['PGRST205', '42P01', 'PGRST202', '42883'].includes(error.code ?? '')) return new ShareError(NOT_READY)
  return new ShareError(fallback)
}

export interface ShareRow {
  id: string
  token: string
  createdAt: string
  updatedAt: string
}

const toRow = (r: { id: string; token: string; created_at: string; updated_at: string }): ShareRow => ({ id: r.id, token: r.token, createdAt: r.created_at, updatedAt: r.updated_at })

function client() {
  if (!supabase) throw new ShareError('Paylaşım için hesap gerekiyor; bu sürüm hesapsız çalışıyor.')
  return supabase
}

function checkSize(snapshot: ShareSnapshot) {
  if (snapshotBytes(snapshot) > MAX_SHARE_BYTES) throw new ShareError('Bu ders paylaşmak için çok büyük. Çok uzun notlardan birkaçını çıkarıp yeniden dene.')
}

export async function listShares(courseId: string): Promise<ShareRow[]> {
  const { data, error } = await client().from('course_shares').select('id, token, created_at, updated_at').eq('course_id', courseId).order('created_at', { ascending: false })
  if (error) throw explain(error, 'Paylaşımlar yüklenemedi.')
  return (data ?? []).map(toRow)
}

export async function createShare(courseId: string, snapshot: ShareSnapshot, ownerName: string | null): Promise<ShareRow> {
  checkSize(snapshot)
  const { data, error } = await client()
    .from('course_shares')
    .insert({ token: newToken(), course_id: courseId, title: snapshot.course.name, owner_name: ownerName?.slice(0, 80) || null, snapshot })
    .select('id, token, created_at, updated_at')
    .single()
  if (error || !data) throw explain(error, 'Bağlantı oluşturulamadı. İnternet bağlantını kontrol edip yeniden dene.')
  return toRow(data)
}

/** Same link, the course as it is now. */
export async function updateShare(id: string, snapshot: ShareSnapshot): Promise<ShareRow> {
  checkSize(snapshot)
  const { data, error } = await client()
    .from('course_shares')
    .update({ title: snapshot.course.name, snapshot, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('id, token, created_at, updated_at')
    .single()
  if (error || !data) throw explain(error, 'Bağlantı güncellenemedi.')
  return toRow(data)
}

export async function deleteShare(id: string): Promise<void> {
  const { error } = await client().from('course_shares').delete().eq('id', id)
  if (error) throw explain(error, 'Paylaşım kapatılamadı.')
}

export interface FetchedShare {
  ownerName: string | null
  updatedAt: string
  snapshot: ShareSnapshot
}

/** Reads a share by its token through a database function, so nobody can list other people's shares. */
export async function fetchShare(token: string): Promise<FetchedShare | null> {
  if (!/^[A-Za-z0-9]{16,64}$/.test(token)) return null
  const { data, error } = await client().rpc('get_course_share', { share_token: token })
  if (error) throw explain(error, 'Paylaşılan ders yüklenemedi. İnternet bağlantını kontrol edip yeniden dene.')
  const row = (Array.isArray(data) ? data[0] : data) as { owner_name: string | null; snapshot: unknown; updated_at: string } | undefined
  if (!row) return null
  const snapshot = parseSnapshot(row.snapshot)
  if (!snapshot) throw new ShareError('Bu paylaşım okunamadı.')
  return { ownerName: row.owner_name, updatedAt: row.updated_at, snapshot }
}

// ---------- Remembering what was added on this device ----------

export function importedCourseId(token: string): string | null {
  try {
    const map = JSON.parse(localStorage.getItem(IMPORTED_KEY) || '{}') as Record<string, string>
    return typeof map[token] === 'string' ? map[token] : null
  } catch {
    return null
  }
}

export function rememberImport(token: string, courseId: string) {
  try {
    const map = JSON.parse(localStorage.getItem(IMPORTED_KEY) || '{}') as Record<string, string>
    localStorage.setItem(IMPORTED_KEY, JSON.stringify({ ...map, [token]: courseId }))
  } catch {
    // Blocked storage: the friend may simply add it twice.
  }
}
