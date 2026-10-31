import { ArrowLeft, Brain, PartyPopper, RotateCcw, Shuffle, Volume2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import type { Card } from '../lib/types'
import { Celebrate, Empty } from '../components/ui'
import { dueCards } from '../lib/format'
import { examDateForCard } from '../lib/courseExams'
import { intervalLabel, schedule, type Grade } from '../lib/srs'
import { useStore } from '../lib/store'
import { useLoadDemo } from '../lib/useDemo'
import { Mola, ReviewSwitch } from './Mola'

const GRADES: Array<{ grade: Grade; label: string; key: string }> = [
  { grade: 'again', label: 'Bilemedim', key: '1' },
  { grade: 'hard', label: 'Zor', key: '2' },
  { grade: 'good', label: 'İyi', key: '3' },
  { grade: 'easy', label: 'Kolay', key: '4' },
]

/** The Tekrar tab: today's reviews, and next to them "Mola" (games and the focus timer). */
export function Review() {
  const [params] = useSearchParams()
  // A review started from a note or a course stays focused on it; the switch is for the tab itself.
  const scoped = !!(params.get('not') || params.get('ders'))
  if (!scoped && params.get('bolum') === 'mola') return <Mola />
  return <ReviewSession showSwitch={!scoped} />
}

function ReviewSession({ showSwitch }: { showSwitch: boolean }) {
  const store = useStore()
  const loadDemo = useLoadDemo()
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
  const [hardOnly, setHardOnly] = useState(false)
  const [last, setLast] = useState<{ card: Card; queue: string[]; done: number } | null>(null)
  const [speechError, setSpeechError] = useState('')
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
    setLast({ card: { ...card }, queue: [...queue], done })
    store.reviewCard(card.id, grade)
    setRevealed(false)
    setDone((n) => n + 1)
    setQueue(([first, ...rest]) => (grade === 'again' ? [...rest, first] : rest))
  }

  function undo() {
    if (!last) return
    store.restoreCard(last.card)
    setQueue(last.queue); setDone(last.done); setRevealed(true); setLast(null)
  }
  function shuffle() {
    setQueue(current => { const next = [...current]; for (let i = next.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [next[i], next[j]] = [next[j], next[i]] } return next })
    setRevealed(false); setLast(null)
  }
  function filterHard(value: boolean) {
    const scope = store.data.cards.filter(c => (!noteId || c.noteId === noteId) && (!courseId || c.courseId === courseId))
    setQueue((value ? scope.filter(c => c.lapses > 0) : noteId ? scope : dueCards(scope)).map(c => c.id))
    setHardOnly(value); setRevealed(false); setLast(null); setDone(0)
  }
  function speak() {
    if (!card || !('speechSynthesis' in window)) return
    speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(revealed ? card.back : card.front)
    utterance.lang = 'tr-TR'
    utterance.onerror = () => setSpeechError('Tarayıcı bu metni seslendiremedi. Ses veya dil ayarlarını kontrol et.')
    setSpeechError(''); speechSynthesis.speak(utterance)
  }
  useEffect(() => () => { if ('speechSynthesis' in window) speechSynthesis.cancel() }, [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!card || (event.target instanceof HTMLElement && event.target.closest('input,textarea,select'))) return
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
        {showSwitch ? (
          <ReviewSwitch active="tekrar" />
        ) : (
          <Link to={back} className="back-link">
            <ArrowLeft size={16} /> Geri
          </Link>
        )}
        <div className="btn-row">{last && <button className="btn" onClick={undo}><RotateCcw size={16} /> Son cevabı geri al</button>}{hardOnly && <button className="btn" onClick={() => filterHard(false)}>Tüm kartlara dön</button>}</div>
        <div className="panel">
          {done > 0 ? (
            <Empty icon={<PartyPopper size={36} />} title={<>Oturum <Celebrate>bitti!</Celebrate></>}>
              <p>{done} kart tekrar ettin. Kartlar, verdiğin cevaplara göre tekrar planlandı.</p>
              <Link to="/" className="btn btn-primary">
                Bugün sayfasına dön
              </Link>
            </Empty>
          ) : !store.data.cards.length ? (
            <Empty icon={<Brain size={36} />} title="Henüz tekrar kartın yok">
              <p>Kartlar notlarından oluşur. Bir not ekle; uygulama hangi kartı ne zaman tekrar edeceğini senin için planlasın.</p>
              <div className="btn-row" style={{ justifyContent: 'center' }}>
                <Link to="/not-ekle" className="btn btn-primary">
                  Not ekle
                </Link>
                {!store.data.courses.length && (
                  <button className="btn" onClick={loadDemo}>
                    Örnek notla dene
                  </button>
                )}
              </div>
            </Empty>
          ) : (
            <Empty icon={<Brain size={36} />} title="Şu an tekrar edilecek kart yok">
              <p>Bugünlük tekrarların bitti. Kartlar, verdiğin cevaplara göre doğru zamanda burada yeniden görünecek.</p>
              <div className="btn-row" style={{ justifyContent: 'center' }}>
                <Link to="/tekrar?bolum=mola&oyun=eslestir" className="btn">
                  Molada eşleştir oyna
                </Link>
                <Link to="/" className="btn">
                  Bugün sayfasına dön
                </Link>
              </div>
            </Empty>
          )}
        </div>
      </div>
    )
  }

  const now = new Date()
  // Same cap the store uses when saving the answer: the nearest exam that covers this card's note.
  const exam = examDateForCard(store.data, card, now)

  return (
    <div className="page">
      <div className="review">
        {showSwitch && <ReviewSwitch active="tekrar" />}
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

        <div className="btn-row review-tools"><button className="btn btn-sm" onClick={shuffle}><Shuffle size={15} /> Karıştır</button><label className="chip"><input type="checkbox" checked={hardOnly} onChange={e => filterHard(e.target.checked)} /> Yalnızca zorlandıklarım</label><button className="btn btn-sm" onClick={speak} disabled={!('speechSynthesis' in window)}><Volume2 size={15} /> Sesli oku</button><button className="btn btn-sm" onClick={undo} disabled={!last}><RotateCcw size={15} /> Geri al</button></div>
        {speechError && <p role="status" className="subtle">{speechError}</p>}
        <article key={card.id + String(revealed)} className={`flashcard flip-reveal ${revealed ? 'is-revealed' : ''}`} aria-live="polite">
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
