import { db } from '@/lib/db'
import { requireAdmin, err, json } from '@/lib/auth'
import { can, roleLabel, PERM } from '@/lib/security'
import { todayKey } from '@/lib/game'

// Phase 18 — Analytics System
// Player analytics: DAU series, retention, sessions
// Economy analytics: coins generated/spent, market volume, inflation signal
// Revenue: purchases + VIP
export async function GET(req: Request) {
  const admin = await requireAdmin(req)
  if (!admin) return err('Admin access required', 403)
  if (!can(admin.adminRole, PERM.ANALYTICS)) return err(`Your role (${roleLabel(admin.adminRole)}) cannot view analytics`, 403)

  const now = new Date()
  const days: string[] = []
  for (let i = 13; i >= 0; i--) {
    days.push(new Date(now.getTime() - i * 86400000).toISOString().slice(0, 10))
  }

  const [stats, newUsers30, purchases, sessions] = await Promise.all([
    db.dailyStat.findMany({ where: { date: { in: days } } }),
    db.user.findMany({
      where: { createdAt: { gte: new Date(now.getTime() - 30 * 86400000) }, isAdmin: false },
      select: { createdAt: true, lastSeenAt: true },
    }),
    db.purchase.findMany({
      where: { createdAt: { gte: new Date(now.getTime() - 14 * 86400000) } },
      orderBy: { createdAt: 'desc' },
      take: 500,
    }),
    db.session.findMany({
      where: { createdAt: { gte: new Date(now.getTime() - 7 * 86400000) } },
      select: { userId: true, createdAt: true },
    }),
  ])

  const statMap = new Map(stats.map(s => [s.date, s]))

  // 14-day series
  const dauSeries = days.map(d => ({
    date: d.slice(5),
    dau: statMap.get(d)?.dau ?? 0,
    newUsers: statMap.get(d)?.newUsers ?? 0,
  }))
  const economySeries = days.map(d => ({
    date: d.slice(5),
    generated: statMap.get(d)?.coinsGenerated ?? 0,
    spent: statMap.get(d)?.coinsSpent ?? 0,
    marketVolume: statMap.get(d)?.marketVolume ?? 0,
  }))
  const revenueSeries = days.map(d => ({
    date: d.slice(5),
    revenueCents: statMap.get(d)?.revenueCents ?? 0,
  }))
  const eggSeries = days.map(d => ({
    date: d.slice(5),
    laid: statMap.get(d)?.eggsLaid ?? 0,
    hatched: statMap.get(d)?.eggsHatched ?? 0,
  }))

  // retention: of users who joined N days ago, how many were seen recently
  const joined7 = newUsers30.filter(u => u.createdAt >= new Date(now.getTime() - 7 * 86400000))
  const returnedAfterJoin = joined7.filter(u => u.lastSeenAt > new Date(u.createdAt.getTime() + 86400000)).length
  const d1Retention = joined7.length ? Math.round((returnedAfterJoin / joined7.length) * 100) : 0

  const joined30 = newUsers30
  const activeAfter3d = joined30.filter(u => u.lastSeenAt > new Date(u.createdAt.getTime() + 3 * 86400000)).length
  const d3Retention = joined30.length ? Math.round((activeAfter3d / joined30.length) * 100) : 0

  // session frequency (sessions per active user, last 7 days)
  const totalSessions = sessions.length
  const uniqueSessionUsers = new Set(sessions.map(s => s.userId)).size
  const sessionsPerUser = uniqueSessionUsers ? +(totalSessions / uniqueSessionUsers).toFixed(1) : 0

  // spenders
  const spendMap = new Map<string, { username: string; cents: number; count: number }>()
  for (const p of purchases) {
    const cur = spendMap.get(p.userId) ?? { username: p.username, cents: 0, count: 0 }
    cur.cents += p.amountCents
    cur.count += 1
    spendMap.set(p.userId, cur)
  }
  const topSpenders = [...spendMap.entries()]
    .map(([userId, v]) => ({ userId, ...v }))
    .sort((a, b) => b.cents - a.cents)
    .slice(0, 8)

  // purchase breakdown by SKU
  const skuMap = new Map<string, { count: number; cents: number }>()
  for (const p of purchases) {
    const k = `${p.kind}:${p.sku}`
    const cur = skuMap.get(k) ?? { count: 0, cents: 0 }
    cur.count += 1
    cur.cents += p.amountCents
    skuMap.set(k, cur)
  }
  const revenueBySku = [...skuMap.entries()].map(([sku, v]) => ({ sku, ...v })).sort((a, b) => b.cents - a.cents)

  // inflation signal: coins generated vs spent (last 14d)
  const totalGen = economySeries.reduce((s, d) => s + d.generated, 0)
  const totalSpent = economySeries.reduce((s, d) => s + d.spent, 0)
  const netSlope = totalGen - totalSpent

  // VIP count
  const vipCount = await db.user.count({ where: { vipUntil: { gt: now } } })

  const todayStat = statMap.get(todayKey())

  return json({
    dauSeries,
    economySeries,
    revenueSeries,
    eggSeries,
    retention: { d1: d1Retention, d3: d3Retention, sessionsPerUser, totalSessions7d: totalSessions },
    topSpenders,
    revenueBySku,
    economyHealth: {
      totalGenerated14d: totalGen,
      totalSpent14d: totalSpent,
      netCoinFlow: netSlope,
      signal: netSlope > totalGen * 0.4 ? 'inflation-warning' : netSlope < 0 ? 'deflation' : 'balanced',
    },
    vipCount,
    todayRevenueCents: todayStat?.revenueCents ?? 0,
  })
}
