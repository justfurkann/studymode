import { Download, Maximize2, X, ZoomIn, ZoomOut } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { safeFileName } from '../lib/noteTools'

/*
 * Any study image (AI picture, poster, memory-aid sketch) opens full screen on a tap: fit to the
 * screen first, a second tap (or the zoom button) shows it at full size to pan around, and it can be
 * downloaded from there. Escape, the close button or a tap on the dark backdrop closes it.
 */

export function ImageViewer({ src, alt, fileName, onClose }: { src: string; alt: string; fileName?: string; onClose: () => void }) {
  const [zoomed, setZoomed] = useState(false)
  const closeRef = useRef<HTMLButtonElement>(null)
  // The page behind may re-render with a new onClose; setup must run only once.
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCloseRef.current()
    document.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      previous?.focus()
    }
  }, [])

  return createPortal(
    <div className="image-viewer" role="dialog" aria-modal="true" aria-label={alt} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="image-viewer-bar">
        <button className="btn btn-sm" onClick={() => setZoomed((z) => !z)} aria-pressed={zoomed}>
          {zoomed ? <ZoomOut size={16} /> : <ZoomIn size={16} />} {zoomed ? 'Ekrana sığdır' : 'Tam boyut'}
        </button>
        <a className="btn btn-sm" href={src} download={safeFileName(fileName ?? 'studymode-gorsel.png')}>
          <Download size={16} /> İndir
        </a>
        <button ref={closeRef} className="btn btn-sm btn-icon" aria-label="Kapat" onClick={onClose}>
          <X size={18} />
        </button>
      </div>
      <div className={`image-viewer-stage ${zoomed ? 'is-zoomed' : ''}`} onClick={(e) => e.target === e.currentTarget && onClose()}>
        <img src={src} alt={alt} onClick={() => setZoomed((z) => !z)} />
      </div>
    </div>,
    document.body,
  )
}

/** A study image that opens in the viewer when tapped. */
export function ZoomableImage({ src, alt, fileName, loading }: { src: string; alt: string; fileName?: string; loading?: 'lazy' | 'eager' }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" className="zoomable-image" onClick={() => setOpen(true)} aria-label={`${alt}: büyüt`}>
        <img src={src} alt={alt} loading={loading} />
        <span className="zoomable-hint" aria-hidden="true">
          <Maximize2 size={14} /> Büyüt
        </span>
      </button>
      {open && <ImageViewer src={src} alt={alt} fileName={fileName} onClose={() => setOpen(false)} />}
    </>
  )
}
