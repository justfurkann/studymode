import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'
import { supabaseBackend } from './backend'
import { emptyData } from './types'

/** Fake client whose table lacks the given columns, like a database the owner has not migrated yet. */
function clientWithoutColumns(missing: string[]) {
  const saved: Array<Record<string, unknown>> = []
  const client = {
    from: () => ({
      upsert: async (rows: Array<Record<string, unknown>>) => {
        const bad = missing.find((c) => rows.some((r) => c in r))
        if (bad) return { error: { code: 'PGRST204', message: `Could not find the '${bad}' column of 'study_days' in the schema cache` } }
        saved.push(...rows)
        return { error: null }
      },
    }),
  } as unknown as SupabaseClient
  return { client, saved }
}

describe('supabase backend before a migration', () => {
  it('saves rows without columns the database does not have yet', async () => {
    const { client, saved } = clientWithoutColumns(['actions'])
    const row = { id: 'd1', day: '2026-10-30', reviews: 1, quizzes: 0, actions: 2, createdAt: 'x', updatedAt: 'x' }
    await supabaseBackend(client).apply([{ type: 'upsert', table: 'studyDays', rows: [row] }], emptyData())
    expect(saved).toEqual([{ id: 'd1', day: '2026-10-30', reviews: 1, quizzes: 0, created_at: 'x', updated_at: 'x' }])
  })

  it('still reports other errors', async () => {
    const client = { from: () => ({ upsert: async () => ({ error: { code: '42501', message: 'permission denied' } }) }) } as unknown as SupabaseClient
    await expect(supabaseBackend(client).apply([{ type: 'upsert', table: 'notes', rows: [{ id: 'n' }] }], emptyData())).rejects.toThrow('permission denied')
  })
})
