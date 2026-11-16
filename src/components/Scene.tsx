/**
 * Scene — generic stack of depth layers. Structure (each level owns one kind of transform):
 *
 *   section.scene[data-scene]                 visibility toggling
 *     div.scene-clip                          seam clipping (translateY window)
 *       div.scene-inner                       counter-translation of the clip
 *         div.layer[data-depth]               scroll parallax + dolly + DOF   (master timeline)
 *           div.layer-pointer                 pointer / gyro parallax         (pointer.ts)
 *             div.layer-wind                  wind skew / sway / pose fades   (ambient.ts)
 *               LayerArt (trimmed AVIF/WebP at its bbox) [+ blurred DOF twin] | FrameSpace(slot)
 */
import { useRef, type CSSProperties } from 'react'
import type { SceneDef, SlotRenderers } from '../lib/assets'
import { isEnabled } from '../lib/motion'
import { getPerfTier } from '../lib/perf'
import { useCoverVars } from '../lib/useCoverVars'
import FrameSpace from './FrameSpace'
import LayerArt from './LayerArt'

interface Props {
  def: SceneDef
  slots: SlotRenderers
}

export default function Scene({ def, slots }: Props) {
  const ref = useRef<HTMLElement>(null)
  useCoverVars(ref, def.focusX, def.focusXMobile)
  // pre-blurred DOF twins only where the GPU budget allows it
  const dof = isEnabled('depthOfField') && getPerfTier() === 'high'
  const style = {
    '--focus-x': `${def.focusX * 100}%`,
    '--focus-x-m': `${def.focusXMobile * 100}%`,
    zIndex: def.index + 1,
  } as CSSProperties

  return (
    <section ref={ref} className="scene" data-scene={def.id} data-index={def.index} aria-hidden="true" style={style}>
      <div className="scene-clip">
        <div className="scene-inner">
          {def.layers.map((l, i) => {
            const layerStyle: CSSProperties = { zIndex: i + 1 }
            if (l.blend && l.blend !== 'normal') layerStyle.mixBlendMode = l.blend
            if (l.opacity !== undefined) layerStyle.opacity = l.opacity
            const windStyle: CSSProperties = {}
            if (l.pose && l.pose.index !== 0) windStyle.opacity = 0
            return (
              <div
                key={l.id}
                className="layer"
                data-layer={l.id}
                data-depth={l.depth}
                data-dof={l.dof ? '' : undefined}
                style={layerStyle}
              >
                <div className="layer-pointer" data-depth={l.depth}>
                  <div
                    className="layer-wind"
                    data-wind={l.wind ? '' : undefined}
                    data-sway={l.sway ? JSON.stringify(l.sway) : undefined}
                    data-pose-group={l.pose?.group}
                    data-pose-index={l.pose?.index}
                    data-focus-x={def.focusX}
                    data-focus-x-m={def.focusXMobile}
                    style={windStyle}
                  >
                    {l.src ? (
                      <>
                        <LayerArt art={l.src} priority={def.index === 0} />
                        {l.dof && dof ? <LayerArt art={l.src} blur /> : null}
                      </>
                    ) : l.slot ? (
                      l.space === 'frame' ? (
                        <FrameSpace focusX={def.focusX} focusXMobile={def.focusXMobile}>
                          {slots[l.slot]}
                        </FrameSpace>
                      ) : (
                        <div className="slot-box">{slots[l.slot]}</div>
                      )
                    ) : null}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
