import {
  ArrowRight,
  Check,
  Download,
  Eye,
  EyeOff,
  Headphones,
  Image as ImageIcon,
  Layers,
  Pause,
  Play,
  Sparkles,
  Trash2,
  Volume2,
  Wand2,
} from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import {
  buildLocalPodcastScript,
  podcastLineToCard,
  type PodcastLine,
  type PodcastScript,
} from '../../lib/podcastTools'
import { aiAvailability, useSettings } from '../../lib/settings'
import { useStore } from '../../lib/store'
import type { Note } from '../../lib/types'
import { freshImport } from '../../lib/version'
import {
  buildConceptDiagram,
  readStoredVisuals,
  renderEducationalPosterDataUrl,
  saveStoredVisuals,
  visualToCard,
  type GeneratedVisualItem,
} from '../../lib/visualTools'
import { AiSignupPrompt } from '../AiSignupPrompt'
import { ZoomableImage } from '../ImageViewer'
import { compressImage, saveMessage } from '../../lib/imageStore'
import { safeFileName } from '../../lib/noteTools'

/** Download names: browsers drop names with Turkish letters and save the file as "download". */
const fileSafe = (title: string) => safeFileName(title.trim().replace(/\s+/g, '-').toLocaleLowerCase('tr-TR')) || 'gorsel'
import { Alert, Spinner, useToast } from '../ui'

const PODCAST_SCRIPT_PREFIX = 'studymode.podcast.v1.'

function readSavedPodcast(noteId: string): PodcastScript | null {
  try {
    const raw = localStorage.getItem(`${PODCAST_SCRIPT_PREFIX}${noteId}`)
    if (!raw) return null
    const parsed = JSON.parse(raw) as PodcastScript
    return parsed && Array.isArray(parsed.lines) && parsed.lines.length > 0 ? parsed : null
  } catch {
    return null
  }
}

function savePodcastScript(noteId: string, script: PodcastScript): void {
  try {
    localStorage.setItem(`${PODCAST_SCRIPT_PREFIX}${noteId}`, JSON.stringify(script))
  } catch {
    // Ignore storage quota issues
  }
}

export function VisualTab({
  note,
  onGoPodcast,
}: {
  note: Note
  onGoPodcast: () => void
}) {
  const store = useStore()
  const toast = useToast()
  const settings = useSettings()
  const ai = aiAvailability(settings, !!store.session)

  const diagram = buildConceptDiagram(note)
  const [selectedNodeId, setSelectedNodeId] = useState<string>(diagram.nodes[0]?.id ?? '')
  const [blindMode, setBlindMode] = useState(false)
  const [revealedNodes, setRevealedNodes] = useState<Record<string, boolean>>({})

  const [visuals, setVisuals] = useState<GeneratedVisualItem[]>(() => readStoredVisuals(note.id))
  const [topic, setTopic] = useState('')
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '1:1'>('16:9')
  const [busyAi, setBusyAi] = useState(false)
  const [error, setError] = useState('')
  const [addedCards, setAddedCards] = useState<Record<string, boolean>>({})

  useEffect(() => {
    setVisuals(readStoredVisuals(note.id))
    setSelectedNodeId(diagram.nodes[0]?.id ?? '')
  }, [note.id])

  const activeNode = diagram.nodes.find((n) => n.id === selectedNodeId) ?? diagram.nodes[0] ?? null

  function updateVisuals(next: GeneratedVisualItem[]) {
    const result = saveStoredVisuals(note.id, next)
    // What the device kept is what the student will see next time; show the same now.
    setVisuals(result === 'trimmed' ? readStoredVisuals(note.id) : next)
    const message = saveMessage(result)
    if (message) setError(message)
  }

  function handleCreatePoster(e?: FormEvent) {
    e?.preventDefault()
    setError('')
    const targetTopic = topic.trim() || note.title
    const items =
      note.summary?.keyTerms && note.summary.keyTerms.length > 0
        ? note.summary.keyTerms.slice(0, 5).map((kt) => ({ key: kt.term, meaning: kt.definition }))
        : diagram.nodes.slice(0, 5).map((n) => ({ key: n.label, meaning: n.detail }))

    const dataUrl = renderEducationalPosterDataUrl(targetTopic, note.title, items)
    const item: GeneratedVisualItem = {
      id: crypto.randomUUID(),
      title: targetTopic,
      prompt: `${targetTopic} görsel çalışma posteri`,
      imageUrl: dataUrl,
      caption: items.map((i) => `${i.key}: ${i.meaning}`).join(' · '),
      kind: 'poster',
      createdAt: new Date().toISOString(),
    }
    updateVisuals([item, ...visuals])
    setTopic('')
    store.recordActivity()
    toast('Görsel çalışma posteri hazırlandı')
  }

  async function handleGenerateAiImage() {
    if (!ai.ok) return
    setBusyAi(true)
    setError('')
    const targetTopic = topic.trim() || activeNode?.label || note.title
    try {
      const { generateConceptImage } = await freshImport(() => import('../../lib/ai'))
      const res = await generateConceptImage(
        {
          title: note.title,
          topic: targetTopic,
          context: note.content,
          aspectRatio,
        },
        settings,
      )
      const item: GeneratedVisualItem = {
        id: crypto.randomUUID(),
        title: targetTopic,
        prompt: `${targetTopic} (${aspectRatio})`,
        imageUrl: await compressImage(res.imageUrl),
        caption: res.caption || `${targetTopic} — ${note.title} görsel özeti`,
        kind: 'ai_image',
        createdAt: new Date().toISOString(),
      }
      updateVisuals([item, ...visuals])
      setTopic('')
      store.recordActivity()
      toast('Yapay zekâ görseli üretildi')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Görsel üretilemedi.')
    } finally {
      setBusyAi(false)
    }
  }

  function handleAddVisualCard(item: GeneratedVisualItem) {
    store.addCards([visualToCard({ title: item.title, caption: item.caption }, note.courseId, note.id)])
    setAddedCards((prev) => ({ ...prev, [item.id]: true }))
    toast('Görsel özeti kartlara eklendi')
  }

  function handleDeleteVisual(id: string) {
    updateVisuals(visuals.filter((v) => v.id !== id))
  }

  return (
    <div className="section no-print" style={{ gap: 18 }} aria-label="Görsel ve şema">
      <div className="panel memory-intro-panel">
        <div className="section-head" style={{ alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <strong style={{ fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: 8 }}>
              <ImageIcon size={18} /> Kavram Haritası & Görsel Üretici
            </strong>
            <p className="subtle">
              Notundaki kavramların birbirine nasıl bağlandığını şema üzerinde gör, kör harita testiyle kendini sına veya yapay zekâyla görsel üret.
            </p>
          </div>
          <div className="btn-row">
            <button
              type="button"
              className={`btn btn-sm ${blindMode ? 'btn-primary' : ''}`}
              aria-pressed={blindMode}
              onClick={() => {
                setBlindMode(!blindMode)
                setRevealedNodes({})
              }}
            >
              {blindMode ? <Eye size={15} /> : <EyeOff size={15} />}
              {blindMode ? 'Kavramları göster' : 'Kör harita testi (Gizle)'}
            </button>
          </div>
        </div>

        <div className="concept-map-box">
          {/* On a phone the map keeps a readable size and scrolls sideways. */}
          <div className="concept-map-scroll">
          <svg
            viewBox="0 0 760 440"
            className="concept-map-svg"
            role="img"
            aria-label={`${diagram.centralTopic} kavram haritası`}
          >
            {diagram.nodes.map((node) => (
              <g key={`edge-${node.id}`}>
                <line
                  x1={380}
                  y1={220}
                  x2={node.x}
                  y2={node.y}
                  stroke="var(--text-3)"
                  strokeWidth={selectedNodeId === node.id ? 3 : 1.75}
                  strokeDasharray={selectedNodeId === node.id ? undefined : '5 4'}
                />
              </g>
            ))}

            {/* Central Root Node */}
            <g transform="translate(380, 220)">
              <rect
                x={-110}
                y={-36}
                width={220}
                height={72}
                rx={14}
                fill="var(--hi)"
                stroke="var(--ink-line)"
                strokeWidth={2.5}
              />
              <text
                x={0}
                y={-4}
                textAnchor="middle"
                fill="var(--on-hi)"
                fontWeight={800}
                fontSize={14}
              >
                {diagram.centralTopic.length > 26
                  ? `${diagram.centralTopic.slice(0, 24)}…`
                  : diagram.centralTopic}
              </text>
              <text x={0} y={16} textAnchor="middle" fill="var(--on-hi)" fontSize={11} fontWeight={600}>
                Merkez Konu ({diagram.nodes.length} bağlantı)
              </text>
            </g>

            {/* Satellite Concept Nodes */}
            {diagram.nodes.map((node, idx) => {
              const isSelected = selectedNodeId === node.id
              const isHidden = blindMode && !revealedNodes[node.id]
              return (
                <g
                  key={node.id}
                  transform={`translate(${node.x}, ${node.y})`}
                  className="concept-node-group"
                  onClick={() => {
                    setSelectedNodeId(node.id)
                    if (blindMode) {
                      setRevealedNodes((prev) => ({ ...prev, [node.id]: !prev[node.id] }))
                    }
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  <rect
                    x={-105}
                    y={-30}
                    width={210}
                    height={60}
                    rx={12}
                    fill={isSelected ? 'var(--surface-2)' : 'var(--surface)'}
                    stroke="var(--text-3)"
                    strokeWidth={isSelected ? 2.5 : 1.75}
                  />
                  <text x={0} y={-6} textAnchor="middle" fill="var(--text)" fontWeight={700} fontSize={13}>
                    {isHidden ? `? · ${idx + 1}. Kavramı Tahmin Et` : node.label}
                  </text>
                  <text x={0} y={14} textAnchor="middle" fill="var(--text-3)" fontSize={11}>
                    {isHidden ? 'Açmak için dokun' : node.relation}
                  </text>
                </g>
              )
            })}
          </svg>
          </div>

          {activeNode && (
            <div className="concept-node-detail">
              <div className="section-head" style={{ gap: 8 }}>
                <strong>
                  {blindMode && !revealedNodes[activeNode.id] ? 'Gizli Kavram (Üzerine tıkla)' : activeNode.label}
                </strong>
                <span className="chip">{activeNode.relation}</span>
              </div>
              <p style={{ margin: 0 }}>{activeNode.detail}</p>
            </div>
          )}
        </div>
      </div>

      {/* AI Image & Poster Studio */}
      <div className="panel" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <strong style={{ fontSize: '1rem', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Sparkles size={17} /> Notlara ve Kartlara Görsel Üret
          </strong>
          <p className="subtle">
            İstediğin bir kavramı veya konuyu seç; yapay zekâ görsel modeliyle şema çizdir ya da tek tıkla Fosforlu çalışma posteri oluştur.
          </p>
        </div>

        <form className="memory-builder" onSubmit={handleCreatePoster}>
          <div className="memory-builder-row">
            <label className="field grow" style={{ margin: 0 }}>
              <span className="subtle">Görselleştirilecek kavram veya konu</span>
              <input
                className="input"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder={`Örn: ${activeNode?.label || note.title} şeması`}
                aria-label="Görselleştirilecek kavram veya konu"
              />
            </label>
            <label className="field" style={{ margin: 0, minWidth: 150 }}>
              <span className="subtle">Boyut</span>
              <select
                className="select"
                value={aspectRatio}
                onChange={(e) => setAspectRatio(e.target.value as '16:9' | '1:1')}
                aria-label="Görsel boyutu"
              >
                <option value="16:9">16:9 (Geniş Şema)</option>
                <option value="1:1">1:1 (Kart Görseli)</option>
              </select>
            </label>
            <div className="btn-row memory-builder-actions">
              {ai.ok && (
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={busyAi}
                  onClick={handleGenerateAiImage}
                >
                  {busyAi ? <Spinner size={15} /> : <Sparkles size={15} />} AI Görsel Üret
                </button>
              )}
              <button type="submit" className={`btn ${!ai.ok ? 'btn-primary' : ''}`} disabled={busyAi}>
                <Wand2 size={15} /> Poster Oluştur
              </button>
            </div>
          </div>
        </form>

        {!ai.ok && (
          <AiSignupPrompt reason="Notuna özel şema ve çizimleri yapay zekâ ile üretmek için ücretsiz hesap aç ya da giriş yap." />
        )}
        {error && <Alert tone="danger">{error}</Alert>}

        {visuals.length > 0 && (
          <div className="visual-gallery-grid">
            {visuals.map((item) => {
              const isAdded = !!addedCards[item.id]
              return (
                <article key={item.id} className="panel visual-card">
                  <div className="section-head">
                    <div>
                      <span className="chip">{item.kind === 'ai_image' ? 'AI Görsel' : 'Fosforlu Poster'}</span>
                      <h3 style={{ fontSize: '1rem', marginTop: 6 }}>{item.title}</h3>
                    </div>
                    <button
                      type="button"
                      className="btn btn-ghost btn-icon btn-sm"
                      aria-label={`${item.title} görselini sil`}
                      onClick={() => handleDeleteVisual(item.id)}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                  <div className="visual-card-preview">
                    <ZoomableImage src={item.imageUrl} alt={item.title} fileName={`${fileSafe(item.title)}.${item.imageUrl.startsWith('data:image/jpeg') ? 'jpg' : 'png'}`} loading="lazy" />
                  </div>
                  <p className="subtle" style={{ margin: 0 }}>
                    {item.caption}
                  </p>
                  <div className="btn-row">
                    <button
                      type="button"
                      className="btn btn-sm"
                      disabled={isAdded}
                      onClick={() => handleAddVisualCard(item)}
                    >
                      {isAdded ? <Check size={14} /> : <Layers size={14} />}
                      {isAdded ? 'Kartlara eklendi' : 'Karta çevir'}
                    </button>
                    <a
                      href={item.imageUrl}
                      download={`${fileSafe(item.title)}.${item.imageUrl.startsWith('data:image/jpeg') ? 'jpg' : 'png'}`}
                      className="btn btn-ghost btn-sm"
                    >
                      <Download size={14} /> İndir
                    </a>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </div>

      <div className="study-next">
        <button type="button" className="btn btn-primary btn-lg" onClick={onGoPodcast}>
          Devam: Podcast ile dinle <ArrowRight size={16} />
        </button>
      </div>
    </div>
  )
}

export function PodcastTab({
  note,
  onNext,
}: {
  note: Note
  onNext: () => void
}) {
  const store = useStore()
  const toast = useToast()
  const settings = useSettings()
  const ai = aiAvailability(settings, !!store.session)

  const [script, setScript] = useState<PodcastScript>(() => readSavedPodcast(note.id) ?? buildLocalPodcastScript(note))
  const [playingLineIdx, setPlayingLineIdx] = useState<number | null>(null)
  const [speed, setSpeed] = useState<1 | 1.25 | 1.5>(1)
  const [busyScript, setBusyScript] = useState(false)
  const [busyTts, setBusyTts] = useState(false)
  const [ttsProgress, setTtsProgress] = useState<{ done: number; total: number } | null>(null)
  const [studioAudioUrl, setStudioAudioUrl] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [addedLineIds, setAddedLineIds] = useState<Record<string, boolean>>({})

  const activeSpeechIdxRef = useRef<number | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    setScript(readSavedPodcast(note.id) ?? buildLocalPodcastScript(note))
    setPlayingLineIdx(null)
    setStudioAudioUrl(null)
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel()
      }
    }
  }, [note.id])

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = speed
    }
  }, [speed])

  function stopBrowserSpeech() {
    activeSpeechIdxRef.current = null
    setPlayingLineIdx(null)
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel()
    }
  }

  function speakFromIndex(startIndex: number) {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      toast('Tarayıcın sesli okumayı desteklemiyor. Stüdyo Sesi Üret düğmesini kullanabilirsin.')
      return
    }
    window.speechSynthesis.cancel()

    const step = (idx: number) => {
      if (idx >= script.lines.length) {
        activeSpeechIdxRef.current = null
        setPlayingLineIdx(null)
        return
      }
      const line = script.lines[idx]
      activeSpeechIdxRef.current = idx
      setPlayingLineIdx(idx)
      const utterance = new SpeechSynthesisUtterance(`${line.speaker}: ${line.text}`)
      utterance.lang = 'tr-TR'
      utterance.rate = (line.speaker === 'Deniz' ? 1.0 : 1.04) * speed
      utterance.pitch = line.speaker === 'Deniz' ? 1.06 : 0.92
      utterance.onend = () => {
        if (activeSpeechIdxRef.current === idx) {
          step(idx + 1)
        }
      }
      utterance.onerror = () => {
        activeSpeechIdxRef.current = null
        setPlayingLineIdx(null)
      }
      window.speechSynthesis.speak(utterance)
    }

    store.recordActivity()
    step(startIndex)
  }

  function togglePlayBrowser() {
    if (playingLineIdx !== null) {
      stopBrowserSpeech()
    } else {
      speakFromIndex(0)
    }
  }

  async function handleGenerateAiScript() {
    if (!ai.ok) return
    stopBrowserSpeech()
    setBusyScript(true)
    setError('')
    try {
      const { generatePodcastScript } = await freshImport(() => import('../../lib/ai'))
      const next = await generatePodcastScript({ title: note.title, text: note.content }, settings)
      setScript(next)
      savePodcastScript(note.id, next)
      setStudioAudioUrl(null)
      store.recordActivity()
      toast('İki kişilik podcast senaryosu yapay zekâ ile yenilendi')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Podcast senaryosu üretilemedi.')
    } finally {
      setBusyScript(false)
    }
  }

  async function handleSynthesizeStudioAudio() {
    if (!ai.ok) return
    stopBrowserSpeech()
    setBusyTts(true)
    setTtsProgress(null)
    setError('')
    try {
      const { synthesizePodcastTts } = await freshImport(() => import('../../lib/ai'))
      const res = await synthesizePodcastTts(script.lines, settings, (done, total) =>
        setTtsProgress({ done, total }),
      )
      setStudioAudioUrl(res.audioDataUrl)
      store.recordActivity()
      toast('Stüdyo kalitesinde iki kişilik ses hazır!')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Stüdyo sesi üretilemedi.')
    } finally {
      setBusyTts(false)
      setTtsProgress(null)
    }
  }

  function handleConvertLineToCard(line: PodcastLine, idx: number) {
    const prev = idx > 0 ? script.lines[idx - 1] : undefined
    store.addCards([podcastLineToCard(line, prev, note.courseId, note.id)])
    setAddedLineIds((prevMap) => ({ ...prevMap, [line.id]: true }))
    toast('Podcast diyaloğu kartlara eklendi')
  }

  return (
    <div className="section no-print" style={{ gap: 18 }} aria-label="Podcast ve sesli not">
      <div className="panel podcast-hero-panel">
        <div className="section-head" style={{ alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <strong style={{ fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Headphones size={18} /> {script.title}
              </strong>
              <span className="chip">
                ~{Math.max(1, Math.round(script.durationEstimateSec / 60))} dk · {script.lines.length} replik
              </span>
            </div>
            <p className="subtle">
              <strong>Deniz (Asistan)</strong> ve <strong>Mert (Öğrenci)</strong> bu notun en önemli kavramlarını ve sınav tuzaklarını soru-cevap sohbetiyle konuşuyor.
            </p>
          </div>

          <div className="btn-row">
            {ai.ok && (
              <button
                type="button"
                className="btn btn-sm"
                disabled={busyScript || busyTts}
                onClick={handleGenerateAiScript}
              >
                {busyScript ? <Spinner size={14} /> : <Sparkles size={14} />} Diyaloğu AI ile yenile
              </button>
            )}
          </div>
        </div>

        <div className="podcast-controls-bar">
          <div className="btn-row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={togglePlayBrowser}
              disabled={busyTts}
            >
              {playingLineIdx !== null ? <Pause size={16} /> : <Play size={16} />}
              {playingLineIdx !== null ? 'Duraklat' : 'Hemen Dinle'}
            </button>

            {ai.ok && (
              <button
                type="button"
                className="btn"
                disabled={busyTts || busyScript}
                onClick={handleSynthesizeStudioAudio}
              >
                {busyTts ? <Spinner size={15} /> : <Volume2 size={15} />}
                {busyTts
                  ? ttsProgress && ttsProgress.total > 1
                    ? `Stüdyo sesi (${ttsProgress.done}/${ttsProgress.total})…`
                    : 'Stüdyo sesi üretiliyor…'
                  : 'Stüdyo Sesi Üret (AI)'}
              </button>
            )}
          </div>

          <div className="segmented" role="group" aria-label="Okuma hızı">
            {([1, 1.25, 1.5] as const).map((rate) => (
              <button
                key={rate}
                type="button"
                aria-pressed={speed === rate}
                onClick={() => setSpeed(rate)}
              >
                {rate}x
              </button>
            ))}
          </div>
        </div>

        {studioAudioUrl && (
          <div className="podcast-studio-player">
            <audio ref={audioRef} controls src={studioAudioUrl} style={{ width: '100%' }} />
            <a
              href={studioAudioUrl}
              download={`${fileSafe(note.title)}-podcast.wav`}
              className="btn btn-ghost btn-sm"
            >
              <Download size={14} /> WAV İndir
            </a>
          </div>
        )}

        {!ai.ok && (
          <AiSignupPrompt reason="Bu sohbeti iki farklı doğal sesle dinlemek için ücretsiz hesap aç ya da giriş yap." />
        )}
        {error && <Alert tone="danger">{error}</Alert>}
      </div>

      <div className="podcast-transcript" role="list" aria-label="Podcast diyalog metni">
        {script.lines.map((line, idx) => {
          const isPlaying = playingLineIdx === idx
          const isAdded = !!addedLineIds[line.id]
          return (
            <div
              key={line.id}
              role="listitem"
              className={`podcast-turn ${line.speaker === 'Deniz' ? 'is-host' : 'is-student'} ${isPlaying ? 'is-playing' : ''}`}
            >
              <div className="podcast-turn-head">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className={`podcast-speaker-badge ${line.speaker === 'Deniz' ? 'host' : 'student'}`}>
                    {line.speaker}
                  </span>
                  <span className="subtle">
                    {line.speaker === 'Deniz' ? 'Asistan' : 'Öğrenci'}
                  </span>
                  {line.highlight && <span className="chip">{line.highlight}</span>}
                </div>
                <div className="btn-row" style={{ gap: 6 }}>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => (isPlaying ? stopBrowserSpeech() : speakFromIndex(idx))}
                    aria-label={`${idx + 1}. repliği seslendir`}
                  >
                    {isPlaying ? <Pause size={13} /> : <Play size={13} />}
                    {isPlaying ? 'Durdur' : 'Buradan dinle'}
                  </button>
                  {line.speaker === 'Deniz' && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      disabled={isAdded}
                      onClick={() => handleConvertLineToCard(line, idx)}
                    >
                      {isAdded ? <Check size={13} /> : <Layers size={13} />}
                      {isAdded ? 'Kartta' : 'Karta çevir'}
                    </button>
                  )}
                </div>
              </div>
              <p className="podcast-turn-text">{line.text}</p>
            </div>
          )
        })}
      </div>

      <div className="study-next">
        <button type="button" className="btn btn-primary btn-lg" onClick={onNext}>
          Teste geç <ArrowRight size={16} />
        </button>
      </div>
    </div>
  )
}
