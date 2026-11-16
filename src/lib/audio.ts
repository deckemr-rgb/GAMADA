/**
 * audio.ts — synthesised ambience (Web Audio API, no files).
 *
 *   wind   (hero)          brown noise → lowpass (LFO on cutoff) → gain (LFO) + a faint whistle band
 *   water  (tranquility)   white noise → bandpass "splash" + brown noise → lowpass "rumble"
 *   forest (biodiversity)  soft brown/white noise bed + cicada tremolo + scheduled bird chirps
 *
 * Bed levels come from SCENES (SceneDef.audio): scene i gets the equal-power weight
 * cos(min(1, |progress − i|) · π/2) and scenes sharing a bed are power-summed, so adding or
 * reordering scenes needs no change here. Mixed on gsap.ticker.
 * Sound always starts OFF; enable() must be called from a user gesture.
 */
import { gsap } from 'gsap'
import { AUDIO_MIX, DUR, isEnabled } from './motion'
import { SCENES, type SceneDef } from './assets'
import { emit, motionState } from './store'

type Bed = SceneDef['audio']
const BEDS: readonly Bed[] = ['wind', 'water', 'forest']

interface Graph {
  ctx: AudioContext
  master: GainNode
  beds: Record<Bed, GainNode>
  forestOut: GainNode
}

let graph: Graph | null = null
let on = false
let mixerOn = false
let suspendTimer: number | null = null
let chirpClock = 2
/** Bumped on every enable/disable so a stale enable() continuation cannot override a newer call. */
let seq = 0
const lastLevel: Record<Bed, number> = { wind: -1, water: -1, forest: -1 }

/* ------------------------------------------------------------------ building blocks */

function noiseBuffer(ctx: AudioContext, kind: 'white' | 'brown'): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * AUDIO_MIX.noiseSeconds)
  const buf = ctx.createBuffer(1, len, ctx.sampleRate)
  const d = buf.getChannelData(0)
  let last = 0
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1
    if (kind === 'white') d[i] = w * 0.5
    else {
      last = (last + 0.02 * w) / 1.02
      d[i] = last * 3.5
    }
  }
  // crossfade the tail into the head so the loop has no click
  const fade = Math.min(4096, Math.floor(len / 4))
  for (let i = 0; i < fade; i++) {
    const t = i / fade
    const tailIdx = len - fade + i
    d[tailIdx] = (d[tailIdx] ?? 0) * (1 - t) + (d[i] ?? 0) * t
  }
  return buf
}

function loop(ctx: AudioContext, buf: AudioBuffer, offset = 0): AudioBufferSourceNode {
  const src = ctx.createBufferSource()
  src.buffer = buf
  src.loop = true
  src.start(0, offset % buf.duration)
  return src
}

function lfo(ctx: AudioContext, hz: number, depth: number, target: AudioParam): OscillatorNode {
  const osc = ctx.createOscillator()
  osc.frequency.value = hz
  const g = ctx.createGain()
  g.gain.value = depth
  osc.connect(g).connect(target)
  osc.start()
  return osc
}

function filter(ctx: AudioContext, type: BiquadFilterType, freq: number, q = 0.7): BiquadFilterNode {
  const f = ctx.createBiquadFilter()
  f.type = type
  f.frequency.value = freq
  f.Q.value = q
  return f
}

function gain(ctx: AudioContext, v: number): GainNode {
  const g = ctx.createGain()
  g.gain.value = v
  return g
}

/* ------------------------------------------------------------------ graph */

function build(ctx: AudioContext): Graph {
  const white = noiseBuffer(ctx, 'white')
  const brown = noiseBuffer(ctx, 'brown')

  const master = gain(ctx, 0)
  const comp = ctx.createDynamicsCompressor()
  comp.threshold.value = -18
  comp.ratio.value = 3
  master.connect(comp).connect(ctx.destination)

  const beds: Record<Bed, GainNode> = {
    wind: gain(ctx, 0),
    water: gain(ctx, 0),
    forest: gain(ctx, 0),
  }
  for (const b of Object.values(beds)) b.connect(master)

  /* wind: brown noise, lowpass with a slow LFO on cutoff + gusting gain */
  {
    const lp = filter(ctx, 'lowpass', 520, 0.9)
    const amp = gain(ctx, 0.62)
    loop(ctx, brown).connect(lp).connect(amp).connect(beds.wind)
    lfo(ctx, 0.071, 300, lp.frequency)
    lfo(ctx, 0.113, 0.22, amp.gain)
    lfo(ctx, 0.029, 0.12, amp.gain)
    // faint airy whistle band
    const bp = filter(ctx, 'bandpass', 950, 4)
    const whistle = gain(ctx, 0.05)
    loop(ctx, white, 1.7).connect(bp).connect(whistle).connect(beds.wind)
    lfo(ctx, 0.053, 260, bp.frequency)
    lfo(ctx, 0.09, 0.035, whistle.gain)
  }

  /* water: bandpassed white noise (falling water) + low rumble */
  {
    const bp = filter(ctx, 'bandpass', 1300, 0.55)
    const splash = gain(ctx, 0.32)
    loop(ctx, white, 0.9).connect(bp).connect(splash).connect(beds.water)
    lfo(ctx, 0.21, 180, bp.frequency)
    lfo(ctx, 0.37, 0.05, splash.gain)
    const hp = filter(ctx, 'highshelf', 4000, 0.7)
    hp.gain.value = -8
    const lp = filter(ctx, 'lowpass', 170, 0.8)
    const rumble = gain(ctx, 0.85)
    loop(ctx, brown, 2.3).connect(lp).connect(hp).connect(rumble).connect(beds.water)
    lfo(ctx, 0.06, 0.12, rumble.gain)
  }

  /* forest: soft bed + cicada tremolo; chirps are scheduled by the mixer into forestOut */
  const forestOut = gain(ctx, 1)
  forestOut.connect(beds.forest)
  {
    const lp = filter(ctx, 'lowpass', 700, 0.7)
    const bed = gain(ctx, 0.22)
    loop(ctx, brown, 3.1).connect(lp).connect(bed).connect(beds.forest)
    lfo(ctx, 0.08, 0.06, bed.gain)
    const leaves = filter(ctx, 'bandpass', 3200, 0.35)
    const rustle = gain(ctx, 0.035)
    loop(ctx, white, 4.2).connect(leaves).connect(rustle).connect(beds.forest)
    lfo(ctx, 0.17, 0.02, rustle.gain)

    // cicada: narrow noise band at ~5 kHz, amplitude-modulated at ~42 Hz, with slow swells
    const cb = filter(ctx, 'bandpass', 5200, 9)
    const trem = gain(ctx, 0.5)
    const swell = gain(ctx, 0.012)
    loop(ctx, white, 5.3).connect(cb).connect(trem).connect(swell).connect(beds.forest)
    lfo(ctx, 42, 0.5, trem.gain) // gain oscillates 0..1 → buzzy tremolo
    lfo(ctx, 0.045, 0.01, swell.gain)
  }

  return { ctx, master, beds, forestOut }
}

/** One bird phrase: 2–5 short sine notes with fast pitch sweeps. */
function chirp(g: Graph): void {
  const { ctx, forestOut } = g
  const pan = ctx.createStereoPanner()
  pan.pan.value = Math.random() * 1.6 - 0.8
  const out = gain(ctx, 0.05 + Math.random() * 0.05)
  out.connect(pan).connect(forestOut)
  const notes = 2 + Math.floor(Math.random() * 4)
  const f0 = 2600 + Math.random() * 1800
  const up = Math.random() < 0.5
  let t = ctx.currentTime + 0.02
  for (let i = 0; i < notes; i++) {
    const dur = 0.05 + Math.random() * 0.08
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    const env = gain(ctx, 0)
    const start = f0 * (1 + (Math.random() - 0.5) * 0.15)
    const end = start * (up ? 1.35 + Math.random() * 0.4 : 0.6 + Math.random() * 0.15)
    osc.frequency.setValueAtTime(start, t)
    osc.frequency.exponentialRampToValueAtTime(end, t + dur)
    env.gain.setValueAtTime(0, t)
    env.gain.linearRampToValueAtTime(1, t + 0.006)
    env.gain.exponentialRampToValueAtTime(0.001, t + dur)
    osc.connect(env).connect(out)
    osc.start(t)
    osc.stop(t + dur + 0.02)
    t += dur + 0.03 + Math.random() * 0.07
  }
  // release the phrase's shared nodes once it is done
  const total = (t - ctx.currentTime + 0.1) * 1000
  window.setTimeout(() => {
    out.disconnect()
    pan.disconnect()
  }, total)
}

/* ------------------------------------------------------------------ mixer */

function setLevel(g: Graph, bed: Bed, v: number): void {
  if (Math.abs(v - lastLevel[bed]) < 0.002) return
  lastLevel[bed] = v
  g.beds[bed].gain.setTargetAtTime(v * AUDIO_MIX[bed], g.ctx.currentTime, AUDIO_MIX.mixTau)
}

function mix(_time: number, deltaMs: number): void {
  const g = graph
  if (!g || g.ctx.state !== 'running') return
  const last = Math.max(0, SCENES.length - 1)
  const p = Math.max(0, Math.min(last, motionState.progress || 0))
  // equal-power weight per scene, power-summed per bed
  const power: Record<Bed, number> = { wind: 0, water: 0, forest: 0 }
  SCENES.forEach((s, i) => {
    const w = Math.cos((Math.min(1, Math.abs(p - i)) * Math.PI) / 2)
    power[s.audio] += w * w
  })
  for (const bed of BEDS) setLevel(g, bed, Math.min(1, Math.sqrt(power[bed])))
  const forest = Math.sqrt(power.forest)

  // birds sing only where the forest is audible
  if (forest > 0.08 && on) {
    chirpClock -= Math.min(0.1, deltaMs / 1000)
    if (chirpClock <= 0) {
      chirp(g)
      const [a, b] = AUDIO_MIX.chirpGap
      chirpClock = (a + Math.random() * (b - a)) / Math.max(0.35, forest)
    }
  }
}

function startMixer(): void {
  if (mixerOn) return
  mixerOn = true
  gsap.ticker.add(mix)
}

function stopMixer(): void {
  if (!mixerOn) return
  mixerOn = false
  gsap.ticker.remove(mix)
}

/* ------------------------------------------------------------------ state */

function setOn(v: boolean): void {
  if (on === v) return
  on = v
  motionState.soundOn = v
  emit('sound')
}

function clearSuspend(): void {
  if (suspendTimer !== null) {
    window.clearTimeout(suspendTimer)
    suspendTimer = null
  }
}

function createContext(): AudioContext | null {
  const Ctor: typeof AudioContext | undefined =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) return null
  try {
    return new Ctor({ latencyHint: 'playback' })
  } catch {
    return null
  }
}

function rampMaster(g: Graph, to: number): void {
  const now = g.ctx.currentTime
  const p = g.master.gain
  p.cancelScheduledValues(now)
  p.setValueAtTime(p.value, now)
  p.linearRampToValueAtTime(to, now + DUR.audioFade)
}

export const audio = {
  /** Must be called from a user gesture (click / key). Never throws. */
  async enable(): Promise<void> {
    if (typeof window === 'undefined' || !isEnabled('audio')) return
    clearSuspend()
    const mySeq = ++seq
    try {
      // Create + resume synchronously inside the gesture (before any await).
      if (!graph) {
        const ctx = createContext()
        if (!ctx) return
        graph = build(ctx)
      }
      const g = graph
      const resumed = g.ctx.state === 'running' ? Promise.resolve() : g.ctx.resume()
      setOn(true)
      // snap bed levels to the current scene before the fade-in
      for (const k of Object.keys(lastLevel) as Bed[]) lastLevel[k] = -1
      startMixer()
      // resume() can stay pending forever outside a user gesture — never hang the caller
      await Promise.race([
        resumed.catch(() => undefined),
        new Promise<void>((r) => window.setTimeout(r, AUDIO_MIX.resumeTimeoutMs)),
      ])
      if (!on || mySeq !== seq) return // disabled / re-enabled while resuming
      if (g.ctx.state !== 'running') {
        // the browser refused to start audio: report "off" honestly
        stopMixer()
        setOn(false)
        return
      }
      mix(0, 16)
      rampMaster(g, AUDIO_MIX.master)
    } catch {
      setOn(false)
    }
  },

  /** Fade out, then suspend the context. */
  disable(): void {
    seq++
    setOn(false)
    const g = graph
    if (!g) return
    clearSuspend()
    try {
      rampMaster(g, 0)
    } catch {
      /* ignore */
    }
    suspendTimer = window.setTimeout(
      () => {
        suspendTimer = null
        if (on) return
        stopMixer()
        g.ctx.suspend().catch(() => undefined)
      },
      DUR.audioFade * 1000 + 80,
    )
  },

  isOn(): boolean {
    return on
  },

  async toggle(): Promise<void> {
    if (on) audio.disable()
    else await audio.enable()
  },
}

/* Suspend while the tab is hidden; resume on return if the user had sound on. */
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    const g = graph
    if (!g) return
    if (document.visibilityState === 'hidden') {
      g.ctx.suspend().catch(() => undefined)
    } else if (on) {
      g.ctx.resume().catch(() => undefined)
    }
  })
}
