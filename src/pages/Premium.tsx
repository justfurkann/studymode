import { ArrowRight, AudioLines, FileText, Gem, Headphones, Image as ImageIcon, KeyRound, Lock, Search, Sparkles } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { BrandIcon } from '../components/BrandIcon'
import { SOCIALS } from '../components/MadeBy'
import { PodcastTab, VisualTab } from '../components/note/VisualAndPodcastTabs'
import { Alert, Empty, Spinner, useToast } from '../components/ui'
import { ROLE_LABEL } from '../lib/account'
import { usePremium } from '../lib/premium'
import {
  buildNoteEmbeddingText,
  EMBED_DIMS,
  rankNotesByMeaning,
  readCourseEmbeddings,
  saveCourseEmbeddings,
} from '../lib/semanticSearch'
import { useSettings } from '../lib/settings'
import { useStore } from '../lib/store'
import { supabase } from '../lib/supabase'
import type { Course, Note } from '../lib/types'
import { freshImport } from '../lib/version'

type Tool = 'ses' | 'ara' | 'gorsel'

const TOOLS: Array<{ id: Tool; title: string; text: string; icon: typeof Headphones }> = [
  { id: 'ses', title: 'Sesli not', text: 'Notun iki kişilik bir podcast olur. Gerçek insan sesiyle yolda, otobüste dinle.', icon: Headphones },
  { id: 'ara', title: 'Akıllı arama', text: 'Kelimesi geçmese de anlamca yakın notu bulur: "enerji üreten organel" yaz, mitokondri gelsin.', icon: Search },
  { id: 'gorsel', title: 'Görsel', text: 'Bir kavramı yapay zekâya çizdir; şemayı kartına ekle, indir.', icon: ImageIcon },
]

const isTool = (v: string | null): v is Tool => v === 'ses' || v === 'ara' || v === 'gorsel'

interface PlusStatus {
  used: number
  limit: number
}

/** /premium: the VIP features in one place. Others see what is inside and how to get it. */
export function Premium() {
  const store = useStore()
  const premium = usePremium()
  const [params, setParams] = useSearchParams()
  const tool: Tool = isTool(params.get('arac')) ? (params.get('arac') as Tool) : 'ses'
  const open = premium.state === 'open'

  function pickTool(next: Tool) {
    const p = new URLSearchParams(params)
    p.set('arac', next)
    setParams(p, { replace: true })
  }

  return (
    <div className="page premium-page">
      <section className={`prem-hero${open ? ' is-open' : ''}`} aria-labelledby="prem-title">
        <span className="prem-hero-shine" aria-hidden />
        <span className="prem-tag">
          <Gem size={14} aria-hidden /> StudyMode Premium
        </span>
        <h1 id="prem-title">
          Notun <span className="hl">konuşsun</span>, sen dinle
        </h1>
        <p className="prem-lead">Sesli not, akıllı arama ve yapay zekâ görselleri. Google'ın en yeni Gemini modelleriyle, VIP'lere özel.</p>
        <PremiumStatus />
        <Link to="/rehber#premium" className="prem-guide-link">
          Premium’u en iyi nasıl kullanırsın? <ArrowRight size={14} aria-hidden />
        </Link>
      </section>

      {premium.state === 'loading' ? (
        <div className="share-loading">
          <Spinner /> Yükleniyor…
        </div>
      ) : (
        <>
          <div className="prem-tools" role="group" aria-label="Premium özellikleri">
            {TOOLS.map(({ id, title, text, icon: Icon }) => (
              <button key={id} type="button" className="prem-tool" aria-pressed={open && tool === id} onClick={() => pickTool(id)}>
                <span className="prem-tool-icon" aria-hidden>
                  <Icon size={20} />
                </span>
                <span className="prem-tool-text">
                  <strong>
                    {title} {!open && <Lock size={13} aria-label="kilitli" />}
                  </strong>
                  <span>{text}</span>
                </span>
              </button>
            ))}
          </div>

          {!open ? (
            <Locked signedIn={!!store.session} tool={tool} />
          ) : tool === 'ara' ? (
            <SmartSearch />
          ) : (
            <NoteStudio tool={tool} />
          )}
        </>
      )}
    </div>
  )
}

/** "Premium açık · VIP" and today's Premium allowance, or a lock for everyone else. */
function PremiumStatus() {
  const premium = usePremium()
  const [plus, setPlus] = useState<PlusStatus | null>(null)
  const counted = premium.state === 'open' && !premium.viaKey

  useEffect(() => {
    let alive = true
    if (counted && supabase) {
      void supabase.rpc('plus_quota').then(({ data }) => {
        const d = data as Partial<PlusStatus> | null
        if (alive && d && typeof d.used === 'number' && typeof d.limit === 'number') setPlus({ used: d.used, limit: d.limit })
      })
    }
    return () => {
      alive = false
    }
  }, [counted])

  if (premium.state === 'loading') return null
  if (premium.state === 'locked') {
    return (
      <p className="prem-status">
        <Lock size={15} aria-hidden /> Kilitli · VIP hesaplarda açık
      </p>
    )
  }
  return (
    <p className="prem-status is-open">
      <Sparkles size={15} aria-hidden /> Premium açık
      {premium.viaKey ? ' · kendi Gemini anahtarınla' : premium.role ? ` · ${ROLE_LABEL[premium.role]}` : ''}
      {plus && (
        <span className="prem-status-quota">
          Bugün {plus.used}/{plus.limit} hak · arama sayılmaz
        </span>
      )}
    </p>
  )
}

/** For accounts without Premium: a peek at what is inside, and the two ways in. */
function Locked({ signedIn, tool }: { signedIn: boolean; tool: Tool }) {
  const instagram = SOCIALS[0]
  return (
    <div className="prem-locked">
      <div className="panel prem-peek" aria-label="Önizleme">
        {tool === 'ses' ? (
          <>
            <div className="podcast-turn is-host">
              <div className="podcast-turn-head">
                <span className="podcast-speaker-badge host">Deniz</span>
              </div>
              <p className="podcast-turn-text">Selam Mert! Bugün fotosentezi beş dakikada konuşuyoruz. İlk soru: ışık enerjisi nerede yakalanıyor?</p>
            </div>
            <div className="podcast-turn is-student">
              <div className="podcast-turn-head">
                <span className="podcast-speaker-badge student">Mert</span>
              </div>
              <p className="podcast-turn-text">Kloroplastta, tilakoit zarında. Peki Calvin döngüsü neden ışık olmadan da dönebiliyor?</p>
            </div>
            <p className="subtle prem-peek-note">
              <AudioLines size={15} aria-hidden /> Bu konuşma iki farklı gerçek insan sesiyle okunur.
            </p>
          </>
        ) : tool === 'ara' ? (
          <>
            <div className="input prem-peek-input">enerji üreten organel</div>
            <div className="prem-hit">
              <strong>Hücresel solunum</strong>
              <span className="subtle">Mitokondride glikoz oksijenle yıkılarak ATP elde edilir…</span>
              <span className="chip">Anlamca yakın</span>
            </div>
            <p className="subtle prem-peek-note">"Organel" kelimesi notta hiç geçmiyor; arama anlamından buluyor.</p>
          </>
        ) : (
          <>
            <div className="prem-peek-image" aria-hidden>
              <ImageIcon size={42} />
            </div>
            <p className="subtle prem-peek-note">Bir kavram yaz, yapay zekâ çizsin. Görseli tek dokunuşla karta çevir.</p>
          </>
        )}
      </div>

      <div className="panel prem-how">
        <h2>Nasıl açılır?</h2>
        {!signedIn ? (
          <>
            <p className="muted">Önce giriş yap. Premium hesabına bağlı çalışır.</p>
            <Link to="/giris" className="btn btn-primary">
              Giriş yap <ArrowRight size={16} />
            </Link>
          </>
        ) : (
          <ul className="prem-how-list">
            <li>
              <Gem size={17} aria-hidden />
              <span>
                <strong>VIP ol.</strong> Premium şimdilik davetle açılıyor; VIP hesaplarda hazır gelir.{' '}
                <a href={instagram.url} target="_blank" rel="noopener noreferrer">
                  <BrandIcon brand="instagram" size={14} /> Instagram'dan yaz
                </a>
                .
              </span>
            </li>
            <li>
              <KeyRound size={17} aria-hidden />
              <span>
                <strong>Ya da kendi Gemini anahtarını kullan.</strong> <Link to="/ayarlar">Ayarlar</Link>'da yapay zekâ olarak Gemini'yi seçip anahtarını eklersen Premium o
                anahtarla çalışır.
              </span>
            </li>
          </ul>
        )}
      </div>
    </div>
  )
}

/** Notes grouped by course, newest first, for the note picker. */
function useNotesByCourse(): Array<{ course: Course; notes: Note[] }> {
  const { data } = useStore()
  return useMemo(
    () =>
      data.courses
        .map((course) => ({ course, notes: data.notes.filter((n) => n.courseId === course.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)) }))
        .filter((g) => g.notes.length > 0),
    [data.courses, data.notes],
  )
}

function NoNotes() {
  return (
    <div className="panel">
      <Empty icon={<FileText size={32} />} title="Önce bir not ekle">
        <Link to="/not-ekle" className="btn btn-primary">
          Not ekle
        </Link>
      </Empty>
    </div>
  )
}

/** Sesli not and Görsel: pick a note, then the same studio as inside the note. */
function NoteStudio({ tool }: { tool: 'ses' | 'gorsel' }) {
  const groups = useNotesByCourse()
  const [params, setParams] = useSearchParams()
  const all = groups.flatMap((g) => g.notes)
  const latest = [...all].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
  const note = all.find((n) => n.id === params.get('not')) ?? latest

  if (!note) return <NoNotes />

  function pick(id: string) {
    const p = new URLSearchParams(params)
    p.set('not', id)
    setParams(p, { replace: true })
  }

  return (
    <section className="section prem-studio" aria-label={tool === 'ses' ? 'Sesli not' : 'Görsel'}>
      <div className="prem-picker">
        <label className="field grow">
          Hangi not?
          <select className="select" value={note.id} onChange={(e) => pick(e.target.value)}>
            {groups.map(({ course, notes }) => (
              <optgroup key={course.id} label={course.name}>
                {notes.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.title}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        <Link to={`/not/${note.id}`} className="btn btn-ghost btn-sm">
          Notu aç <ArrowRight size={15} />
        </Link>
      </div>
      {tool === 'ses' ? <PodcastTab key={note.id} note={note} /> : <VisualTab key={note.id} note={note} />}
    </section>
  )
}

/** Search every note by meaning. Each note is turned into numbers once and kept on this device. */
function SmartSearch() {
  const store = useStore()
  const settings = useSettings()
  const toast = useToast()
  const groups = useNotesByCourse()
  const notes = useMemo(() => groups.flatMap((g) => g.notes), [groups])
  const courseName = useMemo(() => new Map(groups.map((g) => [g.course.id, g.course.name])), [groups])
  const [vectors, setVectors] = useState<Record<string, number[]>>(() => readAll(store.data.courses))
  const [indexing, setIndexing] = useState<{ done: number; total: number } | null>(null)
  const [query, setQuery] = useState('')
  const [queryVector, setQueryVector] = useState<{ q: string; v: number[] } | null>(null)
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState('')
  const cache = useRef(new Map<string, number[]>())

  const missing = notes.filter((n) => vectors[n.id]?.length !== EMBED_DIMS)
  const ready = notes.length > 0 && missing.length === 0
  const trimmed = query.trim()

  useEffect(() => {
    if (trimmed.length < 3 || !Object.keys(vectors).length) {
      setQueryVector(null)
      return
    }
    const hit = cache.current.get(trimmed)
    if (hit) {
      setQueryVector({ q: trimmed, v: hit })
      return
    }
    let alive = true
    const timer = window.setTimeout(async () => {
      setSearching(true)
      try {
        const { embedTexts } = await freshImport(() => import('../lib/ai'))
        const [v] = await embedTexts([trimmed], settings)
        if (v?.length) {
          cache.current.set(trimmed, v)
          if (alive) setQueryVector({ q: trimmed, v })
        }
      } catch (err) {
        if (alive) setError(err instanceof Error ? err.message : 'Arama yapılamadı.')
      } finally {
        if (alive) setSearching(false)
      }
    }, 450)
    return () => {
      alive = false
      window.clearTimeout(timer)
    }
  }, [trimmed, vectors, settings])

  async function prepare() {
    if (!missing.length) return
    setError('')
    setIndexing({ done: 0, total: missing.length })
    try {
      const { embedTexts } = await freshImport(() => import('../lib/ai'))
      const next = { ...vectors }
      for (let i = 0; i < missing.length; i += 25) {
        const batch = missing.slice(i, i + 25)
        const out = await embedTexts(batch.map(buildNoteEmbeddingText), settings)
        batch.forEach((n, j) => {
          if (out[j]?.length) next[n.id] = out[j]
        })
        setIndexing({ done: Math.min(missing.length, i + batch.length), total: missing.length })
      }
      setVectors(next)
      saveByCourse(notes, next)
      toast('Notların akıllı aramaya hazır')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Notlar hazırlanamadı.')
    } finally {
      setIndexing(null)
    }
  }

  if (!notes.length) return <NoNotes />

  const hits = trimmed.length >= 2 ? rankNotesByMeaning(notes, vectors, trimmed, queryVector?.q === trimmed ? queryVector.v : null) : []

  return (
    <section className="section prem-search" aria-label="Akıllı arama">
      <div className="panel prem-search-box">
        <label className="field">
          Ne arıyorsun?
          <input
            className="input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Kelimesi geçmese de olur: enerji üreten organel"
          />
        </label>
        {!ready && (
          <div className="prem-index">
            <span className="muted">
              {Object.keys(vectors).length
                ? `${missing.length} yeni not henüz aramada yok.`
                : `Akıllı arama için ${notes.length} notunu bir kez hazırlaman gerekiyor. Birkaç saniye sürer, hakkından düşmez.`}
            </span>
            <button type="button" className="btn btn-sm prem-btn" disabled={!!indexing} onClick={() => void prepare()}>
              {indexing ? <Spinner size={14} /> : <Sparkles size={14} />}
              {indexing ? `Hazırlanıyor ${indexing.done}/${indexing.total}` : 'Notlarımı hazırla'}
            </button>
          </div>
        )}
        {error && <Alert tone="danger">{error}</Alert>}
      </div>

      {trimmed.length >= 2 && (
        <div className="prem-hits" aria-live="polite">
          {searching && !hits.length ? (
            <p className="subtle share-loading">
              <Spinner size={15} /> Aranıyor…
            </p>
          ) : hits.length ? (
            hits.map(({ note, exact, snippet }) => (
              <Link key={note.id} to={`/not/${note.id}`} className="panel prem-hit">
                <span className="subtle">{courseName.get(note.courseId)}</span>
                <strong>{note.title}</strong>
                {snippet && <span className="muted prem-hit-snippet">{snippet}</span>}
                <span className={`chip ${exact ? '' : 'chip-accent'}`}>{exact ? 'Kelimesi geçiyor' : 'Anlamca yakın'}</span>
              </Link>
            ))
          ) : (
            <p className="subtle">Bu aramaya yakın bir not bulamadım.</p>
          )}
        </div>
      )}
    </section>
  )
}

function readAll(courses: Course[]): Record<string, number[]> {
  return Object.assign({}, ...courses.map((c) => readCourseEmbeddings(c.id))) as Record<string, number[]>
}

function saveByCourse(notes: Note[], vectors: Record<string, number[]>) {
  const byCourse = new Map<string, Record<string, number[]>>()
  for (const n of notes) {
    if (vectors[n.id]?.length !== EMBED_DIMS) continue
    const map = byCourse.get(n.courseId) ?? {}
    map[n.id] = vectors[n.id]
    byCourse.set(n.courseId, map)
  }
  byCourse.forEach((map, courseId) => saveCourseEmbeddings(courseId, map))
}
