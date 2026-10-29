import { computeNoteProgress, computeTopicMastery } from './learningPath'
import { daysUntil } from './srs'
import type { Course, LearningStepId, Note, StudyData } from './types'

export interface SmartPlanItem {
  note: Note
  course?: Course
  examDays: number | null
  reason: string
  actionLabel: string
  targetUrl: string
  masteryPercent: number | null
  priorityScore: number
}

export interface SmartStudyPlan {
  headline: string
  subheadline: string
  items: SmartPlanItem[]
}

function stepUrl(note: Note, stepId: LearningStepId): string {
  if (stepId === 'tanis' || stepId === 'anla') return `/not/${note.id}?adim=${stepId}`
  if (stepId === 'pekistir') return `/not/${note.id}?sekme=kartlar`
  if (stepId === 'sina') return `/not/${note.id}?sekme=test`
  return `/not/${note.id}?sekme=uygula`
}

export function buildSmartStudyPlan(data: StudyData, now = new Date(), maxItems = 2): SmartStudyPlan {
  const courseMap = new Map<string, Course>(data.courses.map((c) => [c.id, c]))
  const nowMs = now.getTime()

  const candidates: SmartPlanItem[] = []

  for (const note of data.notes) {
    const course = courseMap.get(note.courseId)
    const rawDays = course ? daysUntil(course.examDate, now) : null
    const examDays = rawDays !== null && rawDays >= 0 ? rawDays : null

    const progress = computeNoteProgress(note, data.cards, data.attempts)
    const mastery = computeTopicMastery(note, data.cards, data.attempts)
    const dueCount = data.cards.filter((c) => c.noteId === note.id && Date.parse(c.due) <= nowMs).length

    // Skip notes that are already mastered (>= 80%), all 5 steps done, and have no due cards
    if (progress.isCompleted && mastery.assessed && mastery.percent >= 80 && dueCount === 0) {
      continue
    }

    let priorityScore = 0
    if (examDays !== null) {
      // Closer exams get much higher priority
      priorityScore += Math.max(15, 100 - examDays * 4)
    }

    let reason = ''
    let actionLabel = 'Çalışmaya başla'
    let targetUrl = `/not/${note.id}`

    if (!note.generator) {
      priorityScore += 35
      reason = 'Çalışma seti henüz oluşturulmadı'
      actionLabel = 'Seti hazırla'
      targetUrl = `/not/${note.id}`
    } else if (mastery.assessed && mastery.percent < 70) {
      priorityScore += 55 + (70 - mastery.percent) * 0.5
      reason = `Konu hâkimiyeti düşük (%${mastery.percent})`
      actionLabel = 'Testi tekrar çöz'
      targetUrl = `/not/${note.id}?sekme=test`
    } else if (!progress.isCompleted) {
      priorityScore += 45 - progress.completedCount * 5
      reason =
        progress.completedCount === 0
          ? 'Henüz çalışmaya başlanmadı'
          : `Öğrenme yolu: ${progress.completedCount}/${progress.totalSteps} adım`
      actionLabel = `${progress.currentStep.stepNumber}. Adım: ${progress.currentStep.shortTitle}`
      targetUrl = stepUrl(note, progress.currentStep.id)
    } else if (!mastery.assessed) {
      priorityScore += 40
      reason = 'Adımlar bitti, konu hâkimiyeti henüz ölçülmedi'
      actionLabel = 'Mini testi çöz'
      targetUrl = `/not/${note.id}?sekme=test`
    } else if (dueCount > 0) {
      priorityScore += 30 + Math.min(20, dueCount * 2)
      reason = `${dueCount} kart tekrar bekliyor`
      actionLabel = 'Kartları tekrar et'
      targetUrl = `/tekrar?not=${note.id}`
    } else {
      priorityScore += 20
      reason = `Konu hâkimiyeti: %${mastery.percent} · Pekiştirme önerilir`
      actionLabel = 'Gözden geçir'
      targetUrl = `/not/${note.id}?sekme=uygula`
    }

    if (examDays !== null) {
      const examTag = examDays === 0 ? 'Sınav bugün' : `Sınava ${examDays} gün`
      reason = `${examTag} · ${reason}`
    }

    candidates.push({
      note,
      course,
      examDays,
      reason,
      actionLabel,
      targetUrl,
      masteryPercent: mastery.assessed ? mastery.percent : null,
      priorityScore,
    })
  }

  candidates.sort((a, b) => b.priorityScore - a.priorityScore || b.note.updatedAt.localeCompare(a.note.updatedAt))
  const items = candidates.slice(0, maxItems)

  // Determine headline based on the most urgent upcoming exam
  const upcomingExams = data.courses
    .map((course) => ({ course, days: daysUntil(course.examDate, now) }))
    .filter((e): e is { course: Course; days: number } => e.days !== null && e.days >= 0)
    .sort((a, b) => a.days - b.days)

  const nearestExam = upcomingExams[0]
  let headline = 'Bugün için akıllı çalışma planı'
  let subheadline = 'Konu hâkimiyetine ve öğrenme adımlarına göre önceliklendirildi'

  if (nearestExam && items.length > 0) {
    const dayPhrase = nearestExam.days === 0 ? 'Sınavın bugün' : `${nearestExam.course.name} sınavına ${nearestExam.days} gün kaldı`
    headline =
      items.length === 1
        ? `${dayPhrase} — bugün şu konuyu çalış`
        : `${dayPhrase} — bugün şu ${items.length} konuyu çalış`
    subheadline = 'Sınav tarihi, test performansı ve eksik adımlara göre seçildi'
  } else if (items.length > 0) {
    headline =
      items.length === 1
        ? 'Bugün şu konuyu çalışman öneriliyor'
        : `Bugün şu ${items.length} konuyu çalışman öneriliyor`
  }

  return {
    headline,
    subheadline,
    items,
  }
}
