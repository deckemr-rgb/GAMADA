/**
 * DeviceFrame (browser / laptop window) and PhoneFrame — bezels for screenshots, mock UIs and the
 * live mobile demos. Content is any ReactNode; frames are decorative chrome (aria-hidden parts).
 */
import type { ReactNode } from 'react'
import '../../styles/ui-kit.css'

export function DeviceFrame({ url, children, className = '' }: { url?: string; children: ReactNode; className?: string }) {
  return (
    <div className={`device ${className}`}>
      <div className="device-bar" aria-hidden="true">
        <span className="device-dot" />
        <span className="device-dot" />
        <span className="device-dot" />
        {url ? <span className="device-url">{url}</span> : null}
      </div>
      <div className="device-screen">{children}</div>
    </div>
  )
}

export function PhoneFrame({ children, className = '', label }: { children: ReactNode; className?: string; label?: string }) {
  return (
    <div className={`phone ${className}`} role={label ? 'group' : undefined} aria-label={label}>
      <span className="phone-notch" aria-hidden="true" />
      <div className="phone-screen">{children}</div>
    </div>
  )
}
