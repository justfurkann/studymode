import { RefreshCw } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { reloadFresh, useUpdateAvailable } from '../lib/version'

/**
 * When a newer version is out: reload by itself as soon as the student moves to another page
 * (nothing typed is lost then), and meanwhile offer a small "Yenile" bar.
 */
export function UpdateWatcher() {
  const available = useUpdateAvailable()
  const { pathname } = useLocation()
  const first = useRef(pathname)

  useEffect(() => {
    if (available && pathname !== first.current) reloadFresh()
    first.current = pathname
  }, [available, pathname])

  if (!available) return null
  return (
    <div className="update-bar" role="status">
      <span>Uygulamanın yeni sürümü hazır.</span>
      <button className="btn btn-sm" onClick={reloadFresh}>
        <RefreshCw size={14} /> Yenile
      </button>
    </div>
  )
}
