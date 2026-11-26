import type { SupabaseClient } from '@supabase/supabase-js'
import { mergeStudyDays, type StudyDelta } from './streak'
import { emptyData, type StudyData, type StudyDay } from './types'

export type Table = 'courses' | 'notes' | 'cards' | 'attempts' | 'exams' | 'studyDays' | 'courseExams'

export type Change =
  | { type: 'upsert'; table: Table; rows: object[] }
  | { type: 'delete'; table: Table; ids: string[] }
  /** Adds to one day's counters. In the account only the delta is sent (another device may have counted too); `row` is this tab's copy. */
  | { type: 'bump'; table: 'studyDays'; day: string; delta: StudyDelta; row: StudyDay }

/** Where study data lives. The store applies changes to memory first, then hands them here. */
export interface Backend {
  load(): Promise<StudyData>
  /** Resolves with the day rows the server now has after `bump` changes (they include other devices' counts). */
  apply(changes: Change[], next: StudyData): Promise<StudyDay[] | void>
}

// ---------- Local (this browser only) ----------

const LOCAL_KEY = 'studymode.data.v2'

export function readLocalData(): StudyData {
  try {
    const raw = localStorage.getItem(LOCAL_KEY)
    if (!raw) return emptyData()
    return parseData(JSON.parse(raw))
  } catch {
    return emptyData()
  }
}

export function hasLocalData(): boolean {
  const data = readLocalData()
  return data.courses.length > 0
}

export function clearLocalData() {
  try {
    localStorage.removeItem(LOCAL_KEY)
  } catch {
    // Nothing to clear if storage is blocked.
  }
}

export const localBackend: Backend = {
  async load() {
    return readLocalData()
  },
  async apply(_changes, next) {
    try {
      localStorage.setItem(LOCAL_KEY, JSON.stringify(next))
    } catch {
      throw new Error('Tarayıcıya kaydedilemedi. Depolama dolu olabilir; bir kaç notu silip tekrar dene.')
    }
  },
}

/** Accepts data from storage or an imported backup file, rejecting anything that is not the expected shape. */
export function parseData(value: unknown): StudyData {
  if (!value || typeof value !== 'object') throw new Error('Geçersiz veri dosyası.')
  const data = value as Record<string, unknown>
  const lists = ['courses', 'notes', 'cards', 'attempts'] as const
  for (const key of lists) {
    if (!Array.isArray(data[key])) throw new Error('Geçersiz veri dosyası.')
    for (const item of data[key] as unknown[]) {
      if (!item || typeof item !== 'object' || typeof (item as { id?: unknown }).id !== 'string') {
        throw new Error('Geçersiz veri dosyası.')
      }
    }
  }
  // Backups and browser data from before mock exams or study streaks were saved have no `exams` / `studyDays` list.
  const exams = Array.isArray(data.exams) ? data.exams.filter((e) => e && typeof e === 'object' && typeof (e as { id?: unknown }).id === 'string') : []
  const studyDays = Array.isArray(data.studyDays)
    ? data.studyDays.filter((d) => d && typeof d === 'object' && typeof (d as { id?: unknown }).id === 'string' && typeof (d as { day?: unknown }).day === 'string')
    : []
  const courseExams = Array.isArray(data.courseExams)
    ? data.courseExams.filter((e) => e && typeof e === 'object' && typeof (e as { id?: unknown }).id === 'string' && typeof (e as { date?: unknown }).date === 'string')
    : []
  return { courses: data.courses, notes: data.notes, cards: data.cards, attempts: data.attempts, exams, studyDays, courseExams } as StudyData
}

// ---------- Supabase (account, synced across devices) ----------

const TABLE_NAMES: Record<Table, string> = {
  courses: 'courses',
  notes: 'notes',
  cards: 'cards',
  attempts: 'quiz_attempts',
  exams: 'exam_results',
  studyDays: 'study_days',
  courseExams: 'course_exams',
}

const toSnake = (key: string) => key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)
const toCamel = (key: string) => key.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())

function mapKeys(row: object, fn: (key: string) => string, skip: string[] = []): Record<string, unknown> {
  return Object.fromEntries(Object.entries(row).filter(([k]) => !skip.includes(k)).map(([k, v]) => [fn(k), v]))
}

function chunks<T>(items: T[], size: number): T[][] {
  const result: T[][] = []
  for (let i = 0; i < items.length; i += size) result.push(items.slice(i, i + size))
  return result
}

const PAGE = 1000

/** PostgREST / Postgres codes for "this function does not exist". */
const isMissingFunction = (error: { code?: string }) => error.code === 'PGRST202' || error.code === '42883'

/** PostgREST / Postgres codes for "this table does not exist". */
const isMissingTable = (error: { code?: string }) => error.code === 'PGRST205' || error.code === '42P01'

/** Columns added after their table; saving works (without them) before the migration is run. */
const OPTIONAL_COLUMNS = new Set(['actions', 'answers', 'time', 'grade', 'new_cards'])

/** Name of the column PostgREST reports as unknown (code PGRST204), if any. */
export function missingColumn(error: { code?: string; message?: string }): string | null {
  if (error.code !== 'PGRST204') return null
  return error.message?.match(/'([^']+)' column/)?.[1] ?? null
}

/** Tables added after the first schema; an account whose database lacks them still loads. */
const OPTIONAL_TABLES = new Set<Table>(['exams', 'studyDays', 'courseExams'])

async function fetchAll(client: SupabaseClient, table: Table) {
  const rows: Record<string, unknown>[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await client.from(TABLE_NAMES[table]).select('*').order('created_at').range(from, from + PAGE - 1)
    if (error && OPTIONAL_TABLES.has(table) && isMissingTable(error)) return rows
    if (error) throw new Error(`Veriler yüklenemedi: ${error.message}`)
    rows.push(...data)
    if (data.length < PAGE) return rows
  }
}

export function supabaseBackend(client: SupabaseClient): Backend {
  return {
    async load() {
      const entries = await Promise.all(
        (Object.keys(TABLE_NAMES) as Table[]).map(async (table) => {
          const rows = await fetchAll(client, table)
          return [table, rows.map((row) => mapKeys(row, toCamel, ['user_id']))] as const
        }),
      )
      return Object.fromEntries(entries) as unknown as StudyData
    },
    async apply(changes) {
      const days: StudyDay[] = []
      for (const change of changes) {
        const name = TABLE_NAMES[change.table]
        if (change.type === 'bump') {
          const { delta } = change
          const { data, error } = await client.rpc('bump_study_day', {
            p_day: change.day,
            p_reviews: delta.reviews ?? 0,
            p_quizzes: delta.quizzes ?? 0,
            p_actions: delta.actions ?? 0,
            p_new_cards: delta.newCards ?? 0,
          })
          if (!error) {
            if (data && typeof data === 'object' && !Array.isArray(data)) days.push(mapKeys(data, toCamel, ['user_id']) as unknown as StudyDay)
            continue
          }
          // A database without the function yet: save this tab's row as before.
          if (!isMissingFunction(error)) {
            if (isMissingTable(error)) continue
            throw new Error(`Kaydedilemedi: ${error.message}`)
          }
          const { error: fallback } = await client.from(name).upsert(mapKeys(change.row, toSnake))
          if (fallback && !isMissingTable(fallback) && !OPTIONAL_COLUMNS.has(missingColumn(fallback) ?? '')) throw new Error(`Kaydedilemedi: ${fallback.message}`)
          continue
        }
        if (change.type === 'upsert') {
          // A day has one row per account: rows for the same day are added up and saved onto that day.
          const source = change.table === 'studyDays' ? mergeStudyDays(change.rows as StudyDay[]) : change.rows
          const options = change.table === 'studyDays' ? { onConflict: 'user_id,day' } : undefined
          for (const rows of chunks(source, 500)) {
            let payload = rows.map((row) => mapKeys(row, toSnake))
            let { error } = await client.from(name).upsert(payload, options)
            // A column added in a later schema version (e.g. study_days.actions) may not exist yet in
            // this database; drop it and save the rest instead of failing every save until the owner
            // runs the migration.
            for (let tries = 0; error && OPTIONAL_COLUMNS.has(missingColumn(error) ?? '') && tries < 3; tries += 1) {
              const column = missingColumn(error)!
              payload = payload.map(({ [column]: _dropped, ...rest }) => rest)
              ;({ error } = await client.from(name).upsert(payload, options))
            }
            if (error && isMissingTable(error)) {
              if (change.table === 'studyDays') continue
              throw new Error(`Kaydedilemedi: veritabanında "${name}" tablosu yok. Site sahibinin supabase/schema.sql dosyasını yeniden çalıştırması gerekiyor.`)
            }
            if (error) throw new Error(`Kaydedilemedi: ${error.message}`)
          }
        } else {
          // Ids go into the URL, so keep each request short.
          for (const ids of chunks(change.ids, 100)) {
            const { error } = await client.from(name).delete().in('id', ids)
            if (error && OPTIONAL_TABLES.has(change.table) && isMissingTable(error)) continue
            if (error) throw new Error(`Silinemedi: ${error.message}`)
          }
        }
      }
      return days
    },
  }
}
