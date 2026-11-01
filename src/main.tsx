import '@fontsource-variable/bricolage-grotesque'
import '@fontsource-variable/figtree'
import { Analytics } from '@vercel/analytics/react'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { ErrorBoundary } from './components/ErrorBoundary'
import { installErrorReporting } from './lib/feedback'
import { startUpdateChecks } from './lib/version'
import { applyTheme } from './lib/settings'
import { applyDecor } from './lib/decor'
import './styles/global.css'
import './styles/extras.css'
import './styles/achievements.css'
import './styles/guide.css'

applyTheme()
applyDecor()
installErrorReporting()
startUpdateChecks()

// Visitor counts (Vercel Web Analytics, cookieless). Not on local development or in tests.
const analytics = !['localhost', '127.0.0.1'].includes(window.location.hostname)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
    {analytics && <Analytics />}
  </StrictMode>,
)
