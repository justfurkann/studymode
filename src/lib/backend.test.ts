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

describe('study_days: deltas, not whole rows', () => {
  const row = { id: 'd1', day: '2026-11-26', reviews: 4, quizzes: 0, actions: 0, newCards: 1, createdAt: 'x', updatedAt: 'x' }

  it('sends a review as +1 through bump_study_day and hands back the server row (with the phone’s counts)', async () => {
    const calls: Array<[string, Record<string, unknown>]> = []
    const client = {
      rpc: async (fn: string, args: Record<string, unknown>) => {
        calls.push([fn, args])
        return { data: { id: 'server', user_id: 'u', day: '2026-11-26', reviews: 9, quizzes: 0, actions: 0, new_cards: 2, created_at: 'x', updated_at: 'y' }, error: null }
      },
      from: () => {
        throw new Error('no table writes')
      },
    } as unknown as SupabaseClient
    const days = await supabaseBackend(client).apply([{ type: 'bump', table: 'studyDays', day: '2026-11-26', delta: { reviews: 1, newCards: 1 }, row }], emptyData())
    expect(calls).toEqual([['bump_study_day', { p_day: '2026-11-26', p_reviews: 1, p_quizzes: 0, p_actions: 0, p_new_cards: 1 }]])
    expect(days).toEqual([{ id: 'server', day: '2026-11-26', reviews: 9, quizzes: 0, actions: 0, newCards: 2, createdAt: 'x', updatedAt: 'y' }])
  })

  it('falls back to saving the row when the database has no bump_study_day yet', async () => {
    const saved: unknown[] = []
    const client = {
      rpc: async () => ({ data: null, error: { code: 'PGRST202', message: 'Could not find the function' } }),
      from: () => ({ upsert: async (r: unknown) => (saved.push(r), { error: null }) }),
    } as unknown as SupabaseClient
    await supabaseBackend(client).apply([{ type: 'bump', table: 'studyDays', day: row.day, delta: { reviews: 1 }, row }], emptyData())
    expect(saved).toEqual([{ id: 'd1', day: '2026-11-26', reviews: 4, quizzes: 0, actions: 0, new_cards: 1, created_at: 'x', updated_at: 'x' }])
  })

  it('a backup or a guest move adds up rows of the same day and saves them onto that day', async () => {
    const calls: Array<[unknown, unknown]> = []
    const client = { from: () => ({ upsert: async (rows: unknown, options: unknown) => (calls.push([rows, options]), { error: null }) }) } as unknown as SupabaseClient
    await supabaseBackend(client).apply([{ type: 'upsert', table: 'studyDays', rows: [row, { ...row, id: 'd2', reviews: 2, newCards: 0 }] }], emptyData())
    expect(calls).toEqual([[[expect.objectContaining({ id: 'd1', day: '2026-11-26', reviews: 6, new_cards: 1 })], { onConflict: 'user_id,day' }]])
  })
})
