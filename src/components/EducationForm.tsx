import { ArrowLeft, ArrowRight, GraduationCap, School, Search } from 'lucide-react'
import { useState } from 'react'
import { authErrorMessage } from '../lib/auth'
import { DEPARTMENTS, GENDERS, GRAD_YEARS, HEARD_FROM, saveEducation, UNI_YEARS, type Education, type Gender } from '../lib/education'
import { hasUniversity, LEVELS, type Level } from '../lib/studentType'
import { searchUniversities } from '../lib/universities'
import { Alert, Spinner } from './ui'

type Step = 'level' | 'school' | 'dept' | 'about'

/** Where an earlier, incomplete answer left off. */
function firstStep(e: Education | null | undefined): Step {
  if (!e) return 'level'
  if (hasUniversity(e.level)) {
    if (!e.school) return 'school'
    if (!e.department || !e.classYear) return 'dept'
  }
  return 'about'
}

const thisYear = new Date().getFullYear()
const BIRTH_YEARS = Array.from({ length: 61 }, (_, i) => thisYear - 10 - i)

/**
 * Level; for university students the school, then department and year (required); then birth year,
 * gender and "where did you hear about us" (each optional). Saves once, at the end.
 * `startAt` = 'level' re-asks everything (Settings → Değiştir).
 */
export function EducationForm({ initial, startAt, onSaved }: { initial?: Education | null; startAt?: 'level'; onSaved: (e: Education) => void }) {
  const [step, setStep] = useState<Step>(startAt ?? firstStep(initial))
  const [level, setLevel] = useState<Level | null>(initial?.level ?? null)
  const [school, setSchool] = useState(initial?.school ?? '')
  const [typed, setTyped] = useState('')
  const [department, setDepartment] = useState(initial?.department ?? '')
  const [classYear, setClassYear] = useState(initial?.classYear ?? '')
  const [birthYear, setBirthYear] = useState<number | null>(initial?.birthYear ?? null)
  const [gender, setGender] = useState<Gender | null>(initial?.gender ?? null)
  const [heardFrom, setHeardFrom] = useState<string | null>(initial?.heardFrom ?? null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function save() {
    if (!level) return
    setBusy(true)
    setError('')
    try {
      onSaved(await saveEducation({ level, school, department, classYear, birthYear, gender, heardFrom }))
    } catch (e) {
      setError(authErrorMessage(e))
      setBusy(false)
    }
  }

  const back = (to: Step) => (
    <button type="button" className="btn btn-ghost btn-sm edu-back" onClick={() => setStep(to)} disabled={busy}>
      <ArrowLeft size={15} /> Geri
    </button>
  )
  const status = (
    <>
      {busy && (
        <p className="subtle share-loading">
          <Spinner size={15} /> Kaydediliyor…
        </p>
      )}
      {error && <Alert tone="danger">{error}</Alert>}
    </>
  )

  if (step === 'school' && level) {
    const hits = searchUniversities(typed, 6)
    const plain = typed.trim()
    const pick = (name: string) => {
      setSchool(name)
      setStep('dept')
    }
    return (
      <div className="edu-form">
        {back('level')}
        <label className="edu-search">
          <Search size={17} aria-hidden />
          <input className="input" autoFocus placeholder="Üniversiteni ara: ODTÜ, Boğaziçi, Ege…" value={typed} onChange={(e) => setTyped(e.target.value)} aria-label="Üniversite ara" />
        </label>
        <div className="edu-options" role="list">
          {hits.map((u) => (
            <button key={u.name} type="button" role="listitem" className="edu-option" onClick={() => pick(u.short)}>
              <School size={17} aria-hidden />
              <span>
                <strong>{u.name}</strong>
                <span className="subtle">{u.city}</span>
              </span>
            </button>
          ))}
          {plain.length >= 3 && !hits.some((u) => u.name.toLocaleLowerCase('tr-TR') === plain.toLocaleLowerCase('tr-TR')) && (
            <button type="button" role="listitem" className="edu-option is-plain" onClick={() => pick(plain.slice(0, 80))}>
              <GraduationCap size={17} aria-hidden />
              <span>
                <strong>"{plain.slice(0, 60)}" olarak kaydet</strong>
                <span className="subtle">Listede yoksa</span>
              </span>
            </button>
          )}
        </div>
      </div>
    )
  }

  if (step === 'dept' && level) {
    const years = level === 'yukseklisans' ? GRAD_YEARS : UNI_YEARS
    const ok = department.trim().length >= 2 && !!classYear
    return (
      <form
        className="edu-form"
        onSubmit={(e) => {
          e.preventDefault()
          if (ok) setStep('about')
        }}
      >
        {back('school')}
        <p className="edu-picked">
          <School size={16} aria-hidden /> {school}
        </p>
        <label className="field">
          <span>{level === 'yukseklisans' ? 'Program / anabilim dalı' : 'Bölüm'}</span>
          <input className="input" list="edu-departments" value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="Örn. Bilgisayar Mühendisliği" maxLength={80} required />
          <datalist id="edu-departments">
            {DEPARTMENTS.map((d) => (
              <option key={d} value={d} />
            ))}
          </datalist>
        </label>
        <div className="field">
          <span>{level === 'yukseklisans' ? 'Hangi aşamadasın?' : 'Kaçıncı sınıf?'}</span>
          <div className="edu-chips" role="group" aria-label={level === 'yukseklisans' ? 'Aşama' : 'Sınıf'}>
            {years.map((y) => (
              <button key={y} type="button" className="chip edu-chip" aria-pressed={classYear === y} onClick={() => setClassYear(y)}>
                {y}
              </button>
            ))}
          </div>
        </div>
        <button className="btn btn-primary" disabled={!ok}>
          Devam <ArrowRight size={16} />
        </button>
      </form>
    )
  }

  if (step === 'about' && level) {
    return (
      <div className="edu-form">
        {back(hasUniversity(level) ? 'dept' : 'level')}
        <p className="subtle edu-optional">Bu kısım isteğe bağlı; istediğini boş bırakabilirsin.</p>
        <label className="field">
          <span>Doğum yılın</span>
          <select className="select" value={birthYear ?? ''} onChange={(e) => setBirthYear(e.target.value ? Number(e.target.value) : null)}>
            <option value="">Belirtmek istemiyorum</option>
            {BIRTH_YEARS.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>
        <div className="field">
          <span>Cinsiyet</span>
          <div className="edu-chips" role="group" aria-label="Cinsiyet">
            {GENDERS.map((g) => (
              <button key={g.id} type="button" className="chip edu-chip" aria-pressed={gender === g.id} onClick={() => setGender(gender === g.id ? null : g.id)}>
                {g.label}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <span>StudyMode'u nereden duydun?</span>
          <div className="edu-chips" role="group" aria-label="Nereden duydun?">
            {HEARD_FROM.map((h) => (
              <button key={h} type="button" className="chip edu-chip" aria-pressed={heardFrom === h} onClick={() => setHeardFrom(heardFrom === h ? null : h)}>
                {h}
              </button>
            ))}
          </div>
        </div>
        <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void save()}>
          Kaydet
        </button>
        {status}
      </div>
    )
  }

  return (
    <div className="edu-form">
      <div className="edu-options edu-levels" role="group" aria-label="Nerede okuyorsun?">
        {LEVELS.map((l) => (
          <button
            key={l.id}
            type="button"
            className="edu-option"
            aria-pressed={level === l.id}
            onClick={() => {
              if (l.id !== level) {
                setSchool('')
                setDepartment('')
                setClassYear('')
              }
              setLevel(l.id)
              setStep(hasUniversity(l.id) ? 'school' : 'about')
            }}
          >
            <GraduationCap size={17} aria-hidden />
            <span>
              <strong>{l.label}</strong>
              <span className="subtle">{l.hint}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
