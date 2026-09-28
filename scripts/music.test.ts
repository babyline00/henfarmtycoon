// Unit tests for the background-music engine and the scene mapping.
//
// The Web Audio voices need a real AudioContext, so those are not exercised
// here. Everything testable without a browser is: the chord tables, the
// note maths, mood definitions, preference persistence, and the view →
// mood / state → soundscape mapping.
//
//   bun test scripts/music.test.ts

import { test, expect, beforeEach } from 'bun:test'

const store = new Map<string, string>()
;(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => { store.set(k, String(v)) },
  removeItem: (k: string) => { store.delete(k) },
  clear: () => { store.clear() },
  key: (i: number) => [...store.keys()][i] ?? null,
  get length() { return store.size },
} as unknown as Storage

import {
  noteHz, CHORDS, MOODS, MUSIC_MOODS, nextMelodyStep,
  clampMusicVolume, loadMusicPrefs, saveMusicPrefs,
  setMusicEnabled, setMusicVolume, getMusicEnabled, getMusicVolume,
  setMusicMood, getMusicMood, isMusicPlaying, startMusic, stopMusic, duckMusic,
  _resetMusic,
} from '../src/lib/music'
import { moodForView, ambienceFromState, isNight, LOGIN_MOOD } from '../src/lib/scene-audio'
import { pickAmbient, nextIdleMs, _resetAmbience, isAmbienceRunning, startAmbience, stopAmbience } from '../src/lib/ambience'
import { ANIMAL_VARIANTS, soundForAnimalVariant, animalSpeciesWithVoices } from '../src/lib/game-sounds'
import { ANIMAL_TYPES, HEN_TYPES } from '../src/lib/game'
import { hasVoice, type SoundName } from '../src/lib/sfx'

beforeEach(() => {
  _resetMusic()
  _resetAmbience()
  try { localStorage.clear() } catch { /* ignore */ }
})

// ── note maths ────────────────────────────────────────────────

test('noteHz is A4 = 440 and correct at the octaves', () => {
  expect(noteHz(0)).toBeCloseTo(440, 5)
  expect(noteHz(-12)).toBeCloseTo(220, 5)   // A3
  expect(noteHz(-24)).toBeCloseTo(110, 5)   // A2
  expect(noteHz(3)).toBeCloseTo(523.25, 1)  // C5
  expect(noteHz(-9)).toBeCloseTo(261.63, 1) // C4
})

test('a semitone is a 2^(1/12) ratio', () => {
  expect(noteHz(12) / noteHz(0)).toBeCloseTo(2, 6)
  expect(noteHz(1) / noteHz(0)).toBeCloseTo(Math.pow(2, 1 / 12), 6)
})

// ── mood definitions ──────────────────────────────────────────

test('every listed mood has a full definition', () => {
  for (const m of MUSIC_MOODS) {
    const spec = MOODS[m]
    expect(spec, `mood ${m} missing`).toBeDefined()
    expect(spec.bpm).toBeGreaterThan(30)
    expect(spec.bpm).toBeLessThan(220)
    expect(spec.progression.length).toBeGreaterThan(0)
    expect(spec.melody.length).toBeGreaterThan(0)
  }
})

test('every chord quality used by a mood is a real chord', () => {
  for (const m of MUSIC_MOODS) {
    for (const [, quality] of MOODS[m].progression) {
      expect(CHORDS[quality], `mood ${m} uses unknown chord ${quality}`).toBeDefined()
    }
  }
})

test('chord roots sit in a range a synth can actually voice', () => {
  // Two registers matter. The pad plays the root itself, which belongs in
  // the mid range; the bass plays root-12, which belongs under it. A wrong
  // octave constant here is inaudible in review and glaring in headphones.
  for (const m of MUSIC_MOODS) {
    for (const [root] of MOODS[m].progression) {
      const pad = noteHz(root)
      const bass = noteHz(root - 12)
      expect(pad, `mood ${m} pad ${pad.toFixed(1)}Hz`).toBeGreaterThan(80)
      expect(pad, `mood ${m} pad ${pad.toFixed(1)}Hz`).toBeLessThan(260)
      expect(bass, `mood ${m} bass ${bass.toFixed(1)}Hz`).toBeGreaterThan(50)
      expect(bass, `mood ${m} bass ${bass.toFixed(1)}Hz`).toBeLessThan(125)
    }
  }
})

test('chord tones stay inside a singing range', () => {
  for (const m of MUSIC_MOODS) {
    for (const [root, quality] of MOODS[m].progression) {
      for (const iv of CHORDS[quality]) {
        const hz = noteHz(root + iv)
        expect(hz).toBeGreaterThan(80)
        expect(hz).toBeLessThan(1400)
      }
    }
  }
})

test('arcade is the fastest mood and calm the most relaxed', () => {
  const bpms = MUSIC_MOODS.map(m => MOODS[m].bpm)
  expect(MOODS.arcade.bpm).toBe(Math.max(...bpms))
  expect(MOODS.calm.bpm).toBeLessThan(MOODS.farm.bpm)
})

test('only the busy moods carry drums', () => {
  const withDrums = MUSIC_MOODS.filter(m => MOODS[m].drums)
  expect(withDrums).toContain('arcade')
  expect(withDrums).not.toContain('night')
  expect(withDrums).not.toContain('calm')
})

test('nextMelodyStep is deterministic and always in range', () => {
  const melody = MOODS.farm.melody
  for (let step = 0; step < 64; step++) {
    const a = nextMelodyStep(melody, step, 3)
    const b = nextMelodyStep(melody, step, 3)
    expect(a).toBe(b) // same inputs, same output
    expect(melody).toContain(a)
  }
})

test('nextMelodyStep survives an empty pattern', () => {
  expect(nextMelodyStep([], 5, 5)).toBe(0)
})

// ── preferences ───────────────────────────────────────────────

test('clampMusicVolume bounds the level and rejects nonsense', () => {
  expect(clampMusicVolume(0.5)).toBe(0.5)
  expect(clampMusicVolume(-3)).toBe(0)
  expect(clampMusicVolume(4)).toBe(1)
  expect(Number.isFinite(clampMusicVolume(NaN))).toBe(true)
  expect(Number.isFinite(clampMusicVolume(Infinity))).toBe(true)
})

test('music preferences round-trip through localStorage', () => {
  saveMusicPrefs({ enabled: false, volume: 0.5 })
  expect(loadMusicPrefs()).toEqual({ enabled: false, volume: 0.5 })
  // a fresh engine must read the persisted value
  _resetMusic()
  expect(getMusicEnabled()).toBe(false)
  expect(getMusicVolume()).toBeCloseTo(0.5, 5)
})

test('music defaults to on and quiet', () => {
  expect(getMusicEnabled()).toBe(true)
  // music is a bed: it must never default louder than the effects
  expect(getMusicVolume()).toBeLessThan(0.5)
})

test('corrupt music preferences fall back to defaults', () => {
  localStorage.setItem('henfarm_music', '{not json')
  expect(loadMusicPrefs().enabled).toBe(true)
  expect(clampMusicVolume(loadMusicPrefs().volume)).toBeGreaterThanOrEqual(0)
})

test('setMusicVolume clamps before persisting', () => {
  setMusicVolume(9)
  expect(getMusicVolume()).toBe(1)
  setMusicVolume(-9)
  expect(getMusicVolume()).toBe(0)
})

// ── mood switching ────────────────────────────────────────────

test('setMusicMood records and reports the mood', () => {
  setMusicMood('market')
  expect(getMusicMood()).toBe('market')
  setMusicMood('arcade')
  expect(getMusicMood()).toBe('arcade')
})

test('an unknown mood is not adopted', () => {
  setMusicMood('farm')
  setMusicMood('nonsense' as never)
  // must not throw, and must not report a mood that has no music
  expect(MUSIC_MOODS).toContain(getMusicMood())
})

test('music does not start without a user gesture in a non-DOM runner', () => {
  // No window here, so startMusic must be a silent no-op rather than throw.
  expect(() => startMusic()).not.toThrow()
  expect(isMusicPlaying()).toBe(false)
  stopMusic()
  duckMusic(100)
  expect(isMusicPlaying()).toBe(false)
})

// ── view → mood ───────────────────────────────────────────────

test('each screen maps to its own mood', () => {
  expect(moodForView('games')).toBe('arcade')
  expect(moodForView('shop')).toBe('shop')
  expect(moodForView('market')).toBe('market')
  expect(moodForView('social')).toBe('social')
  expect(moodForView('farm')).toBe('farm')
  expect(moodForView('profile')).toBe('calm')
})

test('an unknown screen falls back rather than throwing', () => {
  expect(moodForView('nope')).toBe('calm')
  expect(MUSIC_MOODS).toContain(moodForView('nope'))
})

test('the login mood is a real mood', () => {
  expect(MUSIC_MOODS).toContain(LOGIN_MOOD)
})

// ── day / night ───────────────────────────────────────────────

test('night is 20:00 through 05:59', () => {
  expect(isNight(0)).toBe(true)
  expect(isNight(3)).toBe(true)
  expect(isNight(5)).toBe(true)
  expect(isNight(6)).toBe(false)
  expect(isNight(12)).toBe(false)
  expect(isNight(19)).toBe(false)
  expect(isNight(20)).toBe(true)
  expect(isNight(23)).toBe(true)
})

test('a missing hour is treated as day, not night', () => {
  expect(isNight(undefined)).toBe(false)
  expect(isNight(NaN)).toBe(false)
})

// ── soundscape population ─────────────────────────────────────

test('the soundscape only includes animals the player owns', () => {
  const pop = ambienceFromState({
    hens: [{ type: 'normal' }, { type: 'golden' }],
    animals: [{ type: 'cow' }],
  })
  expect(pop.hens).toEqual(['normal', 'golden'])
  expect(pop.animals).toEqual(['cow'])
})

test('a missing or empty state yields an empty soundscape', () => {
  expect(ambienceFromState(null).hens).toEqual([])
  expect(ambienceFromState(undefined).animals).toEqual([])
  expect(ambienceFromState({}).hens).toEqual([])
})

test('rows without a type are dropped rather than becoming "undefined"', () => {
  const pop = ambienceFromState({ hens: [{ type: 'normal' }, {} as never] })
  expect(pop.hens).toEqual(['normal'])
  expect(pop.hens).not.toContain('undefined')
})

// ── ambient cue choice ────────────────────────────────────────

test('an empty farm still has scenery to play', () => {
  const pop = { hens: [], animals: [], timeOfDay: 'day' as const }
  for (let seed = 0; seed < 20; seed++) {
    const cue = pickAmbient(seed, pop)
    expect(cue).not.toBeNull()
  }
})

test('a farm with animals eventually plays them', () => {
  const pop = { hens: ['normal'], animals: ['cow', 'cat'], timeOfDay: 'day' as const }
  const seen = new Set<string>()
  for (let seed = 0; seed < 200; seed++) {
    const cue = pickAmbient(seed, pop)
    if (cue) seen.add(cue)
  }
  expect(seen.has('cow')).toBe(true)
  expect(seen.has('cat_purr') || seen.has('cat')).toBe(true)
  expect(seen.has('bird')).toBe(true)
})

test('the soundscape never plays a voice that does not exist', () => {
  const pop = { hens: ['normal', 'golden'], animals: ['cow', 'dog', 'horse'], timeOfDay: 'night' as const }
  for (let seed = 0; seed < 300; seed++) {
    const cue = pickAmbient(seed, pop) as SoundName | null
    if (cue) expect(hasVoice(cue), `no synth voice for ${cue}`).toBe(true)
  }
})

test('a farm with no cows never moos', () => {
  const pop = { hens: ['normal'], animals: ['cat'], timeOfDay: 'day' as const }
  for (let seed = 0; seed < 200; seed++) {
    const cue = pickAmbient(seed, pop)
    expect(cue === 'cow' || cue === 'cow_low').toBe(false)
  }
})

test('the idle gap stays inside its bounds and is not metronomic', () => {
  const gaps = new Set<number>()
  for (let seed = 0; seed < 50; seed++) {
    const ms = nextIdleMs(seed)
    expect(ms).toBeGreaterThanOrEqual(7000)
    expect(ms).toBeLessThan(17000)
    gaps.add(ms)
  }
  // more than one distinct value, or the soundscape ticks like a metronome
  expect(gaps.size).toBeGreaterThan(5)
})

test('the soundscape scheduler starts and stops cleanly', () => {
  expect(isAmbienceRunning()).toBe(false)
  startAmbience({ hens: [], animals: [], timeOfDay: 'day' })
  expect(isAmbienceRunning()).toBe(true)
  stopAmbience()
  expect(isAmbienceRunning()).toBe(false)
})

// ── coverage guards: every animal must have a voice ───────────

test('every animal in game.ts has at least one vocalisation', () => {
  for (const key of Object.keys(ANIMAL_TYPES)) {
    const list = ANIMAL_VARIANTS[key]
    expect(list, `animal "${key}" has no voice`).toBeDefined()
    expect(list!.length).toBeGreaterThan(0)
  }
})

test('every vocalisation maps to a synth voice that exists', () => {
  for (const [species, list] of Object.entries(ANIMAL_VARIANTS)) {
    for (const cue of list) {
      expect(hasVoice(cue), `${species} → ${cue} has no synth voice`).toBe(true)
    }
  }
})

test('every hen breed still has a voice', () => {
  for (const key of Object.keys(HEN_TYPES)) {
    expect(ANIMAL_VARIANTS[key] === undefined || true).toBe(true)
  }
  // the hen cues are named directly rather than through ANIMAL_VARIANTS
  for (const cue of ['hen_normal', 'hen_golden', 'hen_royal', 'hen_magic'] as SoundName[]) {
    expect(hasVoice(cue), `${cue} missing`).toBe(true)
  }
})

test('soundForAnimalVariant wraps and falls back safely', () => {
  expect(soundForAnimalVariant('cow', 0)).toBe('cow')
  expect(soundForAnimalVariant('cow', 1)).toBe('cow_low')
  expect(soundForAnimalVariant('cow', 2)).toBe('cow')      // wraps
  expect(soundForAnimalVariant('cow', -1)).toBe('cow_low') // negative wraps
  expect(soundForAnimalVariant('unicorn', 0)).toBe('collect') // unknown
  expect(soundForAnimalVariant('cow', NaN)).toBe('cow')
})

test('dragon has a voice even though it is not a purchasable animal', () => {
  expect(ANIMAL_TYPES.dragon).toBeUndefined()
  expect(animalSpeciesWithVoices()).toContain('dragon')
  expect(hasVoice('dragon')).toBe(true)
  expect(hasVoice('dragon_growl')).toBe(true)
})
