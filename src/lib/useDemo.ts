import { useNavigate } from 'react-router-dom'
import { createDemoSet, DEMO_COURSE_NAME, DEMO_NOTE_CONTENT, DEMO_NOTE_TITLE } from './demo'
import { useStore } from './store'
import { localDayKey, shiftLocalDay } from './streak'

export const DEMO_EXAM_IN_DAYS = 7

/** Creates the ready-made example course and note, then opens the note. */
export function useLoadDemo() {
  const store = useStore()
  const navigate = useNavigate()
  return () => {
    // A week-away exam lets the example show the exam countdown and the smart daily plan right away.
    const course = store.addCourse({ name: DEMO_COURSE_NAME })
    store.saveCourseExams(course.id, [{ kind: 'vize', date: shiftLocalDay(localDayKey(), DEMO_EXAM_IN_DAYS), weight: 40, noteIds: [] }])
    const note = store.addNote({ courseId: course.id, title: DEMO_NOTE_TITLE, content: DEMO_NOTE_CONTENT })
    store.applyGenerated(note.id, createDemoSet(), 'local')
    navigate(`/not/${note.id}`)
  }
}
