import { db } from '@/lib/db'
import { getUserFromRequest, json, err } from '@/lib/auth'
import {
  getConfig, getActiveEvent, adjustBalance, addXp, logTx, bumpMission,
  grantHatchReward, bumpDailyStat, notify,
} from '@/lib/economy'
import {
  HEN_TYPES, ANIMAL_TYPES, EGG_TYPES, FEED_TYPES, UPGRADES,
  DAILY_REWARDS, MISSIONS, productionMultiplier, farmHealth, levelIndexForXp, settleProduction,
  randomHenName, randomAnimalName, rollHatchTable,
  // Phase 8-15 additions
  henStage, henLevelMult, traitProdMult, traitLifespanMult, traitEggValueMult,
  numericLevel, LEVEL_REWARDS, rollTrait, TRAITS,
  breedOutcome, BREED_COST, BREED_COOLDOWN_HOURS,
  ITEM_TYPES, FEED_FACTORY_DISCOUNT, SHELTER_CAPS, incubatorSlots, shelterBonusMult,
  GEM_PACKS, VIP_PLANS, weatherFor,
  clanLevelOf, CLAN_CREATE_COST, CLAN_MAX_MEMBERS, CLAN_WEEKLY_REWARD,
  GIFT_AMOUNT, FRIEND_LIMIT,
} from '@/lib/game'
import {
  checkRate, botCheck, logSecurityEvent, flagUser,
  referencePrice, priceSanityOk,
} from '@/lib/security'
import {
  PAY_METHOD_DEFS, getPayMethods,
  depositBonusPct, validProof, validateWithdrawFields, withdrawFee, usd,
} from '@/lib/payment'

const MAX_LISTINGS = 10

// building upgrade price tables (Phase 11)
const BUILDING_PRICES: Record<string, number[]> = {
  incubator: [0, 3000, 12000], // level 1 is default
  feedFactory: [0, 1500, 5000, 15000], // level 0 = not built
  shelter: [0, 2500, 8000, 20000],
}

async function ownsHorse(userId: string) {
  return !!(await db.animal.findFirst({ where: { userId, type: 'horse' } }))
}

async function xpGain(userId: string, base: number) {
  const horse = await ownsHorse(userId)
  const farm = await db.farm.findUnique({ where: { userId } })
  const tonic = farm?.xpBuffUntil && farm.xpBuffUntil > new Date() ? 2 : 1
  return Math.round(base * (horse ? 1.25 : 1) * tonic)
}

async function prodMult(userId: string) {
  const [farm, cfg, ev, animals, clanMember] = await Promise.all([
    db.farm.findUnique({ where: { userId } }),
    getConfig(),
    getActiveEvent(),
    db.animal.findMany({ where: { userId } }),
    db.clanMember.findUnique({ where: { userId }, include: { clan: true } }),
  ])
  const now = new Date()
  const weather = weatherFor(now)
  const hasScarecrow = await db.inventoryItem.findFirst({ where: { userId, key: 'scarecrow', qty: { gt: 0 } } })
  const weatherPct = weather.key === 'storm' && hasScarecrow ? 0 : weather.prodPct
  const clanLevel = clanMember ? clanLevelOf(clanMember.clan.xp) : 0
  const user = await db.user.findUnique({ where: { id: userId } })
  const vipActive = !!(user?.vipUntil && user.vipUntil > now)
  const vipBonus = vipActive && user?.vipPlan ? VIP_PLANS[user.vipPlan]?.prodBonusPct ?? 0 : 0
  return productionMultiplier({
    dogBonus: animals.some(a => a.type === 'dog'),
    landLevel: farm?.landLevel ?? 1,
    buffType: farm?.buffType,
    buffActive: !!(farm?.buffExpiresAt && farm.buffExpiresAt > now),
    eventMultiplier: ev?.multiplier ?? 100,
    configGlobal: cfg.globalProduction,
    weatherPct,
    vipBonusPct: vipBonus,
    clanBonusPct: clanMember ? clanLevel * 2 : 0,
  })
}

function parseTraits(hen: { traits: string | null }): string[] {
  try { return hen.traits ? JSON.parse(hen.traits) : [] } catch { return [] }
}

export async function POST(req: Request) {
  const user = await getUserFromRequest(req)
  if (!user) return err('Unauthorized', 401)

  const body = await req.json().catch(() => null)
  if (!body?.action) return err('Missing action')
  const { action } = body as { action: string; [k: string]: unknown }

  // ── Phase 16: rate limiting + bot detection (server-side) ──
  const rate = checkRate(user.id, action)
  if (!rate.ok) {
    await logSecurityEvent(user.id, 'rate_limit', `Action "${action}" throttled (${rate.retryAfterSec}s cooldown)`)
    return err(`Slow down! Try again in ${rate.retryAfterSec}s`, 429)
  }
  const botLike = await botCheck(user.id, action)
  if (botLike) {
    return err('Account flagged for suspicious activity. Contact support if this is a mistake.', 403)
  }

  const farm = await db.farm.upsert({ where: { userId: user.id }, update: {}, create: { userId: user.id } })
  const now = new Date()
  const cfg = await getConfig()

  // ══════════ COLLECT FROM ALL HENS ══════════
  if (action === 'collect_hens') {
    const hens = await db.hen.findMany({ where: { userId: user.id } })
    const activeHens = hens.filter(h => {
      if (h.status !== 'active') return false
      const def = HEN_TYPES[h.type]
      const lifespan = Math.round(def.lifespanDays * traitLifespanMult(parseTraits(h)))
      return (now.getTime() - h.bornAt.getTime()) / 86400000 < lifespan
    })
    if (!activeHens.length) return err('No active hens in your coop')

    const storageCap = UPGRADES.storage.levels[farm.storageLevel - 1]?.cap ?? 24
    const health = farmHealth(farm.lastFedAt) / 100
    const mult = await prodMult(user.id)
    const eggsByType: Record<string, number> = {}
    let collected = 0

    for (const h of activeHens) {
      const def = HEN_TYPES[h.type]
      const traits = parseTraits(h)
      const stage = henStage(Math.floor((now.getTime() - h.bornAt.getTime()) / 86400000))
      const stagePct = stage.prodPct / 100
      const lvlMult = henLevelMult(h.level)
      const traitMult = traitProdMult(traits)
      // settleProduction carries the fractional remainder forward. Resettting
      // the clock to `now` here instead cost a 0.4 eggs/hour Normal Hen every
      // egg it ever laid whenever the player collected more than every 2.5h.
      const settle = settleProduction({
        lastCollectedAt: h.lastCollectedAt,
        ratePerHour: def.eggsPerHour * mult * health * stagePct * lvlMult * traitMult,
        capHours: storageCap,
        now,
      })
      const amount = settle.amount
      if (amount > 0) {
        eggsByType[def.eggType] = (eggsByType[def.eggType] ?? 0) + amount
        collected += amount
      }
      // hen xp → level up (max 10): threshold to reach L+1 is L*25 cumulative xp
      const gained = Math.max(1, amount)
      const newXp = h.xp + gained
      let newLevel = h.level
      while (newLevel < 10 && newXp >= newLevel * 25) { newLevel++ }
      await db.hen.update({
        where: { id: h.id },
        // the settled clock, not `now` — see settleProduction
        data: { lastCollectedAt: settle.lastCollectedAt, xp: { increment: gained }, ...(newLevel > h.level ? { level: newLevel } : {}) },
      })
    }

    if (collected === 0) {
      return json({ ok: true, collected: 0, message: 'Hens are still working... check back soon!' })
    }

    for (const [type, n] of Object.entries(eggsByType)) {
      await db.egg.createMany({ data: Array.from({ length: n }, () => ({ userId: user.id, type })) })
    }
    await bumpDailyStat({ eggsLaid: collected })
    const xp = await xpGain(user.id, Math.ceil(collected / 2))
    await addXp(user.id, xp)
    await bumpMission(user.id, 'collect_eggs', collected)
    await bumpMission(user.id, 'collect_prod', 1)

    return json({
      ok: true, collected, eggsByType, xp,
      message: `Collected ${collected} eggs! +${xp} XP`,
    })
  }

  // ══════════ COLLECT FROM ANIMALS ══════════
  if (action === 'collect_animals') {
    const animals = await db.animal.findMany({ where: { userId: user.id } })
    const producers = animals.filter(a => (ANIMAL_TYPES[a.type]?.coinsPerHour ?? 0) > 0)
    if (!producers.length) return err('No producing animals on your farm')

    const storageCap = UPGRADES.storage.levels[farm.storageLevel - 1]?.cap ?? 24
    const health = farmHealth(farm.lastFedAt) / 100
    const mult = await prodMult(user.id)
    // Same function the state builder quotes it from, so the advertised
    // bonus and the paid bonus cannot drift apart.
    const shelterBonus = shelterBonusMult(farm.shelterLevel)
    let total = 0

    for (const a of producers) {
      const def = ANIMAL_TYPES[a.type]
      const settle = settleProduction({
        lastCollectedAt: a.lastCollectedAt,
        ratePerHour: def.coinsPerHour * mult * health * shelterBonus,
        capHours: storageCap,
        now,
      })
      total += settle.amount
      await db.animal.update({ where: { id: a.id }, data: { lastCollectedAt: settle.lastCollectedAt } })
    }

    if (total === 0) return json({ ok: true, collected: 0, message: 'Animals are still producing...' })

    await adjustBalance(user.id, total, 0, 'production', 'Animal production (milk, wool & eggs)')
    await db.farm.update({ where: { userId: user.id }, data: { totalEarned: { increment: total } } })
    const xp = await xpGain(user.id, Math.max(2, Math.ceil(total / 50)))
    await addXp(user.id, xp)
    await bumpMission(user.id, 'collect_prod', 1)

    return json({ ok: true, collected: total, xp, message: `Harvested ${total} coins from your animals! +${xp} XP` })
  }

  // ══════════ FEED FARM ══════════
  if (action === 'feed') {
    const feedType = String(body.feedType ?? 'corn')
    const def = FEED_TYPES[feedType]
    if (!def) return err('Unknown feed type')

    // Phase 11: feed factory discount
    const discountPct = FEED_FACTORY_DISCOUNT[Math.min(farm.feedFactoryLevel, FEED_FACTORY_DISCOUNT.length - 1)] ?? 0
    const price = Math.max(1, Math.round(def.price * (1 - discountPct / 100)))
    if (user.coins < price) return err('Not enough coins')

    const buffActive = farm.buffExpiresAt && farm.buffExpiresAt > now
    const base = buffActive && farm.buffType === feedType ? farm.buffExpiresAt! : now
    const expiresAt = new Date(base.getTime() + def.hours * 3600000)

    await db.farm.update({
      where: { userId: user.id },
      data: { buffType: feedType, buffExpiresAt: expiresAt, lastFedAt: now },
    })
    await adjustBalance(user.id, -price, 0, 'buy', `Fed farm with ${def.name}${discountPct ? ` (factory -${discountPct}%)` : ''}`)
    const xp = await xpGain(user.id, 5)
    await addXp(user.id, xp)
    await bumpMission(user.id, 'feed', 1)

    return json({ ok: true, message: `🐔 Farm fed! +${def.boostPct}% production for ${def.hours}h${discountPct ? ` · saved ${def.price - price} coins 🏭` : ''}`, xp })
  }

  // ══════════ BUY (hen | animal | egg | upgrade | building | item) ══════════
  if (action === 'buy') {
    const itemType = String(body.itemType)
    const subType = String(body.subType)

    // ── Phase 10: buy inventory item ──
    if (itemType === 'item') {
      const def = ITEM_TYPES[subType]
      if (!def) return err('Unknown item')
      if (def.gemPrice) {
        if (user.gems < def.gemPrice) return err(`Need ${def.gemPrice} 💎 gems`)
        await adjustBalance(user.id, 0, -def.gemPrice, 'buy', `Bought ${def.name}`)
      } else {
        if (user.coins < def.price) return err('Not enough coins')
        await adjustBalance(user.id, -def.price, 0, 'buy', `Bought ${def.name}`)
      }
      await db.inventoryItem.upsert({
        where: { userId_key: { userId: user.id, key: subType } },
        update: { qty: { increment: 1 } },
        create: { userId: user.id, key: subType, qty: 1 },
      })
      await addXp(user.id, await xpGain(user.id, 3))
      await bumpMission(user.id, 'buy', 1)
      return json({ ok: true, message: `${def.emoji} ${def.name} added to your barn!` })
    }

    // ── Phase 11: build / upgrade farm building ──
    if (itemType === 'building') {
      const key = subType // incubator | feedFactory | shelter
      const prices = BUILDING_PRICES[key]
      if (!prices) return err('Unknown building')
      const curLevel = key === 'incubator' ? farm.incubatorLevel : key === 'feedFactory' ? farm.feedFactoryLevel : farm.shelterLevel
      if (curLevel >= prices.length - 1) return err('Building is already at max level')
      const price = prices[curLevel + 1]
      if (user.coins < price) return err('Not enough coins')

      await adjustBalance(user.id, -price, 0, 'upgrade', `Built/upgraded ${key} to Lv${curLevel + 1}`)
      const data = key === 'incubator'
        ? { incubatorLevel: curLevel + 1 }
        : key === 'feedFactory'
          ? { feedFactoryLevel: curLevel + 1 }
          : { shelterLevel: curLevel + 1 }
      await db.farm.update({ where: { userId: user.id }, data })
      await addXp(user.id, await xpGain(user.id, 25))
      return json({ ok: true, message: `🏗️ ${key === 'incubator' ? 'Incubator Room' : key === 'feedFactory' ? 'Feed Factory' : 'Animal Shelter'} is now Level ${curLevel + 1}!` })
    }

    // ── hen ──
    if (itemType === 'hen') {
      const def = HEN_TYPES[subType]
      if (!def) return err('Unknown hen breed')
      const lvlIdx = levelIndexForXp(user.xp)
      const reqLvl = { normal: 0, golden: 1, royal: 2, magic: 3 }[subType] ?? 0
      if (lvlIdx < reqLvl) {
        return err(`${def.name} unlocks at ${['Beginner', 'Village', 'Master', 'Royal'][reqLvl]} Farmer level`)
      }
      const count = await db.hen.count({ where: { userId: user.id } })
      const coopCap = UPGRADES.coop.levels[farm.coopLevel - 1]?.cap ?? 10
      if (count >= coopCap) return err(`Coop is full (${count}/${coopCap}). Upgrade your Chicken House!`)
      if (user.coins < def.price) return err('Not enough coins')

      await adjustBalance(user.id, -def.price, 0, 'buy', `Bought ${def.name}`)
      const hen = await db.hen.create({ data: { userId: user.id, type: subType, name: randomHenName() } })
      await addXp(user.id, await xpGain(user.id, 5))
      await bumpMission(user.id, 'buy', 1)
      return json({ ok: true, henId: hen.id, message: `${def.emoji} ${def.name} "${hen.name}" joined your coop!` })
    }

    // ── animal ──
    if (itemType === 'animal') {
      const def = ANIMAL_TYPES[subType]
      if (!def) return err('Unknown animal')
      const count = await db.animal.count({ where: { userId: user.id } })
      const cap = Math.max(
        UPGRADES.land.levels[farm.landLevel - 1]?.cap ?? 6,
        SHELTER_CAPS[Math.min(farm.shelterLevel, SHELTER_CAPS.length - 1)] ?? 6
      )
      if (count >= cap) return err(`Animal pens are full (${count}/${cap}). Upgrade Farm Land or build a Shelter!`)
      if (user.coins < def.price) return err('Not enough coins')

      await adjustBalance(user.id, -def.price, 0, 'buy', `Bought ${def.name}`)
      const animal = await db.animal.create({ data: { userId: user.id, type: subType, name: randomAnimalName(subType) } })
      await addXp(user.id, await xpGain(user.id, 8))
      await bumpMission(user.id, 'buy', 1)
      return json({ ok: true, message: `${def.emoji} ${def.name} "${animal.name}" is now on your farm!` })
    }

    // ── egg ──
    if (itemType === 'egg') {
      const def = EGG_TYPES[subType]
      if (!def || !def.purchasable) return err('This egg cannot be purchased')
      if (user.coins < (def.buyPrice ?? 0)) return err('Not enough coins')

      await adjustBalance(user.id, -(def.buyPrice ?? 0), 0, 'buy', `Bought ${def.name}`)
      await db.egg.create({ data: { userId: user.id, type: subType } })
      await addXp(user.id, await xpGain(user.id, 3))
      await bumpMission(user.id, 'buy', 1)
      return json({ ok: true, message: `${def.emoji} ${def.name} added to your inventory!` })
    }

    // ── upgrade (coop | land | storage) ──
    if (itemType === 'upgrade') {
      const key = subType
      const def = UPGRADES[key]
      if (!def) return err('Unknown upgrade')
      const curLevel = key === 'coop' ? farm.coopLevel : key === 'land' ? farm.landLevel : farm.storageLevel
      if (curLevel >= def.levels.length) return err(`${def.name} is already at max level`)
      const next = def.levels[curLevel]
      if (user.coins < next.price) return err('Not enough coins')

      await adjustBalance(user.id, -next.price, 0, 'upgrade', `Upgraded ${def.name} to Lv${curLevel + 1}`)
      const data = key === 'coop' ? { coopLevel: curLevel + 1 } : key === 'land' ? { landLevel: curLevel + 1 } : { storageLevel: curLevel + 1 }
      await db.farm.update({ where: { userId: user.id }, data })
      await addXp(user.id, await xpGain(user.id, 25))
      return json({ ok: true, message: `${def.emoji} ${def.name} upgraded to Level ${curLevel + 1}!` })
    }

    return err('Unknown item type')
  }

  // ══════════ USE INVENTORY ITEM (Phase 10) ══════════
  if (action === 'use_item') {
    const key = String(body.itemKey)
    const def = ITEM_TYPES[key]
    if (!def || !def.usable) return err('This item cannot be used')

    const inv = await db.inventoryItem.findUnique({ where: { userId_key: { userId: user.id, key } } })
    if (!inv || inv.qty < 1) return err(`You don't have any ${def.name}`)

    let message = ''
    if (key === 'medicine') {
      await db.farm.update({ where: { userId: user.id }, data: { lastFedAt: now } })
      message = '💉 Medicine applied! Farm health restored to 100%.'
    } else if (key === 'feed_sack') {
      await db.farm.update({ where: { userId: user.id }, data: { lastFedAt: now } })
      message = '🌾 Feed sack used! Hens are happily fed.'
    } else if (key === 'vitamin') {
      await db.farm.update({
        where: { userId: user.id },
        data: { buffType: 'vitamin', buffExpiresAt: new Date(now.getTime() + 6 * 3600000) },
      })
      message = '💊 Vitamins administered! +25% production for 6h.'
    } else if (key === 'golden_feed') {
      await db.farm.update({
        where: { userId: user.id },
        data: { buffType: 'golden_feed', buffExpiresAt: new Date(now.getTime() + 2 * 3600000) },
      })
      message = '🍯 Golden Feast served! +100% production for 2h.'
    } else if (key === 'xp_tonic') {
      await db.farm.update({ where: { userId: user.id }, data: { xpBuffUntil: new Date(now.getTime() + 2 * 3600000) } })
      message = '🧪 XP Tonic drunk! Double XP for 2 hours.'
    } else if (key === 'growth_shot') {
      const henId = String(body.henId ?? '')
      const hen = await db.hen.findFirst({ where: { id: henId, userId: user.id } })
      if (!hen) return err('Select a hen to grow first')
      const ageDays = (now.getTime() - hen.bornAt.getTime()) / 86400000
      if (ageDays > 5) return err('This hen is already grown')
      await db.hen.update({ where: { id: hen.id }, data: { bornAt: new Date(now.getTime() - 6 * 86400000) } })
      message = `🚀 ${hen.name} instantly grew to Prime stage!`
    } else if (key === 'egg_charm') {
      message = '🧿 Lucky Egg Charm will auto-apply to your next hatch!'
    }

    await db.inventoryItem.update({ where: { id: inv.id }, data: { qty: { decrement: 1 } } })
    return json({ ok: true, message })
  }

  // ══════════ 🧬 BREEDING (Phase 8 genetics) ══════════
  if (action === 'breed') {
    const henAId = String(body.henAId ?? '')
    const henBId = String(body.henBId ?? '')
    if (henAId === henBId) return err('Pick two different hens')

    const [henA, henB] = await Promise.all([
      db.hen.findFirst({ where: { id: henAId, userId: user.id } }),
      db.hen.findFirst({ where: { id: henBId, userId: user.id } }),
    ])
    if (!henA || !henB) return err('Hens not found')

    for (const [label, h] of [['First', henA], ['Second', henB]] as const) {
      const stage = henStage(Math.floor((now.getTime() - h.bornAt.getTime()) / 86400000))
      if (stage.key === 'chick' || stage.key === 'growing') {
        return err(`${label} hen (${h.name}) is too young to breed (${stage.name})`)
      }
      if (h.lastBreedAt) {
        const readyAt = new Date(h.lastBreedAt.getTime() + BREED_COOLDOWN_HOURS * 3600000)
        if (readyAt > now) {
          const mins = Math.ceil((readyAt.getTime() - now.getTime()) / 60000)
          return err(`${h.name} needs ${mins} more min to rest (breeding cooldown)`)
        }
      }
    }

    if (user.coins < BREED_COST) return err(`Breeding costs ${BREED_COST} coins`)

    const traitsA = parseTraits(henA)
    const traitsB = parseTraits(henB)
    const outcome = rollHatchTable(breedOutcome(henA.type, henB.type))
    const gen = Math.max(henA.generation, henB.generation) + 1

    let forceTraits: string[] | null = null
    if (outcome.startsWith('mutation:')) {
      forceTraits = ['legendary_blood']
    } else {
      // 35% chance to inherit one parent trait
      const parentTraits = [...traitsA, ...traitsB]
      if (parentTraits.length && Math.random() < 0.35) {
        const inherited = parentTraits[Math.floor(Math.random() * parentTraits.length)]
        const extra = rollTrait()
        forceTraits = Array.from(new Set([inherited, ...(extra !== 'none' ? [extra] : [])]))
      }
    }

    await adjustBalance(user.id, -BREED_COST, 0, 'breed', `Breeding ${HEN_TYPES[henA.type].name} × ${HEN_TYPES[henB.type].name}`)
    const result = await grantHatchReward(user.id, outcome, gen, forceTraits)
    await db.hen.update({ where: { id: henA.id }, data: { lastBreedAt: now } })
    await db.hen.update({ where: { id: henB.id }, data: { lastBreedAt: now } })
    await addXp(user.id, await xpGain(user.id, 15))

    return json({ ok: true, hatch: result, message: result.title })
  }

  // ══════════ SELL EGGS ══════════
  if (action === 'sell_eggs') {
    const type = String(body.eggType)
    const count = Math.max(1, Number(body.count ?? 1))
    const def = EGG_TYPES[type]
    if (!def) return err('Unknown egg type')

    const eggs = await db.egg.findMany({ where: { userId: user.id, status: 'inventory', type }, take: count })
    if (eggs.length === 0) return err(`No ${def.name}s in inventory`)
    const n = eggs.length

    const [animals, hens] = await Promise.all([
      db.animal.findMany({ where: { userId: user.id } }),
      db.hen.findMany({ where: { userId: user.id } }),
    ])
    const catBonus = animals.some(a => a.type === 'cat') ? 1.05 : 1
    // Phase 8: Golden Touch trait bonus from any hen
    const goldenTouch = hens.some(h => parseTraits(h).includes('golden_touch')) ? 1.05 : 1
    const value = Math.round(def.sellValue * n * catBonus * goldenTouch)

    await db.egg.deleteMany({ where: { id: { in: eggs.map(e => e.id) } } })
    await adjustBalance(user.id, value, 0, 'sell', `Sold ${n} × ${def.name}`)
    await db.farm.update({ where: { userId: user.id }, data: { totalEarned: { increment: value } } })
    await addXp(user.id, await xpGain(user.id, Math.ceil(n / 3)))
    await bumpMission(user.id, 'sell', n)

    return json({ ok: true, message: `Sold ${n} × ${def.emoji} ${def.name} for ${value} coins!` })
  }

  // ══════════ INCUBATE EGG ══════════
  if (action === 'incubate') {
    const type = String(body.eggType)
    const def = EGG_TYPES[type]
    if (!def) return err('Unknown egg type')

    const maxSlots = incubatorSlots(farm)
    const incubating = await db.egg.count({ where: { userId: user.id, status: 'incubating' } })
    const ready = await db.egg.count({ where: { userId: user.id, status: 'ready' } })
    if (incubating + ready >= maxSlots) return err(`All ${maxSlots} incubator slots are busy! Upgrade the Incubator Room 🏹`)

    const egg = await db.egg.findFirst({ where: { userId: user.id, status: 'inventory', type }, orderBy: { createdAt: 'asc' } })
    if (!egg) return err(`No ${def.name} in inventory`)

    const hatchAt = new Date(now.getTime() + def.hatchHours * 3600000)
    await db.egg.update({ where: { id: egg.id }, data: { status: 'incubating', incubatedAt: now, hatchAt } })

    return json({ ok: true, message: `${def.emoji} ${def.name} placed in incubator. Hatches in ${def.hatchHours}h!` })
  }

  // ══════════ OPEN HATCHED EGG ══════════
  if (action === 'open_egg') {
    const eggId = String(body.eggId)
    const egg = await db.egg.findFirst({ where: { id: eggId, userId: user.id } })
    if (!egg) return err('Egg not found')
    if (egg.status === 'inventory') return err('Put this egg in the incubator first')
    if (egg.status === 'opened') return err('Already opened')
    if (egg.hatchAt && egg.hatchAt > now) {
      const mins = Math.ceil((egg.hatchAt.getTime() - now.getTime()) / 60000)
      return err(`Still incubating — ${mins} min remaining`)
    }

    const def = EGG_TYPES[egg.type]
    // Phase 10: Lucky Egg Charm — reroll once if the roll lands on one of the
    // two least valuable outcomes; Phase 8: lucky trait = double roll keep best
    let reward = rollHatchTable(def.hatchTable)
    const charm = await db.inventoryItem.findUnique({ where: { userId_key: { userId: user.id, key: 'egg_charm' } } })
    if (charm && charm.qty > 0 && def.hatchTable.findIndex(r => r.reward === reward) < def.hatchTable.length - 2) {
      const rerolled = rollHatchTable(def.hatchTable)
      if (def.hatchTable.findIndex(r => r.reward === rerolled) > def.hatchTable.findIndex(r => r.reward === reward)) {
        reward = rerolled
        await db.inventoryItem.update({ where: { id: charm.id }, data: { qty: { decrement: 1 } } })
      }
    }
    const luckyHens = await db.hen.findMany({ where: { userId: user.id } })
    if (luckyHens.some(h => parseTraits(h).includes('lucky'))) {
      const second = rollHatchTable(def.hatchTable)
      if (def.hatchTable.findIndex(r => r.reward === second) > def.hatchTable.findIndex(r => r.reward === reward)) {
        reward = second
      }
    }

    const result = await grantHatchReward(user.id, reward)
    await db.egg.update({ where: { id: egg.id }, data: { status: 'opened', openedAt: now } })
    await db.farm.update({ where: { userId: user.id }, data: { totalEggsHatch: { increment: 1 } } })
    await bumpDailyStat({ eggsHatched: 1 })
    await addXp(user.id, await xpGain(user.id, 8))
    await bumpMission(user.id, 'hatch', 1)

    return json({ ok: true, hatch: result, message: result.title })
  }

  // ══════════ SPEED UP HATCH WITH GEMS ══════════
  if (action === 'speedup') {
    const eggId = String(body.eggId)
    const egg = await db.egg.findFirst({ where: { id: eggId, userId: user.id, status: 'incubating' } })
    if (!egg) return err('Incubating egg not found')
    if (!egg.hatchAt || egg.hatchAt <= now) return err('This egg is already ready!')

    const hoursLeft = (egg.hatchAt.getTime() - now.getTime()) / 3600000
    const cost = Math.max(1, Math.ceil(hoursLeft))
    if (user.gems < cost) return err(`Need ${cost} 💎 gems to speed up (you have ${user.gems})`)

    await adjustBalance(user.id, 0, -cost, 'exchange', `Speed up ${EGG_TYPES[egg.type].name} hatch`)
    await db.egg.update({ where: { id: egg.id }, data: { hatchAt: now } })
    return json({ ok: true, message: `⚡ Hatch sped up for ${cost} gems — egg is ready!` })
  }

  // ══════════ DAILY REWARD ══════════
  if (action === 'claim_daily') {
    const today = now.toISOString().slice(0, 10)
    if (user.lastDailyClaim && user.lastDailyClaim.toISOString().slice(0, 10) === today) {
      return err('Daily reward already claimed today. Come back tomorrow!')
    }

    const yesterday = new Date(now.getTime() - 86400000).toISOString().slice(0, 10)
    const streak = user.lastDailyClaim && user.lastDailyClaim.toISOString().slice(0, 10) === yesterday
      ? user.loginStreak + 1
      : 1

    const rewardIdx = (streak - 1) % 7
    const coins = DAILY_REWARDS[rewardIdx]
    const gems = rewardIdx === 6 ? 2 : 0

    await db.user.update({ where: { id: user.id }, data: { loginStreak: streak, lastDailyClaim: now } })
    await adjustBalance(user.id, coins, gems, 'daily', `Daily login reward (day ${((streak - 1) % 7) + 1})`)
    await addXp(user.id, 5)

    return json({
      ok: true,
      message: `🎁 Day ${((streak - 1) % 7) + 1} reward: +${coins} coins${gems ? ` +${gems} gems 💎` : ''}!`,
      streak,
    })
  }

  // ══════════ PHASE 9: CLAIM LEVEL REWARD ══════════
  if (action === 'claim_level_reward') {
    const nLevel = numericLevel(user.xp)
    const nextClaimable = Object.keys(LEVEL_REWARDS)
      .map(Number)
      .sort((a, b) => a - b)
      .find(lvl => lvl > user.levelRewardClaimed && nLevel >= lvl)
    if (!nextClaimable) return err('No level reward available yet — keep earning XP!')

    const rw = LEVEL_REWARDS[nextClaimable]
    await db.user.update({ where: { id: user.id }, data: { levelRewardClaimed: nextClaimable } })
    await adjustBalance(user.id, rw.coins, rw.gems, 'level', `Level ${nextClaimable} milestone reward`)
    return json({
      ok: true,
      message: `⭐ Level ${nextClaimable} reward: +${rw.coins} coins${rw.gems ? ` +${rw.gems}💎` : ''}${rw.unlock ? ` · Unlocked ${rw.unlock}` : ''}!`,
    })
  }

  // ══════════ PHASE 15: VIP DAILY GEMS ══════════
  if (action === 'claim_vip_daily') {
    const vipActive = user.vipUntil && user.vipUntil > now
    if (!vipActive) return err('You need an active VIP subscription')
    const plan = VIP_PLANS[user.vipPlan ?? '']
    if (!plan) return err('Invalid VIP plan')
    const today = now.toISOString().slice(0, 10)
    if (user.vipLastClaim && user.vipLastClaim.toISOString().slice(0, 10) === today) {
      return err('VIP gems already claimed today')
    }
    await db.user.update({ where: { id: user.id }, data: { vipLastClaim: now } })
    await adjustBalance(user.id, 0, plan.dailyGems, 'vip', `${plan.name} daily gems`)
    return json({ ok: true, message: `👑 VIP perk: +${plan.dailyGems} 💎 claimed!` })
  }

  // ══════════ PHASE 15: PURCHASE GEM PACK (mock checkout) ══════════
  if (action === 'purchase_gems') {
    const sku = String(body.sku ?? '')
    const method = String(body.method ?? 'card')
    const pack = GEM_PACKS.find(p => p.key === sku)
    if (!pack) return err('Unknown gem pack')

    await adjustBalance(user.id, 0, pack.gems, 'purchase', `${pack.name} (${pack.gems} gems)`)
    await db.purchase.create({
      data: {
        userId: user.id, username: user.username, kind: 'gems', sku: pack.key,
        amountCents: pack.priceCents, method, gemsGiven: pack.gems,
      },
    })
    await bumpDailyStat({ revenueCents: pack.priceCents })
    return json({ ok: true, message: `💳 Payment successful! +${pack.gems} 💎 gems added. Thank you for supporting the farm!` })
  }

  // ══════════ PHASE 15: PURCHASE VIP (mock checkout) ══════════
  if (action === 'purchase_vip') {
    const planKey = String(body.planKey ?? '')
    const method = String(body.method ?? 'card')
    const plan = VIP_PLANS[planKey]
    if (!plan) return err('Unknown VIP plan')

    const base = user.vipUntil && user.vipUntil > now ? user.vipUntil : now
    const until = new Date(base.getTime() + plan.days * 86400000)
    await db.user.update({ where: { id: user.id }, data: { vipUntil: until, vipPlan: planKey } })
    await db.purchase.create({
      data: {
        userId: user.id, username: user.username, kind: 'vip', sku: plan.key,
        amountCents: plan.priceCents, method,
      },
    })
    await bumpDailyStat({ revenueCents: plan.priceCents })
    return json({ ok: true, message: `👑 ${plan.name} activated until ${until.toLocaleDateString()}! +${plan.prodBonusPct}% production & ${plan.dailyGems} gems/day.` })
  }

  // ══════════ CLAIM MISSION ══════════
  if (action === 'claim_mission') {
    const key = String(body.key)
    const mission = MISSIONS.find(m => m.key === key)
    if (!mission) return err('Unknown mission')

    const date = now.toISOString().slice(0, 10)
    const um = await db.userMission.findUnique({ where: { userId_key_date: { userId: user.id, key, date } } })
    if (!um) return err('Mission not started yet')
    if (um.claimed) return err('Reward already claimed')
    if (um.progress < mission.target) return err('Mission not completed yet')

    await db.userMission.update({ where: { id: um.id }, data: { claimed: true } })
    await adjustBalance(user.id, mission.rewardCoins, mission.rewardGems, 'mission', `Mission reward: ${mission.title}`)
    await addXp(user.id, mission.rewardXp)

    return json({ ok: true, message: `✅ ${mission.title} complete! +${mission.rewardCoins} coins${mission.rewardGems ? ` +${mission.rewardGems} 💎` : ''}` })
  }

  // ══════════ WITHDRAW (request real payout — Phase 34 full banking details) ══════════
  if (action === 'withdraw') {
    // Phase 26 — emergency mode: admin can freeze all withdrawals
    if (cfg.withdrawalsDisabled === 1) return err('🚨 Withdrawals are temporarily paused by the farm administration. Please try again later.')
    const amount = Math.floor(Number(body.amount))
    const method = String(body.method ?? 'bank')
    const accountTitle = String(body.accountTitle ?? '').trim()
    const address = String(body.accountNumber ?? body.address ?? '').trim()
    const bankName = String(body.bankName ?? '').trim()

    const fieldErr = validateWithdrawFields(method, accountTitle, address, bankName)
    if (fieldErr) return err(fieldErr)
    if (!amount || amount < cfg.withdrawalMin) return err(`Minimum withdrawal is ${cfg.withdrawalMin} coins`)
    if (amount > cfg.wdMaxCoins) return err(`Maximum withdrawal is ${cfg.wdMaxCoins.toLocaleString()} coins per request`)
    if (user.coins < amount) return err('Insufficient coin balance')
    if (!Number.isFinite(amount) || amount <= 0) return err('Invalid amount')

    const pending = await db.withdrawal.count({ where: { userId: user.id, status: { in: ['pending', 'hold'] } } })
    if (pending >= 3) return err('You already have 3 pending withdrawal requests')

    const fee = withdrawFee(amount, cfg.wdFeePct)

    await adjustBalance(user.id, -amount, 0, 'withdraw', `Withdrawal request (${method.toUpperCase()} · fee ${fee})`)
    await db.withdrawal.create({
      data: {
        userId: user.id, username: user.username, amount, method,
        address, accountTitle, bankName, fee,
      },
    })

    // save payment profile for one-tap withdrawals next time
    if (body.save) {
      await db.user.update({
        where: { id: user.id },
        data: { savedTitle: accountTitle, savedAccount: address, savedBank: method === 'bank' ? bankName : null },
      })
    }

    const payout = amount - fee
    return json({ ok: true, message: `💸 Withdrawal of ${amount} coins submitted! Payout after ${cfg.wdFeePct / 100}% fee: ${payout.toLocaleString()} coins. Admin review pending.` })
  }

  // ══════════ DEPOSIT (manual payment with proof — Phase 34) ══════════
  if (action === 'deposit') {
    if (cfg.depositsDisabled === 1) return err('🚨 Deposits are temporarily paused by the farm administration. Please try again later.')
    const amountCents = Math.floor(Number(body.amountCents))
    const method = String(body.method ?? '')
    const senderName = String(body.senderName ?? '').trim()
    const reference = String(body.reference ?? '').trim()
    const proof = String(body.proof ?? '')

    const methods = await getPayMethods()
    const methodDef = PAY_METHOD_DEFS.find(m => m.key === method)
    if (!methodDef) return err('Choose a valid payment method')
    if (!methods[method]?.enabled) return err(`${methodDef.name} is currently unavailable — pick another method`)
    if (!amountCents || amountCents < cfg.depositMinCents) return err(`Minimum deposit is ${usd(cfg.depositMinCents)}`)
    if (amountCents > cfg.depositMaxCents) return err(`Maximum deposit is ${usd(cfg.depositMaxCents)}`)
    if (senderName.length < 3) return err('Enter the account title / name the payment was sent from (min 3 chars)')
    if (reference.length < 4) return err('Enter the transaction reference / ID from your receipt (min 4 chars)')
    if (!validProof(proof)) return err('Payment proof screenshot is required (image up to ~600KB)')

    // duplicate reference guard — same user can't reuse a receipt
    const dup = await db.deposit.findFirst({ where: { userId: user.id, reference } })
    if (dup) return err('This transaction reference was already submitted')

    const hasDepositedBefore = !!(await db.deposit.findFirst({ where: { userId: user.id, status: 'approved' } }))
    const coins = Math.floor(amountCents / 100) * cfg.coinsPerUsd
    const bonusPct = depositBonusPct(amountCents, !hasDepositedBefore)
    const bonusCoins = Math.floor((coins * bonusPct) / 100)

    await db.deposit.create({
      data: { userId: user.id, username: user.username, amountCents, method, senderName, reference, proof, coins, bonusCoins },
    })

    return json({
      ok: true,
      message: `📥 Deposit request for ${usd(amountCents)} received! After verification you'll get 🪙 ${(coins + bonusCoins).toLocaleString()} coins${bonusCoins ? ` (incl. +${bonusPct}% bonus)` : ''}. Admin review usually takes a few minutes.`,
    })
  }

  // ══════════ GEMS → COINS ══════════
  if (action === 'exchange_gems') {
    const gems = Math.max(1, Math.floor(Number(body.gems ?? 1)))
    if (user.gems < gems) return err('Not enough gems')
    const coins = gems * cfg.gemToCoins
    await adjustBalance(user.id, coins, -gems, 'exchange', `Exchanged ${gems} gems for ${coins} coins`)
    return json({ ok: true, message: `💎 ${gems} gems → 🪙 ${coins} coins!` })
  }

  // ══════════ MARKETPLACE: LIST (with anti-fraud price sanity) ══════════
  if (action === 'list_market' || action === 'buy_market') {
    // Phase 26 — emergency mode: admin can freeze the whole marketplace
    if (cfg.marketplaceDisabled === 1) return err('🚨 The marketplace is temporarily paused by the farm administration. Please try again later.')
  }

  if (action === 'list_market') {
    const itemType = String(body.itemType) // hen | animal | egg
    const price = Math.floor(Number(body.price))
    if (!price || price <= 0) return err('Set a valid price')

    const activeCount = await db.marketListing.count({ where: { sellerId: user.id, status: 'active' } })
    const vipActive = user.vipUntil && user.vipUntil > now
    const maxListings = vipActive ? MAX_LISTINGS + 3 : MAX_LISTINGS
    if (activeCount >= maxListings) return err(`Max ${maxListings} active listings${vipActive ? '' : ' (VIP gets +3 slots)'}`)

    // Phase 13/16: price sanity check
    const subTypeForRef = itemType === 'hen'
      ? String(await db.hen.findFirst({ where: { id: String(body.itemId), userId: user.id } }).then(h => h?.type ?? 'normal'))
      : itemType === 'animal'
        ? String(await db.animal.findFirst({ where: { id: String(body.itemId), userId: user.id } }).then(a => a?.type ?? 'cow'))
        : String(body.subType ?? 'normal')
    const ref = referencePrice(itemType === 'egg' ? 'egg' : itemType, subTypeForRef, itemType === 'hen' ? 1 : 1)
    if (!priceSanityOk(price, ref)) {
      await logSecurityEvent(user.id, 'price_abuse', `Listing rejected: ${itemType}/${subTypeForRef} at ${price} (ref ${ref})`)
      return err(`Price must be between ${Math.round(ref * 0.25)} and ${Math.round(ref * 6)} coins for this item (anti-fraud rule)`)
    }

    if (itemType === 'hen') {
      const henId = String(body.itemId)
      const hen = await db.hen.findFirst({ where: { id: henId, userId: user.id } })
      if (!hen) return err('Hen not found')
      await db.hen.delete({ where: { id: hen.id } })
      const def = HEN_TYPES[hen.type]
      const traits = parseTraits(hen)
      const traitLabel = traits.length ? ` · ${traits.map(t => TRAITS[t]?.emoji ?? '').join('')}` : ''
      await db.marketListing.create({
        data: {
          sellerId: user.id, sellerName: user.farmName, itemType: 'hen', subType: hen.type,
          title: `${def.name} "${hen.name}"`, detail: `Gen ${hen.generation} · Lv ${hen.level}${traitLabel} · ${Math.floor((now.getTime() - hen.bornAt.getTime()) / 86400000)}d old`,
          level: hen.level, ageDays: Math.floor((now.getTime() - hen.bornAt.getTime()) / 86400000), price,
        },
      })
      return json({ ok: true, message: `${def.emoji} ${hen.name} listed for ${price} coins!` })
    }

    if (itemType === 'animal') {
      const animalId = String(body.itemId)
      const animal = await db.animal.findFirst({ where: { id: animalId, userId: user.id } })
      if (!animal) return err('Animal not found')
      await db.animal.delete({ where: { id: animal.id } })
      const def = ANIMAL_TYPES[animal.type]
      await db.marketListing.create({
        data: {
          sellerId: user.id, sellerName: user.farmName, itemType: 'animal', subType: animal.type,
          title: `${def.name} "${animal.name}"`, detail: def.desc,
          ageDays: Math.floor((now.getTime() - animal.bornAt.getTime()) / 86400000), price,
        },
      })
      return json({ ok: true, message: `${def.emoji} ${animal.name} listed for ${price} coins!` })
    }

    if (itemType === 'egg') {
      const type = String(body.subType)
      const def = EGG_TYPES[type]
      if (!def) return err('Unknown egg type')
      const egg = await db.egg.findFirst({ where: { userId: user.id, status: 'inventory', type }, orderBy: { createdAt: 'asc' } })
      if (!egg) return err(`No ${def.name} in inventory`)
      await db.egg.delete({ where: { id: egg.id } })
      await db.marketListing.create({
        data: {
          sellerId: user.id, sellerName: user.farmName, itemType: 'egg', subType: type,
          title: def.name, detail: def.desc, price,
        },
      })
      return json({ ok: true, message: `${def.emoji} ${def.name} listed for ${price} coins!` })
    }

    return err('Unknown listing type')
  }

  // ══════════ MARKETPLACE: BUY ══════════
  if (action === 'buy_market') {
    const listingId = String(body.listingId)
    const listing = await db.marketListing.findUnique({ where: { id: listingId } })
    if (!listing || listing.status !== 'active') return err('Listing no longer available')
    if (listing.sellerId === user.id) return err('You cannot buy your own listing')
    if (user.coins < listing.price) return err('Not enough coins')

    const feePct = cfg.marketFeePct
    await adjustBalance(user.id, -listing.price, 0, 'market', `Bought "${listing.title}" from ${listing.sellerName}`)
    await bumpDailyStat({ marketVolume: listing.price })

    if (listing.sellerId !== 'npc') {
      const payout = Math.round(listing.price * (1 - feePct / 100))
      await db.user.update({ where: { id: listing.sellerId }, data: { coins: { increment: payout } } })
      await logTx(listing.sellerId, 'market', payout, 'coins', `Sold "${listing.title}" (fee ${feePct}%)`)
      await db.notification.create({
        data: { userId: listing.sellerId, title: '💰 Listing sold!', body: `"${listing.title}" sold for ${listing.price} coins (you received ${payout} after ${feePct}% fee).` },
      })
    }

    if (listing.itemType === 'hen') {
      await db.hen.create({ data: { userId: user.id, type: listing.subType, name: listing.title.match(/"(.+)"/)?.[1] ?? randomHenName() } })
    } else if (listing.itemType === 'animal') {
      await db.animal.create({ data: { userId: user.id, type: listing.subType, name: listing.title.match(/"(.+)"/)?.[1] ?? randomAnimalName(listing.subType) } })
    } else if (listing.itemType === 'egg') {
      await db.egg.create({ data: { userId: user.id, type: listing.subType } })
    }

    await db.marketListing.update({ where: { id: listing.id }, data: { status: 'sold', buyerId: user.id, soldAt: now } })
    // Phase 13: record trade for price history
    await db.marketTrade.create({
      data: {
        listingId: listing.id, itemType: listing.itemType, subType: listing.subType,
        title: listing.title, price: listing.price,
        sellerId: listing.sellerId, sellerName: listing.sellerName,
        buyerId: user.id, buyerName: user.farmName,
      },
    })
    await addXp(user.id, 3)
    return json({ ok: true, message: `🛍️ You bought "${listing.title}" for ${listing.price} coins!` })
  }

  // ══════════ MARKETPLACE: CANCEL ══════════
  if (action === 'cancel_market') {
    const listingId = String(body.listingId)
    const listing = await db.marketListing.findFirst({ where: { id: listingId, sellerId: user.id, status: 'active' } })
    if (!listing) return err('Listing not found')

    if (listing.itemType === 'hen') {
      await db.hen.create({ data: { userId: user.id, type: listing.subType, name: listing.title.match(/"(.+)"/)?.[1] ?? randomHenName() } })
    } else if (listing.itemType === 'animal') {
      await db.animal.create({ data: { userId: user.id, type: listing.subType, name: listing.title.match(/"(.+)"/)?.[1] ?? randomAnimalName(listing.subType) } })
    } else if (listing.itemType === 'egg') {
      await db.egg.create({ data: { userId: user.id, type: listing.subType } })
    }

    await db.marketListing.update({ where: { id: listing.id }, data: { status: 'cancelled' } })
    return json({ ok: true, message: 'Listing cancelled — item returned to your farm.' })
  }

  // ══════════ PHASE 12: FRIENDS ══════════
  if (action === 'friend_add') {
    const username = String(body.username ?? '').trim().toLowerCase()
    if (!username) return err('Enter a username')
    const target = await db.user.findUnique({ where: { username } })
    if (!target) return err('No farmer found with that username')
    if (target.id === user.id) return err("You can't add yourself!")

    const existing = await db.friend.findFirst({
      where: {
        OR: [
          { userId: user.id, friendId: target.id },
          { userId: target.id, friendId: user.id },
        ],
      },
    })
    if (existing) return err(existing.status === 'accepted' ? 'You are already friends!' : 'Friend request already sent')

    const myCount = (await db.friend.count({ where: { userId: user.id, status: 'accepted' } }))
      + (await db.friend.count({ where: { friendId: user.id, status: 'accepted' } }))
    if (myCount >= FRIEND_LIMIT) return err(`Friend limit is ${FRIEND_LIMIT}`)

    await db.friend.create({ data: { userId: user.id, friendId: target.id } })
    await notify(target.id, '🤝 Friend request', `${user.farmName} (@${user.username}) wants to be your friend!`)
    return json({ ok: true, message: `📨 Friend request sent to @${username}!` })
  }

  if (action === 'friend_accept' || action === 'friend_reject') {
    const requestId = String(body.requestId ?? '')
    const fr = await db.friend.findFirst({ where: { id: requestId, friendId: user.id, status: 'pending' } })
    if (!fr) return err('Request not found')
    if (action === 'friend_accept') {
      await db.friend.update({ where: { id: fr.id }, data: { status: 'accepted' } })
      await notify(fr.userId, '🤝 Friend accepted!', `${user.farmName} accepted your friend request. Send them a gift!`)
      return json({ ok: true, message: '🤝 You are now friends!' })
    }
    await db.friend.delete({ where: { id: fr.id } })
    return json({ ok: true, message: 'Request declined' })
  }

  if (action === 'friend_remove') {
    const friendUserId = String(body.friendUserId ?? '')
    const fr = await db.friend.findFirst({
      where: {
        status: 'accepted',
        OR: [
          { userId: user.id, friendId: friendUserId },
          { userId: friendUserId, friendId: user.id },
        ],
      },
    })
    if (!fr) return err('Friend not found')
    await db.friend.delete({ where: { id: fr.id } })
    return json({ ok: true, message: 'Friend removed' })
  }

  if (action === 'gift_friend') {
    const friendUserId = String(body.friendUserId ?? '')
    if (user.coins < GIFT_AMOUNT) return err(`Gifting costs ${GIFT_AMOUNT} coins`)
    const fr = await db.friend.findFirst({
      where: {
        status: 'accepted',
        OR: [
          { userId: user.id, friendId: friendUserId },
          { userId: friendUserId, friendId: user.id },
        ],
      },
    })
    if (!fr) return err('You are not friends yet')

    // once per friend per day
    const lastGift = fr.userId === user.id ? fr.lastGiftAt : null
    if (lastGift && lastGift.toISOString().slice(0, 10) === now.toISOString().slice(0, 10)) {
      return err('You already gifted this friend today — come back tomorrow!')
    }

    await adjustBalance(user.id, -GIFT_AMOUNT, 0, 'gift', `Gift to friend`)
    await db.user.update({ where: { id: friendUserId }, data: { coins: { increment: GIFT_AMOUNT } } })
    await logTx(friendUserId, 'gift', GIFT_AMOUNT, 'coins', `Gift from @${user.username}`)
    if (fr.userId === user.id) {
      await db.friend.update({ where: { id: fr.id }, data: { lastGiftAt: now } })
    } else {
      // reverse-direction friendship: use a gift marker via notification dedup
      await db.friend.updateMany({ where: { userId: friendUserId, friendId: user.id }, data: { lastGiftAt: now } })
    }
    await notify(friendUserId, '🎁 Gift received!', `${user.farmName} sent you ${GIFT_AMOUNT} coins!`)
    return json({ ok: true, message: `🎁 Gift of ${GIFT_AMOUNT} coins sent to your friend!` })
  }

  if (action === 'help_friend') {
    const friendUserId = String(body.friendUserId ?? '')
    const fr = await db.friend.findFirst({
      where: {
        status: 'accepted',
        OR: [
          { userId: user.id, friendId: friendUserId },
          { userId: friendUserId, friendId: user.id },
        ],
      },
    })
    if (!fr) return err('You are not friends yet')

    // max 5 helps per day (server-side verification)
    const today = now.toISOString().slice(0, 10)
    const helpsToday = await db.transaction.count({
      where: { userId: user.id, type: 'help', createdAt: { gte: new Date(`${today}T00:00:00.000Z`) } },
    })
    if (helpsToday >= 5) return err('You already helped 5 farms today (daily limit)')

    await adjustBalance(user.id, 50, 0, 'help', `Helped a friend's farm`)
    await addXp(user.id, 15)
    await notify(friendUserId, '🧑‍🌾 Farm helped!', `${user.farmName} watered & tidied your farm — your hens are happier!`)
    return json({ ok: true, message: '🧑‍🌾 You helped your friend\'s farm! +50 coins, +15 XP' })
  }

  // ══════════ PHASE 12: CLANS ══════════
  if (action === 'clan_create') {
    const name = String(body.name ?? '').trim()
    const tag = String(body.tag ?? '').trim().toUpperCase()
    const emblem = String(body.emblem ?? '🛡️')
    if (name.length < 3 || name.length > 24) return err('Clan name must be 3-24 characters')
    if (tag.length < 2 || tag.length > 4) return err('Tag must be 2-4 characters')
    if (user.coins < CLAN_CREATE_COST) return err(`Creating a clan costs ${CLAN_CREATE_COST} coins`)

    const exists = await db.clan.findUnique({ where: { name } })
    if (exists) return err('A clan with that name already exists')
    const alreadyIn = await db.clanMember.findUnique({ where: { userId: user.id } })
    if (alreadyIn) return err('Leave your current clan first')

    await adjustBalance(user.id, -CLAN_CREATE_COST, 0, 'clan', `Founded clan "${name}"`)
    const clan = await db.clan.create({
      data: { name, tag, emblem, leaderId: user.id, leaderName: user.farmName, description: `Founded by ${user.farmName}` },
    })
    await db.clanMember.create({ data: { clanId: clan.id, userId: user.id, role: 'chief' } })
    return json({ ok: true, message: `${emblem} Clan "${name}" [${tag}] founded! You are the Chief.` })
  }

  if (action === 'clan_join') {
    const clanId = String(body.clanId ?? '')
    const clan = await db.clan.findUnique({ where: { id: clanId } })
    if (!clan) return err('Clan not found')
    const alreadyIn = await db.clanMember.findUnique({ where: { userId: user.id } })
    if (alreadyIn) return err('Leave your current clan first')
    const level = clanLevelOf(clan.xp)
    const cap = CLAN_MAX_MEMBERS[Math.min(level, CLAN_MAX_MEMBERS.length) - 1] ?? 20
    const count = await db.clanMember.count({ where: { clanId } })
    if (count >= cap) return err(`${clan.name} is full (${count}/${cap})`)

    await db.clanMember.create({ data: { clanId, userId: user.id } })
    await notify(clan.leaderId, '🛡️ New clan member', `${user.farmName} joined ${clan.name}!`)
    return json({ ok: true, message: `${clan.emblem} Welcome to ${clan.name} [${clan.tag}]!` })
  }

  if (action === 'clan_leave') {
    const mem = await db.clanMember.findUnique({ where: { userId: user.id }, include: { clan: true } })
    if (!mem) return err("You're not in a clan")
    const clan = mem.clan
    await db.clanMember.delete({ where: { id: mem.id } })
    const remaining = await db.clanMember.findMany({ where: { clanId: clan.id }, orderBy: { joinedAt: 'asc' } })
    if (remaining.length === 0) {
      await db.clan.delete({ where: { id: clan.id } })
      return json({ ok: true, message: 'You left the clan. It was disbanded (no members left).' })
    }
    if (clan.leaderId === user.id) {
      const nextChief = remaining[0]
      await db.clan.update({ where: { id: clan.id }, data: { leaderId: nextChief.userId, leaderName: 'Chief' } })
      await db.clanMember.update({ where: { id: nextChief.id }, data: { role: 'chief' } })
      await notify(nextChief.userId, '👑 You are the new Chief!', `You now lead ${clan.name}.`)
    }
    return json({ ok: true, message: 'You left the clan.' })
  }

  if (action === 'clan_donate') {
    const amount = Math.floor(Number(body.amount ?? 0))
    if (!amount || amount < 50) return err('Minimum donation is 50 coins')
    if (user.coins < amount) return err('Not enough coins')
    const mem = await db.clanMember.findUnique({ where: { userId: user.id }, include: { clan: true } })
    if (!mem) return err("You're not in a clan")

    await adjustBalance(user.id, -amount, 0, 'clan', `Donated to ${mem.clan.name} treasury`)
    await db.clan.update({ where: { id: mem.clanId }, data: { treasury: { increment: amount }, xp: { increment: Math.floor(amount / 100) } } })
    await db.clanMember.update({ where: { id: mem.id }, data: { contribution: { increment: amount } } })
    return json({ ok: true, message: `💰 Donated ${amount} coins! Clan XP +${Math.floor(amount / 100)}.` })
  }

  if (action === 'clan_claim') {
    const mem = await db.clanMember.findUnique({ where: { userId: user.id }, include: { clan: true } })
    if (!mem) return err("You're not in a clan")
    if (mem.lastClaimAt) {
      const days = (now.getTime() - mem.lastClaimAt.getTime()) / 86400000
      if (days < 7) {
        const daysLeft = Math.ceil(7 - days)
        return err(`Weekly clan reward already claimed — ${daysLeft} day(s) left`)
      }
    }
    const level = clanLevelOf(mem.clan.xp)
    const reward = CLAN_WEEKLY_REWARD[Math.min(level, CLAN_WEEKLY_REWARD.length) - 1] ?? 200
    await db.clanMember.update({ where: { id: mem.id }, data: { lastClaimAt: now } })
    await adjustBalance(user.id, reward, 0, 'clan', `${mem.clan.name} weekly reward (Lv${level})`)
    return json({ ok: true, message: `🛡️ ${mem.clan.name} weekly reward: +${reward} coins!` })
  }

  return err('Unknown action')
}
