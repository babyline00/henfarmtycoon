/**
 * Sound effects via Web Audio synthesis.
 *
 * Why synthesis rather than audio files: the game needs ~14 short cues
 * that fire dozens of times a minute. Shipping 14 clips means a ~300 KB
 * download, decode latency on first play, and licensing to clear if this
 * ever goes commercial. Procedural synthesis costs nothing to download,
 * has no licensing, works offline, and is deterministic per cue.
 *
 * Trade-off, stated plainly: these read as clean cartoon blips, not as a
 * recorded hen clucking. If you want real animal sounds later, swap the
 * voice implementations in `VOICES` for AudioBufferSourceNode — the call
 * sites and the throttle/preference logic do not change.
 *
 * Autoplay policy: browsers block audio until a user gesture, and iOS
 * Safari keeps the context suspended. The context is therefore created
 * lazily on the first `unlock()` call from a real gesture, and every play
 * attempt before that is a silent no-op rather than an exception.
 *
 * This module is deliberately free of React so it can be unit tested and
 * called from anywhere (a route handler, a game loop, a component).
 */

export type SoundName =
  | 'click' | 'collect' | 'hatch' | 'buy' | 'sell' | 'error'
  | 'reward' | 'levelup' | 'coin' | 'notify' | 'feed' | 'jump'
  | 'crash' | 'win' | 'energy'

export interface SoundPrefs {
  enabled: boolean
  volume: number // 0..1
}

const STORAGE_KEY = 'henfarm_sfx'
const DEFAULTS: SoundPrefs = { enabled: true, volume: 0.35 }

// ── preference persistence ────────────────────────────────────
// Probe for the storage capability itself, not for `window`. Testing
// `typeof window` conflates "is a browser" with "is storage available":
// it disabled persistence in web workers and made the module untestable
// outside a DOM, even though localStorage is the only thing we need.
function hasStorage(): boolean {
  try {
    return typeof localStorage !== 'undefined' && localStorage !== null
  } catch {
    // Accessing localStorage can throw outright in some privacy modes.
    return false
  }
}

export function loadPrefs(): SoundPrefs {
  if (!hasStorage()) return { ...DEFAULTS }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULTS }
    const parsed = JSON.parse(raw) as Partial<SoundPrefs>
    return {
      enabled: typeof parsed.enabled === 'boolean' ? parsed.enabled : DEFAULTS.enabled,
      volume: clampVolume(typeof parsed.volume === 'number' ? parsed.volume : DEFAULTS.volume),
    }
  } catch {
    // Corrupt preference must never break the game.
    return { ...DEFAULTS }
  }
}

export function savePrefs(p: SoundPrefs): void {
  if (!hasStorage()) return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      enabled: p.enabled,
      volume: clampVolume(p.volume),
    }))
  } catch { /* private mode / quota — non-fatal */ }
}

export function clampVolume(v: number): number {
  if (!Number.isFinite(v)) return DEFAULTS.volume
  return Math.min(1, Math.max(0, v))
}

// ── throttle (pure, unit tested) ──────────────────────────────
// A player tapping Collect 10x/second must not produce a buzzsaw of
// overlapping blips. One cue may retrigger at most once per `gapMs`.
export interface ThrottleState { last: Record<string, number> }

export function createThrottle(): ThrottleState {
  return { last: {} }
}

export function shouldPlay(
  t: ThrottleState, name: SoundName, now: number, gapMs: number,
): boolean {
  const prev = t.last[name]
  if (prev !== undefined && now - prev < gapMs) return false
  t.last[name] = now
  return true
}

const GAP_MS: Partial<Record<SoundName, number>> = {
  collect: 90,   // spamming the collect button
  click: 60,
  coin: 80,
  feed: 90,
  jump: 60,
}

// ── engine ────────────────────────────────────────────────────

type Ctx = AudioContext & { webkitAudioContext?: never }

let ctx: AudioContext | null = null
let master: GainNode | null = null
let throttle = createThrottle()
let prefs: SoundPrefs = DEFAULTS
let hydrated = false

function ensurePrefs(): SoundPrefs {
  if (!hydrated) {
    prefs = loadPrefs()
    hydrated = true
  }
  return prefs
}

function getCtx(): AudioContext | null {
  if (ctx) return ctx
  if (typeof window === 'undefined') return null
  const AC: typeof AudioContext | undefined =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AC) return null
  try {
    ctx = new AC()
    master = ctx.createGain()
    master.gain.value = ensurePrefs().volume
    master.connect(ctx.destination)
    return ctx
  } catch {
    ctx = null
    return null
  }
}

/**
 * Must be called from a real user gesture (click/tap/keydown) to satisfy
 * browser autoplay policy. Safe to call repeatedly.
 */
export function unlockAudio(): void {
  const c = getCtx()
  if (c && c.state === 'suspended') void c.resume().catch(() => { /* ignore */ })
}

export function setSoundEnabled(on: boolean): void {
  ensurePrefs()
  prefs = { ...prefs, enabled: on }
  savePrefs(prefs)
  if (on) unlockAudio()
}

export function setVolume(v: number): void {
  ensurePrefs()
  prefs = { ...prefs, volume: clampVolume(v) }
  savePrefs(prefs)
  if (master) master.gain.value = prefs.volume
}

export function getSoundEnabled(): boolean {
  return ensurePrefs().enabled
}

export function getVolume(): number {
  return ensurePrefs().volume
}

/** One shaped oscillator note. */
function tone(
  c: AudioContext, out: AudioNode,
  opts: { freq: number; dur: number; type?: OscillatorType; gain?: number; delay?: number; slideTo?: number },
): void {
  const t0 = c.currentTime + (opts.delay ?? 0)
  const osc = c.createOscillator()
  const env = c.createGain()
  osc.type = opts.type ?? 'sine'
  osc.frequency.setValueAtTime(opts.freq, t0)
  if (opts.slideTo) {
    // exponentialRamp cannot pass 0
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, opts.slideTo), t0 + opts.dur)
  }
  const peak = opts.gain ?? 0.25
  // fast attack, exponential decay — a plain linear ramp clicks at the tail
  env.gain.setValueAtTime(0.0001, t0)
  env.gain.exponentialRampToValueAtTime(peak, t0 + 0.012)
  env.gain.exponentialRampToValueAtTime(0.0001, t0 + opts.dur)
  osc.connect(env)
  env.connect(out)
  osc.start(t0)
  osc.stop(t0 + opts.dur + 0.02)
}

/** Short filtered noise burst — used for percussive cues. */
function noise(c: AudioContext, out: AudioNode, opts: { dur: number; gain?: number; delay?: number; hp?: number }): void {
  const t0 = c.currentTime + (opts.delay ?? 0)
  const frames = Math.max(1, Math.floor(c.sampleRate * opts.dur))
  const buf = c.createBuffer(1, frames, c.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < frames; i++) {
    // decay the noise so it reads as a hit, not a hiss
    data[i] = (Math.random() * 2 - 1) * (1 - i / frames)
  }
  const src = c.createBufferSource()
  src.buffer = buf
  const filter = c.createBiquadFilter()
  filter.type = 'highpass'
  filter.frequency.value = opts.hp ?? 1200
  const env = c.createGain()
  env.gain.setValueAtTime(opts.gain ?? 0.18, t0)
  env.gain.exponentialRampToValueAtTime(0.0001, t0 + opts.dur)
  src.connect(filter)
  filter.connect(env)
  env.connect(out)
  src.start(t0)
  src.stop(t0 + opts.dur + 0.02)
}

// ── the voices ────────────────────────────────────────────────
// Swap these bodies for AudioBufferSourceNode to move to real samples.
const VOICES: Record<SoundName, (c: AudioContext, out: AudioNode) => void> = {
  click:    c => tone(c, out(c), { freq: 880, dur: 0.06, type: 'triangle', gain: 0.12 }),
  collect:  c => { noise(c, out(c), { dur: 0.07, gain: 0.14 }); tone(c, out(c), { freq: 520, dur: 0.1, type: 'triangle', gain: 0.16, delay: 0.04 }) },
  hatch:    c => { [0, 4, 7, 12].forEach((semi, i) => tone(c, out(c), { freq: 440 * Math.pow(2, semi / 12), dur: 0.16, type: 'sine', gain: 0.2, delay: i * 0.07 })) },
  buy:      c => { tone(c, out(c), { freq: 660, dur: 0.08, type: 'square', gain: 0.1 }); tone(c, out(c), { freq: 990, dur: 0.1, type: 'square', gain: 0.08, delay: 0.06 }) },
  sell:     c => { tone(c, out(c), { freq: 700, dur: 0.1, type: 'triangle', gain: 0.14, slideTo: 420 }) },
  error:    c => { tone(c, out(c), { freq: 220, dur: 0.16, type: 'sawtooth', gain: 0.12 }); tone(c, out(c), { freq: 180, dur: 0.18, type: 'sawtooth', gain: 0.1, delay: 0.1 }) },
  reward:   c => { [0, 5, 9, 14].forEach((semi, i) => tone(c, out(c), { freq: 523.25 * Math.pow(2, semi / 12), dur: 0.18, type: 'triangle', gain: 0.18, delay: i * 0.06 })) },
  levelup:  c => { [0, 7, 12, 16, 19, 24].forEach((semi, i) => tone(c, out(c), { freq: 392 * Math.pow(2, semi / 12), dur: 0.22, type: 'sine', gain: 0.2, delay: i * 0.075 })) },
  coin:     c => { tone(c, out(c), { freq: 1180, dur: 0.07, type: 'square', gain: 0.1 }); tone(c, out(c), { freq: 1560, dur: 0.11, type: 'square', gain: 0.08, delay: 0.05 }) },
  notify:   c => { tone(c, out(c), { freq: 740, dur: 0.1, type: 'sine', gain: 0.14 }); tone(c, out(c), { freq: 988, dur: 0.14, type: 'sine', gain: 0.12, delay: 0.1 }) },
  feed:     c => { noise(c, out(c), { dur: 0.1, gain: 0.13, hp: 700 }); tone(c, out(c), { freq: 300, dur: 0.09, type: 'triangle', gain: 0.1, delay: 0.05 }) },
  jump:     c => tone(c, out(c), { freq: 420, dur: 0.12, type: 'square', gain: 0.12, slideTo: 820 }),
  crash:    c => { noise(c, out(c), { dur: 0.22, gain: 0.2, hp: 500 }); tone(c, out(c), { freq: 160, dur: 0.24, type: 'sawtooth', gain: 0.12, slideTo: 70 }) },
  win:      c => { [0, 4, 7, 12, 16, 19, 24].forEach((semi, i) => tone(c, out(c), { freq: 523.25 * Math.pow(2, semi / 12), dur: 0.26, type: 'triangle', gain: 0.2, delay: i * 0.08 })) },
  energy:   c => { tone(c, out(c), { freq: 300, dur: 0.1, type: 'sine', gain: 0.12, slideTo: 620 }) },
}

function out(c: AudioContext): AudioNode {
  // Route to master when it exists, otherwise straight to destination so
  // the tone is still audible during the tiny window before master is set.
  return master ?? c.destination
}

/** Play a cue. Never throws, never blocks, safe to call on every action. */
export function play(name: SoundName, now = Date.now()): void {
  const p = ensurePrefs()
  if (!p.enabled || p.volume === 0) return
  if (!shouldPlay(throttle, name, now, GAP_MS[name] ?? 0)) return
  const c = getCtx()
  if (!c) return
  // Autoplay suspended: drop the cue rather than queueing a burst that
  // all fires at once the moment audio unlocks.
  if (c.state !== 'running') return
  try {
    VOICES[name](c, out(c))
  } catch {
    /* audio must never break gameplay */
  }
}

/** Test seam. */
export function _resetThrottle(): void {
  throttle = createThrottle()
}
