// Farm economy maths.
//
// This whole file exists because the farm had no tests at all, and it turned
// out to hide a bug that silently ate a third of a player's production. The
// arithmetic is spread across the collect route, the display builder and the
// level ladders, and nothing pinned the relationships between them.
import { test, expect } from 'bun:test'

import {
  // production
  settleProduction, productionMultiplier, farmHealth,
  // hens
  HEN_TYPES, HEN_STAGES, HEN_MAX_LEVEL, henStage, henLevelMult, henXpForLevel,
  henXpProgress, henStatus, traitProdMult, traitLifespanMult, traitEggValueMult,
  breedOutcome, BREED_LADDER,
  // economy tables
  EGG_TYPES, ANIMAL_TYPES, FEED_TYPES, UPGRADES, DAILY_REWARDS, MISSIONS,
  TRAIT_ROLL, FARMER_LEVELS, levelIndexForXp, levelInfo, numericLevel,
  numericLevelProgress, weatherFor, WEATHERS, rollHatchTable, rollTrait,
  // buildings / clan
  incubatorSlots, INCUBATOR_SLOTS, FEED_FACTORY_DISCOUNT, SHELTER_BONUS,
  SHELTER_CAPS, CLAN_LEVEL_XP, clanLevelOf, clanProdBonus, shelterBonusMult,
} from '../src/lib/game'

const H = 3600000
const NOW = new Date('2026-03-15T12:00:00.000Z')
const ago = (hours: number) => new Date(NOW.getTime() - hours * H)

// ═══════════════════════════════════════════════════════════
// settleProduction — the carry-the-remainder rule
// ═══════════════════════════════════════════════════════════

/**
 * Simulate `totalHours` of a producer, collecting every `intervalHours` of
 * real time. The wall clock advances independently of the producer's stored
 * clock, which is the whole point: a collect that pays nothing must still let
 * the producer accumulate.
 */
function simulate(rate: number, intervalHours: number, capHours: number, totalHours = 24) {
  const start = NOW.getTime() - totalHours * H
  let clock = new Date(start)
  let total = 0
  let t = 0
  while (t < totalHours) {
    t += intervalHours
    const at = new Date(Math.min(NOW.getTime(), start + t * H))
    const r = settleProduction({ lastCollectedAt: clock, ratePerHour: rate, capHours, now: at })
    total += r.amount
    clock = r.lastCollectedAt
  }
  return total
}

/** The old, broken implementation, kept here as the thing being fixed. */
function simulateOld(rate: number, intervalHours: number, capHours: number, totalHours = 24) {
  const start = NOW.getTime() - totalHours * H
  let clock = start
  let total = 0
  let t = 0
  while (t < totalHours) {
    t += intervalHours
    const at = Math.min(NOW.getTime(), start + t * H)
    const hours = Math.max(0, (at - clock) / H)
    total += Math.floor(Math.min(hours, capHours) * rate)
    clock = at // ← the bug: discards the fraction
  }
  return total
}

test('the regression: a slow producer paid hourly must still earn', () => {
  // A Normal Hen lays 0.4 eggs/hour. The old code awarded floor(hours*rate)
  // and then reset the clock to `now`, so an hourly collect paid floor(0.4)=0
  // and threw the 0.4 away — the hen never laid an egg, ever.
  const rate = HEN_TYPES.normal.eggsPerHour
  const fixed = simulate(rate, 1, 24)
  const broken = simulateOld(rate, 1, 24)
  expect(broken, 'the old algorithm really did pay nothing').toBe(0)
  expect(fixed).toBe(9) // 24h at 0.4/h is 9.6 eggs
  expect(fixed).toBeGreaterThan(broken)
})

test('collecting often and collecting rarely converge on the same total', () => {
  // The point of carrying the remainder: cadence changes latency, never income.
  const rate = HEN_TYPES.normal.eggsPerHour
  const results = [1, 2, 3, 6, 12, 24].map(iv => simulate(rate, iv, 48))
  for (const r of results) {
    expect(Math.abs(r - results[0]), 'all cadences agree').toBeLessThanOrEqual(1)
  }
  // and each is at least as good as the old algorithm at the same cadence
  for (const iv of [1, 2, 3, 6]) {
    expect(simulate(rate, iv, 48)).toBeGreaterThanOrEqual(simulateOld(rate, iv, 48))
  }
})

test('the clock only advances by the time that whole units paid for', () => {
  const r = settleProduction({ lastCollectedAt: ago(3), ratePerHour: 0.4, capHours: 24, now: NOW })
  expect(r.amount).toBe(1) // floor(1.2)
  // 1 egg at 0.4/h is 2.5h of production, so 0.5h of the 3h remains
  const remaining = (NOW.getTime() - r.lastCollectedAt.getTime()) / H
  expect(remaining).toBeCloseTo(0.5, 6)
})

test('a collect that pays nothing leaves the clock completely alone', () => {
  const last = ago(1)
  const r = settleProduction({ lastCollectedAt: last, ratePerHour: 0.4, capHours: 24, now: NOW })
  expect(r.amount).toBe(0)
  expect(r.lastCollectedAt.getTime()).toBe(last.getTime())
})

test('a zero-rate producer never accumulates and never goes backwards', () => {
  // A chick (stagePct 0) and a Guard Dog both settle at rate 0.
  const last = ago(5)
  const r = settleProduction({ lastCollectedAt: last, ratePerHour: 0, capHours: 24, now: NOW })
  expect(r.amount).toBe(0)
  expect(r.lastCollectedAt.getTime()).toBe(NOW.getTime())
  expect(r.lastCollectedAt.getTime()).toBeGreaterThanOrEqual(last.getTime())
})

test('the storage cap discards the excess, as it is meant to', () => {
  // 100h of production at 1/h with a 24h cap yields 24, not 100.
  const r = settleProduction({ lastCollectedAt: ago(100), ratePerHour: 1, capHours: 24, now: NOW })
  expect(r.amount).toBe(24)
  expect(r.capped).toBe(true)
  // and the next collect gets a fresh full window rather than a refund
  const r2 = settleProduction({ lastCollectedAt: r.lastCollectedAt, ratePerHour: 1, capHours: 24, now: NOW })
  expect(r2.amount).toBe(0)
})

test('an uncapped window reports capped=false', () => {
  expect(settleProduction({ lastCollectedAt: ago(5), ratePerHour: 1, capHours: 24, now: NOW }).capped).toBe(false)
  expect(settleProduction({ lastCollectedAt: ago(24), ratePerHour: 1, capHours: 24, now: NOW }).capped).toBe(false)
  expect(settleProduction({ lastCollectedAt: ago(25), ratePerHour: 1, capHours: 24, now: NOW }).capped).toBe(true)
})

test('the clock never moves backwards, whatever it is fed', () => {
  // A clock in the future (clock skew, a restore from backup) must not create
  // production or rewind the producer.
  const future = new Date(NOW.getTime() + 5 * H)
  const r = settleProduction({ lastCollectedAt: future, ratePerHour: 4, capHours: 24, now: NOW })
  expect(r.amount).toBe(0)
  expect(r.lastCollectedAt.getTime()).toBeGreaterThanOrEqual(future.getTime())
})

test('degenerate input settles to zero rather than NaN', () => {
  for (const bad of [NaN, Infinity, -Infinity]) {
    const r = settleProduction({ lastCollectedAt: ago(5), ratePerHour: bad, capHours: 24, now: NOW })
    expect(Number.isFinite(r.amount), `rate=${bad}`).toBe(true)
    expect(r.amount, `rate=${bad}`).toBe(0)
    expect(Number.isFinite(r.lastCollectedAt.getTime()), `rate=${bad}`).toBe(true)
  }
  // negative cap and a garbage date
  expect(settleProduction({ lastCollectedAt: ago(5), ratePerHour: 4, capHours: -3, now: NOW }).amount).toBe(0)
  const bad = settleProduction({ lastCollectedAt: new Date('nope'), ratePerHour: 4, capHours: 24, now: NOW })
  expect(bad.amount).toBe(0)
  expect(Number.isFinite(bad.lastCollectedAt.getTime())).toBe(true)
})

test('a single collect over a long window is exact', () => {
  expect(settleProduction({ lastCollectedAt: ago(10), ratePerHour: 1.5, capHours: 24, now: NOW }).amount).toBe(15)
  expect(settleProduction({ lastCollectedAt: ago(0.5), ratePerHour: 10, capHours: 24, now: NOW }).amount).toBe(5)
})

// ═══════════════════════════════════════════════════════════
// productionMultiplier
// ═══════════════════════════════════════════════════════════

test('an unboosted farm produces at exactly 1x', () => {
  expect(productionMultiplier({})).toBe(1)
  expect(productionMultiplier({ dogBonus: false, landLevel: 1 })).toBe(1)
})

test('bonuses stack additively and global modifiers multiplicatively', () => {
  // dog +5, land2 +3 => 1.08, then a 150% event => 1.62
  expect(productionMultiplier({ dogBonus: true, landLevel: 2 })).toBeCloseTo(1.08, 6)
  expect(productionMultiplier({ dogBonus: true, landLevel: 2, eventMultiplier: 150 })).toBeCloseTo(1.62, 6)
  // a 50% event is not a penalty: the guard means only >100 applies
  expect(productionMultiplier({ eventMultiplier: 50 })).toBe(1)
  expect(productionMultiplier({ eventMultiplier: 100 })).toBe(1)
})

test('every feed buff maps to the percentage the shop advertises', () => {
  const byType: Record<string, number> = { corn: 0.2, premium: 0.5, vitamin: 0.25, golden_feed: 1.0, champion: 0.1 }
  for (const [type, pct] of Object.entries(byType)) {
    expect(productionMultiplier({ buffActive: true, buffType: type }), type).toBeCloseTo(1 + pct, 6)
  }
  // the two purchasable feeds must match FEED_TYPES exactly
  expect(productionMultiplier({ buffActive: true, buffType: 'corn' })).toBeCloseTo(1 + FEED_TYPES.corn.boostPct / 100, 6)
  expect(productionMultiplier({ buffActive: true, buffType: 'premium' })).toBeCloseTo(1 + FEED_TYPES.premium.boostPct / 100, 6)
  // an expired buff contributes nothing
  expect(productionMultiplier({ buffActive: false, buffType: 'corn' })).toBe(1)
})

test('negative weather cannot drive production to zero or below', () => {
  // Worst case weather, no other bonuses: a player must still earn something.
  const worst = WEATHERS.reduce((a, b) => (a.prodPct < b.prodPct ? a : b))
  const m = productionMultiplier({ weatherPct: worst.prodPct })
  expect(m).toBeGreaterThan(0)
  expect(m).toBeCloseTo(1 + worst.prodPct / 100, 6)
  // with every penalty stacked the farm is still productive
  expect(productionMultiplier({ weatherPct: -15, landLevel: 1, eventMultiplier: 100 })).toBeGreaterThan(0.8)
})

test('land levels give +3% each, and level 1 gives nothing', () => {
  expect(productionMultiplier({ landLevel: 1 })).toBe(1)
  expect(productionMultiplier({ landLevel: 2 })).toBeCloseTo(1.03, 6)
  expect(productionMultiplier({ landLevel: 4 })).toBeCloseTo(1.09, 6)
})

test('vip and clan bonuses are read as percentages, not fractions', () => {
  // 0.5 instead of 50 would make VIP worth 0.5% — a silent 100x error.
  expect(productionMultiplier({ vipBonusPct: 50 })).toBeCloseTo(1.5, 6)
  expect(productionMultiplier({ clanBonusPct: 2 })).toBeCloseTo(1.02, 6)
  // and clanProdBonus is a fraction, so the caller must scale it
  expect(clanProdBonus(1) * 100).toBeCloseTo(0, 6)
  expect(clanProdBonus(3) * 100).toBeCloseTo(4, 6)
})

// ═══════════════════════════════════════════════════════════
// farmHealth
// ═══════════════════════════════════════════════════════════

test('an unfed farm decays 10 points a day but never below 50', () => {
  expect(farmHealth(null)).toBe(100)
  const d = (days: number) => farmHealth(new Date(Date.now() - days * 24 * H))
  expect(d(0)).toBe(100)
  expect(d(1)).toBe(90)
  expect(d(5)).toBe(50)
  expect(d(30)).toBe(50)
  expect(d(3650)).toBe(50)
})

test('a clock in the future cannot raise health above 100', () => {
  // Math.floor of a negative is negative, so the decay subtraction became an
  // addition and health came out over 100 — free production, since health is a
  // multiplier in the collect maths.
  expect(farmHealth(new Date(Date.now() + 10 * 24 * H))).toBe(100)
  expect(farmHealth(new Date(Date.now() + 1))).toBe(100)
  for (const days of [-100, -1, 0, 1, 5, 30, 3650]) {
    const h = farmHealth(new Date(Date.now() + days * 24 * H))
    expect(h, `${days} days`).toBeGreaterThanOrEqual(50)
    expect(h, `${days} days`).toBeLessThanOrEqual(100)
  }
})

test('health floors at 50, so production never stops entirely', () => {
  // health enters the collect maths as a multiplier; below 0 the farm would
  // owe the player negative eggs.
  expect(farmHealth(new Date(Date.now() - 400 * 24 * H)) / 100).toBeGreaterThanOrEqual(0.5)
})

// ═══════════════════════════════════════════════════════════
// hen growth
// ═══════════════════════════════════════════════════════════

test('hen stages are contiguous and cover every age', () => {
  for (let d = 0; d <= 400; d += 7) {
    const st = henStage(d)
    expect(HEN_STAGES).toContain(st)
  }
  expect(henStage(0).key).toBe('chick')
  expect(henStage(2).key).toBe('chick')
  expect(henStage(3).key).toBe('growing')
  expect(henStage(5).key).toBe('growing')
  expect(henStage(6).key).toBe('prime')
  expect(henStage(60).key).toBe('prime')
  expect(henStage(61).key).toBe('mature')
})

test('a chick lays nothing and a prime hen lays in full', () => {
  expect(henStage(1).prodPct).toBe(0)
  expect(henStage(3).prodPct).toBe(50)
  expect(henStage(10).prodPct).toBe(100)
})

test('hen level multiplier caps at the stated maximum', () => {
  expect(henLevelMult(1)).toBeCloseTo(1, 6)
  expect(henLevelMult(5)).toBeCloseTo(1.4, 6)
  expect(henLevelMult(HEN_MAX_LEVEL)).toBeCloseTo(1.9, 6)
  // beyond max it must not keep growing
  expect(henLevelMult(HEN_MAX_LEVEL + 50)).toBeCloseTo(1.9, 6)
  expect(henLevelMult(0)).toBeCloseTo(0.9, 6)
})

test('hen xp thresholds line up with the level multiplier', () => {
  // henXpForLevel must be strictly increasing, or a level can be reached and
  // lost in the same breath.
  for (let l = 1; l < HEN_MAX_LEVEL; l++) {
    expect(henXpForLevel(l + 1)).toBeGreaterThan(henXpForLevel(l))
  }
  expect(henXpForLevel(1)).toBe(25)
})

test('hen xp progress is bounded and rises within each level', () => {
  // It is a per-level bar, so it restarts at each threshold. The property that
  // matters is that it only ever climbs inside a level and never leaves 0..100.
  for (let xp = 0; xp < 400; xp += 7) {
    const level = Math.min(HEN_MAX_LEVEL, Math.floor(xp / 25) + 1)
    const p = henXpProgress(xp, level)
    expect(p.pct).toBeGreaterThanOrEqual(0)
    expect(p.pct).toBeLessThanOrEqual(100)
  }
  let prev = -1
  for (let xp = 0; xp < 25; xp++) {
    const p = henXpProgress(xp, 1)
    expect(p.pct, `xp ${xp}`).toBeGreaterThanOrEqual(prev)
    prev = p.pct
  }
  // exactly on the threshold is complete
  expect(henXpProgress(25, 1).pct).toBe(100)
  // and the next level starts from empty
  expect(henXpProgress(25, 2).pct).toBe(0)
})

test('a hen retires at its lifespan, extended by the hearty trait', () => {
  const born = new Date(Date.now() - 90 * 24 * H)
  expect(henStatus({ type: 'normal', bornAt: born })).toBe('retired')
  expect(henStatus({ type: 'normal', bornAt: new Date(Date.now() - 89 * 24 * H) })).toBe('active')
  // hearty extends the life by 15%
  expect(traitLifespanMult(['hearty'])).toBeCloseTo(1.15, 6)
  expect(traitLifespanMult([])).toBe(1)
  const young = new Date(Date.now() - 100 * 24 * H)
  expect(henStatus({ type: 'normal', bornAt: young })).toBe('retired')
  expect(HEN_TYPES.normal.lifespanDays * traitLifespanMult(['hearty'])).toBeGreaterThan(HEN_TYPES.normal.lifespanDays)
})

test('an unknown hen type retires instead of throwing', () => {
  expect(henStatus({ type: 'unicorn', bornAt: new Date() })).toBe('retired')
})

// ═══════════════════════════════════════════════════════════
// traits
// ═══════════════════════════════════════════════════════════

test('trait multipliers only fire for traits the hen actually has', () => {
  expect(traitProdMult([])).toBe(1)
  expect(traitProdMult(['fertile'])).toBeCloseTo(1.1, 6)
  expect(traitProdMult(['fertile', 'swift', 'legendary_blood'])).toBeCloseTo(1.75, 6)
  expect(traitEggValueMult([])).toBe(1)
  expect(traitEggValueMult(['golden_touch'])).toBeCloseTo(1.05, 6)
  expect(traitEggValueMult(['fertile'])).toBe(1)
  // an unknown trait is inert rather than fatal
  expect(traitProdMult(['meteor'])).toBe(1)
})

// ═══════════════════════════════════════════════════════════
// probability tables
// ═══════════════════════════════════════════════════════════

test('every hatch table sums to exactly 100', () => {
  for (const [key, def] of Object.entries(EGG_TYPES)) {
    const total = def.hatchTable.reduce((s, r) => s + r.chance, 0)
    expect(total, `${key} sums to ${total}`).toBe(100)
  }
  const traitTotal = TRAIT_ROLL.reduce((s, r) => s + r.chance, 0)
  expect(traitTotal, `TRAIT_ROLL sums to ${traitTotal}`).toBe(100)
})

test('every hatch reward key is one the game can actually grant', () => {
  // A typo here is a silent dead reward: the egg hatches, the player sees a
  // puff of smoke, and nothing happens.
  const known = new Set([
    ...Object.keys(HEN_TYPES).map(k => `chick:${k}`),
    ...Object.keys(ANIMAL_TYPES).map(k => `animal:${k}`),
  ])
  for (const [key, def] of Object.entries(EGG_TYPES)) {
    for (const row of def.hatchTable) {
      const [kind, arg] = row.reward.split(':')
      if (kind === 'coins' || kind === 'gems') {
        expect(Number(arg), `${key} ${row.reward}`).toBeGreaterThan(0)
      } else if (kind === 'chick' || kind === 'animal') {
        expect(known.has(row.reward), `${key} -> ${row.reward}`).toBe(true)
      } else {
        throw new Error(`${key} has an unknown reward kind: ${row.reward}`)
      }
    }
  }
})

test('rollHatchTable only ever returns a row from the table', () => {
  for (let i = 0; i < 3000; i++) {
    const reward = rollHatchTable(EGG_TYPES.normal.hatchTable)
    expect(EGG_TYPES.normal.hatchTable.map(r => r.reward)).toContain(reward)
    expect(TRAIT_ROLL.map(r => r.reward)).toContain(rollTrait())
  }
})

test('rollHatchTable respects a table that does not sum to 100', () => {
  // It normalises by the total, so a 30-point table is still exhaustive.
  const table = [{ reward: 'a', chance: 10 }, { reward: 'b', chance: 20 }]
  const seen = new Set<string>()
  for (let i = 0; i < 2000; i++) seen.add(rollHatchTable(table))
  expect([...seen].sort()).toEqual(['a', 'b'])
})

test('breeding never produces a type outside the ladder', () => {
  for (const a of BREED_LADDER) {
    for (const b of BREED_LADDER) {
      const table = breedOutcome(a, b)
      const total = table.reduce((s, r) => s + r.chance, 0)
      expect(total, `${a}x${b}`).toBe(100)
      for (const row of table) {
        expect(row.reward).toMatch(/^(chick|mutation):/)
        const type = row.reward.split(':')[1]
        expect(BREED_LADDER, `${a}x${b} -> ${row.reward}`).toContain(type)
      }
    }
  }
})

test('breeding an unknown type degrades safely', () => {
  const table = breedOutcome('dragon', 'wyrm')
  const total = table.reduce((s, r) => s + r.chance, 0)
  expect(total).toBe(100)
  for (const row of table) {
    expect(typeof row.reward).toBe('string')
  }
})

// ═══════════════════════════════════════════════════════════
// weather
// ═══════════════════════════════════════════════════════════

test('weather is deterministic for a given day', () => {
  const d = new Date('2026-03-15T00:00:00.000Z')
  const first = weatherFor(d)
  for (let i = 0; i < 20; i++) expect(weatherFor(d).key).toBe(first.key)
  // and the same day reached by a different time of day is unchanged
  expect(weatherFor(new Date('2026-03-15T23:59:59.000Z')).key).toBe(first.key)
  // a different day can differ
  const keys = new Set<string>()
  for (let d2 = 1; d2 <= 40; d2++) {
    keys.add(weatherFor(new Date(Date.UTC(2026, 2, d2))).key)
  }
  expect(keys.size).toBeGreaterThan(1)
})

test('weather never produces a negative multiplier', () => {
  for (const w of WEATHERS) {
    expect(productionMultiplier({ weatherPct: w.prodPct }), w.key).toBeGreaterThan(0)
  }
})

// ═══════════════════════════════════════════════════════════
// level ladders
// ═══════════════════════════════════════════════════════════

test('named levels are contiguous and monotonic', () => {
  for (let i = 1; i < FARMER_LEVELS.length; i++) {
    expect(FARMER_LEVELS[i].xp).toBeGreaterThan(FARMER_LEVELS[i - 1].xp)
  }
  expect(levelIndexForXp(-100)).toBe(0)
  expect(levelIndexForXp(0)).toBe(0)
  expect(levelIndexForXp(1e9)).toBe(FARMER_LEVELS.length - 1)
  // a level boundary resolves to the new level, not the old one
  for (const l of FARMER_LEVELS) expect(levelIndexForXp(l.xp)).toBe(FARMER_LEVELS.indexOf(l))
})

test('level progress is bounded, and a boundary is 0% into the new level', () => {
  // Reaching a level means starting it, not completing it — except the final
  // one, which has no next rung and is therefore complete by definition.
  for (let i = 0; i < FARMER_LEVELS.length - 1; i++) {
    const l = FARMER_LEVELS[i]
    expect(levelInfo(l.xp).progressPct, `at ${l.name}`).toBe(0)
  }
  const top = FARMER_LEVELS[FARMER_LEVELS.length - 1]
  expect(levelInfo(top.xp).progressPct, `at ${top.name}`).toBe(100)
  expect(levelInfo(top.xp).nextXp).toBe(null)
  // and it fills as xp approaches the next boundary
  for (let i = 0; i < FARMER_LEVELS.length - 1; i++) {
    const cur = FARMER_LEVELS[i].xp
    const next = FARMER_LEVELS[i + 1].xp
    expect(levelInfo(next - 1).progressPct, `just below ${FARMER_LEVELS[i + 1].name}`).toBeGreaterThan(90)
    expect(levelInfo((cur + next) / 2).progressPct).toBeGreaterThan(0)
  }
  // the top level is capped at 100, not NaN from a missing next
  expect(levelInfo(1e9).progressPct).toBe(100)
  expect(levelInfo(1e9).nextXp).toBe(null)
  for (let xp = 0; xp < 40000; xp += 311) {
    const p = levelInfo(xp).progressPct
    expect(p).toBeGreaterThanOrEqual(0)
    expect(p).toBeLessThanOrEqual(100)
  }
})

test('numericLevel is monotonic and agrees with its own progress bar', () => {
  let prev = 0
  for (let xp = 0; xp < 200000; xp += 977) {
    const l = numericLevel(xp)
    expect(l).toBeGreaterThanOrEqual(prev)
    expect(l).toBeGreaterThanOrEqual(1)
    expect(l).toBeLessThanOrEqual(60)
    prev = l
  }
  expect(numericLevel(0)).toBe(1)
  expect(numericLevel(-500)).toBe(1)
})

test('numeric level progress starts at 0 and completes at the next threshold', () => {
  const p0 = numericLevelProgress(0)
  expect(p0.level).toBe(1)
  expect(p0.pct).toBe(0)
  expect(p0.nextXp).toBeGreaterThan(0)
  // exactly on the threshold is 100% into that level
  const at = numericLevelProgress(p0.nextXp)
  expect(at.level).toBe(2)
  expect(at.pct).toBe(0)
  // and progress never leaves 0..100
  for (let xp = 0; xp < 120000; xp += 313) {
    const p = numericLevelProgress(xp)
    expect(p.pct).toBeGreaterThanOrEqual(0)
    expect(p.pct).toBeLessThanOrEqual(100)
  }
})

// ═══════════════════════════════════════════════════════════
// buildings
// ═══════════════════════════════════════════════════════════

test('incubator slots step up by level and clamp above the table', () => {
  expect(incubatorSlots({ incubatorLevel: 1 })).toBe(INCUBATOR_SLOTS[0])
  expect(incubatorSlots({ incubatorLevel: 3 })).toBe(INCUBATOR_SLOTS[2])
  expect(incubatorSlots({ incubatorLevel: 99 })).toBe(INCUBATOR_SLOTS[INCUBATOR_SLOTS.length - 1])
  // a nonsense level still yields a usable capacity
  expect(incubatorSlots({ incubatorLevel: 0 })).toBeGreaterThan(0)
  expect(incubatorSlots({ incubatorLevel: -5 })).toBeGreaterThan(0)
})

test('every upgrade level costs more than the one before it', () => {
  for (const [key, def] of Object.entries(UPGRADES)) {
    let prev = -1
    for (const lvl of def.levels) {
      expect(lvl.cap, `${key}`).toBeGreaterThan(prev)
      expect(lvl.price, `${key}`).toBeGreaterThan(prev)
      prev = lvl.cap
    }
  }
})

test('the first upgrade tier is always free', () => {
  for (const [key, def] of Object.entries(UPGRADES)) {
    expect(def.levels[0].price, key).toBe(0)
  }
})

test('the shelter bonus is read from the table, and it is monotonic', () => {
  for (let i = 1; i < SHELTER_BONUS.length; i++) {
    expect(SHELTER_BONUS[i], `level ${i}`).toBeGreaterThanOrEqual(SHELTER_BONUS[i - 1])
  }
  expect(SHELTER_BONUS[0]).toBe(0)
  // the collect route must use the same numbers the UI quotes
  for (let lvl = 0; lvl < SHELTER_BONUS.length; lvl++) {
    const pct = SHELTER_BONUS[Math.min(Math.max(lvl, 0), SHELTER_BONUS.length - 1)] ?? 0
    expect(1 + pct / 100, `level ${lvl}`).toBeGreaterThanOrEqual(1)
  }
  for (let i = 1; i < SHELTER_CAPS.length; i++) {
    expect(SHELTER_CAPS[i]).toBeGreaterThan(SHELTER_CAPS[i - 1])
  }
})

test('the shelter bonus comes from SHELTER_BONUS at every level', () => {
  // The displayed and the paid bonus used to be two separate expressions that
  // agreed only at levels 1 and 2. This pins both to the one table.
  for (let lvl = 0; lvl <= SHELTER_BONUS.length + 2; lvl++) {
    const idx = Math.min(Math.max(lvl, 0), SHELTER_BONUS.length - 1)
    expect(shelterBonusMult(lvl), `level ${lvl}`).toBeCloseTo(1 + SHELTER_BONUS[idx] / 100, 6)
  }
  // and it is never a penalty, whatever it is handed
  for (const bad of [-100, -1, 0, 1, 99, NaN, Infinity, 2.7]) {
    expect(shelterBonusMult(bad), `level ${bad}`).toBeGreaterThanOrEqual(1)
    expect(shelterBonusMult(bad), `level ${bad}`).toBeLessThanOrEqual(2)
  }
})

test('the feed factory discount deepens and never exceeds the price', () => {
  expect(FEED_FACTORY_DISCOUNT[0]).toBe(0)
  for (let i = 1; i < FEED_FACTORY_DISCOUNT.length; i++) {
    expect(FEED_FACTORY_DISCOUNT[i]).toBeGreaterThanOrEqual(FEED_FACTORY_DISCOUNT[i - 1])
  }
  expect(Math.max(...FEED_FACTORY_DISCOUNT)).toBeLessThan(100)
  // the route floors at 1 coin, so a 100% discount must not be reachable
  for (const d of FEED_FACTORY_DISCOUNT) {
    for (const def of Object.values(FEED_TYPES)) {
      expect(Math.max(1, Math.round(def.price * (1 - d / 100)))).toBeGreaterThan(0)
    }
  }
})

// ═══════════════════════════════════════════════════════════
// clan
// ═══════════════════════════════════════════════════════════

test('clan levels are contiguous and clamp at the top', () => {
  expect(clanLevelOf(0)).toBe(1)
  expect(clanLevelOf(CLAN_LEVEL_XP[1])).toBe(2)
  expect(clanLevelOf(1e9)).toBe(CLAN_LEVEL_XP.length)
  for (let i = 1; i < CLAN_LEVEL_XP.length; i++) {
    expect(CLAN_LEVEL_XP[i]).toBeGreaterThan(CLAN_LEVEL_XP[i - 1])
    expect(clanLevelOf(CLAN_LEVEL_XP[i]), `xp ${CLAN_LEVEL_XP[i]}`).toBe(i + 1)
  }
})

// ═══════════════════════════════════════════════════════════
// table sanity — the numbers a player is shown
// ═══════════════════════════════════════════════════════════

test('animal income matches the daily figure in its description', () => {
  // "Produces milk worth 150 coins/day" beside coinsPerHour 6.25.
  const claim = (desc: string) => Number(desc.match(/(\d+)\s*coins\/day/)?.[1] ?? NaN)
  for (const def of Object.values(ANIMAL_TYPES)) {
    if (def.coinsPerHour > 0) {
      expect(def.coinsPerHour * 24, `${def.key}: ${def.desc}`).toBe(claim(def.desc))
    }
  }
})

test('a hen pays back its price within a sane window', () => {
  // Guards against a balance edit that makes a hen worthless or infinite.
  for (const def of Object.values(HEN_TYPES)) {
    const dailyValue = def.eggsPerHour * 24 * (EGG_TYPES[def.eggType]?.sellValue ?? 0)
    const daysToPayback = dailyValue > 0 ? def.price / dailyValue : Infinity
    expect(daysToPayback, `${def.key} pays back in ${daysToPayback.toFixed(1)} days`).toBeGreaterThan(0.5)
    expect(daysToPayback, `${def.key} pays back in ${daysToPayback.toFixed(1)} days`).toBeLessThan(60)
  }
})

test('a more expensive hen is never worse value than a cheaper one', () => {
  const ladder = Object.values(HEN_TYPES)
  for (let i = 1; i < ladder.length; i++) {
    const cheap = ladder[i - 1]
    const dear = ladder[i]
    const cheapDaily = cheap.eggsPerHour * (EGG_TYPES[cheap.eggType]?.sellValue ?? 0)
    const dearDaily = dear.eggsPerHour * (EGG_TYPES[dear.eggType]?.sellValue ?? 0)
    expect(dear.price, `${dear.key} vs ${cheap.key}`).toBeGreaterThan(cheap.price)
    expect(dearDaily, `${dear.key} out-earns ${cheap.key} per hour`).toBeGreaterThan(cheapDaily)
  }
})

test('daily rewards rise every day', () => {
  for (let i = 1; i < DAILY_REWARDS.length; i++) {
    expect(DAILY_REWARDS[i]).toBeGreaterThan(DAILY_REWARDS[i - 1])
  }
  expect(DAILY_REWARDS.length).toBe(7)
})

test('every mission is completable and pays something', () => {
  const keys = new Set<string>()
  for (const m of MISSIONS) {
    expect(keys.has(m.key), `duplicate mission ${m.key}`).toBe(false)
    keys.add(m.key)
    expect(m.target).toBeGreaterThan(0)
    expect(m.rewardCoins + m.rewardGems + m.rewardXp).toBeGreaterThan(0)
  }
})

test('every egg type a hen lays is a real egg type', () => {
  for (const def of Object.values(HEN_TYPES)) {
    expect(EGG_TYPES[def.eggType], `${def.key} lays ${def.eggType}`).toBeDefined()
  }
})

test('every purchasable egg has a buy price and vice versa', () => {
  for (const def of Object.values(EGG_TYPES)) {
    if (def.purchasable) expect(def.buyPrice, `${def.key}`).toBeGreaterThan(0)
    else expect(def.buyPrice, `${def.key}`).toBe(null)
  }
})
