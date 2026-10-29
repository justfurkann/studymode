import { useNavigate } from 'react-router-dom'
import { createDemoSet, DEMO_COURSE_NAME, DEMO_NOTE_CONTENT, DEMO_NOTE_TITLE } from './demo'
import { useStore } from './store'

/** Creates the ready-made example course and note, then opens the note. */
export function useLoadDemo() {
  const store = useStore()
  const navigate = useNavigate()
  return () => {
    const course = store.addCourse({ name: DEMO_COURSE_NAME })
    const note = store.addNote({ courseId: course.id, title: DEMO_NOTE_TITLE, content: DEMO_NOTE_CONTENT })
    store.applyGenerated(note.id, createDemoSet(), 'local')
    navigate(`/not/${note.id}`)
  }
}
