import { ArrowRight, Sparkles } from 'lucide-react'
import { useEffect, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { Brand } from '../components/Brand'
import { FeedbackLink } from '../components/Feedback'
import { BrandIcon } from '../components/BrandIcon'
import { MAKER, SOCIALS } from '../components/MadeBy'
import { PixelSky } from '../components/PixelSky'
import { Celebrate } from '../components/ui'
import { playSound } from '../lib/sound'
import { useStore } from '../lib/store'
import { unlock } from '../lib/achievements'

/** Answers to "Burayı nasıl buldun?" — a small easter egg at the bottom of the page. */
const HOW = [
  { id: 'madeby', label: 'Made by yazısına tıkladım', reply: 'Demek o minicik yazıyı fark ettin. Gözün keskinmiş; sınavda da böyle ol.' },
  { id: 'ayarlar', label: 'Ayarları kurcalarken', reply: 'Ayarları sonuna kadar kaydıran biri. Seni sevdim, sen gerçek bir meraklısın.' },
  { id: 'arkadas', label: 'Biri link attı', reply: 'Seni buraya yollayan iyi bir arkadaşmış. Ona bir çay borçlusun.' },
  { id: 'tesaduf', label: 'Tesadüfen', reply: 'Tesadüf diye bir şey yok. Bu sayfa seni bekliyordu.' },
] as const

/** Taps on the photo needed for the secret. */
const SECRET_TAPS = 5

/** /hakkinda: the maker's page, on its own, outside the app menu. */
export function About() {
  const { session } = useStore()
  const [how, setHow] = useState<(typeof HOW)[number]['id'] | null>(null)
  const [taps, setTaps] = useState(0)
  const found = taps >= SECRET_TAPS
  const instagram = SOCIALS[0]

  useEffect(() => {
    const before = document.title
    document.title = `Hakkında · ${MAKER} · StudyMode`
    return () => {
      document.title = before
    }
  }, [])

  function tapPhoto() {
    if (found) return
    const next = taps + 1
    setTaps(next)
    if (next === SECRET_TAPS) {
      playSound('done')
      unlock('kurcalamaci')
    }
  }

  const answer = HOW.find((h) => h.id === how)

  return (
    <div className="landing about-page">
      <header className="lp-nav">
        <div className="lp-wrap lp-nav-inner">
          <Link to="/" className="brand-link" aria-label="StudyMode ana sayfa">
            <Brand size={30} />
          </Link>
          <Link to="/" className="btn btn-sm">
            {session ? 'Uygulamaya dön' : 'Uygulamaya git'}
          </Link>
        </div>
      </header>

      <main>
        <section className="about-hero">
          <div className="about-sky">
            <PixelSky />
          </div>
          <div className="lp-wrap about-hero-inner">
            <button
              type="button"
              className={`about-photo${found ? ' is-found' : ''}${taps > 0 && !found ? ' is-tapped' : ''}`}
              onClick={tapPhoto}
              aria-label={`${MAKER} profil resmi`}
              key={taps}
            >
              <img src="/maker-320.webp" width={140} height={140} alt="" decoding="async" />
              {found && (
                <span className="about-sparks" aria-hidden="true">
                  {Array.from({ length: 8 }, (_, i) => (
                    <span key={i} style={{ '--a': `${i * 45}deg` } as CSSProperties} />
                  ))}
                </span>
              )}
            </button>
            <h1>
              Selam, ben <span className="hl">{MAKER}</span>
            </h1>
            <p className="about-lead">StudyMode'u yapan kişi.</p>
          </div>
        </section>

        <section className="lp-wrap about-body">
          <div className="about-text">
            <p>
              StudyMode'u kendi sınav dönemim için yaptım. Notlar her yere dağılıyordu, neyi bildiğimi neyi bilmediğimi ancak sınavda anlıyordum. Notunu yükleyince önemlisini işaretleyen, seni test eden ve sınavına kaç gün kaldığını
              hatırlatan bir şey istedim.
            </p>
            <p>Sonra arkadaşlarım da kullansın istedim. Hâlâ küçük bir proje; her fikir, her öneri ve gözüne takılan her hata gerçekten işime yarıyor. Yazarsan okurum.</p>
          </div>

          <ul className="about-socials" aria-label={`${MAKER} sosyal medya hesapları`}>
            {SOCIALS.map((s) => (
              <li key={s.brand}>
                <a className="about-social" href={s.url} target="_blank" rel="noopener noreferrer" aria-label={`${s.label}: ${s.handle}`}>
                  <span className="maker-social-icon">
                    <BrandIcon brand={s.brand} size={22} />
                  </span>
                  <span className="about-social-text">
                    <strong>{s.label}</strong>
                    <span>{s.handle}</span>
                  </span>
                </a>
              </li>
            ))}
          </ul>

          <div className="btn-row about-ctas">
            <a className="btn btn-primary btn-lg" href={instagram.url} target="_blank" rel="noopener noreferrer">
              <BrandIcon brand="instagram" size={18} /> Instagram'dan yaz
            </a>
            <Link to="/" className="btn btn-lg">
              StudyMode'a göz at <ArrowRight size={18} />
            </Link>
          </div>
          <p className="subtle about-feedback">
            Uygulamayla ilgili bir fikrin ya da hata mı var? <FeedbackLink label="Buradan yaz" />
          </p>

          {found && (
            <p className="about-secret" role="status">
              <Sparkles size={18} aria-hidden /> <Celebrate>Gizli başarım açıldı:</Celebrate> Kurcalamacı. Fotoğrafa beş kez dokunan çok az kişi var. <Link to="/basarimlar">Koleksiyonuna bak</Link>
            </p>
          )}

          <section className="about-egg" aria-labelledby="egg-title">
            <h2 id="egg-title">Burayı nasıl buldun?</h2>
            <p className="subtle">Merak ettim, gerçekten.</p>
            <div className="about-egg-options" role="group" aria-label="Burayı nasıl buldun?">
              {HOW.map((h) => (
                <button key={h.id} type="button" className="chip about-egg-option" aria-pressed={how === h.id} onClick={() => setHow(h.id)}>
                  {h.label}
                </button>
              ))}
            </div>
            {answer && (
              <p className="about-egg-reply" role="status" key={answer.id}>
                {answer.reply}
              </p>
            )}
          </section>
        </section>
      </main>

      <footer className="lp-wrap lp-footer">
        <Brand size={24} />
        <span>Türk üniversite öğrencileri için ders çalışma uygulaması.</span>
        <Link to="/gizlilik" className="lp-footer-quiet">Gizlilik</Link>
        <Link to="/tanitim">Tanıtım</Link>
      </footer>
    </div>
  )
}
