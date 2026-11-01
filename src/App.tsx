import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Route, Routes, useLocation, useNavigationType, useParams } from 'react-router-dom'
import { Layout } from './components/Layout'
import { AchievementWatcher } from './components/Achievements'
import { Achievements } from './pages/Achievements'
import { Guide } from './pages/Guide'
import { unlock } from './lib/achievements'
import { UpdateWatcher } from './components/UpdateWatcher'
import { Alert, Spinner, ToastProvider } from './components/ui'
import { StoreProvider, useStore } from './lib/store'
import { About } from './pages/About'
import { AddNote } from './pages/AddNote'
import { Admin } from './pages/Admin'
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
import { Premium } from './pages/Premium'
import { Privacy } from './pages/Privacy'
import { Terms } from './pages/Terms'
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

/** An address that does not exist: today's page, and a small discovery for finding nowhere. */
function LostPage() {
  useEffect(() => {
    unlock('kayip-sayfa')
  }, [])
  return <Today />
}

// The quiz is a marketing page in its own chunk, so the app does not load it.
const StudentQuiz = lazy(() => import('./pages/StudentQuiz'))

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
      <Route path="gizlilik" element={<Privacy />} />
      <Route path="kullanim-kosullari" element={<Terms />} />
      <Route
        path="ogrenci-tipi"
        element={
          <Suspense fallback={<div className="center-screen"><Spinner size={28} /></div>}>
            <StudentQuiz />
          </Suspense>
        }
      />
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
        <Route path="premium" element={<Premium />} />
        <Route path="ayarlar" element={<Settings />} />
        <Route path="yonetim" element={<Admin />} />
        <Route path="paylas/:token" element={<SharedCourse />} />
        <Route path="giris" element={<Login />} />
        <Route path="sifre-yenile" element={<ResetPassword />} />
        <Route path="basarimlar" element={<Achievements />} />
        <Route path="rehber" element={<Guide />} />
        <Route path="*" element={<LostPage />} />
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
          <AchievementWatcher />
        </ToastProvider>
      </StoreProvider>
    </BrowserRouter>
  )
}
