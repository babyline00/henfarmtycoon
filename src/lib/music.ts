/**
 * Background music via Web Audio synthesis.
 *
 * Same constraint as ./sfx: no audio files. A farm game wants music that
 * never repeats exactly, costs nothing to download, works offline, and has
 * no licensing. So the music is *generated*: a lookahead sequencer walks a
 * chord progression and spawns short synthesised voices.
 *
 * ── Why a lookahead scheduler instead of setTimeout per note ──
 * `setTimeout(fn, 1000)` drifts, and a drifting rhythm is the single most
 * audible way to make generated music sound cheap. Instead one 25ms timer
 * runs and schedules every note that falls inside the next 120ms window
 * ("A Tale of Two Clocks", Chris Wilson). Timing then comes from the
 * AudioContext clock, which is sample-accurate, and a late JS tick delays
 * scheduling rather than the beat.
 *
 * ── Bus layout ──
 *   voices ──▶ musicBus ──▶ master ──▶ destination
 * The music has its own gain stage so the player can mute the soundtrack
 * without losing click feedback, and vice versa. `duck()` pulls the bus
 * down briefly when a reward fanfare plays, so a hatch is not buried.
 *
 * Everything degrades to a silent no-op with no AudioContext, so this is
 * safe to import from a server component or a test runner.
 */

/** Musical moods, one per screen. */
export type MusicMood =
  | 'farm'
  | 'night'
  | 'shop'
  | 'market'
  | 'social'
  | 'arcade'
  | 'calm'

export const MUSIC_MOODS: MusicMood[] = ['farm', 'night', 'shop', 'market', 'social', 'arcade', 'calm']

export interface MusicPrefs {
  enabled: boolean
  volume: number // 0..1, deliberately low — music is a bed, not a focus
}

const STORAGE_KEY = 'henfarm_music'
const DEFAULTS: MusicPrefs = { enabled: true, volume: 0.18 }

// ── pure music theory helpers (unit tested) ────────────────────

/** Equal-tempered frequency for a note, A4 = 440Hz. */
export function noteHz(semitonesFromA4: number): number {
  return 440 * Math.pow(2, semitonesFromA4 / 12)
}

/** Semitone offsets that spell each chord, relative to its own root. */
export const CHORDS: Record<string, number[]> = {
  maj: [0, 4, 7],
  min: [0, 3, 7],
  maj7: [0, 4, 7, 11],
  min7: [0, 3, 7, 10],
  sus2: [0, 2, 7],
  sus4: [0, 5, 7],
  dim: [0, 3, 6],
}

/** A mood is a progression of [rootSemitonesFromA4, chordQuality] plus a tempo. */
export interface MoodSpec {
  bpm: number
  /** one entry per bar */
  progression: [number, string][]
  /** octave shift applied to the pad, relative to the root */
  padOctave: number
  /** semitone gap between the two detuned pad voices */
  detune: number
  /** light percussion, only used by the busier moods */
  drums: boolean
  /** melody density: how many of the 8 steps per bar carry a pluck */
  melody: number[]
  bassStyle: 'sine' | 'triangle' | 'square'
  colour: number // shared lowpass cutoff for the pad, Hz
}

/**
 * Chord roots as semitones relative to A4 (= 0). Written out per octave
 * rather than derived, because a wrong octave here is inaudible in review
 * and painfully obvious in headphones.
 */
const C3 = -21
const F3 = -16
const G3 = -14
const A3 = -12
const A2 = -24

/**
 * Each mood is a real progression, not random notes — the consonance is
 * what stops a generative loop sounding like an error.
 */
export const MOODS: Record<MusicMood, MoodSpec> = {
  // Warm, wide, unhurried. Open fifths and a sus resolve keep it pastoral.
  farm: {
    bpm: 76,
    progression: [
      [C3, 'sus2'], [A3, 'min7'], [F3, 'maj'], [G3, 'sus4'],
    ],
    padOctave: 0, detune: 7, drums: false,
    melody: [0, 2, 4, 6, 5, 4, 2, 0],
    bassStyle: 'sine', colour: 1400,
  },
  // Slower, darker, more space between notes. Minor 7ths, no melody bus.
  night: {
    bpm: 58,
    progression: [
      [A3, 'min7'], [F3, 'maj7'], [C3, 'min7'], [G3, 'dim'],
    ],
    padOctave: 0, detune: 5, drums: false,
    melody: [0, 4, 7, 4],
    bassStyle: 'sine', colour: 900,
  },
  // Brighter and busier — a shop should feel like a shop.
  shop: {
    bpm: 104,
    progression: [
      [C3, 'maj'], [G3, 'maj7'], [A3, 'min'], [F3, 'maj7'],
    ],
    padOctave: 0, detune: 9, drums: true,
    melody: [0, 2, 4, 5, 6, 5, 4, 2],
    bassStyle: 'triangle', colour: 2200,
  },
  // Jaunty and slightly off-kilter; a market is busier than a shop.
  market: {
    bpm: 112,
    progression: [
      [A3, 'min7'], [A3, 'min7'], [F3, 'maj7'], [G3, 'sus4'],
    ],
    padOctave: 0, detune: 11, drums: true,
    melody: [0, 1, 3, 4, 6, 7, 6, 4],
    bassStyle: 'triangle', colour: 2400,
  },
  // Gentle and supportive, for the social screen.
  social: {
    bpm: 88,
    progression: [
      [F3, 'maj7'], [A3, 'min7'], [C3, 'maj7'], [G3, 'sus4'],
    ],
    padOctave: 0, detune: 6, drums: false,
    melody: [0, 2, 3, 5, 4, 3, 2, 0],
    bassStyle: 'sine', colour: 1700,
  },
  // The only mood with a real pulse — this is what an arcade needs.
  arcade: {
    bpm: 138,
    progression: [
      [A2, 'min'], [A2, 'min'], [F3, 'maj'], [G3, 'sus4'],
    ],
    padOctave: 0, detune: 12, drums: true,
    melody: [0, 1, 2, 3, 4, 5, 6, 7],
    bassStyle: 'square', colour: 3000,
  },
  // Almost nothing: login screen and empty states.
  calm: {
    bpm: 64,
    progression: [[A3, 'min7'], [C3, 'maj7']],
    padOctave: 0, detune: 4, drums: false,
    melody: [0, 4],
    bassStyle: 'sine', colour: 1100,
  },
}

/**
 * Pick the next melody degree, with a small amount of weighted variation so
 * two bars on the same chord do not sound identical.
 */
export function nextMelodyStep(melody: number[], step: number, salt: number): number {
  if (melody.length === 0) return 0
  const base = melody[step % melody.length]
  // deterministic wobble derived from position — no Math.random, so the
  // "random" part of the music is still reproducible under test
  const wobble = (salt * 7 + step * 13) % 5
  const idx = (base + (wobble === 0 ? 1 : 0)) % melody.length
  return melody[idx]
}

// ── preference persistence ─────────────────────────────────────

function hasStorage(): boolean {
  try {
    return typeof localStorage !== 'undefined' && localStorage !== null
  } catch {
    return false
  }
}

export function clampMusicVolume(v: number): number {
  if (!Number.isFinite(v)) return DEFAULTS.volume
  return Math.min(1, Math.max(0, v))
}

export function loadMusicPrefs(): MusicPrefs {
  if (!hasStorage()) return { ...DEFAULTS }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULTS }
    const parsed = JSON.parse(raw) as Partial<MusicPrefs>
    return {
      enabled: typeof parsed.enabled === 'boolean' ? parsed.enabled : DEFAULTS.enabled,
      volume: clampMusicVolume(typeof parsed.volume === 'number' ? parsed.volume : DEFAULTS.volume),
    }
  } catch {
    return { ...DEFAULTS }
  }
}

export function saveMusicPrefs(p: MusicPrefs): void {
  if (!hasStorage()) return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      enabled: p.enabled,
      volume: clampMusicVolume(p.volume),
    }))
  } catch { /* private mode / quota — non-fatal */ }
}

// ── engine ─────────────────────────────────────────────────────

type Ctx = AudioContext

let ctx: Ctx | null = null
let bus: GainNode | null = null
let prefs: MusicPrefs = DEFAULTS
let hydrated = false

let mood: MusicMood = 'calm'
let targetMood: MusicMood = 'calm'
let step = 0
let nextNoteTime = 0
let timer: ReturnType<typeof setInterval> | null = null
let started = false
let duckedUntil = 0

/** Notified on preference and mood changes, so React controls stay in sync. */
const listeners = new Set<() => void>()

function notify(): void {
  for (const l of listeners) { try { l() } catch { /* a bad subscriber must not break music */ } }
}

export function subscribeMusicPrefs(cb: () => void): () => void {
  listeners.add(cb)
  return () => { listeners.delete(cb) }
}

export function getMusicPrefsSnapshot(): MusicPrefs {
  ensurePrefs()
  return prefs
}

const LOOKAHEAD_MS = 25
const SCHEDULE_AHEAD = 0.12

function ensurePrefs(): MusicPrefs {
  if (!hydrated) { prefs = loadMusicPrefs(); hydrated = true }
  return prefs
}

function getCtx(): Ctx | null {
  if (ctx) return ctx
  if (typeof window === 'undefined') return null
  const AC: typeof AudioContext | undefined =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AC) return null
  try {
    ctx = new AC()
    bus = ctx.createGain()
    bus.gain.value = 0
    // Music is a bed. A gentle lowpass takes the edge off the saw pads so
    // they sit under the SFX instead of fighting them.
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 2600
    bus.connect(lp)
    lp.connect(ctx.destination)
    return ctx
  } catch {
    ctx = null
    return null
  }
}

/** Call from a real user gesture so the context is allowed to run. */
export function unlockMusic(): void {
  const c = getCtx()
  if (c && c.state === 'suspended') void c.resume().catch(() => { /* ignore */ })
  if (ensurePrefs().enabled) startMusic()
}

// ── voices ─────────────────────────────────────────────────────

/** Sustained detuned pad — the harmonic bed. */
function padVoice(c: Ctx, out: AudioNode, freq: number, at: number, dur: number, detune: number, colour: number): void {
  const g = c.createGain()
  g.gain.setValueAtTime(0.0001, at)
  g.gain.exponentialRampToValueAtTime(0.09, at + dur * 0.35)
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur)
  const lp = c.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.setValueAtTime(colour, at)
  lp.frequency.exponentialRampToValueAtTime(Math.max(200, colour * 0.5), at + dur)

  for (const cents of [-detune, detune]) {
    const o = c.createOscillator()
    o.type = 'sawtooth'
    o.frequency.value = freq
    o.detune.value = cents
    o.connect(lp)
    o.start(at)
    o.stop(at + dur + 0.05)
  }
  lp.connect(g)
  g.connect(out)
}

/** Short plucked note — kalimba/marimba-ish, carries the melody. */
function pluckVoice(c: Ctx, out: AudioNode, freq: number, at: number, gain = 0.075): void {
  const o = c.createOscillator()
  const o2 = c.createOscillator()
  const g = c.createGain()
  o.type = 'triangle'
  o2.type = 'sine'
  o.frequency.value = freq
  o2.frequency.value = freq * 2 // a quiet octave gives the mallet character
  g.gain.setValueAtTime(0.0001, at)
  g.gain.exponentialRampToValueAtTime(gain, at + 0.008)
  g.gain.exponentialRampToValueAtTime(0.0001, at + 0.5)
  const g2 = c.createGain()
  g2.gain.value = 0.25
  o.connect(g)
  o2.connect(g2)
  g2.connect(g)
  g.connect(out)
  o.start(at); o.stop(at + 0.55)
  o2.start(at); o2.stop(at + 0.55)
}

/** Bass note on the bar's root. */
function bassVoice(c: Ctx, out: AudioNode, freq: number, at: number, dur: number, style: OscillatorType): void {
  const o = c.createOscillator()
  const g = c.createGain()
  o.type = style
  o.frequency.value = freq
  g.gain.setValueAtTime(0.0001, at)
  g.gain.exponentialRampToValueAtTime(0.13, at + 0.02)
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur)
  o.connect(g)
  g.connect(out)
  o.start(at)
  o.stop(at + dur + 0.05)
}

/** Very light percussion — a hat and a soft kick, no backbeat. */
function hatVoice(c: Ctx, out: AudioNode, at: number): void {
  const frames = Math.max(1, Math.floor(c.sampleRate * 0.04))
  const buf = c.createBuffer(1, frames, c.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < frames; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / frames)
  const s = c.createBufferSource()
  s.buffer = buf
  const hp = c.createBiquadFilter()
  hp.type = 'highpass'
  hp.frequency.value = 7000
  const g = c.createGain()
  g.gain.value = 0.035
  s.connect(hp); hp.connect(g); g.connect(out)
  s.start(at); s.stop(at + 0.05)
}

function kickVoice(c: Ctx, out: AudioNode, at: number): void {
  const o = c.createOscillator()
  const g = c.createGain()
  o.type = 'sine'
  o.frequency.setValueAtTime(130, at)
  o.frequency.exponentialRampToValueAtTime(45, at + 0.12)
  g.gain.setValueAtTime(0.1, at)
  g.gain.exponentialRampToValueAtTime(0.0001, at + 0.16)
  o.connect(g); g.connect(out)
  o.start(at); o.stop(at + 0.18)
}

// ── the scheduler ──────────────────────────────────────────────

const EIGHTH = 0.5 // we step in eighth notes

function scheduleStep(c: Ctx, at: number, s: number, b: number): void {
  if (!bus) return
  const spec = MOODS[mood]
  const [root, quality] = spec.progression[s % spec.progression.length]
  const intervals = CHORDS[quality] ?? CHORDS.maj

  // pad: one long sustained chord per bar
  if (s % 8 === 0) {
    for (const iv of intervals) {
      padVoice(c, bus, noteHz(root + iv + spec.padOctave * 12), at, EIGHTH * 8, spec.detune, spec.colour)
    }
    bassVoice(c, bus, noteHz(root - 12), at, EIGHTH * 3.2, spec.bassStyle)
    bassVoice(c, bus, noteHz(root - 12), at + EIGHTH * 4, EIGHTH * 3.2, spec.bassStyle)
  }

  // melody: pick a chord tone, never a note outside the bar's chord
  const deg = nextMelodyStep(spec.melody, s, b)
  if (spec.melody.length > 0) {
    const iv = intervals[deg % intervals.length] + 12 * (deg >= intervals.length ? 1 : 0)
    pluckVoice(c, bus, noteHz(root + iv + 12), at)
  }

  if (spec.drums) {
    if (s % 8 === 0 || s % 8 === 6) kickVoice(c, bus, at)
    if (s % 2 === 1) hatVoice(c, bus, at)
  }
}

function tick(): void {
  const c = ctx
  if (!c || !bus) return
  // A backgrounded tab must not keep generating audio.
  if (typeof document !== 'undefined' && document.hidden) return

  const spec = MOODS[mood]
  const stepDur = (60 / spec.bpm) * EIGHTH

  while (nextNoteTime < c.currentTime + SCHEDULE_AHEAD) {
    try {
      scheduleStep(c, nextNoteTime, step, Math.floor(step / 8))
    } catch {
      /* audio must never break the game loop */
    }
    // tempo is re-read every step so a mood change retimes smoothly
    const nowDur = (60 / MOODS[mood].bpm) * EIGHTH
    nextNoteTime += Math.max(0.05, nowDur)
    step++
  }
}

function rampBus(to: number, seconds: number): void {
  const c = ctx
  if (!c || !bus) return
  const g = bus.gain
  g.cancelScheduledValues(c.currentTime)
  g.setValueAtTime(Math.max(0.0001, g.value), c.currentTime)
  g.linearRampToValueAtTime(Math.max(0.0001, to), c.currentTime + seconds)
}

function effectiveGain(): number {
  const p = ensurePrefs()
  if (!p.enabled) return 0
  const g = p.volume
  // duck while a reward fanfare is playing so it is not buried
  return typeof performance !== 'undefined' && performance.now() < duckedUntil ? g * 0.35 : g
}

export function startMusic(): void {
  const c = getCtx()
  if (!c) return
  if (c.state === 'suspended') { void c.resume().catch(() => { /* ignore */ }) }
  if (timer) return
  if (nextNoteTime < c.currentTime) nextNoteTime = c.currentTime + 0.05
  timer = setInterval(tick, LOOKAHEAD_MS)
  started = true
  rampBus(effectiveGain(), 1.5)
}

export function stopMusic(): void {
  if (timer) { clearInterval(timer); timer = null }
  started = false
  // let already-scheduled notes ring out, then silence
  rampBus(0, 0.6)
}

/**
 * Change mood. The new progression takes over on the next scheduled step
 * and the bus is re-levelled, which reads as a cross-fade without needing
 * two simultaneous sequencers.
 */
export function setMusicMood(next: MusicMood): void {
  // Validate BEFORE adopting. Adopting an unknown mood would leave
  // MOODS[mood] undefined for the scheduler, which throws on the next tick.
  if (!MUSIC_MOODS.includes(next)) return
  if (next === targetMood) return
  targetMood = next
  const changed = next !== mood
  mood = next
  notify()
  if (!changed) return
  if (ensurePrefs().enabled && !timer) startMusic()
  else rampBus(effectiveGain(), 0.8)
}

export function getMusicMood(): MusicMood {
  return targetMood
}

export function setMusicEnabled(on: boolean): void {
  ensurePrefs()
  prefs = { ...prefs, enabled: on }
  saveMusicPrefs(prefs)
  if (on) { unlockMusic(); rampBus(effectiveGain(), 0.8) }
  else stopMusic()
  notify()
}

export function setMusicVolume(v: number): void {
  ensurePrefs()
  prefs = { ...prefs, volume: clampMusicVolume(v) }
  saveMusicPrefs(prefs)
  rampBus(effectiveGain(), 0.2)
  notify()
}

export function getMusicEnabled(): boolean {
  return ensurePrefs().enabled
}

export function getMusicVolume(): number {
  return ensurePrefs().volume
}

export function isMusicPlaying(): boolean {
  return started && timer !== null
}

/** Pull the music down briefly. Called before a loud reward cue. */
export function duckMusic(ms = 1400): void {
  duckedUntil = (typeof performance !== 'undefined' ? performance.now() : 0) + ms
  if (started) rampBus(effectiveGain(), 0.12)
}

/** Test seam: forget the sequencer so a test can start from a clean state. */
export function _resetMusic(): void {
  if (timer) { clearInterval(timer); timer = null }
  ctx = null
  bus = null
  step = 0
  nextNoteTime = 0
  started = false
  duckedUntil = 0
  mood = 'calm'
  targetMood = 'calm'
  hydrated = false
}
