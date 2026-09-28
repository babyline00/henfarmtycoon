// Unit tests for the game-specific sound mapping.
// Pure mapping logic: every key in game.ts must resolve to a real synth
// voice, and unknown keys must degrade gracefully instead of throwing.
//
//   bun test scripts/game-sounds.test.ts

import { test, expect } from 'bun:test'
import {
  HEN_TYPES, ANIMAL_TYPES, EGG_TYPES, ITEM_TYPES,
} from '../src/lib/game'
import { hasVoice } from '../src/lib/sfx'
import {
  HEN_SOUNDS, ANIMAL_SOUNDS, EGG_SOUNDS, ITEM_SOUNDS,
  soundForHen, soundForAnimal, soundForEgg, soundForItem,
  soundForBuy, soundForAction, soundForHatchReward,
  soundForMiniGame, soundForSocial, MINI_GAME_SOUNDS,
} from '../src/lib/game-sounds'

test('every hen breed in game.ts has a voice', () => {
  for (const key of Object.keys(HEN_TYPES)) {
    expect(HEN_SOUNDS[key], `hen ${key}`).toBeDefined()
    expect(hasVoice(HEN_SOUNDS[key]), `voice for hen ${key}`).toBe(true)
    expect(hasVoice(soundForHen(key))).toBe(true)
  }
})

test('every animal in game.ts has a voice', () => {
  for (const key of Object.keys(ANIMAL_TYPES)) {
    expect(ANIMAL_SOUNDS[key], `animal ${key}`).toBeDefined()
    expect(hasVoice(ANIMAL_SOUNDS[key]), `voice for animal ${key}`).toBe(true)
  }
})

test('every egg type in game.ts has a voice', () => {
  for (const key of Object.keys(EGG_TYPES)) {
    expect(EGG_SOUNDS[key], `egg ${key}`).toBeDefined()
    expect(hasVoice(EGG_SOUNDS[key]), `voice for egg ${key}`).toBe(true)
  }
})

test('every inventory item in game.ts has a voice', () => {
  for (const key of Object.keys(ITEM_TYPES)) {
    expect(ITEM_SOUNDS[key], `item ${key}`).toBeDefined()
    expect(hasVoice(ITEM_SOUNDS[key]), `voice for item ${key}`).toBe(true)
  }
})

test('unknown type keys fall back instead of throwing', () => {
  expect(hasVoice(soundForHen('dragon_hen_999'))).toBe(true)
  expect(hasVoice(soundForAnimal('unicorn'))).toBe(true)
  expect(hasVoice(soundForEgg('plasma'))).toBe(true)
  expect(hasVoice(soundForItem('warp_drive'))).toBe(true)
})

test('buy resolves by payload: the animal you bought is the sound you hear', () => {
  expect(soundForBuy('hen', 'golden')).toBe('hen_golden')
  expect(soundForBuy('hen', 'magic')).toBe('hen_magic')
  expect(soundForBuy('animal', 'cow')).toBe('cow')
  expect(soundForBuy('animal', 'duck')).toBe('duck')
  expect(soundForBuy('animal', 'cat')).toBe('cat')
  expect(soundForBuy('egg', 'diamond')).toBe('egg_diamond')
  expect(soundForBuy('egg', 'mystery')).toBe('egg_mystery')
  expect(soundForBuy('item', 'medicine')).toBe('item_medicine')
  expect(soundForBuy('item', 'feed_sack')).toBe('item_sack')
  expect(soundForBuy('building', 'incubator')).toBe('build')
  expect(soundForBuy('feed', 'corn')).toBe('feed')
  expect(soundForBuy('upgrade', 'coop')).toBe('build')
  expect(hasVoice(soundForBuy('hen', 'nope'))).toBe(true)
})

test('every server action maps to a real voice (or null for unknown)', () => {
  const actions = [
    'collect_hens', 'collect_animals', 'feed', 'buy', 'use_item', 'breed',
    'sell_eggs', 'incubate', 'open_egg', 'speedup', 'claim_daily',
    'claim_level_reward', 'claim_vip_daily', 'purchase_gems', 'purchase_vip',
    'claim_mission', 'withdraw', 'deposit', 'exchange_gems',
    'list_market', 'buy_market', 'cancel_market',
    'friend_add', 'friend_accept', 'friend_reject', 'friend_remove',
    'gift_friend', 'help_friend',
    'clan_create', 'clan_join', 'clan_leave', 'clan_donate', 'clan_claim',
  ]
  for (const a of actions) {
    const s = soundForAction(a)
    expect(s, `action ${a}`).not.toBeNull()
    expect(hasVoice(s!), `voice for action ${a}`).toBe(true)
  }
})

test('action payload refinement: buying a cow moos, using medicine hisses', () => {
  expect(soundForAction('buy', { itemType: 'animal', subType: 'cow' })).toBe('cow')
  expect(soundForAction('buy', { itemType: 'hen', subType: 'royal' })).toBe('hen_royal')
  expect(soundForAction('buy', { itemType: 'egg', subType: 'diamond' })).toBe('egg_diamond')
  expect(soundForAction('use_item', { itemKey: 'medicine' })).toBe('item_medicine')
  expect(soundForAction('use_item', { itemKey: 'growth_shot' })).toBe('item_growth')
})

test('unknown future actions stay silent instead of playing a wrong sound', () => {
  expect(soundForAction('teleport_farm')).toBeNull()
  expect(soundForAction('')).toBeNull()
})

test('hatch rewards resolve: chick breeds cluck, mutation roars, money clinks', () => {
  expect(soundForHatchReward('chick:normal')).toBe('hen_normal')
  expect(soundForHatchReward('chick:golden')).toBe('hen_golden')
  expect(soundForHatchReward('chick:royal')).toBe('hen_royal')
  expect(soundForHatchReward('chick:magic')).toBe('hen_magic')
  expect(soundForHatchReward('animal:cow')).toBe('cow')
  expect(soundForHatchReward('animal:cat')).toBe('cat')
  expect(soundForHatchReward('mutation:royal')).toBe('dragon')
  expect(soundForHatchReward('coins:150')).toBe('coin')
  expect(soundForHatchReward('gems:5')).toBe('coin')
  expect(soundForHatchReward('item:feed_sack')).toBe('item_sack')
  expect(hasVoice(soundForHatchReward('weird:format'))).toBe(true)
  expect(hasVoice(soundForHatchReward('garbage'))).toBe(true)
})

test('every mini-game moment has a voice', () => {
  const moments = Object.keys(MINI_GAME_SOUNDS) as (keyof typeof MINI_GAME_SOUNDS)[]
  expect(moments.length).toBeGreaterThan(5)
  for (const m of moments) {
    expect(hasVoice(soundForMiniGame(m)), `moment ${m}`).toBe(true)
  }
  expect(soundForMiniGame('jump')).toBe('jump')
  expect(soundForMiniGame('crash')).toBe('crash')
  expect(soundForMiniGame('win')).toBe('win')
  expect(soundForMiniGame('lose')).toBe('game_over')
})

test('social moments resolve', () => {
  expect(soundForSocial('gift_sent')).toBe('gift')
  expect(soundForSocial('gift_received')).toBe('gift')
  expect(soundForSocial('clan_joined')).toBe('build')
  expect(hasVoice(soundForSocial('help'))).toBe(true)
})

test('rarity ladder: rarer hens get brighter voices', () => {
  // documents the design intent: normal < golden < royal < magic
  expect(soundForHen('normal')).not.toBe(soundForHen('golden'))
  expect(soundForHen('golden')).not.toBe(soundForHen('royal'))
  expect(soundForHen('royal')).not.toBe(soundForHen('magic'))
  expect(soundForEgg('normal')).not.toBe(soundForEgg('diamond'))
})
