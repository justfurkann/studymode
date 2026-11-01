import { ArrowLeft, GraduationCap, School, Search } from 'lucide-react'
import { useState } from 'react'
import { authErrorMessage } from '../lib/auth'
import { saveEducation, type Education } from '../lib/education'
import { hasUniversity, LEVELS, type Level } from '../lib/studentType'
import { searchUniversities } from '../lib/universities'
import { Alert, Spinner } from './ui'

/** Level, then (for university students) the school. Saves on the account and reports back. */
export function EducationForm({ initial, onSaved }: { initial?: Education | null; onSaved: (e: Education) => void }) {
  const [level, setLevel] = useState<Level | null>(null)
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function save(nextLevel: Level, school: string) {
    setBusy(true)
    setError('')
    try {
      onSaved(await saveEducation(nextLevel, school))
    } catch (e) {
      setError(authErrorMessage(e))
      setBusy(false)
    }
  }

  function pickLevel(next: Level) {
    if (hasUniversity(next)) {
      setLevel(next)
      setTyped(initial?.level === next ? initial.school : '')
    } else void save(next, '')
  }

  if (level) {
    const hits = searchUniversities(typed, 6)
    const plain = typed.trim()
    return (
      <div className="edu-form">
        <button type="button" className="btn btn-ghost btn-sm edu-back" onClick={() => setLevel(null)} disabled={busy}>
          <ArrowLeft size={15} /> Geri
        </button>
        <label className="edu-search">
          <Search size={17} aria-hidden />
          <input className="input" autoFocus placeholder="Üniversiteni ara: ODTÜ, Boğaziçi, Ege…" value={typed} onChange={(e) => setTyped(e.target.value)} aria-label="Üniversite ara" />
        </label>
        <div className="edu-options" role="list">
          {hits.map((u) => (
            <button key={u.name} type="button" role="listitem" className="edu-option" disabled={busy} onClick={() => void save(level, u.short)}>
              <School size={17} aria-hidden />
              <span>
                <strong>{u.name}</strong>
                <span className="subtle">{u.city}</span>
              </span>
            </button>
          ))}
          {plain.length >= 3 && !hits.some((u) => u.name.toLocaleLowerCase('tr-TR') === plain.toLocaleLowerCase('tr-TR')) && (
            <button type="button" role="listitem" className="edu-option is-plain" disabled={busy} onClick={() => void save(level, plain)}>
              <GraduationCap size={17} aria-hidden />
              <span>
                <strong>"{plain.slice(0, 60)}" olarak kaydet</strong>
                <span className="subtle">Listede yoksa</span>
              </span>
            </button>
          )}
        </div>
        {busy && (
          <p className="subtle share-loading">
            <Spinner size={15} /> Kaydediliyor…
          </p>
        )}
        {error && <Alert tone="danger">{error}</Alert>}
      </div>
    )
  }

  return (
    <div className="edu-form">
      <div className="edu-options edu-levels" role="group" aria-label="Nerede okuyorsun?">
        {LEVELS.map((l) => (
          <button key={l.id} type="button" className="edu-option" aria-pressed={initial?.level === l.id} disabled={busy} onClick={() => pickLevel(l.id)}>
            <GraduationCap size={17} aria-hidden />
            <span>
              <strong>{l.label}</strong>
              <span className="subtle">{l.hint}</span>
            </span>
          </button>
        ))}
      </div>
      {busy && (
        <p className="subtle share-loading">
          <Spinner size={15} /> Kaydediliyor…
        </p>
      )}
      {error && <Alert tone="danger">{error}</Alert>}
    </div>
  )
}
