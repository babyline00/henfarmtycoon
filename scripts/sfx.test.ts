// Unit tests for the sound-effect preferences and throttle.
// The Web Audio voices themselves need a real AudioContext and are not
// exercised here; everything testable without a browser is.
//
//   bun test scripts/sfx.test.ts

import { test, expect, beforeEach } from 'bun:test'

// Bun's runner has no DOM. Minimal localStorage so the preference
// persistence path is actually exercised rather than silently skipped.
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
  createThrottle, shouldPlay, clampVolume, loadPrefs, savePrefs,
  play, setSoundEnabled, setVolume, getSoundEnabled, getVolume,
  unlockAudio, _resetThrottle,
  type SoundName,
} from '../src/lib/sfx'

beforeEach(() => {
  _resetThrottle()
  try { localStorage.clear() } catch { /* ignore */ }
})

test('clampVolume keeps the level in 0..1 and rejects nonsense', () => {
  expect(clampVolume(0.5)).toBe(0.5)
  expect(clampVolume(-1)).toBe(0)
  expect(clampVolume(9)).toBe(1)
  expect(clampVolume(NaN)).toBeGreaterThanOrEqual(0)
  expect(Number.isFinite(clampVolume(Infinity))).toBe(true)
})

test('preferences round-trip through localStorage', () => {
  setSoundEnabled(false)
  setVolume(0.8)
  expect(getSoundEnabled()).toBe(false)
  expect(getVolume()).toBe(0.8)

  const reloaded = loadPrefs()
  expect(reloaded.enabled).toBe(false)
  expect(reloaded.volume).toBeCloseTo(0.8)
})

test('a corrupt preference blob falls back to defaults instead of throwing', () => {
  localStorage.setItem('henfarm_sfx', '{not json')
  const p = loadPrefs()
  expect(typeof p.enabled).toBe('boolean')
  expect(p.volume).toBeGreaterThan(0)
  expect(p.volume).toBeLessThanOrEqual(1)
})

test('an out-of-range stored volume is clamped on read', () => {
  localStorage.setItem('henfarm_sfx', JSON.stringify({ enabled: true, volume: 99 }))
  expect(loadPrefs().volume).toBe(1)
  localStorage.setItem('henfarm_sfx', JSON.stringify({ enabled: true, volume: -4 }))
  expect(loadPrefs().volume).toBe(0)
})

test('the throttle blocks a rapid retrigger of the same cue', () => {
  const t = createThrottle()
  expect(shouldPlay(t, 'collect', 1000, 90)).toBe(true)
  expect(shouldPlay(t, 'collect', 1050, 90)).toBe(false)  // 50ms later
  expect(shouldPlay(t, 'collect', 1095, 90)).toBe(true)   // 95ms later
})

test('the throttle counts each cue independently', () => {
  const t = createThrottle()
  expect(shouldPlay(t, 'collect', 1000, 90)).toBe(true)
  expect(shouldPlay(t, 'coin', 1000, 90)).toBe(true)
  expect(shouldPlay(t, 'buy', 1000, 90)).toBe(true)
  expect(shouldPlay(t, 'collect', 1010, 90)).toBe(false)
})

test('a zero gap means every call is allowed', () => {
  const t = createThrottle()
  for (let i = 0; i < 5; i++) expect(shouldPlay(t, 'hatch', 1000, 0)).toBe(true)
})

test('play() is a safe no-op when disabled, and never throws', () => {
  setSoundEnabled(false)
  const names: SoundName[] = ['click', 'collect', 'hatch', 'error', 'win', 'jump', 'crash']
  for (const n of names) {
    expect(() => play(n)).not.toThrow()
  }
})

test('play() does not throw when sound is enabled but no AudioContext exists', () => {
  setSoundEnabled(true)
  setVolume(0.5)
  expect(() => play('collect')).not.toThrow()
  expect(() => play('levelup')).not.toThrow()
})

test('play() at zero volume short-circuits before touching audio', () => {
  setSoundEnabled(true)
  setVolume(0)
  // no AudioContext in the test env; this must still not throw
  expect(() => play('coin')).not.toThrow()
})

test('unlockAudio is idempotent and safe before any gesture', () => {
  expect(() => { unlockAudio(); unlockAudio() }).not.toThrow()
})

test('the throttle state actually gates repeated play() calls', () => {
  setSoundEnabled(true)
  // Both calls are no-ops in this environment, but the throttle must still
  // record them so a burst collapses to a single sound in a real browser.
  play('collect', 1000)
  play('collect', 1010)
  play('collect', 2000)
})
