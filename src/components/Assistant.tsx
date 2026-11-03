import { RotateCcw, Send, X } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { boldParts, buildAssistantContext, loadConversation, placeFromPath, saveConversation, type ChatMessage } from '../lib/assistant'
import { aiAvailability, useSettings } from '../lib/settings'
import { useStore } from '../lib/store'
import { freshImport } from '../lib/version'
import { Alert } from './ui'

/*
 * Fosfor, the study assistant: a little highlighter in the corner of every app page. A tap opens a
 * chat; the student picks the course and asks whatever came up while reading or solving a test,
 * without leaving for Google or another AI. Answers come from their own notes when they cover it.
 */

/** The character: a highlighter with a face. Colours follow the theme and the chosen pen. */
export function FosforCharacter({ size = 56, talking = false }: { size?: number; talking?: boolean }) {
  return (
    <svg className={`fosfor ${talking ? 'is-talking' : ''}`} width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      {/* Chisel tip and cap */}
      <path d="M25 4h14l3 9H22z" fill="var(--ink-line)" />
      <rect x="20" y="12" width="24" height="7" rx="2.5" fill="var(--ink-line)" />
      {/* Body */}
      <rect x="15" y="17" width="34" height="42" rx="13" fill="var(--hi)" stroke="var(--ink-line)" strokeWidth="3" />
      <rect x="21" y="23" width="5" height="16" rx="2.5" fill="var(--surface)" opacity="0.55" />
      {/* Face */}
      <g className="fosfor-eyes">
        <ellipse cx="27" cy="37" rx="2.6" ry="3.4" fill="var(--ink-line)" />
        <ellipse cx="37" cy="37" rx="2.6" ry="3.4" fill="var(--ink-line)" />
      </g>
      <ellipse cx="23" cy="44" rx="3" ry="1.8" fill="var(--danger)" opacity="0.28" />
      <ellipse cx="41" cy="44" rx="3" ry="1.8" fill="var(--danger)" opacity="0.28" />
      <path className="fosfor-mouth" d="M28 44 q4 4.5 8 0" stroke="var(--ink-line)" strokeWidth="2.6" fill="none" strokeLinecap="round" />
    </svg>
  )
}

const SUGGESTIONS = ['Bu konuyu kısaca anlat', 'Sınavda ne çıkabilir?', 'Bana bir soru sor', 'Bir örnekle açıkla']

function Reply({ text }: { text: string }) {
  return (
    <>
      {boldParts(text).map((part, i) => (part.bold ? <strong key={i}>{part.text}</strong> : <span key={i}>{part.text}</span>))}
    </>
  )
}

export function Assistant() {
  const store = useStore()
  const settings = useSettings()
  const { pathname } = useLocation()
  const { notes, courses } = store.data
  const place = placeFromPath(pathname, notes, courses)
  const ai = aiAvailability(settings, !!store.session)

  const [open, setOpen] = useState(false)
  const [courseId, setCourseId] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>(() => loadConversation(''))
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const log = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLTextAreaElement>(null)
  const launcher = useRef<HTMLButtonElement>(null)
  // The conversation a pending answer belongs to, in case the student switches course meanwhile.
  const activeCourse = useRef(courseId)
  activeCourse.current = courseId

  const course = courses.find((c) => c.id === courseId) ?? null

  function openPanel() {
    // Start where the student is: the course of the open note or course page.
    if (place.courseId && place.courseId !== courseId) switchCourse(place.courseId)
    else if (courseId && !courses.some((c) => c.id === courseId)) switchCourse('')
    setOpen(true)
  }

  function closePanel() {
    setOpen(false)
    launcher.current?.focus()
  }

  function switchCourse(id: string) {
    setCourseId(id)
    setMessages(loadConversation(id))
    setError('')
  }

  useEffect(() => {
    if (!open) return
    input.current?.focus()
    const onKey = (e: globalThis.KeyboardEvent) => e.key === 'Escape' && closePanel()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  useEffect(() => {
    const el = log.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, busy, error, open])

  async function ask(question: string, before: ChatMessage[]) {
    const forCourse = courseId
    const asked: ChatMessage = { id: crypto.randomUUID(), role: 'user', text: question }
    const withQuestion = [...before, asked]
    setMessages(withQuestion)
    saveConversation(forCourse, withQuestion)
    setDraft('')
    setError('')
    setBusy(true)
    try {
      const { askAssistant } = await freshImport(() => import('../lib/ai'))
      const reply = await askAssistant(
        {
          course: course?.name ?? '',
          context: buildAssistantContext(notes, forCourse || null, place.noteId),
          history: before.slice(-10).map(({ role, text }) => ({ role, text })),
          question,
        },
        settings,
      )
      const answered = [...withQuestion, { id: crypto.randomUUID(), role: 'assistant' as const, text: reply || 'Buna şu an bir cevap bulamadım. Biraz farklı sorar mısın?' }]
      saveConversation(forCourse, answered)
      if (activeCourse.current === forCourse) setMessages(answered)
    } catch (e) {
      if (activeCourse.current === forCourse) setError(e instanceof Error ? e.message : 'Cevap alınamadı. Biraz sonra yeniden dene.')
    } finally {
      setBusy(false)
    }
  }

  function submit(e?: FormEvent) {
    e?.preventDefault()
    const question = draft.trim()
    if (!question || busy || !ai.ok) return
    void ask(question, messages)
  }

  function retry() {
    const last = messages[messages.length - 1]
    if (!last || last.role !== 'user' || busy) return
    void ask(last.text, messages.slice(0, -1))
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    // Enter sends, Shift+Enter makes a new line (on phones the keyboard's return key adds a line).
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && window.matchMedia('(hover: hover)').matches) {
      e.preventDefault()
      submit()
    }
  }

  function reset() {
    setMessages([])
    saveConversation(courseId, [])
    setError('')
    input.current?.focus()
  }

  const greeting = course
    ? `Selam! Nasıl yardımcı olabilirim? ${course.name} notlarına bakarak cevaplarım.`
    : courses.length
      ? 'Selam! Nasıl yardımcı olabilirim? Yukarıdan dersini seçersen notlarına bakarak cevaplarım.'
      : 'Selam! Nasıl yardımcı olabilirim? Aklına takılan her şeyi sorabilirsin.'
  const lastIsUnanswered = messages.length > 0 && messages[messages.length - 1].role === 'user'

  return (
    <>
      {!open && (
        <button ref={launcher} type="button" className="assistant-launcher" aria-label="Fosfor’a sor: çalışma asistanı" aria-haspopup="dialog" onClick={openPanel}>
          <FosforCharacter size={46} />
        </button>
      )}
      {open && (
        <section className="assistant-panel" role="dialog" aria-label="Fosfor: çalışma asistanı">
          <header className="assistant-head">
            <FosforCharacter size={40} talking={busy} />
            <div className="grow">
              <strong>Fosfor</strong>
              <span className="subtle">Çalışma arkadaşın</span>
            </div>
            {messages.length > 0 && (
              <button type="button" className="btn btn-ghost btn-icon" aria-label="Yeni sohbet" title="Yeni sohbet" onClick={reset} disabled={busy}>
                <RotateCcw size={17} />
              </button>
            )}
            <button type="button" className="btn btn-ghost btn-icon" aria-label="Kapat" onClick={closePanel}>
              <X size={18} />
            </button>
          </header>

          <label className="assistant-course">
            <span>Hangi ders?</span>
            <select className="input" value={courseId} onChange={(e) => switchCourse(e.target.value)} disabled={busy}>
              <option value="">Genel soru (ders seçmeden)</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>

          <div className="assistant-log" ref={log} aria-live="polite">
            <div className="assistant-msg is-assistant">
              <Reply text={greeting} />
            </div>
            {messages.length === 0 && ai.ok && (
              <div className="assistant-suggestions">
                {SUGGESTIONS.map((s) => (
                  <button key={s} type="button" className="assistant-chip" onClick={() => void ask(s, messages)} disabled={busy}>
                    {s}
                  </button>
                ))}
              </div>
            )}
            {messages.map((m) => (
              <div key={m.id} className={`assistant-msg ${m.role === 'user' ? 'is-user' : 'is-assistant'}`}>
                {m.role === 'assistant' ? <Reply text={m.text} /> : m.text}
              </div>
            ))}
            {busy && (
              <div className="assistant-msg is-assistant is-typing" role="status">
                <span className="assistant-dots" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </span>
                <span className="sr-only">Fosfor yazıyor…</span>
              </div>
            )}
            {error && !busy && (
              <Alert
                tone="danger"
                action={
                  lastIsUnanswered ? (
                    <button type="button" className="btn btn-sm" onClick={retry}>
                      Tekrar dene
                    </button>
                  ) : undefined
                }
              >
                {error}
              </Alert>
            )}
          </div>

          {ai.ok ? (
            <form className="assistant-form" onSubmit={submit}>
              <textarea
                ref={input}
                className="input"
                rows={1}
                value={draft}
                maxLength={2000}
                placeholder={course ? `${course.name} hakkında sor…` : 'Sorunu yaz…'}
                aria-label="Fosfor’a sorun"
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={onKeyDown}
              />
              <button type="submit" className="btn btn-primary btn-icon" aria-label="Gönder" disabled={busy || !draft.trim()}>
                <Send size={17} />
              </button>
            </form>
          ) : (
            <div className="assistant-blocked">
              <p className="subtle">{ai.reason}</p>
              {store.session ? (
                <Link to="/ayarlar" className="btn btn-sm" onClick={() => setOpen(false)}>
                  Ayarlar’a git
                </Link>
              ) : (
                <Link to="/giris" className="btn btn-primary btn-sm" onClick={() => setOpen(false)}>
                  Giriş yap
                </Link>
              )}
            </div>
          )}
        </section>
      )}
    </>
  )
}
