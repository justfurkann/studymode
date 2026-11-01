import { ArrowRight, RotateCcw } from 'lucide-react'
import { Link } from 'react-router-dom'
import { axisBars, TYPES } from '../lib/studentType'
import { resultPath, useStudentResult } from '../lib/studentProfile'
import { StudentCharacter } from './StudentCharacter'

/** The sidebar (and phone home) card: an invitation to the quiz, or once taken, the student's type. */
export function StudentTypeLink({ className = 'side-quiz' }: { className?: string }) {
  const saved = useStudentResult()
  if (!saved) {
    return (
      <Link to="/ogrenci-tipi" className={className}>
        <StudentCharacter id="gecekusu" size={44} />
        <span className="side-quiz-text">
          <strong>Hangi öğrenci tipisin?</strong>
          <span>2 dakikada öğren, sonucunu paylaş</span>
        </span>
      </Link>
    )
  }
  return (
    <Link to={resultPath(saved)} className={className} aria-label={`Öğrenci tipin: ${TYPES[saved.type].name}. Kartını gör`}>
      <StudentCharacter id={saved.type} size={44} />
      <span className="side-quiz-text">
        <span>Öğrenci tipin</span>
        <strong>{TYPES[saved.type].name}</strong>
        <span>Kartını gör, paylaş</span>
      </span>
    </Link>
  )
}

/** Settings: the saved result on the profile. */
export function StudentTypeSection() {
  const saved = useStudentResult()
  if (!saved) {
    return (
      <div className="panel student-type-panel">
        <StudentCharacter id="kasif" size={64} still />
        <div>
          <strong>Henüz testi çözmedin</strong>
          <p className="subtle">10 küçük durumda sana yakın olanı seç; sonuç kartın burada kalsın.</p>
        </div>
        <Link to="/ogrenci-tipi" className="btn btn-primary btn-sm">
          Testi çöz <ArrowRight size={16} />
        </Link>
      </div>
    )
  }
  const type = TYPES[saved.type]
  const bars = axisBars({ plan: saved.axes[0] / 100, depth: saved.axes[1] / 100, social: saved.axes[2] / 100, night: saved.axes[3] / 100, style: 0 })
  return (
    <div className="panel student-type-panel">
      <StudentCharacter id={saved.type} size={72} />
      <div className="grow">
        <strong>{type.name}</strong>
        <p className="subtle">
          {type.tagline} · {new Date(saved.at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
          {saved.school ? ` · ${saved.school}` : ''}
        </p>
        <p className="subtle">{bars.map((b) => `${b.label} %${b.percent}`).join(' · ')}</p>
      </div>
      <div className="btn-row">
        <Link to={resultPath(saved)} className="btn btn-sm">
          Kartım
        </Link>
        <Link to="/ogrenci-tipi" className="btn btn-ghost btn-sm">
          <RotateCcw size={15} /> Yeniden çöz
        </Link>
      </div>
    </div>
  )
}
