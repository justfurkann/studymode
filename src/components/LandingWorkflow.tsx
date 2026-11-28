import { AlignLeft, Check, FileText, Layers, RotateCcw } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import '../styles/landing-workflow.css'

const note = [
  { title: 'Aktif hatırlama', highlightWidth: 120, lines: [182, 143] },
  { title: 'Aralıklı tekrar', highlightWidth: 109, lines: [198, 158] },
  { title: 'Uzun süreli bellek', highlightWidth: 133, lines: [182, 173] },
]

const outputs = [
  { title: 'Özet', detail: '6 kavram', icon: AlignLeft, tone: 'highlight' },
  { title: 'Kartlar', detail: 'Aralıklı tekrar', icon: Layers, tone: 'paper' },
  { title: 'Test', detail: '5 soru', icon: Check, tone: 'success' },
]

/** The first visit plays once as the visual comes into view. Settings and fonts come from the page. */
export function LandingWorkflow() {
  const panelRef = useRef<HTMLDivElement>(null)
  const [playing, setPlaying] = useState(false)
  const [replays, setReplays] = useState(0)
  const id = useId()
  const gridId = `${id}-grid`
  const scanId = `${id}-scan`

  useEffect(() => {
    const panel = panelRef.current
    if (!panel || typeof IntersectionObserver === 'undefined') {
      setPlaying(true)
      return
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry || entry.intersectionRatio < 0.3) return
      setPlaying(true)
      observer.disconnect()
    }, { threshold: 0.3 })
    observer.observe(panel)
    return () => observer.disconnect()
  }, [])

  return (
    <div className="lp-demo" ref={panelRef}>
      <svg
        key={replays}
        className={playing ? 'lp-workflow is-playing' : 'lp-workflow'}
        viewBox="0 0 447 463"
        width="447"
        height="463"
        role="img"
        aria-label="Öğrenme ve bellek notunun önemli satırları işaretlenir. Nottan 6 kavramlık özet, tekrar kartları ve 5 soruluk test hazırlanır."
      >
        <defs>
          <pattern id={gridId} width="19" height="19" patternUnits="userSpaceOnUse">
            <path className="lp-workflow-grid" d="M.5 19V.5H19" fill="none" />
          </pattern>
          <linearGradient id={scanId} x2="0" y2="1">
            <stop className="lp-workflow-scan-color" stopOpacity="0" />
            <stop className="lp-workflow-scan-color" offset="1" stopOpacity=".32" />
          </linearGradient>
        </defs>

        <rect className="lp-workflow-panel" x=".5" y=".5" width="446" height="462" rx="22" />
        <rect x="1" y="1" width="445" height="461" rx="21" fill={`url(#${gridId})`} />

        <g className="lp-workflow-note-shift">
          <g transform="translate(37 36)">
            <g className="lp-workflow-note">
              <rect className="lp-workflow-note-shadow" x="6" y="9" width="276" height="322" rx="17" />
              <rect className="lp-workflow-note-backing" x="3" y="4" width="276" height="322" rx="17" />
              <rect className="lp-workflow-note-paper" width="276" height="322" rx="17" />
              <rect className="lp-workflow-file-icon" x="20" y="23" width="30" height="30" rx="8" />
              <FileText className="lp-workflow-file-glyph" x="26" y="29" size={18} strokeWidth={1.7} />
              <text className="lp-workflow-subject" x="59" y="42">PSİKOLOJİYE GİRİŞ</text>
              <text className="lp-workflow-note-title" x="22" y="85">Öğrenme ve bellek</text>
              <path className="lp-workflow-rule" d="M22 108H254" />

              {note.map(({ title, highlightWidth, lines }, index) => {
                const markId = `${id}-mark-${index}`
                return (
                  <g key={title} transform={`translate(19 ${128 + index * 51})`}>
                    <clipPath id={markId}>
                      <rect
                        className="lp-workflow-mark-clip"
                        style={{ animationDelay: `${1.56 + index * 0.48}s` }}
                        y="-2"
                        width={highlightWidth}
                        height="22"
                        rx="4"
                      />
                    </clipPath>
                    <text className="lp-workflow-line-title" x="5" y="15">{title}</text>
                    <g clipPath={`url(#${markId})`}>
                      <rect className="lp-workflow-highlight" y="-2" width={highlightWidth} height="22" rx="4" />
                      <text className="lp-workflow-line-title lp-workflow-on-highlight" x="5" y="15">{title}</text>
                    </g>
                    <rect className="lp-workflow-line" x="5" y="26" width={lines[0]} height="3" rx="1.5" />
                    <rect className="lp-workflow-line-faint" x="5" y="33" width={lines[1]} height="3" rx="1.5" />
                  </g>
                )
              })}

              <rect className="lp-workflow-line-faint" x="24" y="284" width="124" height="3" rx="1.5" />
              <rect className="lp-workflow-line-faint" x="24" y="294" width="160" height="3" rx="1.5" />

              <g className="lp-workflow-scan">
                <rect x="12" y="-27" width="252" height="28" rx="3" fill={`url(#${scanId})`} />
                <path className="lp-workflow-scan-line" d="M12 0H264" strokeWidth="2" strokeLinecap="round" />
                <circle className="lp-workflow-highlight" cx="261" r="3.5" />
              </g>
            </g>
          </g>
        </g>

        {outputs.map(({ title, detail, icon: Icon, tone }, index) => (
          <g key={title} transform={`translate(243 ${196 + index * 71})`}>
            <g className="lp-workflow-output" style={{ animationDelay: `${3.1 + index * 0.3}s` }}>
              <rect className="lp-workflow-output-shadow" x="2" y="4" width="178" height="62" rx="14" />
              <rect className="lp-workflow-output-paper" x=".5" y=".5" width="177" height="60" rx="14" />
              <rect className={`lp-workflow-output-tone is-${tone}`} x="10" y="10" width="41" height="41" rx="10" />
              <Icon className={`lp-workflow-output-glyph is-${tone}`} x="20" y="20" size={21} strokeWidth={1.8} />
              <text className="lp-workflow-output-title" x="62" y="27">{title}</text>
              <text className="lp-workflow-output-detail" x="62" y="46">{detail}</text>
            </g>
          </g>
        ))}

        <g className="lp-workflow-sparkle" transform="translate(385 45)">
          <path className="lp-workflow-highlight" d="M0-13Q2-2 13 0Q2 2 0 13Q-2 2-13 0Q-2-2 0-13Z" />
        </g>
        <g className="lp-workflow-sparkle" transform="translate(408 69)">
          <path className="lp-workflow-sparkle-muted" d="M0-6Q1-1 6 0Q1 1 0 6Q-1 1-6 0Q-1-1 0-6Z" />
        </g>

        <g transform="translate(18 414)">
          <rect className="lp-workflow-status-paper" x=".5" y=".5" width="228" height="31" rx="10" />
          <g className="lp-workflow-status-progress">
            <circle className="lp-workflow-output-tone is-highlight" cx="18" cy="16" r="7" />
            <circle className="lp-workflow-status-spinner" cx="18" cy="16" r="4" fill="none" strokeWidth="1.4" strokeDasharray="4 10" />
            <text className="lp-workflow-status-text lp-workflow-scanning" x="34" y="20">Not taranıyor</text>
            <text className="lp-workflow-status-text lp-workflow-marking" x="34" y="20">Önemli yerler işaretleniyor</text>
            <text className="lp-workflow-status-text lp-workflow-preparing" x="34" y="20">Çalışma seti hazırlanıyor</text>
          </g>
          <g className="lp-workflow-status-ready">
            <circle className="lp-workflow-output-tone is-success" cx="18" cy="16" r="8" />
            <Check className="lp-workflow-output-glyph is-success" x="12.5" y="10.5" size={11} strokeWidth={2.2} />
            <text className="lp-workflow-status-text" x="34" y="20">Örnek çalışma seti hazır</text>
          </g>
        </g>
      </svg>

      <button
        className="lp-workflow-replay"
        type="button"
        aria-label="Animasyonu tekrar oynat"
        onClick={() => {
          setPlaying(true)
          setReplays((current) => current + 1)
        }}
      >
        <RotateCcw size={19} aria-hidden />
      </button>
    </div>
  )
}
