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
  RUN_COMBO_CAP, RUN_COMBO_STEP, catchOverlapsBasket, CATCH_FALL_MAX,
  type RunTelemetry, type CrossTelemetry, type CatchTelemetry,
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

// ── combo: a server rule, not a client counter ───────────────

test('a combo pays more, and only for pickups actually claimed', () => {
  const base: RunTelemetry = { distance: 900, coins: 20, eggs: 3, gems: 1, boxes: 0, combo: 0 }
  const comboed: RunTelemetry = { ...base, combo: 20 }
  const plain = evaluateRun(base, 0, 90)
  const hot = evaluateRun(comboed, 0, 90)
  expect(hot.coins).toBeGreaterThan(plain.coins)
  expect(hot.coins).toBeLessThanOrEqual(plain.coins * 2) // capped at +100%
})

test('a forged combo cannot exceed the pickups collected', () => {
  // The whole point: claiming a 500 streak while collecting 3 coins must
  // not buy the multiplier.
  const honest: RunTelemetry = { distance: 900, coins: 20, eggs: 3, gems: 1, boxes: 0, combo: 0 }
  const forged: RunTelemetry = { ...honest, combo: 500 }
  const a = evaluateRun(honest, 0, 90)
  const b = evaluateRun(forged, 0, 90)
  // 24 pickups collected, so the streak is clamped to 24 (and to the cap)
  expect(b.coins).toBeLessThan(a.coins * 2)
  // and it is exactly what a legitimate 24-streak would pay
  const legit = evaluateRun({ ...honest, combo: 24 }, 0, 90)
  expect(b.coins).toBe(legit.coins)
})

test('the combo multiplier is capped, so it cannot run away', () => {
  const max = evaluateRun({ distance: 900, coins: 20, eggs: 3, gems: 1, boxes: 0, combo: 9999 }, 0, 90)
  const capped = evaluateRun({ distance: 900, coins: 20, eggs: 3, gems: 1, boxes: 0, combo: RUN_COMBO_CAP }, 0, 90)
  expect(max.coins).toBe(capped.coins)
  expect(capped.coins).toBeLessThan(evaluateRun({ distance: 900, coins: 20, eggs: 3, gems: 1, boxes: 0, combo: 0 }, 0, 90).coins * 2.01)
})

test('a negative or non-finite combo is treated as no combo', () => {
  const base: RunTelemetry = { distance: 900, coins: 20, eggs: 3, gems: 1, boxes: 0, combo: 0 }
  const none = evaluateRun(base, 0, 90)
  for (const c of [-50, NaN, Infinity]) {
    const out = evaluateRun({ ...base, combo: c }, 0, 90)
    expect(out.coins, `combo=${c}`).toBe(none.coins)
  }
})

test('a combo with no pickups at all pays nothing extra', () => {
  const out = evaluateRun({ distance: 900, coins: 0, eggs: 0, gems: 0, boxes: 0, combo: 50 }, 0, 90)
  const plain = evaluateRun({ distance: 900, coins: 0, eggs: 0, gems: 0, boxes: 0, combo: 0 }, 0, 90)
  expect(out.coins).toBe(plain.coins)
})

test('the combo ceiling is exactly the documented one', () => {
  expect(RUN_COMBO_CAP).toBe(20)
  expect(RUN_COMBO_STEP).toBeCloseTo(0.05, 6)
  // cap 20 x 5% = +100%
  expect(1 + RUN_COMBO_CAP * RUN_COMBO_STEP).toBeCloseTo(2, 6)
})

// ── a non-finite field must never defeat the plausibility gate ──
// `Math.max(0, NaN)` is NaN and `NaN > limit` is false, so every evaluator
// was one bad field away from paying NaN and skipping its own anti-cheat
// check. The route normalises input, but these functions are the security
// boundary and are called directly by tests, so they hold on their own.

const NON_FINITE = [NaN, Infinity, -Infinity]

test('evaluateRun never pays NaN and never passes a bad distance', () => {
  const base: RunTelemetry = { distance: 900, coins: 5, eggs: 1, gems: 0, boxes: 0 }
  const honest = evaluateRun(base, 0, 60)
  for (const d of NON_FINITE) {
    const out = evaluateRun({ ...base, distance: d as number }, 0, 60)
    expect(Number.isFinite(out.coins), `distance=${d}`).toBe(true)
    expect(Number.isFinite(out.xp), `distance=${d}`).toBe(true)
    // a field that cannot be read counts as nothing claimed
    expect(out.coins, `distance=${d}`).toBe(0)
  }
  expect(honest.coins).toBeGreaterThan(0)
})

test('evaluateRun rejects a non-finite distance as cheating, not as a free pass', () => {
  // Infinity is a genuinely impossible distance, so it must be rejected
  // outright rather than quietly clamped to a losing 0-metre run.
  for (const d of [Infinity, -Infinity]) {
    const out = evaluateRun({ distance: d as number }, 0, 60)
    expect(out.cheated, `distance=${d}`).toBe(true)
    expect(out.result).toBe('rejected')
  }
})

test('evaluateCross never pays NaN and never passes a bad score', () => {
  const honest = evaluateCross({ score: 40, coins: 4 }, 0, 60)
  for (const s of NON_FINITE) {
    const out = evaluateCross({ score: s as number, coins: 4 }, 0, 60)
    expect(Number.isFinite(out.coins), `score=${s}`).toBe(true)
    expect(Number.isFinite(out.eggs), `score=${s}`).toBe(true)
    expect(Number.isFinite(out.gems), `score=${s}`).toBe(true)
    expect(out.coins, `score=${s}`).toBe(0)
  }
  expect(honest.coins).toBeGreaterThan(0)
})

test('evaluateCross rejects an infinite row count as cheating', () => {
  for (const s of [Infinity, -Infinity]) {
    const out = evaluateCross({ score: s as number }, 0, 60)
    expect(out.cheated, `score=${s}`).toBe(true)
    expect(out.result).toBe('rejected')
  }
})

test('evaluateCatch cannot walk through the allowance with a non-finite field', () => {
  // The whole bound on this game is `claimed > allowance`. Summing raw
  // Math.floor values let one NaN make the sum NaN, and NaN never exceeds
  // anything, so the check silently passed.
  for (const v of NON_FINITE) {
    const out = evaluateCatch({ eggs: v as number, coins: 99999 }, 0, 60)
    expect(out.cheated, `eggs=${v}`).toBe(true)
    expect(out.result).toBe('rejected')
  }
})

test('every reward field is finite for garbage telemetry', () => {
  // Belt and braces: whatever arrives, nothing may come out non-finite,
  // because NaN written into the coins column is not recoverable.
  const garbage = { distance: NaN, coins: NaN, eggs: NaN, gems: NaN, boxes: NaN, combo: NaN }
  const run = evaluateRun(garbage, 0, 60)
  for (const k of ['coins', 'eggs', 'gems', 'xp'] as const) {
    expect(Number.isFinite(run[k]), `run.${k}`).toBe(true)
  }
  const cross = evaluateCross({ score: NaN, coins: NaN, powerUps: NaN }, 0, 60)
  for (const k of ['coins', 'eggs', 'gems', 'xp'] as const) {
    expect(Number.isFinite(cross[k]), `cross.${k}`).toBe(true)
  }
  const catchOut = evaluateCatch({ eggs: NaN, coins: NaN, gems: NaN, boxes: NaN }, 0, 60)
  for (const k of ['coins', 'eggs', 'gems', 'xp'] as const) {
    expect(Number.isFinite(catchOut[k]), `catch.${k}`).toBe(true)
  }
})

test('an unreadable field is sanitised, never flagged, and never inflates a payout', () => {
  // The other half of the isImpossible split, and the reason it exists:
  // falsely accusing an honest player is worse than paying them nothing.
  // A NaN pickup must therefore be worth exactly what a zero pickup is
  // worth — not less (a penalty) and certainly not more.
  const clean: RunTelemetry = { distance: 900, coins: 0, eggs: 0, gems: 0, boxes: 0 }
  const baseline = evaluateRun(clean, 0, 60)
  for (const key of ['coins', 'eggs', 'gems', 'boxes', 'combo'] as const) {
    const out = evaluateRun({ ...clean, [key]: NaN }, 0, 60)
    expect(out.cheated, key).toBe(false)
    expect(out.coins, key).toBe(baseline.coins)
  }
  const crossClean: CrossTelemetry = { score: 40, coins: 0, powerUps: 0 }
  const crossBase = evaluateCross(crossClean, 0, 60)
  for (const key of ['coins', 'powerUps'] as const) {
    const out = evaluateCross({ ...crossClean, [key]: NaN }, 0, 60)
    expect(out.cheated, key).toBe(false)
    expect(out.coins, key).toBe(crossBase.coins)
  }
})

test('an infinite SCORE is rejected, because no client can earn it', () => {
  // JSON can carry these: 1e999 parses to Infinity and the route's num()
  // passes it straight through, so this is reachable from the wire. The
  // distance and row count come from a bounded simulation, so an infinite
  // one is a cheat and not a broken client.
  expect(evaluateRun({ distance: 1e999 as number }, 0, 60).cheated).toBe(true)
  expect(evaluateCross({ score: 1e999 as number, coins: 0, powerUps: 0 }, 0, 60).cheated).toBe(true)
  // In Egg Catch the total IS the score, so every field is guarded.
  const catchCases: CatchTelemetry[] = [
    { eggs: 1e999 as number, coins: 0, gems: 0, boxes: 0 },
    { eggs: 0, coins: 1e999 as number, gems: 0, boxes: 0 },
    { eggs: 0, coins: 0, gems: 1e999 as number, boxes: 0 },
    { eggs: 0, coins: 0, gems: 0, boxes: 1e999 as number },
  ]
  for (const tel of catchCases) {
    expect(evaluateCatch(tel, 0, 60).cheated, JSON.stringify(tel)).toBe(true)
  }
})

test('a non-finite pickup count is clamped rather than treated as a cheat', () => {
  // Deliberate, and the asymmetry with the test above is the point: a
  // pickup count is density-capped anyway, so clamping it to zero loses no
  // protection, whereas flagging it would risk a false accusation for a
  // client bug. The bound that matters — the score — is still enforced.
  const out = evaluateRun({ distance: 900, coins: 1e999 as number, eggs: 0, gems: 0, boxes: 0 }, 0, 60)
  expect(out.cheated).toBe(false)
  expect(out.coins).toBe(evaluateRun({ distance: 900, coins: 0, eggs: 0, gems: 0, boxes: 0 }, 0, 60).coins)
})

// ── a client may omit any field it likes ──
// The telemetry interfaces are all-optional for this reason, so these are
// the same code path a garbage value takes, reached by a different route.

test('an omitted field is treated as zero, not as a crash or a pass', () => {
  expect(evaluateRun({}, 0, 60).coins).toBe(0)
  expect(evaluateRun({ distance: 1000 }, 0, 60).result).toBe('win')
  expect(evaluateRun({ distance: 900, coins: undefined, eggs: undefined }, 0, 60).cheated).toBe(false)
  expect(evaluateCross({}, 0, 60).coins).toBe(0)
  expect(evaluateCross({ score: 10 }, 0, 60).result).toBe('loss')
  expect(evaluateCatch({}, 0, 60).coins).toBe(0)
  expect(evaluateCatch({ eggs: 40 }, 0, 60).result).toBe('win')
})

test('omitting the score never accidentally satisfies a win', () => {
  // The dangerous direction: a missing field must never read as a large one.
  expect(evaluateRun({ coins: 9999 }, 0, 60).result).toBe('loss')
  expect(evaluateCross({ coins: 9999 }, 0, 60).result).toBe('loss')
  // Egg Catch goes further: its only bound is the catch allowance, so an
  // absurd claim there is rejected outright rather than paid as a loss.
  expect(evaluateCatch({ coins: 9999 }, 0, 60).result).toBe('rejected')
})

// ── Egg Catch: the basket must catch what passes through it ──
// The regression this locks down is invisible at 60fps and brutal at 20:
// the catch band is 60 logical units tall and one frame at the top tier
// covers 67.5, so a point-sampled collision stepped items straight over.

const BASKET_Y_TEST = 638
const BAND_TEST = 30
const BASKET_W_TEST = 150
/** One frame at tier 3 (fall 540, speedMult 2.5) with dt pinned to its cap. */
const WORST_FRAME = CATCH_FALL_MAX * 2.5 * 0.05

test('one frame can cover more than the whole catch band', () => {
  // If this ever stops being true the bug cannot reproduce, so the test that
  // follows would pass for the wrong reason. Assert the hazard explicitly.
  expect(WORST_FRAME).toBeGreaterThan(BAND_TEST * 2)
})

test('a swept catch fires even when a point sample would miss', () => {
  // The item lands inside the basket's x span and passes straight through the
  // band centre, but no single sampled position is inside the band.
  const prevY = BASKET_Y_TEST - WORST_FRAME / 2
  const nextY = prevY + WORST_FRAME
  const pointSampled = (y: number) => Math.abs(y - BASKET_Y_TEST) <= BAND_TEST
  expect(pointSampled(prevY) || pointSampled(nextY)).toBe(false)
  expect(catchOverlapsBasket(prevY, nextY, BASKET_Y_TEST, BAND_TEST)).toBe(true)
})

test('the catch is frame-rate independent', () => {
  // The same fall, sliced at 144fps and at 20fps, must reach the basket in
  // both cases. This is the property point sampling never had.
  const from = BASKET_Y_TEST - 200
  for (const fps of [144, 60, 30, 20, 15, 12]) {
    const step = (CATCH_FALL_MAX * 2.5) / fps
    let y = from
    let caught = false
    for (let i = 0; i < 20000 && !caught; i++) {
      const prev = y
      y += step
      if (catchOverlapsBasket(prev, y, BASKET_Y_TEST, BAND_TEST)) caught = true
    }
    expect(caught, `${fps}fps`).toBe(true)
  }
})

test('an item that never reaches the band, or starts past it, is not caught', () => {
  // Still short of the band.
  expect(catchOverlapsBasket(0, BASKET_Y_TEST - BAND_TEST - 1, BASKET_Y_TEST, BAND_TEST)).toBe(false)
  // Already below the band when the frame starts.
  expect(catchOverlapsBasket(BASKET_Y_TEST + BAND_TEST + 1, BASKET_Y_TEST + BAND_TEST + 50, BASKET_Y_TEST, BAND_TEST)).toBe(false)
  // Exactly touching each edge still counts.
  expect(catchOverlapsBasket(0, BASKET_Y_TEST - BAND_TEST, BASKET_Y_TEST, BAND_TEST)).toBe(true)
})

test('a stationary item inside the band is caught', () => {
  expect(catchOverlapsBasket(BASKET_Y_TEST, BASKET_Y_TEST, BASKET_Y_TEST, BAND_TEST)).toBe(true)
  expect(catchOverlapsBasket(BASKET_Y_TEST - 5, BASKET_Y_TEST + 5, BASKET_Y_TEST, BAND_TEST)).toBe(true)
})

test('degenerate input cannot produce a catch', () => {
  for (const bad of [NaN, Infinity, -Infinity]) {
    expect(catchOverlapsBasket(bad, 0, BASKET_Y_TEST, BAND_TEST), `prevY=${bad}`).toBe(false)
    expect(catchOverlapsBasket(0, bad, BASKET_Y_TEST, BAND_TEST), `nextY=${bad}`).toBe(false)
    expect(catchOverlapsBasket(0, 0, bad, BAND_TEST), `basketY=${bad}`).toBe(false)
    expect(catchOverlapsBasket(0, 0, BASKET_Y_TEST, bad), `band=${bad}`).toBe(false)
  }
  // a negative band would invert the window and catch everything
  expect(catchOverlapsBasket(0, 0, BASKET_Y_TEST, -5)).toBe(false)
})
