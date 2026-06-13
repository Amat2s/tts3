import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { initSentry } from '@/lib/observability/sentry'

// Initialise frontend crash reporting before the app mounts. No-op when
// VITE_SENTRY_DSN is absent, so the app runs normally without a DSN.
initSentry()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
