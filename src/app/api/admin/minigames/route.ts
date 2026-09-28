import { db } from '@/lib/db'
import { requireAdmin, json, err } from '@/lib/auth'
import { can, roleLabel, PERM } from '@/lib/security'
import { adjustBalance, addXp } from '@/lib/economy'
import { GAME_TIERS, SEASON_REWARDS, RUN_OBSTACLES, CROSS_VEHICLES, POWER_UPS } from '@/lib/mini-games'

async function logAdmin(adminId: string, adminName: string, action: string, detail: string) {
  await db.adminLog.create({ data: { adminId, adminName, action, detail } })
}

// ══════════ Phase 33 — Admin Mini Games Control Center ══════════

function startOfDayUtc(d = new Date()): Date {
  return new Date(d.toISOString().slice(0, 10) + 'T00:00:00.000Z')
}

export async function GET(req: Request) {
  const admin = await requireAdmin(req)
  if (!admin) return err('Admin access required', 403)
  if (!can(admin.adminRole, PERM.ANALYTICS)) return err(`Your role (${roleLabel(admin.adminRole)}) cannot view game analytics`, 403)

  const dayAgo = new Date(Date.now() - 86400000)

  const [games, totals, today, perGame, cheated, recent, topScores, analytics] = await Promise.all([
    db.miniGame.findMany({ orderBy: { createdAt: 'asc' } }),
    db.gameSession.aggregate({
      where: { result: { in: ['win', 'loss'] } },
      _count: true, _sum: { coins: true, xp: true, distance: true },
    }),
    db.gameSession.count({ where: { result: { in: ['win', 'loss'] }, createdAt: { gte: dayAgo } } }),
    db.gameSession.groupBy({
      by: ['gameKey', 'result'],
      _count: true,
      where: { result: { in: ['win', 'loss', 'rejected'] } },
    }),
    db.gameSession.findMany({
      where: { cheated: true },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: { user: { select: { username: true, farmName: true, flagged: true } } },
    }),
    db.gameSession.findMany({
      orderBy: { createdAt: 'desc' },
      take: 15,
      include: { user: { select: { username: true, avatar: true } } },
    }),
    // monthly season standings (for payout)
    db.gameSession.groupBy({
      by: ['userId'],
      where: {
        result: { in: ['win', 'loss'] },
        createdAt: { gte: startOfDayUtc(new Date(new Date().getFullYear(), new Date().getMonth(), 1)) },
      },
      _sum: { score: true },
      orderBy: { _sum: { score: 'desc' } },
      take: 3,
    }),
    // Per-game health. The panel showed flat lifetime counters, which
    // answer "how many plays" but never "is this game any good" — you
    // need win rate, how far a typical run gets, and what it pays.
    db.gameSession.groupBy({
      by: ['gameKey'],
      where: { result: { in: ['win', 'loss'] }, duration: { gte: 1 } },
      _count: true,
      _sum: { duration: true, score: true, coins: true, xp: true },
      _avg: { duration: true, score: true, coins: true, xp: true },
    }),
  ])

  // Distinct players per game. Plays per player separates "lots of people
  // tried it once" from "a few people play it constantly", which is the
  // difference between a game with reach and a game with a devoted core.
  const uniquePlayers = await db.gameSession.groupBy({
    by: ['gameKey'],
    where: { result: { in: ['win', 'loss'] } },
    _count: { userId: true },
  })
  const playersByGame = new Map(uniquePlayers.map(r => [r.gameKey, r._count.userId]))

  const seasonUserIds = topScores.map(r => r.userId)
  const seasonUsers = await db.user.findMany({
    where: { id: { in: seasonUserIds } },
    select: { id: true, username: true, avatar: true, farmName: true },
  })

  const playsByGame: Record<string, { plays: number; wins: number; losses: number; rejected: number }> = {}
  for (const row of perGame) {
    const e = playsByGame[row.gameKey] ?? { plays: 0, wins: 0, losses: 0, rejected: 0 }
    if (row.result === 'win') e.wins += row._count
    else if (row.result === 'loss') e.losses += row._count
    else if (row.result === 'rejected') e.rejected += row._count
    if (row.result !== 'rejected') e.plays += row._count
    playsByGame[row.gameKey] = e
  }

  // has the current month been paid out already?
  const seasonKey = `${new Date().getFullYear()}-${new Date().getMonth() + 1}`
  const paidConfig = await db.gameConfig.findUnique({ where: { key: `seasonPaid:${seasonKey}` } })

  return json({
    games: games.map(g => ({
      id: g.id, key: g.key, name: g.name, emoji: g.emoji,
      description: g.description, enabled: g.enabled, energyCost: g.energyCost,
      plays: playsByGame[g.key]?.plays ?? 0,
      wins: playsByGame[g.key]?.wins ?? 0,
      losses: playsByGame[g.key]?.losses ?? 0,
      rejected: playsByGame[g.key]?.rejected ?? 0,
    })),
    totals: {
      totalPlays: totals._count, coinsAwarded: totals._sum.coins ?? 0,
      xpAwarded: totals._sum.xp ?? 0, metersRan: totals._sum.distance ?? 0,
      playsToday: today,
      cheatedCount: cheated.length,
    },
    // Per-game analytics, in the panel's units: score means metres for the
    // runner, rows for the crossing, eggs for the catcher.
    analytics: analytics.map(a => {
      const plays = a._count
      const wins = playsByGame[a.gameKey]?.wins ?? 0
      const players = playersByGame.get(a.gameKey) ?? 0
      return {
        gameKey: a.gameKey,
        plays,
        wins,
        losses: Math.max(0, plays - wins),
        winRate: plays > 0 ? Math.round((wins / plays) * 100) : 0,
        uniquePlayers: players,
        playsPerPlayer: players > 0 ? Math.round((plays / players) * 10) / 10 : 0,
        avgDurationSec: Math.round(a._avg.duration ?? 0),
        avgScore: Math.round(a._avg.score ?? 0),
        avgCoins: Math.round(a._avg.coins ?? 0),
        avgXp: Math.round(a._avg.xp ?? 0),
        // coins per minute of play: the honest measure of whether a game
        // is worth its energy cost
        coinsPerMinute: (a._avg.duration ?? 0) > 0
          ? Math.round(((a._avg.coins ?? 0) / (a._avg.duration ?? 1)) * 60)
          : 0,
      }
    }),
    cheated: cheated.map(s => ({
      id: s.id, gameKey: s.gameKey, createdAt: s.createdAt,
      username: s.user.username, farmName: s.user.farmName, flagged: s.user.flagged,
    })),
    recent: recent.map(s => ({
      id: s.id, gameKey: s.gameKey, username: s.user.username, avatar: s.user.avatar,
      score: s.score, distance: s.distance, coins: s.coins, result: s.result,
      cheated: s.cheated, createdAt: s.createdAt,
    })),
    season: {
      rewards: SEASON_REWARDS,
      monthKey: seasonKey,
      paid: !!paidConfig,
      top3: topScores.map((r, i) => {
        const u = seasonUsers.find(x => x.id === r.userId)
        return {
          rank: i + 1, userId: r.userId, username: u?.username ?? '?', avatar: u?.avatar ?? '🧑‍🌾',
          totalScore: r._sum.score ?? 0, reward: SEASON_REWARDS[i]?.prize ?? '—',
        }
      }),
    },
    reference: {
      tiers: GAME_TIERS,
      obstacles: RUN_OBSTACLES,
      vehicles: CROSS_VEHICLES,
      powerUps: POWER_UPS,
    },
  })
}

export async function POST(req: Request) {
  const admin = await requireAdmin(req)
  if (!admin) return err('Admin access required', 403)
  const body = await req.json().catch(() => null)
  const action = body?.action

  // permission: config-area for game tuning, users-area for payouts
  const needsConfig = action === 'toggle_game' || action === 'set_energy_cost'
  const needsUsers = action === 'season_payout'
  if (needsConfig && !can(admin.adminRole, PERM.CONFIG_GAME)) return err(`Your role (${roleLabel(admin.adminRole)}) cannot tune games`, 403)
  if (needsUsers && !can(admin.adminRole, PERM.PURCHASES)) return err(`Your role (${roleLabel(admin.adminRole)}) cannot pay season rewards`, 403)

  // ── enable / disable an arcade machine ──
  if (action === 'toggle_game') {
    const id = String(body.gameId ?? '')
    const game = await db.miniGame.findUnique({ where: { id } })
    if (!game) return err('Game not found')
    const updated = await db.miniGame.update({ where: { id }, data: { enabled: !game.enabled } })
    await logAdmin(admin.id, admin.username, 'toggle_game', `${updated.name} → ${updated.enabled ? 'ENABLED' : 'DISABLED'}`)
    return json({ ok: true, message: `${updated.emoji} ${updated.name} ${updated.enabled ? 'enabled' : 'disabled'}` })
  }

  // ── adjust entry energy cost ──
  if (action === 'set_energy_cost') {
    const id = String(body.gameId ?? '')
    const cost = Math.max(1, Math.min(50, Math.floor(Number(body.energyCost) || 10)))
    const game = await db.miniGame.update({ where: { id }, data: { energyCost: cost } })
    await logAdmin(admin.id, admin.username, 'set_energy_cost', `${game.name} energy cost → ${cost}`)
    return json({ ok: true, message: `${game.emoji} ${game.name} now costs ⚡${cost}` })
  }

  // ── monthly season payout (top 3) ──
  if (action === 'season_payout') {
    const monthStart = startOfDayUtc(new Date(new Date().getFullYear(), new Date().getMonth(), 1))
    const seasonKey = `${new Date().getFullYear()}-${new Date().getMonth() + 1}`
    const paid = await db.gameConfig.findUnique({ where: { key: `seasonPaid:${seasonKey}` } })
    if (paid) return err(`Season ${seasonKey} rewards were already paid out`)

    const top3 = await db.gameSession.groupBy({
      by: ['userId'],
      where: { result: { in: ['win', 'loss'] }, createdAt: { gte: monthStart } },
      _sum: { score: true },
      orderBy: { _sum: { score: 'desc' } },
      take: 3,
    })
    if (!top3.length) return err('No arcade sessions this month yet')

    const results: string[] = []
    for (let i = 0; i < top3.length; i++) {
      const row = top3[i]
      const winner = await db.user.findUnique({ where: { id: row.userId } })
      if (!winner) continue
      if (i === 0) {
        // 1st: Legendary Dragon Hen (magic tier)
        await db.hen.create({
          data: { userId: winner.id, type: 'magic', name: '🐉 Dragon Champion', level: 5, traits: JSON.stringify(['legendary_blood']) },
        })
        await addXp(winner.id, 500)
        results.push(`🥇 ${winner.username} → Legendary Dragon Hen`)
      } else if (i === 1) {
        // 2nd: 3 Golden Eggs
        await db.egg.createMany({ data: Array.from({ length: 3 }, () => ({ userId: winner.id, type: 'golden' })) })
        results.push(`🥈 ${winner.username} → 3× Golden Egg`)
      } else {
        // 3rd: 5000 gems
        await adjustBalance(winner.id, 0, 5000, 'season_reward', 'Monthly arcade champion — 3rd place')
        results.push(`🥉 ${winner.username} → 5,000 💎`)
      }
      await db.notification.create({
        data: {
          userId: winner.id,
          title: `🏆 Arcade Season Champion — Rank #${i + 1}!`,
          body: results[i],
        },
      })
    }
    await db.gameConfig.upsert({ where: { key: `seasonPaid:${seasonKey}` }, update: { value: '1' }, create: { key: `seasonPaid:${seasonKey}`, value: '1' } })
    await logAdmin(admin.id, admin.username, 'season_payout', `Season ${seasonKey}: ${results.join(' · ')}`)
    return json({ ok: true, message: `Season rewards paid! ${results.join(' · ')}` })
  }

  return err('Unknown action')
}
