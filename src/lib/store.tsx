import type { Session } from '@supabase/supabase-js'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { clearLocalData, localBackend, readLocalData, supabaseBackend, type Backend, type Change } from './backend'
import { newCardState, schedule, type Grade } from './srs'
import { examDateForCard, nextExamDate } from './courseExams'
import { mergeStudyDays, recordStudyActivity } from './streak'
import type { ShareSnapshot } from './share'
import { supabase } from './supabase'
import { emptyData, type Card, type Course, type CourseExam, type ExamRecord, type GeneratedSet, type Note, type PracticeItem, type QuizAttempt, type StudyData } from './types'

export const COURSE_COLORS = ['#0f9b8e', '#e5484d', '#f08c00', '#d6409f', '#2f9e44', '#3b6fe0', '#8e4ec6', '#1b2250']

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
  /** Counts other study work (a written answer, an explanation) toward today's streak. */
  /** Replaces a course's exams (vize, final…) with `drafts`; drafts without an id are new. */
  saveCourseExams(courseId: string, drafts: CourseExamDraft[]): void
  recordActivity(): void
  /** Saves the student's written answer and its latest grading for one open question. */
  updatePractice(noteId: string, itemId: string, patch: Partial<Pick<PracticeItem, 'draft' | 'evaluation'>>, countsAsActivity?: boolean): void
  addExam(input: Omit<ExamRecord, 'id' | 'createdAt'>): ExamRecord
  deleteExam(id: string): void
  /** Copies a course a friend shared into this account, with fresh progress. */
  importCourse(snapshot: ShareSnapshot): Course

  /** Replaces everything (backup import, moving local data to an account). Rejects if saving fails. */
  replaceAll(data: StudyData): Promise<void>
}

/** A course exam as edited in the form; `id` is set when editing an existing one. */
export type CourseExamDraft = Pick<CourseExam, 'kind' | 'date' | 'noteIds'> & { id?: string; title?: string | null; weight?: number | null }

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
            exams: d.exams.filter((e) => e.courseId !== id),
            studyDays: d.studyDays,
            courseExams: d.courseExams.filter((e) => e.courseId !== id),
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
        // An exam that only covered this note would silently start covering the whole course, so it
        // keeps its other notes and just loses this one.
        const touched = d.courseExams
          .filter((e) => e.noteIds.includes(id))
          .map((e) => ({ ...e, noteIds: e.noteIds.filter((n) => n !== id), updatedAt: nowIso() }))
        commit(
          {
            ...d,
            notes: d.notes.filter((n) => n.id !== id),
            cards: d.cards.filter((c) => c.noteId !== id),
            attempts: d.attempts.filter((a) => a.noteId !== id),
            courseExams: d.courseExams.map((e) => touched.find((t) => t.id === e.id) ?? e),
          },
          [
            { type: 'delete', table: 'notes', ids: [id] },
            { type: 'upsert', table: 'courseExams', rows: touched },
          ],
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
        const activity = recordStudyActivity(d.studyDays, { reviews: -1 })
        commit(
          { ...d, cards: d.cards.map(c => c.id === card.id ? restored : c), studyDays: activity.studyDays },
          [
            { type: 'upsert', table: 'cards', rows: [restored] },
            { type: 'upsert', table: 'studyDays', rows: [activity.updated] },
          ],
        )
      },

      reviewCard(id, grade) {
        const d = current()
        const card = d.cards.find((c) => c.id === id)
        if (!card) return
        const now = new Date()
        const exam = examDateForCard(d, card, now)
        const updated = { ...card, ...schedule(card, grade, now, exam), updatedAt: now.toISOString() }
        const activity = recordStudyActivity(d.studyDays, { reviews: 1 }, now)
        commit(
          { ...d, cards: d.cards.map((c) => (c.id === id ? updated : c)), studyDays: activity.studyDays },
          [
            { type: 'upsert', table: 'cards', rows: [updated] },
            { type: 'upsert', table: 'studyDays', rows: [activity.updated] },
          ],
        )
      },

      addAttempt(input) {
        const d = current()
        const now = new Date()
        const attempt: QuizAttempt = { ...input, id: uuid(), createdAt: now.toISOString() }
        const activity = recordStudyActivity(d.studyDays, { quizzes: 1 }, now)
        commit(
          { ...d, attempts: [...d.attempts, attempt], studyDays: activity.studyDays },
          [
            { type: 'upsert', table: 'attempts', rows: [attempt] },
            { type: 'upsert', table: 'studyDays', rows: [activity.updated] },
          ],
        )
      },

      saveCourseExams(courseId, drafts) {
        const d = current()
        const course = d.courses.find((c) => c.id === courseId)
        if (!course) return
        const existing = d.courseExams.filter((e) => e.courseId === courseId)
        const now = nowIso()
        const next: CourseExam[] = drafts.map((draft) => {
          const old = draft.id ? existing.find((e) => e.id === draft.id) : undefined
          return {
            id: old?.id ?? uuid(),
            courseId,
            kind: draft.kind,
            title: draft.title?.trim() || null,
            date: draft.date,
            weight: draft.weight ?? null,
            noteIds: draft.noteIds,
            createdAt: old?.createdAt ?? now,
            updatedAt: now,
          }
        })
        const removed = existing.filter((e) => !next.some((n) => n.id === e.id)).map((e) => e.id)
        // The old single date column follows the nearest upcoming exam, so older code paths and
        // databases without course_exams still see the next exam.
        const updatedCourse = { ...course, examDate: nextExamDate(next), updatedAt: now }
        commit(
          {
            ...d,
            courses: d.courses.map((c) => (c.id === courseId ? updatedCourse : c)),
            courseExams: [...d.courseExams.filter((e) => e.courseId !== courseId), ...next],
          },
          [
            { type: 'upsert', table: 'courses', rows: [updatedCourse] },
            { type: 'upsert', table: 'courseExams', rows: next },
            { type: 'delete', table: 'courseExams', ids: removed },
          ],
        )
      },

      importCourse(snapshot) {
        const d = current()
        const now = nowIso()
        // A friend's "Biyoloji" next to your own "Biyoloji" would be confusing.
        const taken = new Set(d.courses.map((c) => c.name.toLocaleLowerCase('tr-TR')))
        const name = taken.has(snapshot.course.name.toLocaleLowerCase('tr-TR')) ? `${snapshot.course.name} (paylaşılan)`.slice(0, 120) : snapshot.course.name
        const course: Course = {
          id: uuid(),
          name,
          color: COURSE_COLORS.includes(snapshot.course.color) ? snapshot.course.color : COURSE_COLORS[d.courses.length % COURSE_COLORS.length],
          examDate: null,
          createdAt: now,
          updatedAt: now,
        }
        const notes: Note[] = snapshot.notes.map((n) => ({
          id: uuid(),
          courseId: course.id,
          title: n.title,
          content: n.content,
          summary: n.summary ? { ...n.summary } : null,
          questions: n.questions.map((q) => ({ ...q, id: uuid() })),
          practice: n.practice.map((p) => ({ ...p, id: uuid() })),
          generator: n.generator,
          createdAt: now,
          updatedAt: now,
        }))
        const cards = makeCards(snapshot.cards.map((c) => ({ courseId: course.id, noteId: c.note === null ? null : notes[c.note].id, front: c.front, back: c.back, source: c.source })))
        const exams: CourseExam[] = snapshot.exams.map((e) => ({
          id: uuid(),
          courseId: course.id,
          kind: e.kind,
          title: e.title,
          date: e.date,
          weight: e.weight,
          noteIds: e.notes.map((i) => notes[i].id),
          createdAt: now,
          updatedAt: now,
        }))
        const withExam = { ...course, examDate: nextExamDate(exams) }
        commit(
          { ...d, courses: [...d.courses, withExam], notes: [...d.notes, ...notes], cards: [...d.cards, ...cards], courseExams: [...d.courseExams, ...exams] },
          [
            { type: 'upsert', table: 'courses', rows: [withExam] },
            { type: 'upsert', table: 'notes', rows: notes },
            { type: 'upsert', table: 'cards', rows: cards },
            { type: 'upsert', table: 'courseExams', rows: exams },
          ],
        )
        return withExam
      },

      recordActivity() {
        const d = current()
        const activity = recordStudyActivity(d.studyDays, { actions: 1 })
        commit({ ...d, studyDays: activity.studyDays }, [{ type: 'upsert', table: 'studyDays', rows: [activity.updated] }])
      },

      updatePractice(noteId, itemId, patch, countsAsActivity = false) {
        const d = current()
        const note = d.notes.find((n) => n.id === noteId)
        if (!note || !note.practice.some((p) => p.id === itemId)) return
        const updated: Note = { ...note, practice: note.practice.map((p) => (p.id === itemId ? { ...p, ...patch } : p)), updatedAt: nowIso() }
        const activity = countsAsActivity ? recordStudyActivity(d.studyDays, { actions: 1 }) : null
        commit(
          { ...d, notes: d.notes.map((n) => (n.id === noteId ? updated : n)), studyDays: activity ? activity.studyDays : d.studyDays },
          [
            { type: 'upsert', table: 'notes', rows: [updated] },
            ...(activity ? [{ type: 'upsert' as const, table: 'studyDays' as const, rows: [activity.updated] }] : []),
          ],
        )
      },

      addExam(input) {
        const d = current()
        const now = new Date()
        const exam: ExamRecord = { ...input, id: uuid(), createdAt: now.toISOString() }
        const activity = recordStudyActivity(d.studyDays, { quizzes: 1 }, now)
        commit(
          { ...d, exams: [...d.exams, exam], studyDays: activity.studyDays },
          [
            { type: 'upsert', table: 'exams', rows: [exam] },
            { type: 'upsert', table: 'studyDays', rows: [activity.updated] },
          ],
        )
        return exam
      },

      deleteExam(id) {
        const d = current()
        commit({ ...d, exams: d.exams.filter((e) => e.id !== id) }, [{ type: 'delete', table: 'exams', ids: [id] }])
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
          { type: 'upsert', table: 'exams', rows: next.exams },
          { type: 'upsert', table: 'courseExams', rows: next.courseExams },
          { type: 'delete', table: 'courseExams', ids: gone(d.courseExams, next.courseExams) },
          { type: 'upsert', table: 'studyDays', rows: next.studyDays },
          { type: 'delete', table: 'studyDays', ids: gone(d.studyDays, next.studyDays) },
          { type: 'delete', table: 'exams', ids: gone(d.exams, next.exams) },
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
    exams: [...d.exams, ...local.exams.filter((e) => !d.exams.some((x) => x.id === e.id))],
    studyDays: mergeStudyDays([...d.studyDays, ...local.studyDays]),
    courseExams: [...d.courseExams, ...local.courseExams.filter((e) => !d.courseExams.some((x) => x.id === e.id))],
  })
  clearLocalData()
}
