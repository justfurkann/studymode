import { useEffect, useRef, useState } from 'react'
import { captchaSiteKey, loadTurnstile } from '../lib/captcha'
import { Alert } from './ui'

/**
 * The bot check box. Usually it ticks itself in a second or two; `onToken` gets the one-time token,
 * or '' when it expires or fails. Bump `resetSignal` after every attempt: a token works only once.
 */
export function Captcha({ onToken, resetSignal }: { onToken: (token: string) => void; resetSignal: number }) {
  const box = useRef<HTMLDivElement>(null)
  const widget = useRef<string | null>(null)
  const report = useRef(onToken)
  report.current = onToken
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let alive = true
    loadTurnstile()
      .then((ts) => {
        if (!alive || !box.current) return
        const dark = getComputedStyle(document.documentElement).colorScheme === 'dark'
        widget.current = ts.render(box.current, {
          sitekey: captchaSiteKey(),
          language: 'tr',
          theme: dark ? 'dark' : 'light',
          size: 'flexible',
          callback: (token: string) => report.current(token),
          'expired-callback': () => report.current(''),
          'timeout-callback': () => report.current(''),
          'error-callback': () => {
            report.current('')
            return false
          },
        })
      })
      .catch(() => alive && setFailed(true))
    return () => {
      alive = false
      if (widget.current) window.turnstile?.remove(widget.current)
      widget.current = null
    }
  }, [])

  useEffect(() => {
    if (!resetSignal || !widget.current) return
    report.current('')
    window.turnstile?.reset(widget.current)
  }, [resetSignal])

  return (
    <div className="captcha">
      <div ref={box} className="captcha-box" aria-label="Bot doğrulaması" />
      {failed && <Alert tone="warning">Bot doğrulaması yüklenemedi. Sayfayı yenile; reklam engelleyici açıksa studymode.fun için kapat.</Alert>}
    </div>
  )
}
