import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary'
import { initAnalytics } from './lib/analytics'

// Consent-gated; a no-op unless VITE_ANALYTICS_DOMAIN is configured.
initAnalytics()

// #root always exists (see index.html), so the assertion is safe.
// ErrorBoundary catches a render crash and shows a fallback instead of a blank page.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
