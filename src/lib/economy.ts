import { db } from '@/lib/db'
import { WALLET_CONFIG_DEFAULTS } from '@/lib/payment'
import {
  HEN_TYPES, ANIMAL_TYPES, EGG_TYPES, UPGRADES, MISSIONS,
  DAILY_REWARDS, levelInfo, farmHealth, henStatus, henAgeDays,
  todayKey, productionMultiplier, type EggType,
  // Phase 8-15 additions
  henStage, henLevelMult, traitProdMult, traitLifespanMult, traitEggValueMult,
  numericLevelProgress, LEVEL_REWARDS, incubatorSlots, FEED_FACTORY_DISCOUNT,
  SHELTER_BONUS, SHELTER_CAPS, weatherFor, GEM_PACKS, VIP_PLANS,
  clanLevelOf, clanProdBonus, TRAITS, ITEM_TYPES, randomHenName,
} from '@/lib/game'
import type { User, Hen, Animal, Egg } from '@prisma/client'

// ── config ───────────────────────────────────────────────────

export const CONFIG_DEFAULTS: Record<string, number> = {
  startingBalance: 1000,
  startingGems: 5,
  globalProduction: 100, // percent
  marketFeePct: 5,
  withdrawalMin: 5000,
  dailyRewardBase: 50,
  gemToCoins: 100,
  maintenanceMode: 0,
  referralBonus: 200,
  // Phase 26 — emergency mode switches
  withdrawalsDisabled: 0,
  marketplaceDisabled: 0,
  // Phase 33 — arcade tuning
  arcadeRewardsEnabled: 1,
  // Phase 34 — wallet system
  ...WALLET_CONFIG_DEFAULTS,
}

// Config keys that move or set real money. A Game Manager may tune
// production and rewards, but must not be able to rewrite the coin
// conversion rate, payout fee or withdrawal ceiling.
export const MONEY_CONFIG_KEYS = new Set([
  'coinsPerUsd', 'depositMinCents', 'depositMaxCents',
  'wdFeePct', 'wdMaxCoins', 'firstDepositBonusPct',
  'withdrawalMin', 'withdrawalsDisabled', 'depositsDisabled',
  'marketFeePct', 'gemToCoins', 'startingBalance', 'startingGems',
  'referralBonus',
])

export async function getConfig(): Promise<Record<string, number>> {
  const rows = await db.gameConfig.findMany()
  const cfg = { ...CONFIG_DEFAULTS }
  for (const r of rows) {
    const v = Number(r.value)
    if (!Number.isNaN(v)) cfg[r.key] = v
  }
  return cfg
}

// ── Phase 18: daily analytics counters ──────────────────────

export async function bumpDailyStat(
  fields: Partial<Record<'dau' | 'newUsers' | 'eggsLaid' | 'eggsHatched' | 'coinsGenerated' | 'coinsSpent' | 'marketVolume' | 'revenueCents', number>>,
  date: string = todayKey()
) {
  try {
    await db.dailyStat.upsert({
      where: { date },
      update: Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, { increment: v }])),
      create: { date, ...fields },
    })
  } catch { /* analytics must never break gameplay */ }
}

// ── wallet ───────────────────────────────────────────────────

export async function logTx(userId: string, type: string, amount: number, currency: string, description: string) {
  if (amount === 0) return
  await db.transaction.create({ data: { userId, type, amount, currency, description } })
}

export async function adjustBalance(
  userId: string,
  coinDelta: number,
  gemDelta: number,
  type: string,
  description: string
): Promise<{ coins: number; gems: number }> {
  const user = await db.user.update({
    where: { id: userId },
    data: {
      coins: { increment: coinDelta },
      gems: { increment: gemDelta },
    },
  })
  if (coinDelta !== 0) {
    await logTx(userId, type, coinDelta, 'coins', description)
    await bumpDailyStat(coinDelta > 0 ? { coinsGenerated: coinDelta } : { coinsSpent: -coinDelta })
  }
  if (gemDelta !== 0) await logTx(userId, type, gemDelta, 'gems', description)
  return { coins: user.coins, gems: user.gems }
}

export async function addXp(userId: string, amount: number) {
  if (amount <= 0) return
  await db.user.update({ where: { id: userId }, data: { xp: { increment: amount } } })
}

// ── missions ─────────────────────────────────────────────────

export async function ensureDailyMissions(userId: string) {
  const date = todayKey()
  const existing = await db.userMission.findMany({ where: { userId, date } })
  const have = new Set(existing.map(m => m.key))
  const missing = MISSIONS.filter(m => !have.has(m.key))
  if (missing.length) {
    await db.userMission.createMany({
      data: missing.map(m => ({ userId, key: m.key, date, progress: 0, claimed: false })),
    })
  }
}

export async function bumpMission(userId: string, key: string, amount = 1) {
  const date = todayKey()
  await db.userMission.upsert({
    where: { userId_key_date: { userId, key, date } },
    update: { progress: { increment: amount } },
    create: { userId, key, date, progress: amount, claimed: false },
  })
}

// ── events ───────────────────────────────────────────────────

export async function getActiveEvent() {
  const now = new Date()
  const ev = await db.gameEvent.findFirst({
    where: { active: true, startsAt: { lte: now }, endsAt: { gte: now } },
    orderBy: { createdAt: 'desc' },
  })
  return ev
}

// ── Phase 17: deduped auto-notifications ─────────────────────

export async function notifyOnce(userId: string, ref: string, title: string, body: string) {
  const existing = await db.notification.findFirst({ where: { userId, ref } })
  if (existing) return
  await db.notification.create({ data: { userId, title, body, ref } })
}

export async function notify(userId: string, title: string, body: string) {
  await db.notification.create({ data: { userId, title, body } })
}

export async function syncAutoNotifications(
  userId: string,
  opts: { readyEggs: number; canDaily: boolean; vipUntil: Date | null; vipPlan: string | null }
) {
  const today = todayKey()
  if (opts.readyEggs > 0) {
    await notifyOnce(
      userId, `hatch_ready:${today}`,
      '🥚 Eggs ready to hatch!',
      `${opts.readyEggs} egg(s) finished incubating. Open them in your incubator now!`
    )
  }
  if (opts.canDaily) {
    await notifyOnce(
      userId, `daily_available:${today}`,
      '🎁 Daily reward available',
      'Your daily login reward is ready to claim in the Quests tab!'
    )
  }
  if (opts.vipUntil && opts.vipPlan) {
    const hoursLeft = (opts.vipUntil.getTime() - Date.now()) / 3600000
    if (hoursLeft <= 48 && hoursLeft > 0) {
      await notifyOnce(
        userId, `vip_expiring:${opts.vipUntil.toISOString().slice(0, 10)}`,
        '👑 VIP expiring soon',
        `Your ${VIP_PLANS[opts.vipPlan]?.name ?? 'VIP'} expires in ${Math.ceil(hoursLeft)}h. Renew to keep production bonuses!`
      )
    }
  }
}

// ── hatch rewards ────────────────────────────────────────────

export interface HatchResult {
  kind: string
  title: string
  emoji: string
  detail: string
}

export async function grantHatchReward(
  userId: string,
  reward: string,
  generation = 1,
  forceTraits: string[] | null = null
): Promise<HatchResult> {
  const [kind, arg] = reward.split(':')
  if (kind === 'chick' || kind === 'mutation') {
    const def = HEN_TYPES[arg]
    const name = ['Pip', 'Clucky', 'Nugget', 'Bella', 'Coco', 'Daisy'][Math.floor(Math.random() * 6)]
    const traits = forceTraits ?? (() => {
      // auto-roll a trait (55% none handled by TRAIT_ROLL weights)
      const rolled = rollTraitFromTable()
      return rolled === 'none' ? [] : [rolled]
    })()
    await db.hen.create({
      data: {
        userId, type: arg, name: kind === 'mutation' ? `⭐ ${name}` : `Baby ${name}`,
        generation, traits: traits.length ? JSON.stringify(traits) : null,
      },
    })
    const traitLabel = traits.length ? ` · ${TRAITS[traits[0]].emoji} ${TRAITS[traits[0]].name}` : ''
    if (kind === 'mutation') {
      return {
        kind: 'chick',
        title: `🌟 LEGENDARY MUTATION!`,
        emoji: def.emoji,
        detail: `A legendary-blooded ${def.name} "${name}" hatched (Gen ${generation})${traitLabel}!` ,
      }
    }
    return {
      kind: 'chick', title: `${def.emoji} ${def.name} hatched!`, emoji: def.emoji,
      detail: `Welcome Baby ${name} to your coop! (Gen ${generation})${traitLabel}`,
    }
  }
  if (kind === 'coins') {
    const amount = Number(arg)
    await adjustBalance(userId, amount, 0, 'hatch', 'Hatch reward')
    await db.farm.updateMany({ where: { userId }, data: { totalEarned: { increment: amount } } })
    return { kind: 'coins', title: `🪙 +${amount} Coins!`, emoji: '🪙', detail: 'Lucky hatch! Coins added to your wallet.' }
  }
  if (kind === 'gems') {
    const amount = Number(arg)
    await adjustBalance(userId, 0, amount, 'hatch', 'Hatch reward')
    return { kind: 'gems', title: `💎 +${amount} Gems!`, emoji: '💎', detail: 'Premium gems added to your wallet.' }
  }
  if (kind === 'animal') {
    const def = ANIMAL_TYPES[arg]
    const name = ['Buddy', 'Scout', 'Puddles', 'Fluff'][Math.floor(Math.random() * 4)]
    await db.animal.create({ data: { userId, type: arg, name } })
    return { kind: 'animal', title: `${def.emoji} ${def.name} joined your farm!`, emoji: def.emoji, detail: `${def.name} is now living in your pens.` }
  }
  return { kind: 'coins', title: '🪙 +50 Coins!', emoji: '🪙', detail: 'Consolation reward.' }
}

function rollTraitFromTable(): string {
  const table = [
    { reward: 'none', chance: 55 },
    { reward: 'fertile', chance: 18 },
    { reward: 'hearty', chance: 12 },
    { reward: 'golden_touch', chance: 7 },
    { reward: 'swift', chance: 5 },
    { reward: 'lucky', chance: 2 },
    { reward: 'legendary_blood', chance: 1 },
  ]
  const total = table.reduce((s, r) => s + r.chance, 0)
  let roll = Math.random() * total
  for (const row of table) {
    roll -= row.chance
    if (roll <= 0) return row.reward
  }
  return 'none'
}

// ── farm value ───────────────────────────────────────────────

export function farmValueOf(user: User & { hens: Hen[]; animals: Animal[]; eggs: Egg[]; farm? }): number {
  let v = user.coins
  for (const h of user.hens) {
    const def = HEN_TYPES[h.type]
    if (def) v += Math.round(def.price * (henStatus(h) === 'active' ? 0.8 : 0.2))
  }
  for (const a of user.animals) {
    const def = ANIMAL_TYPES[a.type]
    if (def) v += def.price
  }
  for (const e of user.eggs) {
    if (e.status === 'inventory' || e.status === 'ready' || e.status === 'incubating') {
      v += EGG_TYPES[e.type]?.sellValue ?? 0
    }
  }
  if (user.farm) {
    for (const key of ['coop', 'land', 'storage'] as const) {
      const lv = key === 'coop' ? user.farm.coopLevel : key === 'land' ? user.farm.landLevel : user.farm.storageLevel
      const def = UPGRADES[key]
      for (let i = 0; i < lv; i++) v += def.levels[i]?.price ?? 0
    }
  }
  return v
}

// ── full game state ──────────────────────────────────────────

export async function buildGameState(user: User) {
  const [farm, hens, animals, eggs, cfg, event, items, clanMemberRow, friendPending] = await Promise.all([
    db.farm.upsert({ where: { userId: user.id }, update: {}, create: { userId: user.id } }),
    db.hen.findMany({ where: { userId: user.id }, orderBy: { bornAt: 'asc' } }),
    db.animal.findMany({ where: { userId: user.id }, orderBy: { bornAt: 'asc' } }),
    db.egg.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' } }),
    getConfig(),
    getActiveEvent(),
    db.inventoryItem.findMany({ where: { userId: user.id, qty: { gt: 0 } } }),
    db.clanMember.findUnique({ where: { userId: user.id }, include: { clan: true } }),
    db.friend.count({ where: { friendId: user.id, status: 'pending' } }),
  ])

  await ensureDailyMissions(user.id)
  const missions = await db.userMission.findMany({ where: { userId: user.id, date: todayKey() } })
  const missionDefs = MISSIONS.map(m => {
    const prog = missions.find(x => x.key === m.key)
    return {
      key: m.key, title: m.title, desc: m.desc, emoji: m.emoji,
      target: m.target, rewardCoins: m.rewardCoins, rewardGems: m.rewardGems, rewardXp: m.rewardXp,
      progress: Math.min(prog?.progress ?? 0, m.target),
      claimed: prog?.claimed ?? false,
      complete: (prog?.progress ?? 0) >= m.target,
    }
  })

  // egg inventory by type
  const eggInventory: Record<string, number> = {}
  const incubators: { id: string; type: string; hatchAt: string; ready: boolean }[] = []
  let readyEggs = 0
  for (const e of eggs) {
    if (e.status === 'inventory') eggInventory[e.type] = (eggInventory[e.type] ?? 0) + 1
    if (e.status === 'incubating') {
      const ready = (e.hatchAt ?? 0) <= new Date()
      incubators.push({ id: e.id, type: e.type, hatchAt: (e.hatchAt ?? new Date()).toISOString(), ready })
      if (ready) readyEggs++
    }
    if (e.status === 'ready') {
      incubators.push({ id: e.id, type: e.type, hatchAt: new Date().toISOString(), ready: true })
      readyEggs++
    }
  }

  const now = new Date()
  const health = farmHealth(farm.lastFedAt)
  const buffActive = !!(farm.buffExpiresAt && farm.buffExpiresAt > now)
  const dogBonus = animals.some(a => a.type === 'dog')

  // Phase 8: daily weather (scarecrow item shields storm)
  let weather = weatherFor(now)
  const hasScarecrow = items.some(i => i.key === 'scarecrow')
  const weatherPct = weather.key === 'storm' && hasScarecrow ? 0 : weather.prodPct

  // Phase 12: clan production bonus
  const clanLevel = clanMemberRow ? clanLevelOf(clanMemberRow.clan.xp) : 0
  const clanBonusPct = clanMemberRow ? clanProdBonus(clanLevel) * 100 : 0

  // Phase 15: VIP status
  const vipActive = !!(user.vipUntil && user.vipUntil > now)
  const vipPlan = vipActive && user.vipPlan ? VIP_PLANS[user.vipPlan] : null
  const vipBonusPct = vipPlan?.prodBonusPct ?? 0

  const mult = productionMultiplier({
    dogBonus,
    landLevel: farm.landLevel,
    buffType: farm.buffType,
    buffActive,
    eventMultiplier: event?.multiplier ?? 100,
    configGlobal: cfg.globalProduction,
    weatherPct,
    vipBonusPct,
    clanBonusPct,
  })

  const storageCap = UPGRADES.storage.levels[farm.storageLevel - 1]?.cap ?? 24
  const coopCap = UPGRADES.coop.levels[farm.coopLevel - 1]?.cap ?? 10
  const landCap = UPGRADES.land.levels[farm.landLevel - 1]?.cap ?? 6
  const incubatorCap = incubatorSlots(farm)
  const shelterCap = SHELTER_CAPS[Math.min(farm.shelterLevel, SHELTER_CAPS.length - 1)] ?? 6
  const shelterBonus = SHELTER_BONUS[Math.min(Math.max(farm.shelterLevel, 0), SHELTER_BONUS.length - 1)] ?? 0

  const henList = hens.map(h => {
    const def = HEN_TYPES[h.type]
    const status = henStatus(h)
    const ageDays = henAgeDays(h.bornAt)
    const traits: string[] = (() => {
      try { return h.traits ? JSON.parse(h.traits) : [] } catch { return [] }
    })()
    const stage = henStage(ageDays)
    // effective lifespan extended by hearty trait
    const lifespan = Math.round(def.lifespanDays * traitLifespanMult(traits))
    const effAgeDays = ageDays
    const effStatus = effAgeDays >= lifespan ? 'retired' : 'active'
    const stagePct = stage.prodPct / 100
    const lvlMult = henLevelMult(h.level)
    const traitMult = traitProdMult(traits)
    const pend = effStatus === 'active'
      ? Math.floor(
          Math.min((now.getTime() - h.lastCollectedAt.getTime()) / 3600000, storageCap) *
          def.eggsPerHour * mult * (health / 100) * stagePct * lvlMult * traitMult
        )
      : 0
    const breedReadyAt = h.lastBreedAt ? new Date(h.lastBreedAt.getTime() + 6 * 3600000) : null
    return {
      id: h.id, type: h.type, name: h.name, level: h.level,
      ageDays: effAgeDays, lifespan, status: effStatus as 'active' | 'retired',
      emoji: def.emoji, rarity: def.rarity,
      pendingEggs: pend,
      ratePerHour: +(def.eggsPerHour * mult * (health / 100) * stagePct * lvlMult * traitMult).toFixed(2),
      stage: stage.key, stageName: stage.name, stageEmoji: stage.emoji,
      traits, generation: h.generation,
      breedCooldownUntil: breedReadyAt && breedReadyAt > now ? breedReadyAt.toISOString() : null,
    }
  })

  const animalList = animals.map(a => {
    const def = ANIMAL_TYPES[a.type]
    const pend = def.coinsPerHour > 0
      ? Math.floor(Math.min((now.getTime() - a.lastCollectedAt.getTime()) / 3600000, storageCap) * def.coinsPerHour * mult * (health / 100) * (1 + shelterBonus / 100))
      : 0
    return {
      id: a.id, type: a.type, name: a.name, emoji: def.emoji,
      effect: def.effect, effectValue: def.effectValue,
      passive: def.coinsPerHour > 0, pendingCoins: pend,
      ageDays: henAgeDays(a.bornAt),
    }
  })

  // daily reward info
  const streak = user.loginStreak
  const nextRewardIdx = user.lastDailyClaim && isSameUtcDay(user.lastDailyClaim, now) ? (streak - 1) % 7 : streak % 7
  const canClaimDaily = !user.lastDailyClaim || !isSameUtcDay(user.lastDailyClaim, now)

  // Phase 15: VIP daily gem claim
  const canClaimVipGems = vipActive && !(user.vipLastClaim && isSameUtcDay(user.vipLastClaim, now))

  // Phase 9: numeric level + reward track
  const nlp = numericLevelProgress(user.xp)
  const levelRewards = Object.entries(LEVEL_REWARDS).map(([lvlStr, rw]) => {
    const lvl = Number(lvlStr)
    return {
      level: lvl, coins: rw.coins, gems: rw.gems, unlock: rw.unlock ?? null,
      reached: nlp.level >= lvl,
      claimed: user.levelRewardClaimed >= lvl,
    }
  })
  const claimableLevelRewards = levelRewards.filter(r => r.reached && !r.claimed).length

  // unread notifs + auto notifications (Phase 17)
  const unreadNotifs = await db.notification.count({ where: { userId: user.id, read: false } })
  const pendingWithdrawals = await db.withdrawal.count({ where: { userId: user.id, status: { in: ['pending', 'hold'] } } })
  await syncAutoNotifications(user.id, {
    readyEggs,
    canDaily: canClaimDaily,
    vipUntil: vipActive ? user.vipUntil : null,
    vipPlan: vipActive ? user.vipPlan : null,
  })

  // Phase 10: inventory items view
  const itemsView = items.map(i => ({
    key: i.key, name: ITEM_TYPES[i.key]?.name ?? i.key,
    emoji: ITEM_TYPES[i.key]?.emoji ?? '📦',
    kind: ITEM_TYPES[i.key]?.kind ?? 'tool',
    desc: ITEM_TYPES[i.key]?.desc ?? '', qty: i.qty,
    usable: ITEM_TYPES[i.key]?.usable ?? false,
  }))

  // Phase 12: clan summary for badge & bonus display
  const clanInfo = clanMemberRow
    ? {
        id: clanMemberRow.clan.id, name: clanMemberRow.clan.name, tag: clanMemberRow.clan.tag,
        emblem: clanMemberRow.clan.emblem, level: clanLevel,
        contribution: clanMemberRow.contribution, role: clanMemberRow.role,
        prodBonusPct: +(clanProdBonus(clanLevel) * 100).toFixed(1),
        lastClaimAt: clanMemberRow.lastClaimAt?.toISOString() ?? null,
      }
    : null

  const lvl = levelInfo(user.xp)
  const value = farmValueOf({ ...user, hens, animals, eggs, farm })

  return {
    user: {
      id: user.id, username: user.username, farmName: user.farmName, avatar: user.avatar,
      coins: user.coins, gems: user.gems, xp: user.xp,
      levelIdx: lvl.idx, levelName: lvl.name, nextXp: lvl.nextXp, levelProgress: lvl.progressPct,
      isAdmin: user.isAdmin, adminRole: user.isAdmin ? (user.adminRole ?? 'super') : null,
      referralCode: user.referralCode,
      loginStreak: user.loginStreak, canClaimDaily,
      dailyReward: DAILY_REWARDS[nextRewardIdx],
      dailyRewardDay: nextRewardIdx + 1,
      createdAt: user.createdAt,
      // Phase 9
      numericLevel: nlp.level, numericLevelPct: nlp.pct, numericLevelNextXp: nlp.nextXp,
      levelRewards, claimableLevelRewards,
      // Phase 15
      vip: vipActive
        ? { plan: user.vipPlan, name: vipPlan?.name ?? 'VIP', until: user.vipUntil!.toISOString(), canClaimGems: canClaimVipGems, dailyGems: vipPlan?.dailyGems ?? 0 }
        : null,
      // Phase 16
      flagged: user.flagged,
    },
    farm: {
      coopLevel: farm.coopLevel, coopCap, landLevel: farm.landLevel, landCap,
      storageLevel: farm.storageLevel, storageCap,
      incubatorLevel: farm.incubatorLevel, incubatorCap,
      feedFactoryLevel: farm.feedFactoryLevel,
      shelterLevel: farm.shelterLevel, shelterCap, shelterBonus,
      lastFedAt: farm.lastFedAt, health,
      buffType: buffActive ? farm.buffType : null,
      buffExpiresAt: buffActive ? farm.buffExpiresAt : null,
      xpBuffUntil: farm.xpBuffUntil && farm.xpBuffUntil > now ? farm.xpBuffUntil : null,
      totalEggsHatch: farm.totalEggsHatch, totalEarned: farm.totalEarned,
      productionMult: +mult.toFixed(2),
      weather: { key: weather.key, name: weather.name, emoji: weather.emoji, pct: weatherPct, desc: weatherPct !== weather.prodPct ? `${weather.desc} · 🎃 scarecrow shielded the storm!` : weather.desc },
    },
    hens: henList,
    animals: animalList,
    eggInventory,
    incubators,
    missions: missionDefs,
    event: event ? { name: event.name, description: event.description, multiplier: event.multiplier, endsAt: event.endsAt } : null,
    config: {
      withdrawalMin: cfg.withdrawalMin, gemToCoins: cfg.gemToCoins,
      marketFeePct: cfg.marketFeePct, maintenanceMode: cfg.maintenanceMode === 1,
    },
    items: itemsView,
    clan: clanInfo,
    pendingFriendRequests: friendPending,
    unreadNotifs, pendingWithdrawals,
    farmValue: value,
  }
}

export type GameState = Awaited<ReturnType<typeof buildGameState>>

function isSameUtcDay(a: Date, b: Date): boolean {
  return a.toISOString().slice(0, 10) === b.toISOString().slice(0, 10)
}
