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

export type MiniGameKey = 'chicken_run' | 'road_crossing' | 'egg_catch'

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
  egg_catch: {
    key: 'egg_catch', name: 'Egg Catch', emoji: '🥚',
    desc: 'Catcher — sweep the basket, scoop eggs and coins, and keep the rocks out.',
    defaultEnergyCost: 8, color: 'green',
    winTarget: 25, coinsPerMeter: 0, coinsPerRow: 0, xpCap: 250,
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

// ── physics contract ─────────────────────────────────────────
// ONE source of truth, imported by both the canvas games and the server
// validator. This module is deliberately dependency-free so the client can
// import it without dragging the server along.
//
// It exists because the two used to disagree, and the anti-cheat was the
// side that lost. Two bugs came out of it:
//
//   • Chicken Run's cap was a hand-picked 30 m/s while the client's own
//     speed ceiling is 24 m/s × the tier multiplier. On the "city" tier
//     that is 31.2 m/s, so a player running at full speed was rejected as
//     a cheater — and flagged for review — from level 10 upward.
//   • Road Crossing's cap demanded 1 row/second while the client let you
//     advance a row every 0.17 s. Crossing the 12-row win target took 2
//     seconds of honest play and the server voided it.
//
// Deriving the bounds from the same constants the game runs on is the fix.
// A validator that disagrees with the physics is not a validator.

// ── Chicken Run ──
/** Speed the ramp starts at. */
export const RUN_START_SPEED_MPS = 8
/** Speed the ramp tops out at, before the tier multiplier. */
export const RUN_BASE_SPEED_MPS = 24
/** Metres over which the ramp climbs from start to ceiling. */
export const RUN_RAMP_METRES = 140
export const RUN_MAX_DURATION_SEC = 300
/** Jump arc length, in metres-equivalent pixels. Mirrors the client. */
export const RUN_JUMP_HEIGHT = 72

/**
 * Combo economics. Each step in an unbroken pickup chain is worth
 * RUN_COMBO_STEP more of the coin pickup value, and the chain that counts
 * is capped at RUN_COMBO_CAP so the ceiling is +100% rather than
 * unbounded. A streak cannot exceed the pickups actually collected, which
 * is what makes it unforgeable.
 */
export const RUN_COMBO_STEP = 0.05
export const RUN_COMBO_CAP = 20

// ── Road Crossing ──
/**
 * Minimum seconds between advancing a row. This is a pacing rule, not
 * just an anti-cheat bound: at 0.17 s per hop a 12-row crossing finished
 * in two seconds, which is too short to read the traffic, let alone
 * survive it.
 */
export const CROSS_MIN_SEC_PER_ROW = 1.0
/** With the ⚡ speed power-up the floor drops, so the power-up is real. */
export const CROSS_MIN_SEC_PER_ROW_FAST = 0.6
/** Minimum seconds between hop *inputs*, which stops double-tapping a row. */
export const CROSS_HOP_INPUT_COOLDOWN = 0.17
export const CROSS_HOP_INPUT_COOLDOWN_FAST = 0.10
export const CROSS_MAX_DURATION_SEC = 600

// ── Egg Catch ──
/**
 * The first game to run on a fixed LOGICAL field rather than raw pixels.
 * The other two derive their geometry from `canvas.clientWidth`, so the
 * same session plays differently on a phone and a desktop, and their
 * collision maths moves with the viewport. Egg Catch simulates in logical
 * units and scales only at draw time, so behaviour is identical on every
 * screen — which is also what makes the plausibility maths below exact.
 */
export const CATCH_FIELD_W = 1000
export const CATCH_FIELD_H = 700
/** Catch rate at the start of a run, items/second. */
export const CATCH_RATE_START = 1.8
/** …and once the ramp completes. */
export const CATCH_RATE_MAX = 3.6
/** Seconds over which the rate ramps. */
export const CATCH_RAMP_SEC = 45
/** Fall speed, logical units/second. */
export const CATCH_FALL_START = 220
export const CATCH_FALL_MAX = 540
export const CATCH_FALL_RAMP_SEC = 50
export const CATCH_MAX_DURATION_SEC = 180
/** Egg Catch's target does not scale with the tier. */
export const CATCH_MAX_CATCH_RATE = CATCH_RATE_MAX

export function catchFallSpeed(sec: number): number {
  const t = Math.min(1, Math.max(0, sec / CATCH_FALL_RAMP_SEC))
  return CATCH_FALL_START + (CATCH_FALL_MAX - CATCH_FALL_START) * t
}

export function catchSpawnRate(sec: number): number {
  const t = Math.min(1, Math.max(0, sec / CATCH_RAMP_SEC))
  return CATCH_RATE_START + (CATCH_RATE_MAX - CATCH_RATE_START) * t
}

/**
 * Whether a falling item swept from `prevY` to `nextY` passes through the
 * basket's catch band.
 *
 * This exists as a pure function, and is swept rather than point-sampled,
 * because point sampling is not merely imprecise here — it is wrong at the
 * frame rates phones actually run at. The band is only
 * `CATCH_BAND * 2 = 60` logical units tall, while one frame at the top tier
 * covers `catchFallSpeed * speedMult * dt` = 540 * 2.5 * 0.05 = 67.5 units.
 * A 20fps frame therefore stepped an item clean over the whole band: it
 * visibly fell through the basket and scored nothing, and the worse the
 * frame rate the more often that happened.
 *
 * Overlap of the traversed segment [prevY, nextY] with the band
 * [basketY - band, basketY + band] holds unless the item has not reached the
 * band yet (nextY above its top) or started past it (prevY below its base).
 */
export function catchOverlapsBasket(
  prevY: number,
  nextY: number,
  basketY: number,
  band: number,
): boolean {
  if (!Number.isFinite(prevY) || !Number.isFinite(nextY)) return false
  if (!Number.isFinite(basketY) || !Number.isFinite(band) || band < 0) return false
  return nextY >= basketY - band && prevY <= basketY + band
}

/**
 * Most items that can possibly have fallen in `durationSec`. Integral of
 * the spawn rate, sampled rather than solved so it tracks the ramp exactly
 * — this is the anti-cheat ceiling for catches.
 */
export function catchMaxItems(durationSec: number): number {
  const STEP = 0.25
  let total = 0
  for (let t = 0; t < durationSec; t += STEP) {
    total += catchSpawnRate(t) * STEP
  }
  return Math.floor(total) + 2
}

// ── how much slop the validator allows ───────────────────────
// A real client has frame jitter, a throttled tab and network latency, so
// the validator has to be a little more generous than the client. It must
// never be *tighter*, or skill is punished as cheating.
const SPEED_HEADROOM = 1.15
const ROW_HEADROOM = 2

/**
 * The longest any game session may legitimately last, in seconds.
 *
 * Derived rather than hard-coded so retuning a single game's cap cannot leave
 * the abandoned-session sweep expiring runs that are still legal. It is the
 * threshold past which a 'playing' session is provably over: the server would
 * reject a finish for exceeding the cap, so no honest client could still be
 * holding one open.
 */
export const MAX_SESSION_SEC = Math.max(
  RUN_MAX_DURATION_SEC,
  CROSS_MAX_DURATION_SEC,
  CATCH_MAX_DURATION_SEC,
)

/**
 * Grace added before a session is treated as abandoned.
 *
 * Without it the sweep and the evaluator disagree by a rounding step. The
 * evaluator accepts a finish while `duration <= cap`, but duration is
 * `floor(age)`, so a session aged 600.4s on a 600s cap still reports a legal
 * 600 — and retiring it at exactly 600s would refuse an honest payout that
 * the rules say is valid. The margin covers the gap plus the network round
 * trip of the final finish call, so housekeeping can never void a legal run.
 */
export const ABANDON_GRACE_SEC = 30

/** Age past which a 'playing' session can no longer legitimately be finished. */
export const ABANDON_AFTER_SEC = MAX_SESSION_SEC + ABANDON_GRACE_SEC

export function speedMultOf(tier: number): number {
  return GAME_TIERS[Math.min(Math.max(0, tier), GAME_TIERS.length - 1)]?.speedMult ?? 1
}

/** Fastest the client can actually move on a tier, m/s. */
export function runMaxSpeedMps(tier: number): number {
  return RUN_BASE_SPEED_MPS * speedMultOf(tier)
}

/**
 * Road Crossing needs one more row to win on harder tiers, so the tier
 * target has to be a function of the tier rather than a constant. The
 * server publishes this and the client uses it — previously the client
 * added its own `tier * 4` while the server compared against the bare
 * target, so on a high tier the server declared a win the client never
 * showed, and the player kept hopping toward a goal that had already
 * paid out.
 */
export function crossWinTarget(tier: number, baseTarget: number): number {
  return baseTarget + Math.min(Math.max(0, tier), GAME_TIERS.length - 1) * 4
}

/**
 * The win target for a game on a tier. Road Crossing needs one more row per
 * tier because the roads get busier; Chicken Run does not scale its
 * target. Published to the client at session start so the two can never
 * disagree about when a run is won.
 */
export function winTargetFor(gameKey: string, tier: number): number {
  const base = MINI_GAME_DEFS[gameKey as keyof typeof MINI_GAME_DEFS]?.winTarget ?? 0
  // Only Road Crossing scales: its roads get busier with the tier, so the
  // crossing has to get longer. The others keep a fixed target.
  return gameKey === 'road_crossing' ? crossWinTarget(tier, base) : base
}

/** Plausibility ceiling for a run, in metres, for a given duration. */
export function runMaxDistance(tier: number, durationSec: number): number {
  return Math.floor(durationSec * runMaxSpeedMps(tier) * SPEED_HEADROOM)
}

/** Plausibility ceiling for rows crossed in a given duration. */
export function crossMaxRows(durationSec: number): number {
  return Math.floor(durationSec / CROSS_MIN_SEC_PER_ROW_FAST) + ROW_HEADROOM
}

// Every field is optional on purpose. This is the validator's input, and a
// hostile client is free to omit anything — so the type has to describe what
// can actually arrive, not what a well-behaved client sends. It also means a
// missing field exercises the same `toCount` path a garbage one does,
// instead of being a case TypeScript quietly ruled out.
export interface RunTelemetry {
  distance?: number
  coins?: number // pickups claimed
  eggs?: number
  gems?: number
  boxes?: number
  /** Longest unbroken chain of pickups. Validated, never trusted. */
  combo?: number
}

export interface CrossTelemetry {
  score?: number // rows reached
  coins?: number
  powerUps?: number
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

/**
 * Coerce telemetry to a non-negative whole number.
 *
 * `Math.max(0, Math.floor(v))` is NOT safe on its own: Math.max(0, NaN) is
 * NaN, so a single non-finite field propagates through the whole reward
 * calculation and the payout becomes NaN. The route sanitises its input,
 * but this is the security boundary and it is called directly by tests, so
 * it has to hold on its own.
 */
function toCount(v: number | undefined): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) return 0
  return Math.max(0, Math.floor(v))
}

function capN(v: number | undefined, max: number): number {
  return Math.min(toCount(v), Math.max(0, Math.floor(max)))
}

/**
 * Whether a claimed score is infinite — a physically impossible claim.
 *
 * This is deliberately NOT the same as "unreadable". An honest client cannot
 * produce an infinite distance or row count: both come from a bounded
 * simulation, and JSON can carry an infinite number as 1e999, so this is
 * reachable from the wire and it is unambiguously a cheat.
 *
 * NaN is the opposite case — an unreadable field, which is far more likely
 * to be a broken client than an attack. It is sanitised to zero and simply
 * earns nothing, because falsely flagging an honest player is the worse
 * failure. Collapsing the two cases into one `toCount` call would have
 * quietly downgraded cheat detection on a reachable input.
 */
function isImpossible(v: number | undefined): boolean {
  return v === Infinity || v === -Infinity
}

export function evaluateRun(
  tel: RunTelemetry,
  tier: number,
  durationSec: number
): RewardOutcome {
  const lines: string[] = []
  // toCount, not Math.max(0, Math.floor(...)): Math.max(0, NaN) is NaN, so a
  // non-finite distance slipped straight through the `dist > maxDist` gate
  // (NaN > n is false), then poisoned every derived number and paid NaN.
  const dist = toCount(tel.distance)

  // ── anti-cheat validation ──
  if (isImpossible(tel.distance)) {
    return { ok: false, cheated: true, reason: 'Distance is not a finite number', result: 'rejected', coins: 0, eggs: 0, gems: 0, xp: 0, lines }
  }
  if (durationSec > RUN_MAX_DURATION_SEC) {
    return { ok: false, cheated: true, reason: 'Session duration exceeded limit', result: 'rejected', coins: 0, eggs: 0, gems: 0, xp: 0, lines }
  }
  const maxDist = runMaxDistance(tier, durationSec)
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

  // ── combo ──
  // A chain of unbroken pickups pays more, which is the whole reason to
  // take a risky line for one collectible instead of playing safe. The
  // multiplier is a SERVER rule applied to a SERVER-validated number: a
  // client may claim any combo it likes, but a streak longer than the
  // pickups actually collected is impossible — you cannot chain 40
  // pickups while claiming 3 — so it is capped to the total collected,
  // with the bonus itself capped on top. Nothing here can be inflated by
  // editing telemetry.
  const totalPickups = coins + eggs + gems + boxes
  const claimedCombo = toCount(tel.combo)
  const combo = Math.min(claimedCombo, totalPickups, RUN_COMBO_CAP)
  const comboMult = 1 + combo * RUN_COMBO_STEP
  const pickupCoins = Math.floor(coins * 12 * comboMult)
  const baseCoins = Math.floor(dist * MINI_GAME_DEFS.chicken_run.coinsPerMeter)
  const winBonus = win ? Math.floor(300 * mult) : 0
  const totalCoins = Math.floor((baseCoins + pickupCoins + winBonus) * mult)
  const totalXp = Math.min(MINI_GAME_DEFS.chicken_run.xpCap, Math.floor(dist / 15) + (win ? 50 : 0))

  if (baseCoins > 0) lines.push(`🏃 ${dist}m run → 🪙 ${baseCoins}`)
  if (coins > 0) lines.push(`🪙 ${coins} coin pickups → 🪙 ${pickupCoins}`)
  if (combo >= 2) lines.push(`🔥 ${combo}-pickup combo → ×${comboMult.toFixed(2)}`)
  else if (claimedCombo > combo) lines.push(`🔥 combo capped at ${combo} (you collected ${totalPickups})`)
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
  const score = toCount(tel.score) // same NaN gate-bypass as evaluateRun

  if (isImpossible(tel.score)) {
    return { ok: false, cheated: true, reason: 'Row count is not a finite number', result: 'rejected', coins: 0, eggs: 0, gems: 0, xp: 0, lines }
  }
  if (durationSec > CROSS_MAX_DURATION_SEC) {
    return { ok: false, cheated: true, reason: 'Session duration exceeded limit', result: 'rejected', coins: 0, eggs: 0, gems: 0, xp: 0, lines }
  }
  const maxRows = crossMaxRows(durationSec)
  if (score > maxRows) {
    return { ok: false, cheated: true, reason: `${score} rows impossible in ${durationSec}s`, result: 'rejected', coins: 0, eggs: 0, gems: 0, xp: 0, lines }
  }
  const mult = tierMultOf(tier)
  const maxCoins = score * 4
  const coins = capN(tel.coins, maxCoins)

  // The win threshold is tier-dependent, and this is the same function the
  // client is given at session start. Comparing against the bare base
  // target here meant a hard-tier player was paid a win the client never
  // displayed.
  const win = score >= crossWinTarget(tier, MINI_GAME_DEFS.road_crossing.winTarget)
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

// ── Egg Catch ────────────────────────────────────────────────

export interface CatchTelemetry {
  /** Eggs scooped into the basket. This is the score. */
  eggs?: number
  coins?: number
  gems?: number
  boxes?: number
  /** Items that fell past the basket. Informational; does not gate rewards. */
  missed?: number
}

/**
 * The catcher.
 *
 * Every count is capped by the number of items that can physically have
 * fallen in the time given — `catchMaxItems` integrates the spawn-rate
 * ramp — so a client cannot claim catches it could not have made. The
 * cap is shared, not per-category, because it is the *total* number of
 * falling items that is bounded; splitting it would let a client claim
 * the full allowance in every category at once.
 */
export function evaluateCatch(
  tel: CatchTelemetry,
  tier: number,
  durationSec: number
): RewardOutcome {
  const lines: string[] = []
  // Each field goes through toCount individually. Summing raw Math.floor
  // values meant one NaN made the whole total NaN, and `NaN > allowance` is
  // false — so a single bad field walked straight through the plausibility
  // gate that is the only thing bounding this game.
  const claimed = toCount(tel.eggs) + toCount(tel.coins) + toCount(tel.gems) + toCount(tel.boxes)

  if (durationSec > CATCH_MAX_DURATION_SEC) {
    return { ok: false, cheated: true, reason: 'Session duration exceeded limit', result: 'rejected', coins: 0, eggs: 0, gems: 0, xp: 0, lines }
  }
  if (isImpossible(tel.eggs) || isImpossible(tel.coins) || isImpossible(tel.gems) || isImpossible(tel.boxes)) {
    return { ok: false, cheated: true, reason: 'Catch count is not a finite number', result: 'rejected', coins: 0, eggs: 0, gems: 0, xp: 0, lines }
  }

  const allowance = catchMaxItems(durationSec)
  if (claimed > allowance) {
    return {
      ok: false, cheated: true,
      reason: `${claimed} catches impossible in ${durationSec}s (at most ${allowance} can fall)`,
      result: 'rejected', coins: 0, eggs: 0, gems: 0, xp: 0, lines,
    }
  }

  const mult = tierMultOf(tier)
  const def = MINI_GAME_DEFS.egg_catch
  const eggs = capN(tel.eggs, allowance)
  const coins = capN(tel.coins, Math.max(0, allowance - eggs))
  const gemsCaught = capN(tel.gems, Math.max(0, allowance - eggs - coins))
  const boxes = capN(tel.boxes, Math.max(0, allowance - eggs - coins - gemsCaught))

  const win = eggs >= def.winTarget
  const eggCoins = eggs * 6
  const pickupCoins = coins * 10 + gemsCaught * 40
  const winBonus = win ? Math.floor(200 * mult) : 0
  const totalCoins = Math.floor((eggCoins + pickupCoins + winBonus) * mult)
  // Gems are a rare payout, so a handful is the ceiling however many were
  // claimed — otherwise gems dominate every other reward in the game.
  const gems = Math.min(3, gemsCaught)
  const totalXp = Math.min(def.xpCap, eggs * 3 + coins + (win ? 50 : 0))

  if (eggs > 0) lines.push(`🥚 ${eggs} egg(s) scooped → 🪙 ${eggCoins}`)
  if (coins > 0) lines.push(`🪙 ${coins} coin(s) → 🪙 ${coins * 10}`)
  if (gemsCaught > 0) lines.push(`💎 ${gemsCaught} gem(s) → 🪙 ${gemsCaught * 40}`)
  if (winBonus > 0) lines.push(`🏆 Victory bonus → 🪙 ${winBonus} (×${mult} tier)`)
  if (mult > 1) lines.push(`⚡ ${GAME_TIERS[tier]?.name ?? 'Tier'} multiplier ×${mult}`)
  if (boxes > 0) lines.push(`🎁 ${boxes} mystery box(es) opened`)

  return {
    ok: true, cheated: false, result: win ? 'win' : 'loss',
    coins: totalCoins, eggs: 0, gems, xp: totalXp,
    mysteryItem: boxes > 0 ? 'true' : null,
    lines,
  }
}

// mystery box → random inventory item key
export const MYSTERY_ITEMS = ['feed_sack', 'vitamin', 'medicine', 'xp_tonic', 'growth_shot', 'egg_charm']
export function rollMysteryItem(): string {
  return MYSTERY_ITEMS[Math.floor(Math.random() * MYSTERY_ITEMS.length)]
}
