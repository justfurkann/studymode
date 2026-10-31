import { Plus, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { normalizeCourseName, planSemester, semesterRows, type SemesterRow } from '../lib/examFocus'
import { useStore } from '../lib/store'
import { useToast } from './ui'

type Row = SemesterRow & { key: string; existing: boolean }

const blank = (): Row => ({ key: crypto.randomUUID(), name: '', vize: '', final: '', existing: false })

/**
 * The whole semester in one table: course name, midterm, final. New names become courses, known
 * names get their dates updated. Other exams (bütünleme, quiz) and weights stay on the course page.
 */
export function SemesterEditor({ onDone }: { onDone: () => void }) {
  const store = useStore()
  const toast = useToast()
  const [rows, setRows] = useState<Row[]>(() => {
    const known = semesterRows(store.data).map((r) => ({ ...r, key: crypto.randomUUID(), existing: true }))
    return known.length ? [...known, blank()] : [blank(), blank(), blank()]
  })
  const [error, setError] = useState('')

  const update = (key: string, patch: Partial<Row>) => setRows((list) => list.map((r) => (r.key === key ? { ...r, ...patch } : r)))

  function save(event: FormEvent) {
    event.preventDefault()
    const bad = rows.find((r) => r.vize && r.final && r.final < r.vize)
    if (bad) return setError(`${bad.name || 'Bir ders'}: final, vizeden önce olamaz.`)
    const plan = planSemester(store.data, rows)
    if (!plan.create.length && !plan.update.length) {
      setError('Kaydedilecek bir değişiklik yok. Bir ders adı ya da tarih gir.')
      return
    }
    for (const item of plan.create) {
      const course = store.addCourse({ name: item.name })
      if (item.exams.length) store.saveCourseExams(course.id, item.exams)
    }
    for (const item of plan.update) store.saveCourseExams(item.courseId, item.exams)
    const parts = [plan.create.length && `${plan.create.length} ders oluşturuldu`, plan.update.length && `${plan.update.length} ders güncellendi`].filter(Boolean)
    toast(parts.join(', '))
    onDone()
  }

  const names = rows.map((r) => normalizeCourseName(r.name))

  return (
    <form className="panel semester" onSubmit={save} aria-label="Dönemini kur">
      <div>
        <h2>Dönemini kur</h2>
        <p className="subtle">Derslerini ve vize, final tarihlerini tek seferde gir. Yeni yazdığın her ders, Dersler sayfasında not eklemeye hazır olur.</p>
      </div>
      <div className="semester-rows">
        {rows.map((row, i) => {
          const repeated = !!names[i] && names.indexOf(names[i]) !== i
          return (
            <fieldset key={row.key} className="semester-row" aria-label={`${i + 1}. ders`}>
              <div className="semester-name">
                <input
                  className="input"
                  aria-label="Ders adı"
                  placeholder="Ders adı (ör. Anatomi I)"
                  maxLength={120}
                  value={row.name}
                  readOnly={row.existing}
                  onChange={(e) => update(row.key, { name: e.target.value })}
                />
                {!row.existing && (
                  <button type="button" className="btn btn-ghost btn-icon" aria-label="Satırı kaldır" onClick={() => setRows(rows.filter((r) => r.key !== row.key))}>
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
              <label className="semester-date">
                <span>Vize</span>
                <input className="input" type="date" value={row.vize} onChange={(e) => update(row.key, { vize: e.target.value })} />
              </label>
              <label className="semester-date">
                <span>Final</span>
                <input className="input" type="date" value={row.final} onChange={(e) => update(row.key, { final: e.target.value })} />
              </label>
              {repeated && <p className="subtle semester-note">Bu ders zaten listede; ilk satır kullanılır.</p>}
            </fieldset>
          )
        })}
      </div>
      <div>
        <button type="button" className="btn btn-sm" onClick={() => setRows([...rows, blank()])}>
          <Plus size={15} /> Ders ekle
        </button>
      </div>
      <p className="subtle">Bütünleme, quiz ve sınav ağırlıklarını dersin sayfasından ekleyebilirsin. Boş bıraktığın tarih hiçbir sınavı silmez.</p>
      {error && (
        <p role="alert" style={{ color: 'var(--danger)' }}>
          {error}
        </p>
      )}
      <div className="btn-row" style={{ justifyContent: 'flex-end' }}>
        <button type="button" className="btn btn-ghost" onClick={onDone}>
          Vazgeç
        </button>
        <button type="submit" className="btn btn-primary">
          Kaydet
        </button>
      </div>
    </form>
  )
}
