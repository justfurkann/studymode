import { ArrowRight, Brain, CalendarClock, Compass, FileText, Flame, Sparkles, Target } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Welcome } from '../components/Welcome'
import { firstName } from '../lib/auth'
import { useLoadDemo } from '../lib/useDemo'
import { examCountdown, examName, upcomingExams } from '../lib/courseExams'
import { courseStats, dueCards, relativeDate } from '../lib/format'
import { computeNoteProgress } from '../lib/learningPath'
import { useSettings } from '../lib/settings'
import { useStore } from '../lib/store'
import { computeStreakSummary, isDayStudied, localDayKey, mergeStudyDays, shiftLocalDay } from '../lib/streak'
import { buildSmartStudyPlan } from '../lib/studyPlan'
import type { LearningStepId, Note } from '../lib/types'

function stepUrl(note: Note, stepId: LearningStepId): string {
  if (stepId === 'tanis' || stepId === 'anla') return `/not/${note.id}?adim=${stepId}`
  if (stepId === 'pekistir') return `/not/${note.id}?sekme=kartlar`
  if (stepId === 'sina') return `/not/${note.id}?sekme=test`
  return `/not/${note.id}?sekme=uygula`
}

export function Today() {
  const store = useStore()
  const settings = useSettings()
  const { data } = store
  const now = new Date()
  const due = dueCards(data.cards, now)
  const dateText = now.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', weekday: 'long' })

  const loadDemo = useLoadDemo()

  if (!data.courses.length) return <Welcome onDemo={loadDemo} name={firstName(store.session?.user) || undefined} />

  const streakSummary = computeStreakSummary(data.studyDays, settings.dailyGoal, now)
  const smartPlan = buildSmartStudyPlan(data, now, 2)

  // The last seven days, oldest first, for the streak strip.
  const studied = new Map(mergeStudyDays(data.studyDays).map((d) => [d.day, isDayStudied(d)]))
  const todayKey = localDayKey(now)
  const week = Array.from({ length: 7 }, (_, i) => {
    const key = shiftLocalDay(todayKey, i - 6)
    const label = new Date(`${key}T12:00:00`).toLocaleDateString('tr-TR', { weekday: 'short' })
    return { key, label, done: !!studied.get(key), today: i === 6 }
  })

  const exams = upcomingExams(data, now).slice(0, 5)

  const latestAttempt = new Map<string, (typeof data.attempts)[number]>()
  for (const attempt of data.attempts) {
    const prev = latestAttempt.get(attempt.noteId)
    if (!prev || prev.createdAt < attempt.createdAt) latestAttempt.set(attempt.noteId, attempt)
  }
  const weak = [...latestAttempt.values()]
    .filter((a) => a.score / a.total < 0.7)
    .map((a) => ({ attempt: a, note: data.notes.find((n) => n.id === a.noteId) }))
    .filter((w) => w.note)
    .slice(0, 4)

  const recent = [...data.notes].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 5)
  const courseOf = (id: string) => data.courses.find((c) => c.id === id)

  const inProgressNotes = [...data.notes]
    .filter((n) => n.generator !== null)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map((note) => ({ note, progress: computeNoteProgress(note, data.cards, data.attempts) }))
    .filter(({ progress }) => !progress.isCompleted)
    .slice(0, 3)

  const nextDue = data.cards
    .filter((c) => Date.parse(c.due) > now.getTime())
    .sort((a, b) => a.due.localeCompare(b.due))[0]

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <p className="subtle" style={{ textTransform: 'capitalize' }}>
            {dateText}
          </p>
          <h1>{firstName(store.session?.user) ? `Merhaba ${firstName(store.session?.user)}` : 'Bugün'}</h1>
        </div>
      </div>

      {due.length > 0 ? (
        <section className="hero" aria-label="Tekrar">
          <div>
            <div className="count">{due.length}</div>
            <p>kart bugün tekrar bekliyor · yaklaşık {Math.max(1, Math.round(due.length * 0.25))} dk</p>
          </div>
          <Link to="/tekrar" className="btn btn-primary btn-lg">
            <Brain size={18} /> Tekrara başla
          </Link>
        </section>
      ) : (
        <section className="hero done" aria-label="Tekrar">
          <div>
            <h2>{data.cards.length ? 'Bugünlük tekrarların bitti' : 'Henüz tekrar kartın yok'}</h2>
            <p>
              {data.cards.length
                ? nextDue
                  ? `Sıradaki kart ${new Date(nextDue.due).toLocaleString('tr-TR', { weekday: 'long', hour: '2-digit', minute: '2-digit' })} zamanında gelecek.`
                  : 'Yeni not ekleyerek devam edebilirsin.'
                : 'Bir not ekleyip çalışma seti oluşturduğunda kartlar burada görünür.'}
            </p>
          </div>
          <Link to="/not-ekle" className="btn">
            Not ekle
          </Link>
        </section>
      )}

      <section className="panel streak-panel" aria-label="Günlük hedef ve seri">
        <div className="streak-goal">
          <div className="streak-goal-head">
            <div>
              <strong>Günlük kart hedefi</strong>
              <span className="subtle" style={{ display: 'block' }}>
                {streakSummary.goalMet
                  ? 'Bugünkü kart hedefini tamamladın.'
                  : streakSummary.todayReviews > 0
                    ? 'Hedefe ulaşmak için tekrarlara devam et.'
                    : 'Bugün henüz kart tekrar etmedin.'}
              </span>
            </div>
            <div className="streak-goal-numbers">
              <strong className="streak-fraction">
                {streakSummary.todayReviews}/{streakSummary.dailyGoal}
              </strong>
              <Link to="/ayarlar" className="subtle" style={{ color: 'var(--accent-text)', fontWeight: 550 }}>
                Hedefi değiştir
              </Link>
            </div>
          </div>
          <div className="progress" role="progressbar" aria-label="Günlük kart ilerlemesi" aria-valuenow={streakSummary.todayReviews} aria-valuemin={0} aria-valuemax={streakSummary.dailyGoal}>
            <div style={{ width: `${streakSummary.goalPercent}%`, background: streakSummary.goalMet ? 'var(--success)' : 'var(--accent)' }} />
          </div>
        </div>

        <div className={`streak-badge ${streakSummary.streak > 0 ? 'active' : ''}`}>
          <div className="streak-badge-title">
            <Flame size={18} aria-hidden="true" />
            {streakSummary.streak > 0 ? `${streakSummary.streak} gündür çalışıyorsun` : 'Çalışma serisi: 0 gün'}
          </div>
          <div className="streak-week" aria-label="Son 7 gün">
            {week.map((d) => (
              <span key={d.key} className={`${d.done ? 'done' : ''} ${d.today ? 'today' : ''}`} title={d.done ? `${d.label}: çalıştın` : `${d.label}: çalışma yok`}>
                <i />
                {d.label}
              </span>
            ))}
          </div>
          <div className="subtle">
            {streakSummary.studiedToday
              ? 'Bugünkü çalışma kaydın alındı.'
              : streakSummary.streak > 0
                ? 'Seriyi korumak için bugün en az 1 kart tekrar et veya 1 test çöz.'
                : 'Seri başlatmak için bugün en az 1 kart tekrar et veya 1 test çöz.'}
          </div>
        </div>
      </section>

      {(exams.length > 0 || data.attempts.length > 0 || data.notes.length > 1) && smartPlan.items.length > 0 && (
        <section className="section" aria-label="Akıllı çalışma planı">
          <div className="section-head">
            <div>
              <h2>{smartPlan.headline}</h2>
              <span className="subtle">{smartPlan.subheadline}</span>
            </div>
          </div>
          <div className="panel panel-tight list">
            {smartPlan.items.map((item, idx) => (
              <Link key={item.note.id} to={item.targetUrl} className="list-item" aria-label={`${idx + 1}. ${item.note.title} — ${item.actionLabel}`}>
                <Sparkles size={18} style={{ color: item.course?.color ?? 'var(--accent)' }} />
                <div className="grow">
                  <div className="title">
                    {idx + 1}. {item.note.title}
                  </div>
                  <div className="subtle">
                    {item.course?.name} · {item.reason}
                  </div>
                </div>
                <span className="chip chip-accent">{item.actionLabel}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {inProgressNotes.length > 0 && (
        <section className="section">
          <div className="section-head">
            <h2>Adım adım öğrenmeye devam et</h2>
            <span className="subtle">Sıfırdan 5 adımda konuyu tamamla</span>
          </div>
          <div className="panel panel-tight list">
            {inProgressNotes.map(({ note, progress }) => {
              const course = courseOf(note.courseId)
              const target = stepUrl(note, progress.currentStep.id)
              return (
                <Link key={note.id} to={target} className="list-item" aria-label={`${note.title} — ${progress.currentStep.stepNumber}. Adım`}>
                  <Compass size={18} style={{ color: course?.color ?? 'var(--accent)' }} />
                  <div className="grow">
                    <div className="title">{note.title}</div>
                    <div className="subtle">
                      {course?.name} · Sıradaki: {progress.currentStep.stepNumber}. Adım ({progress.currentStep.title})
                    </div>
                  </div>
                  <span className="chip chip-accent">
                    {progress.completedCount}/{progress.totalSteps} adım
                  </span>
                </Link>
              )
            })}
          </div>
        </section>
      )}

      {exams.length > 0 && (
        <section className="section">
          <h2>Yaklaşan sınavlar</h2>
          <div className="panel panel-tight list">
            {exams.map(({ course, exam }) => {
              const label = examCountdown(exam, now)!
              const stats = courseStats(data, course, now)
              return (
                <Link key={exam.id} to={`/ders/${course.id}`} className="list-item">
                  <CalendarClock size={18} style={{ color: course.color }} />
                  <div className="grow">
                    <div className="title">
                      {course.name} · {examName(exam)}
                    </div>
                    <div className="subtle">
                      {exam.weight != null ? `Ağırlık %${exam.weight} · ` : ''}
                      {exam.noteIds.length ? `${exam.noteIds.length} not` : `${stats.notes} not`} ·{' '}
                      {stats.due ? `${stats.due} kart tekrar bekliyor` : 'tekrarlar güncel'}
                    </div>
                  </div>
                  <span className={`chip ${label.tone === 'neutral' ? '' : `chip-${label.tone}`}`}>{label.text}</span>
                </Link>
              )
            })}
          </div>
        </section>
      )}

      {weak.length > 0 && (
        <section className="section">
          <h2>Tekrar çalışman gereken konular</h2>
          <div className="panel panel-tight list">
            {weak.map(({ attempt, note }) => (
              <Link key={attempt.id} to={`/not/${note!.id}?sekme=test`} className="list-item" aria-label={note!.title}>
                <Target size={18} style={{ color: 'var(--warning)' }} />
                <div className="grow">
                  <div className="title">{note!.title}</div>
                  <div className="subtle">{courseOf(note!.courseId)?.name}</div>
                </div>
                <span className="chip chip-warning">
                  Son test {attempt.score}/{attempt.total}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="section">
        <div className="section-head">
          <h2>Son notlar</h2>
          <Link to="/dersler" className="btn btn-ghost btn-sm">
            Tüm dersler
          </Link>
        </div>
        {recent.length ? (
          <div className="panel panel-tight list">
            {recent.map((note) => {
              const course = courseOf(note.courseId)
              const progress = note.generator ? computeNoteProgress(note, data.cards, data.attempts) : null
              return (
                <Link key={note.id} to={`/not/${note.id}`} className="list-item" aria-label={note.title}>
                  <FileText size={18} style={{ color: course?.color }} />
                  <div className="grow">
                    <div className="title">{note.title}</div>
                    <div className="subtle">
                      {course?.name} · {relativeDate(note.updatedAt, now)}
                      {progress ? ` · %${progress.percent} tamamlandı` : ''}
                    </div>
                  </div>
                  <ArrowRight size={16} className="muted" />
                </Link>
              )
            })}
          </div>
        ) : (
          <div className="panel">
            <p className="muted">
              Henüz not yok. <Link to="/not-ekle" style={{ color: 'var(--accent-text)', fontWeight: 600 }}>İlk notunu ekle</Link>
            </p>
          </div>
        )}
      </section>
    </div>
  )
}
