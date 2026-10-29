import { Brain, Check, CheckCircle2, Lightbulb, PenLine, Sparkles } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { toggleCompletedStep } from '../../lib/learningPath'
import { canCompletePractice, isMeaningfulAnswer } from '../../lib/practice'
import { aiAvailability, useSettings } from '../../lib/settings'
import { useStore } from '../../lib/store'
import type { Note, PracticeItem } from '../../lib/types'
import { Alert, Empty, Spinner, useToast } from '../ui'

/** How long to wait after the last keystroke before saving a written answer. */
const SAVE_DELAY_MS = 700

function PracticeCard({ noteId, item, index, onInteracted }: { noteId: string; item: PracticeItem; index: number; onInteracted: () => void }) {
  const store = useStore()
  const settings = useSettings()
  const ai = aiAvailability(settings, !!store.session)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const evaluation = item.evaluation ?? null
  const [draft, setDraft] = useState(item.draft ?? '')
  const [revealed, setRevealed] = useState(false)
  const saved = useRef(item.draft ?? '')

  // Written answers are saved to the note (and synced) so a reload or tab switch never loses them.
  // The first real answer to a question also counts toward today's streak.
  const save = useCallback(
    (text: string) => {
      if (text === saved.current) return
      const firstRealAnswer = !isMeaningfulAnswer(saved.current) && isMeaningfulAnswer(text)
      saved.current = text
      store.updatePractice(noteId, item.id, { draft: text }, firstRealAnswer)
    },
    [store, noteId, item.id],
  )

  useEffect(() => {
    const timer = window.setTimeout(() => save(draft), SAVE_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [draft, save])

  async function evaluate() {
    if (!draft.trim() || !item.answer || !ai.ok) return
    setBusy(true)
    setError('')
    try {
      const { gradeAnswers } = await import('../../lib/ai')
      const [result] = await gradeAnswers(
        { items: [{ question: item.question, modelAnswer: item.answer, criteria: item.hint ?? '', answer: draft }] },
        settings,
      )
      saved.current = draft
      store.updatePractice(noteId, item.id, { draft, evaluation: { ...result, gradedAt: new Date().toISOString() } }, true)
      onInteracted()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Cevabın değerlendirilemedi. Tekrar deneyebilirsin.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="panel" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <span className="subtle">Soru {index + 1}</span>
      <p style={{ fontWeight: 600, fontSize: '1.0625rem', lineHeight: 1.55 }}>{item.question}</p>
      <textarea
        className="textarea"
        style={{ minHeight: 120 }}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => save(draft)}
        maxLength={10000}
        disabled={busy}
        placeholder="Önce notuna bakmadan kendi cümlelerinle cevapla…"
        aria-label={`Soru ${index + 1} için cevabın`}
      />
      {item.answer && (
        <div className="btn-row">
          <button className="btn btn-primary" disabled={busy || !draft.trim() || !ai.ok} onClick={evaluate}>
            {busy ? <Spinner size={16} /> : <Sparkles size={16} />} Cevabımı değerlendir
          </button>
          {!ai.ok && (
            <Link className="btn btn-sm" to={store.session ? '/ayarlar' : '/giris'}>
              {store.session ? 'Yapay zekâyı ayarla' : 'Ücretsiz giriş yap'}
            </Link>
          )}
        </div>
      )}
      {error && <Alert tone="danger">{error}</Alert>}
      {evaluation && (
        <div className="explain" role="status">
          <strong>Geri bildirim · {Math.round(evaluation.score * 100)}/100</strong>
          <p>{evaluation.feedback}</p>
          <small className="subtle">Bu bir çalışma önerisidir; resmi sınav puanı değildir.</small>
        </div>
      )}
      {revealed ? (
        <div className="explain">
          {item.answer ? (
            <>
              <strong>Örnek cevap</strong>
              <p className="prewrap">{item.answer}</p>
              <p className="subtle">Cevabını karşılaştır: ana fikri yakaladın mı, eksik kalan bir nokta var mı?</p>
            </>
          ) : (
            <>
              <strong>Kendini değerlendir</strong>
              {item.hint && <p>{item.hint}</p>}
              <p className="subtle">Basit modda örnek cevap yok. Cevabını notundaki ilgili bölümle karşılaştır.</p>
            </>
          )}
        </div>
      ) : (
        <div className="btn-row">
          <button
            className="btn"
            onClick={() => {
              setRevealed(true)
              if (draft.trim().length > 0) onInteracted()
            }}
          >
            <Lightbulb size={16} /> {item.answer ? 'Örnek cevabı göster' : 'Değerlendir'}
          </button>
          {item.hint && item.answer && <span className="subtle">İpucu: {item.hint}</span>}
        </div>
      )}
    </div>
  )
}

export function PracticeTab({ note }: { note: Note }) {
  const store = useStore()
  const toast = useToast()
  const stepDone = note.summary?.completedSteps?.includes('anlat') ?? false
  const canFinish = canCompletePractice(note)

  function markStep5Done(showToast = true) {
    if (!note.summary) return
    let next = toggleCompletedStep(note.summary, 'anlat', true)
    store.updateNote(note.id, { summary: next })
    if (showToast) toast('Tebrikler, bu notu bitirdin 🎉')
  }

  if (!note.practice.length) {
    return (
      <div className="panel">
        <Empty icon={<PenLine size={32} />} title="Açık uçlu soru yok" />
      </div>
    )
  }

  return (
    <div className="section">
      <p className="muted">Notuna bakmadan, konuyu bilmeyen birine anlatır gibi yaz. Anlatabiliyorsan öğrenmişsin demektir.</p>

      {note.practice.map((item, i) => (
        <PracticeCard
          key={item.id}
          noteId={note.id}
          item={item}
          index={i}
          onInteracted={() => {
            if (!stepDone) markStep5Done(false)
          }}
        />
      ))}

      <div className="panel" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        {stepDone ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <CheckCircle2 size={22} style={{ color: 'var(--success)', flexShrink: 0 }} />
              <div>
                <strong>Bu notu bitirdin! 🎉</strong>
                <p className="subtle">Unutmamak için kartlar aralıklı tekrarla yine karşına gelecek.</p>
              </div>
            </div>
            <Link to={`/tekrar?not=${note.id}`} className="btn btn-primary btn-sm">
              <Brain size={16} /> Kartları tekrar et
            </Link>
          </>
        ) : (
          <>
            <div>
              <strong>Konuyu kendi cümlelerinle anlatabildin mi?</strong>
            </div>
            <button type="button" className="btn btn-primary" onClick={() => markStep5Done(true)} disabled={!canFinish}>
              <Check size={16} /> Bitir: Konuyu öğrendim
            </button>
            {!canFinish && <p className="subtle" style={{ width: '100%' }}>Bitirmek için en az bir soruya kendi cümlelerinle cevap yaz.</p>}
          </>
        )}
      </div>
    </div>
  )
}
