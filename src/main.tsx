import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router/dom'
import './styles/fonts.css'
import './index.css'
import { router } from './router'
import { I18nProvider } from './lib/i18n'
import { instrumentTicker } from './lib/tickerProbe'
import { prefersReducedMotion } from './lib/motion'

instrumentTicker()
// CSS hook for ?motion=reduced as well as the OS setting
if (prefersReducedMotion()) document.documentElement.dataset.motion = 'reduced'

const root = document.getElementById('root')
if (root) {
  createRoot(root).render(
    <StrictMode>
      <I18nProvider>
        <RouterProvider router={router} />
      </I18nProvider>
    </StrictMode>,
  )
}
