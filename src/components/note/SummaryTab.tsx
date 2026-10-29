import { Copy, Download, Pencil, Printer } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { downloadText, summaryMarkdown } from '../../lib/noteTools'
import { useStore } from '../../lib/store'
import type { Note } from '../../lib/types'
import { Alert, Modal, useToast } from '../ui'

function SummaryEditor({ note, onClose }: { note: Note; onClose: () => void }) {
  const store = useStore()
  const [overview, setOverview] = useState(note.summary?.overview ?? '')
  const [points, setPoints] = useState(note.summary?.points.join('\n') ?? '')
  const [terms, setTerms] = useState(note.summary?.keyTerms.map(t => `${t.term}: ${t.definition}`).join('\n') ?? '')
  function save(e: FormEvent) {
    e.preventDefault()
    store.updateNote(note.id, { summary: { ...note.summary, overview: overview.trim(), points: points.split('\n').map(s => s.trim()).filter(Boolean), keyTerms: terms.split('\n').flatMap(line => { const i = line.indexOf(':'); return i > 0 && line.slice(i + 1).trim() ? [{ term: line.slice(0, i).trim(), definition: line.slice(i + 1).trim() }] : [] }) } })
    onClose()
  }
  return <Modal title="Özeti düzenle" onClose={onClose}><form className="form" onSubmit={save}>
    <label className="field">Genel özet<textarea className="textarea" value={overview} onChange={e => setOverview(e.target.value)} maxLength={10000} /></label>
    <label className="field">Ana noktalar (her satıra bir madde)<textarea className="textarea" rows={6} value={points} onChange={e => setPoints(e.target.value)} maxLength={30000} /></label>
    <label className="field">Kavramlar (kavram: açıklama)<textarea className="textarea" rows={5} value={terms} onChange={e => setTerms(e.target.value)} maxLength={30000} /></label>
    <button className="btn btn-primary">Özeti kaydet</button>
  </form></Modal>
}

export function SummaryTab({ note }: { note: Note }) {
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState('')
  const toast = useToast()
  const summary = note.summary
  if (!summary) return null
  async function copy() {
    try { await navigator.clipboard.writeText(summaryMarkdown(note)); toast('Özet kopyalandı'); setError('') }
    catch { setError('Panoya erişilemedi. Markdown indir seçeneğini kullanabilirsin.') }
  }
  return <div className="section summary-print" style={{ gap: 24 }}>
    <div className="btn-row no-print"><button className="btn btn-sm" onClick={copy}><Copy size={15} /> Kopyala</button><button className="btn btn-sm" onClick={() => downloadText(`${note.title}.md`, summaryMarkdown(note))}><Download size={15} /> Markdown indir</button><button className="btn btn-sm" onClick={() => window.print()}><Printer size={15} /> PDF / Yazdır</button><button className="btn btn-sm" onClick={() => setEditing(true)}><Pencil size={15} /> Özeti düzenle</button></div>
    {error && <Alert tone="danger">{error}</Alert>}
    {summary.overview && <div className="panel"><p className="prose">{summary.overview}</p></div>}
    {summary.points.length > 0 && <section className="section"><h2>Ana noktalar</h2><div className="panel" style={{ paddingBlock: 6 }}><ol className="points">{summary.points.map((point, i) => <li key={i}><span className="n">{i + 1}</span><span>{point}</span></li>)}</ol></div></section>}
    {summary.keyTerms.length > 0 && <section className="section"><h2>Kavramlar</h2><div className="terms">{summary.keyTerms.map((term, i) => <div className="term" key={i}><strong>{term.term}</strong><p>{term.definition}</p></div>)}</div></section>}
    {note.generator === 'local' && summary.origin !== 'demo' && <p className="subtle">Basit mod cümleleri notundan seçer; yeni bilgi eklemez. Daha kapsamlı açıklamalar için yapay zekâ ile yeniden hazırlayabilirsin.</p>}
    {editing && <SummaryEditor note={note} onClose={() => setEditing(false)} />}
  </div>
}
