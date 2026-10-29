import { ArrowRight, BookOpen, Brain, Check, Layers, Lightbulb, Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { cardHint } from '../../lib/cardHint'
import { toggleCompletedStep } from '../../lib/learningPath'
import { useStore } from '../../lib/store'
import type { Card, Note } from '../../lib/types'
import { Empty, Modal } from '../ui'

function CardEditor({ card, onSave, onClose }: { card?: Card; onSave: (front: string, back: string) => void; onClose: () => void }) {
  const [front, setFront] = useState(card?.front ?? '')
  const [back, setBack] = useState(card?.back ?? '')

  function submit(event: FormEvent) {
    event.preventDefault()
    if (front.trim() && back.trim()) onSave(front.trim(), back.trim())
  }

  return (
    <Modal title={card ? 'Kartı düzenle' : 'Yeni kart'} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <label className="field">
          <span>Ön yüz (soru)</span>
          <textarea className="textarea" style={{ minHeight: 90 }} value={front} onChange={(e) => setFront(e.target.value)} required />
        </label>
        <label className="field">
          <span>Arka yüz (cevap)</span>
          <textarea className="textarea" style={{ minHeight: 110 }} value={back} onChange={(e) => setBack(e.target.value)} required />
        </label>
        <div className="btn-row" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Vazgeç
          </button>
          <button type="submit" className="btn btn-primary" disabled={!front.trim() || !back.trim()}>
            Kaydet
          </button>
        </div>
      </form>
    </Modal>
  )
}

/**
 * One card at a time: question → optional hint → turn → "Bildim" / "Tekrar" → next card.
 * Each answer is a real review (spaced repetition, mastery, daily goal, streak); cards marked
 * "Tekrar" come back at the end of the round.
 */
export function CardsTab({ note, onNext, onShowSource }: { note: Note; onNext?: () => void; onShowSource?: (source: string) => void }) {
  const store = useStore()
  const cards = store.data.cards.filter((c) => c.noteId === note.id)
  const [editing, setEditing] = useState<Card | 'new' | null>(null)
  const [queue, setQueue] = useState<string[]>(() => cards.map((c) => c.id))
  const [round, setRound] = useState(cards.length)
  const [known, setKnown] = useState(0)
  /** Cards marked "Tekrar" this round; knowing them later does not count as knowing them first time. */
  const missed = useRef(new Set<string>())
  const [hint, setHint] = useState(false)
  const [revealed, setRevealed] = useState(false)

  // Cards added during the round (by hand or from test mistakes) join the end of it; deleted ones leave.
  const seen = useRef(new Set(queue))
  const ids = cards.map((c) => c.id).join()
  useEffect(() => {
    const added = cards.filter((c) => !seen.current.has(c.id)).map((c) => c.id)
    const removed = queue.filter((id) => !cards.some((c) => c.id === id))
    if (!added.length && !removed.length) return
    added.forEach((id) => seen.current.add(id))
    setQueue([...queue.filter((id) => !removed.includes(id)), ...added])
    setRound((n) => n + added.length - removed.length)
    // Only the set of cards matters here, not their review state.
  }, [ids])

  const card = cards.find((c) => c.id === queue[0])
  const done = round - queue.length

  function answer(remembered: boolean) {
    if (!card) return
    store.reviewCard(card.id, remembered ? 'good' : 'again')
    if (!remembered) missed.current.add(card.id)
    else if (!missed.current.has(card.id)) setKnown((n) => n + 1)
    setHint(false)
    setRevealed(false)
    setQueue(([first, ...rest]) => (remembered ? rest : [...rest, first]))
    if (remembered && queue.length === 1 && note.summary && !note.summary.completedSteps?.includes('pekistir')) {
      store.updateNote(note.id, { summary: toggleCompletedStep(note.summary, 'pekistir', true) })
    }
  }

  function again() {
    setQueue(cards.map((c) => c.id))
    setRound(cards.length)
    setKnown(0)
    missed.current.clear()
    setHint(false)
    setRevealed(false)
  }

  useEffect(() => {
    if (!card) return
    const onKey = (event: KeyboardEvent) => {
      if (editing || (event.target instanceof HTMLElement && event.target.closest('input, textarea, select, button, summary'))) return
      if (event.key === ' ' && !revealed) {
        event.preventDefault()
        setRevealed(true)
      } else if (revealed && event.key === '1') answer(false)
      else if (revealed && event.key === '2') answer(true)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const hintText = card ? cardHint(card.back) : ''

  return (
    <div className="section study-cards">
      {!cards.length ? (
        <div className="panel">
          <Empty icon={<Layers size={32} />} title="Bu notta kart yok">
            <p>Testteki yanlışlarını karta çevirebilir ya da kendin kart ekleyebilirsin.</p>
            <div className="btn-row" style={{ justifyContent: 'center' }}>
              <button className="btn" onClick={() => setEditing('new')}>
                <Plus size={16} /> Kart ekle
              </button>
              {onNext && (
                <button className="btn btn-primary" onClick={onNext}>
                  Sıradaki: Anlat <ArrowRight size={16} />
                </button>
              )}
            </div>
          </Empty>
        </div>
      ) : card ? (
        <>
          <div className="study-progress">
            <span className="subtle">
              Kart {Math.min(done + 1, round)} / {round}
            </span>
            <div className="progress" aria-hidden>
              <div style={{ width: `${(done / round) * 100}%` }} />
            </div>
          </div>

          <article key={card.id + String(revealed)} className={`flashcard flip-reveal ${revealed ? 'is-revealed' : ''}`} aria-live="polite">
            <p className="front">{card.front}</p>
            {!revealed && hint && hintText && (
              <p className="card-hint" role="status">
                <Lightbulb size={15} /> {hintText}
              </p>
            )}
            {revealed && <p className="back">{card.back}</p>}
            {revealed && card.source && (
              <div className="source-row">
                <p className="source">“{card.source}”</p>
                {onShowSource && (
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => onShowSource(card.source!)}>
                    <BookOpen size={14} /> Kaynağında gör
                  </button>
                )}
              </div>
            )}
          </article>

          {revealed ? (
            <div className="card-answer" role="group" aria-label="Hatırladın mı?">
              <button className="btn btn-lg" onClick={() => answer(false)}>
                <RotateCcw size={17} /> Tekrar
              </button>
              <button className="btn btn-primary btn-lg" onClick={() => answer(true)}>
                <Check size={18} /> Bildim
              </button>
            </div>
          ) : (
            <div className="card-answer">
              <button className="btn btn-lg" onClick={() => setHint(true)} disabled={hint || !hintText}>
                <Lightbulb size={17} /> İpucu
              </button>
              <button className="btn btn-primary btn-lg" onClick={() => setRevealed(true)}>
                Çevir
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="panel study-done" role="status">
          <div className="study-done-mark">🎉</div>
          <strong>Tur bitti</strong>
          <p className="muted">
            {round} kartın {known} tanesini ilk denemede bildin. Kartlar aralıklı tekrarla doğru zamanda yine gelecek.
          </p>
          <div className="btn-row">
            <button className="btn" onClick={again}>
              <RotateCcw size={16} /> Bir tur daha
            </button>
            {onNext && (
              <button className="btn btn-primary" onClick={onNext}>
                Sıradaki: Kendi cümlelerinle anlat <ArrowRight size={16} />
              </button>
            )}
          </div>
        </div>
      )}

      {cards.length > 0 && (
        <details className="manage-cards no-print">
          <summary>Kartları yönet ({cards.length})</summary>
          <div className="btn-row">
            <button className="btn btn-sm" onClick={() => setEditing('new')}>
              <Plus size={16} /> Kart ekle
            </button>
            <Link to={`/tekrar?not=${note.id}`} className="btn btn-sm">
              <Brain size={16} /> Tekrar ekranında çalış
            </Link>
          </div>
          <div className="panel panel-tight">
            {cards.map((c) => (
              <div className="card-row" key={c.id}>
                <div>
                  <span className="label">Soru</span>
                  <span className="prewrap">{c.front}</span>
                </div>
                <div>
                  <span className="label">Cevap</span>
                  <span className="prewrap muted">{c.back}</span>
                </div>
                <div className="btn-row" style={{ flexWrap: 'nowrap', gap: 2 }}>
                  <button className="btn btn-ghost btn-icon" aria-label="Kartı düzenle" onClick={() => setEditing(c)}>
                    <Pencil size={16} />
                  </button>
                  <button className="btn btn-ghost btn-icon btn-danger" aria-label="Kartı sil" onClick={() => store.deleteCard(c.id)}>
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </details>
      )}

      {editing && (
        <CardEditor
          card={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
          onSave={(front, back) => {
            if (editing === 'new') store.addCard({ courseId: note.courseId, noteId: note.id, front, back })
            else store.updateCard(editing.id, { front, back })
            setEditing(null)
          }}
        />
      )}
    </div>
  )
}
