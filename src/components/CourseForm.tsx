import { useState, type FormEvent } from 'react'
import { COURSE_COLORS } from '../lib/store'
import type { Course } from '../lib/types'
import { ColorPicker, Modal } from './ui'

export interface CourseInput {
  name: string
  color: string
  examDate: string | null
}

export function CourseForm({ course, onSave, onClose }: { course?: Course; onSave: (input: CourseInput) => void; onClose: () => void }) {
  const [name, setName] = useState(course?.name ?? '')
  const [color, setColor] = useState(course?.color ?? COURSE_COLORS[0])
  const [examDate, setExamDate] = useState(course?.examDate ?? '')

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!name.trim()) return
    onSave({ name: name.trim(), color, examDate: examDate || null })
  }

  return (
    <Modal title={course ? 'Dersi düzenle' : 'Yeni ders'} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <label className="field">
          <span>Ders adı</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Örn. Fizyoloji I" maxLength={120} required />
        </label>
        <label className="field">
          <span>Sıradaki sınav tarihi (isteğe bağlı)</span>
          <input className="input" type="date" value={examDate} onChange={(e) => setExamDate(e.target.value)} />
        </label>
        <div className="field">
          <span>Renk</span>
          <ColorPicker colors={COURSE_COLORS} value={color} onChange={setColor} />
        </div>
        <p className="subtle">Sınav tarihi girersen tekrarlar sınavdan önce bitecek şekilde planlanır.</p>
        <div className="btn-row" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Vazgeç
          </button>
          <button type="submit" className="btn btn-primary" disabled={!name.trim()}>
            {course ? 'Kaydet' : 'Dersi oluştur'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
