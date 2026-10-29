import { ArrowLeft, Brain, PartyPopper } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Empty } from '../components/ui'
import { dueCards } from '../lib/format'
import { intervalLabel, schedule, type Grade } from '../lib/srs'
import { useStore } from '../lib/store'

const GRADES: Array<{ grade: Grade; label: string; key: string }> = [
  { grade: 'again', label: 'Bilemedim', key: '1' },
  { grade: 'hard', label: 'Zor', key: '2' },
  { grade: 'good', label: 'İyi', key: '3' },
  { grade: 'easy', label: 'Kolay', key: '4' },
]

export function Review() {
  const store = useStore()
  const [params] = useSearchParams()
  const noteId = params.get('not')
  const courseId = params.get('ders')

  // The queue is fixed when the session starts; cards answered "Bilemedim" go to the back.
  const [queue, setQueue] = useState<string[]>(() => {
    const cards = noteId
      ? store.data.cards.filter((c) => c.noteId === noteId)
      : dueCards(store.data.cards).filter((c) => !courseId || c.courseId === courseId)
    return cards.map((c) => c.id)
  })
  const [revealed, setRevealed] = useState(false)
  const [done, setDone] = useState(0)

  const card = store.data.cards.find((c) => c.id === queue[0])
  const course = card && store.data.courses.find((c) => c.id === card.courseId)
  const scope = noteId
    ? store.data.notes.find((n) => n.id === noteId)?.title
    : courseId
      ? store.data.courses.find((c) => c.id === courseId)?.name
      : null

  function answer(grade: Grade) {
    if (!card) return
    store.reviewCard(card.id, grade)
    setRevealed(false)
    setDone((n) => n + 1)
    setQueue(([first, ...rest]) => (grade === 'again' ? [...rest, first] : rest))
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!card) return
      if (event.key === ' ' || event.key === 'Enter') {
        event.preventDefault()
        setRevealed(true)
      }
      const grade = GRADES.find((g) => g.key === event.key)
      if (revealed && grade) answer(grade.grade)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  // Skip ids whose card was deleted meanwhile.
  useEffect(() => {
    if (queue.length && !card) setQueue((q) => q.slice(1))
  }, [queue, card])

  const back = noteId ? `/not/${noteId}?sekme=kartlar` : courseId ? `/ders/${courseId}` : '/'

  if (!card) {
    return (
      <div className="page page-narrow">
        <Link to={back} className="back-link">
          <ArrowLeft size={16} /> Geri
        </Link>
        <div className="panel">
          {done > 0 ? (
            <Empty icon={<PartyPopper size={36} />} title="Oturum bitti!">
              <p>{done} kart tekrar ettin. Kartlar, verdiğin cevaplara göre tekrar planlandı.</p>
              <Link to="/" className="btn btn-primary">
                Bugün sayfasına dön
              </Link>
            </Empty>
          ) : (
            <Empty icon={<Brain size={36} />} title="Şu an tekrar edilecek kart yok">
              <p>Yeni notlar ekledikçe ve zaman geçtikçe kartlar burada görünür.</p>
              <Link to="/" className="btn">
                Bugün sayfasına dön
              </Link>
            </Empty>
          )}
        </div>
      </div>
    )
  }

  const now = new Date()
  const exam = course?.examDate ?? null

  return (
    <div className="page">
      <div className="review">
        <div className="section-head">
          <Link to={back} className="back-link">
            <ArrowLeft size={16} /> Bitir
          </Link>
          <span className="subtle">
            {scope ? `${scope} · ` : ''}
            {queue.length} kart kaldı
          </span>
        </div>
        <div className="progress" aria-hidden>
          <div style={{ width: `${(done / (done + queue.length)) * 100}%` }} />
        </div>

        <article className="flashcard" aria-live="polite">
          {course && (
            <span className="chip" style={{ width: 'fit-content' }}>
              <span className="course-swatch" style={{ background: course.color, width: 8, height: 8 }} />
              {course.name}
            </span>
          )}
          <p className="front">{card.front}</p>
          {revealed && <p className="back">{card.back}</p>}
          {revealed && card.source && <p className="source">“{card.source}”</p>}
        </article>

        {revealed ? (
          <div className="grades" role="group" aria-label="Ne kadar iyi hatırladın?">
            {GRADES.map(({ grade, label, key }) => (
              <button key={grade} className={grade} onClick={() => answer(grade)}>
                {label}
                <small>
                  {intervalLabel(schedule(card, grade, now, exam), now)} · {key}
                </small>
              </button>
            ))}
          </div>
        ) : (
          <button className="btn btn-primary btn-lg" onClick={() => setRevealed(true)}>
            Cevabı göster <span className="kbd" style={{ color: 'inherit', borderColor: 'currentColor', opacity: 0.7 }}>boşluk</span>
          </button>
        )}
        <p className="subtle" style={{ textAlign: 'center' }}>
          Önce cevabı aklından söyle, sonra kontrol et. Dürüst puanla — algoritma buna göre planlıyor.
        </p>
      </div>
    </div>
  )
}
