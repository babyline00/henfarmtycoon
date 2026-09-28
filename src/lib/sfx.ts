/**
 * Sound effects via Web Audio synthesis.
 *
 * Why synthesis rather than audio files: the game needs ~50 short cues
 * that fire dozens of times a minute. Shipping 50 clips means megabytes
 * of download, decode latency on first play, and licensing to clear if this
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
  // base UI / economy cues
  | 'click' | 'collect' | 'hatch' | 'buy' | 'sell' | 'error'
  | 'reward' | 'levelup' | 'coin' | 'notify' | 'feed' | 'jump'
  | 'crash' | 'win' | 'energy'
  // game-specific: hen breeds (keys mirror HEN_TYPES)
  | 'hen_normal' | 'hen_golden' | 'hen_royal' | 'hen_magic'
  // game-specific: animals (keys mirror ANIMAL_TYPES + dragon reward)
  | 'cow' | 'sheep' | 'duck' | 'dog' | 'cat' | 'horse' | 'dragon'
  // game-specific: egg types (keys mirror EGG_TYPES)
  | 'egg_crack' | 'egg_golden' | 'egg_royal' | 'egg_magic' | 'egg_diamond' | 'egg_mystery'
  // game-specific: inventory items (keys mirror ITEM_TYPES)
  | 'item_medicine' | 'item_vitamin' | 'item_feed' | 'item_growth'
  | 'item_xp' | 'item_charm' | 'item_scarecrow' | 'item_sack'
  // game-specific: farm / social / arcade moments
  | 'build' | 'breed' | 'mission' | 'daily' | 'gift'
  | 'powerup' | 'game_start' | 'game_over' | 'traffic' | 'splash'

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
  // game-specific spam guards: coop taps, arcade loops, traffic ticks
  hen_normal: 120, hen_golden: 120, hen_royal: 150, hen_magic: 150,
  cow: 250, sheep: 250, duck: 200, dog: 180, cat: 220, horse: 250, dragon: 400,
  egg_crack: 120, egg_golden: 150, egg_royal: 150, egg_magic: 150,
  egg_diamond: 200, egg_mystery: 200,
  item_medicine: 150, item_vitamin: 150, item_feed: 120, item_growth: 200,
  item_xp: 150, item_charm: 200, item_scarecrow: 200, item_sack: 150,
  traffic: 200, splash: 200, powerup: 150,
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
  // ── hen breeds: same cluck shape, brighter base per rarity ──
  hen_normal: c => { tone(c, out(c), { freq: 700, dur: 0.07, type: 'square', gain: 0.11 }); tone(c, out(c), { freq: 620, dur: 0.08, type: 'square', gain: 0.1, delay: 0.08 }) },
  hen_golden: c => { tone(c, out(c), { freq: 990, dur: 0.07, type: 'square', gain: 0.1 }); tone(c, out(c), { freq: 1320, dur: 0.1, type: 'triangle', gain: 0.1, delay: 0.07 }) },
  hen_royal:  c => { [523.25, 659.25, 783.99].forEach((f, i) => tone(c, out(c), { freq: f, dur: 0.1, type: 'triangle', gain: 0.14, delay: i * 0.06 })) },
  hen_magic:  c => { tone(c, out(c), { freq: 400, dur: 0.28, type: 'sine', gain: 0.16, slideTo: 1200 }); tone(c, out(c), { freq: 1600, dur: 0.14, type: 'sine', gain: 0.08, delay: 0.2 }) },
  // ── animals: cartoon approximations, one gesture each ──
  cow:   c => { tone(c, out(c), { freq: 150, dur: 0.5, type: 'sawtooth', gain: 0.16, slideTo: 90 }) },
  sheep: c => { tone(c, out(c), { freq: 380, dur: 0.16, type: 'square', gain: 0.11 }); tone(c, out(c), { freq: 360, dur: 0.16, type: 'square', gain: 0.1, delay: 0.14 }) },
  duck:  c => { noise(c, out(c), { dur: 0.05, gain: 0.1, hp: 800 }); tone(c, out(c), { freq: 290, dur: 0.09, type: 'square', gain: 0.13 }); tone(c, out(c), { freq: 270, dur: 0.09, type: 'square', gain: 0.12, delay: 0.1 }) },
  dog:   c => { noise(c, out(c), { dur: 0.06, gain: 0.14, hp: 900 }); tone(c, out(c), { freq: 360, dur: 0.09, type: 'square', gain: 0.14 }); tone(c, out(c), { freq: 340, dur: 0.09, type: 'square', gain: 0.13, delay: 0.11 }) },
  cat:   c => { tone(c, out(c), { freq: 650, dur: 0.25, type: 'sine', gain: 0.15, slideTo: 950 }) },
  horse: c => { tone(c, out(c), { freq: 720, dur: 0.4, type: 'sawtooth', gain: 0.11, slideTo: 300 }); noise(c, out(c), { dur: 0.18, gain: 0.08, hp: 600, delay: 0.05 }) },
  dragon:c => { tone(c, out(c), { freq: 95, dur: 0.5, type: 'sawtooth', gain: 0.2, slideTo: 60 }); noise(c, out(c), { dur: 0.3, gain: 0.1, hp: 200, delay: 0.05 }); tone(c, out(c), { freq: 190, dur: 0.3, type: 'square', gain: 0.08, delay: 0.08 }) },
  // ── eggs: crack first, then a rarity shimmer ──
  egg_crack:  c => { noise(c, out(c), { dur: 0.12, gain: 0.18, hp: 2000 }); tone(c, out(c), { freq: 500, dur: 0.09, type: 'triangle', gain: 0.14, delay: 0.05 }) },
  egg_golden: c => { noise(c, out(c), { dur: 0.1, gain: 0.15, hp: 2200 }); tone(c, out(c), { freq: 880, dur: 0.12, type: 'triangle', gain: 0.15, delay: 0.05 }); tone(c, out(c), { freq: 1174.66, dur: 0.16, type: 'triangle', gain: 0.13, delay: 0.12 }) },
  egg_royal:  c => { noise(c, out(c), { dur: 0.1, gain: 0.15, hp: 2200 }); [523.25, 659.25].forEach((f, i) => tone(c, out(c), { freq: f, dur: 0.14, type: 'triangle', gain: 0.15, delay: 0.05 + i * 0.07 })) },
  egg_magic:  c => { noise(c, out(c), { dur: 0.1, gain: 0.14, hp: 2200 }); tone(c, out(c), { freq: 500, dur: 0.3, type: 'sine', gain: 0.15, slideTo: 1500, delay: 0.05 }) },
  egg_diamond:c => { noise(c, out(c), { dur: 0.08, gain: 0.14, hp: 4000 }); tone(c, out(c), { freq: 1567.98, dur: 0.14, type: 'sine', gain: 0.14, delay: 0.04 }); tone(c, out(c), { freq: 2093, dur: 0.2, type: 'sine', gain: 0.12, delay: 0.12 }) },
  egg_mystery:c => { [392, 523.25, 659.25].forEach((f, i) => tone(c, out(c), { freq: f, dur: 0.12, type: 'triangle', gain: 0.14, delay: i * 0.08 })); tone(c, out(c), { freq: 1760, dur: 0.18, type: 'sine', gain: 0.1, delay: 0.26 }) },
  // ── items: one gesture per tool ──
  item_medicine: c => { noise(c, out(c), { dur: 0.15, gain: 0.12, hp: 3000 }); tone(c, out(c), { freq: 700, dur: 0.08, type: 'sine', gain: 0.1, delay: 0.1 }) },
  item_vitamin:  c => { tone(c, out(c), { freq: 500, dur: 0.08, type: 'triangle', gain: 0.14 }); tone(c, out(c), { freq: 750, dur: 0.1, type: 'triangle', gain: 0.13, delay: 0.07 }) },
  item_feed:     c => { noise(c, out(c), { dur: 0.08, gain: 0.13, hp: 600 }); noise(c, out(c), { dur: 0.08, gain: 0.12, hp: 600, delay: 0.1 }); tone(c, out(c), { freq: 240, dur: 0.1, type: 'triangle', gain: 0.1, delay: 0.05 }) },
  item_growth:   c => { tone(c, out(c), { freq: 200, dur: 0.3, type: 'square', gain: 0.11, slideTo: 800 }) },
  item_xp:       c => { [660, 880, 1108.73, 1318.51].forEach((f, i) => tone(c, out(c), { freq: f, dur: 0.09, type: 'sine', gain: 0.12, delay: i * 0.05 })) },
  item_charm:    c => { tone(c, out(c), { freq: 1318.51, dur: 0.14, type: 'sine', gain: 0.13 }); tone(c, out(c), { freq: 1760, dur: 0.2, type: 'sine', gain: 0.11, delay: 0.1 }) },
  item_scarecrow:c => { tone(c, out(c), { freq: 200, dur: 0.08, type: 'square', gain: 0.14 }); tone(c, out(c), { freq: 180, dur: 0.08, type: 'square', gain: 0.13, delay: 0.1 }); noise(c, out(c), { dur: 0.06, gain: 0.08, hp: 400 }) },
  item_sack:     c => { tone(c, out(c), { freq: 150, dur: 0.14, type: 'sine', gain: 0.16 }); noise(c, out(c), { dur: 0.08, gain: 0.08, hp: 500, delay: 0.03 }) },
  // ── farm / social / arcade moments ──
  build:     c => { noise(c, out(c), { dur: 0.07, gain: 0.15, hp: 700 }); noise(c, out(c), { dur: 0.07, gain: 0.14, hp: 700, delay: 0.12 }); tone(c, out(c), { freq: 523.25, dur: 0.16, type: 'triangle', gain: 0.15, delay: 0.22 }) },
  breed:     c => { tone(c, out(c), { freq: 659.25, dur: 0.14, type: 'sine', gain: 0.14 }); tone(c, out(c), { freq: 880, dur: 0.18, type: 'sine', gain: 0.13, delay: 0.11 }) },
  mission:   c => { [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(c, out(c), { freq: f, dur: 0.13, type: 'triangle', gain: 0.15, delay: i * 0.06 })) },
  daily:     c => { tone(c, out(c), { freq: 587.33, dur: 0.12, type: 'sine', gain: 0.14 }); tone(c, out(c), { freq: 880, dur: 0.18, type: 'sine', gain: 0.13, delay: 0.1 }) },
  gift:      c => { [523.25, 659.25, 783.99].forEach((f, i) => tone(c, out(c), { freq: f, dur: 0.15, type: 'sine', gain: 0.14, delay: i * 0.07 })) },
  powerup:   c => { tone(c, out(c), { freq: 300, dur: 0.22, type: 'square', gain: 0.11, slideTo: 900 }) },
  game_start:c => { tone(c, out(c), { freq: 440, dur: 0.1, type: 'square', gain: 0.12 }); tone(c, out(c), { freq: 440, dur: 0.1, type: 'square', gain: 0.12, delay: 0.12 }); tone(c, out(c), { freq: 880, dur: 0.2, type: 'square', gain: 0.13, delay: 0.24 }) },
  game_over: c => { tone(c, out(c), { freq: 400, dur: 0.2, type: 'triangle', gain: 0.14, slideTo: 200 }) },
  traffic:   c => { tone(c, out(c), { freq: 350, dur: 0.12, type: 'square', gain: 0.1 }); tone(c, out(c), { freq: 330, dur: 0.12, type: 'square', gain: 0.1, delay: 0.13 }) },
  splash:    c => { noise(c, out(c), { dur: 0.18, gain: 0.13, hp: 1000 }); tone(c, out(c), { freq: 500, dur: 0.16, type: 'sine', gain: 0.1, slideTo: 220, delay: 0.04 }) },
}

function out(c: AudioContext): AudioNode {
  // Route to master when it exists, otherwise straight to destination so
  // the tone is still audible during the tiny window before master is set.
  return master ?? c.destination
}

/** True when a cue has a synth voice. Used by tests to prove the
 *  game-sound maps can never reference a missing voice. */
export function hasVoice(name: SoundName): boolean {
  return name in VOICES
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
