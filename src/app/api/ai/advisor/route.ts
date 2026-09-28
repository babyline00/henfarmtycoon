import { db } from '@/lib/db'
import { getUserFromRequest, json, err } from '@/lib/auth'
import {
  buildRecommendations, advisorReply, type FarmFacts,
} from '@/lib/ai-advisor'
import { UPGRADES, farmHealth, numericLevel, VIP_PLANS } from '@/lib/game'
import { computeEnergy } from '@/lib/mini-games'

// ══════════ Phase 27 — AI Farm Assistant ══════════

async function gatherFacts(userId: string): Promise<FarmFacts> {
  const now = new Date()
  const [user, farm, hens, animals, eggs, items, clanMember] = await Promise.all([
    db.user.findUniqueOrThrow({ where: { id: userId } }),
    db.farm.upsert({ where: { userId }, update: {}, create: { userId } }),
    db.hen.findMany({ where: { userId } }),
    db.animal.findMany({ where: { userId } }),
    db.egg.findMany({ where: { userId } }),
    db.inventoryItem.findMany({ where: { userId } }),
    db.clanMember.findUnique({ where: { userId }, include: { clan: true } }),
  ])

  const activeHens = hens.filter(h => h.status === 'active').length
  const retiredHens = hens.length - activeHens
  const incubating = eggs.filter(e => e.status === 'incubating' || e.status === 'ready')
  const ready = eggs.filter(e => e.status === 'ready' || (e.status === 'incubating' && (e.hatchAt ?? 0) <= now))
  const incubatorSlots = [4, 6, 8][Math.min(farm.incubatorLevel, 3) - 1] ?? 4
  const coopCap = UPGRADES.coop.levels[farm.coopLevel - 1]?.cap ?? 10
  const vipActive = !!(user.vipUntil && user.vipUntil > now)
  const energy = computeEnergy(user.gameEnergy, user.energyUpdatedAt, vipActive, now)

  return {
    health: farmHealth(farm.lastFedAt),
    buffType: farm.buffExpiresAt && farm.buffExpiresAt > now ? farm.buffType : null,
    lastFedHoursAgo: farm.lastFedAt ? (now.getTime() - farm.lastFedAt.getTime()) / 3600000 : null,
    activeHens, retiredHens,
    totalPendingEggs: 0,
    eggsInInventory: eggs.filter(e => e.status === 'inventory').length,
    incubatingCount: incubating.length,
    incubatorCap: incubatorSlots,
    readyEggs: ready.length,
    coins: user.coins, gems: user.gems,
    coopLevel: farm.coopLevel, coopCap,
    landLevel: farm.landLevel,
    incubatorLevel: farm.incubatorLevel,
    feedFactoryLevel: farm.feedFactoryLevel,
    storageLevel: farm.storageLevel,
    numericLevel: numericLevel(user.xp),
    energy: energy.energy, maxEnergy: energy.max,
    canClaimDaily: !user.lastDailyClaim || user.lastDailyClaim.toISOString().slice(0, 10) !== now.toISOString().slice(0, 10),
    vipName: vipActive && user.vipPlan ? VIP_PLANS[user.vipPlan]?.name ?? 'VIP' : null,
    vipHoursLeft: vipActive && user.vipUntil ? (user.vipUntil.getTime() - now.getTime()) / 3600000 : null,
    clanName: clanMember?.clan.name ?? null,
    medicineQty: items.find(i => i.key === 'medicine')?.qty ?? 0,
    animals: animals.length,
    canBreed: 0,
  }
}

export async function GET(req: Request) {
  const user = await getUserFromRequest(req)
  if (!user) return err('Unauthorized', 401)

  const facts = await gatherFacts(user.id)
  const recs = buildRecommendations(facts)

  return json({
    recommendations: recs,
    projection: {
      activeHens: facts.activeHens,
      estEggsPerDay: Math.max(0, Math.round(facts.activeHens * 0.4 * 24)),
      health: facts.health,
      energy: facts.energy,
    },
  })
}

export async function POST(req: Request) {
  const user = await getUserFromRequest(req)
  if (!user) return err('Unauthorized', 401)
  const body = await req.json().catch(() => null)
  const question = String(body?.question ?? '').trim().slice(0, 300)
  if (!question) return err('Ask me something about your farm!')

  const facts = await gatherFacts(user.id)
  const answer = advisorReply(question, facts)
  return json({ answer })
}
