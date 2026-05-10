import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Analytics } from '@vercel/analytics/react'
import * as Sentry from '@sentry/react'
import './index.css'
import Root from './Root.tsx'

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  tracesSampleRate: 0.2,
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
    <Analytics />
  </StrictMode>,
)
