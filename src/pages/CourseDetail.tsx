import { ArrowLeft, Brain, CalendarClock, ClipboardList, FileText, Pencil, Plus, Share2, Sparkles, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { CourseForm } from '../components/CourseForm'
import { ShareCourse } from '../components/ShareCourse'
import { examFormatLabel, examPercent } from '../components/ExamReview'
import { Empty, useConfirm, useToast } from '../components/ui'
import { examCountdown, examDateText, examName, examsForCourse } from '../lib/courseExams'
import { cardMastery, courseStats, relativeDate } from '../lib/format'
import { daysUntil } from '../lib/srs'
import { computeNoteProgress } from '../lib/learningPath'
import {
  buildNoteEmbeddingText,
  readCourseEmbeddings,
  saveCourseEmbeddings,
  searchNotesSemantic,
} from '../lib/semanticSearch'
import { usePremium } from '../lib/premium'
import { useSettings } from '../lib/settings'
import { useStore } from '../lib/store'
import { freshImport } from '../lib/version'

export function CourseDetail() {
  const { id } = useParams()
  const store = useStore()
  const settings = useSettings()
  const toast = useToast()
  const navigate = useNavigate()
  const [confirm, confirmation] = useConfirm()
  const [query, setQuery] = useState('')
  const [sharing, setSharing] = useState(false)
  const [tag, setTag] = useState('')
  const [editing, setEditing] = useState(false)
  const [embeddings, setEmbeddings] = useState<Record<string, number[]>>(() => (id ? readCourseEmbeddings(id) : {}))
  const [queryVector, setQueryVector] = useState<number[] | undefined>(undefined)
  const [indexing, setIndexing] = useState(false)
  const course = store.data.courses.find((c) => c.id === id)
  // Meaning-based search uses embeddings, a Premium feature; ordinary search works for everyone.
  const hasAi = usePremium().state === 'open'

  useEffect(() => {
    if (id) setEmbeddings(readCourseEmbeddings(id))
  }, [id])

  useEffect(() => {
    const trimmed = query.trim()
    if (!trimmed || trimmed.length < 3 || !hasAi || Object.keys(embeddings).length === 0) {
      setQueryVector(undefined)
      return
    }
    const timer = window.setTimeout(async () => {
      try {
        const vectors = await (await freshImport(() => import('../lib/ai'))).embedTexts([trimmed], settings)
        if (vectors[0]?.length) setQueryVector(vectors[0])
      } catch {
        setQueryVector(undefined)
      }
    }, 380)
    return () => window.clearTimeout(timer)
  }, [query, hasAi, embeddings, settings])

  if (!course) {
    return (
      <div className="page">
        <Empty icon={<FileText size={32} />} title="Ders bulunamadı">
          <Link to="/dersler" className="btn">
            Derslere dön
          </Link>
        </Empty>
      </div>
    )
  }

  const stats = courseStats(store.data, course)
  const notes = store.data.notes.filter((n) => n.courseId === course.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const tags = [...new Set(notes.flatMap((n) => n.summary?.tags ?? []))]
  const cardCount = (noteId: string) => store.data.cards.filter((c) => c.noteId === noteId).length
  const searchMatches = searchNotesSemantic(notes, query, tag, {
    noteVectors: embeddings,
    queryVector,
  })
  const indexedCount = notes.filter((n) => embeddings[n.id]?.length).length

  async function indexNotesWithAi() {
    if (!course || !notes.length) return
    setIndexing(true)
    try {
      const texts = notes.map((n) => buildNoteEmbeddingText(n))
      const vectors = await (await freshImport(() => import('../lib/ai'))).embedTexts(texts, settings)
      const next: Record<string, number[]> = { ...embeddings }
      notes.forEach((n, idx) => {
        if (vectors[idx]?.length) next[n.id] = vectors[idx]
      })
      setEmbeddings(next)
      saveCourseEmbeddings(course.id, next)
      if (query.trim().length >= 2) {
        const qVectors = await (await freshImport(() => import('../lib/ai'))).embedTexts([query.trim()], settings)
        if (qVectors[0]?.length) setQueryVector(qVectors[0])
      }
      toast('Notlar anlamsal arama için indekslendi')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Anlamsal indeksleme başarısız oldu')
    } finally {
      setIndexing(false)
    }
  }

  async function remove() {
    if (!course) return
    if (!await confirm(`“${course.name}” dersi, içindeki ${stats.notes} not ve ${stats.cards} kartla birlikte silinsin mi? Bu geri alınamaz.`)) return
    store.deleteCourse(course.id)
    toast('Ders silindi')
    navigate('/dersler')
  }

  return (
    <div className="page">
      <Link to="/dersler" className="back-link">
        <ArrowLeft size={16} /> Dersler
      </Link>

      <div className="page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="course-swatch" style={{ background: course.color, width: 14, height: 14 }} />
            <h1>{course.name}</h1>
          </div>
          <div className="btn-row">
            <span className="subtle">
              {stats.notes} not · {stats.cards} kart
            </span>
            {!examsForCourse(store.data, course.id).length && (
              <button className="btn btn-ghost btn-sm" onClick={() => setEditing(true)}>
                <Plus size={15} /> Sınav ekle
              </button>
            )}
          </div>
        </div>
        <div className="btn-row header-actions">
          <button className="btn btn-sm" onClick={() => setSharing(true)}>
            <Share2 size={15} /> Paylaş
          </button>
          <button className="btn btn-ghost btn-icon" aria-label="Dersi düzenle" onClick={() => setEditing(true)}>
            <Pencil size={17} />
          </button>
          <button className="btn btn-ghost btn-icon btn-danger" aria-label="Dersi sil" onClick={remove}>
            <Trash2 size={17} />
          </button>
        </div>
      </div>

      <div className="btn-row">
        <Link to={`/not-ekle?ders=${course.id}`} className="btn btn-primary">
          <Plus size={18} /> Not ekle
        </Link>
        {notes.length > 0 && (
          <Link to={`/ders/${course.id}/sinav`} className="btn">
            <ClipboardList size={18} /> Sınav provası
          </Link>
        )}
        {stats.cards > 0 && (
          <Link to={`/tekrar?ders=${course.id}`} className="btn">
            <Brain size={18} /> {stats.due ? `${stats.due} kartı tekrar et` : 'Tekrarlar güncel'}
          </Link>
        )}
      </div>

      {confirmation}
      {sharing && <ShareCourse courseId={course.id} onClose={() => setSharing(false)} />}
      <CourseExams courseId={course.id} hasNotes={notes.length > 0} onEdit={() => setEditing(true)} />
      <CourseProgress courseId={course.id} />

      <section className="section">
        <div className="section-head">
          <h2>Notlar</h2>
          {(notes.length >= 3 || tags.length > 0) && hasAi && (
            <button
              type="button"
              className="btn btn-sm prem-btn"
              disabled={indexing}
              onClick={indexNotesWithAi}
              title="Notlarını anlamına göre aranabilir yap (Premium)"
            >
              <Sparkles size={14} />{' '}
              {indexing
                ? 'İndeksleniyor...'
                : indexedCount === notes.length && notes.length > 0
                  ? 'Akıllı arama hazır'
                  : 'Akıllı aramayı aç'}
            </button>
          )}
        </div>
        {(notes.length >= 3 || tags.length > 0) && (
        <div className="form-row">
          <label className="field">
            Notlarda ara
            <input
              className="input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Başlık, içerik veya anlam (ör. enerji üreten organel)"
            />
          </label>
          <label className="field">
            Etiket
            <select className="select" value={tag} onChange={(e) => setTag(e.target.value)}>
              <option value="">Tüm etiketler</option>
              {tags.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
        </div>
        )}
        {notes.length > 0 && searchMatches.length === 0 && <p className="muted">Aramana uygun not bulunamadı.</p>}
        {notes.length ? (
          <div className="panel panel-tight list">
            {searchMatches.map((match) => {
                const { note } = match
                const progress = note.generator ? computeNoteProgress(note, store.data.cards, store.data.attempts) : null
                return (
                  <Link key={note.id} to={`/not/${note.id}`} className="list-item">
                    <FileText size={18} style={{ color: course.color }} />
                    <div className="grow">
                      <div className="title">{note.title}</div>
                      <div className="subtle">
                        {relativeDate(note.createdAt)} · {cardCount(note.id)} kart · {note.questions.length} soru
                        {progress ? ` · ${progress.completedCount}/${progress.totalSteps} adım` : ''}
                      </div>
                      {query.trim() && match.snippet && (
                        <div className="semantic-match-snippet">
                          {match.matchedTerm && <strong>{match.matchedTerm}: </strong>}
                          <span>{match.snippet}</span>
                        </div>
                      )}
                    </div>
                    {query.trim() && match.matchType === 'semantic' && (
                      <span className="chip chip-accent">Anlamsal eşleşme</span>
                    )}
                    {progress?.isCompleted && <span className="chip chip-success">Tamamlandı</span>}
                    {note.generator === 'ai' && <span className="chip chip-accent">Yapay zekâ</span>}
                  </Link>
                )
              })}
          </div>
        ) : (
          <div className="panel">
            <Empty icon={<FileText size={32} />} title="Bu derste henüz not yok">
              <p>Ders notunu yükle, özetini ve sorularını hazırlayalım.</p>
            </Empty>
          </div>
        )}
      </section>

      {editing && (
        <CourseForm
          course={course}
          onClose={() => setEditing(false)}
          onSave={({ exams, examsChanged, ...input }) => {
            store.updateCourse(course.id, input)
            if (examsChanged) store.saveCourseExams(course.id, exams)
            setEditing(false)
            toast('Ders güncellendi')
          }}
        />
      )}
    </div>
  )
}

/** The course's exams: countdown, date, weight and which notes each one covers. */
function CourseExams({ courseId, hasNotes, onEdit }: { courseId: string; hasNotes: boolean; onEdit: () => void }) {
  const store = useStore()
  const exams = examsForCourse(store.data, courseId)
  if (!exams.length) return null
  const now = new Date()
  const upcoming = exams.filter((e) => (daysUntil(e.date, now) ?? -1) >= 0)
  const past = exams.length - upcoming.length

  return (
    <section className="section" aria-label="Sınavlar">
      <div className="section-head">
        <h2>Sınavlar</h2>
        <button className="btn btn-ghost btn-sm" onClick={onEdit}>
          <Pencil size={14} /> Düzenle
        </button>
      </div>
      <div className="panel panel-tight exam-list">
        {upcoming.map((exam) => {
          const countdown = examCountdown(exam, now)!
          return (
            <div key={exam.id} className="exam-list-item">
              <CalendarClock size={18} className="muted" />
              <div className="grow">
                <div className="title">
                  {examName(exam)}
                  {exam.weight != null && <span className="subtle"> · %{exam.weight}</span>}
                </div>
                <div className="subtle">
                  {examDateText(exam.date)} · {exam.noteIds.length ? `${exam.noteIds.length} not` : 'Tüm notlar'}
                </div>
              </div>
              <span className={`chip ${countdown.tone === 'neutral' ? '' : `chip-${countdown.tone}`}`}>{countdown.text}</span>
              {hasNotes && (
                <Link to={`/ders/${courseId}/sinav?sinav=${exam.id}`} className="btn btn-sm" aria-label={`${examName(exam)} için prova`}>
                  Prova
                </Link>
              )}
            </div>
          )
        })}
        {!upcoming.length && <p className="subtle">Yaklaşan sınav yok.</p>}
        {past > 0 && <p className="subtle">{past} sınavın tarihi geçti.</p>}
      </div>
    </section>
  )
}

function CourseProgress({ courseId }: { courseId: string }) {
  const store = useStore()
  const cards = store.data.cards.filter((c) => c.courseId === courseId)
  const exams = store.data.exams.filter((e) => e.courseId === courseId).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  if (!cards.length && !exams.length) return null

  const mastery = cardMastery(cards)
  const recent = exams.slice(0, 5).reverse()
  const segments = [
    { value: mastery.mastered, color: 'var(--success)', label: 'Pekiştirildi' },
    { value: mastery.learning, color: 'var(--warning)', label: 'Öğreniliyor' },
    { value: mastery.fresh, color: 'var(--border-strong)', label: 'Yeni' },
  ]

  return (
    <section className="section">
      <h2>Hazırlık durumu</h2>
      <div className="panel progress-panel">
        {cards.length > 0 && (
          <div className="progress-block">
            <div className="section-head">
              <strong>Pekiştirilen kartlar: %{mastery.percent}</strong>
              <span className="subtle">{mastery.total} kart</span>
            </div>
            <div className="mastery-bar" role="img" aria-label={segments.map((s) => `${s.label}: ${s.value}`).join(', ')}>
              {segments.map((s) => s.value > 0 && <span key={s.label} style={{ flexGrow: s.value, background: s.color }} />)}
            </div>
            <div className="stat-row">
              {segments.map((s) => (
                <span key={s.label}>
                  <i className="legend-dot" style={{ background: s.color }} /> {s.label}: {s.value}
                </span>
              ))}
            </div>
            <p className="subtle">Bir kart 3 hafta sonraya planlanınca “pekiştirildi” sayılır.</p>
          </div>
        )}
        {exams.length > 0 && (
          <div className="progress-block">
            <div className="section-head">
              <strong>Sınav provaları</strong>
              <span className="subtle">Son {recent.length} prova</span>
            </div>
            <div className="exam-trend" aria-label="Son sınav puanları">
              {recent.map((e) => {
                const percent = examPercent(e.score, e.total)
                return (
                  <Link key={e.id} to={`/ders/${courseId}/sinav/${e.id}`} className="exam-bar-item" title={`${percent} puan`}>
                    <span className="exam-bar-fill" style={{ height: `${Math.max(6, percent)}%` }} />
                    <span className="exam-bar-label">{percent}</span>
                  </Link>
                )
              })}
            </div>
            <div className="list">
              {exams.slice(0, 10).map((e) => (
                <Link key={e.id} to={`/ders/${courseId}/sinav/${e.id}`} className="list-item" style={{ paddingInline: 0 }}>
                  <div className="grow">
                    <div className="title">{examPercent(e.score, e.total)} puan</div>
                    <div className="subtle">
                      {relativeDate(e.createdAt)} · {e.total} soru · {examFormatLabel(e.format, e.difficulty)}
                    </div>
                  </div>
                  <span className="subtle">Görüntüle</span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
