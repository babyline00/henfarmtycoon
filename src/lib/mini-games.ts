// ═════════════════════════════════════════════════════════════
// PHASE 33 — Mini Games System
//  • Two arcade games: Chicken Run (endless runner) + Chicken Road Crossing (frogger)
//  • Energy-gated plays (server authoritative, VIP regenerates faster)
//  • Server-side reward computation — the client only reports raw
//    telemetry (distance / score / pickup counts) and the server
//    validates plausibility + applies caps before granting anything.
// ═════════════════════════════════════════════════════════════

// ── energy ───────────────────────────────────────────────────

export const MAX_ENERGY = 100
export const ENERGY_REGEN_PER_HOUR = 20 // full refill in 5h
export const VIP_ENERGY_MULT = 2 // VIP regenerates twice as fast

export interface EnergyState {
  energy: number
  max: number
  regenPerHour: number
  nextEnergyInSec: number
  vipFast: boolean
}

export function computeEnergy(
  stored: number,
  updatedAt: Date,
  vipActive: boolean,
  now: Date = new Date()
): EnergyState {
  const regenPerHour = vipActive ? ENERGY_REGEN_PER_HOUR * VIP_ENERGY_MULT : ENERGY_REGEN_PER_HOUR
  const hours = Math.max(0, (now.getTime() - updatedAt.getTime()) / 3600000)
  const regen = Math.floor(hours * regenPerHour)
  const energy = Math.min(MAX_ENERGY, stored + regen)
  const fraction = hours * regenPerHour - regen // 0..1 progress to next point
  const nextEnergyInSec = energy >= MAX_ENERGY ? 0 : Math.ceil(((1 - fraction) / regenPerHour) * 3600)
  return { energy, max: MAX_ENERGY, regenPerHour, nextEnergyInSec, vipFast: vipActive }
}

// ── game definitions ─────────────────────────────────────────

export type MiniGameKey = 'chicken_run' | 'road_crossing'

export interface GameTier {
  key: string
  name: string
  reqLevel: number // farmer numeric level requirement
  mult: number // reward multiplier
  speedMult: number // in-game difficulty multiplier
  desc: string
}

export const GAME_TIERS: GameTier[] = [
  { key: 'farm', name: 'Easy Farm Road', reqLevel: 1, mult: 1.0, speedMult: 1.0, desc: 'Gentle country lanes' },
  { key: 'village', name: 'Village Road', reqLevel: 5, mult: 1.3, speedMult: 1.15, desc: 'Busier village streets' },
  { key: 'city', name: 'City Traffic', reqLevel: 10, mult: 1.6, speedMult: 1.3, desc: 'Rush-hour chaos' },
  { key: 'highway', name: 'Highway Challenge', reqLevel: 20, mult: 2.0, speedMult: 1.5, desc: 'Full-throttle danger' },
  { key: 'legendary', name: 'Legendary Run', reqLevel: 50, mult: 3.0, speedMult: 1.75, desc: 'Only legends survive' },
]

export function tierForLevel(numericLevel: number): number {
  let t = 0
  for (let i = 0; i < GAME_TIERS.length; i++) {
    if (numericLevel >= GAME_TIERS[i].reqLevel) t = i
  }
  return t
}

export interface MiniGameDef {
  key: MiniGameKey
  name: string
  emoji: string
  desc: string
  defaultEnergyCost: number
  color: string
  // tuning used by BOTH client visuals and server validation
  winTarget: number // chicken_run: meters · road_crossing: rows
  coinsPerMeter: number // run only
  coinsPerRow: number // crossing only
  xpCap: number
}

export const MINI_GAME_DEFS: Record<MiniGameKey, MiniGameDef> = {
  chicken_run: {
    key: 'chicken_run', name: 'Chicken Run', emoji: '🏃',
    desc: 'Endless runner — swipe between 3 lanes, jump obstacles, grab eggs, coins & mystery boxes.',
    defaultEnergyCost: 10, color: 'amber',
    winTarget: 1000, coinsPerMeter: 0.5, coinsPerRow: 0, xpCap: 250,
  },
  road_crossing: {
    key: 'road_crossing', name: 'Chicken Road Crossing', emoji: '🚦',
    desc: 'Frogger-style crossing — dodge cars, trucks & tractors, grab power-ups and reach the farm side.',
    defaultEnergyCost: 15, color: 'teal',
    winTarget: 12, coinsPerMeter: 0, coinsPerRow: 40, xpCap: 250,
  },
}

// obstacles (rendered as emoji by the canvas client; purely cosmetic server-side)
export const RUN_OBSTACLES = [
  { key: 'rock', emoji: '🪨', low: true, name: 'Rock' },
  { key: 'barrier', emoji: '🚧', low: true, name: 'Barrier' },
  { key: 'dog', emoji: '🐕', low: true, name: 'Dog' },
  { key: 'car', emoji: '🚗', low: false, name: 'Car' },
  { key: 'tree', emoji: '🌳', low: false, name: 'Tree' },
]
export const CROSS_VEHICLES = [
  { key: 'car', emoji: '🚗', name: 'Car' },
  { key: 'truck', emoji: '🚚', name: 'Truck' },
  { key: 'moto', emoji: '🏍️', name: 'Motorcycle' },
  { key: 'tractor', emoji: '🚜', name: 'Tractor' },
]
export const POWER_UPS = [
  { key: 'shield', emoji: '🛡️', name: 'Shield', desc: 'Invincible for 10s' },
  { key: 'magnet', emoji: '🧲', name: 'Magnet', desc: 'Auto-collect coins' },
  { key: 'speed', emoji: '⚡', name: 'Speed Boost', desc: 'Move faster' },
  { key: 'freeze', emoji: '❄️', name: 'Freeze Time', desc: 'Stop traffic for 5s' },
]

// ── season leaderboard rewards (monthly champion) ────────────
export const SEASON_REWARDS = [
  { rank: 1, prize: 'Legendary Dragon Hen', emoji: '🐉', detail: 'A legendary Magic Hen joins your coop' },
  { rank: 2, prize: 'Golden Egg ×3', emoji: '🥇', detail: 'Three premium Golden Eggs' },
  { rank: 3, prize: '5,000 Gems', emoji: '💎', detail: 'A mountain of premium gems' },
]

// ── server-authoritative validation + reward math ────────────

// Plausibility bounds — anything beyond these is physically
// impossible for a human and treated as cheating.
export const RUN_MAX_SPEED_MPS = 30 // generous: ~108 km/h top theoretical
export const RUN_MAX_DURATION_SEC = 300
export const CROSS_MIN_SEC_PER_ROW = 1.0 // fastest realistic row advance
export const CROSS_MAX_DURATION_SEC = 600

export interface RunTelemetry {
  distance: number
  coins: number // pickups claimed
  eggs: number
  gems: number
  boxes: number
}

export interface CrossTelemetry {
  score: number // rows reached
  coins: number
  powerUps: number
}

export interface RewardOutcome {
  ok: boolean
  cheated: boolean
  reason?: string
  result: 'win' | 'loss' | 'rejected'
  coins: number
  eggs: number
  gems: number
  xp: number
  mysteryItem?: string | null
  lines: string[] // human-readable reward breakdown
}

function tierMultOf(tier: number): number {
  return GAME_TIERS[Math.min(tier, GAME_TIERS.length - 1)]?.mult ?? 1
}

function capN(v: number, max: number): number {
  return Math.max(0, Math.min(Math.floor(v), max))
}

export function evaluateRun(
  tel: RunTelemetry,
  tier: number,
  durationSec: number
): RewardOutcome {
  const lines: string[] = []
  const dist = Math.max(0, Math.floor(tel.distance))

  // ── anti-cheat validation ──
  if (durationSec > RUN_MAX_DURATION_SEC) {
    return { ok: false, cheated: true, reason: 'Session duration exceeded limit', result: 'rejected', coins: 0, eggs: 0, gems: 0, xp: 0, lines }
  }
  const maxDist = Math.floor(durationSec * RUN_MAX_SPEED_MPS)
  if (dist > maxDist) {
    return { ok: false, cheated: true, reason: `Distance ${dist}m impossible in ${durationSec}s`, result: 'rejected', coins: 0, eggs: 0, gems: 0, xp: 0, lines }
  }
  const mult = tierMultOf(tier)

  // pickups capped by plausible pickup density
  const maxCoins = Math.floor(dist / 30)
  const maxEggs = Math.floor(dist / 120)
  const maxGems = Math.floor(dist / 600)
  const maxBoxes = Math.floor(dist / 400)
  const coins = capN(tel.coins, maxCoins)
  const eggs = capN(tel.eggs, maxEggs)
  const gems = capN(tel.gems, maxGems)
  const boxes = capN(tel.boxes, maxBoxes)

  const win = dist >= MINI_GAME_DEFS.chicken_run.winTarget
  const pickupCoins = Math.floor(coins * 12)
  const baseCoins = Math.floor(dist * MINI_GAME_DEFS.chicken_run.coinsPerMeter)
  const winBonus = win ? Math.floor(300 * mult) : 0
  const totalCoins = Math.floor((baseCoins + pickupCoins + winBonus) * mult)
  const totalXp = Math.min(MINI_GAME_DEFS.chicken_run.xpCap, Math.floor(dist / 15) + (win ? 50 : 0))

  if (baseCoins > 0) lines.push(`🏃 ${dist}m run → 🪙 ${baseCoins}`)
  if (coins > 0) lines.push(`🪙 ${coins} coin pickups → 🪙 ${pickupCoins}`)
  if (eggs > 0) lines.push(`🥚 ${eggs} egg(s) collected`)
  if (gems > 0) lines.push(`💎 ${gems} gem(s) collected`)
  if (winBonus > 0) lines.push(`🏆 Victory bonus → 🪙 ${winBonus} (×${mult} tier)`)
  if (mult > 1) lines.push(`⚡ ${GAME_TIERS[tier]?.name ?? 'Tier'} multiplier ×${mult}`)
  if (boxes > 0) lines.push(`🎁 ${boxes} mystery box(es) opened`)

  return {
    ok: true, cheated: false, result: win ? 'win' : 'loss',
    coins: totalCoins, eggs, gems, xp: totalXp,
    mysteryItem: boxes > 0 ? 'true' : null, // caller rolls actual item
    lines,
  }
}

export function evaluateCross(
  tel: CrossTelemetry,
  tier: number,
  durationSec: number
): RewardOutcome {
  const lines: string[] = []
  const score = Math.max(0, Math.floor(tel.score))

  if (durationSec > CROSS_MAX_DURATION_SEC) {
    return { ok: false, cheated: true, reason: 'Session duration exceeded limit', result: 'rejected', coins: 0, eggs: 0, gems: 0, xp: 0, lines }
  }
  const maxRows = Math.floor(durationSec / CROSS_MIN_SEC_PER_ROW) + 2
  if (score > maxRows) {
    return { ok: false, cheated: true, reason: `${score} rows impossible in ${durationSec}s`, result: 'rejected', coins: 0, eggs: 0, gems: 0, xp: 0, lines }
  }
  const mult = tierMultOf(tier)
  const maxCoins = score * 4
  const coins = capN(tel.coins, maxCoins)

  const win = score >= MINI_GAME_DEFS.road_crossing.winTarget
  const rowCoins = Math.floor(score * MINI_GAME_DEFS.road_crossing.coinsPerRow)
  const pickupCoins = coins * 10
  const winBonus = win ? Math.floor(250 * mult) : 0
  const totalCoins = Math.floor((rowCoins + pickupCoins + winBonus) * mult)
  const eggs = Math.floor(score / 6) // every 6 rows = 1 egg
  const gems = win && tier >= 2 ? 2 : win ? 1 : 0
  const totalXp = Math.min(MINI_GAME_DEFS.road_crossing.xpCap, score * 4 + (win ? 50 : 0))

  if (score > 0) lines.push(`🚦 ${score} roads crossed → 🪙 ${rowCoins}`)
  if (coins > 0) lines.push(`🪙 ${coins} coin pickups → 🪙 ${pickupCoins}`)
  if (eggs > 0) lines.push(`🥚 ${eggs} egg(s) earned`)
  if (gems > 0) lines.push(`💎 ${gems} gem(s) earned`)
  if (winBonus > 0) lines.push(`🏆 Victory bonus → 🪙 ${winBonus} (×${mult} tier)`)
  if (mult > 1) lines.push(`⚡ ${GAME_TIERS[tier]?.name ?? 'Tier'} multiplier ×${mult}`)

  return {
    ok: true, cheated: false, result: win ? 'win' : 'loss',
    coins: totalCoins, eggs, gems, xp: totalXp,
    mysteryItem: null,
    lines,
  }
}

// mystery box → random inventory item key
export const MYSTERY_ITEMS = ['feed_sack', 'vitamin', 'medicine', 'xp_tonic', 'growth_shot', 'egg_charm']
export function rollMysteryItem(): string {
  return MYSTERY_ITEMS[Math.floor(Math.random() * MYSTERY_ITEMS.length)]
}
