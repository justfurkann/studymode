// The parts of KaTeX the app uses (the package ships no types).
declare module 'katex' {
  interface KatexOptions {
    displayMode?: boolean
    throwOnError?: boolean
    strict?: boolean | 'ignore' | 'warn' | 'error'
    trust?: boolean
    output?: 'html' | 'mathml' | 'htmlAndMathml'
  }
  const katex: { renderToString(tex: string, options?: KatexOptions): string }
  export default katex
}
