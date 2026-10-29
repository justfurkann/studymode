import { Plus, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { EXAM_KINDS, examsForCourse, isLegacyExam } from '../lib/courseExams'
import { COURSE_COLORS, useStore, type CourseExamDraft } from '../lib/store'
import type { Course, CourseExamKind } from '../lib/types'
import { ColorPicker, Modal } from './ui'

export interface CourseInput {
  name: string
  color: string
  exams: CourseExamDraft[]
  /** False when the exams are exactly as they were, so nothing needs to be written. */
  examsChanged: boolean
}

/** A row in the form; `key` keeps React rows stable while ids are still unknown. */
type ExamRow = CourseExamDraft & { key: string; weightText: string }

const toRow = (draft: CourseExamDraft): ExamRow => ({ ...draft, key: crypto.randomUUID(), weightText: draft.weight == null ? '' : String(draft.weight) })

export function CourseForm({ course, onSave, onClose }: { course?: Course; onSave: (input: CourseInput) => void; onClose: () => void }) {
  const store = useStore()
  const notes = course ? store.data.notes.filter((n) => n.courseId === course.id) : []
  const [name, setName] = useState(course?.name ?? '')
  const [color, setColor] = useState(course?.color ?? COURSE_COLORS[0])
  const [initialRows] = useState<ExamRow[]>(() =>
    course
      ? examsForCourse(store.data, course.id).map((e) =>
          // The old single date becomes an editable row; saving turns it into a real exam record.
          toRow({ id: isLegacyExam(e) ? undefined : e.id, kind: e.kind, title: e.title, date: e.date, weight: e.weight, noteIds: e.noteIds }),
        )
      : [],
  )
  const [rows, setRows] = useState<ExamRow[]>(initialRows)
  const [error, setError] = useState('')

  const update = (key: string, patch: Partial<ExamRow>) => setRows((list) => list.map((r) => (r.key === key ? { ...r, ...patch } : r)))

  function addRow() {
    const kind: CourseExamKind = rows.some((r) => r.kind === 'vize') ? 'final' : 'vize'
    setRows([...rows, toRow({ kind, date: '', noteIds: [] })])
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!name.trim()) return
    if (rows.some((r) => !r.date)) return setError('Her sınav için bir tarih seç ya da sınavı kaldır.')
    const exams: CourseExamDraft[] = []
    for (const row of rows) {
      const weight = row.weightText.trim() === '' ? null : Number(row.weightText.replace(',', '.'))
      if (weight !== null && (!Number.isFinite(weight) || weight < 0 || weight > 100)) return setError('Ağırlık 0 ile 100 arasında olmalı.')
      exams.push({ id: row.id, kind: row.kind, title: row.kind === 'diger' ? row.title ?? null : null, date: row.date, weight, noteIds: row.noteIds })
    }
    const signature = (list: ExamRow[]) => JSON.stringify(list.map(({ key: _key, ...r }) => r))
    onSave({ name: name.trim(), color, exams, examsChanged: signature(rows) !== signature(initialRows) })
  }

  return (
    <Modal title={course ? 'Dersi düzenle' : 'Yeni ders'} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <label className="field">
          <span>Ders adı</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Örn. Fizyoloji I" maxLength={120} required />
        </label>

        <div className="field">
          <span>Sınavlar</span>
          {rows.length === 0 && <p className="subtle">Vize, final gibi sınavları eklersen tekrarlar sınavdan önce bitecek şekilde planlanır.</p>}
          {rows.map((row, i) => (
            <fieldset className="exam-row" key={row.key} aria-label={`${i + 1}. sınav`}>
              <div className="exam-row-main">
                <select className="select" aria-label="Sınav türü" value={row.kind} onChange={(e) => update(row.key, { kind: e.target.value as CourseExamKind })}>
                  {EXAM_KINDS.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.label}
                    </option>
                  ))}
                </select>
                <input className="input" type="date" aria-label="Sınav tarihi" value={row.date} onChange={(e) => update(row.key, { date: e.target.value })} required />
                <input
                  className="input exam-weight"
                  inputMode="decimal"
                  aria-label="Ağırlık (%)"
                  placeholder="%"
                  value={row.weightText}
                  onChange={(e) => update(row.key, { weightText: e.target.value })}
                />
                <button type="button" className="btn btn-ghost btn-icon btn-danger" aria-label="Sınavı kaldır" onClick={() => setRows(rows.filter((r) => r.key !== row.key))}>
                  <Trash2 size={16} />
                </button>
              </div>
              {row.kind === 'diger' && (
                <input className="input" aria-label="Sınav adı" placeholder="Adı (ör. Proje sunumu)" maxLength={80} value={row.title ?? ''} onChange={(e) => update(row.key, { title: e.target.value })} />
              )}
              {notes.length > 0 && (
                <details className="exam-scope">
                  <summary>Kapsam: {row.noteIds.length ? `${row.noteIds.length} not` : 'tüm notlar'}</summary>
                  {notes.map((n) => (
                    <label key={n.id} className="exam-scope-note">
                      <input
                        type="checkbox"
                        checked={row.noteIds.includes(n.id)}
                        onChange={(e) => update(row.key, { noteIds: e.target.checked ? [...row.noteIds, n.id] : row.noteIds.filter((id) => id !== n.id) })}
                      />
                      {n.title}
                    </label>
                  ))}
                  <p className="subtle">Hiçbirini seçmezsen sınav dersin tüm notlarını kapsar.</p>
                </details>
              )}
            </fieldset>
          ))}
          <div>
            <button type="button" className="btn btn-sm" onClick={addRow}>
              <Plus size={15} /> Sınav ekle
            </button>
          </div>
        </div>

        <div className="field">
          <span>Renk</span>
          <ColorPicker colors={COURSE_COLORS} value={color} onChange={setColor} />
        </div>
        {error && (
          <p role="alert" style={{ color: 'var(--danger)' }}>
            {error}
          </p>
        )}
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
