import { Brain, Layers, Pencil, Plus, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
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

export function CardsTab({ note }: { note: Note }) {
  const store = useStore()
  const [editing, setEditing] = useState<Card | 'new' | null>(null)
  const cards = store.data.cards.filter((c) => c.noteId === note.id)

  return (
    <div className="section">
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
