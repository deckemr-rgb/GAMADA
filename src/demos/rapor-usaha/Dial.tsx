/**
 * Dial — the kit ScoreDial inside a bare `.dk-viz` box: the dial's band colours (--dk-viz-*) are defined on `.dk-viz`
 * only, and ScoreDial's own root does not carry that class (kit handoff), so without the box the arc has no colour.
 */
import { ScoreDial, type ScoreDialProps } from '../../demo-kit/viz'

export function Dial(props: ScoreDialProps) {
  return (
    <span className="dk-viz is-bare dk-ru-dial">
      <ScoreDial {...props} />
    </span>
  )
}
