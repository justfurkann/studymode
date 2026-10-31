import { ArrowLeft, Check, RotateCcw } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { Celebrate } from '../ui'

export function useTick(active: boolean, ms: number) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    setNow(Date.now())
    const id = window.setInterval(() => setNow(Date.now()), ms)
    return () => window.clearInterval(id)
  }, [active, ms])
  return now
}

export function GameHead({ onExit, children }: { onExit: () => void; children?: ReactNode }) {
  return (
    <div className="section-head mola-head">
      <button className="back-link" onClick={onExit}>
        <ArrowLeft size={16} /> Molaya dön
      </button>
      <span className="subtle mola-stats">{children}</span>
    </div>
  )
}

export function Result({
  title,
  badge,
  lines,
  onAgain,
  onExit,
  children,
}: {
  title: string
  badge: string
  lines: string[]
  onAgain: () => void
  onExit: () => void
  children?: ReactNode
}) {
  return (
    <div className="panel study-done mola-result" role="status">
      <div className="study-done-mark" aria-hidden="true">
        <Check size={32} strokeWidth={3} />
      </div>
      <strong className="mola-result-title">{title}</strong>
      <p>
        <Celebrate>{badge}</Celebrate>
      </p>
      {lines.map((line) => (
        <p key={line} className="muted">
          {line}
        </p>
      ))}
      {children}
      <div className="btn-row">
        <button className="btn btn-primary" onClick={onAgain}>
          <RotateCcw size={16} /> Tekrar oyna
        </button>
        <button className="btn" onClick={onExit}>
          Molaya dön
        </button>
      </div>
    </div>
  )
}
