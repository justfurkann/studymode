import { ArrowRight, Check, Eye, EyeOff, Image as ImageIcon, KeyRound, Layers, ListChecks, Scale, Sparkles, Trash2, Volume2, VolumeX, Wand2 } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import {
  buildCustomLocalMnemonic,
  buildLocalComparisonPair,
  buildLocalMemoryTools,
  comparisonToCard,
  extractNoteTerms,
  MNEMONIC_KINDS,
  mnemonicKindLabel,
  mnemonicToCard,
} from '../../lib/memoryTools'
import { aiAvailability, useSettings } from '../../lib/settings'
import { useStore } from '../../lib/store'
import type { ConceptComparison, MnemonicItem, MnemonicKind, Note } from '../../lib/types'
import { freshImport } from '../../lib/version'
import { renderEducationalPosterDataUrl } from '../../lib/visualTools'
import { AiSignupPrompt } from '../AiSignupPrompt'
import { Alert, Spinner, useToast } from '../ui'

export function MemoryCodingTab({
  note,
  onGoCompare,
}: {
  note: Note
  onGoCompare: () => void
}) {
  const store = useStore()
  const toast = useToast()
  const settings = useSettings()
  const ai = aiAvailability(settings, !!store.session)

  const summary = note.summary
  const fallback = buildLocalMemoryTools(note)
  const mnemonics: MnemonicItem[] =
    summary?.mnemonics && summary.mnemonics.length > 0 ? summary.mnemonics : fallback.mnemonics

  const [selectedKind, setSelectedKind] = useState<MnemonicKind>('akrostis')
  const [focusTopic, setFocusTopic] = useState('')
  const [busyMode, setBusyMode] = useState<'single' | 'all' | null>(null)
  const [error, setError] = useState('')
  const [quizMode, setQuizMode] = useState(false)
  const [revealedKeys, setRevealedKeys] = useState<Record<string, boolean>>({})
  const [addedCardIds, setAddedCardIds] = useState<Record<string, boolean>>({})
  const [speakingId, setSpeakingId] = useState<string | null>(null)
  const [visualUrls, setVisualUrls] = useState<Record<string, string>>({})
  const [busyVisualId, setBusyVisualId] = useState<string | null>(null)

  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel()
      }
    }
  }, [])

  function saveMnemonics(nextList: MnemonicItem[]) {
    if (!summary) return
    store.updateNote(note.id, {
      summary: {
        ...summary,
        mnemonics: nextList,
      },
    })
  }

  function handleLocalGenerate(e?: FormEvent) {
    e?.preventDefault()
    setError('')
    const created = buildCustomLocalMnemonic(note, selectedKind, focusTopic)
    saveMnemonics([created, ...mnemonics])
    setFocusTopic('')
    store.recordActivity()
    toast(`${mnemonicKindLabel(selectedKind)} şifresi eklendi`)
  }

  async function handleAiGenerate(mode: 'single' | 'all') {
    if (!ai.ok) return
    setBusyMode(mode)
    setError('')
    try {
      const { generateMemoryTools } = await freshImport(() => import('../../lib/ai'))
      const result = await generateMemoryTools(
        mode === 'single'
          ? {
              title: note.title,
              text: note.content,
              mode: 'mnemonic',
              mnemonicKind: selectedKind,
              focusTopic: focusTopic.trim() || undefined,
            }
          : {
              title: note.title,
              text: note.content,
              mode: 'all',
            },
        settings,
      )
      if (!result.mnemonics.length) {
        throw new Error('Bu bölüm için şifre üretilemedi. Başka bir kavram veya yöntem dene.')
      }
      if (mode === 'single') {
        saveMnemonics([...result.mnemonics, ...mnemonics])
        setFocusTopic('')
        toast('Yapay zekâ hafıza şifresini hazırladı')
      } else {
        if (summary) {
          store.updateNote(note.id, {
            summary: {
              ...summary,
              mnemonics: result.mnemonics,
              comparisons: result.comparisons.length ? result.comparisons : summary.comparisons,
            },
          })
        }
        toast('Tüm hafıza şifreleri yapay zekâ ile yenilendi')
      }
      store.recordActivity()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Hafıza şifresi üretilemedi.')
    } finally {
      setBusyMode(null)
    }
  }

  function handleConvertCard(item: MnemonicItem) {
    store.addCards([mnemonicToCard(item, note.courseId, note.id)])
    setAddedCardIds((prev) => ({ ...prev, [item.id]: true }))
    toast('Hafıza şifresi kartlara eklendi')
  }

  function handleDelete(id: string) {
    saveMnemonics(mnemonics.filter((m) => m.id !== id))
  }

  function toggleSpeak(item: MnemonicItem) {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      toast('Tarayıcın sesli okumayı desteklemiyor.')
      return
    }
    if (speakingId === item.id) {
      window.speechSynthesis.cancel()
      setSpeakingId(null)
      return
    }
    window.speechSynthesis.cancel()
    const text = `${item.title}. ${item.code.replace(/·/g, ', ')}. ${item.breakdown.map((b) => `${b.key}: ${b.meaning}`).join('. ')}`
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'tr-TR'
    utterance.rate = 0.96
    utterance.onend = () => setSpeakingId(null)
    utterance.onerror = () => setSpeakingId(null)
    setSpeakingId(item.id)
    window.speechSynthesis.speak(utterance)
  }

  function toggleRevealRow(rowKey: string) {
    setRevealedKeys((prev) => ({ ...prev, [rowKey]: !prev[rowKey] }))
  }

  async function handleVisualizeMnemonic(item: MnemonicItem) {
    if (visualUrls[item.id]) {
      setVisualUrls((prev) => {
        const next = { ...prev }
        delete next[item.id]
        return next
      })
      return
    }
    if (ai.ok) {
      setBusyVisualId(item.id)
      try {
        const { generateConceptImage } = await freshImport(() => import('../../lib/ai'))
        const res = await generateConceptImage(
          {
            title: note.title,
            topic: `${item.title} (${item.code})`,
            context: item.breakdown.map((b) => `${b.key}: ${b.meaning}`).join('\n'),
            aspectRatio: '16:9',
          },
          settings,
        )
        setVisualUrls((prev) => ({ ...prev, [item.id]: res.imageUrl }))
        store.recordActivity()
        return
      } catch {
        // Fall through to crisp Fosforlu SVG poster if image model quota is unavailable
      } finally {
        setBusyVisualId(null)
      }
    }
    const posterUrl = renderEducationalPosterDataUrl(item.title, item.code, item.breakdown)
    setVisualUrls((prev) => ({ ...prev, [item.id]: posterUrl }))
  }

  return (
    <div className="section no-print" style={{ gap: 18 }} aria-label="Hafıza kodlaması">
      <div className="panel memory-intro-panel">
        <div className="section-head" style={{ alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <strong style={{ fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: 8 }}>
              <KeyRound size={18} /> Hafıza Kodlaması (Akrostiş, Tekerleme ve Hikâye)
            </strong>
            <p className="subtle">
              Ezberlemesi zor maddeleri baş harf şifresine, kafiyeli dörtlüğe veya hikâye zincirine dönüştür.
            </p>
          </div>
          <div className="btn-row">
            <button
              type="button"
              className={`btn btn-sm ${quizMode ? 'btn-primary' : ''}`}
              aria-pressed={quizMode}
              onClick={() => {
                setQuizMode(!quizMode)
                setRevealedKeys({})
              }}
            >
              {quizMode ? <Eye size={15} /> : <EyeOff size={15} />}
              {quizMode ? 'Açılımları göster' : 'Şifreyi dene (Kendini sına)'}
            </button>
            {ai.ok && (
              <button
                type="button"
                className="btn btn-sm"
                disabled={!!busyMode}
                onClick={() => handleAiGenerate('all')}
              >
                {busyMode === 'all' ? <Spinner size={14} /> : <Sparkles size={14} />} Seti AI ile yenile
              </button>
            )}
          </div>
        </div>

        <form className="memory-builder" onSubmit={handleLocalGenerate}>
          <div className="mnemonic-kind-grid" role="radiogroup" aria-label="Kodlama yöntemi">
            {MNEMONIC_KINDS.map((item) => {
              const active = selectedKind === item.kind
              return (
                <button
                  key={item.kind}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  className={`mnemonic-kind-btn ${active ? 'active' : ''}`}
                  onClick={() => setSelectedKind(item.kind)}
                >
                  <strong>{item.label}</strong>
                  <span>{item.description}</span>
                </button>
              )
            })}
          </div>

          <div className="memory-builder-row">
            <label className="field grow" style={{ margin: 0 }}>
              <span className="subtle">Odaklanılacak konu veya kavramlar (isteğe bağlı)</span>
              <input
                className="input"
                value={focusTopic}
                onChange={(e) => setFocusTopic(e.target.value)}
                placeholder="Örn: Bellek türleri, organeller veya boş bırak (tüm not)"
                aria-label="Kodlanacak kavram veya konu"
              />
            </label>
            <div className="btn-row memory-builder-actions">
              {ai.ok && (
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={!!busyMode}
                  onClick={() => handleAiGenerate('single')}
                >
                  {busyMode === 'single' ? <Spinner size={15} /> : <Sparkles size={15} />} Yapay zekâ ile kodla
                </button>
              )}
              <button type="submit" className={`btn ${!ai.ok ? 'btn-primary' : ''}`} disabled={!!busyMode}>
                <Wand2 size={15} /> Hızlı şifrele
              </button>
            </div>
          </div>
        </form>

        {!ai.ok && (
          <AiSignupPrompt reason="Kendi Gemini, Claude veya ChatGPT anahtarını bağlayarak ya da ücretsiz giriş yaparak yapay zekâya özel akrostiş ve tekerlemeler yazdırabilirsin." />
        )}
        {error && <Alert tone="danger">{error}</Alert>}
      </div>

      <div className="mnemonic-cards-stack">
        {mnemonics.map((item) => {
          const isAdded = !!addedCardIds[item.id]
          const isSpeaking = speakingId === item.id
          return (
            <article key={item.id} className="panel mnemonic-card" aria-label={item.title}>
              <div className="mnemonic-card-head">
                <div>
                  <span className="subtle mnemonic-kicker">{mnemonicKindLabel(item.kind)}</span>
                  <h3>{item.title}</h3>
                </div>
                <div className="btn-row">
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    disabled={busyVisualId === item.id}
                    onClick={() => handleVisualizeMnemonic(item)}
                  >
                    {busyVisualId === item.id ? <Spinner size={14} /> : <ImageIcon size={15} />}
                    {visualUrls[item.id] ? 'Görseli gizle' : 'Görselleştir'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => toggleSpeak(item)}
                    aria-label={isSpeaking ? 'Okumayı durdur' : `${item.title} şifresini sesli oku`}
                  >
                    {isSpeaking ? <VolumeX size={15} /> : <Volume2 size={15} />}
                    {isSpeaking ? 'Durdur' : 'Sesli oku'}
                  </button>
                  {mnemonics.length > 1 && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-icon"
                      onClick={() => handleDelete(item.id)}
                      aria-label={`${item.title} şifresini kaldır`}
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              </div>

              {visualUrls[item.id] && (
                <div className="visual-card-preview">
                  <img src={visualUrls[item.id]} alt={`${item.title} görsel şeması`} />
                </div>
              )}

              <div className="mnemonic-code-box">
                <span className="mnemonic-code-label">Hafıza Şifresi</span>
                <p className="mnemonic-code-text prewrap">{item.code}</p>
              </div>

              {item.breakdown.length > 0 && (
                <div className="mnemonic-breakdown">
                  {item.breakdown.map((b, idx) => {
                    const rowKey = `${item.id}-${idx}`
                    const hidden = quizMode && !revealedKeys[rowKey]
                    return (
                      <div key={rowKey} className="mnemonic-breakdown-row">
                        <strong className="mnemonic-key">{b.key}</strong>
                        {hidden ? (
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm mnemonic-reveal-btn"
                            onClick={() => toggleRevealRow(rowKey)}
                          >
                            <Eye size={14} /> Açılımı gör
                          </button>
                        ) : (
                          <span
                            className="mnemonic-meaning"
                            onClick={quizMode ? () => toggleRevealRow(rowKey) : undefined}
                          >
                            {b.meaning}
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              <div className="mnemonic-card-foot">
                {item.tip && <p className="subtle mnemonic-tip">Sınav ipucu: {item.tip}</p>}
                <button
                  type="button"
                  className="btn btn-sm"
                  disabled={isAdded}
                  onClick={() => handleConvertCard(item)}
                >
                  {isAdded ? <Check size={15} /> : <Layers size={15} />}
                  {isAdded ? 'Kartlara eklendi' : 'Şifreyi karta çevir'}
                </button>
              </div>
            </article>
          )
        })}
      </div>

      <div className="study-next">
        <button type="button" className="btn btn-primary btn-lg" onClick={onGoCompare}>
          Devam: Karşılaştırma ve tuzaklar <ArrowRight size={16} />
        </button>
      </div>
    </div>
  )
}

export function ComparisonTab({
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

  const summary = note.summary
  const fallback = buildLocalMemoryTools(note)
  const comparisons: ConceptComparison[] =
    summary?.comparisons && summary.comparisons.length > 0 ? summary.comparisons : fallback.comparisons

  const availableTerms = extractNoteTerms(note).map((t) => t.term)
  const [leftTerm, setLeftTerm] = useState(availableTerms[0] ?? '')
  const [rightTerm, setRightTerm] = useState(availableTerms[1] ?? '')
  const [busyMode, setBusyMode] = useState<'pair' | 'all' | null>(null)
  const [error, setError] = useState('')
  const [addedCardIds, setAddedCardIds] = useState<Record<string, boolean>>({})

  function saveComparisons(nextList: ConceptComparison[]) {
    if (!summary) return
    store.updateNote(note.id, {
      summary: {
        ...summary,
        comparisons: nextList,
      },
    })
  }

  function handleLocalCompare(e?: FormEvent) {
    e?.preventDefault()
    if (!leftTerm.trim() || !rightTerm.trim()) {
      setError('Karşılaştırmak için iki kavram yaz veya seç.')
      return
    }
    if (leftTerm.trim().toLocaleLowerCase('tr-TR') === rightTerm.trim().toLocaleLowerCase('tr-TR')) {
      setError('Farklı iki kavram seçmelisin.')
      return
    }
    setError('')
    const pair = buildLocalComparisonPair(note, leftTerm, rightTerm)
    saveComparisons([pair, ...comparisons])
    store.recordActivity()
    toast('Karşılaştırma eklendi')
  }

  async function handleAiCompare(mode: 'pair' | 'all') {
    if (!ai.ok) return
    if (mode === 'pair') {
      if (!leftTerm.trim() || !rightTerm.trim()) {
        setError('Karşılaştırmak için iki kavram yaz veya seç.')
        return
      }
      if (leftTerm.trim().toLocaleLowerCase('tr-TR') === rightTerm.trim().toLocaleLowerCase('tr-TR')) {
        setError('Farklı iki kavram seçmelisin.')
        return
      }
    }
    setBusyMode(mode)
    setError('')
    try {
      const { generateMemoryTools } = await freshImport(() => import('../../lib/ai'))
      const result = await generateMemoryTools(
        mode === 'pair'
          ? {
              title: note.title,
              text: note.content,
              mode: 'comparison',
              leftTerm: leftTerm.trim(),
              rightTerm: rightTerm.trim(),
            }
          : {
              title: note.title,
              text: note.content,
              mode: 'comparison',
            },
        settings,
      )
      if (!result.comparisons.length) {
        throw new Error('Karşılaştırma üretilemedi. Kavram adlarını kontrol et.')
      }
      if (mode === 'pair') {
        saveComparisons([...result.comparisons, ...comparisons])
        toast('Yapay zekâ karşılaştırmayı hazırladı')
      } else {
        saveComparisons(result.comparisons)
        toast('Karıştırılan kavramlar tablosu yenilendi')
      }
      store.recordActivity()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Karşılaştırma hazırlanamadı.')
    } finally {
      setBusyMode(null)
    }
  }

  function handleConvertCard(item: ConceptComparison) {
    store.addCards([comparisonToCard(item, note.courseId, note.id)])
    setAddedCardIds((prev) => ({ ...prev, [item.id]: true }))
    toast('Karşılaştırma sorusu kartlara eklendi')
  }

  function handleDelete(id: string) {
    saveComparisons(comparisons.filter((c) => c.id !== id))
  }

  return (
    <div className="section no-print" style={{ gap: 18 }} aria-label="Karşılaştırma ve sınav tuzakları">
      <div className="panel memory-intro-panel">
        <div className="section-head" style={{ alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <strong style={{ fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Scale size={18} /> Karıştırılan Kavramlar & Sınav Tuzakları
            </strong>
            <p className="subtle">
              Birbirine benzeyen kavramların farkını ve sınav şıklarında kurulan tuzakları yan yana gör.
            </p>
          </div>
          {ai.ok && (
            <button
              type="button"
              className="btn btn-sm"
              disabled={!!busyMode}
              onClick={() => handleAiCompare('all')}
            >
              {busyMode === 'all' ? <Spinner size={14} /> : <Sparkles size={14} />} Tabloyu AI ile yenile
            </button>
          )}
        </div>

        <form className="comparison-builder" onSubmit={handleLocalCompare}>
          {availableTerms.length >= 2 && (
            <div className="subtle" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
              <span>Nottaki kavramlar:</span>
              {availableTerms.slice(0, 8).map((term, i) => (
                <button
                  key={term}
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    if (i % 2 === 0 || !leftTerm) setLeftTerm(term)
                    else setRightTerm(term)
                  }}
                >
                  {term}
                </button>
              ))}
            </div>
          )}

          <div className="comparison-inputs-row">
            <label className="field grow" style={{ margin: 0 }}>
              <span className="subtle">1. Kavram</span>
              <input
                className="input"
                value={leftTerm}
                onChange={(e) => setLeftTerm(e.target.value)}
                placeholder="Örn: Çalışma belleği"
                aria-label="1. Kavram"
              />
            </label>
            <label className="field grow" style={{ margin: 0 }}>
              <span className="subtle">2. Kavram</span>
              <input
                className="input"
                value={rightTerm}
                onChange={(e) => setRightTerm(e.target.value)}
                placeholder="Örn: Uzun süreli bellek"
                aria-label="2. Kavram"
              />
            </label>
            <div className="btn-row memory-builder-actions">
              {ai.ok && (
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={!!busyMode}
                  onClick={() => handleAiCompare('pair')}
                >
                  {busyMode === 'pair' ? <Spinner size={15} /> : <Sparkles size={15} />} AI ile karşılaştır
                </button>
              )}
              <button type="submit" className={`btn ${!ai.ok ? 'btn-primary' : ''}`} disabled={!!busyMode}>
                <Wand2 size={15} /> Karşılaştır
              </button>
            </div>
          </div>
        </form>

        {error && <Alert tone="danger">{error}</Alert>}
      </div>

      <div className="comparison-cards-stack">
        {comparisons.map((item) => {
          const isAdded = !!addedCardIds[item.id]
          return (
            <article
              key={item.id}
              className="panel comparison-card"
              aria-label={`${item.leftTerm} ve ${item.rightTerm} karşılaştırması`}
            >
              <div className="comparison-card-head">
                <h3>
                  {item.leftTerm} <span className="subtle">vs.</span> {item.rightTerm}
                </h3>
                {comparisons.length > 1 && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-icon"
                    onClick={() => handleDelete(item.id)}
                    aria-label={`${item.leftTerm} ve ${item.rightTerm} karşılaştırmasını kaldır`}
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>

              <div className="comparison-columns">
                <div className="comparison-col">
                  <strong>{item.leftTerm}</strong>
                  <p>{item.leftPoint}</p>
                </div>
                <div className="comparison-col">
                  <strong>{item.rightTerm}</strong>
                  <p>{item.rightPoint}</p>
                </div>
              </div>

              <div className="comparison-diff">
                <strong>Temel fark:</strong> <span>{item.difference}</span>
              </div>

              {item.examTrap && (
                <div className="comparison-trap">
                  <strong>Sınav tuzağı:</strong> <span>{item.examTrap}</span>
                </div>
              )}

              <div className="mnemonic-card-foot">
                <span className="subtle">Bu farkı aralıklı tekrara ekleyebilirsin</span>
                <button
                  type="button"
                  className="btn btn-sm"
                  disabled={isAdded}
                  onClick={() => handleConvertCard(item)}
                >
                  {isAdded ? <Check size={15} /> : <Layers size={15} />}
                  {isAdded ? 'Kartlara eklendi' : 'Tuzak soruyu karta çevir'}
                </button>
              </div>
            </article>
          )
        })}
      </div>

      <div className="study-next">
        <button type="button" className="btn btn-primary btn-lg" onClick={onNext}>
          <ListChecks size={16} /> Teste geç
        </button>
      </div>
    </div>
  )
}
