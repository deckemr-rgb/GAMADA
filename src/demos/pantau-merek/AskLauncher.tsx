/**
 * demos/pantau-merek/AskLauncher.tsx — the AI question button before the AI chunk is loaded: it preloads Ask.tsx on
 * intent and swaps itself for it on click (Ask then sends the question at once).
 */
import { Suspense, lazy, useState } from 'react'
import { Button } from '../../demo-kit/ui'
import { intentProps } from '../../demo-kit/shell'
import { loadAsk } from './loaders'

const Ask = lazy(loadAsk)

export function AskLauncher({ prompt, label, pm }: { prompt: string; label: string; pm: string }) {
  const [on, setOn] = useState(false)
  const btn = (
    <Button size="sm" variant="secondary" icon="spark" onClick={() => setOn(true)} data-pm={pm} busy={on} {...intentProps(loadAsk)}>
      {label}
    </Button>
  )
  if (!on) return <div className="dk-pm-ask">{btn}</div>
  return (
    <Suspense fallback={<div className="dk-pm-ask">{btn}</div>}>
      <Ask prompt={prompt} label={label} pm={pm} auto />
    </Suspense>
  )
}
