import { ArrowLeft, ArrowRight, BookOpen, Brain, Check, Eye, Layers, ListChecks, Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { toggleCompletedStep } from '../../lib/learningPath'
import { useStore } from '../../lib/store'
import type { Card, LearningStepId, Note } from '../../lib/types'
import { Empty, Modal, useToast } from '../ui'

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

export function CardsTab({
  note,
  onGoToStep,
  onShowSource,
}: {
  note: Note
  onGoToStep?: (step: LearningStepId) => void
  onShowSource?: (source: string) => void
}) {
  const store = useStore()
  const toast = useToast()
  const [editing, setEditing] = useState<Card | 'new' | null>(null)
  const [trainerIndex, setTrainerIndex] = useState(0)
  const [showAnswer, setShowAnswer] = useState(false)
  const [reviewed, setReviewed] = useState(0)

  const cards = store.data.cards.filter((c) => c.noteId === note.id)
  const safeIndex = cards.length > 0 ? Math.min(trainerIndex, cards.length - 1) : 0
  const currentCard = cards[safeIndex]
  const stepDone = note.summary?.completedSteps?.includes('pekistir') ?? false

  /**
   * The student's own verdict is recorded as a real review: it schedules the card (spaced repetition),
   * feeds topic mastery, and counts toward today's card goal and streak.
   */
  function grade(remembered: boolean) {
    if (!currentCard) return
    store.reviewCard(currentCard.id, remembered ? 'good' : 'again')
    setReviewed((n) => n + 1)
    setShowAnswer(false)
    if (safeIndex + 1 < cards.length) setTrainerIndex(safeIndex + 1)
  }

  function completeStep3() {
    if (note.summary) {
      const next = toggleCompletedStep(note.summary, 'pekistir', true)
      store.updateNote(note.id, { summary: next })
    }
    toast('3. Adım tamamlandı! Şimdi mini test ile kendini sına.')
    onGoToStep?.('sina')
  }

  return (
    <div className="section">
      {/* Guided Step 3 Inline Active Recall Trainer */}
      {cards.length > 0 && (
        <div className="guided-box" aria-label="3. Adım hızlı kart turu">
          <div className="guided-box-head">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className={`step-dot ${stepDone ? 'done' : ''}`}>{stepDone ? <Check size={12} /> : '3'}</span>
              <strong>3. Adım: Kartlarla Hafızaya Yerleştir ({safeIndex + 1} / {cards.length})</strong>
            </div>
            <span className="subtle">
              Teste geçmeden önce kavramları zihninde geri çağır
            </span>
          </div>

          <div className="guided-stage-body">
            <div className="progress" aria-hidden>
              <div style={{ width: `${((safeIndex + 1) / cards.length) * 100}%` }} />
            </div>

            <div className="mini-card-trainer">
              <div className="mini-card-question">
                <span className="guided-kicker">SORU {safeIndex + 1} — ÖNCE KENDİN HATIRLAMAYA ÇALIŞ</span>
                <p className="prewrap">{currentCard.front}</p>
              </div>

              {showAnswer ? (
                <div className="mini-card-answer">
                  <span className="guided-kicker">CEVAP</span>
                  <p className="prewrap">{currentCard.back}</p>
                  {currentCard.source && (
                    <div className="source-row">
                      <p className="source">“{currentCard.source}”</p>
                      {onShowSource && (
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => onShowSource(currentCard.source!)}>
                          <BookOpen size={14} /> Kaynağında gör
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                  <button type="button" className="btn btn-primary" onClick={() => setShowAnswer(true)}>
                    <Eye size={16} /> Cevabı kontrol et
                  </button>
                </div>
              )}
            </div>

            <div className="btn-row" style={{ justifyContent: 'space-between' }}>
              <div className="btn-row">
                <button
                  type="button"
                  className="btn btn-sm"
                  disabled={safeIndex === 0}
                  onClick={() => {
                    setShowAnswer(false)
                    setTrainerIndex(Math.max(0, safeIndex - 1))
                  }}
                >
                  <ArrowLeft size={15} /> Önceki kart
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    setShowAnswer(false)
                    setTrainerIndex(0)
                  }}
                >
                  <RotateCcw size={14} /> Baştan al
                </button>
              </div>

              <div className="btn-row">
                {showAnswer && (
                  <>
                    <button type="button" className="btn" onClick={() => grade(false)}>
                      <RotateCcw size={15} /> Tekrar bakacağım
                    </button>
                    <button type="button" className="btn btn-primary" onClick={() => grade(true)}>
                      <Check size={16} /> Hatırladım
                    </button>
                  </>
                )}
                {!showAnswer && safeIndex + 1 === cards.length && reviewed > 0 && (
                  <button type="button" className="btn btn-primary" onClick={completeStep3}>
                    <ListChecks size={16} /> 3. Adımı Tamamla → 4. Adım: Test
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="section-head">
        <p className="muted">Kartlar aralıklı tekrar ile sana doğru zamanda geri gelir.</p>
        <div className="btn-row">
          <button className="btn btn-sm" onClick={() => setEditing('new')}>
            <Plus size={16} /> Kart ekle
          </button>
          {cards.length > 0 && (
            <Link to={`/tekrar?not=${note.id}`} className="btn btn-primary btn-sm">
              <Brain size={16} /> Hepsini çalış
            </Link>
          )}
        </div>
      </div>

      {cards.length ? (
        <div className="panel panel-tight">
          {cards.map((card) => (
            <div className="card-row" key={card.id}>
              <div>
                <span className="label">Soru</span>
                <span className="prewrap">{card.front}</span>
              </div>
              <div>
                <span className="label">Cevap</span>
                <span className="prewrap muted">{card.back}</span>
              </div>
              <div className="btn-row" style={{ flexWrap: 'nowrap', gap: 2 }}>
                <button className="btn btn-ghost btn-icon" aria-label="Kartı düzenle" onClick={() => setEditing(card)}>
                  <Pencil size={16} />
                </button>
                <button className="btn btn-ghost btn-icon btn-danger" aria-label="Kartı sil" onClick={() => store.deleteCard(card.id)}>
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="panel">
          <Empty icon={<Layers size={32} />} title="Bu notta kart yok">
            <p>Kendi kartlarını ekleyebilir ya da testteki yanlışlarını karta çevirebilirsin.</p>
          </Empty>
        </div>
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
