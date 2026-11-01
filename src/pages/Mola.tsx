import { Grid2x2Check, Sparkles, Timer, Zap } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { FocusTimer } from '../components/mola/FocusTimer'
import { MatchGame } from '../components/mola/MatchGame'
import { QuickGame } from '../components/mola/QuickGame'
import { useFocus } from '../lib/focusStore'
import { cardsInScope, focusLastWeek, formatClock, formatSeconds, isWaiting, MATCH_MIN_PAIRS, QUICK_LIVES, QUICK_MIN_CARDS, QUICK_SECONDS, readRecords, remainingMs, scopeKey } from '../lib/mola'
import { useStore } from '../lib/store'
import { useLoadDemo } from '../lib/useDemo'

type Game = 'eslestir' | 'hizli' | 'odak'
const GAMES: Game[] = ['eslestir', 'hizli', 'odak']
const SCOPE_KEY = 'studymode.molaScope'

/** "Tekrar | Mola" switch at the top of the Tekrar tab. */
export function ReviewSwitch({ active }: { active: 'tekrar' | 'mola' }) {
  const navigate = useNavigate()
  return (
    <div className="segmented review-switch" role="tablist" aria-label="Tekrar bölümü">
      <button role="tab" aria-selected={active === 'tekrar'} onClick={() => navigate('/tekrar')}>
        Tekrar
      </button>
      <button role="tab" aria-selected={active === 'mola'} onClick={() => navigate('/tekrar?bolum=mola')}>
        Mola
      </button>
    </div>
  )
}

function readScope(): string | null {
  try {
    return localStorage.getItem(SCOPE_KEY) || null
  } catch {
    return null
  }
}

export function Mola() {
  const store = useStore()
  const navigate = useNavigate()
  const loadDemo = useLoadDemo()
  const [params, setParams] = useSearchParams()
  const game = GAMES.find((g) => g === params.get('oyun')) ?? null
  const [scope, setScopeState] = useState<string | null>(readScope)
  const timer = useFocus()

  const courses = useMemo(
    () =>
      store.data.courses
        .map((course) => ({ course, count: cardsInScope(store.data.cards, course.id).length }))
        .filter((c) => c.count > 0),
    [store.data.courses, store.data.cards],
  )
  // A remembered course that has no cards any more falls back to all courses.
  const courseId = scope && courses.some((c) => c.course.id === scope) ? scope : null
  const cards = useMemo(() => cardsInScope(store.data.cards, courseId), [store.data.cards, courseId])

  function setScope(value: string | null) {
    setScopeState(value)
    try {
      if (value) localStorage.setItem(SCOPE_KEY, value)
      else localStorage.removeItem(SCOPE_KEY)
    } catch {
      // Blocked storage: the choice lasts for this visit.
    }
  }
  const open = (next: Game | null) => {
    const p = new URLSearchParams(params)
    if (next) p.set('oyun', next)
    else p.delete('oyun')
    setParams(p)
  }
  const exit = () => open(null)

  if (game === 'eslestir' && cards.length >= MATCH_MIN_PAIRS) return <MatchGame cards={cards} courseId={courseId} onExit={exit} />
  if (game === 'hizli' && cards.length >= QUICK_MIN_CARDS) return <QuickGame cards={cards} courseId={courseId} onExit={exit} />
  if (game === 'odak')
    return (
      <FocusTimer
        onExit={exit}
        onPlay={(g) => {
          setScopeState(readScope())
          open(g)
        }}
      />
    )

  const records = readRecords()
  const key = scopeKey(courseId)
  const scopeName = courseId ? courses.find((c) => c.course.id === courseId)?.course.name : null

  return (
    <div className="page page-narrow mola">
      <ReviewSwitch active="mola" />
      <div className="page-header">
        <div>
          <h1>
            Kısa bir <span className="hl">mola</span>
          </h1>
          <p className="muted">Kendi kartlarınla iki dakikalık oyunlar ve bir odak sayacı. Oyunlar tekrar planını değiştirmez, ama serini korur.</p>
        </div>
      </div>

      {courses.length > 1 && (
        <label className="field mola-scope">
          <span>Hangi dersin kartları?</span>
          <select className="select" value={courseId ?? ''} onChange={(e) => setScope(e.target.value || null)}>
            <option value="">Tüm dersler ({cardsInScope(store.data.cards, null).length} kart)</option>
            {courses.map(({ course, count }) => (
              <option key={course.id} value={course.id}>
                {course.name} ({count} kart)
              </option>
            ))}
          </select>
        </label>
      )}

      <div className="mola-grid">
        <MolaTile
          icon={<Grid2x2Check size={22} />}
          title="Eşleştir"
          text="Solda kavramlar, sağda cevaplar. Süreye karşı eşleştir; yanlış eşleşme +2 saniye."
          meta={records.match[key] !== undefined ? `Rekor: ${formatSeconds(records.match[key])}` : 'Henüz rekor yok'}
          locked={cards.length < MATCH_MIN_PAIRS ? `En az ${MATCH_MIN_PAIRS} kart gerekiyor` : null}
          onOpen={() => open('eslestir')}
        />
        <MolaTile
          icon={<Zap size={22} />}
          title="Hızlı tur"
          text={`Kartı sağa ya da sola kaydır: doğru mu, yanlış mı? ${QUICK_SECONDS} saniye, ${QUICK_LIVES} hak.`}
          meta={records.quick[key] ? `Rekor: ${records.quick[key]} puan` : 'Henüz rekor yok'}
          locked={cards.length < QUICK_MIN_CARDS ? `En az ${QUICK_MIN_CARDS} kart gerekiyor` : null}
          onOpen={() => open('hizli')}
        />
        <MolaTile
          icon={<Timer size={22} />}
          title="Odak sayacı"
          text="Pomodoro: 25 dakika odak, 5 dakika mola. Bitince haber verir, molada oyun önerir."
          meta={
            timer
              ? isWaiting(timer)
                ? `${timer.round}. tur hazır`
                : `${timer.phase === 'focus' ? 'Odak' : 'Mola'} ${timer.endsAt === null ? 'duraklatıldı' : 'sürüyor'}: ${formatClock(remainingMs(timer))}`
              : `Son 7 gün: ${focusLastWeek(records.focus)} dk`
          }
          locked={null}
          onOpen={() => open('odak')}
        />
        <MolaTile
          icon={<Sparkles size={22} />}
          title="Hangi öğrenci tipisin?"
          text="10 soruluk test: karakterin, güçlü yanların ve sana özel çalışma taktiği. Sonucu hikâyende paylaş."
          meta="2 dakika · hesap gerekmez"
          locked={null}
          onOpen={() => navigate('/ogrenci-tipi')}
        />
      </div>

      {cards.length < QUICK_MIN_CARDS && (
        <div className="panel mola-empty">
          <p className="muted">
            {store.data.cards.length
              ? 'Oyunlar için birbirinden farklı birkaç kart gerekiyor. Notlarından biraz daha kart oluştur.'
              : 'Oyunlar senin kartlarınla oynanır. Bir not ekle; kartlar ondan oluşsun.'}
          </p>
          <div className="btn-row">
            <Link to="/not-ekle" className="btn btn-sm">
              Not ekle
            </Link>
            {!store.data.courses.length && (
              <button className="btn btn-sm" onClick={loadDemo}>
                Örnek notla dene
              </button>
            )}
          </div>
        </div>
      )}
      {scopeName && <p className="subtle">Oyunlar yalnızca {scopeName} kartlarından gelir. Rekorlar ders başına ayrı tutulur.</p>}
    </div>
  )
}

function MolaTile({ icon, title, text, meta, locked, onOpen }: { icon: ReactNode; title: string; text: string; meta: string; locked: string | null; onOpen: () => void }) {
  return (
    <button className="mola-tile" onClick={onOpen} disabled={!!locked} aria-label={title}>
      <span className="mola-tile-icon" aria-hidden="true">
        {icon}
      </span>
      <span className="mola-tile-body">
        <strong>{title}</strong>
        <span className="muted">{text}</span>
        <span className="subtle">{locked ?? meta}</span>
      </span>
    </button>
  )
}
