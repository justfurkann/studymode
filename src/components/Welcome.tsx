import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { audienceForLevel } from '../lib/courseExams'
import { useEducation } from '../lib/education'
import { BigExamCountdown } from './BigExamCountdown'

/** First run inside the app: signed in (or arriving from an email link) but no courses yet. */
export function Welcome({ onDemo, name }: { onDemo: () => void; name?: string }) {
  const school = audienceForLevel(useEducation()?.level) === 'school'
  return (
    <div className="page">
      <BigExamCountdown />
      <section className="first-run" aria-labelledby="first-run-title">
        <div style={{ display: 'grid', gap: 10 }}>
          <span className="subtle">{name ? `Hoş geldin ${name}` : 'Hoş geldin'}</span>
          <h1 id="first-run-title">
            İlk notunu ekle, <span className="hl">önemlisini</span> biz işaretleyelim.
          </h1>
          <p>
            {school
              ? 'Ders kitabının ya da çalışma kâğıdının fotoğrafı, PDF ya da düz metin olabilir. Birkaç saniyede özet, test ve tekrar kartları hazır olur.'
              : 'PDF, Word, PowerPoint, fotoğraf ya da düz metin olabilir. Birkaç saniyede özet, test ve tekrar kartları hazır olur.'}
          </p>
        </div>
        <ol>
          <li>
            <span className="step-num-hl">1</span>
            <span>
              <b>Notunu yükle</b>
              {school ? 'Ders adını ve yazılı ya da deneme tarihini de ekle.' : 'Ders adını ve sınav tarihini de ekle.'}
            </span>
          </li>
          <li>
            <span className="step-num-hl">2</span>
            <span>
              <b>Adım adım çalış</b>Özet, test, kartlar ve kendi cümlelerinle anlatma.
            </span>
          </li>
          <li>
            <span className="step-num-hl">3</span>
            <span>
              <b>Her gün biraz tekrar et</b>Bugün ekranı neyi çalışacağını söyler.
            </span>
          </li>
        </ol>
        <div className="btn-row">
          <Link to="/not-ekle" className="btn btn-primary btn-lg">
            İlk notumu ekle <ArrowRight size={18} />
          </Link>
          <button className="btn btn-lg" onClick={onDemo}>
            Örnek notla dene
          </button>
        </div>
      </section>
    </div>
  )
}
