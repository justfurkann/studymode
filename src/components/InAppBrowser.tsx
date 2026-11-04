import { Copy, ExternalLink, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { chromeIntent, detectInApp } from '../lib/inApp'

/*
 * Opened inside Instagram (or another app's browser): on Android the page moves itself to Chrome
 * once per visit, and a slim bar offers it again; on iPhone the bar says where the app's own
 * "open in browser" is. Read at load, before the app tidies the address (a /kod#code link keeps
 * its code on the way to Chrome). Someone already signed in here is not moved, only offered.
 */
const FIRST_URL = typeof window === 'undefined' ? '' : window.location.href
const TRIED_KEY = 'studymode.inapp.tried'
const HIDDEN_KEY = 'studymode.inapp.hidden'

function session(key: string): string | null {
  try {
    return sessionStorage.getItem(key)
  } catch {
    return null
  }
}
function remember(key: string) {
  try {
    sessionStorage.setItem(key, '1')
  } catch {
    // Not remembered: at worst the bar shows again.
  }
}
function signedInHere(): boolean {
  try {
    return Object.keys(localStorage).some((k) => k.startsWith('sb-') && k.endsWith('-auth-token'))
  } catch {
    return false
  }
}

export function InAppBrowser() {
  const [inApp] = useState(() => (typeof navigator === 'undefined' ? null : detectInApp(navigator.userAgent)))
  const [hidden, setHidden] = useState(() => !!session(HIDDEN_KEY))
  const [copied, setCopied] = useState(false)
  const intent = inApp?.platform === 'android' && /^https?:\/\//.test(FIRST_URL) ? chromeIntent(FIRST_URL) : null

  useEffect(() => {
    if (!intent || session(TRIED_KEY) || signedInHere()) return
    remember(TRIED_KEY)
    window.location.href = intent
  }, [intent])

  if (!inApp || hidden || inApp.platform === 'other') return null
  const where = inApp.app ? `${inApp.app}’ın tarayıcısındasın.` : 'Uygulamanın kendi tarayıcısındasın.'

  async function copy() {
    try {
      await navigator.clipboard.writeText(FIRST_URL || window.location.href)
      setCopied(true)
    } catch {
      // Copying blocked: the menu way still works.
    }
  }

  return (
    <div className="inapp-bar" role="note" aria-label="Tarayıcıda aç">
      <ExternalLink size={16} aria-hidden />
      <span className="grow">
        {where}{' '}
        {intent ? 'Giriş ve PDF yükleme Chrome’da daha sorunsuz.' : 'Giriş ve PDF yükleme için sağ üstteki ••• menüsünden tarayıcıda (Safari’de) aç.'}
      </span>
      {intent ? (
        <a className="btn btn-sm btn-primary" href={intent}>
          Chrome’da aç
        </a>
      ) : (
        <button type="button" className="btn btn-sm" onClick={() => void copy()}>
          <Copy size={14} aria-hidden /> {copied ? 'Kopyalandı' : 'Linki kopyala'}
        </button>
      )}
      <button
        type="button"
        className="btn btn-ghost btn-icon btn-sm"
        aria-label="Kapat"
        onClick={() => {
          remember(HIDDEN_KEY)
          setHidden(true)
        }}
      >
        <X size={16} />
      </button>
    </div>
  )
}
