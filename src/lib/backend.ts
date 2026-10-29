import type { SupabaseClient } from '@supabase/supabase-js'
import { emptyData, type StudyData } from './types'

export type Table = 'courses' | 'notes' | 'cards' | 'attempts' | 'exams' | 'studyDays'

export type Change =
  | { type: 'upsert'; table: Table; rows: object[] }
  | { type: 'delete'; table: Table; ids: string[] }

/** Where study data lives. The store applies changes to memory first, then hands them here. */
export interface Backend {
  load(): Promise<StudyData>
  apply(changes: Change[], next: StudyData): Promise<void>
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
  return { courses: data.courses, notes: data.notes, cards: data.cards, attempts: data.attempts, exams, studyDays } as StudyData
}

// ---------- Supabase (account, synced across devices) ----------

const TABLE_NAMES: Record<Table, string> = {
  courses: 'courses',
  notes: 'notes',
  cards: 'cards',
  attempts: 'quiz_attempts',
  exams: 'exam_results',
  studyDays: 'study_days',
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

/** PostgREST / Postgres codes for "this table does not exist". */
const isMissingTable = (error: { code?: string }) => error.code === 'PGRST205' || error.code === '42P01'

/** Tables added after the first schema; an account whose database lacks them still loads. */
const OPTIONAL_TABLES = new Set<Table>(['exams', 'studyDays'])

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
      for (const change of changes) {
        const name = TABLE_NAMES[change.table]
        if (change.type === 'upsert') {
          for (const rows of chunks(change.rows, 500)) {
            const { error } = await client.from(name).upsert(rows.map((row) => mapKeys(row, toSnake)))
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
    },
  }
}
