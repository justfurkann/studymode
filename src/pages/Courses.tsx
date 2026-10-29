import { BookOpen, Brain, FileText, Layers, Plus } from 'lucide-react'
import { useState } from 'react'
import { matchesNote } from '../lib/noteTools'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { CourseForm } from '../components/CourseForm'
import { Empty } from '../components/ui'
import { courseStats, examLabel } from '../lib/format'
import { useStore } from '../lib/store'
import { useLoadDemo } from '../lib/useDemo'

export function Courses() {
  const store = useStore()
  const [query, setQuery] = useState('')
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const creating = params.get('yeni') === '1'
  const close = () => setParams({}, { replace: true })
  const loadDemo = useLoadDemo()

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Dersler</h1>
          <p className="muted">Her ders kendi notlarını, kartlarını ve sınav tarihini tutar.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setParams({ yeni: '1' })}>
          <Plus size={18} /> Yeni ders
        </button>
      </div>

      <label className="field">Ders ve notlarda ara<input className="input" value={query} onChange={e => setQuery(e.target.value)} placeholder="Ders, not içeriği veya etiket" /></label>
      {query.trim() && <section className="section"><h2>Not sonuçları</h2><div className="panel list">{store.data.notes.filter(n => matchesNote(n, query)).map(n => <Link className="list-item" key={n.id} to={`/not/${n.id}`}><FileText size={17} />{n.title}</Link>)}{!store.data.notes.some(n => matchesNote(n, query)) && <p className="muted">Not bulunamadı.</p>}</div></section>}
      {store.data.courses.length ? (
        <div className="grid">
          {store.data.courses.filter(c => c.name.toLocaleLowerCase('tr').includes(query.trim().toLocaleLowerCase('tr'))).map((course) => {
            const stats = courseStats(store.data, course)
            const exam = examLabel(course.examDate)
            return (
              <Link key={course.id} to={`/ders/${course.id}`} className="course-card">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span className="course-swatch" style={{ background: course.color }} />
                  <span className="name">{course.name}</span>
                </div>
                <div className="stat-row">
                  <span>
                    <FileText size={15} /> {stats.notes} not
                  </span>
                  <span>
                    <Layers size={15} /> {stats.cards} kart
                  </span>
                </div>
                <div className="btn-row">
                  {stats.due > 0 && (
                    <span className="chip chip-accent">
                      <Brain size={13} /> {stats.due} tekrar
                    </span>
                  )}
                  {exam && <span className={`chip ${exam.tone === 'neutral' ? '' : `chip-${exam.tone}`}`}>{exam.text}</span>}
                </div>
              </Link>
            )
          })}
        </div>
      ) : (
        <div className="panel">
          <Empty icon={<BookOpen size={32} />} title="Henüz ders yok">
            <p>Dönemdeki derslerini ekle; her dersin notları, kartları ve sınav tarihi bir arada durur.</p>
            <div className="btn-row" style={{ justifyContent: 'center' }}>
              <button className="btn btn-primary" onClick={() => setParams({ yeni: '1' })}>
                <Plus size={18} /> İlk dersimi oluştur
              </button>
              <button className="btn" onClick={loadDemo}>
                Örnek notla dene
              </button>
            </div>
          </Empty>
        </div>
      )}

      {creating && (
        <CourseForm
          onClose={close}
          onSave={(input) => {
            const course = store.addCourse(input)
            navigate(`/ders/${course.id}`, { replace: true })
          }}
        />
      )}
    </div>
  )
}
