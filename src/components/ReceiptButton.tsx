import { ReceiptText } from 'lucide-react'
import { lazy, Suspense, useState } from 'react'

// The drawing code loads only when someone opens the receipt.
const ReceiptDialog = lazy(() => import('./ReceiptCard'))

/** "Çalışma fişi" button: opens the shareable study receipt. */
export function ReceiptButton({ className = 'btn' }: { className?: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button className={className} onClick={() => setOpen(true)}>
        <ReceiptText size={18} /> Çalışma fişi
      </button>
      {open && (
        <Suspense fallback={null}>
          <ReceiptDialog onClose={() => setOpen(false)} />
        </Suspense>
      )}
    </>
  )
}
