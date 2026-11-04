import { BookOpen, Check, Clock, Copy, Lightbulb, ListChecks, Map as MapIcon, MessageCircleQuestion, RotateCcw, Send, SquarePlus, Target, X, type LucideIcon } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  boldParts,
  buildAssistantContext,
  cardFromAnswer,
  clearConversations,
  loadConversation,
  placeFromPath,
  plainReply,
  replyBlocks,
  saveConversation,
  selectionQuestion,
  suggestionsFor,
  type ChatMessage,
  type SuggestionIcon,
} from '../lib/assistant'
import { aiAvailability, useSettings } from '../lib/settings'
import { useStore } from '../lib/store'
import { freshImport } from '../lib/version'
import { Alert } from './ui'

/*
 * Fosfor, the study assistant: a little highlighter in the corner of every app page. A tap opens a
 * chat; the student picks the course and asks whatever came up while reading or solving a test,
 * without leaving for Google or another AI. Answers come from their own notes when they cover it.
 * Selecting a bit of text on the page offers "Fosfor’a sor" right there; a good answer can become
 * a study card in one tap.
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

const SUGGESTION_ICONS: Record<SuggestionIcon, LucideIcon> = { list: ListChecks, quiz: MessageCircleQuestion, bulb: Lightbulb, target: Target, map: MapIcon, clock: Clock }

function Inline({ text }: { text: string }) {
  return (
    <>
      {boldParts(text).map((part, i) => (part.bold ? <strong key={i}>{part.text}</strong> : <span key={i}>{part.text}</span>))}
    </>
  )
}

/** A reply with its paragraphs and lists. */
function Reply({ text }: { text: string }) {
  return (
    <>
      {replyBlocks(text).map((block, i) =>
        block.kind === 'p' ? (
          <p key={i}>
            <Inline text={block.text} />
          </p>
        ) : block.kind === 'ul' ? (
          <ul key={i}>
            {block.items.map((item, j) => (
              <li key={j}>
                <Inline text={item} />
              </li>
            ))}
          </ul>
        ) : (
          <ol key={i}>
            {block.items.map((item, j) => (
              <li key={j}>
                <Inline text={item} />
              </li>
            ))}
          </ol>
        ),
      )}
    </>
  )
}

/** Where a selection on the page can be asked about: not in a box the student is typing in, not in Fosfor itself. */
function selectionToAsk(): { text: string; rect: DOMRect } | null {
  const sel = window.getSelection()
  if (!sel || sel.isCollapsed || sel.rangeCount === 0) return null
  const text = sel.toString().trim()
  if (text.length < 2) return null
  const node = sel.anchorNode
  const el = node instanceof Element ? node : node?.parentElement
  if (!el || !el.closest('main') || el.closest('input, textarea, select, [contenteditable="true"], .assistant-panel')) return null
  const rect = sel.getRangeAt(0).getBoundingClientRect()
  if (!rect.width && !rect.height) return null
  return { text, rect }
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
  const [copied, setCopied] = useState('')
  const [picked, setPicked] = useState<{ text: string; x: number; y: number; below: boolean } | null>(null)
  const log = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLTextAreaElement>(null)
  const launcher = useRef<HTMLButtonElement>(null)
  // The conversation a pending answer belongs to, in case the student switches course meanwhile.
  const activeCourse = useRef(courseId)
  activeCourse.current = courseId

  const course = courses.find((c) => c.id === courseId) ?? null
  const openNote = place.noteId && place.courseId === courseId ? notes.find((n) => n.id === place.noteId) ?? null : null
  const suggestions = suggestionsFor(openNote ? 'note' : course ? 'course' : 'general')

  // Signing out forgets the conversations on this device.
  const hadSession = useRef(!!store.session)
  useEffect(() => {
    if (hadSession.current && !store.session) {
      clearConversations()
      setMessages([])
    }
    hadSession.current = !!store.session
  }, [store.session])

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
    activeCourse.current = id
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

  // The box grows with what is typed, up to a few lines.
  useEffect(() => {
    const el = input.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`
  }, [draft, open])

  // Selecting text on the page offers a small "Fosfor’a sor" button next to it.
  useEffect(() => {
    let timer = 0
    const update = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        const found = selectionToAsk()
        if (!found) return setPicked(null)
        const touch = window.matchMedia('(hover: none)').matches
        // On phones the system's copy menu sits above the selection, so the button goes below it.
        const below = touch || found.rect.top < 70
        const x = Math.min(Math.max(found.rect.left + found.rect.width / 2, 80), window.innerWidth - 80)
        const y = below ? found.rect.bottom + 10 : found.rect.top - 10
        setPicked({ text: found.text, x, y, below })
      }, 180)
    }
    const hide = () => setPicked(null)
    document.addEventListener('selectionchange', update)
    window.addEventListener('scroll', hide, true)
    window.addEventListener('resize', hide)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('selectionchange', update)
      window.removeEventListener('scroll', hide, true)
      window.removeEventListener('resize', hide)
    }
  }, [])

  useEffect(() => setPicked(null), [pathname])

  async function ask(question: string, before: ChatMessage[], forCourse = courseId) {
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
          course: courses.find((c) => c.id === forCourse)?.name ?? '',
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

  function askAboutSelection() {
    if (!picked) return
    const question = selectionQuestion(picked.text)
    setPicked(null)
    window.getSelection()?.removeAllRanges()
    const target = place.courseId ?? (courses.some((c) => c.id === courseId) ? courseId : '')
    if (target !== courseId) switchCourse(target)
    setOpen(true)
    if (!ai.ok || busy) {
      setDraft(question)
      return
    }
    void ask(question, loadConversation(target), target)
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

  async function copy(m: ChatMessage) {
    try {
      await navigator.clipboard.writeText(plainReply(m.text))
      setCopied(m.id)
      window.setTimeout(() => setCopied((id) => (id === m.id ? '' : id)), 1600)
    } catch {
      // Copying is blocked here; the text can still be selected by hand.
    }
  }

  function toCard(m: ChatMessage, index: number) {
    if (!course || m.carded) return
    const question = [...messages.slice(0, index)].reverse().find((x) => x.role === 'user')?.text ?? 'Fosfor’un açıklaması'
    const { front, back } = cardFromAnswer(question, m.text)
    store.addCard({ courseId: course.id, noteId: openNote?.id ?? null, front, back, source: 'Fosfor' })
    const next = messages.map((x) => (x.id === m.id ? { ...x, carded: true } : x))
    setMessages(next)
    saveConversation(courseId, next)
  }

  const greeting = course
    ? `Selam! Nasıl yardımcı olabilirim? ${course.name} notlarına bakarak cevaplarım.`
    : courses.length
      ? 'Selam! Nasıl yardımcı olabilirim? Yukarıdan dersini seçersen notlarına bakarak cevaplarım.'
      : 'Selam! Nasıl yardımcı olabilirim? Aklına takılan her şeyi sorabilirsin.'
  const lastIsUnanswered = messages.length > 0 && messages[messages.length - 1].role === 'user'

  return (
    <>
      {picked && (
        <button
          type="button"
          className={`assistant-ask-selection ${picked.below ? 'is-below' : ''}`}
          style={{ left: picked.x, top: picked.y }}
          // Keeps the selection while the button is pressed.
          onPointerDown={(e) => e.preventDefault()}
          onMouseDown={(e) => e.preventDefault()}
          onClick={askAboutSelection}
        >
          <FosforCharacter size={20} />
          Fosfor’a sor
        </button>
      )}
      {!open && (
        <button ref={launcher} type="button" className="assistant-launcher" aria-label="Fosfor’a sor: çalışma asistanı" aria-haspopup="dialog" onClick={openPanel}>
          <FosforCharacter size={46} />
        </button>
      )}
      {open && (
        <section className="assistant-panel" role="dialog" aria-label="Fosfor: çalışma asistanı">
          <header className="assistant-head">
            <span className="assistant-head-avatar">
              <FosforCharacter size={38} talking={busy} />
            </span>
            <div className="grow">
              <strong>Fosfor</strong>
              <span className="assistant-status">
                <i aria-hidden="true" />
                {busy ? 'Düşünüyor…' : openNote ? 'Açık notuna bakıyor' : course ? 'Ders notlarına bakıyor' : 'Çalışma arkadaşın'}
              </span>
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

          <div className="assistant-context">
            <label className="assistant-course">
              <BookOpen size={16} aria-hidden="true" />
              <span className="sr-only">Hangi ders?</span>
              <select value={courseId} onChange={(e) => switchCourse(e.target.value)} disabled={busy}>
                <option value="">Genel soru (ders seçmeden)</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            {openNote && (
              <span className="assistant-note" title={openNote.title}>
                Açık not: <strong>{openNote.title}</strong>
              </span>
            )}
          </div>

          <div className="assistant-log" ref={log} aria-live="polite">
            {messages.length === 0 ? (
              <div className="assistant-hello">
                <FosforCharacter size={64} />
                <p className="assistant-hello-title">Selam, ben Fosfor!</p>
                <p className="subtle">{greeting.replace(/^Selam! /, '')}</p>
                {ai.ok && (
                  <div className="assistant-suggestions">
                    {suggestions.map((s) => {
                      const Icon = SUGGESTION_ICONS[s.icon]
                      return (
                        <button key={s.label} type="button" className="assistant-chip" onClick={() => void ask(s.label, messages)} disabled={busy}>
                          <span className="assistant-chip-icon" aria-hidden="true">
                            <Icon size={15} />
                          </span>
                          {s.label}
                        </button>
                      )
                    })}
                  </div>
                )}
                {ai.ok && <p className="assistant-tip">İpucu: Sayfada bir yeri seçip “Fosfor’a sor”a dokunabilirsin.</p>}
              </div>
            ) : (
              <div className="assistant-row is-assistant">
                <span className="assistant-avatar" aria-hidden="true">
                  <FosforCharacter size={24} />
                </span>
                <div className="assistant-msg is-assistant">
                  <p>{greeting}</p>
                </div>
              </div>
            )}
            {messages.map((m, i) =>
              m.role === 'user' ? (
                <div key={m.id} className="assistant-msg is-user">
                  {m.text}
                </div>
              ) : (
                <div key={m.id} className="assistant-row is-assistant">
                  <span className="assistant-avatar" aria-hidden="true">
                    <FosforCharacter size={24} />
                  </span>
                  <div className="assistant-bubble">
                    <div className="assistant-msg is-assistant">
                      <Reply text={m.text} />
                    </div>
                    <div className="assistant-actions">
                      <button type="button" onClick={() => void copy(m)}>
                        {copied === m.id ? <Check size={14} /> : <Copy size={14} />}
                        {copied === m.id ? 'Kopyalandı' : 'Kopyala'}
                      </button>
                      {course && (
                        <button type="button" onClick={() => toCard(m, i)} disabled={m.carded}>
                          {m.carded ? <Check size={14} /> : <SquarePlus size={14} />}
                          {m.carded ? 'Kartta' : 'Karta çevir'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ),
            )}
            {busy && (
              <div className="assistant-row is-assistant" role="status">
                <span className="assistant-avatar" aria-hidden="true">
                  <FosforCharacter size={24} talking />
                </span>
                <div className="assistant-msg is-assistant is-typing">
                  <span className="assistant-dots" aria-hidden="true">
                    <i />
                    <i />
                    <i />
                  </span>
                  <span className="sr-only">Fosfor yazıyor…</span>
                </div>
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
                rows={1}
                value={draft}
                maxLength={2000}
                placeholder={openNote ? 'Bu not hakkında sor…' : course ? `${course.name} hakkında sor…` : 'Sorunu yaz…'}
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
