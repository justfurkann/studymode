import { useSyncExternalStore } from 'react'

/*
 * "Gizle" on a finished exam: the student does not want to be asked for that grade (or for the
 * course's final date) any more. Kept in this browser; the exam itself stays under past exams.
 */

const KEY = 'studymode.exams.hidden.v1'
const listeners = new Set<() => void>()
let cache: { raw: string; set: Set<string> } | null = null

export const gradeKey = (examId: string) => `grade:${examId}`
export const nextKey = (courseId: string) => `next:${courseId}`

function read(): Set<string> {
  let raw = '[]'
  try {
    raw = localStorage.getItem(KEY) ?? '[]'
  } catch {
    // Storage blocked: nothing is hidden.
  }
  if (cache?.raw === raw) return cache.set
  let list: unknown = []
  try {
    list = JSON.parse(raw)
  } catch {
    list = []
  }
  cache = { raw, set: new Set(Array.isArray(list) ? list.filter((x): x is string => typeof x === 'string') : []) }
  return cache.set
}

export function hideExamAsks(keys: string[]) {
  // Old entries fall off so the list cannot grow for ever.
  const next = [...new Set([...read(), ...keys])].slice(-200)
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    // Storage blocked: it stays visible, which is harmless.
  }
  listeners.forEach((fn) => fn())
}

function subscribe(fn: () => void) {
  listeners.add(fn)
  window.addEventListener('storage', fn)
  return () => {
    listeners.delete(fn)
    window.removeEventListener('storage', fn)
  }
}

/** The hidden asks, re-rendering when one is added (also from another tab). */
export const useHiddenExamAsks = (): Set<string> => useSyncExternalStore(subscribe, read, read)
