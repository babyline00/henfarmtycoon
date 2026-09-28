/**
 * Decides which musical mood belongs to which screen, and keeps the
 * soundscape population in step with the farm the player actually owns.
 *
 * Kept separate from page.tsx so the mapping is pure and unit tested: a
 * wrong mood is easy to introduce and hard to notice.
 */

import type { MusicMood } from './music'
import type { AmbiencePopulation } from './ambience'

/** Screen → mood. */
export function moodForView(view: string): MusicMood {
  switch (view) {
    case 'games': return 'arcade'
    case 'shop': return 'shop'
    case 'market': return 'market'
    case 'social': return 'social'
    case 'profile': return 'calm'
    case 'farm': return 'farm'
    default: return 'calm'
  }
}

/** Login and other signed-out surfaces. */
export const LOGIN_MOOD: MusicMood = 'calm'

/** Everything the soundscape needs, derived from the game state shape. */
export interface AmbienceSource {
  hens?: { type?: string }[]
  animals?: { type?: string }[]
  /** server hour, if the state carries one; otherwise 'day' */
  hour?: number
}

/**
 * Build the ambience population. Only species the player actually owns are
 * included — a farm with no cow should never moo.
 */
export function ambienceFromState(state: AmbienceSource | null | undefined): AmbiencePopulation {
  if (!state) return { hens: [], animals: [], timeOfDay: 'day' }
  return {
    hens: (state.hens ?? []).map(h => h?.type).filter((t): t is string => !!t),
    animals: (state.animals ?? []).map(a => a?.type).filter((t): t is string => !!t),
    timeOfDay: isNight(state.hour) ? 'night' : 'day',
  }
}

export function isNight(hour: number | undefined): boolean {
  if (typeof hour !== 'number' || !Number.isFinite(hour)) return false
  return hour < 6 || hour >= 20
}
