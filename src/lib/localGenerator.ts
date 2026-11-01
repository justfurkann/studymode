import { buildLocalMemoryTools } from './memoryTools'
import { generateStudySet } from './study'
import type { GeneratedSet } from './types'

/**
 * "Basit mod": builds a study set in the browser with rules, without AI.
 * It only works well on notes that contain "Kavram: açıklama" style definitions,
 * so the UI encourages adding cards by hand on top of it.
 */
export function generateLocally(text: string): GeneratedSet {
  const set = generateStudySet(text)
  const terms = set.cards
    .filter((card) => card.front.startsWith('“'))
    .map((card) => ({ term: card.front.replace(/^“(.+)” ne anlama gelir\?$/u, '$1'), definition: card.back }))

  const baseSummary = {
    overview: '',
    points: set.summary,
    keyTerms: terms,
  }
  const memory = buildLocalMemoryTools({ title: 'Not', content: text, summary: baseSummary })

  return {
    summary: {
      ...baseSummary,
      mnemonics: memory.mnemonics,
      comparisons: memory.comparisons,
    },
    cards: set.cards.map(({ front, back }) => ({ front, back, source: null })),
    questions: set.quiz.map((question) => ({
      id: crypto.randomUUID(),
      prompt: question.prompt,
      options: question.options,
      answerIndex: question.answerIndex,
      explanation: question.explanation,
      source: null,
    })),
    practice: set.practice.map((task) => ({
      id: crypto.randomUUID(),
      question: `${task.title}: ${task.prompt}`,
      answer: null,
      hint: task.hint,
    })),
  }
}
