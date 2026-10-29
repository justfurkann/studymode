import type { SupabaseClient } from '@supabase/supabase-js'
import { emptyData, type StudyData } from './types'

export type Table = 'courses' | 'notes' | 'cards' | 'attempts'

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
  return { courses: data.courses, notes: data.notes, cards: data.cards, attempts: data.attempts } as StudyData
}

// ---------- Supabase (account, synced across devices) ----------

const TABLE_NAMES: Record<Table, string> = {
  courses: 'courses',
  notes: 'notes',
  cards: 'cards',
  attempts: 'quiz_attempts',
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

async function fetchAll(client: SupabaseClient, table: string) {
  const rows: Record<string, unknown>[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await client.from(table).select('*').order('created_at').range(from, from + PAGE - 1)
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
          const rows = await fetchAll(client, TABLE_NAMES[table])
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
            if (error) throw new Error(`Kaydedilemedi: ${error.message}`)
          }
        } else {
          // Ids go into the URL, so keep each request short.
          for (const ids of chunks(change.ids, 100)) {
            const { error } = await client.from(name).delete().in('id', ids)
            if (error) throw new Error(`Silinemedi: ${error.message}`)
          }
        }
      }
    },
  }
}
