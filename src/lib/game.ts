// ─────────────────────────────────────────────────────────────
// Hen Farming Game – Core Economy Engine & Constants
// ─────────────────────────────────────────────────────────────

export interface HenType {
  key: string
  name: string
  emoji: string
  price: number
  eggsPerHour: number
  eggType: string
  lifespanDays: number
  rarity: string
  color: string
  desc: string
}

export const HEN_TYPES: Record<string, HenType> = {
  normal: {
    key: 'normal', name: 'Normal Hen', emoji: '🐔', price: 200,
    eggsPerHour: 0.4, eggType: 'normal', lifespanDays: 90,
    rarity: 'Common', color: 'amber',
    desc: 'A hardy farm hen. Steady egg production, long life.',
  },
  golden: {
    key: 'golden', name: 'Golden Hen', emoji: '🐓', price: 800,
    eggsPerHour: 1.0, eggType: 'golden', lifespanDays: 120,
    rarity: 'Rare', color: 'yellow',
    desc: 'Lays premium golden eggs worth extra coins.',
  },
  royal: {
    key: 'royal', name: 'Royal Hen', emoji: '🦃', price: 2500,
    eggsPerHour: 2.0, eggType: 'royal', lifespanDays: 150,
    rarity: 'Epic', color: 'purple',
    desc: 'A rare bred royal. Double the laying rate of Golden.',
  },
  magic: {
    key: 'magic', name: 'Magic Hen', emoji: '🪿', price: 8000,
    eggsPerHour: 4.0, eggType: 'magic', lifespanDays: 180,
    rarity: 'Legendary', color: 'pink',
    desc: 'Limited edition legendary hen. Enormous output.',
  },
}

export interface AnimalType {
  key: string
  name: string
  emoji: string
  price: number
  coinsPerHour: number
  effect: string
  effectValue: number
  desc: string
}

export const ANIMAL_TYPES: Record<string, AnimalType> = {
  cow: {
    key: 'cow', name: 'Cow', emoji: '🐄', price: 1500, coinsPerHour: 6.25,
    effect: 'milk', effectValue: 0, desc: 'Produces milk worth 150 coins/day.',
  },
  sheep: {
    key: 'sheep', name: 'Sheep', emoji: '🐑', price: 1200, coinsPerHour: 5,
    effect: 'wool', effectValue: 0, desc: 'Produces wool worth 120 coins/day.',
  },
  duck: {
    key: 'duck', name: 'Duck', emoji: '🦆', price: 600, coinsPerHour: 2.5,
    effect: 'special eggs', effectValue: 0, desc: 'Lays special eggs worth 60 coins/day.',
  },
  dog: {
    key: 'dog', name: 'Guard Dog', emoji: '🐕', price: 800, coinsPerHour: 0,
    effect: 'production', effectValue: 5,
    desc: 'Guards the farm: +5% to all egg production.',
  },
  cat: {
    key: 'cat', name: 'Farm Cat', emoji: '🐈', price: 800, coinsPerHour: 0,
    effect: 'eggValue', effectValue: 5,
    desc: 'Reduces pests: +5% egg sell value.',
  },
  horse: {
    key: 'horse', name: 'Horse', emoji: '🐎', price: 2000, coinsPerHour: 0,
    effect: 'xp', effectValue: 25,
    desc: 'Speeds work: +25% XP gain from all activities.',
  },
}

export interface EggType {
  key: string
  name: string
  emoji: string
  sellValue: number
  buyPrice: number | null
  hatchHours: number
  purchasable: boolean
  hatchTable: { reward: string; chance: number }[]
  desc: string
}

// hatch reward keys: chick:normal, chick:golden, chick:royal, chick:magic,
// coins:X, animal:cow, animal:cat, item:feed, gems:X
export const EGG_TYPES: Record<string, EggType> = {
  normal: {
    key: 'normal', name: 'Normal Egg', emoji: '🥚', sellValue: 10,
    buyPrice: null, hatchHours: 24, purchasable: false,
    hatchTable: [
      { reward: 'chick:normal', chance: 45 },
      { reward: 'coins:150', chance: 25 },
      { reward: 'chick:golden', chance: 15 },
      { reward: 'animal:duck', chance: 10 },
      { reward: 'gems:1', chance: 5 },
    ],
    desc: 'Standard egg laid by your hens. Hatch in 24h.',
  },
  golden: {
    key: 'golden', name: 'Golden Egg', emoji: '🥇', sellValue: 12,
    buyPrice: 400, hatchHours: 12, purchasable: true,
    hatchTable: [
      { reward: 'chick:golden', chance: 40 },
      { reward: 'coins:600', chance: 25 },
      { reward: 'chick:royal', chance: 20 },
      { reward: 'animal:dog', chance: 10 },
      { reward: 'gems:2', chance: 5 },
    ],
    desc: 'Lustrous egg with rare hatch odds. Hatches in 12h.',
  },
  royal: {
    key: 'royal', name: 'Royal Egg', emoji: '🥚', sellValue: 15,
    buyPrice: null, hatchHours: 24, purchasable: false,
    hatchTable: [
      { reward: 'chick:royal', chance: 45 },
      { reward: 'coins:1200', chance: 25 },
      { reward: 'chick:magic', chance: 15 },
      { reward: 'animal:cow', chance: 10 },
      { reward: 'gems:3', chance: 5 },
    ],
    desc: 'Laid by Royal Hens. High-value hatch.',
  },
  magic: {
    key: 'magic', name: 'Magic Egg', emoji: '🔮', sellValue: 20,
    buyPrice: null, hatchHours: 24, purchasable: false,
    hatchTable: [
      { reward: 'chick:magic', chance: 55 },
      { reward: 'coins:2500', chance: 25 },
      { reward: 'animal:horse', chance: 10 },
      { reward: 'gems:5', chance: 10 },
    ],
    desc: 'Mystical egg from Magic Hens. Legendary odds.',
  },
  diamond: {
    key: 'diamond', name: 'Diamond Egg', emoji: '💎', sellValue: 100,
    buyPrice: 1000, hatchHours: 6, purchasable: true,
    hatchTable: [
      { reward: 'chick:royal', chance: 35 },
      { reward: 'chick:magic', chance: 25 },
      { reward: 'coins:2000', chance: 25 },
      { reward: 'animal:horse', chance: 10 },
      { reward: 'gems:8', chance: 5 },
    ],
    desc: 'Premium egg. Hatches in just 6h with epic rewards.',
  },
  mystery: {
    key: 'mystery', name: 'Mystery Egg', emoji: '🎁', sellValue: 50,
    buyPrice: 250, hatchHours: 12, purchasable: true,
    hatchTable: [
      { reward: 'animal:cat', chance: 20 },
      { reward: 'animal:dog', chance: 15 },
      { reward: 'animal:duck', chance: 15 },
      { reward: 'chick:golden', chance: 15 },
      { reward: 'coins:400', chance: 20 },
      { reward: 'gems:3', chance: 15 },
    ],
    desc: 'Could contain anything: pets, chicks, coins or gems!',
  },
}

export interface FeedType {
  key: string
  name: string
  emoji: string
  price: number
  boostPct: number
  hours: number
  desc: string
}

export const FEED_TYPES: Record<string, FeedType> = {
  corn: {
    key: 'corn', name: 'Corn Feed', emoji: '🌽', price: 20,
    boostPct: 20, hours: 4, desc: '+20% production for 4 hours.',
  },
  premium: {
    key: 'premium', name: 'Premium Feed', emoji: '🥫', price: 60,
    boostPct: 50, hours: 8, desc: '+50% production for 8 hours.',
  },
}

export interface UpgradeDef {
  key: string
  name: string
  emoji: string
  levels: { cap: number; price: number }[]
  desc: string
}

export const UPGRADES: Record<string, UpgradeDef> = {
  coop: {
    key: 'coop', name: 'Chicken House', emoji: '🏠',
    levels: [
      { cap: 10, price: 0 },
      { cap: 25, price: 2000 },
      { cap: 50, price: 10000 },
      { cap: 120, price: 40000 },
      { cap: 300, price: 150000 },
    ],
    desc: 'Increases how many hens your coop can hold.',
  },
  land: {
    key: 'land', name: 'Farm Land', emoji: '🌾',
    levels: [
      { cap: 6, price: 0 },
      { cap: 12, price: 1500 },
      { cap: 24, price: 8000 },
      { cap: 48, price: 30000 },
    ],
    desc: 'More animal pens. Each level also adds +3% production speed.',
  },
  storage: {
    key: 'storage', name: 'Storage Barn', emoji: '📦',
    levels: [
      { cap: 24, price: 0 },
      { cap: 48, price: 1000 },
      { cap: 72, price: 4000 },
      { cap: 120, price: 15000 },
    ],
    desc: 'How long production keeps accumulating while you are away.',
  },
}

export const FARMER_LEVELS = [
  { name: 'Beginner Farmer', xp: 0, unlock: 'Start your journey' },
  { name: 'Village Farmer', xp: 250, unlock: 'Golden Hen & Land Lv2' },
  { name: 'Master Farmer', xp: 1500, unlock: 'Royal Hen & Land Lv3' },
  { name: 'Royal Farmer', xp: 8000, unlock: 'Magic Hen & Land Lv4' },
  { name: 'Legend Farmer', xp: 30000, unlock: 'Everything + fame' },
]

export function levelIndexForXp(xp: number): number {
  let idx = 0
  for (let i = 0; i < FARMER_LEVELS.length; i++) {
    if (xp >= FARMER_LEVELS[i].xp) idx = i
  }
  return idx
}

// The explicit return type is load-bearing. Without it TypeScript infers
// `nextXp: number` — indexing an array without noUncheckedIndexedAccess is
// assumed to always succeed, so `?? null` looked unreachable and the `null`
// that the top level genuinely returns vanished from the contract. A consumer
// that trusted the inferred type and did arithmetic on it would produce NaN
// for exactly the players who max out.
export function levelInfo(xp: number): {
  idx: number
  name: string
  xp: number
  nextXp: number | null
  progressPct: number
} {
  const idx = levelIndexForXp(xp)
  const cur = FARMER_LEVELS[idx]
  const next: (typeof FARMER_LEVELS)[number] | null = FARMER_LEVELS[idx + 1] ?? null
  return {
    idx,
    name: cur.name,
    xp,
    nextXp: next?.xp ?? null,
    progressPct: next ? Math.min(100, Math.round(((xp - cur.xp) / (next.xp - cur.xp)) * 100)) : 100,
  }
}

export const DAILY_REWARDS = [50, 75, 100, 150, 200, 300, 500]

export interface MissionDef {
  key: string
  title: string
  desc: string
  target: number
  rewardCoins: number
  rewardGems: number
  rewardXp: number
  emoji: string
}

export const MISSIONS: MissionDef[] = [
  { key: 'collect_eggs', title: 'Egg Collector', desc: 'Collect 20 eggs from your hens', target: 20, rewardCoins: 100, rewardGems: 0, rewardXp: 20, emoji: '🥚' },
  { key: 'feed', title: 'Feeding Time', desc: 'Feed your farm 2 times', target: 2, rewardCoins: 60, rewardGems: 0, rewardXp: 15, emoji: '🌽' },
  { key: 'buy', title: 'Go Shopping', desc: 'Buy any item from the shop', target: 1, rewardCoins: 80, rewardGems: 0, rewardXp: 15, emoji: '🛒' },
  { key: 'hatch', title: 'Hatch Master', desc: 'Hatch 1 egg from the incubator', target: 1, rewardCoins: 150, rewardGems: 1, rewardXp: 30, emoji: '🐣' },
  { key: 'collect_prod', title: 'Farm Rounds', desc: 'Collect production 3 times', target: 3, rewardCoins: 50, rewardGems: 0, rewardXp: 10, emoji: '🧺' },
  { key: 'sell', title: 'Egg Merchant', desc: 'Sell 10 eggs at the barn', target: 10, rewardCoins: 70, rewardGems: 0, rewardXp: 10, emoji: '💰' },
  { key: 'play_minigame', title: 'Arcade Time', desc: 'Play 2 mini games at the Arcade', target: 2, rewardCoins: 120, rewardGems: 1, rewardXp: 25, emoji: '🎮' },
]

// ── production math ──────────────────────────────────────────

export function productionMultiplier(opts: {
  dogBonus?: boolean
  landLevel?: number
  buffType?: string | null
  buffActive?: boolean
  eventMultiplier?: number // percent e.g. 150
  configGlobal?: number // percent e.g. 100
  // Phase 8-15 factors
  weatherPct?: number // -15..25 (already scarecrow-adjusted)
  vipBonusPct?: number // 50 | 75
  clanBonusPct?: number // 2 per clan level
  shelterLevel?: number // animal production bonus only, handled by caller
}): number {
  let m = 1
  if (opts.dogBonus) m += 0.05
  if (opts.landLevel && opts.landLevel > 1) m += 0.03 * (opts.landLevel - 1)
  if (opts.buffActive && opts.buffType === 'corn') m += 0.2
  if (opts.buffActive && opts.buffType === 'premium') m += 0.5
  if (opts.buffActive && opts.buffType === 'vitamin') m += 0.25
  if (opts.buffActive && opts.buffType === 'golden_feed') m += 1.0
  if (opts.buffActive && opts.buffType === 'champion') m += 0.1 // Phase 33 — arcade champion buff
  if (opts.weatherPct) m += opts.weatherPct / 100
  if (opts.vipBonusPct) m += opts.vipBonusPct / 100
  if (opts.clanBonusPct) m += opts.clanBonusPct / 100
  if (opts.eventMultiplier && opts.eventMultiplier > 100) m *= opts.eventMultiplier / 100
  if (opts.configGlobal && opts.configGlobal !== 100) m *= opts.configGlobal / 100
  return m
}

export interface ProductionSettle {
  /** Whole units to hand the player. */
  amount: number
  /** The clock to store back on the producer. */
  lastCollectedAt: Date
  /** True when the storage cap discarded time beyond the window. */
  capped: boolean
}

/**
 * Settle one producer's accumulated window and advance its clock by only the
 * time that actually produced whole units.
 *
 * The obvious implementation — award `floor(hours * rate)` and then set the
 * clock to `now` — silently destroys the fraction on every collection, and
 * for a slow producer that is not a rounding detail, it is the whole game.
 * A Normal Hen lays 0.4 eggs/hour, so collecting every hour pays
 * `floor(0.4) = 0` and resets the clock: it never lays an egg, ever, no
 * matter how long the player plays. Collect every three hours and it yields
 * 24 eggs a day instead of 29. The player is punished for playing often, and
 * the only way to earn is to log in as rarely as possible, which is exactly
 * backwards for a game whose "Collect All" button invites a click.
 *
 * So the remainder is carried forward: the clock only advances by the time
 * that the whole units consumed. An uncollectable streak keeps accumulating
 * and eventually pays out.
 *
 * `capHours` still discards time beyond the storage window, because that is
 * what the cap is for, so the clock is pulled to the start of the window
 * rather than the last collection — otherwise an over-cap collection would
 * hand back time the player had already forfeited.
 */
export function settleProduction(opts: {
  lastCollectedAt: Date
  ratePerHour: number
  capHours: number
  now?: Date
}): ProductionSettle {
  const now = opts.now ?? new Date()
  const cap = Number.isFinite(opts.capHours) ? Math.max(0, opts.capHours) : 0
  const rate = Number.isFinite(opts.ratePerHour) ? Math.max(0, opts.ratePerHour) : 0
  const last = opts.lastCollectedAt instanceof Date && !Number.isNaN(opts.lastCollectedAt.getTime())
    ? opts.lastCollectedAt
    : now

  const hours = Math.max(0, (now.getTime() - last.getTime()) / 3600000)
  const usableHours = Math.min(hours, cap)
  const amount = Math.floor(usableHours * rate)
  // Time that whole units actually paid for. At rate 0 nothing is consumed,
  // which correctly leaves the clock alone instead of advancing a window
  // that produced nothing.
  const consumedHours = rate > 0 ? amount / rate : usableHours
  // The counted window begins at the LATER of the last collection and the
  // start of the storage window. max, not min: within the cap everything
  // since `last` counts, and beyond it only the trailing `cap` hours do.
  const windowStart = Math.max(last.getTime(), now.getTime() - cap * 3600000)

  return {
    amount,
    lastCollectedAt: new Date(windowStart + consumedHours * 3600000),
    capped: hours > cap,
  }
}

export function henStatus(hen: { type: string; bornAt: Date }): 'active' | 'retired' {
  const def = HEN_TYPES[hen.type]
  if (!def) return 'retired'
  const ageDays = (Date.now() - hen.bornAt.getTime()) / 86400000
  return ageDays >= def.lifespanDays ? 'retired' : 'active'
}

export function henAgeDays(bornAt: Date): number {
  return Math.floor((Date.now() - bornAt.getTime()) / 86400000)
}

export function farmHealth(lastFedAt: Date | null): number {
  if (!lastFedAt) return 100
  const hours = (Date.now() - lastFedAt.getTime()) / 3600000
  // Clamped at both ends. The lower bound is the designed decay floor, but the
  // upper one matters too: a lastFedAt in the future — clock skew, a restored
  // backup, a server whose clock jumped — makes `hours` negative, and
  // Math.floor of a negative is negative, so the subtraction turned into an
  // addition and health came out ABOVE 100. Health feeds the collect maths as
  // a multiplier, so that was a way to farm production for free.
  const raw = Math.round(100 - Math.floor(hours / 24) * 10)
  return Math.min(100, Math.max(50, raw))
}

export function rollHatchTable(table: { reward: string; chance: number }[]): string {
  const total = table.reduce((s, r) => s + r.chance, 0)
  let roll = Math.random() * total
  for (const row of table) {
    roll -= row.chance
    if (roll <= 0) return row.reward
  }
  return table[0].reward
}

export const HEN_NAMES = ['Pip', 'Clucky', 'Nugget', 'Bella', 'Coco', 'Daisy', 'Ginger', 'Henny', 'Poppy', 'Rosie', 'Sunny', 'Bella', 'Peanut', 'Waffles', 'Marmalade', 'Egbert', 'Feather', 'Beaky', 'Doodle', 'Speckles']

export function randomHenName(): string {
  return HEN_NAMES[Math.floor(Math.random() * HEN_NAMES.length)]
}

export const ANIMAL_NAMES: Record<string, string[]> = {
  cow: ['MooDaisy', 'Buttercup', 'Milkshake'],
  sheep: ['Wooly', 'Cloudy', 'Fluff'],
  duck: ['Quackers', 'Waddles', 'Puddles'],
  dog: ['Rex', 'Buddy', 'Scout'],
  cat: ['Whiskers', 'Mittens', 'Shadow'],
  horse: ['Thunder', 'Biscuit', 'Star'],
}

export function randomAnimalName(type: string): string {
  const names = ANIMAL_NAMES[type] ?? ['Buddy']
  return names[Math.floor(Math.random() * names.length)]
}

// ═════════════════════════════════════════════════════════════
// PHASE 8 — Real-Time Farm Engine: life cycle, genetics, weather
// ═════════════════════════════════════════════════════════════

// Hen growth stages (real-time life cycle)
export const HEN_STAGES = [
  { key: 'chick', name: 'Chick', emoji: '🐣', maxAgeDays: 2, prodPct: 0, desc: 'Too young to lay' },
  { key: 'growing', name: 'Growing', emoji: '🐤', maxAgeDays: 5, prodPct: 50, desc: 'Half production' },
  { key: 'prime', name: 'Prime', emoji: '🐔', maxAgeDays: 60, prodPct: 100, desc: 'Full production' },
  { key: 'mature', name: 'Mature', emoji: '🐓', maxAgeDays: Infinity, prodPct: 75, desc: 'Slightly lower output' },
]

export function henStage(ageDays: number): (typeof HEN_STAGES)[number] {
  if (ageDays <= 2) return HEN_STAGES[0]
  if (ageDays <= 5) return HEN_STAGES[1]
  if (ageDays <= 60) return HEN_STAGES[2]
  return HEN_STAGES[3]
}

// Hen leveling: L1 produces base; each level +10% (L10 ≈ ×1.9)
export const HEN_MAX_LEVEL = 10
export function henXpForLevel(level: number): number {
  return level * 25 // cumulative xp needed to REACH level+1 threshold check
}
export function henLevelMult(level: number): number {
  return 1 + 0.1 * (Math.min(level, HEN_MAX_LEVEL) - 1)
}
export function henXpProgress(xp: number, level: number): { pct: number; nextAt: number } {
  const nextAt = henXpForLevel(level)
  const prevAt = level > 1 ? henXpForLevel(level - 1) : 0
  const pct = Math.min(100, Math.round(((xp - prevAt) / Math.max(1, nextAt - prevAt)) * 100))
  return { pct, nextAt }
}

// Genetic traits 🧬 — rolled when breeding, tiny bonuses each
export interface TraitDef {
  key: string
  name: string
  emoji: string
  desc: string
  rarity: 'common' | 'rare' | 'epic' | 'legendary'
}
export const TRAITS: Record<string, TraitDef> = {
  fertile: { key: 'fertile', name: 'Fertile', emoji: '💫', desc: '+10% egg production', rarity: 'common' },
  hearty: { key: 'hearty', name: 'Hearty', emoji: '❤️', desc: '+15% effective lifespan', rarity: 'common' },
  golden_touch: { key: 'golden_touch', name: 'Golden Touch', emoji: '✨', desc: '+5% egg sell value', rarity: 'rare' },
  swift: { key: 'swift', name: 'Swift Layer', emoji: '⚡', desc: '+15% egg production', rarity: 'rare' },
  lucky: { key: 'lucky', name: 'Lucky', emoji: '🍀', desc: '+25% hatch bonus luck', rarity: 'epic' },
  legendary_blood: { key: 'legendary_blood', name: 'Legendary Blood', emoji: '🌟', desc: '+50% production, passes to offspring', rarity: 'legendary' },
}
export const TRAIT_ROLL = [
  { reward: 'none', chance: 55 },
  { reward: 'fertile', chance: 18 },
  { reward: 'hearty', chance: 12 },
  { reward: 'golden_touch', chance: 7 },
  { reward: 'swift', chance: 5 },
  { reward: 'lucky', chance: 2 },
  { reward: 'legendary_blood', chance: 1 },
]
// trait effect helpers
export function traitProdMult(traits: string[]): number {
  let m = 1
  if (traits.includes('fertile')) m += 0.10
  if (traits.includes('swift')) m += 0.15
  if (traits.includes('legendary_blood')) m += 0.50
  return m
}
export function traitLifespanMult(traits: string[]): number {
  return traits.includes('hearty') ? 1.15 : 1
}
export function traitEggValueMult(traits: string[]): number {
  return traits.includes('golden_touch') ? 1.05 : 1
}
export function rollTrait(): string {
  return rollHatchTable(TRAIT_ROLL)
}

// Breeding genetics: parent combo → chick outcome probability tables
// Higher tier ladder: normal < golden < royal < magic
export const BREED_LADDER = ['normal', 'golden', 'royal', 'magic']
export const BREED_COST = 500
export const BREED_COOLDOWN_HOURS = 6

export function breedOutcome(typeA: string, typeB: string): { reward: string; chance: number }[] {
  const table = [
    { reward: `chick:${typeA}`, chance: 40 },
    { reward: `chick:${typeB}`, chance: 30 },
  ]
  // 20% chance to jump one tier up from the higher parent
  const hi = Math.max(BREED_LADDER.indexOf(typeA), BREED_LADDER.indexOf(typeB))
  const nextTier = BREED_LADDER[Math.min(hi + 1, BREED_LADDER.length - 1)]
  table.push({ reward: `chick:${nextTier}`, chance: 20 })
  // 10% mutation: legendary blood trait chick of the higher parent
  table.push({ reward: `mutation:${hi >= 0 ? BREED_LADDER[hi] : typeA}`, chance: 10 })
  return table
}

// Daily weather (deterministic per date — server authoritative)
export interface WeatherDef {
  key: string
  name: string
  emoji: string
  prodPct: number // percent change to production
  desc: string
}
export const WEATHERS: WeatherDef[] = [
  { key: 'sunny', name: 'Sunny', emoji: '☀️', prodPct: 10, desc: 'Perfect laying weather: +10% production' },
  { key: 'cloudy', name: 'Cloudy', emoji: '⛅', prodPct: 0, desc: 'Normal day: standard production' },
  { key: 'rainy', name: 'Rainy', emoji: '🌧️', prodPct: -5, desc: 'Hens stay indoors: -5% production' },
  { key: 'storm', name: 'Storm', emoji: '⛈️', prodPct: -15, desc: 'Rough weather: -15% production' },
  { key: 'rainbow', name: 'Rainbow', emoji: '🌈', prodPct: 25, desc: 'Magical skies: +25% production!' },
]
export function weatherFor(date: Date = new Date()): WeatherDef {
  const seed = date.toISOString().slice(0, 10).split('-').join('')
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 100000
  // weights: sunny 30, cloudy 30, rainy 20, storm 12, rainbow 8
  const roll = h % 100
  if (roll < 30) return WEATHERS[0]
  if (roll < 60) return WEATHERS[1]
  if (roll < 80) return WEATHERS[2]
  if (roll < 92) return WEATHERS[3]
  return WEATHERS[4]
}

// ═════════════════════════════════════════════════════════════
// PHASE 9 — Numeric farmer level track with unlock rewards
// ═════════════════════════════════════════════════════════════

export function numericLevel(xp: number): number {
  // level 1 at 0 XP; each level needs 60 * level^1.35 cumulative — gentle early curve
  let lvl = 1
  let need = 0
  while (true) {
    need += Math.round(60 * Math.pow(lvl, 1.35))
    if (xp >= need && lvl < 60) { lvl++; continue }
    break
  }
  return lvl
}
export function numericLevelProgress(xp: number): { level: number; pct: number; nextXp: number } {
  const level = numericLevel(xp)
  let need = 0
  for (let l = 1; l < level; l++) need += Math.round(60 * Math.pow(l, 1.35))
  const nextNeed = need + Math.round(60 * Math.pow(level, 1.35))
  const pct = Math.min(100, Math.round(((xp - need) / Math.max(1, nextNeed - need)) * 100))
  return { level, pct, nextXp: nextNeed }
}

export const LEVEL_REWARDS: Record<number, { coins: number; gems: number; unlock?: string }> = {
  2: { coins: 200, gems: 0, unlock: '🧬 Breeding Nest' },
  3: { coins: 300, gems: 1, unlock: '🎒 Barn Inventory' },
  4: { coins: 500, gems: 1, unlock: '🏹 Incubator Room Lv2' },
  5: { coins: 800, gems: 2, unlock: '🤝 Friends & Gifting' },
  6: { coins: 1200, gems: 2, unlock: '🛡️ Clans' },
  8: { coins: 2000, gems: 3, unlock: '🏭 Feed Factory' },
  10: { coins: 3500, gems: 5, unlock: '🦆 Ducks & Shelter' },
  15: { coins: 6000, gems: 8, unlock: '💎 Diamond Egg deals' },
  25: { coins: 15000, gems: 15, unlock: '👑 Elite trader status' },
  50: { coins: 50000, gems: 50, unlock: '🌟 Legendary farmer fame' },
}

// ═════════════════════════════════════════════════════════════
// PHASE 10 — Inventory items
// ═════════════════════════════════════════════════════════════

export interface ItemDef {
  key: string
  name: string
  emoji: string
  kind: string // medicine | booster | tool | consumable
  price: number
  gemPrice?: number
  desc: string
  usable: boolean
}
export const ITEM_TYPES: Record<string, ItemDef> = {
  medicine: {
    key: 'medicine', name: 'Farm Medicine', emoji: '💉', kind: 'medicine',
    price: 150, desc: 'Instantly restores farm health to 100%.', usable: true,
  },
  vitamin: {
    key: 'vitamin', name: 'Hen Vitamins', emoji: '💊', kind: 'booster',
    price: 300, desc: '+25% production for 6 hours.', usable: true,
  },
  golden_feed: {
    key: 'golden_feed', name: 'Golden Feed', emoji: '🍯', kind: 'booster',
    price: 0, gemPrice: 5, desc: '+100% production for 2 hours. Bought with gems.', usable: true,
  },
  growth_shot: {
    key: 'growth_shot', name: 'Growth Shot', emoji: '🚀', kind: 'consumable',
    price: 400, desc: 'Instantly makes one chick fully grown (Prime).', usable: true,
  },
  xp_tonic: {
    key: 'xp_tonic', name: 'XP Tonic', emoji: '🧪', kind: 'booster',
    price: 250, desc: 'Double XP from all actions for 2 hours.', usable: true,
  },
  egg_charm: {
    key: 'egg_charm', name: 'Lucky Egg Charm', emoji: '🧿', kind: 'consumable',
    price: 0, gemPrice: 3, desc: 'Next hatch re-rolls if worse than Common luck.', usable: true,
  },
  scarecrow: {
    key: 'scarecrow', name: 'Scarecrow', emoji: '🎃', kind: 'tool',
    price: 500, desc: 'Permanent: protects against Storm weather penalty.', usable: false,
  },
  feed_sack: {
    key: 'feed_sack', name: 'Feed Sack', emoji: '🌾', kind: 'consumable',
    price: 100, desc: 'Feeds the farm for free (keeps 100% health).', usable: true,
  },
}

// ═════════════════════════════════════════════════════════════
// PHASE 11 — Additional farm buildings (beyond coop/land/storage)
// ═════════════════════════════════════════════════════════════

export interface BuildingDef {
  key: string
  name: string
  emoji: string
  maxLevel: number
  priceFor: (nextLevel: number) => number
  effect: (level: number) => string
}

export const INCUBATOR_SLOTS = [4, 6, 8]
export const FEED_FACTORY_DISCOUNT = [0, 10, 20, 30] // percent off feed
export const SHELTER_BONUS = [0, 5, 10, 15] // percent animal production bonus
export const SHELTER_CAPS = [6, 10, 16, 24] // effective animal cap per shelter level

/**
 * The shelter's production bonus, as a multiplier.
 *
 * A single function because the number is shown in one place and paid in
 * another, and when those were two separate expressions they drifted: the
 * display read SHELTER_BONUS while the collect route used an inline
 * `1 + level * 5 / 100`. They agreed at levels 1 and 2 and then disagreed —
 * at level 3 the player was shown +10% and paid +15%, and at level 4, shown
 * +15% and paid +20%. Anything the player is quoted has to come from the same
 * line of code that pays it.
 */
export function shelterBonusMult(level: number): number {
  const idx = Math.min(Math.max(Math.floor(level) || 0, 0), SHELTER_BONUS.length - 1)
  return 1 + (SHELTER_BONUS[idx] ?? 0) / 100
}

export function incubatorSlots(farm: { incubatorLevel: number }): number {
  return INCUBATOR_SLOTS[Math.min(farm.incubatorLevel, INCUBATOR_SLOTS.length) - 1] ?? 4
}

// ═════════════════════════════════════════════════════════════
// PHASE 15 — Monetization: gem packs & VIP plans
// ═════════════════════════════════════════════════════════════

export interface GemPack {
  key: string
  name: string
  gems: number
  priceCents: number
  bonusPct: number
  tag?: string
}
export const GEM_PACKS: GemPack[] = [
  { key: 'starter', name: 'Starter Pouch', gems: 10, priceCents: 99, bonusPct: 0 },
  { key: 'farmer', name: 'Farmer Box', gems: 60, priceCents: 499, bonusPct: 10, tag: 'POPULAR' },
  { key: 'tycoon', name: 'Tycoon Chest', gems: 140, priceCents: 999, bonusPct: 17, tag: 'BEST VALUE' },
  { key: 'empire', name: 'Empire Vault', gems: 320, priceCents: 1999, bonusPct: 23, tag: 'MEGA' },
]

export interface VipPlan {
  key: string
  name: string
  days: number
  priceCents: number
  dailyGems: number
  prodBonusPct: number
  perks: string[]
}
export const VIP_PLANS: Record<string, VipPlan> = {
  farmer_vip: {
    key: 'farmer_vip', name: 'Farmer VIP', days: 30, priceCents: 999,
    dailyGems: 5, prodBonusPct: 50,
    perks: ['+50% egg production', '💎 5 gems claimable daily', '👑 VIP badge & golden name', '⚡ Priority market listing slot'],
  },
  tycoon_vip: {
    key: 'tycoon_vip', name: 'Tycoon VIP', days: 30, priceCents: 2499,
    dailyGems: 15, prodBonusPct: 75,
    perks: ['+75% egg production', '💎 15 gems claimable daily', '👑 VIP badge & golden name', '🚀 1 free hatch speedup daily (auto)'],
  },
}

// ═════════════════════════════════════════════════════════════
// PHASE 12 — Clan config
// ═════════════════════════════════════════════════════════════

export const CLAN_CREATE_COST = 2000
export const CLAN_MAX_MEMBERS = [20, 25, 30, 40, 50]
export const CLAN_LEVEL_XP = [0, 1000, 3000, 8000, 20000]
export function clanLevelOf(xp: number): number {
  let lvl = 1
  for (let i = 1; i < CLAN_LEVEL_XP.length; i++) if (xp >= CLAN_LEVEL_XP[i]) lvl = i + 1
  return Math.min(lvl, CLAN_LEVEL_XP.length)
}
export function clanProdBonus(level: number): number {
  return 0.02 * (level - 1) // +2% per clan level
}
export const CLAN_WEEKLY_REWARD = [200, 400, 800, 1500, 3000]
export const GIFT_AMOUNT = 100
export const FRIEND_LIMIT = 30

export function todayKey(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10)
}

export function fmt(n: number): string {
  return n.toLocaleString('en-US')
}
