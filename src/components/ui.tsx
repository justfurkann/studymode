import { AlertCircle, Info, LoaderCircle, TriangleAlert, X } from 'lucide-react'
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    ref.current?.querySelector<HTMLElement>('input, textarea, select, button:not([aria-label="Kapat"])')?.focus()
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      previous?.focus()
    }
  }, [onClose])

  return (
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
    </div>
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

export function Empty({ icon, title, children }: { icon: ReactNode; title: string; children?: ReactNode }) {
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
