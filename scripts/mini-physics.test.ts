// Tests for the mini-game physics contract.
//
// The two canvas games and the server validator now import the same
// constants from lib/mini-games. They used to carry their own, and the
// anti-cheat rejected honest play twice over:
//
//   • Chicken Run: the client's ceiling is 24 m/s x the tier multiplier,
//     so "city" (1.3) reached 31.2 m/s against a hand-picked 30 m/s cap.
//     From level 10 up, running at full speed was "impossible" and the
//     account was flagged.
//   • Road Crossing: the client advanced a row every 0.17 s while the
//     server demanded one per second, so a legitimate 12-row crossing came
//     back rejected.
//
// These tests exist so the two sides cannot drift apart again. The
// important property is not a specific number — it is that the validator
// is never tighter than the physics the player is actually subjected to.
//
//   bun test scripts/mini-physics.test.ts

import { test, expect } from 'bun:test'

import {
  RUN_START_SPEED_MPS, RUN_BASE_SPEED_MPS, RUN_RAMP_METRES,
  CROSS_MIN_SEC_PER_ROW, CROSS_MIN_SEC_PER_ROW_FAST,
  CROSS_HOP_INPUT_COOLDOWN, CROSS_HOP_INPUT_COOLDOWN_FAST,
  GAME_TIERS, MINI_GAME_DEFS,
  speedMultOf, runMaxSpeedMps, runMaxDistance, crossMaxRows,
  crossWinTarget, winTargetFor,
  evaluateRun, evaluateCross, evaluateCatch,
  catchMaxItems, catchSpawnRate, catchFallSpeed, CATCH_MAX_DURATION_SEC,
  type RunTelemetry, type CrossTelemetry,
} from '../src/lib/mini-games'

const MAX_TIER = GAME_TIERS.length - 1

// ── the contract holds ────────────────────────────────────────

test('every tier is playable at full speed without tripping the cap', () => {
  // The regression that started this: a player at the client's own ceiling
  // must never exceed what the validator will accept.
  for (let tier = 0; tier <= MAX_TIER; tier++) {
    const maxSpeed = runMaxSpeedMps(tier)
    // A three-second run at the ceiling must be accepted.
    const outcome = evaluateRun({ distance: Math.floor(maxSpeed * 3), coins: 0, eggs: 0, gems: 0, boxes: 0 }, tier, 3)
    expect(outcome.cheated, `tier ${tier} at ${maxSpeed.toFixed(1)} m/s`).toBe(false)
    expect(outcome.ok, `tier ${tier}`).toBe(true)
  }
})

test('the speed ceiling actually grows with the tier', () => {
  expect(runMaxSpeedMps(0)).toBeCloseTo(RUN_BASE_SPEED_MPS, 5)
  expect(runMaxSpeedMps(MAX_TIER)).toBeGreaterThan(runMaxSpeedMps(0))
  // strictly increasing
  for (let t = 1; t <= MAX_TIER; t++) {
    expect(runMaxSpeedMps(t)).toBeGreaterThan(runMaxSpeedMps(t - 1))
  }
})

test('speedMultOf clamps out-of-range tiers instead of returning NaN', () => {
  expect(speedMultOf(-5)).toBe(1)
  expect(speedMultOf(99)).toBe(speedMultOf(MAX_TIER))
  expect(Number.isFinite(speedMultOf(99))).toBe(true)
})

test('the cap still rejects genuinely impossible distance', () => {
  // Well past any tier's ceiling, including headroom.
  for (let tier = 0; tier <= MAX_TIER; tier++) {
    const impossible = Math.ceil(runMaxSpeedMps(tier) * 10) // ten seconds' worth
    const outcome = evaluateRun({ distance: impossible, coins: 0, eggs: 0, gems: 0, boxes: 0 }, tier, 1)
    expect(outcome.cheated, `tier ${tier} should reject ${impossible}m in 1s`).toBe(true)
    expect(outcome.coins).toBe(0)
    expect(outcome.result).toBe('rejected')
  }
})

test('a longer run is allowed proportionally further', () => {
  const d10 = runMaxDistance(0, 10)
  const d20 = runMaxDistance(0, 20)
  expect(d20).toBeGreaterThan(d10)
  expect(d20 / d10).toBeCloseTo(2, 0)
})

// ── road crossing pacing ──────────────────────────────────────

test('the fastest honest row rate is accepted, the impossible is not', () => {
  // A player using the speed power-up advances a row every
  // CROSS_MIN_SEC_PER_ROW_FAST. The validator must allow exactly that.
  const seconds = 12
  const fastestHonest = Math.floor(seconds / CROSS_MIN_SEC_PER_ROW_FAST)
  const ok = evaluateCross({ score: fastestHonest, coins: 0, powerUps: 0 }, 0, seconds)
  expect(ok.cheated, `${fastestHonest} rows in ${seconds}s should be allowed`).toBe(false)

  const impossible = fastestHonest + 40
  const bad = evaluateCross({ score: impossible, coins: 0, powerUps: 0 }, 0, seconds)
  expect(bad.cheated).toBe(true)
  expect(bad.result).toBe('rejected')
})

test('the speed power-up genuinely buys a faster row rate', () => {
  // If the power-up did not lower the floor it would be a dead pickup: the
  // server's cap would swallow the difference.
  expect(CROSS_MIN_SEC_PER_ROW_FAST).toBeLessThan(CROSS_MIN_SEC_PER_ROW)
  expect(CROSS_HOP_INPUT_COOLDOWN_FAST).toBeLessThan(CROSS_HOP_INPUT_COOLDOWN)
  // The input lockout must stay below the pacing floor, or the power-up
  // would be unable to take effect.
  expect(CROSS_HOP_INPUT_COOLDOWN).toBeLessThan(CROSS_MIN_SEC_PER_ROW)
  expect(CROSS_HOP_INPUT_COOLDOWN_FAST).toBeLessThan(CROSS_MIN_SEC_PER_ROW_FAST)
})

test('a full win at the base tier is always accepted', () => {
  // The regression: 12 rows in 3 seconds was rejected outright.
  const target = MINI_GAME_DEFS.road_crossing.winTarget
  for (let tier = 0; tier <= MAX_TIER; tier++) {
    const needed = winTargetFor('road_crossing', tier)
    // The fastest a player can legitimately clear the target, powered up.
    const seconds = needed * CROSS_MIN_SEC_PER_ROW_FAST + 0.2
    const out = evaluateCross({ score: needed, coins: 0, powerUps: 0 }, tier, seconds)
    expect(out.cheated, `tier ${tier}: ${needed} rows in ${seconds.toFixed(1)}s`).toBe(false)
    expect(out.result, `tier ${tier} should have won`).toBe('win')
  }
  expect(target).toBeGreaterThan(0)
})

// ── win target is one number, not two ─────────────────────────

test('the win target scales with the tier and both sides agree', () => {
  const base = MINI_GAME_DEFS.road_crossing.winTarget
  expect(crossWinTarget(0, base)).toBe(base)
  expect(crossWinTarget(MAX_TIER, base)).toBeGreaterThan(base)
  // monotonic
  for (let t = 1; t <= MAX_TIER; t++) {
    expect(crossWinTarget(t, base)).toBeGreaterThan(crossWinTarget(t - 1, base))
  }
  // clamps out of range
  expect(crossWinTarget(-1, base)).toBe(base)
  expect(crossWinTarget(99, base)).toBe(crossWinTarget(MAX_TIER, base))
})

test('a run one row short of the tier target is a loss, not a win', () => {
  // The mismatch that let the server pay a win the client never showed.
  for (let tier = 0; tier <= MAX_TIER; tier++) {
    const needed = winTargetFor('road_crossing', tier)
    const seconds = needed * CROSS_MIN_SEC_PER_ROW_FAST + 0.2
    const out = evaluateCross({ score: needed - 1, coins: 0, powerUps: 0 }, tier, seconds)
    expect(out.result, `tier ${tier} at ${needed - 1} rows`).toBe('loss')
  }
})

test('chicken run target does not scale with the tier', () => {
  // It has no road density to fight, so scaling it would be an unearned
  // difficulty curve.
  const base = MINI_GAME_DEFS.chicken_run.winTarget
  for (let tier = 0; tier <= MAX_TIER; tier++) {
    expect(winTargetFor('chicken_run', tier)).toBe(base)
  }
})

test('winTargetFor is total: an unknown game gets 0 rather than throwing', () => {
  expect(winTargetFor('nonsense', 0)).toBe(0)
  expect(winTargetFor('nonsense', 3)).toBe(0)
})

// ── reward maths sanity ───────────────────────────────────────

test('rewards are zero for a rejected run', () => {
  const out = evaluateRun({ distance: 999999, coins: 50, eggs: 5, gems: 5, boxes: 5 }, 0, 1)
  expect(out.ok).toBe(false)
  expect(out.coins).toBe(0)
  expect(out.xp).toBe(0)
  expect(out.eggs).toBe(0)
})

test('pickup counts are capped by plausible density', () => {
  const dist = 600
  const greedy: RunTelemetry = { distance: dist, coins: 9999, eggs: 9999, gems: 9999, boxes: 9999 }
  const out = evaluateRun(greedy, 0, 60)
  expect(out.coins).toBeLessThan(9999 * 12)
  expect(out.eggs).toBeLessThanOrEqual(Math.floor(dist / 120))
  expect(out.gems).toBeLessThanOrEqual(Math.floor(dist / 600))
  // boxes only roll a single item, so the count is not returned — assert on
  // the flag rather than a field the outcome type does not carry.
  expect(out.mysteryItem).toBe('true')
})

test('a higher tier pays more for identical honest play', () => {
  const tel: RunTelemetry = { distance: 500, coins: 5, eggs: 1, gems: 0, boxes: 0 }
  const low = evaluateRun(tel, 0, 60)
  const high = evaluateRun(tel, MAX_TIER, 60)
  expect(high.coins).toBeGreaterThan(low.coins)
})

test('a longer run never pays less than a shorter one', () => {
  let prev = -1
  for (const d of [0, 50, 200, 600, 1000]) {
    const out = evaluateRun({ distance: d, coins: 0, eggs: 0, gems: 0, boxes: 0 }, 0, 120)
    expect(out.coins).toBeGreaterThanOrEqual(prev)
    prev = out.coins
  }
})

test('negative and non-finite telemetry cannot mint rewards', () => {
  const nasty: RunTelemetry = { distance: -50, coins: -10, eggs: -1, gems: -1, boxes: -1 }
  const out = evaluateRun(nasty, 0, 60)
  expect(out.coins).toBeGreaterThanOrEqual(0)
  expect(out.eggs).toBeGreaterThanOrEqual(0)
  const inf = evaluateRun({ distance: Infinity, coins: 0, eggs: 0, gems: 0, boxes: 0 }, 0, 60)
  expect(Number.isFinite(inf.coins)).toBe(true)
})

test('row and distance caps grow with the duration given', () => {
  expect(crossMaxRows(60)).toBeGreaterThan(crossMaxRows(6))
  expect(runMaxDistance(0, 60)).toBeGreaterThan(runMaxDistance(0, 6))
  // and are never negative
  expect(crossMaxRows(0)).toBeGreaterThanOrEqual(0)
  expect(runMaxDistance(0, 0)).toBeGreaterThanOrEqual(0)
})

test('the speed ramp constants describe an increasing curve', () => {
  expect(RUN_START_SPEED_MPS).toBeLessThan(RUN_BASE_SPEED_MPS)
  expect(RUN_RAMP_METRES).toBeGreaterThan(0)
  // distance to reach the ceiling
  const rampDistance = (RUN_BASE_SPEED_MPS - RUN_START_SPEED_MPS) * RUN_RAMP_METRES
  expect(rampDistance).toBeGreaterThan(0)
})

// ── Egg Catch ────────────────────────────────────────────────

test('the catch allowance equals the spawn ramp, not a guess', () => {
  // The cap is the integral of the rate ramp, so it must track it.
  for (const d of [1, 5, 30, 60, 120]) {
    const steps = Math.ceil(d / 0.25)
    let manual = 0
    for (let i = 0; i < steps; i++) manual += catchSpawnRate(i * 0.25) * 0.25
    expect(catchMaxItems(d), `${d}s`).toBe(Math.floor(manual) + 2)
  }
})

test('the allowance grows with time and is never negative', () => {
  expect(catchMaxItems(60)).toBeGreaterThan(catchMaxItems(6))
  expect(catchMaxItems(0)).toBeGreaterThanOrEqual(0)
  expect(catchMaxItems(-5)).toBeGreaterThanOrEqual(0)
})

test('an honest full-win run is accepted', () => {
  const target = MINI_GAME_DEFS.egg_catch.winTarget
  for (let tier = 0; tier <= MAX_TIER; tier++) {
    const out = evaluateCatch({ eggs: target, coins: 4, gems: 1, boxes: 1, missed: 3 }, tier, 60)
    expect(out.cheated, `tier ${tier}`).toBe(false)
    expect(out.result).toBe('win')
    expect(out.coins).toBeGreaterThan(0)
  }
})

test('more catches than can physically fall is rejected', () => {
  for (const d of [1, 5, 20]) {
    const out = evaluateCatch({ eggs: 500, coins: 0, gems: 0, boxes: 0, missed: 0 }, 0, d)
    expect(out.cheated, `${d}s`).toBe(true)
    expect(out.coins).toBe(0)
    expect(out.reason).toMatch(/impossible/)
  }
})

test('the allowance is shared across categories, not per-category', () => {
  // A client must not claim the full allowance in eggs AND again in coins:
  // it is the SUM that is physically bounded.
  const allowance = catchMaxItems(20)
  const half = Math.floor(allowance / 2)
  const ok = evaluateCatch({ eggs: half, coins: half, gems: 0, boxes: 0, missed: 0 }, 0, 20)
  expect(ok.cheated, `${half}+${half} vs allowance ${allowance}`).toBe(false)
  const over = evaluateCatch({ eggs: half, coins: half + 5, gems: 0, boxes: 0, missed: 0 }, 0, 20)
  expect(over.cheated, 'a sum over the allowance must be rejected').toBe(true)
})

test('gems stay a rare payout however many are claimed', () => {
  const out = evaluateCatch({ eggs: 5, coins: 5, gems: 40, boxes: 0, missed: 0 }, 0, 60)
  expect(out.gems).toBeLessThanOrEqual(3)
})

test('a run longer than the server will accept is rejected outright', () => {
  const out = evaluateCatch({ eggs: 1, coins: 0, gems: 0, boxes: 0, missed: 0 }, 0, CATCH_MAX_DURATION_SEC + 5)
  expect(out.cheated).toBe(true)
  expect(out.reason).toMatch(/duration/i)
})

test('negative and non-finite catch telemetry cannot mint anything', () => {
  const out = evaluateCatch({ eggs: -50, coins: -9, gems: -9, boxes: -9, missed: -1 }, 0, 60)
  expect(out.coins).toBeGreaterThanOrEqual(0)
  expect(out.gems).toBeGreaterThanOrEqual(0)
  const inf = evaluateCatch({ eggs: Infinity, coins: 0, gems: 0, boxes: 0, missed: 0 }, 0, 60)
  expect(Number.isFinite(inf.coins)).toBe(true)
})

test('the fall-speed ramp only ever speeds up, and is clamped', () => {
  expect(catchFallSpeed(0)).toBeLessThan(catchFallSpeed(25))
  expect(catchFallSpeed(25)).toBeLessThan(catchFallSpeed(100))
  expect(catchFallSpeed(9999)).toBe(catchFallSpeed(100))
  expect(catchFallSpeed(-5)).toBe(catchFallSpeed(0))
})

test('every registered game has a definition, a target and a cost', () => {
  for (const key of ['chicken_run', 'road_crossing', 'egg_catch'] as const) {
    expect(MINI_GAME_DEFS[key], key).toBeDefined()
    expect(winTargetFor(key, 0)).toBeGreaterThan(0)
    expect(MINI_GAME_DEFS[key].defaultEnergyCost).toBeGreaterThan(0)
    expect(MINI_GAME_DEFS[key].name.length).toBeGreaterThan(0)
  }
})
