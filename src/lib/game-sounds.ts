/**
 * Game-specific sound mapping for Hen Farm Tycoon.
 *
 * This file knows the game's vocabulary (hen breeds, animals, eggs, items,
 * action names from /api/game/action) and translates them to the generic
 * synth voices in ./sfx. It is deliberately pure — no AudioContext, no
 * React, no DOM — so it is unit-testable and safe to call from anywhere.
 *
 * Unknown keys always fall back to a sensible generic cue, never throw,
 * and return `null` only when the caller should stay silent (unknown
 * action names, so a future server action cannot trigger a wrong sound).
 */

import type { SoundName } from './sfx'

// ── type-key → voice (mirror the keys in game.ts) ─────────────

export const HEN_SOUNDS: Record<string, SoundName> = {
  normal: 'hen_normal',
  golden: 'hen_golden',
  royal: 'hen_royal',
  magic: 'hen_magic',
}

export const ANIMAL_SOUNDS: Record<string, SoundName> = {
  cow: 'cow',
  sheep: 'sheep',
  duck: 'duck',
  dog: 'dog',
  cat: 'cat',
  horse: 'horse',
}

/**
 * Every vocalisation each species can make. The first entry is the
 * signature call used for taps and purchases; the rest are what the
 * soundscape layer draws from so the farm does not sound like it has one
 * cow that only ever says the same word.
 */
export const ANIMAL_VARIANTS: Record<string, SoundName[]> = {
  cow: ['cow', 'cow_low'],
  sheep: ['sheep', 'sheep_bleat'],
  duck: ['duck', 'duck_whistle'],
  dog: ['dog', 'dog_growl', 'dog_whine'],
  cat: ['cat', 'cat_purr'],
  horse: ['horse', 'horse_whinny'],
  dragon: ['dragon', 'dragon_growl'],
}

export const DEFAULT_ANIMAL_VARIANTS: SoundName[] = ['collect']

/** Nth vocalisation of a species, wrapping. Unknown species → 'collect'. */
export function soundForAnimalVariant(typeKey: string, variant = 0): SoundName {
  const list = ANIMAL_VARIANTS[typeKey] ?? DEFAULT_ANIMAL_VARIANTS
  if (list.length === 0) return 'collect'
  const i = Number.isFinite(variant) ? Math.abs(Math.trunc(variant)) : 0
  return list[i % list.length]
}

/** Every species that has a voice, for the soundscape layer. */
export function animalSpeciesWithVoices(): string[] {
  return Object.keys(ANIMAL_VARIANTS)
}

export const EGG_SOUNDS: Record<string, SoundName> = {
  normal: 'egg_crack',
  golden: 'egg_golden',
  royal: 'egg_royal',
  magic: 'egg_magic',
  diamond: 'egg_diamond',
  mystery: 'egg_mystery',
}

export const ITEM_SOUNDS: Record<string, SoundName> = {
  medicine: 'item_medicine',
  vitamin: 'item_vitamin',
  golden_feed: 'item_feed',
  growth_shot: 'item_growth',
  xp_tonic: 'item_xp',
  egg_charm: 'item_charm',
  scarecrow: 'item_scarecrow',
  feed_sack: 'item_sack',
}

export function soundForHen(typeKey: string): SoundName {
  return HEN_SOUNDS[typeKey] ?? 'hen_normal'
}

export function soundForAnimal(typeKey: string): SoundName {
  return ANIMAL_SOUNDS[typeKey] ?? 'collect'
}

export function soundForEgg(typeKey: string): SoundName {
  return EGG_SOUNDS[typeKey] ?? 'egg_crack'
}

export function soundForItem(itemKey: string): SoundName {
  return ITEM_SOUNDS[itemKey] ?? 'click'
}

// ── buy payload → voice ───────────────────────────────────────
// Mirrors the `buy` branch of /api/game/action: body.itemType/subType.
export function soundForBuy(itemType: string, subType: string): SoundName {
  switch (itemType) {
    case 'hen':
      return soundForHen(subType)
    case 'animal':
      return soundForAnimal(subType)
    case 'egg':
      return soundForEgg(subType)
    case 'item':
      return soundForItem(subType)
    case 'building':
      return 'build'
    case 'feed':
      return 'feed'
    case 'upgrade':
      return 'build'
    case 'hen_level':
      return soundForHen(subType)
    default:
      return 'buy'
  }
}

// ── action name → voice ───────────────────────────────────────
// Covers every `action === '...'` branch in /api/game/action/route.ts
// plus the social routes that reuse the same `act()` channel.
const ACTION_SOUNDS: Record<string, SoundName> = {
  collect_hens: 'collect',
  collect_animals: 'collect',
  feed: 'feed',
  sell_eggs: 'sell',
  incubate: 'egg_crack',
  open_egg: 'hatch',
  speedup: 'powerup',
  claim_daily: 'daily',
  claim_level_reward: 'levelup',
  claim_vip_daily: 'reward',
  purchase_gems: 'coin',
  purchase_vip: 'reward',
  claim_mission: 'mission',
  withdraw: 'coin',
  deposit: 'coin',
  exchange_gems: 'coin',
  list_market: 'click',
  buy_market: 'buy',
  cancel_market: 'click',
  friend_add: 'click',
  friend_accept: 'gift',
  friend_reject: 'click',
  friend_remove: 'click',
  gift_friend: 'gift',
  help_friend: 'gift',
  clan_create: 'build',
  clan_join: 'gift',
  clan_leave: 'click',
  clan_donate: 'coin',
  clan_claim: 'reward',
  breed: 'breed',
  buy: 'buy',
  use_item: 'click',
  save_payment_profile: 'click',
  clear_payment_profile: 'click',
  ticket_create: 'click',
  ticket_reply: 'click',
  mini_start: 'game_start',
  mini_finish: 'win',
}

export interface ActionPayload {
  itemType?: string
  subType?: string
  itemKey?: string
}

/**
 * Resolve the cue for a game action. Payload-aware for `buy` (which
 * quacks/clucks/moos depending on what was bought) and `use_item`.
 * Returns `null` for unknown actions so future server actions stay silent
 * instead of playing a misleading sound.
 */
export function soundForAction(action: string, payload: ActionPayload = {}): SoundName | null {
  if (action === 'buy' && payload.itemType) {
    return soundForBuy(payload.itemType, payload.subType ?? '')
  }
  if (action === 'use_item' && payload.itemKey) {
    return soundForItem(payload.itemKey)
  }
  return ACTION_SOUNDS[action] ?? null
}

// ── hatch / breed reward → voice ──────────────────────────────
// Reward strings look like 'chick:golden', 'coins:150', 'animal:cow',
// 'gems:1', 'mutation:royal' (see EGG_TYPES hatch tables).
export function soundForHatchReward(reward: string): SoundName {
  const [kind, value] = reward.split(':')
  switch (kind) {
    case 'chick':
      return soundForHen(value)
    case 'animal':
      return soundForAnimal(value)
    case 'mutation':
      // legendary-blood mutation: the rarest hatch moment
      return 'dragon'
    case 'gems':
      return 'coin'
    case 'coins':
      return 'coin'
    case 'item':
      return soundForItem(value)
    default:
      return 'hatch'
  }
}

// ── hatched-result payload → voice ────────────────────────────
// The client never sees the reward string — /api/game/action returns a
// HatchResult { kind, emoji, title, detail }. The emoji carries the breed
// (it comes straight from HEN_TYPES / ANIMAL_TYPES), the title carries
// the mutation moment ('🌟 LEGENDARY MUTATION!'). Map those instead of
// guessing from kind alone, which would make every hatch sound identical.
const HATCH_EMOJI_SOUNDS: Record<string, SoundName> = {
  // hens (HEN_TYPES emoji)
  '🐔': 'hen_normal',
  '🐓': 'hen_golden',
  '🦃': 'hen_royal',
  '🪿': 'hen_magic',
  // animals (ANIMAL_TYPES emoji)
  '🐄': 'cow',
  '🐑': 'sheep',
  '🦆': 'duck',
  '🐕': 'dog',
  '🐈': 'cat',
  '🐎': 'horse',
  // currency
  '🪙': 'coin',
  '💎': 'coin',
}

export interface HatchResultLike {
  kind: string
  emoji: string
  title: string
}

export function soundForHatchResult(hatch: HatchResultLike): SoundName {
  if (hatch.title.includes('MUTATION')) return 'dragon'
  return HATCH_EMOJI_SOUNDS[hatch.emoji] ?? 'hatch'
}

// ── mini-game moments → voice ─────────────────────────────────
export type MiniGameMoment =
  | 'start' | 'jump' | 'crash' | 'win' | 'lose'
  | 'powerup' | 'coin' | 'egg' | 'traffic' | 'splash' | 'energy'

export const MINI_GAME_SOUNDS: Record<MiniGameMoment, SoundName> = {
  start: 'game_start',
  jump: 'jump',
  crash: 'crash',
  win: 'win',
  lose: 'game_over',
  powerup: 'powerup',
  coin: 'coin',
  egg: 'egg_crack',
  traffic: 'traffic',
  splash: 'splash',
  energy: 'energy',
}

export function soundForMiniGame(moment: MiniGameMoment): SoundName {
  return MINI_GAME_SOUNDS[moment]
}

// ── social / wallet moments → voice ───────────────────────────
export function soundForSocial(kind: 'friend_request' | 'gift_sent' | 'gift_received' | 'clan_joined' | 'help'): SoundName {
  switch (kind) {
    case 'gift_received':
    case 'gift_sent':
      return 'gift'
    case 'clan_joined':
      return 'build'
    default:
      return 'notify'
  }
}
