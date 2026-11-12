import type { Course, Note } from './types'

export const SITE_TITLE = 'StudyMode'

const FIXED: Record<string, string> = {
  '/dersler': 'Dersler',
  '/not-ekle': 'Not ekle',
  '/sinav': 'Sınavlar',
  '/premium': 'Premium',
  '/kod': 'Premium kodu',
  '/ayarlar': 'Ayarlar',
  '/yonetim': 'Yönetim',
  '/giris': 'Giriş',
  '/sifre-yenile': 'Şifre yenile',
  '/basarimlar': 'Başarımlar',
  '/rehber': 'Rehber',
}

/**
 * The browser tab name for a page inside the app. The course comes first, so open tabs
 * can be told apart at a glance ("Biyoloji · Hücre zarı"). Returns null for pages that
 * name their own tab (Hakkında, Fiyatlar, the quiz…), so they are left alone.
 */
export function pageTitle(pathname: string, search: string, courses: Course[], notes: Note[]): string | null {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname
  const courseName = (id: string | null | undefined) => (id ? courses.find((c) => c.id === id)?.name : undefined)
  const join = (...parts: Array<string | undefined>) => [...parts.filter((p): p is string => !!p && !!p.trim()), SITE_TITLE].join(' · ')

  if (path === '/') return SITE_TITLE
  if (FIXED[path]) return join(FIXED[path])

  const note = path.match(/^\/not\/([^/]+)$/)
  if (note) {
    const n = notes.find((x) => x.id === decodeURIComponent(note[1]))
    return n ? join(courseName(n.courseId), n.title) : join('Not')
  }

  const course = path.match(/^\/ders\/([^/]+)(\/sinav(?:\/[^/]+)?)?$/)
  if (course) {
    const name = courseName(decodeURIComponent(course[1]))
    return course[2] ? join(name, 'Sınav') : join(name ?? 'Ders')
  }

  if (path === '/tekrar') {
    const params = new URLSearchParams(search)
    const n = notes.find((x) => x.id === params.get('not'))
    if (n) return join(courseName(n.courseId), n.title, 'Tekrar')
    return join(courseName(params.get('ders')), 'Tekrar')
  }

  if (path.startsWith('/paylas/')) return join('Paylaşılan ders')
  return null
}
