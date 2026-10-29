import type { Card, LearningStepId, Note, QuizAttempt, Summary } from './types'

export interface LearningStepInfo {
  id: LearningStepId
  stepNumber: number
  title: string
  shortTitle: string
  description: string
  tab: 'ozet' | 'kartlar' | 'test' | 'uygula'
  done: boolean
  statusText: string
}

export interface NoteLearningProgress {
  steps: LearningStepInfo[]
  completedCount: number
  totalSteps: number
  percent: number
  currentStep: LearningStepInfo
  isCompleted: boolean
  nextActionLabel: string
}

export const LEARNING_STEPS_META: Array<{
  id: LearningStepId
  stepNumber: number
  title: string
  shortTitle: string
  description: string
  tab: 'ozet' | 'kartlar' | 'test' | 'uygula'
}> = [
  {
    id: 'tanis',
    stepNumber: 1,
    title: 'Konuyla Tanış & Kavramlar',
    shortTitle: 'Tanış',
    description: 'Detaylarda boğulmadan önce konunun büyük resmini ve temel kavramlarını öğren.',
    tab: 'ozet',
  },
  {
    id: 'anla',
    stepNumber: 2,
    title: 'Adım Adım Konu Anlatımı',
    shortTitle: 'Anla',
    description: 'Ana noktaları tek seferde ezberlemek yerine sindire sindire, madde madde ilerle.',
    tab: 'ozet',
  },
  {
    id: 'pekistir',
    stepNumber: 3,
    title: 'Kartlarla Hafızaya Yerleştir',
    shortTitle: 'Pekiştir',
    description: 'Teste geçmeden önce öğrendiğin kavramları soru-cevap kartlarıyla zihninde yokla.',
    tab: 'kartlar',
  },
  {
    id: 'sina',
    stepNumber: 4,
    title: 'Kendini Sına (Mini Test)',
    shortTitle: 'Sına',
    description: 'Çoktan seçmeli sorularla bilgini ölç, yanlışlarını anında tekrar kartına dönüştür.',
    tab: 'test',
  },
  {
    id: 'anlat',
    stepNumber: 5,
    title: 'Kendi Cümlelerinle Anlat',
    shortTitle: 'Anlat',
    description: 'Konuyu hiç bilmeyen birine anlatır gibi açık uçlu soruları yanıtla ve ustalığa ulaş.',
    tab: 'uygula',
  },
]

export function computeNoteProgress(
  note: Note,
  allCards: Card[],
  allAttempts: QuizAttempt[],
): NoteLearningProgress {
  const completedSet = new Set<LearningStepId>(note.summary?.completedSteps ?? [])
  const checkedTerms = new Set<string>(note.summary?.checkedTerms ?? [])
  const keyTerms = note.summary?.keyTerms ?? []
  const points = note.summary?.points ?? []

  const noteCards = allCards.filter((c) => c.noteId === note.id)
  const studiedCards = noteCards.filter((c) => c.reps > 0 || c.lapses > 0)

  const noteAttempts = allAttempts
    .filter((a) => a.noteId === note.id && a.total > 0)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const latestAttempt = noteAttempts[0] ?? null
  const bestAttempt = noteAttempts.reduce<QuizAttempt | null>(
    (best, cur) => (!best || cur.score / cur.total > best.score / best.total ? cur : best),
    null,
  )

  // Step 1: Tanış
  const allTermsChecked = keyTerms.length > 0 && keyTerms.every((t) => checkedTerms.has(t.term))
  const tanisDone = completedSet.has('tanis') || allTermsChecked
  const tanisStatus = tanisDone
    ? 'Tamamlandı'
    : keyTerms.length > 0
      ? `${checkedTerms.size}/${keyTerms.length} kavram`
      : 'Genel bakış'

  // Step 2: Anla
  const anlaDone = completedSet.has('anla')
  const anlaStatus = anlaDone
    ? 'Tamamlandı'
    : points.length > 0
      ? `${points.length} ana nokta`
      : 'Özet'

  // Step 3: Pekiştir
  const pekistirDone =
    completedSet.has('pekistir') ||
    (noteCards.length > 0 && studiedCards.length >= Math.min(noteCards.length, Math.ceil(noteCards.length * 0.5)))
  const pekistirStatus =
    noteCards.length === 0
      ? 'Kart yok'
      : studiedCards.length > 0
        ? `${studiedCards.length}/${noteCards.length} kart çalışıldı`
        : `${noteCards.length} kart hazır`

  // Step 4: Sına
  const bestRatio = bestAttempt ? bestAttempt.score / bestAttempt.total : 0
  const sinaDone = completedSet.has('sina') || bestRatio >= 0.7
  const sinaStatus = latestAttempt
    ? `Son test ${latestAttempt.score}/${latestAttempt.total}`
    : note.questions.length > 0
      ? `${note.questions.length} soru`
      : 'Soru yok'

  // Step 5: Anlat
  const anlatDone = completedSet.has('anlat')
  const anlatStatus = anlatDone
    ? 'Tamamlandı'
    : note.practice.length > 0
      ? `${note.practice.length} uygulama`
      : 'Açık uçlu'

  const doneByStep: Record<LearningStepId, { done: boolean; statusText: string }> = {
    tanis: { done: tanisDone, statusText: tanisStatus },
    anla: { done: anlaDone, statusText: anlaStatus },
    pekistir: { done: pekistirDone, statusText: pekistirStatus },
    sina: { done: sinaDone, statusText: sinaStatus },
    anlat: { done: anlatDone, statusText: anlatStatus },
  }

  const steps: LearningStepInfo[] = LEARNING_STEPS_META.map((meta) => ({
    ...meta,
    done: doneByStep[meta.id].done,
    statusText: doneByStep[meta.id].statusText,
  }))

  const completedCount = steps.filter((s) => s.done).length
  const totalSteps = steps.length
  const percent = Math.round((completedCount / totalSteps) * 100)
  const isCompleted = completedCount === totalSteps
  const currentStep = steps.find((s) => !s.done) ?? steps[steps.length - 1]

  const nextActionLabel = isCompleted
    ? 'Tamamlandı · Tekrar et'
    : `${currentStep.stepNumber}. Adım: ${currentStep.title}`

  return {
    steps,
    completedCount,
    totalSteps,
    percent,
    currentStep,
    isCompleted,
    nextActionLabel,
  }
}

export function toggleCompletedStep(
  summary: Summary,
  stepId: LearningStepId,
  forceValue?: boolean,
): Summary {
  const current = new Set<LearningStepId>(summary.completedSteps ?? [])
  const shouldAdd = forceValue !== undefined ? forceValue : !current.has(stepId)
  if (shouldAdd) current.add(stepId)
  else current.delete(stepId)
  return {
    ...summary,
    completedSteps: [...current],
  }
}

export function toggleCheckedTerm(summary: Summary, term: string): Summary {
  const current = new Set<string>(summary.checkedTerms ?? [])
  if (current.has(term)) current.delete(term)
  else current.add(term)
  const allChecked =
    summary.keyTerms.length > 0 && summary.keyTerms.every((t) => current.has(t.term))
  const completed = new Set<LearningStepId>(summary.completedSteps ?? [])
  if (allChecked) completed.add('tanis')
  return {
    ...summary,
    checkedTerms: [...current],
    completedSteps: [...completed],
  }
}

export interface TopicMastery {
  /** 0-100 score based on actual quiz attempts and SRS card reviews. */
  percent: number
  /** True once the student has completed at least 1 quiz or reviewed at least 1 card on this note. */
  assessed: boolean
  quizPercent: number | null
  cardPercent: number | null
  detail: string
}

/**
 * Computes real topic mastery from quiz accuracy and spaced-repetition card retention,
 * independent from whether the student clicked through the 5 study steps.
 */
export function computeTopicMastery(
  note: Note,
  allCards: Card[],
  allAttempts: QuizAttempt[],
): TopicMastery {
  const noteCards = allCards.filter((c) => c.noteId === note.id)
  const studiedCards = noteCards.filter((c) => c.reps > 0 || c.lapses > 0)

  const noteAttempts = allAttempts
    .filter((a) => a.noteId === note.id && a.total > 0)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  const hasQuiz = noteAttempts.length > 0
  const hasCardReview = studiedCards.length > 0

  if (!hasQuiz && !hasCardReview) {
    return {
      percent: 0,
      assessed: false,
      quizPercent: null,
      cardPercent: null,
      detail: 'Test ve tekrar performansı',
    }
  }

  let quizRatio: number | null = null
  if (hasQuiz) {
    const latest = noteAttempts[0]
    const best = noteAttempts.reduce((acc, cur) => (cur.score / cur.total > acc.score / acc.total ? cur : acc), latest)
    const latestRatio = latest.score / latest.total
    const bestRatio = best.score / best.total
    quizRatio = latestRatio * 0.7 + bestRatio * 0.3
  }

  let cardRatio: number | null = null
  if (hasCardReview && noteCards.length > 0) {
    const totalScore = noteCards.reduce((sum, card) => {
      if (card.reps === 0 && card.lapses === 0) return sum
      if (card.reps === 0 && card.lapses > 0) return sum + 0.2
      if (card.interval >= 7) return sum + 1
      return sum + 0.7
    }, 0)
    cardRatio = totalScore / noteCards.length
  }

  const combined =
    quizRatio !== null && cardRatio !== null
      ? quizRatio * 0.6 + cardRatio * 0.4
      : quizRatio !== null
        ? quizRatio
        : (cardRatio ?? 0)

  return {
    percent: Math.round(combined * 100),
    assessed: true,
    quizPercent: quizRatio !== null ? Math.round(quizRatio * 100) : null,
    cardPercent: cardRatio !== null ? Math.round(cardRatio * 100) : null,
    detail: 'Test ve tekrar performansı',
  }
}

