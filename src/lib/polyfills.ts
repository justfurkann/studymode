/*
 * Small stand-ins for features older iPhones lack (iOS before 17.4). pdf.js needs
 * Promise.withResolvers even in its "legacy" build, which fills in everything else itself; without
 * it every PDF failed with "PDF okunamadı" on those phones. Installed on the page at start and,
 * through POLYFILL_SOURCE, inside the PDF worker (a separate script with its own globals).
 */
/**
 * True only on older browsers (e.g. iOS < 17.4) that lacked `Promise.withResolvers` natively.
 * Modern browsers already have it, so they can run the PDF worker directly without a Blob wrapper.
 */
export const NEEDS_WORKER_POLYFILL =
  typeof (Promise as unknown as { withResolvers?: unknown }).withResolvers !== 'function'

/**
 * Whether this browser can run pdf.js's normal (fast) build as it is: it needs native
 * Promise.withResolvers and URL.parse (iOS 18+, any current desktop browser). Read before the
 * polyfills are installed, so it reflects the browser itself. Older ones get the legacy build.
 */
export const MODERN_PDF =
  !NEEDS_WORKER_POLYFILL && typeof (URL as unknown as { parse?: unknown }).parse === 'function'

export function installPolyfills() {
  const P = Promise as unknown as { withResolvers?: () => unknown }
  if (typeof P.withResolvers !== 'function') {
    P.withResolvers = function withResolvers() {
      let resolve!: (value: unknown) => void
      let reject!: (reason?: unknown) => void
      const promise = new Promise((res, rej) => {
        resolve = res
        reject = rej
      })
      return { promise, resolve, reject }
    }
  }

  if (typeof AbortSignal !== 'undefined') {
    const S = AbortSignal as unknown as { timeout?: (ms: number) => AbortSignal }
    if (typeof S.timeout !== 'function') {
      S.timeout = function timeout(ms: number): AbortSignal {
        const controller = new AbortController()
        setTimeout(() => controller.abort(new DOMException('TimeoutError', 'TimeoutError')), ms)
        return controller.signal
      }
    }
  }
}

/** The same function as source text, to run first inside a worker. */
export const POLYFILL_SOURCE = `(${installPolyfills.toString()})();`

