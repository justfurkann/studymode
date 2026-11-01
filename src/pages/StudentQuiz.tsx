import { ArrowLeft, ArrowRight, Check, Download, Link2, RotateCcw, School, Search, Share2, Sparkles } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { BrandMark } from '../components/Brand'
import { StudentCharacter } from '../components/StudentCharacter'
import { useToast } from '../components/ui'
import { useStore } from '../lib/store'
import {
  axisBars,
  examWord,
  hasUniversity,
  isTypeId,
  LEVELS,
  optionText,
  QUESTIONS,
  resultOf,
  TYPES,
  type Level,
  type QuizResult,
  type StudentType,
  type Vector,
} from '../lib/studentType'
import { searchUniversities } from '../lib/universities'
import '../styles/quiz.css'
import { recordQuizType } from '../lib/achievements'

/*
 * "Hangi öğrenci tipisin?" at /ogrenci-tipi. No account needed. Level, then (for university
 * students) the school, ten questions, and a result card that can be shared as an Instagram story
 * or as a link. The link carries the whole result, so whoever opens it sees the same card and is
 * invited to take the quiz too.
 */

type Step = 'intro' | 'level' | 'school' | 'questions' | 'result'

interface Shared {
  type: StudentType
  bars: ReturnType<typeof axisBars>
  percent: number
  runnerUp: StudentType | null
  level: Level | null
  school: string
}

const LEVEL_LABEL: Record<Level, string> = Object.fromEntries(LEVELS.map((l) => [l.id, l.label])) as Record<Level, string>

/** The result in the address, e.g. ?tip=gecekusu&p=40,80,-60,90&y=93&s=universite&okul=ODTÜ */
function resultParams(r: Shared, profile: Vector): URLSearchParams {
  const p = new URLSearchParams({
    tip: r.type.id,
    p: [profile.plan, profile.depth, profile.social, profile.night].map((v) => Math.round(v * 100)).join(','),
    y: String(r.percent),
  })
  if (r.level) p.set('s', r.level)
  if (r.school) p.set('okul', r.school.slice(0, 60))
  if (r.runnerUp) p.set('iki', r.runnerUp.id)
  return p
}

function sharedFromParams(params: URLSearchParams): Shared | null {
  const id = params.get('tip')
  if (!isTypeId(id)) return null
  const raw = (params.get('p') ?? '').split(',').map(Number)
  const clamp = (n: number) => (Number.isFinite(n) ? Math.max(-1, Math.min(1, n / 100)) : 0)
  const profile: Vector = { plan: clamp(raw[0]), depth: clamp(raw[1]), social: clamp(raw[2]), night: clamp(raw[3]), style: 0 }
  const level = LEVELS.find((l) => l.id === params.get('s'))?.id ?? null
  const runner = params.get('iki')
  const percent = Math.max(0, Math.min(100, Number(params.get('y')) || 0))
  return { type: TYPES[id], bars: axisBars(profile), percent, runnerUp: isTypeId(runner) ? TYPES[runner] : null, level, school: (params.get('okul') ?? '').slice(0, 60) }
}

export default function StudentQuiz() {
  const [params, setParams] = useSearchParams()
  const opened = useMemo(() => sharedFromParams(params), []) // eslint-disable-line react-hooks/exhaustive-deps
  const [step, setStep] = useState<Step>(opened ? 'result' : 'intro')
  const [level, setLevel] = useState<Level | null>(null)
  const [school, setSchool] = useState('')
  const [answers, setAnswers] = useState<number[]>([])
  const [result, setResult] = useState<QuizResult | null>(null)
  /** Opened from someone else's link: show their card and invite to take the quiz. */
  const [visitor, setVisitor] = useState(!!opened)

  useEffect(() => {
    document.title = 'Hangi öğrenci tipisin? · studymode'
    return () => {
      document.title = 'studymode'
    }
  }, [])

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [step, answers.length])

  const shared: Shared | null = result
    ? { type: result.type, bars: axisBars(result.profile), percent: result.matches[0].percent, runnerUp: result.runnerUp, level, school }
    : opened

  function start() {
    setVisitor(false)
    setAnswers([])
    setResult(null)
    setParams({}, { replace: true })
    setStep('level')
  }

  function chooseLevel(next: Level) {
    setLevel(next)
    if (!hasUniversity(next)) setSchool('')
    setStep(hasUniversity(next) ? 'school' : 'questions')
  }

  function answer(choice: number) {
    const next = [...answers, choice]
    setAnswers(next)
    if (next.length === QUESTIONS.length) {
      const r = resultOf(next)
      recordQuizType(r.type.id)
      setResult(r)
      setStep('result')
      setParams(resultParams({ type: r.type, bars: [], percent: r.matches[0].percent, runnerUp: r.runnerUp, level, school }, r.profile), { replace: true })
    }
  }

  return (
    <div className="quiz-page">
      <header className="quiz-top">
        <Link to="/tanitim" className="quiz-brand" aria-label="studymode tanıtım sayfası">
          <BrandMark size={28} />
          <span>
            study<span className="hl">mode</span>
          </span>
        </Link>
        <Link to="/" className="btn btn-sm">
          Uygulamayı aç
        </Link>
      </header>

      <main className="quiz-main">
        {step === 'intro' && <Intro onStart={start} />}
        {step === 'level' && <LevelStep onPick={chooseLevel} onBack={() => setStep('intro')} />}
        {step === 'school' && (
          <SchoolStep
            initial={school}
            onDone={(name) => {
              setSchool(name)
              setStep('questions')
            }}
            onBack={() => setStep('level')}
          />
        )}
        {step === 'questions' && (
          <QuestionStep
            level={level}
            answers={answers}
            onAnswer={answer}
            onBack={() => (answers.length ? setAnswers(answers.slice(0, -1)) : setStep(hasUniversity(level) ? 'school' : 'level'))}
          />
        )}
        {step === 'result' && shared && <ResultStep shared={shared} visitor={visitor} matches={result?.matches ?? null} onRestart={start} />}
      </main>
    </div>
  )
}

function Intro({ onStart }: { onStart: () => void }) {
  return (
    <section className="quiz-card quiz-intro">
      <div className="quiz-intro-cast" aria-hidden="true">
        {(['gecekusu', 'fosforlu', 'sondakika'] as const).map((id) => (
          <StudentCharacter key={id} id={id} size={96} />
        ))}
      </div>
      <h1>
        Hangi <span className="hl">öğrenci</span> tipisin?
      </h1>
      <p className="quiz-lead">10 soru, bir dakika. Nasıl plan yaptığına, nasıl öğrendiğine, kiminle ve ne zaman çalıştığına bakıp 8 tipten sana en yakın olanı buluyoruz. Sonunda karakterin, güçlü yanların ve sana özel bir çalışma taktiği var.</p>
      <button className="btn btn-primary btn-lg" onClick={onStart}>
        Teste başla <ArrowRight size={18} />
      </button>
      <p className="subtle">Hesap gerekmez. Cevapların hiçbir yere kaydedilmez.</p>
    </section>
  )
}

function LevelStep({ onPick, onBack }: { onPick: (level: Level) => void; onBack: () => void }) {
  return (
    <section className="quiz-card">
      <BackButton onClick={onBack} />
      <h2>Önce seni tanıyalım: nerede okuyorsun?</h2>
      <div className="quiz-options">
        {LEVELS.map((l) => (
          <button key={l.id} className="quiz-option" onClick={() => onPick(l.id)}>
            <strong>{l.label}</strong>
            <span>{l.hint}</span>
          </button>
        ))}
      </div>
    </section>
  )
}

function SchoolStep({ initial, onDone, onBack }: { initial: string; onDone: (name: string) => void; onBack: () => void }) {
  const [query, setQuery] = useState(initial)
  const matches = searchUniversities(query)
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => input.current?.focus(), [])
  const typed = query.trim()
  return (
    <section className="quiz-card">
      <BackButton onClick={onBack} />
      <h2>Hangi üniversitedesin?</h2>
      <p className="subtle">Sonuç kartında görünür. İstemezsen atlayabilirsin.</p>
      <label className="quiz-search">
        <Search size={18} aria-hidden />
        <input ref={input} className="input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Örn. ODTÜ, Ege, Boğaziçi" aria-label="Üniversite ara" />
      </label>
      {typed && (
        <div className="quiz-options" role="list">
          {matches.map((u) => (
            <button key={u.name} role="listitem" className="quiz-option" onClick={() => onDone(u.short)}>
              <strong>{u.name}</strong>
              <span>{u.city}</span>
            </button>
          ))}
          {!matches.some((u) => u.name.toLocaleLowerCase('tr-TR') === typed.toLocaleLowerCase('tr-TR')) && (
            <button className="quiz-option is-plain" onClick={() => onDone(typed.slice(0, 60))}>
              <strong>
                <School size={16} aria-hidden /> Listede yok: “{typed.slice(0, 60)}” yaz
              </strong>
            </button>
          )}
        </div>
      )}
      <button className="btn btn-ghost" onClick={() => onDone('')}>
        Atla <ArrowRight size={16} />
      </button>
    </section>
  )
}

function QuestionStep({ level, answers, onAnswer, onBack }: { level: Level | null; answers: number[]; onAnswer: (i: number) => void; onBack: () => void }) {
  const index = answers.length
  const question = QUESTIONS[index]
  const words = examWord(level)
  // A short pause on the chosen option feels like a real tap before the next question.
  const [picked, setPicked] = useState<number | null>(null)
  useEffect(() => setPicked(null), [index])
  if (!question) return null
  function pick(i: number) {
    if (picked !== null) return
    setPicked(i)
    window.setTimeout(() => onAnswer(i), 220)
  }
  return (
    <section className="quiz-card" aria-live="polite">
      <div className="quiz-progress-row">
        <BackButton onClick={onBack} />
        <span className="subtle">
          {index + 1} / {QUESTIONS.length}
        </span>
      </div>
      <div className="progress" role="progressbar" aria-label="Test ilerlemesi" aria-valuenow={index} aria-valuemin={0} aria-valuemax={QUESTIONS.length}>
        <div style={{ width: `${(index / QUESTIONS.length) * 100}%`, background: 'var(--hi)' }} />
      </div>
      <h2 key={question.id} className="quiz-question">
        {question.text(words)}
      </h2>
      <div className="quiz-options">
        {question.options.map((o, i) => (
          <button key={`${question.id}-${i}`} className={`quiz-option ${picked === i ? 'is-picked' : ''}`} onClick={() => pick(i)} aria-pressed={picked === i}>
            <span className="quiz-letter">{'ABCD'[i]}</span>
            <strong>{optionText(o, words)}</strong>
          </button>
        ))}
      </div>
    </section>
  )
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button className="btn btn-ghost btn-sm quiz-back" onClick={onClick}>
      <ArrowLeft size={16} /> Geri
    </button>
  )
}

function ResultStep({ shared, visitor, matches, onRestart }: { shared: Shared; visitor: boolean; matches: QuizResult['matches'] | null; onRestart: () => void }) {
  const { type, bars, percent, runnerUp, level, school } = shared
  const store = useStore()
  const toast = useToast()
  const art = useRef<HTMLDivElement>(null)
  const [story, setStory] = useState<{ url: string; blob: Blob } | null>(null)
  const buddy = TYPES[type.buddy]
  const where = [school, level ? LEVEL_LABEL[level] : ''].filter(Boolean).join(' · ')

  useEffect(() => {
    let url = ''
    let cancelled = false
    const svg = art.current?.querySelector('svg')
    if (!svg) return
    void drawStory(shared, svg).then((blob) => {
      if (!blob || cancelled) return
      url = URL.createObjectURL(blob)
      setStory({ url, blob })
    })
    return () => {
      cancelled = true
      if (url) URL.revokeObjectURL(url)
    }
  }, [shared.type.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const file = story ? new File([story.blob], `ogrenci-tipim-${type.id}.png`, { type: 'image/png' }) : null
  const canShareFile = !!file && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })

  async function shareStory() {
    if (!file) return
    try {
      await navigator.share({ files: [file], text: `Ben bir ${type.name}! Sen hangi öğrenci tipisin? ${window.location.origin}/ogrenci-tipi` })
    } catch {
      // Share sheet closed.
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      toast('Bağlantı kopyalandı')
    } catch {
      toast('Kopyalanamadı; adres çubuğundaki bağlantıyı paylaşabilirsin')
    }
  }

  return (
    <section className="quiz-result">
      {visitor && (
        <div className="quiz-visitor">
          <span>Arkadaşın bu testi çözdü. Sen hangi tipsin?</span>
          <button className="btn btn-primary btn-sm" onClick={onRestart}>
            Sen de çöz <ArrowRight size={16} />
          </button>
        </div>
      )}
      <article className="quiz-card quiz-result-card" style={{ ['--type' as string]: type.colors[0] }}>
        <div className="quiz-result-hero">
          <div className="quiz-result-art">
            <StudentCharacter id={type.id} size={180} />
          </div>
          <div>
            {where && <span className="chip">{where}</span>}
            <p className="quiz-kicker">{visitor ? 'Arkadaşın bir' : 'Sen bir'}</p>
            <h1>
              <span className="hl">{type.name}</span>
            </h1>
            <p className="quiz-tagline">{type.tagline}</p>
            {percent > 0 && <p className="subtle">Uyum: %{percent}{runnerUp ? ` · Yakın ikinci: ${runnerUp.name}` : ''}</p>}
          </div>
        </div>

        <p className="quiz-description">{type.description}</p>

        <div className="quiz-bars" aria-label="Çalışma profilin">
          {bars.map((b) => (
            <div key={b.label} className="quiz-bar">
              <span>{b.label}</span>
              <div className="quiz-bar-track">
                <div style={{ width: `${b.percent}%` }} />
              </div>
              <strong>%{b.percent}</strong>
            </div>
          ))}
        </div>

        <div className="quiz-facts">
          <div>
            <h3>Süper gücün</h3>
            <ul>
              {type.strengths.map((s) => (
                <li key={s}>
                  <Check size={16} aria-hidden /> {s}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3>Kör noktan</h3>
            <p>{type.blindSpot}</p>
          </div>
        </div>

        <div className="quiz-tactic">
          <Sparkles size={18} aria-hidden />
          <p>
            <strong>Sana özel taktik: </strong>
            {type.tactic}
          </p>
        </div>

        <div className="quiz-buddy">
          <StudentCharacter id={buddy.id} size={56} still />
          <p>
            <strong>En iyi çalışma arkadaşın:</strong> {buddy.name}. {buddy.tagline}
          </p>
        </div>

        {matches && (
          <details className="quiz-all">
            <summary>Bütün tiplere uyumun</summary>
            <ul>
              {matches.map((m) => (
                <li key={m.type.id}>
                  <span>{m.type.name}</span>
                  <span className="quiz-bar-track small">
                    <span style={{ width: `${m.percent}%` }} />
                  </span>
                  <strong>%{m.percent}</strong>
                </li>
              ))}
            </ul>
          </details>
        )}
      </article>

      {/* The still character the story image is drawn from. */}
      <div ref={art} className="sr-only" aria-hidden="true">
        <StudentCharacter id={type.id} size={600} still />
      </div>

      {!visitor && (
        <div className="quiz-share">
          <h2>Paylaş</h2>
          <div className="quiz-share-preview">{story ? <img src={story.url} alt={`Hikâye görseli: ${type.name}`} /> : <div className="quiz-story-loading" />}</div>
          <div className="quiz-share-buttons">
            {canShareFile && (
              <button className="btn btn-primary" onClick={shareStory}>
                <Share2 size={18} /> Hikâyende paylaş
              </button>
            )}
            <a className={`btn ${canShareFile ? '' : 'btn-primary'}`} href={story?.url} download={`ogrenci-tipim-${type.id}.png`} aria-disabled={!story}>
              <Download size={18} /> Görseli indir
            </a>
            <button className="btn" onClick={copyLink}>
              <Link2 size={18} /> Bağlantıyı kopyala
            </button>
          </div>
          {!canShareFile && <p className="subtle">Instagram’da: görseli indir, hikâye ekle, galeriden seç.</p>}
        </div>
      )}

      <div className="quiz-card quiz-cta">
        <h2>
          {type.name} için <span className="hl">çalışma planı</span>
        </h2>
        <p>studymode ders notlarından özet, test ve tekrar kartları hazırlar; sınav tarihine göre her gün neyi çalışacağını söyler. Ücretsiz.</p>
        <div className="quiz-share-buttons">
          <Link to={store.session ? '/' : '/tanitim'} className="btn btn-primary">
            studymode’u dene <ArrowRight size={18} />
          </Link>
          {!visitor && (
            <button className="btn btn-ghost" onClick={onRestart}>
              <RotateCcw size={16} /> Testi yeniden çöz
            </button>
          )}
        </div>
      </div>
    </section>
  )
}

// ---------- Story image (1080×1920) ----------

const W = 1080
const H = 1920
const DISPLAY = '"Bricolage Grotesque Variable", "Figtree Variable", system-ui, sans-serif'
const BODY = '"Figtree Variable", system-ui, sans-serif'

function wrapLines(g: CanvasRenderingContext2D, text: string, max: number): string[] {
  const lines: string[] = []
  let line = ''
  for (const word of text.split(' ')) {
    const next = line ? `${line} ${word}` : word
    if (g.measureText(next).width > max && line) {
      lines.push(line)
      line = word
    } else line = next
  }
  if (line) lines.push(line)
  return lines
}

async function svgImage(svg: SVGSVGElement): Promise<HTMLImageElement | null> {
  try {
    const markup = new XMLSerializer().serializeToString(svg)
    const img = new Image()
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`
    await img.decode()
    return img
  } catch {
    return null
  }
}

async function drawStory(shared: Shared, svg: SVGSVGElement): Promise<Blob | null> {
  const { type, bars, percent, level, school } = shared
  try {
    await Promise.all([document.fonts.load(`800 80px "Bricolage Grotesque Variable"`), document.fonts.load(`600 40px "Figtree Variable"`)])
  } catch {
    // System fonts are fine.
  }
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const g = canvas.getContext('2d')
  if (!g) return null

  // Navy grid paper with a soft glow in the type's colour.
  g.fillStyle = '#1b2250'
  g.fillRect(0, 0, W, H)
  const glow = g.createRadialGradient(W / 2, 640, 40, W / 2, 640, 620)
  glow.addColorStop(0, `${type.colors[0]}88`)
  glow.addColorStop(1, '#1b225000')
  g.fillStyle = glow
  g.fillRect(0, 0, W, H)
  g.strokeStyle = 'rgba(255,255,255,0.05)'
  g.lineWidth = 2
  for (let x = 0; x <= W; x += 54) (g.beginPath(), g.moveTo(x, 0), g.lineTo(x, H), g.stroke())
  for (let y = 0; y <= H; y += 54) (g.beginPath(), g.moveTo(0, y), g.lineTo(W, y), g.stroke())

  g.textAlign = 'center'
  g.fillStyle = '#ffe14d'
  g.font = `800 44px ${DISPLAY}`
  g.fillText('HANGİ ÖĞRENCİ TİPİSİN?', W / 2, 150)
  const where = [school, level ? LEVEL_LABEL[level] : ''].filter(Boolean).join(' · ')
  if (where) {
    g.font = `700 36px ${BODY}`
    const w = g.measureText(where).width + 56
    g.fillStyle = 'rgba(255,255,255,0.12)'
    g.beginPath()
    g.roundRect(W / 2 - w / 2, 190, w, 64, 32)
    g.fill()
    g.fillStyle = '#ffffff'
    g.fillText(where, W / 2, 235)
  }

  const img = await svgImage(svg)
  if (img) g.drawImage(img, W / 2 - 300, 270, 600, 600)

  g.fillStyle = 'rgba(255,255,255,0.8)'
  g.font = `600 44px ${BODY}`
  g.fillText('Ben bir', W / 2, 950)

  // The type name, highlighted like the app's headings.
  g.font = `800 96px ${DISPLAY}`
  const nameLines = wrapLines(g, type.name, W - 140)
  let y = 1050
  for (const line of nameLines) {
    const w = g.measureText(line).width
    g.fillStyle = type.colors[0]
    g.beginPath()
    g.roundRect(W / 2 - w / 2 - 22, y - 78, w + 44, 100, 18)
    g.fill()
    g.fillStyle = '#1b2250'
    g.fillText(line, W / 2, y)
    y += 112
  }
  g.fillStyle = '#ffffff'
  g.font = `600 46px ${BODY}`
  g.fillText(type.tagline, W / 2, y + 10)
  y += 70
  if (percent > 0) {
    g.fillStyle = 'rgba(255,255,255,0.65)'
    g.font = `600 34px ${BODY}`
    g.fillText(`Uyum %${percent}`, W / 2, y + 6)
    y += 40
  }

  // Profile bars.
  y += 40
  g.textAlign = 'left'
  for (const b of bars) {
    g.fillStyle = '#ffffff'
    g.font = `700 36px ${BODY}`
    g.fillText(b.label, 120, y)
    g.textAlign = 'right'
    g.fillText(`%${b.percent}`, W - 120, y)
    g.textAlign = 'left'
    g.fillStyle = 'rgba(255,255,255,0.15)'
    g.beginPath()
    g.roundRect(120, y + 16, W - 240, 22, 11)
    g.fill()
    g.fillStyle = '#ffe14d'
    g.beginPath()
    g.roundRect(120, y + 16, ((W - 240) * b.percent) / 100, 22, 11)
    g.fill()
    y += 92
  }

  // One line of what makes this type good, if there is room above the footer.
  g.textAlign = 'center'
  g.font = `600 36px ${BODY}`
  const power = wrapLines(g, `Süper gücüm: ${type.strengths[0]}`, W - 200)
  if (y + power.length * 48 < H - 220) {
    g.fillStyle = 'rgba(255,255,255,0.88)'
    power.forEach((line, i) => g.fillText(line, W / 2, y + 30 + i * 48))
  }

  g.fillStyle = '#ffe14d'
  g.font = `800 40px ${DISPLAY}`
  g.fillText('Sen hangi tipsin?', W / 2, H - 140)
  g.fillStyle = '#ffffff'
  g.font = `700 38px ${BODY}`
  g.fillText('studymode.fun/ogrenci-tipi', W / 2, H - 84)

  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/png'))
}
