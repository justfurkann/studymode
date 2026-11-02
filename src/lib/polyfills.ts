/*
 * Small stand-ins for features older iPhones lack (iOS before 17.4). pdf.js needs
 * Promise.withResolvers even in its "legacy" build, which fills in everything else itself; without
 * it every PDF failed with "PDF okunamadı" on those phones. Installed on the page at start and,
 * through POLYFILL_SOURCE, inside the PDF worker (a separate script with its own globals).
 */
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
}

/** The same function as source text, to run first inside a worker. */
export const POLYFILL_SOURCE = `(${installPolyfills.toString()})();`
