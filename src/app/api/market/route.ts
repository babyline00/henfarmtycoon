import { db } from '@/lib/db'
import { getUserFromRequest, json, err } from '@/lib/auth'
import { getConfig } from '@/lib/economy'

export async function GET(req: Request) {
  const user = await getUserFromRequest(req)
  if (!user) return err('Unauthorized', 401)

  const url = new URL(req.url)
  const filter = url.searchParams.get('filter') ?? 'all' // all | hens | animals | eggs

  const typeFilter = filter === 'hens' ? 'hen' : filter === 'animals' ? 'animal' : filter === 'eggs' ? 'egg' : undefined

  const [listings, myListings, cfg] = await Promise.all([
    db.marketListing.findMany({
      where: { status: 'active', ...(typeFilter ? { itemType: typeFilter } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
    db.marketListing.findMany({
      where: { sellerId: user.id, status: 'active' },
      orderBy: { createdAt: 'desc' },
    }),
    getConfig(),
  ])

  // Phase 13: recent trade feed + price history per item type
  const [recentTrades, tradeHistory] = await Promise.all([
    db.marketTrade.findMany({ orderBy: { createdAt: 'desc' }, take: 12 }),
    db.marketTrade.findMany({ orderBy: { createdAt: 'desc' }, take: 120 }),
  ])

  // aggregate avg price per itemType:subType
  const priceStats: Record<string, { avg: number; count: number; last: number }> = {}
  for (const t of tradeHistory) {
    const k = `${t.itemType}:${t.subType}`
    const cur = priceStats[k] ?? { avg: 0, count: 0, last: 0 }
    cur.avg = (cur.avg * cur.count + t.price) / (cur.count + 1)
    cur.count += 1
    if (!cur.last) cur.last = t.price
    priceStats[k] = cur
  }

  return json({
    listings,
    myListings,
    marketFeePct: cfg.marketFeePct,
    myCoins: user.coins,
    recentTrades: recentTrades.map(t => ({
      id: t.id, title: t.title, price: t.price, buyerName: t.buyerName, sellerName: t.sellerName,
      itemType: t.itemType, subType: t.subType, createdAt: t.createdAt,
    })),
    priceStats: Object.fromEntries(
      Object.entries(priceStats).map(([k, v]) => [k, { avg: Math.round(v.avg), count: v.count, last: v.last }])
    ),
  })
}
