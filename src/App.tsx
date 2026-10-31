import { BrowserRouter, Route, Routes, useParams } from 'react-router-dom'
import { Layout } from './components/Layout'
import { Alert, Spinner, ToastProvider } from './components/ui'
import { StoreProvider, useStore } from './lib/store'
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
      <StoreProvider>
        <ToastProvider>
          <Routed />
        </ToastProvider>
      </StoreProvider>
    </BrowserRouter>
  )
}
