'use client'

import { useCallback, useSyncExternalStore } from 'react'
import {
  setSoundEnabled, setVolume, play,
  subscribeSoundPrefs, getSoundPrefsSnapshot,
  type SoundName,
} from '@/lib/sfx'
import {
  setMusicEnabled, setMusicVolume, startMusic, stopMusic,
  subscribeMusicPrefs, getMusicPrefsSnapshot,
  type MusicMood,
} from '@/lib/music'
import { GameCard } from './shared'
import { cn } from '@/lib/utils'

/**
 * Sound & music settings.
 *
 * This control surface did not exist at all: `setVolume` and
 * `setSoundEnabled` were implemented and persisted, but nothing in the UI
 * ever called them, so a player who found the audio too loud had no way to
 * turn it down. Music gets its own switch and slider on a separate bus, so
 * someone can silence the soundtrack and keep click feedback (or the
 * reverse).
 *
 * Every control is a real switch or range input, labelled and keyboard
 * operable — a row of divs with onClick is not a control.
 */

const PREVIEW_CUES: { name: string; cue: SoundName }[] = [
  { name: 'Hen', cue: 'hen_normal' },
  { name: 'Cow', cue: 'cow' },
  { name: 'Sheep', cue: 'sheep' },
  { name: 'Duck', cue: 'duck' },
  { name: 'Dog', cue: 'dog' },
  { name: 'Cat', cue: 'cat_purr' },
  { name: 'Horse', cue: 'horse' },
  { name: 'Dragon', cue: 'dragon' },
]

const MOOD_LABELS: { mood: MusicMood; label: string }[] = [
  { mood: 'farm', label: '🌾 Farm' },
  { mood: 'night', label: '🌙 Night' },
  { mood: 'shop', label: '🛒 Shop' },
  { mood: 'market', label: '🏪 Market' },
  { mood: 'social', label: '🤝 Social' },
  { mood: 'arcade', label: '🎮 Arcade' },
]

export function AudioSettings({ currentMood }: { currentMood?: MusicMood }) {
  // Read the persisted prefs through the store rather than into local state:
  // the audio modules are the single source of truth, and useSyncExternalStore
  // keeps this control correct even if audio is changed from elsewhere.
  const sfx = useSyncExternalStore(subscribeSoundPrefs, getSoundPrefsSnapshot, getSoundPrefsSnapshot)
  const music = useSyncExternalStore(subscribeMusicPrefs, getMusicPrefsSnapshot, getMusicPrefsSnapshot)

  const sfxOn = sfx.enabled
  const sfxVol = sfx.volume
  const musicOn = music.enabled
  const musicVol = music.volume

  const toggleSfx = useCallback((on: boolean) => {
    setSoundEnabled(on)
    // Let the player hear that the change took effect.
    if (on) setTimeout(() => play('reward'), 60)
  }, [])

  const toggleMusic = useCallback((on: boolean) => {
    setMusicEnabled(on)
    if (on) startMusic(); else stopMusic()
  }, [])

  const changeSfxVol = useCallback((v: number) => { setVolume(v) }, [])
  const changeMusicVol = useCallback((v: number) => { setMusicVolume(v) }, [])

  return (
    <div className="space-y-2">
      <GameCard>
        <p className="text-sm font-black text-stone-800">🔊 Sound &amp; Music</p>

        {/* ── sound effects ── */}
        <div className="mt-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-black text-stone-700">Sound effects</p>
            <p className="text-[10px] text-stone-600">Hens, coins, hatching and the arcade</p>
          </div>
          <Switch
            checked={sfxOn}
            onChange={toggleSfx}
            label="Toggle sound effects"
            tone="green"
          />
        </div>

        <div className="mt-3">
          <VolumeSlider
            id="sfx-volume"
            label="Effects volume"
            value={sfxVol}
            disabled={!sfxOn}
            onChange={changeSfxVol}
          />
        </div>

        {/* ── music ── */}
        <div className="mt-4 flex items-center justify-between gap-3 border-t border-stone-100 pt-3">
          <div className="min-w-0">
            <p className="text-xs font-black text-stone-700">Background music</p>
            <p className="text-[10px] text-stone-600">Generated live — nothing is downloaded</p>
          </div>
          <Switch
            checked={musicOn}
            onChange={toggleMusic}
            label="Toggle background music"
            tone="purple"
          />
        </div>

        <div className="mt-3">
          <VolumeSlider
            id="music-volume"
            label="Music volume"
            value={musicVol}
            disabled={!musicOn}
            onChange={changeMusicVol}
          />
        </div>

        {/* ── previews ── */}
        <p className="mt-4 text-[10px] font-black uppercase tracking-wide text-stone-600">
              Try the animals
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {PREVIEW_CUES.map(p => (
                <button
                  key={p.cue}
                  onClick={() => play(p.cue)}
                  disabled={!sfxOn}
                  aria-label={`Play the ${p.name.toLowerCase()} sound`}
                  className="min-h-9 rounded-full border border-stone-200 bg-white px-3 py-1.5 text-[11px] font-bold text-stone-700 transition-colors hover:bg-stone-50 active:scale-95 disabled:opacity-40"
                >
                  {p.name}
                </button>
              ))}
            </div>

            {musicOn && currentMood && (
              <>
                <p className="mt-4 text-[10px] font-black uppercase tracking-wide text-stone-600">
                  Now playing
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {MOOD_LABELS.map(m => (
                    <span
                      key={m.mood}
                      className={cn(
                        'rounded-full px-2.5 py-1 text-[10px] font-bold',
                        m.mood === currentMood
                          ? 'bg-purple-100 text-purple-800'
                          : 'bg-stone-100 text-stone-600',
                      )}
                    >
                      {m.label}{m.mood === currentMood ? ' ·' : ''}
                    </span>
                  ))}
                </div>
                <p className="mt-1.5 text-[10px] text-stone-600">
                  The soundtrack follows the screen you are on.
                </p>
              </>
            )}
      </GameCard>
    </div>
  )
}

function Switch({
  checked, onChange, label, tone,
}: { checked: boolean; onChange: (v: boolean) => void; label: string; tone: 'green' | 'purple' }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative h-7 w-12 shrink-0 rounded-full transition-colors',
        checked ? (tone === 'green' ? 'bg-green-700' : 'bg-purple-700') : 'bg-stone-300',
      )}
    >
      <span
        className={cn(
          'absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-[left]',
          checked ? 'left-6' : 'left-1',
        )}
      />
    </button>
  )
}

const VOLUME_STEP = 5

function VolumeSlider({
  id, label, value, onChange, disabled,
}: { id: string; label: string; value: number; onChange: (v: number) => void; disabled?: boolean }) {
  // Snap to the slider's own step. Without this the thumb sits at 20 while
  // the label says 18: the browser quantises a range input to `step`, and a
  // stored value that is not a multiple of 5 renders as a lie.
  const pct = Math.round((value * 100) / VOLUME_STEP) * VOLUME_STEP
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <label htmlFor={id} className="text-[10px] font-bold text-stone-600">{label}</label>
        <span className="text-[10px] font-black tabular-nums text-stone-600">{pct}%</span>
      </div>
      <input
        id={id}
        type="range"
        min={0}
        max={100}
        step={VOLUME_STEP}
        value={pct}
        disabled={disabled}
        onChange={e => onChange(Number(e.target.value) / 100)}
        aria-valuetext={`${pct} percent`}
        className="mt-1 h-9 w-full accent-green-700 disabled:opacity-40"
      />
    </div>
  )
}
