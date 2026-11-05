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
 * What pdf.js 6's normal (fast) build calls without checking, in the page or in its worker. Safari
 * only has all of them from 18.4 (Math.sumPrecise later still), so checking just URL.parse and
 * Promise.withResolvers gave an iPhone on Safari 18.0-18.3 the normal build, and every PDF failed
 * with "PDF okunamadı". Keep this list in step with pdf.js when it is updated (see the test
 * "PDF upload works on Safari 18.0-18.3" in tests/app.spec.ts).
 */
export function missingForModernPdf(g: typeof globalThis = globalThis): string[] {
  const any = g as unknown as Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
  const checks: Array<[string, () => unknown]> = [
    ['Promise.withResolvers', () => any.Promise?.withResolvers],
    ['Promise.try', () => any.Promise?.try],
    ['URL.parse', () => any.URL?.parse],
    ['Uint8Array.prototype.toHex', () => any.Uint8Array?.prototype?.toHex],
    ['Uint8Array.fromBase64', () => any.Uint8Array?.fromBase64],
    ['ArrayBuffer.prototype.transferToFixedLength', () => any.ArrayBuffer?.prototype?.transferToFixedLength],
    ['Math.sumPrecise', () => any.Math?.sumPrecise],
    ['Iterator helpers', () => any.Iterator?.prototype?.filter],
    ['Set.prototype.intersection', () => any.Set?.prototype?.intersection],
  ]
  return checks.filter(([, get]) => typeof get() !== 'function').map(([name]) => name)
}

/**
 * Whether this browser can run pdf.js's normal (fast) build as it is. Read before the polyfills
 * are installed, so it reflects the browser itself. Every other browser gets the legacy build,
 * which carries its own stand-ins (slower, but it reads every PDF).
 */
/** What this browser itself lacks of that list (read before the polyfills go in); shown in error reports. */
export const MISSING_FOR_MODERN_PDF = missingForModernPdf()
export const MODERN_PDF = MISSING_FOR_MODERN_PDF.length === 0

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

