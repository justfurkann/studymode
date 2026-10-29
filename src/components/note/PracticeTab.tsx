import { Lightbulb, PenLine, Sparkles } from 'lucide-react'
import { useState } from 'react'
import type { Note, PracticeItem } from '../../lib/types'
import { useStore } from '../../lib/store'
import { aiAvailability, useSettings } from '../../lib/settings'
import { Link } from 'react-router-dom'
import { Empty, Alert, Spinner } from '../ui'

function PracticeCard({ item, index }: { item: PracticeItem; index: number }) {
  const store = useStore()
  const settings = useSettings()
  const ai = aiAvailability(settings, !!store.session)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [evaluation, setEvaluation] = useState<{ score: number; feedback: string } | null>(null)
  const [draft, setDraft] = useState('')
  const [revealed, setRevealed] = useState(false)

  async function evaluate() {
    if (!draft.trim() || !item.answer || !ai.ok) return
    setBusy(true); setError(''); setEvaluation(null)
    try { const { gradeAnswers } = await import('../../lib/ai'); const [result] = await gradeAnswers({ items: [{ question: item.question, modelAnswer: item.answer, criteria: item.hint ?? '', answer: draft }] }, settings); setEvaluation(result) }
    catch (e) { setError(e instanceof Error ? e.message : 'Cevabın değerlendirilemedi. Tekrar deneyebilirsin.') }
    finally { setBusy(false) }
  }
  return (
    <div className="panel" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <span className="subtle">Soru {index + 1}</span>
      <p style={{ fontWeight: 600, fontSize: '1.0625rem', lineHeight: 1.55 }}>{item.question}</p>
      <textarea
        className="textarea"
        style={{ minHeight: 120 }}
        value={draft}
        onChange={(e) => { setDraft(e.target.value); setEvaluation(null) }}
        maxLength={10000}
        disabled={busy}
        placeholder="Önce notuna bakmadan kendi cümlelerinle cevapla…"
        aria-label={`Soru ${index + 1} için cevabın`}
      />
      {item.answer && <div className="btn-row"><button className="btn btn-primary" disabled={busy || !draft.trim() || !ai.ok} onClick={evaluate}>{busy ? <Spinner size={16} /> : <Sparkles size={16} />} Cevabımı değerlendir</button>{!ai.ok && <Link className="btn btn-sm" to={store.session ? '/ayarlar' : '/giris'}>{store.session ? 'Yapay zekâyı ayarla' : 'Ücretsiz giriş yap'}</Link>}</div>}
      {error && <Alert tone="danger">{error}</Alert>}
      {evaluation && <div className="explain" role="status"><strong>Geri bildirim · {Math.round(evaluation.score * 100)}/100</strong><p>{evaluation.feedback}</p><small className="subtle">Bu bir çalışma önerisidir; resmi sınav puanı değildir.</small></div>}
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
          <button className="btn" onClick={() => setRevealed(true)}>
            <Lightbulb size={16} /> {item.answer ? 'Örnek cevabı göster' : 'Değerlendir'}
          </button>
          {item.hint && item.answer && <span className="subtle">İpucu: {item.hint}</span>}
        </div>
      )}
    </div>
  )
}

export function PracticeTab({ note }: { note: Note }) {
  if (!note.practice.length) {
    return (
      <div className="panel">
        <Empty icon={<PenLine size={32} />} title="Açık uçlu soru yok" />
      </div>
    )
  }
  return (
    <div className="section">
      <p className="muted">Konuyu kendi cümlelerinle anlatmak, sadece okumaktan çok daha kalıcıdır.</p>
      {note.practice.map((item, i) => (
        <PracticeCard key={item.id} item={item} index={i} />
      ))}
    </div>
  )
}
