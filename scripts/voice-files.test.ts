// Unit tests for the recorded-voice layer.
//
// The AudioContext path needs a browser, but the *mapping* is pure data and
// that is where the real mistakes live: a typo in a path is silence at
// runtime, and a slot that exists in one table but not the other is a
// missing sound nobody notices until a player points at it.
//
//   bun test scripts/voice-files.test.ts

import { test, expect } from 'bun:test'
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import { join } from 'node:path'

import {
  VOICE_SLOTS, voiceSlot, hasRecording, hotSlots, allSlots,
} from '../src/lib/voice-files'
import { hasVoice, type SoundName } from '../src/lib/sfx'
import { ANIMAL_VARIANTS } from '../src/lib/game-sounds'
import { ANIMAL_TYPES } from '../src/lib/game'

const PUBLIC = 'public'

// ── every declared recording exists on disk ───────────────────
// This is the test that matters. A path typo, a renamed folder or a
// half-finished fetch all fail here rather than as silence in a browser.

test('every declared recording is present on disk and non-trivial', () => {
  for (const [name, slot] of Object.entries(VOICE_SLOTS)) {
    expect(slot, `${name} has no slot`).toBeTruthy()
    const p = join(PUBLIC, slot!.path)
    expect(existsSync(p), `${name}: missing file ${p}`).toBe(true)
    const bytes = statSync(p).size
    expect(bytes, `${name}: ${p} is only ${bytes} bytes`).toBeGreaterThan(4096)
  }
})

test('no audio file is shipped that the manifest does not list', () => {
  const listed = new Set(Object.values(VOICE_SLOTS).map(s => s!.path))
  const found: string[] = []
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const p = join(dir, entry)
      if (statSync(p).isDirectory()) { walk(p); continue }
      if (p.endsWith('.mp3') || p.endsWith('.wav') || p.endsWith('.ogg')) {
        found.push(p.replace(`${PUBLIC}/`, ''))
      }
    }
  }
  walk(join(PUBLIC, 'sounds'))
  const orphans = found.filter(f => !listed.has(f))
  // An orphan is dead weight the player downloads for nothing.
  expect(orphans, `unlisted audio: ${orphans.join(', ')}`).toEqual([])
})

// ── every recording also has a synth voice underneath ─────────
// The fallback is what makes an offline player, a 404, or an unsupported
// codec acceptable. If a slot had a recording but no synth voice, a failed
// fetch would be silence.

test('every recording has a synth voice to fall back to', () => {
  for (const name of allSlots()) {
    expect(hasVoice(name as SoundName), `${name} has a recording but no synth fallback`).toBe(true)
  }
})

test('every animal variant resolves to a voice that exists', () => {
  for (const [species, list] of Object.entries(ANIMAL_VARIANTS)) {
    expect(list.length, `${species} has no variants`).toBeGreaterThan(0)
    for (const cue of list) {
      expect(hasVoice(cue), `${species} → ${cue} has no synth voice`).toBe(true)
    }
  }
})

test('a purchasable animal either has a recording or a synth voice', () => {
  for (const key of Object.keys(ANIMAL_TYPES)) {
    const first = ANIMAL_VARIANTS[key]?.[0]
    expect(first, `${key} has no variant`).toBeDefined()
    expect(hasVoice(first as SoundName)).toBe(true)
  }
})

// ── playback settings are sane ────────────────────────────────

test('every slot has a positive cap and a sane trim', () => {
  for (const [name, slot] of Object.entries(VOICE_SLOTS)) {
    expect(slot!.maxSec, `${name} maxSec`).toBeGreaterThan(0.05)
    expect(slot!.maxSec, `${name} maxSec`).toBeLessThanOrEqual(5)
    expect(slot!.gain, `${name} gain`).toBeGreaterThan(0)
    expect(slot!.gain, `${name} gain`).toBeLessThanOrEqual(1)
  }
})

test('a UI tap is never held for more than a couple of seconds', () => {
  // Long recordings exist in the wild; a tap must not become a ten-second
  // roar, so no cue that can fire on a button may run long.
  for (const name of allSlots()) {
    expect(VOICE_SLOTS[name]!.maxSec, `${name} is too long for a tap`).toBeLessThanOrEqual(3.5)
  }
})

test('ambience is quieter than the animal calls', () => {
  const animals = Object.entries(VOICE_SLOTS).filter(([n]) => n === 'bird' || n === 'cricket')
  for (const [name, slot] of animals) {
    const loudestAnimal = Math.max(
      ...Object.entries(VOICE_SLOTS)
        .filter(([n]) => !['bird', 'cricket'].includes(n))
        .map(([, s]) => s!.gain),
    )
    expect(slot!.gain, `${name} should sit under the animal calls`).toBeLessThan(loudestAnimal)
  }
})

// ── cache warming ────────────────────────────────────────────

test('the hot set is the set a player hears first', () => {
  const hot = hotSlots()
  expect(hot.length).toBeGreaterThan(0)
  expect(hot.length).toBeLessThan(allSlots().length) // not everything
  // the species you meet in the first ten seconds
  for (const expected of ['hen_normal', 'cow', 'cat', 'dog']) {
    expect(hot, `${expected} should be prefetched eagerly`).toContain(expected)
  }
})

test('hot slots are a subset of all slots and are not duplicated', () => {
  const all = allSlots()
  const hot = hotSlots()
  expect(new Set(hot).size).toBe(hot.length)
  for (const name of hot) expect(all).toContain(name)
})

// ── lookups ───────────────────────────────────────────────────

test('voiceSlot returns null for a synth-only cue', () => {
  expect(voiceSlot('coin')).toBeNull()
  expect(hasRecording('coin')).toBe(false)
  expect(voiceSlot('nonsense')).toBeNull()
  expect(hasRecording('nonsense')).toBe(false)
})

test('voiceSlot returns the slot for a recorded cue', () => {
  const s = voiceSlot('cow')
  expect(s).not.toBeNull()
  expect(s!.path).toMatch(/^sounds\/animals\/cow\//)
  expect(hasRecording('cow')).toBe(true)
})

test('recording paths are site-root relative, not absolute or parent-relative', () => {
  for (const [name, slot] of Object.entries(VOICE_SLOTS)) {
    const p = slot!.path
    expect(p.startsWith('/'), `${name} must be root-relative`).toBe(false)
    expect(p.includes('..'), `${name} must not escape public/`).toBe(false)
    expect(p.includes('\\'), `${name} must use forward slashes`).toBe(false)
  }
})

// ── provenance ────────────────────────────────────────────────
// A shipped audio file nobody can account for is a licensing problem
// waiting to happen, so the credits file is part of the contract.

test('credits record every shipped file and the licence', () => {
  const p = join(PUBLIC, 'sounds/animals/CREDITS.md')
  expect(existsSync(p), 'CREDITS.md is missing').toBe(true)
  const md = readFileSync(p, 'utf8')
  expect(md).toContain('Mixkit')
  expect(md).toContain('License')
  expect(md).toMatch(/no attribution/i)
  for (const [name, slot] of Object.entries(VOICE_SLOTS)) {
    expect(md, `${name} is not credited`).toContain(slot!.path)
  }
})
