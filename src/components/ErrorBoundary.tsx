import { Component, type ErrorInfo, type ReactNode } from 'react'
import { reportError } from '../lib/feedback'
import { reloadFresh } from '../lib/version'

/**
 * If a screen crashes, show a calm message instead of a blank page, and report the error so it
 * can be fixed. Data is safe: it lives in storage and Supabase, not in the crashed screen.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    reportError(error, info.componentStack?.slice(0, 1500))
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div className="center-screen">
        <div className="panel crash" role="alert">
          <h1>Bir şeyler ters gitti</h1>
          <p className="muted">Bu ekran beklenmedik bir hatayla karşılaştı. Notların güvende; sayfayı yenileyince devam edebilirsin. Hatayı bize otomatik bildirdik.</p>
          <div className="btn-row">
            <button className="btn btn-primary" onClick={reloadFresh}>
              Sayfayı yenile
            </button>
            <a className="btn" href="/">
              Ana sayfaya dön
            </a>
          </div>
        </div>
      </div>
    )
  }
}
