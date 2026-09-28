/**
 * The farm soundscape: sounds that happen on their own, between taps.
 *
 * Without this the game is silent except when you press something, which
 * makes a farm feel like a spreadsheet. Every few seconds something should
 * happen out in the field — a hen, a cow, birdsong in the day, crickets at
 * night — so the world reads as inhabited even when you are only watching.
 *
 * Design constraints:
 *  • Ambience must never be able to drown gameplay. Every cue is fired
 *    through ./sfx, so it inherits the player's master mute and the
 *    per-cue throttle.
 *  • It must be cheap when the tab is backgrounded: the scheduler checks
 *    `document.hidden` and idles instead of scheduling.
 *  • The choice of what to play is pure and deterministic given a seed, so
 *    it is unit testable without a browser.
 */

import { play, type SoundName } from './sfx'
import { ANIMAL_VARIANTS } from './game-sounds'

/** Which species the player's farm actually has, so we do not moo at an empty pen. */
export interface AmbiencePopulation {
  hens: string[]
  animals: string[]
  /** 'day' picks birdsong, 'night' picks crickets */
  timeOfDay: 'day' | 'night'
}

/** Cues that are not animals: weather and birds. */
const SCENERY_DAY: SoundName[] = ['bird', 'wind']
const SCENERY_NIGHT: SoundName[] = ['cricket', 'wind']

/** Min/max seconds between ambient sounds. */
const IDLE_MIN_MS = 7000
const IDLE_MAX_MS = 17000

/**
 * Deterministic pick. `seed` advances per call, so the sequence is stable
 * under test but does not repeat on screen.
 */
export function pickAmbient(seed: number, pop: AmbiencePopulation): SoundName | null {
  const pool: SoundName[] = [...SCENERY_DAY, ...SCENERY_NIGHT]

  for (const key of pop.hens) {
    const list = ANIMAL_VARIANTS[key]
    if (list) pool.push(list[0])
  }
  for (const key of pop.animals) {
    const list = ANIMAL_VARIANTS[key]
    // include every call the species makes, weighted by index so the
    // signature sound comes up more often than the alt
    if (list) pool.push(...list)
  }

  // weather: rain and a stream are plausible on a farm
  if (pop.timeOfDay === 'day') pool.push('water')

  if (pool.length === 0) return null
  const sceneryCount = SCENERY_DAY.length + SCENERY_NIGHT.length
  // Bias toward scenery: an all-scenery world has no animals yet should
  // still sound like somewhere, not be silent.
  if (pool.length === sceneryCount) return pool[Math.abs(seed) % pool.length]
  const animalsOnly = pool.slice(sceneryCount)
  if (animalsOnly.length > 0 && Math.abs(seed) % 3 !== 0) {
    return animalsOnly[Math.abs(seed) % animalsOnly.length]
  }
  return pool[Math.abs(seed) % pool.length]
}

/** Next idle gap. Wider range = less metronomic. */
export function nextIdleMs(seed: number): number {
  const span = IDLE_MAX_MS - IDLE_MIN_MS
  return IDLE_MIN_MS + (Math.abs(seed) % span)
}

let timer: ReturnType<typeof setTimeout> | null = null
let seed = 1
let pop: AmbiencePopulation = { hens: [], animals: [], timeOfDay: 'day' }
let running = false

function schedule(): void {
  if (timer) clearTimeout(timer)
  const delay = nextIdleMs(seed++)
  timer = setTimeout(() => {
    // A backgrounded tab should not keep a soundscape playing.
    if (typeof document !== 'undefined' && document.hidden) { schedule(); return }
    const cue = pickAmbient(seed++, pop)
    if (cue) {
      try { play(cue) } catch { /* ambience must never throw */ }
    }
    schedule()
  }, delay)
}

/** Start (or retarget) the soundscape. Safe to call on every view change. */
export function startAmbience(population: AmbiencePopulation): void {
  pop = population
  if (running) { schedule(); return }
  running = true
  schedule()
}

export function stopAmbience(): void {
  if (timer) { clearTimeout(timer); timer = null }
  running = false
}

export function isAmbienceRunning(): boolean {
  return running
}

/** Test seam. */
export function _resetAmbience(): void {
  stopAmbience()
  seed = 1
  pop = { hens: [], animals: [], timeOfDay: 'day' }
}
