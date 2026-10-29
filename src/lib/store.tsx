import type { Session } from '@supabase/supabase-js'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { clearLocalData, localBackend, readLocalData, supabaseBackend, type Backend, type Change } from './backend'
import { newCardState, schedule, type Grade } from './srs'
import { supabase } from './supabase'
import { emptyData, type Card, type Course, type GeneratedSet, type Note, type QuizAttempt, type StudyData } from './types'

export const COURSE_COLORS = ['#5b5bd6', '#0d9488', '#e5484d', '#f76b15', '#d6409f', '#3e9b4f', '#0090ff', '#8e4ec6']

type Status = 'loading' | 'ready' | 'error'

interface StoreValue {
  status: Status
  error: string
  data: StudyData
  mode: 'local' | 'cloud'
  session: Session | null
  /** Last failed save, shown to the user until dismissed. */
  saveError: string
  clearSaveError(): void
  retryLoad(): void

  addCourse(input: { name: string; color?: string; examDate?: string | null }): Course
  updateCourse(id: string, patch: Partial<Pick<Course, 'name' | 'color' | 'examDate'>>): void
  deleteCourse(id: string): void

  addNote(input: { courseId: string; title: string; content: string }): Note
  updateNote(id: string, patch: Partial<Pick<Note, 'title' | 'courseId' | 'content' | 'summary'>>): void
  deleteNote(id: string): void
  applyGenerated(noteId: string, set: GeneratedSet, generator: 'ai' | 'local'): void

  addCard(input: { courseId: string; noteId: string | null; front: string; back: string; source?: string | null }): void
  addCards(inputs: Array<{ courseId: string; noteId: string | null; front: string; back: string; source?: string | null }>): void
  updateCard(id: string, patch: Partial<Pick<Card, 'front' | 'back'>>): void
  deleteCard(id: string): void
  reviewCard(id: string, grade: Grade): void
  restoreCard(card: Card): void

  addAttempt(input: Omit<QuizAttempt, 'id' | 'createdAt'>): void

  /** Replaces everything (backup import, moving local data to an account). Rejects if saving fails. */
  replaceAll(data: StudyData): Promise<void>
}

const StoreContext = createContext<StoreValue | null>(null)

const nowIso = () => new Date().toISOString()
const uuid = () => crypto.randomUUID()

export function StoreProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [authReady, setAuthReady] = useState(!supabase)
  const [status, setStatus] = useState<Status>('loading')
  const [error, setError] = useState('')
  const [saveError, setSaveError] = useState('')
  const [data, setData] = useState<StudyData>(emptyData)
  const [loadCount, setLoadCount] = useState(0)

  const dataRef = useRef(data)
  // Saves run one after another so a note is never written before its course.
  const queue = useRef<Promise<void>>(Promise.resolve())

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data: result }) => {
      setSession(result.session)
      setAuthReady(true)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => setSession(next))
    return () => sub.subscription.unsubscribe()
  }, [])

  const userId = session?.user.id ?? null
  const backend: Backend = useMemo(() => (supabase && userId ? supabaseBackend(supabase) : localBackend), [userId])

  useEffect(() => {
    if (!authReady) return
    let cancelled = false
    setStatus('loading')
    backend
      .load()
      .then((loaded) => {
        if (cancelled) return
        dataRef.current = loaded
        setData(loaded)
        setStatus('ready')
      })
      .catch((e: unknown) => {
        if (cancelled) return
        setError(e instanceof Error ? e.message : 'Veriler yüklenemedi.')
        setStatus('error')
      })
    return () => {
      cancelled = true
    }
  }, [backend, authReady, loadCount])

  const commit = useCallback(
    (next: StudyData, changes: Change[]) => {
      dataRef.current = next
      setData(next)
      queue.current = queue.current
        .then(() => backend.apply(changes, next))
        .catch((e: unknown) => setSaveError(e instanceof Error ? e.message : 'Değişiklik kaydedilemedi.'))
    },
    [backend],
  )

  const value = useMemo<StoreValue>(() => {
    const current = () => dataRef.current

    const makeCards = (inputs: Parameters<StoreValue['addCards']>[0]): Card[] => {
      const now = new Date()
      return inputs.map((input) => ({
        id: uuid(),
        courseId: input.courseId,
        noteId: input.noteId,
        front: input.front.trim(),
        back: input.back.trim(),
        source: input.source ?? null,
        ...newCardState(now),
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      }))
    }

    const addCards: StoreValue['addCards'] = (inputs) => {
      const d = current()
      const cards = makeCards(inputs)
      commit({ ...d, cards: [...d.cards, ...cards] }, [{ type: 'upsert', table: 'cards', rows: cards }])
    }

    return {
      status,
      error,
      data,
      mode: userId ? 'cloud' : 'local',
      session,
      saveError,
      clearSaveError: () => setSaveError(''),
      retryLoad: () => setLoadCount((n) => n + 1),

      addCourse({ name, color, examDate = null }) {
        const d = current()
        const course: Course = {
          id: uuid(),
          name: name.trim(),
          color: color ?? COURSE_COLORS[d.courses.length % COURSE_COLORS.length],
          examDate,
          createdAt: nowIso(),
          updatedAt: nowIso(),
        }
        commit({ ...d, courses: [...d.courses, course] }, [{ type: 'upsert', table: 'courses', rows: [course] }])
        return course
      },

      updateCourse(id, patch) {
        const d = current()
        const course = d.courses.find((c) => c.id === id)
        if (!course) return
        const updated = { ...course, ...patch, updatedAt: nowIso() }
        commit({ ...d, courses: d.courses.map((c) => (c.id === id ? updated : c)) }, [{ type: 'upsert', table: 'courses', rows: [updated] }])
      },

      deleteCourse(id) {
        const d = current()
        // The database cascades; locally we drop the children ourselves.
        commit(
          {
            courses: d.courses.filter((c) => c.id !== id),
            notes: d.notes.filter((n) => n.courseId !== id),
            cards: d.cards.filter((c) => c.courseId !== id),
            attempts: d.attempts.filter((a) => a.courseId !== id),
          },
          [{ type: 'delete', table: 'courses', ids: [id] }],
        )
      },

      addNote({ courseId, title, content }) {
        const d = current()
        const note: Note = {
          id: uuid(),
          courseId,
          title: title.trim(),
          content,
          summary: null,
          questions: [],
          practice: [],
          generator: null,
          createdAt: nowIso(),
          updatedAt: nowIso(),
        }
        commit({ ...d, notes: [...d.notes, note] }, [{ type: 'upsert', table: 'notes', rows: [note] }])
        return note
      },

      updateNote(id, patch) {
        const d = current()
        const note = d.notes.find((n) => n.id === id)
        if (!note) return
        const updated = { ...note, ...patch, updatedAt: nowIso() }
        const movedCards =
          patch.courseId && patch.courseId !== note.courseId
            ? d.cards.filter((c) => c.noteId === id).map((c) => ({ ...c, courseId: patch.courseId!, updatedAt: nowIso() }))
            : []
        const movedAttempts = patch.courseId && patch.courseId !== note.courseId
          ? d.attempts.filter(a => a.noteId === id).map(a => ({ ...a, courseId: patch.courseId! })) : []
        const movedIds = new Set(movedCards.map((c) => c.id))
        commit(
          {
            ...d,
            notes: d.notes.map((n) => (n.id === id ? updated : n)),
            cards: d.cards.map((c) => (movedIds.has(c.id) ? movedCards.find((m) => m.id === c.id)! : c)),
            attempts: d.attempts.map(a => movedAttempts.find(m => m.id === a.id) ?? a),
          },
          [
            { type: 'upsert', table: 'notes', rows: [updated] },
            { type: 'upsert', table: 'cards', rows: movedCards },
            { type: 'upsert', table: 'attempts', rows: movedAttempts },
          ],
        )
      },

      deleteNote(id) {
        const d = current()
        commit(
          {
            ...d,
            notes: d.notes.filter((n) => n.id !== id),
            cards: d.cards.filter((c) => c.noteId !== id),
            attempts: d.attempts.filter((a) => a.noteId !== id),
          },
          [{ type: 'delete', table: 'notes', ids: [id] }],
        )
      },

      applyGenerated(noteId, set, generator) {
        const d = current()
        const note = d.notes.find((n) => n.id === noteId)
        if (!note) return
        const updated: Note = {
          ...note,
          summary: { ...set.summary, tags: note.summary?.tags, sourceChanged: false },
          questions: set.questions,
          practice: set.practice,
          generator,
          updatedAt: nowIso(),
        }
        // Regenerating replaces cards nobody has studied yet; studied cards keep their progress.
        const stale = d.cards.filter((c) => c.noteId === noteId && c.reps === 0 && c.lapses === 0)
        const staleIds = new Set(stale.map((c) => c.id))
        const kept = d.cards.filter((c) => c.noteId === noteId && !staleIds.has(c.id))
        const keptFronts = new Set(kept.map((c) => c.front))
        const fresh = makeCards(
          set.cards
            .filter((c) => !keptFronts.has(c.front))
            .map((c) => ({ ...c, courseId: note.courseId, noteId })),
        )
        commit(
          {
            ...d,
            notes: d.notes.map((n) => (n.id === noteId ? updated : n)),
            cards: [...d.cards.filter((c) => !staleIds.has(c.id)), ...fresh],
          },
          [
            { type: 'upsert', table: 'notes', rows: [updated] },
            { type: 'delete', table: 'cards', ids: [...staleIds] },
            { type: 'upsert', table: 'cards', rows: fresh },
          ],
        )
      },

      addCard: (input) => addCards([input]),
      addCards,

      updateCard(id, patch) {
        const d = current()
        const card = d.cards.find((c) => c.id === id)
        if (!card) return
        const updated = { ...card, ...patch, updatedAt: nowIso() }
        commit({ ...d, cards: d.cards.map((c) => (c.id === id ? updated : c)) }, [{ type: 'upsert', table: 'cards', rows: [updated] }])
      },

      deleteCard(id) {
        const d = current()
        commit({ ...d, cards: d.cards.filter((c) => c.id !== id) }, [{ type: 'delete', table: 'cards', ids: [id] }])
      },

      restoreCard(card) {
        const d = current()
        if (!d.cards.some(c => c.id === card.id)) return
        const restored = { ...card, updatedAt: nowIso() }
        commit({ ...d, cards: d.cards.map(c => c.id === card.id ? restored : c) }, [{ type: 'upsert', table: 'cards', rows: [restored] }])
      },

      reviewCard(id, grade) {
        const d = current()
        const card = d.cards.find((c) => c.id === id)
        if (!card) return
        const exam = d.courses.find((c) => c.id === card.courseId)?.examDate ?? null
        const updated = { ...card, ...schedule(card, grade, new Date(), exam), updatedAt: nowIso() }
        commit({ ...d, cards: d.cards.map((c) => (c.id === id ? updated : c)) }, [{ type: 'upsert', table: 'cards', rows: [updated] }])
      },

      addAttempt(input) {
        const d = current()
        const attempt: QuizAttempt = { ...input, id: uuid(), createdAt: nowIso() }
        commit({ ...d, attempts: [...d.attempts, attempt] }, [{ type: 'upsert', table: 'attempts', rows: [attempt] }])
      },

      async replaceAll(next) {
        const d = current()
        const gone = (old: Array<{ id: string }>, fresh: Array<{ id: string }>) => {
          const keep = new Set(fresh.map((x) => x.id))
          return old.filter((x) => !keep.has(x.id)).map((x) => x.id)
        }
        // Write the new data before deleting anything, so a failed save cannot lose both copies.
        const changes: Change[] = [
          { type: 'upsert', table: 'courses', rows: next.courses },
          { type: 'upsert', table: 'notes', rows: next.notes },
          { type: 'upsert', table: 'cards', rows: next.cards },
          { type: 'upsert', table: 'attempts', rows: next.attempts },
          { type: 'delete', table: 'attempts', ids: gone(d.attempts, next.attempts) },
          { type: 'delete', table: 'cards', ids: gone(d.cards, next.cards) },
          { type: 'delete', table: 'notes', ids: gone(d.notes, next.notes) },
          { type: 'delete', table: 'courses', ids: gone(d.courses, next.courses) },
        ]
        dataRef.current = next
        setData(next)
        const run = queue.current.then(() => backend.apply(changes, next))
        queue.current = run.catch(() => undefined)
        await run
      },
    }
  }, [status, error, data, userId, session, saveError, commit, backend])

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore(): StoreValue {
  const value = useContext(StoreContext)
  if (!value) throw new Error('useStore must be used inside StoreProvider')
  return value
}

/** Moves data saved in this browser into the signed-in account, then clears the local copy. */
export async function migrateLocalToCloud(store: StoreValue) {
  const local = readLocalData()
  const d = store.data
  await store.replaceAll({
    courses: [...d.courses, ...local.courses.filter((c) => !d.courses.some((x) => x.id === c.id))],
    notes: [...d.notes, ...local.notes.filter((n) => !d.notes.some((x) => x.id === n.id))],
    cards: [...d.cards, ...local.cards.filter((c) => !d.cards.some((x) => x.id === c.id))],
    attempts: [...d.attempts, ...local.attempts.filter((a) => !d.attempts.some((x) => x.id === a.id))],
  })
  clearLocalData()
}
