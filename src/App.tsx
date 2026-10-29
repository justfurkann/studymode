import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { Alert, Spinner, ToastProvider } from './components/ui'
import { StoreProvider, useStore } from './lib/store'
import { AddNote } from './pages/AddNote'
import { CourseDetail } from './pages/CourseDetail'
import { Exam } from './pages/Exam'
import { Courses } from './pages/Courses'
import { Login } from './pages/Login'
import { NoteDetail } from './pages/NoteDetail'
import { Review } from './pages/Review'
import { Settings } from './pages/Settings'
import { Today } from './pages/Today'

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
      <Route element={<Layout />}>
        <Route index element={<Today />} />
        <Route path="dersler" element={<Courses />} />
        <Route path="ders/:id" element={<CourseDetail />} />
        <Route path="ders/:id/sinav" element={<Exam />} />
        <Route path="not/:id" element={<NoteDetail />} />
        <Route path="not-ekle" element={<AddNote />} />
        <Route path="tekrar" element={<Review />} />
        <Route path="ayarlar" element={<Settings />} />
        <Route path="giris" element={<Login />} />
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
