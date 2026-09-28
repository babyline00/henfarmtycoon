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

import { voiceSlot, hasRecording, hotSlots, allSlots } from './voice-files'

export type SoundName =
  // base UI / economy cues
  | 'click' | 'collect' | 'hatch' | 'buy' | 'sell' | 'error'
  | 'reward' | 'levelup' | 'coin' | 'notify' | 'feed' | 'jump'
  | 'crash' | 'win' | 'energy'
  // game-specific: hen breeds (keys mirror HEN_TYPES)
  | 'hen_normal' | 'hen_golden' | 'hen_royal' | 'hen_magic'
  // game-specific: animals (keys mirror ANIMAL_TYPES + dragon reward)
  // Each species has more than one vocalisation — a cow that can only moo
  // reads as a bleep, so the extra cues are what make it read as livestock.
  | 'cow' | 'cow_low' | 'cow_moo_barn' | 'cow_moo_many'
  | 'sheep' | 'sheep_bleat' | 'duck' | 'duck_whistle'
  | 'dog' | 'dog_growl' | 'dog_whine' | 'cat' | 'cat_purr' | 'cat_meow_cartoon'
  | 'horse' | 'horse_whinny' | 'horse_snort'
  | 'dragon' | 'dragon_growl' | 'dragon_roar_echo' | 'dragon_fire'
  // ambience: the farm should sound alive between taps
  | 'bird' | 'rooster' | 'rooster_short' | 'cricket' | 'wind' | 'water'
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
  cow: 250, cow_low: 300, sheep: 250, sheep_bleat: 250,
  duck: 200, duck_whistle: 250, dog: 180, dog_growl: 300, dog_whine: 300,
  cat: 220, cat_purr: 300, horse: 250, horse_whinny: 300,
  dragon: 400, dragon_growl: 450,
  // ambience fires on a timer; these gaps stop a burst overlapping itself
  bird: 400, rooster: 600, cricket: 900, wind: 1200, water: 1200,
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

/** Notified whenever the preferences change, so a React control bound to
 *  them stays in sync. See useSyncExternalStore in audio-settings.tsx. */
const listeners = new Set<() => void>()

function notify(): void {
  for (const l of listeners) { try { l() } catch { /* a bad subscriber must not break audio */ } }
}

/** Subscribe to preference changes. Returns an unsubscribe function. */
export function subscribeSoundPrefs(cb: () => void): () => void {
  listeners.add(cb)
  return () => { listeners.delete(cb) }
}

/** Stable snapshot object for useSyncExternalStore. */
export function getSoundPrefsSnapshot(): SoundPrefs {
  ensurePrefs()
  return prefs
}

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
  // Start fetching the recorded voices now that a real gesture has
  // happened. Doing this on the first play instead would put a
  // fetch-and-decode between the tap and the sound.
  if (c) prefetch(c)
}

export function setSoundEnabled(on: boolean): void {
  ensurePrefs()
  prefs = { ...prefs, enabled: on }
  savePrefs(prefs)
  if (on) unlockAudio()
  notify()
}

export function setVolume(v: number): void {
  ensurePrefs()
  prefs = { ...prefs, volume: clampVolume(v) }
  savePrefs(prefs)
  if (master) master.gain.value = prefs.volume
  notify()
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

// ── animal vocal synthesis ────────────────────────────────────
// A raw oscillator at an animal's pitch does not read as that animal; what
// makes a moo a moo is (a) a slow pitch *envelope* rather than a fixed
// pitch, (b) a resonant formant around the vocal-tract frequency, and
// (c) breath noise mixed under the tone. These three helpers are what let
// the voices below be recognisable rather than decorative.

/** Multi-point pitch envelope. Each entry is [timeFraction, semitones]. */
type PitchCurve = [number, number][]

/**
 * A pitched vocalisation: oscillator + amplitude envelope + optional pitch
 * curve, vibrato, growl modulation and a formant filter.
 */
function vocal(
  c: AudioContext, out: AudioNode,
  opts: {
    dur: number
    base: number
    type?: OscillatorType
    gain?: number
    delay?: number
    curve?: PitchCurve
    /** vibrato depth in semitones and rate in Hz */
    vibrato?: [number, number]
    /** growl: low-frequency amplitude/roughness modulation */
    growl?: [number, number]
    /** resonant peak in Hz and its Q */
    formant?: [number, number]
    /** filtered noise mixed in, as [amount, cutoffHz] */
    breath?: [number, number]
  },
): void {
  const t0 = c.currentTime + (opts.delay ?? 0)
  const dur = opts.dur
  const gain = opts.gain ?? 0.16

  const amp = c.createGain()
  amp.gain.setValueAtTime(0.0001, t0)
  amp.gain.exponentialRampToValueAtTime(gain, t0 + Math.min(0.06, dur * 0.2))
  amp.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)

  let chain: AudioNode = amp

  if (opts.formant) {
    const bp = c.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = opts.formant[0]
    bp.Q.value = opts.formant[1]
    amp.connect(bp)
    chain = bp
  }

  const osc = c.createOscillator()
  osc.type = opts.type ?? 'sawtooth'
  const hzAt = (f: number) => opts.base * Math.pow(2, f / 12)
  osc.frequency.setValueAtTime(hzAt(opts.curve?.[0][1] ?? 0), t0)
  for (const [frac, semi] of opts.curve ?? []) {
    // skip the first point: setValueAtTime already placed it
    if (frac === 0) continue
    osc.frequency.linearRampToValueAtTime(hzAt(semi), t0 + dur * frac)
  }
  osc.connect(amp)
  osc.start(t0)
  osc.stop(t0 + dur + 0.03)

  // breath: a band of noise shaped by the same amplitude envelope, which is
  // what gives a bark or a bellow its "air"
  if (opts.breath) {
    const frames = Math.max(1, Math.floor(c.sampleRate * dur))
    const buf = c.createBuffer(1, frames, c.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < frames; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / frames)
    const src = c.createBufferSource()
    src.buffer = buf
    const hp = c.createBiquadFilter()
    hp.type = 'bandpass'
    hp.frequency.value = opts.breath[1]
    hp.Q.value = 0.8
    const bg = c.createGain()
    bg.gain.value = opts.breath[0]
    src.connect(hp); hp.connect(bg); bg.connect(amp)
    src.start(t0); src.stop(t0 + dur + 0.02)
  }

  // growl: an LFO on the oscillator detune gives the roughness of a
  // machine that is not a pure tone
  if (opts.growl) {
    const lfo = c.createOscillator()
    const lfoGain = c.createGain()
    lfo.frequency.value = opts.growl[0]
    lfoGain.gain.value = opts.growl[1]
    lfo.connect(lfoGain)
    lfoGain.connect(osc.detune)
    lfo.start(t0); lfo.stop(t0 + dur + 0.03)
  }

  // vibrato: slow pitch wobble, the difference between a "flat beep" and
  // something alive
  if (opts.vibrato) {
    const lfo = c.createOscillator()
    const lfoGain = c.createGain()
    lfo.frequency.value = opts.vibrato[1]
    lfoGain.gain.value = opts.vibrato[0] * 100 // detune is in cents
    lfo.connect(lfoGain)
    lfoGain.connect(osc.detune)
    lfo.start(t0); lfo.stop(t0 + dur + 0.03)
  }

  chain.connect(out)
}

/** A short burst of band-passed noise — chirps, splashes, wing beats. */
function chirp(
  c: AudioContext, out: AudioNode,
  opts: { from: number; to: number; dur: number; gain?: number; delay?: number; q?: number },
): void {
  const t0 = c.currentTime + (opts.delay ?? 0)
  const frames = Math.max(1, Math.floor(c.sampleRate * opts.dur))
  const buf = c.createBuffer(1, frames, c.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < frames; i++) {
    // taper the noise so a sweep reads as a chirp, not a click
    d[i] = (Math.random() * 2 - 1) * Math.sin((Math.PI * i) / frames)
  }
  const src = c.createBufferSource()
  src.buffer = buf
  const bp = c.createBiquadFilter()
  bp.type = 'bandpass'
  bp.Q.value = opts.q ?? 6
  bp.frequency.setValueAtTime(opts.from, t0)
  bp.frequency.exponentialRampToValueAtTime(Math.max(40, opts.to), t0 + opts.dur)
  const amp = c.createGain()
  amp.gain.setValueAtTime(0.0001, t0)
  amp.gain.exponentialRampToValueAtTime(opts.gain ?? 0.1, t0 + opts.dur * 0.25)
  amp.gain.exponentialRampToValueAtTime(0.0001, t0 + opts.dur)
  src.connect(bp); bp.connect(amp); amp.connect(out)
  src.start(t0); src.stop(t0 + opts.dur + 0.02)
}

/** Repeating amplitude pulse train — purring, buzzing, insects. */
function trill(
  c: AudioContext, out: AudioNode,
  opts: { freq: number; rate: number; dur: number; gain?: number; depth?: number; type?: OscillatorType; delay?: number },
): void {
  const t0 = c.currentTime + (opts.delay ?? 0)
  const o = c.createOscillator()
  o.type = opts.type ?? 'triangle'
  o.frequency.value = opts.freq
  const amp = c.createGain()
  const peak = opts.gain ?? 0.09
  amp.gain.setValueAtTime(0.0001, t0)
  // pulse the amplitude at `rate` — this is the purr/buzz itself
  const steps = Math.max(2, Math.round(opts.dur * opts.rate * 2))
  for (let i = 0; i <= steps; i++) {
    const at = t0 + (i / (opts.rate * 2))
    if (at > t0 + opts.dur) break
    amp.gain.exponentialRampToValueAtTime(i % 2 === 0 ? peak : peak * (opts.depth ?? 0.35), at)
  }
  amp.gain.exponentialRampToValueAtTime(0.0001, t0 + opts.dur)
  o.connect(amp); amp.connect(out)
  o.start(t0); o.stop(t0 + opts.dur + 0.03)
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
  // ── animals: two real vocalisations per species ──
  // cow — a long low moo that dips in the middle, with breath under it
  cow: c => vocal(c, out(c), {
    dur: 0.62, base: 132, type: 'sawtooth', gain: 0.17,
    curve: [[0, 0], [0.22, 2], [0.55, -4], [0.85, -6], [1, -3]],
    vibrato: [0.5, 5], formant: [720, 4], breath: [0.1, 900],
  }),
  // cow_low — the deeper bellow, slower and rougher
  cow_low: c => vocal(c, out(c), {
    dur: 0.95, base: 88, type: 'sawtooth', gain: 0.19,
    curve: [[0, 0], [0.3, 3], [0.7, -5], [1, -2]],
    growl: [22, 90], formant: [560, 5], breath: [0.12, 700],
  }),
  // sheep — baa: nasal, mid-register, vibrato carries the character
  sheep: c => vocal(c, out(c), {
    dur: 0.42, base: 310, type: 'square', gain: 0.13,
    curve: [[0, 0], [0.3, 1.5], [1, -1]],
    vibrato: [1.2, 11], formant: [1500, 7],
  }),
  // sheep_bleat — the short, rising, complaining bleat
  sheep_bleat: c => vocal(c, out(c), {
    dur: 0.26, base: 380, type: 'square', gain: 0.11,
    curve: [[0, 0], [0.5, 3], [1, 5]],
    vibrato: [1.6, 14], formant: [1700, 8],
  }),
  // duck — quack: a harsh buzz with the nasal wobble of a bill
  duck: c => {
    vocal(c, out(c), {
      dur: 0.15, base: 300, type: 'sawtooth', gain: 0.13,
      curve: [[0, 0], [0.4, -1], [1, -2]],
      formant: [900, 3], breath: [0.14, 1200],
    })
    vocal(c, out(c), {
      dur: 0.13, base: 275, type: 'sawtooth', gain: 0.12,
      curve: [[0, 0], [1, -2]], formant: [820, 3], delay: 0.17,
    })
  },
  // duck_whistle — the trailing rising "whrrk"
  duck_whistle: c => vocal(c, out(c), {
    dur: 0.3, base: 420, type: 'sine', gain: 0.11,
    curve: [[0, 0], [0.6, 6], [1, 2]],
    vibrato: [0.8, 16], breath: [0.06, 2000],
  }),
  // dog — bark: hard attack, a growl underneath, then a second pop
  dog: c => {
    vocal(c, out(c), {
      dur: 0.13, base: 300, type: 'sawtooth', gain: 0.16,
      curve: [[0, 0], [0.5, -3], [1, -5]],
      growl: [40, 60], formant: [1100, 3], breath: [0.16, 1500],
    })
    vocal(c, out(c), {
      dur: 0.1, base: 270, type: 'sawtooth', gain: 0.13,
      curve: [[0, 0], [1, -4]], breath: [0.12, 1300], delay: 0.17,
    })
  },
  // dog_growl — a low continuous rumble, for a guard dog on a border
  dog_growl: c => vocal(c, out(c), {
    dur: 0.75, base: 95, type: 'sawtooth', gain: 0.15,
    curve: [[0, 0], [0.5, 1], [1, 0]],
    growl: [26, 130], formant: [420, 6], breath: [0.08, 500],
  }),
  // dog_whine — the sad, rising whimper
  dog_whine: c => vocal(c, out(c), {
    dur: 0.44, base: 520, type: 'triangle', gain: 0.11,
    curve: [[0, 0], [0.55, 5], [1, 3]],
    vibrato: [1.1, 9], formant: [1300, 6],
  }),
  // cat — meow: the classic up-then-down contour is the whole identity
  cat: c => vocal(c, out(c), {
    dur: 0.5, base: 560, type: 'sawtooth', gain: 0.14,
    curve: [[0, 0], [0.28, 5], [0.62, 4], [1, -4]],
    vibrato: [0.7, 6], formant: [1000, 5], breath: [0.05, 1800],
  }),
  // cat_purr — a 25Hz amplitude trill with a low tone under it
  cat_purr: c => {
    trill(c, out(c), { freq: 105, rate: 25, dur: 1.0, gain: 0.1, depth: 0.3 })
    trill(c, out(c), { freq: 210, rate: 25, dur: 1.0, gain: 0.04, depth: 0.5, delay: 0.02 })
  },
  // horse — neigh: a big inhale then a long falling cry
  horse: c => {
    noise(c, out(c), { dur: 0.14, gain: 0.09, hp: 1400 })
    vocal(c, out(c), {
      dur: 0.7, base: 380, type: 'sawtooth', gain: 0.15,
      curve: [[0, 0], [0.18, 9], [0.6, 2], [1, -8]],
      vibrato: [0.9, 11], formant: [1100, 3], breath: [0.07, 2000], delay: 0.1,
    })
  },
  // horse_whinny — shorter, higher, a snort
  horse_whinny: c => {
    noise(c, out(c), { dur: 0.1, gain: 0.1, hp: 2200 })
    vocal(c, out(c), {
      dur: 0.34, base: 520, type: 'sawtooth', gain: 0.13,
      curve: [[0, 0], [0.3, 6], [1, -4]],
      vibrato: [1.3, 15], formant: [1400, 4], breath: [0.1, 2400], delay: 0.07,
    })
  },
  // dragon — roar: very low, heavy, with the classic growl jitter
  dragon: c => {
    vocal(c, out(c), {
      dur: 1.0, base: 70, type: 'sawtooth', gain: 0.2,
      curve: [[0, 0], [0.25, 5], [0.7, -2], [1, -5]],
      growl: [18, 150], formant: [380, 7], breath: [0.14, 600],
    })
    tone(c, out(c), { freq: 190, dur: 0.5, type: 'square', gain: 0.07, delay: 0.06 })
  },
  // dragon_growl — a low continuous threat, for the mutation moment
  dragon_growl: c => vocal(c, out(c), {
    dur: 1.3, base: 58, type: 'sawtooth', gain: 0.16,
    curve: [[0, 0], [0.5, 2], [1, 0]],
    growl: [14, 200], formant: [300, 8], breath: [0.1, 400],
  }),
  // ── extra calls that have recordings ──
  // These exist so a farm with two cows does not moo identically twice.
  // Each has a recording, and a synth voice underneath it, so a missing or
  // undecodable file degrades to something in-character rather than silence.
  cow_moo_barn: c => vocal(c, out(c), {
    dur: 0.7, base: 118, type: 'sawtooth', gain: 0.15,
    curve: [[0, 0], [0.25, 2], [0.6, -5], [1, -2]],
    vibrato: [0.4, 4], formant: [660, 4], breath: [0.1, 800],
  }),
  cow_moo_many: c => {
    vocal(c, out(c), { dur: 0.5, base: 128, type: 'sawtooth', gain: 0.13, curve: [[0, 0], [0.5, -3], [1, 0]], formant: [700, 4] })
    vocal(c, out(c), { dur: 0.45, base: 142, type: 'sawtooth', gain: 0.11, curve: [[0, 0], [0.5, 2], [1, -2]], formant: [760, 4], delay: 0.34 })
    vocal(c, out(c), { dur: 0.55, base: 112, type: 'sawtooth', gain: 0.1, curve: [[0, 0], [0.6, -4], [1, -1]], formant: [640, 4], delay: 0.72 })
  },
  cat_meow_cartoon: c => vocal(c, out(c), {
    dur: 0.34, base: 700, type: 'square', gain: 0.12,
    curve: [[0, 0], [0.3, 6], [0.7, 3], [1, -3]],
    vibrato: [1.4, 18], formant: [1600, 6],
  }),
  horse_snort: c => {
    noise(c, out(c), { dur: 0.22, gain: 0.13, hp: 900 })
    vocal(c, out(c), {
      dur: 0.2, base: 240, type: 'sawtooth', gain: 0.12,
      curve: [[0, 0], [0.4, -4], [1, -7]],
      breath: [0.14, 1200], delay: 0.04,
    })
  },
  dragon_roar_echo: c => {
    vocal(c, out(c), {
      dur: 1.1, base: 76, type: 'sawtooth', gain: 0.17,
      curve: [[0, 0], [0.2, 4], [0.6, -2], [1, -4]],
      growl: [16, 170], formant: [400, 7], breath: [0.12, 500],
    })
    // a second, quieter pass reads as the echo
    vocal(c, out(c), {
      dur: 0.9, base: 72, type: 'sawtooth', gain: 0.09,
      curve: [[0, 0], [0.7, -3], [1, -5]],
      growl: [15, 150], formant: [360, 7], delay: 0.32,
    })
  },
  dragon_fire: c => {
    noise(c, out(c), { dur: 0.7, gain: 0.14, hp: 700 })
    vocal(c, out(c), {
      dur: 0.6, base: 120, type: 'sawtooth', gain: 0.13,
      curve: [[0, 0], [0.3, 3], [1, -6]],
      growl: [20, 120], formant: [900, 4], breath: [0.16, 1800],
    })
  },
  rooster_short: c => vocal(c, out(c), {
    dur: 0.3, base: 340, type: 'sawtooth', gain: 0.12,
    curve: [[0, 0], [0.4, 6], [0.75, 3], [1, -6]],
    growl: [32, 80], formant: [1100, 4], breath: [0.1, 1500],
  }),
  // ── ambience ──
  // bird: two rising chirps
  bird: c => {
    chirp(c, out(c), { from: 2200, to: 3600, dur: 0.09, gain: 0.07 })
    chirp(c, out(c), { from: 2600, to: 4200, dur: 0.1, gain: 0.06, delay: 0.15 })
  },
  // rooster: the dawn crow, three rising parts
  rooster: c => {
    vocal(c, out(c), {
      dur: 0.34, base: 300, type: 'sawtooth', gain: 0.13,
      curve: [[0, 0], [0.4, 7], [0.7, 4], [1, -6]],
      growl: [30, 70], formant: [1000, 4], breath: [0.1, 1500],
    })
    vocal(c, out(c), {
      dur: 0.28, base: 330, type: 'sawtooth', gain: 0.1,
      curve: [[0, 0], [0.5, 5], [1, -5]],
      formant: [1100, 4], breath: [0.08, 1400], delay: 0.42,
    })
  },
  // cricket: a short high chirp, repeated
  cricket: c => {
    for (let i = 0; i < 3; i++) {
      chirp(c, out(c), { from: 4200, to: 4600, dur: 0.035, gain: 0.05, delay: i * 0.07, q: 12 })
    }
  },
  // wind: filtered noise swell
  wind: c => noise(c, out(c), { dur: 1.6, gain: 0.05, hp: 400 }),
  // water: a trickle
  water: c => {
    chirp(c, out(c), { from: 900, to: 2000, dur: 0.3, gain: 0.05, q: 2 })
    chirp(c, out(c), { from: 1200, to: 800, dur: 0.25, gain: 0.04, delay: 0.34, q: 2 })
  },
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

// ── recorded voices ───────────────────────────────────────────
// Animal calls are real recordings; everything else is synthesised. See
// ./voice-files for the map and the reason. This section is the loader:
// fetch, decode, cache, play, and fall back to the synth voice on any
// failure. The rule is that audio must never break gameplay and must
// never leave a cue silent — so a missing file, a decode error or an
// offline client all end at the same place, the synth voice.

const buffers = new Map<SoundName, AudioBuffer>()
/** Slots that failed to load; never retried, so a 404 costs one request. */
const dead = new Set<string>()
const loading = new Set<string>()

/** Prefetch only matters once audio is actually allowed to run. */
function fetchAndDecode(name: SoundName, c: AudioContext): void {
  const slot = voiceSlot(name)
  if (!slot || dead.has(name) || loading.has(name) || buffers.has(name)) return
  loading.add(name)
  void (async () => {
    try {
      const res = await fetch(slot.path)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const raw = await res.arrayBuffer()
      // decodeAudioData detaches the buffer, so hand it a copy we own.
      const decoded = await c.decodeAudioData(raw.slice(0))
      buffers.set(name, decoded)
    } catch {
      // Offline, 404, or an unsupported codec. Synth covers it from here on.
      dead.add(name)
    } finally {
      loading.delete(name)
    }
  })()
}

/** Warm the hot set now, the rest when the browser is idle. */
function prefetch(c: AudioContext): void {
  if (typeof fetch !== 'function') return
  for (const name of hotSlots()) fetchAndDecode(name as SoundName, c)
  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(() => {
      for (const name of allSlots()) fetchAndDecode(name as SoundName, c)
    }, { timeout: 5000 })
  } else {
    // No requestIdleCallback (Safari before 17): a timeout is worse but fine.
    setTimeout(() => {
      for (const name of allSlots()) fetchAndDecode(name as SoundName, c)
    }, 1500)
  }
}

/** True when a decoded recording is ready to play. */
export function isVoiceLoaded(name: SoundName): boolean {
  return buffers.has(name)
}

/** Diagnostics for the settings screen and for tests. */
export function voiceStats(): { loaded: number; failed: number; total: number } {
  return { loaded: buffers.size, failed: dead.size, total: allSlots().length }
}

/** Play a decoded recording, trimmed to the slot's cap. */
function playBuffer(c: AudioContext, name: SoundName, buf: AudioBuffer): void {
  const slot = voiceSlot(name)
  const dur = Math.min(buf.duration, slot?.maxSec ?? 2)
  // Start a touch in only if the clip is much longer than the cap, so a
  // long ambience recording plays from a more interesting point.
  const offset = buf.duration > dur * 2 ? Math.min(1, (buf.duration - dur) * 0.25) : 0

  const src = c.createBufferSource()
  src.buffer = buf
  const g = c.createGain()
  const peak = slot?.gain ?? 0.8
  const t0 = c.currentTime
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(peak, t0 + 0.008)
  if (buf.duration > dur) {
    // Truncated: fade rather than cut, or it clicks.
    const fadeStart = Math.max(0.01, dur - Math.min(0.25, dur * 0.2))
    g.gain.setValueAtTime(peak, t0 + fadeStart)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  } else {
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  }
  src.connect(g)
  g.connect(out(c))
  src.start(t0, offset, dur)
  src.stop(t0 + dur + 0.02)
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
    const buf = buffers.get(name)
    if (buf) {
      playBuffer(c, name, buf)
      return
    }
    // No recording ready. If one exists, start fetching it — and play the
    // synth voice now rather than a gap, so a tap is never silent.
    if (hasRecording(name)) fetchAndDecode(name, c)
    VOICES[name](c, out(c))
  } catch {
    /* audio must never break gameplay */
  }
}

/** Test seam. */
export function _resetThrottle(): void {
  throttle = createThrottle()
}
