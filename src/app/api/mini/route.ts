import { db } from '@/lib/db'
import { getUserFromRequest, json, err } from '@/lib/auth'
import { getConfig, adjustBalance, addXp, bumpMission, bumpDailyStat, notify } from '@/lib/economy'
import {
  computeEnergy, MINI_GAME_DEFS, GAME_TIERS, SEASON_REWARDS,
  tierForLevel, evaluateRun, evaluateCross, evaluateCatch, rollMysteryItem, winTargetFor,
  ABANDON_AFTER_SEC,
} from '@/lib/mini-games'
import { ITEM_TYPES, numericLevel } from '@/lib/game'
import { checkRate, logSecurityEvent, flagUser } from '@/lib/security'

// ── helpers ──────────────────────────────────────────────────

function startOfDayUtc(d = new Date()): Date {
  return new Date(d.toISOString().slice(0, 10) + 'T00:00:00.000Z')
}
function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 86400000)
}

interface BoardRow { userId: string; username: string; avatar: string; farmName: string; vip: boolean; value: number }

async function leaderboardBoard(gameKey: string) {
  const monthStart = new Date()
  monthStart.setUTCDate(1)
  monthStart.setUTCHours(0, 0, 0, 0)

  const [daily, weekly, monthly] = await Promise.all([
    // daily: best single score today
    db.gameSession.groupBy({
      by: ['userId'],
      where: { gameKey, result: { in: ['win', 'loss'] }, createdAt: { gte: startOfDayUtc() } },
      _max: { score: true },
      orderBy: { _max: { score: 'desc' } },
      take: 10,
    }),
    // weekly: most distance travelled
    db.gameSession.groupBy({
      by: ['userId'],
      where: { gameKey, result: { in: ['win', 'loss'] }, createdAt: { gte: daysAgo(7) } },
      _sum: { distance: true },
      orderBy: { _sum: { distance: 'desc' } },
      take: 10,
    }),
    // monthly: champion by total score
    db.gameSession.groupBy({
      by: ['userId'],
      where: { gameKey, result: { in: ['win', 'loss'] }, createdAt: { gte: monthStart } },
      _sum: { score: true },
      orderBy: { _sum: { score: 'desc' } },
      take: 10,
    }),
  ])

  const ids = new Set<string>()
  for (const rows of [daily, weekly, monthly]) for (const r of rows) ids.add(r.userId)
  const users = await db.user.findMany({
    where: { id: { in: [...ids] } },
    select: { id: true, username: true, avatar: true, farmName: true, vipPlan: true, vipUntil: true },
  })
  const uMap = new Map(users.map(u => [u.id, u]))
  const now = new Date()

  const decorate = (rows: { userId: string; value: number }[]): BoardRow[] =>
    rows.map(r => {
      const u = uMap.get(r.userId)
      return {
        userId: r.userId,
        username: u?.username ?? 'unknown',
        avatar: u?.avatar ?? '🧑‍🌾',
        farmName: u?.farmName ?? '',
        vip: !!(u?.vipUntil && u.vipUntil > now),
        value: r.value,
      }
    })

  return {
    daily: decorate(daily.map(r => ({ userId: r.userId, value: r._max.score ?? 0 }))),
    weekly: decorate(weekly.map(r => ({ userId: r.userId, value: r._sum.distance ?? 0 }))),
    monthly: decorate(monthly.map(r => ({ userId: r.userId, value: r._sum.score ?? 0 }))),
  }
}

// ── GET: arcade hub data ─────────────────────────────────────

export async function GET(req: Request) {
  const user = await getUserFromRequest(req)
  if (!user) return err('Unauthorized', 401)

  const cfg = await getConfig()
  const now = new Date()
  const vipActive = !!(user.vipUntil && user.vipUntil > now)
  const energy = computeEnergy(user.gameEnergy, user.energyUpdatedAt, vipActive, now)

  const [games, stats, mySessions] = await Promise.all([
    db.miniGame.findMany({ orderBy: { createdAt: 'asc' } }),
    db.playerGameStats.findUnique({ where: { userId: user.id } }),
    db.gameSession.findMany({
      where: { userId: user.id, result: { in: ['win', 'loss'] } },
      orderBy: { createdAt: 'desc' },
      take: 8,
    }),
  ])

  // ── retire abandoned sessions ──
  // A session is created as 'playing' and only ever closed by a `finish` from
  // the client that opened it. If that client walks away — Quit button, closed
  // tab, crash, lost connection — there is nobody left to report, and the row
  // sat at 'playing' forever. It grew without bound and showed up in the
  // admin's recent list as a game still in progress, which is not something
  // it can ever be: a finish later than the game's cap is rejected outright.
  //
  // Past ABANDON_AFTER_SEC that is guaranteed, so the row is closed here on
  // the player's next visit to the arcade. That threshold carries a grace
  // margin over the longest legal game on purpose — see ABANDON_GRACE_SEC.
  //
  // Deliberately NO energy refund. A refund would be trivially farmable —
  // start a game, close the tab, reopen, repeat — and the energy is the
  // intended price of pressing Play.
  await db.gameSession.updateMany({
    where: {
      userId: user.id,
      result: 'playing',
      createdAt: { lt: new Date(now.getTime() - ABANDON_AFTER_SEC * 1000) },
    },
    data: { result: 'abandoned', duration: ABANDON_AFTER_SEC },
  })

  // sync stored energy forward so the UI (and start) see fresh values
  if (energy.energy !== user.gameEnergy) {
    await db.user.update({
      where: { id: user.id },
      data: { gameEnergy: energy.energy, energyUpdatedAt: now },
    })
  }

  const nLevel = numericLevel(user.xp)
  const myTier = tierForLevel(nLevel)

  const gameViews = await Promise.all(games.map(async g => {
    const def = MINI_GAME_DEFS[g.key as keyof typeof MINI_GAME_DEFS]
    const [myBest, totalPlays] = await Promise.all([
      db.gameSession.aggregate({
        where: { userId: user.id, gameKey: g.key, result: { in: ['win', 'loss'] } },
        _max: { score: true, distance: true },
      }),
      db.gameSession.count({ where: { gameKey: g.key, result: { in: ['win', 'loss'] } } }),
    ])
    return {
      id: g.id, key: g.key, name: g.name, emoji: g.emoji,
      description: g.description, enabled: g.enabled,
      energyCost: g.energyCost,
      winTarget: def?.winTarget ?? 100,
      myBestScore: myBest._max.score ?? 0,
      myBestDistance: myBest._max.distance ?? 0,
      totalPlays,
    }
  }))

  const boards = await Promise.all(games.map(g => leaderboardBoard(g.key)))

  return json({
    energy,
    tier: myTier,
    tierInfo: GAME_TIERS.map((t, i) => ({ ...t, current: i === myTier, locked: nLevel < t.reqLevel })),
    seasonRewards: SEASON_REWARDS,
    games: gameViews,
    leaderboards: Object.fromEntries(games.map((g, i) => [g.key, boards[i]])),
    recentSessions: mySessions.map(s => ({
      id: s.id, gameKey: s.gameKey, score: s.score, distance: s.distance,
      coins: s.coins, eggs: s.eggs, gems: s.gems, xp: s.xp,
      result: s.result, createdAt: s.createdAt,
    })),
    stats: stats ?? { totalGames: 0, wins: 0, losses: 0, highestScore: 0, bestDistance: 0, totalRewards: 0, playTimeSec: 0 },
    arcadeRewardsEnabled: cfg.arcadeRewardsEnabled === 1,
  })
}

// ── POST: start / finish ─────────────────────────────────────

export async function POST(req: Request) {
  const user = await getUserFromRequest(req)
  if (!user) return err('Unauthorized', 401)
  const body = await req.json().catch(() => null)
  const action = body?.action

  // ══════════ START (energy gate + session creation) ══════════
  if (action === 'start') {
    const rate = checkRate(user.id, 'mini_start')
    if (!rate.ok) return err(`Slow down! Next game available in ${rate.retryAfterSec}s`, 429)

    const gameKey = String(body.gameKey ?? '')
    const game = await db.miniGame.findUnique({ where: { key: gameKey } })
    if (!game || !MINI_GAME_DEFS[gameKey as keyof typeof MINI_GAME_DEFS]) return err('Unknown game')
    if (!game.enabled) return err('🎮 This arcade machine is temporarily switched off by the administration')

    const now = new Date()
    const vipActive = !!(user.vipUntil && user.vipUntil > now)
    const energy = computeEnergy(user.gameEnergy, user.energyUpdatedAt, vipActive, now)
    if (energy.energy < game.energyCost) {
      return err(`Not enough arcade energy ⚡ ${energy.energy} available, ${game.energyCost} needed — regenerates +${energy.regenPerHour}/h`)
    }

    // deduct energy
    await db.user.update({
      where: { id: user.id },
      data: { gameEnergy: energy.energy - game.energyCost, energyUpdatedAt: now },
    })

    const tier = tierForLevel(numericLevel(user.xp))
    const session = await db.gameSession.create({
      data: { userId: user.id, gameId: game.id, gameKey: game.key, tier, result: 'playing' },
    })

    return json({
      ok: true,
      sessionId: session.id,
      tier,
      tierName: GAME_TIERS[tier].name,
      tierMult: GAME_TIERS[tier].mult,
      speedMult: GAME_TIERS[tier].speedMult,
      winTarget: winTargetFor(gameKey, tier),
      energyLeft: energy.energy - game.energyCost,
    })
  }

  // ══════════ FINISH (validate + grant rewards) ══════════
  if (action === 'finish') {
    const rate = checkRate(user.id, 'mini_finish')
    if (!rate.ok) return err(`Slow down! Try again in ${rate.retryAfterSec}s`, 429)

    const sessionId = String(body.sessionId ?? '')
    const session = await db.gameSession.findUnique({ where: { id: sessionId } })
    if (!session) return err('Session not found')
    if (session.userId !== user.id) {
      await logSecurityEvent(user.id, 'arcade_cheat', `Tried finishing session ${sessionId} owned by another player`)
      return err('This is not your session', 403)
    }
    if (session.result !== 'playing') return err('Session already finished')

    const durationSec = Math.max(0, Math.floor((Date.now() - session.createdAt.getTime()) / 1000))
    const cfg = await getConfig()
    const rewardsOn = cfg.arcadeRewardsEnabled === 1

    const num = (v: unknown) => Math.max(0, Math.floor(Number(v) || 0))

    let outcome
    if (session.gameKey === 'chicken_run') {
      outcome = evaluateRun({
        distance: num(body.distance),
        coins: num(body.coins),
        eggs: num(body.eggs),
        gems: num(body.gems),
        boxes: num(body.boxes),
        combo: num(body.combo),
      }, session.tier, durationSec)
    } else if (session.gameKey === 'road_crossing') {
      outcome = evaluateCross({
        score: num(body.score),
        coins: num(body.coins),
        powerUps: num(body.powerUps),
      }, session.tier, durationSec)
    } else if (session.gameKey === 'egg_catch') {
      outcome = evaluateCatch({
        eggs: num(body.eggs),
        coins: num(body.coins),
        gems: num(body.gems),
        boxes: num(body.boxes),
        missed: num(body.missed),
      }, session.tier, durationSec)
    } else {
      return err('Unknown game')
    }

    // ── anti-cheat rejection path ──
    if (!outcome.ok) {
      await db.gameSession.update({
        where: { id: session.id },
        data: {
          result: 'rejected', cheated: true, duration: durationSec,
          distance: num(body.distance), score: num(body.score),
        },
      })
      await logSecurityEvent(user.id, 'arcade_cheat', `${session.gameKey}: ${outcome.reason}`)
      await flagUser(user.id, `Arcade impossible result: ${outcome.reason}`)
      return json({
        ok: true, rejected: true, reason: outcome.reason,
        message: '🚨 Impossible result — rewards voided and account flagged for review.',
      })
    }

    // ── grant rewards (server-computed only) ──
    const coins = rewardsOn ? outcome.coins : 0
    const eggs = rewardsOn ? outcome.eggs : 0
    const gems = rewardsOn ? outcome.gems : 0
    const xp = rewardsOn ? outcome.xp : 0

    if (coins > 0 || gems > 0) {
      await adjustBalance(user.id, coins, gems, 'arcade', `${MINI_GAME_DEFS[session.gameKey as keyof typeof MINI_GAME_DEFS].name} rewards`)
    }
    if (eggs > 0) {
      await db.egg.createMany({
        data: Array.from({ length: Math.min(eggs, 20) }, () => ({ userId: user.id, type: 'normal' })),
      })
    }
    if (xp > 0) await addXp(user.id, xp)

    // mystery boxes → random barn items
    const mysteryItems: string[] = []
    if (rewardsOn && outcome.mysteryItem) {
      const boxes = Math.max(1, num(body.boxes))
      for (let i = 0; i < Math.min(boxes, 3); i++) {
        const itemKey = rollMysteryItem()
        mysteryItems.push(itemKey)
        await db.inventoryItem.upsert({
          where: { userId_key: { userId: user.id, key: itemKey } },
          update: { qty: { increment: 1 } },
          create: { userId: user.id, key: itemKey, qty: 1 },
        })
      }
    }

    // champion buff: a win powers the farm +10% for 12h (arcade ↔ farm integration)
    let championBuff = false
    if (rewardsOn && outcome.result === 'win') {
      const farm = await db.farm.upsert({ where: { userId: user.id }, update: {}, create: { userId: user.id } })
      if (!farm.buffExpiresAt || farm.buffExpiresAt < new Date()) {
        await db.farm.update({
          where: { userId: user.id },
          data: { buffType: 'champion', buffExpiresAt: new Date(Date.now() + 12 * 3600000) },
        })
        championBuff = true
      }
    }

    // stats + session record
    const distanceMetric = session.gameKey === 'chicken_run' ? num(body.distance) : 0
    // The catcher reports eggs as its score; only the runner has a distance.
    const scoreMetric = session.gameKey === 'chicken_run' ? num(body.distance)
      : session.gameKey === 'egg_catch' ? num(body.eggs)
        : num(body.score)

    await db.gameSession.update({
      where: { id: session.id },
      data: {
        result: outcome.result, score: scoreMetric, distance: distanceMetric,
        coins, eggs, gems, xp, duration: durationSec,
      },
    })

    const prevStats = await db.playerGameStats.findUnique({ where: { userId: user.id } })
    await db.playerGameStats.upsert({
      where: { userId: user.id },
      update: {
        totalGames: { increment: 1 },
        wins: { increment: outcome.result === 'win' ? 1 : 0 },
        losses: { increment: outcome.result === 'loss' ? 1 : 0 },
        highestScore: Math.max(scoreMetric, prevStats?.highestScore ?? 0),
        bestDistance: Math.max(distanceMetric, prevStats?.bestDistance ?? 0),
        totalRewards: { increment: coins },
        playTimeSec: { increment: durationSec },
      },
      create: {
        userId: user.id, totalGames: 1, wins: outcome.result === 'win' ? 1 : 0,
        losses: outcome.result === 'loss' ? 1 : 0, highestScore: scoreMetric,
        bestDistance: distanceMetric, totalRewards: coins, playTimeSec: durationSec,
      },
    })

    if (coins > 0) await bumpDailyStat({ coinsGenerated: coins })
    await bumpMission(user.id, 'play_minigame', 1)

    if (outcome.result === 'win') {
      await notify(user.id, '🏆 Arcade Victory!', `${MINI_GAME_DEFS[session.gameKey as keyof typeof MINI_GAME_DEFS].name}: +${coins} coins, +${xp} XP${championBuff ? ' · 🏅 Champion buff active (+10% production 12h)' : ''}`)
    }

    const itemNames = mysteryItems.map(k => `${ITEM_TYPES[k]?.emoji ?? '📦'} ${ITEM_TYPES[k]?.name ?? k}`)

    return json({
      ok: true,
      result: outcome.result,
      coins, eggs, gems, xp,
      duration: durationSec,
      lines: outcome.lines,
      mysteryItems: itemNames,
      championBuff,
      message: outcome.result === 'win'
        ? `🏆 Victory! +${coins} coins · +${xp} XP${championBuff ? ' · 🏅 Champion buff (+10% production 12h)!' : ''}`
        : `Run over — you still earned 🪙 ${coins} · +${xp} XP`,
    })
  }

  return err('Unknown action')
}
