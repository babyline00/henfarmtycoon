/**
 * Which cues have a real recording, and where to fetch it.
 *
 * Deliberately pure: no AudioContext, no fetch, no DOM. The loader in
 * ./sfx imports this and does the work, but the mapping itself is data, so
 * it can be unit tested — and so a missing or typo'd path is a test failure
 * rather than silence at runtime.
 *
 * Why recordings exist at all: everything else here is synthesised, and
 * for UI blips that is the right call. Animal calls are the exception. A
 * procedural "moo" is recognisable as *a low vocalisation*; it is not
 * recognisable as a cow. So the species voices are real recordings and
 * nothing else is.
 *
 * Every path here is produced by `bun run scripts/fetch-animal-sounds.mjs`,
 * which records provenance and licence in CREDITS.md next to the files.
 */

/** Per-cue playback settings for a recording. */
export interface VoiceSlot {
  /** Path under the site root. */
  path: string
  /**
   * Hard cap on how long a cue may play. Several recordings are long
   * (the dragon echo runs many seconds) and a UI tap must not turn into a
   * ten-second roar. A cue that is longer than this is faded out at the
   * end rather than cut abruptly.
   */
  maxSec: number
  /**
   * Per-cue trim. Recordings are mastered for a video mix, so they arrive
   * louder than a synthesised blip and would dominate it. Most want a
   * significant cut; a few sit close to the synth level.
   */
  gain: number
  /** Preferred first, when warming the cache after a user gesture. */
  hot?: boolean
}

const V = 'sounds/animals'

/**
 * Cues backed by a recording. Any cue absent from this table is played
 * with its synthesised voice — that is the default, not a fallback.
 */
export const VOICE_SLOTS: Partial<Record<string, VoiceSlot>> = {
  // ── cow ──
  cow:            { path: `${V}/cow/cow.mp3`,              maxSec: 2.0, gain: 0.85, hot: true },
  cow_low:        { path: `${V}/cow/cow_low.mp3`,          maxSec: 2.5, gain: 0.8,  hot: true },
  cow_moo_barn:   { path: `${V}/cow/cow_moo_barn.mp3`,     maxSec: 2.5, gain: 0.8 },
  cow_moo_many:   { path: `${V}/cow/cow_moo_many.mp3`,     maxSec: 3.0, gain: 0.75 },

  // ── sheep ──
  sheep:          { path: `${V}/sheep/sheep.mp3`,          maxSec: 2.5, gain: 0.8,  hot: true },

  // ── duck ──
  duck:           { path: `${V}/duck/duck.mp3`,            maxSec: 1.2, gain: 0.7,  hot: true },

  // ── dog ──
  dog:            { path: `${V}/dog/dog.mp3`,              maxSec: 1.2, gain: 0.85, hot: true },
  dog_growl:      { path: `${V}/dog/dog_growl.mp3`,        maxSec: 2.0, gain: 0.8 },
  dog_whine:      { path: `${V}/dog/dog_whine.mp3`,        maxSec: 1.8, gain: 0.8 },

  // ── cat ──
  cat:            { path: `${V}/cat/cat.mp3`,              maxSec: 1.8, gain: 0.85, hot: true },
  cat_purr:       { path: `${V}/cat/cat_purr.mp3`,         maxSec: 3.0, gain: 0.7 },
  cat_meow_cartoon: { path: `${V}/cat/cat_meow_cartoon.mp3`, maxSec: 1.5, gain: 0.8 },

  // ── horse ──
  horse:          { path: `${V}/horse/horse.mp3`,          maxSec: 1.8, gain: 0.85, hot: true },
  horse_whinny:   { path: `${V}/horse/horse_whinny.mp3`,   maxSec: 1.5, gain: 0.8 },
  horse_snort:    { path: `${V}/horse/horse_snort.mp3`,    maxSec: 1.2, gain: 0.75 },

  // ── dragon ──
  dragon:         { path: `${V}/dragon/dragon.mp3`,        maxSec: 2.5, gain: 0.9,  hot: true },
  dragon_growl:   { path: `${V}/dragon/dragon_growl.mp3`,  maxSec: 2.5, gain: 0.85 },
  dragon_roar_echo: { path: `${V}/dragon/dragon_roar_echo.mp3`, maxSec: 3.5, gain: 0.8 },
  dragon_fire:    { path: `${V}/dragon/dragon_fire.mp3`,   maxSec: 2.5, gain: 0.8 },

  // ── chicken ──
  hen_normal:     { path: `${V}/hen/hen_normal.mp3`,       maxSec: 1.2, gain: 0.7,  hot: true },
  hen_golden:     { path: `${V}/hen/hen_golden.mp3`,       maxSec: 1.5, gain: 0.7,  hot: true },
  rooster:        { path: `${V}/hen/rooster.mp3`,          maxSec: 2.5, gain: 0.75 },
  rooster_short:  { path: `${V}/hen/rooster_short.mp3`,    maxSec: 1.5, gain: 0.75 },

  // ── soundscape ──
  bird:           { path: `${V}/ambience/bird.mp3`,        maxSec: 3.5, gain: 0.45 },
  cricket:        { path: `${V}/ambience/cricket.mp3`,     maxSec: 1.5, gain: 0.4 },
}

export function voiceSlot(name: string): VoiceSlot | null {
  return VOICE_SLOTS[name] ?? null
}

export function hasRecording(name: string): boolean {
  return name in VOICE_SLOTS
}

/**
 * Cues to warm immediately after a user gesture. These are the ones a
 * player hears in their first few seconds, and a fetch-and-decode on the
 * first tap is the difference between a responsive game and a stutter.
 * The rest stream in on idle.
 */
export function hotSlots(): string[] {
  return Object.entries(VOICE_SLOTS).filter(([, v]) => v?.hot).map(([k]) => k)
}

export function allSlots(): string[] {
  return Object.keys(VOICE_SLOTS)
}
