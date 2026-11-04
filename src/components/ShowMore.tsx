import { ChevronDown } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'

/**
 * Long lists show their first few rows and a "Daha fazla göster" button, so a page with hundreds of
 * accounts or codes stays short. `resetKey` (a filter or search) starts it over from the top.
 */
export function useShowMore<T>(items: T[], step = 8, resetKey?: unknown): { visible: T[]; more: ReactNode } {
  const [count, setCount] = useState(step)
  useEffect(() => setCount(step), [resetKey, step])
  const left = items.length - count
  return {
    visible: items.slice(0, count),
    more:
      left > 0 ? (
        <button type="button" className="btn btn-ghost btn-sm show-more" onClick={() => setCount((n) => n + step * 2)}>
          <ChevronDown size={15} aria-hidden /> Daha fazla göster ({left})
        </button>
      ) : null,
  }
}
