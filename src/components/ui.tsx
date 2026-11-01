import { AlertCircle, Info, LoaderCircle, TriangleAlert, X } from 'lucide-react'
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { playSound } from '../lib/sound'

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)

  const closeRef = useRef(onClose)
  closeRef.current = onClose
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    ref.current?.querySelector<HTMLElement>('input, textarea, select, button:not([aria-label="Kapat"])')?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeRef.current()
      if (event.key !== 'Tab') return
      const items = Array.from(ref.current?.querySelectorAll<HTMLElement>('input:not(:disabled), textarea:not(:disabled), select:not(:disabled), button:not(:disabled), a[href]') ?? []).filter(el => el.getClientRects().length)
      const first = items[0], last = items.at(-1)
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      previous?.focus()
    }
  }, [])

  // Drawn at the end of <body>: inside the blurred top bar or sidebar a fixed backdrop would be
  // trapped in that box instead of covering the screen.
  return createPortal(
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title} ref={ref}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="btn btn-ghost btn-icon" aria-label="Kapat" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  )
}

export function Alert({ tone = 'neutral', children, action }: { tone?: 'neutral' | 'danger' | 'warning' | 'info'; children: ReactNode; action?: ReactNode }) {
  const Icon = tone === 'danger' ? AlertCircle : tone === 'warning' ? TriangleAlert : Info
  return (
    <div className={`alert alert-${tone}`} role={tone === 'danger' ? 'alert' : 'status'}>
      <Icon size={18} />
      <div className="grow">{children}</div>
      {action}
    </div>
  )
}

export function Spinner({ size = 18 }: { size?: number }) {
  return <LoaderCircle size={size} className="spinner" aria-hidden />
}

/**
 * A finished moment: the words get marked with the highlighter, drawn left to right once, and the
 * "done" sound plays if the student turned sounds on. Use it for one or two words, like `.hl`.
 */
export function Celebrate({ children, sound = true }: { children: ReactNode; sound?: boolean }) {
  useEffect(() => {
    if (sound) playSound('done')
  }, [sound])
  return <span className="hl hl-swipe">{children}</span>
}

export function Empty({ icon, title, children }: { icon: ReactNode; title: ReactNode; children?: ReactNode }) {
  return (
    <div className="empty">
      {icon}
      <h3>{title}</h3>
      {children}
    </div>
  )
}

const ToastContext = createContext<(message: string) => void>(() => undefined)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!message) return
    const timer = window.setTimeout(() => setMessage(''), 3500)
    return () => window.clearTimeout(timer)
  }, [message])

  const show = useCallback((text: string) => setMessage(text), [])

  return (
    <ToastContext.Provider value={show}>
      {children}
      {message && (
        <div className="toast" role="status">
          {message}
        </div>
      )}
    </ToastContext.Provider>
  )
}

export const useToast = () => useContext(ToastContext)

export function ColorPicker({ colors, value, onChange }: { colors: string[]; value: string; onChange: (color: string) => void }) {
  return (
    <div className="color-picker" role="group" aria-label="Renk">
      {colors.map((color) => (
        <button
          key={color}
          type="button"
          style={{ background: color }}
          aria-label={color}
          aria-pressed={value === color}
          onClick={() => onChange(color)}
        />
      ))}
    </div>
  )
}


export function useConfirm() {
  const [message, setMessage] = useState<string | null>(null)
  const resolve = useRef<((value: boolean) => void) | null>(null)
  const finish = (value: boolean) => { resolve.current?.(value); resolve.current = null; setMessage(null) }
  useEffect(() => () => resolve.current?.(false), [])
  const ask = (text: string) => new Promise<boolean>(done => { resolve.current?.(false); resolve.current = done; setMessage(text) })
  const dialog = message === null ? null : <Modal title="İşlemi onayla" onClose={() => finish(false)}><div className="form"><p>{message}</p><div className="btn-row"><button className="btn" onClick={() => finish(false)}>Vazgeç</button><button className="btn btn-primary" onClick={() => finish(true)}>Evet, devam et</button></div></div></Modal>
  return [ask, dialog] as const
}
