import { useEffect, useState } from 'react'
import { askedRecently, askLater, useEducation } from '../lib/education'
import { useTourActive } from '../lib/tour'
import { useStore } from '../lib/store'
import { EducationForm } from './EducationForm'
import { Celebrate, Modal } from './ui'

const FORCE_KEY = 'studymode.education.force'

/** Automated browsers (the tests) do not get it on their own, or it would sit over every signed-in test. */
function allowed(): boolean {
  try {
    if (localStorage.getItem(FORCE_KEY)) return true
  } catch {
    // ignore
  }
  return !(typeof navigator !== 'undefined' && navigator.webdriver)
}

/**
 * Right after signing up (or the first visit after this shipped): "Seni biraz tanıyalım", level and
 * school. Waits until no other window (VIP welcome, tour, toast) is open; "Şimdi değil" asks again in
 * a few days.
 */
export function EducationPrompt() {
  const { session } = useStore()
  const education = useEducation()
  const tour = useTourActive()
  const userId = session?.user.id ?? null
  const [open, setOpen] = useState(false)
  const [done, setDone] = useState(false)
  const due = !!userId && !education && !done && allowed() && !askedRecently(userId)

  useEffect(() => {
    if (!due || open || tour) return
    const timer = window.setInterval(() => {
      if (!document.querySelector('[role="dialog"]')) {
        setOpen(true)
        window.clearInterval(timer)
      }
    }, 1200)
    return () => window.clearInterval(timer)
  }, [due, open, tour])

  if (!open || !userId) return null
  if (done) return null
  return (
    <Modal
      title="Seni biraz tanıyalım"
      onClose={() => {
        askLater(userId)
        setOpen(false)
        setDone(true)
      }}
    >
      <div className="edu-prompt">
        <p className="muted">
          Nerede okuduğunu söyle, sana uygun sınav dilini kullanalım. <Celebrate>Tek soru</Celebrate>, profilinde görünür; istediğin zaman Ayarlar'dan değiştirebilirsin.
        </p>
        <EducationForm
          onSaved={() => {
            setOpen(false)
            setDone(true)
          }}
        />
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => {
            askLater(userId)
            setOpen(false)
            setDone(true)
          }}
        >
          Şimdi değil
        </button>
      </div>
    </Modal>
  )
}
