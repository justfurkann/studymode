import { Lightbulb, PenLine } from 'lucide-react'
import { useState } from 'react'
import type { Note, PracticeItem } from '../../lib/types'
import { Empty } from '../ui'

function PracticeCard({ item, index }: { item: PracticeItem; index: number }) {
  const [draft, setDraft] = useState('')
  const [revealed, setRevealed] = useState(false)

  return (
    <div className="panel" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <span className="subtle">Soru {index + 1}</span>
      <p style={{ fontWeight: 600, fontSize: '1.0625rem', lineHeight: 1.55 }}>{item.question}</p>
      <textarea
        className="textarea"
        style={{ minHeight: 120 }}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="Önce notuna bakmadan kendi cümlelerinle cevapla…"
        aria-label={`Soru ${index + 1} için cevabın`}
      />
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
