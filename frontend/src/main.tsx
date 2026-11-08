import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary'
import { initAnalytics } from './lib/analytics'

// Consent-gated; a no-op unless VITE_ANALYTICS_DOMAIN is configured.
initAnalytics()

// Site-wide copy guard. CSS makes everything non-selectable (09-fixes.css);
// this listener is the backstop for Ctrl+C / touch selections that start in an
// editable field and end in page text. Copying stays allowed where typing is
// allowed: inputs, textareas, contenteditable roots and `.copyable` content.
document.addEventListener('copy', (event) => {
  const selection = document.getSelection()
  if (!selection || selection.isCollapsed) return
  const anchor = selection.anchorNode
  const focus = selection.focusNode
  const isEditable = (node: Node | null): boolean => {
    if (!node) return false
    const el = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement
    if (!el) return false
    return Boolean(
      el.closest('input, textarea, [contenteditable="true"], .copyable'),
    )
  }
  if (!isEditable(anchor) || !isEditable(focus)) {
    event.preventDefault()
  }
})

// #root always exists (see index.html), so the assertion is safe.
// ErrorBoundary catches a render crash and shows a fallback instead of a blank page.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
