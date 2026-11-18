/** Route error boundary (e.g. a lazy chunk failed to load after a deploy): offer a reload / home. */
import { useLayoutEffect } from 'react'
import { useRouteError } from 'react-router'
import { useI18n } from '../lib/i18n'

export default function RouteError() {
  const { t } = useI18n()
  const err = useRouteError()
  // the static /demo first paint (index.html #dk-boot) must not cover the error
  useLayoutEffect(() => document.getElementById('dk-boot')?.remove(), [])
  if (import.meta.env.DEV) console.warn('[gamada] route error', err)
  return (
    <main id="main" className="route-error">
      <h1 className="page-title">{t.error.title}</h1>
      <p className="page-lead">{t.error.body}</p>
      <p className="route-error-actions">
        <button type="button" className="btn-primary" onClick={() => window.location.reload()}>
          {t.error.reload}
        </button>
        <a href="/">{t.error.home}</a>
      </p>
    </main>
  )
}
