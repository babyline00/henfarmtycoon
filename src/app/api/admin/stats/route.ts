import { db } from '@/lib/db'
import { requireAdmin, err, json } from '@/lib/auth'
import { can, roleLabel, PERM } from '@/lib/security'

export async function GET(req: Request) {
  const admin = await requireAdmin(req)
  if (!admin) return err('Admin access required', 403)
  // This route was previously ungated and handed revenue, coins-in-
  // circulation and withdrawal totals to every admin including
  // Support, who are denied the payout queue itself.
  if (!can(admin.adminRole, PERM.STATS)) {
    return err(`Your role (${roleLabel(admin.adminRole)}) cannot view dashboard stats`, 403)
  }

  const now = new Date()
  const dayAgo = new Date(now.getTime() - 86400000)
  const weekAgo = new Date(now.getTime() - 7 * 86400000)

  const [
    totalUsers, activeToday, totalHens, totalAnimals, totalEggsHatched,
    totalEggsInInventory, pendingWithdrawals, totalWithdrawn,
    coinRows, depositToday, events, newUsers14,
  ] = await Promise.all([
    db.user.count({ where: { isAdmin: false } }),
    db.user.count({ where: { lastSeenAt: { gte: dayAgo }, isAdmin: false } }),
    db.hen.count(),
    db.animal.count(),
    db.egg.count({ where: { status: 'opened' } }),
    db.egg.count({ where: { status: { in: ['inventory', 'incubating', 'ready'] } } }),
    db.withdrawal.count({ where: { status: 'pending' } }),
    db.withdrawal.aggregate({ where: { status: 'approved' }, _sum: { amount: true } }),
    db.user.aggregate({ _sum: { coins: true, gems: true }, where: { isAdmin: false } }),
    db.user.count({ where: { createdAt: { gte: dayAgo }, isAdmin: false } }),
    db.gameEvent.findMany({ orderBy: { createdAt: 'desc' }, take: 5 }),
    db.user.findMany({
      where: { createdAt: { gte: new Date(now.getTime() - 14 * 86400000) }, isAdmin: false },
      select: { createdAt: true },
    }),
  ])

  const txCount = await db.transaction.count()
  const marketSales = await db.marketListing.count({ where: { status: 'sold' } })

  // Phase 15/18: revenue metrics
  const [revenueAgg, vipCount, purchaseCount, todayRevenue] = await Promise.all([
    db.purchase.aggregate({ _sum: { amountCents: true }, _count: true }),
    db.user.count({ where: { vipUntil: { gt: now } } }),
    db.purchase.count(),
    db.purchase.aggregate({
      _sum: { amountCents: true },
      where: { createdAt: { gte: new Date(now.toISOString().slice(0, 10) + 'T00:00:00.000Z') } },
    }),
  ])

  // Phase 34: wallet deposit metrics
  const [depAgg, pendingDeposits, depToday, wdFeeAgg] = await Promise.all([
    db.deposit.aggregate({ where: { status: 'approved' }, _sum: { amountCents: true }, _count: true }),
    db.deposit.count({ where: { status: 'pending' } }),
    db.deposit.aggregate({
      where: { status: 'approved', createdAt: { gte: new Date(now.toISOString().slice(0, 10) + 'T00:00:00.000Z') } },
      _sum: { amountCents: true },
    }),
    db.withdrawal.aggregate({ where: { status: 'approved' }, _sum: { fee: true } }),
  ])

  // user growth by day (last 14 days)
  const growth: { date: string; users: number }[] = []
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86400000)
    const key = d.toISOString().slice(0, 10)
    const count = newUsers14.filter(u => u.createdAt.toISOString().slice(0, 10) === key).length
    growth.push({ date: key.slice(5), users: count })
  }

  // coin circulation (sum of user balances is static; show top holders for chart)
  const topHolders = await db.user.findMany({
    where: { isAdmin: false },
    orderBy: { coins: 'desc' },
    take: 5,
    select: { username: true, coins: true },
  })

  // transactions by type (last 7 days)
  const recentTxs = await db.transaction.findMany({
    where: { createdAt: { gte: weekAgo } },
    select: { type: true, amount: true },
  })
  const txByType: Record<string, number> = {}
  for (const t of recentTxs) {
    txByType[t.type] = (txByType[t.type] ?? 0) + Math.abs(t.amount)
  }

  return json({
    stats: {
      totalUsers,
      activeToday,
      newToday: depositToday,
      totalHens,
      totalAnimals,
      totalEggsHatched,
      totalEggsInInventory,
      coinsInCirculation: coinRows._sum.coins ?? 0,
      gemsInCirculation: coinRows._sum.gems ?? 0,
      pendingWithdrawals,
      totalWithdrawn: totalWithdrawn._sum.amount ?? 0,
      totalTransactions: txCount,
      marketSales,
      revenueCents: (revenueAgg._sum.amountCents ?? 0) + (depAgg._sum.amountCents ?? 0),
      purchaseCount: purchaseCount + (depAgg._count ?? 0),
      vipCount,
      todayRevenueCents: (todayRevenue._sum.amountCents ?? 0) + (depToday._sum.amountCents ?? 0),
      // Phase 34 — wallet
      totalDepositCents: depAgg._sum.amountCents ?? 0,
      depositCount: depAgg._count ?? 0,
      pendingDeposits,
      wdFeesCollected: wdFeeAgg._sum.fee ?? 0,
      serverStatus: 'healthy',
    },
    growth,
    topHolders,
    txByType,
    events,
  })
}
