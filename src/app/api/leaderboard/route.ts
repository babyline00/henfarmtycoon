import { db } from '@/lib/db'
import { getUserFromRequest, json, err } from '@/lib/auth'
import { levelInfo } from '@/lib/game'

export async function GET(req: Request) {
  const user = await getUserFromRequest(req)
  if (!user) return err('Unauthorized', 401)

  const users = await db.user.findMany({
    where: { isBlocked: false },
    select: {
      id: true, username: true, farmName: true, avatar: true,
      coins: true, gems: true, xp: true, createdAt: true,
      farm: { select: { totalEarned: true, totalEggsHatch: true } },
      hens: { select: { type: true, bornAt: true, status: true } },
      animals: { select: { type: true } },
      eggs: { select: { type: true, status: true } },
    },
  })

  // farm value = coins + assets (same formula as economy.farmValueOf, simplified)
  const henPrices: Record<string, number> = { normal: 200, golden: 800, royal: 2500, magic: 8000 }
  const animalPrices: Record<string, number> = { cow: 1500, sheep: 1200, duck: 600, dog: 800, cat: 800, horse: 2000 }
  const eggValues: Record<string, number> = { normal: 10, golden: 12, royal: 15, magic: 20, diamond: 100, mystery: 50 }

  const rows = users.map(u => {
    let value = u.coins
    for (const h of u.hens) value += Math.round((henPrices[h.type] ?? 0) * (h.status === 'active' ? 0.8 : 0.2))
    for (const a of u.animals) value += animalPrices[a.type] ?? 0
    for (const e of u.eggs) {
      if (e.status !== 'opened') value += eggValues[e.type] ?? 0
    }
    const totalHens = u.hens.length
    const totalEggs = u.farm?.totalEggsHatch ?? 0
    const totalEarned = (u.farm?.totalEarned ?? 0) + u.coins
    return {
      id: u.id,
      username: u.username,
      farmName: u.farmName,
      avatar: u.avatar,
      levelName: levelInfo(u.xp).name,
      xp: u.xp,
      farmValue: value,
      totalHens,
      totalEggs,
      totalEarned,
    }
  })

  const byValue = [...rows].sort((a, b) => b.farmValue - a.farmValue).slice(0, 15)
  const byEggs = [...rows].sort((a, b) => b.totalEggs - a.totalEggs).slice(0, 15)
  const byEarned = [...rows].sort((a, b) => b.totalEarned - a.totalEarned).slice(0, 15)

  return json({ byValue, byEggs, byEarned, myId: user.id })
}
