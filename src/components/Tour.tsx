import { ArrowLeft, ArrowRight, X } from 'lucide-react'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { usePremium } from '../lib/premium'
import { markTourSeen, setTourActive, shouldAutoStart, useTourRequests } from '../lib/tour'

/*
 * First-visit tour: a soft spotlight on one part of the app at a time with a short note next to it.
 * Targets carry `data-tour="…"` (sidebar on wide screens, bottom bar and top bar on phones); the
 * first visible one is used. Skippable at any step, remembered once seen, restartable.
 */

interface Step {
  key: string
  title: string
  text: string
  /** Phones show other places (no sidebar there). */
  phoneTitle?: string
  phoneText?: string
  premiumOnly?: boolean
}

const STEPS: Step[] = [
  { key: 'ekle', title: 'Not ekle', text: 'PDF, Word, slayt ya da fotoğrafını yükle. Özet, test ve tekrar kartları birkaç saniyede hazırlanır.' },
  { key: 'bugun', title: 'Bugün', text: 'Her gün buradan başla: tekrar bekleyen kartlar, yaklaşan sınavlar ve sıradaki konu tek ekranda.' },
  { key: 'tekrar', title: 'Tekrar', text: 'Kartlar tam unutmak üzereyken geri gelir. Yanında Mola: iki dakikalık oyunlar ve odak sayacı.' },
  { key: 'sinavlar', title: 'Sınavlar', text: 'Vize ve final tarihlerini gir; neye önce çalışacağını söyleyelim, istersen sınav provası yap.' },
  { key: 'premium', title: 'Premium', text: 'Notunu iki sesli bir sohbet olarak dinle, anlamına göre ara, yapay zekâya görsel çizdir.', premiumOnly: true },
  {
    key: 'daha',
    title: 'Daha fazla',
    text: 'Rehber, başarımların, öğrenci tipi testi ve Hakkında burada. Turu Rehber’den yeniden başlatabilirsin.',
    phoneTitle: 'Hesap ve ayarlar',
    phoneText: 'Rehber, başarımların, öğrenci tipin ve görünüm ayarları burada. Turu buradan yeniden başlatabilirsin.',
  },
]

function visibleTarget(key: string): HTMLElement | null {
  const all = Array.from(document.querySelectorAll<HTMLElement>(`[data-tour="${key}"]`))
  return all.find((el) => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden') ?? null
}

const isPhone = () => window.matchMedia('(max-width: 860px)').matches

function anyOverlay() {
  return !!document.querySelector('[role="dialog"][aria-modal="true"], .ach-toast, .image-viewer')
}

export function Tour() {
  const premium = usePremium().state === 'open'
  const requests = useTourRequests()
  const [index, setIndex] = useState<number | null>(null)
  const steps = STEPS.filter((s) => !s.premiumOnly || premium)

  const start = useCallback(() => {
    setIndex(0)
    setTourActive(true)
  }, [])

  const close = useCallback(() => {
    setIndex(null)
    setTourActive(false)
    markTourSeen()
  }, [])

  // First visit: wait until nothing else is on screen (a dialog, a toast), then start.
  useEffect(() => {
    if (!shouldAutoStart()) return
    let timer = window.setTimeout(function check() {
      if (anyOverlay()) timer = window.setTimeout(check, 900)
      else start()
    }, 1200)
    return () => window.clearTimeout(timer)
  }, [start])

  // "Turu tekrar başlat".
  const seen = useRef(requests)
  useEffect(() => {
    if (requests !== seen.current) {
      seen.current = requests
      start()
    }
  }, [requests, start])

  useEffect(() => () => setTourActive(false), [])

  if (index === null) return null
  return <TourStep steps={steps} index={Math.min(index, steps.length - 1)} onIndex={setIndex} onClose={close} />
}

function TourStep({ steps, index, onIndex, onClose }: { steps: Step[]; index: number; onIndex: (i: number) => void; onClose: () => void }) {
  const step = steps[index]
  const phone = isPhone()
  const [rect, setRect] = useState<DOMRect | null>(null)
  const bubble = useRef<HTMLDivElement>(null)
  const last = index === steps.length - 1

  useLayoutEffect(() => {
    const measure = () => {
      const el = visibleTarget(step.key)
      setRect(el ? el.getBoundingClientRect() : null)
    }
    const el = visibleTarget(step.key)
    el?.scrollIntoView({ block: 'nearest' })
    measure()
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    return () => {
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    }
  }, [step.key])

  useEffect(() => {
    bubble.current?.focus()
  }, [index])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') last ? onClose() : onIndex(index + 1)
      if (e.key === 'ArrowLeft' && index > 0) onIndex(index - 1)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [index, last, onClose, onIndex])

  const pad = 6
  const vw = window.innerWidth
  const vh = window.innerHeight
  const width = Math.min(320, vw - 32)
  let style: React.CSSProperties = { width, left: (vw - width) / 2, top: vh / 2 - 90 }
  if (rect) {
    if (!phone) {
      // Wide screens: to the right of the sidebar item.
      style = { width, left: Math.min(rect.right + 18, vw - width - 16), top: Math.max(16, Math.min(rect.top - 8, vh - 230)) }
    } else if (rect.top > vh / 2) {
      // Bottom bar: above it.
      style = { width, left: Math.max(16, Math.min(rect.left + rect.width / 2 - width / 2, vw - width - 16)), bottom: vh - rect.top + 16 }
    } else {
      // Top bar: below it.
      style = { width, left: Math.max(16, Math.min(rect.left + rect.width / 2 - width / 2, vw - width - 16)), top: rect.bottom + 16 }
    }
  }

  return createPortal(
    <div className="tour" role="presentation">
      {rect ? (
        <div className="tour-spot" style={{ left: rect.left - pad, top: rect.top - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 }} aria-hidden="true" />
      ) : (
        <div className="tour-dim" aria-hidden="true" />
      )}
      <div ref={bubble} className="tour-bubble" style={style} role="dialog" aria-modal="false" aria-label={`Tanıtım ${index + 1}/${steps.length}`} tabIndex={-1} key={step.key}>
        <div className="tour-head">
          <span className="tour-count">
            {index + 1}/{steps.length}
          </span>
          <button type="button" className="btn btn-ghost btn-icon btn-sm" aria-label="Turu kapat" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <strong className="tour-title">{(phone && step.phoneTitle) || step.title}</strong>
        <p>{(phone && step.phoneText) || step.text}</p>
        <div className="tour-dots" aria-hidden="true">
          {steps.map((s, i) => (
            <span key={s.key} className={i === index ? 'is-on' : ''} />
          ))}
        </div>
        <div className="tour-actions">
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            Atla
          </button>
          <span className="grow" />
          {index > 0 && (
            <button type="button" className="btn btn-sm" onClick={() => onIndex(index - 1)} aria-label="Önceki">
              <ArrowLeft size={15} />
            </button>
          )}
          <button type="button" className="btn btn-primary btn-sm" onClick={() => (last ? onClose() : onIndex(index + 1))}>
            {last ? 'Başla' : 'İleri'} {!last && <ArrowRight size={15} />}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
