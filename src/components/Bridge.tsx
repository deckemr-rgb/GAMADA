/**
 * Bridge — the connective band (cliff lip, waterfall top, mist) that travels with
 * the seam between two scenes and hides it. Moved by the master timeline.
 */
import { useRef } from 'react'
import type { BridgeDef } from '../lib/assets'
import { useCoverVars } from '../lib/useCoverVars'
import LayerArt from './LayerArt'

export default function Bridge({ def, focusX }: { def: BridgeDef; focusX: number }) {
  const ref = useRef<HTMLDivElement>(null)
  useCoverVars(ref, focusX, focusX)
  return (
    <div className="bridge-frame" ref={ref} aria-hidden="true">
      <div className="bridge" data-bridge={def.id}>
        <LayerArt art={def.src} />
        <div className="bridge-mist" />
      </div>
    </div>
  )
}
