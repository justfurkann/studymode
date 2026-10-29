import { useState, type FormEvent } from 'react'
import { useStore } from '../lib/store'
import type { Note } from '../lib/types'
import { Modal } from './ui'

export function NoteEditor({ note, onClose }: { note: Note; onClose: () => void }) {
  const store = useStore()
  const [title, setTitle] = useState(note.title)
  const [content, setContent] = useState(note.content)
  const [courseId, setCourseId] = useState(note.courseId)
  const [tags, setTags] = useState((note.summary?.tags ?? []).join(', '))
  function save(event: FormEvent) {
    event.preventDefault()
    if (!title.trim() || content.replace(/\s/g, '').length < 120) return
    store.updateNote(note.id, { title: title.trim(), content: content.trim(), courseId,
      summary: { ...(note.summary ?? { overview: '', points: [], keyTerms: [] }),
        tags: [...new Set(tags.split(',').map(t => t.trim()).filter(Boolean))].slice(0, 12),
        sourceChanged: !!note.summary?.sourceChanged || content.trim() !== note.content } })
    onClose()
  }
  return <Modal title="Notu düzenle" onClose={onClose}><form className="form" onSubmit={save}>
    <label className="field">Not başlığı<input className="input" value={title} onChange={e => setTitle(e.target.value)} maxLength={200} required /></label>
    <label className="field">Ders<select className="select" value={courseId} onChange={e => setCourseId(e.target.value)}>{store.data.courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
    <label className="field">Etiketler<input className="input" placeholder="vize, hafta 3, önemli" value={tags} onChange={e => setTags(e.target.value)} maxLength={300} /><small className="subtle">Virgülle ayır; en fazla 12 etiket.</small></label>
    <label className="field">Not içeriği<textarea className="textarea" rows={10} value={content} onChange={e => setContent(e.target.value)} maxLength={400000} required /></label>
    <p className="subtle">Kaynak metin değişirse mevcut çalışma seti korunur ve güncel olmadığı belirtilir. Yeni içeriği kullanmak için “Yeniden hazırla”yı seç.</p>
    <div className="btn-row"><button className="btn" type="button" onClick={onClose}>Vazgeç</button><button className="btn btn-primary" disabled={!title.trim() || content.replace(/\s/g, '').length < 120}>Değişiklikleri kaydet</button></div>
  </form></Modal>
}
