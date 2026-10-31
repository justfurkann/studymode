import { BookOpen, CalendarClock, FileText, Layers, ListChecks } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Alert, Empty, Spinner, useToast } from '../components/ui'
import { examName } from '../lib/courseExams'
import { fetchShare, importedCourseId, rememberImport, ShareError, snapshotCounts, type FetchedShare } from '../lib/share'
import { useStore } from '../lib/store'

/** /paylas/:token — what a friend sees when they open a shared course link. */
export function SharedCourse() {
  const { token = '' } = useParams()
  const store = useStore()
  const toast = useToast()
  const navigate = useNavigate()
  const [state, setState] = useState<{ status: 'loading' } | { status: 'missing' } | { status: 'error'; message: string } | { status: 'ready'; share: FetchedShare }>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let alive = true
    setState({ status: 'loading' })
    fetchShare(token)
      .then((share) => alive && setState(share ? { status: 'ready', share } : { status: 'missing' }))
      .catch((e) => alive && setState({ status: 'error', message: e instanceof ShareError ? e.message : 'Paylaşılan ders yüklenemedi.' }))
    return () => {
      alive = false
    }
  }, [token, attempt])

  // Added on this device before, and the course is still there.
  const existingId = importedCourseId(token)
  const existing = existingId ? store.data.courses.find((c) => c.id === existingId) : undefined

  if (state.status === 'loading') {
    return (
      <div className="page page-narrow">
        <div className="share-loading">
          <Spinner /> Paylaşılan ders yükleniyor…
        </div>
      </div>
    )
  }

  if (state.status !== 'ready') {
    return (
      <div className="page page-narrow">
        <div className="panel">
          {state.status === 'missing' ? (
            <Empty icon={<BookOpen size={32} />} title="Bu bağlantı çalışmıyor">
              <p className="muted">Paylaşım kapatılmış ya da bağlantı eksik kopyalanmış olabilir. Arkadaşından bağlantıyı yeniden göndermesini iste.</p>
              <Link to="/" className="btn">
                Uygulamaya git
              </Link>
            </Empty>
          ) : (
            <Alert tone="danger" action={<button className="btn btn-sm" onClick={() => setAttempt((n) => n + 1)}>Tekrar dene</button>}>
              {state.message}
            </Alert>
          )}
        </div>
      </div>
    )
  }

  const { snapshot, ownerName } = state.share
  const counts = snapshotCounts(snapshot)

  function add() {
    const course = store.importCourse(snapshot)
    rememberImport(token, course.id)
    toast(`${course.name} derslerine eklendi`)
    navigate(`/ders/${course.id}`)
  }

  return (
    <div className="page page-narrow shared">
      <div className="page-header">
        <div>
          <p className="subtle">{ownerName ? `${ownerName} seninle bir ders paylaştı` : 'Seninle bir ders paylaşıldı'}</p>
          <h1>{snapshot.course.name}</h1>
        </div>
      </div>

      <div className="focus-card shared-card">
        <div className="stat-row">
          <span>
            <FileText size={15} /> {counts.notes} not
          </span>
          <span>
            <Layers size={15} /> {counts.cards} kart
          </span>
          <span>
            <ListChecks size={15} /> {counts.questions} soru
          </span>
          {counts.exams > 0 && (
            <span>
              <CalendarClock size={15} /> {counts.exams} sınav tarihi
            </span>
          )}
        </div>
        <p className="muted">Ders senin hesabına kopyalanır; kartların sıfırdan başlar, kendi hızında çalışırsın. Arkadaşın senin ilerlemeni görmez.</p>
        {existing ? (
          <div className="btn-row">
            <Link to={`/ders/${existing.id}`} className="btn btn-primary">
              Derse git
            </Link>
            <button className="btn" onClick={add}>
              Bir kopya daha ekle
            </button>
          </div>
        ) : (
          <div>
            <button className="btn btn-primary btn-lg" onClick={add}>
              Derslerime ekle
            </button>
          </div>
        )}
        {existing && <p className="subtle">Bu dersi daha önce ekledin.</p>}
        {!store.session && (
          <p className="subtle">
            Hesapsız eklersen ders yalnızca bu cihazda durur. <Link to="/giris" className="link-button">Giriş yap</Link> ya da hesap aç; telefonda ve bilgisayarda aynı notları gör.
          </p>
        )}
      </div>

      <section className="section">
        <h2>İçindekiler</h2>
        <div className="panel panel-tight list">
          {snapshot.notes.map((note, i) => (
            <div key={i} className="list-item">
              <FileText size={17} style={{ color: snapshot.course.color }} />
              <div className="grow">
                <div className="title">{note.title}</div>
                <div className="subtle">
                  {note.summary ? 'Özet hazır' : 'Özet yok'} · {snapshot.cards.filter((c) => c.note === i).length} kart · {note.questions.length} soru
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {snapshot.exams.length > 0 && (
        <section className="section">
          <h2>Sınavlar</h2>
          <div className="panel panel-tight list">
            {snapshot.exams.map((exam, i) => (
              <div key={i} className="list-item">
                <CalendarClock size={17} />
                <div className="grow">
                  <div className="title">{examName(exam)}</div>
                  <div className="subtle">{new Date(`${exam.date}T12:00:00`).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', weekday: 'long' })}</div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
