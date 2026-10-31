import { useEffect } from 'react'
import { BrowserRouter, Route, Routes, useLocation, useNavigationType, useParams } from 'react-router-dom'
import { Layout } from './components/Layout'
import { UpdateWatcher } from './components/UpdateWatcher'
import { Alert, Spinner, ToastProvider } from './components/ui'
import { StoreProvider, useStore } from './lib/store'
import { About } from './pages/About'
import { AddNote } from './pages/AddNote'
import { CourseDetail } from './pages/CourseDetail'
import { Exam } from './pages/Exam'
import { ExamHistory } from './pages/ExamHistory'
import { ExamHub } from './pages/ExamHub'
import { Landing } from './pages/Landing'
import { Courses } from './pages/Courses'
import { Login } from './pages/Login'
import { NoteDetail } from './pages/NoteDetail'
import { ResetPassword } from './pages/ResetPassword'
import { Review } from './pages/Review'
import { Settings } from './pages/Settings'
import { SharedCourse } from './pages/SharedCourse'
import { Today } from './pages/Today'

/**
 * A new page starts at the top. Without this the browser keeps the old scroll position, so a link
 * at the bottom of one page (like "Made by") opened the next page at its bottom too. Going back
 * (POP) keeps the browser's own restoring; links to an #anchor and changes of ?query on the same
 * page (tabs, games) are left alone.
 */
function ScrollToTop() {
  const { pathname, hash } = useLocation()
  const type = useNavigationType()
  useEffect(() => {
    if (type !== 'POP' && !hash) window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  }, [pathname, hash, type])
  return null
}

/** Each course gets a fresh exam page, so a running exam never carries over to another course. */
function ExamForCourse() {
  const { id } = useParams()
  return <Exam key={id} />
}

function Routed() {
  const store = useStore()

  if (store.status === 'loading') {
    return (
      <div className="center-screen">
        <Spinner size={28} />
      </div>
    )
  }

  if (store.status === 'error') {
    return (
      <div className="center-screen">
        <div style={{ maxWidth: 420, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Alert tone="danger">{store.error}</Alert>
          <button className="btn" onClick={store.retryLoad}>
            Tekrar dene
          </button>
        </div>
      </div>
    )
  }

  return (
    <Routes>
      <Route path="tanitim" element={<Landing />} />
      <Route path="hakkinda" element={<About />} />
      <Route path="hakkında" element={<About />} />
      <Route element={<Layout />}>
        <Route index element={<Today />} />
        <Route path="dersler" element={<Courses />} />
        <Route path="ders/:id" element={<CourseDetail />} />
        <Route path="ders/:id/sinav" element={<ExamForCourse />} />
        <Route path="ders/:id/sinav/:examId" element={<ExamHistory />} />
        <Route path="not/:id" element={<NoteDetail />} />
        <Route path="not-ekle" element={<AddNote />} />
        <Route path="tekrar" element={<Review />} />
        <Route path="sinav" element={<ExamHub />} />
        <Route path="ayarlar" element={<Settings />} />
        <Route path="paylas/:token" element={<SharedCourse />} />
        <Route path="giris" element={<Login />} />
        <Route path="sifre-yenile" element={<ResetPassword />} />
        <Route path="*" element={<Today />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <UpdateWatcher />
      <StoreProvider>
        <ToastProvider>
          <Routed />
        </ToastProvider>
      </StoreProvider>
    </BrowserRouter>
  )
}
