import { db } from '@/lib/db'
import { getUserFromRequest, json, err } from '@/lib/auth'
import {
  clanLevelOf, CLAN_MAX_MEMBERS, CLAN_LEVEL_XP, CLAN_WEEKLY_REWARD,
  numericLevel, GIFT_AMOUNT,
} from '@/lib/game'

// GET /api/social                → friends + clan + clan leaderboard
// GET /api/social?visit=<userId> → visit a friend's farm snapshot

interface ClanView {
  id: string; name: string; tag: string; emblem: string; description: string
  level: number; xp: number; nextLevelXp: number | null; treasury: number
  memberCap: number; weeklyReward: number
  myRole: string; myContribution: number; lastClaimAt: string | null
  members: { userId: string; username: string; farmName: string; avatar: string; role: string; contribution: number; joinedAt: string }[]
}
export async function GET(req: Request) {
  const user = await getUserFromRequest(req)
  if (!user) return err('Unauthorized', 401)

  const url = new URL(req.url)
  const visitId = url.searchParams.get('visit')

  // ── farm visit snapshot ──
  if (visitId) {
    const target = await db.user.findUnique({
      where: { id: visitId },
      include: {
        farm: true,
        hens: { where: { status: 'active' }, select: { type: true, bornAt: true, traits: true } },
        animals: { select: { type: true } },
        clanMember: { include: { clan: true } },
      },
    })
    if (!target) return err('Farmer not found', 404)

    const isFriend = await db.friend.findFirst({
      where: {
        status: 'accepted',
        OR: [
          { userId: user.id, friendId: visitId },
          { userId: visitId, friendId: user.id },
        ],
      },
    })
    // privacy: only friends (or self) can visit full details
    if (!isFriend && visitId !== user.id) {
      return json({
        restricted: true,
        user: { id: target.id, farmName: target.farmName, avatar: target.avatar, username: target.username, levelName: numericLevel(target.xp) },
      })
    }

    const hensByType: Record<string, number> = {}
    for (const h of target.hens) hensByType[h.type] = (hensByType[h.type] ?? 0) + 1
    const animalsByType: Record<string, number> = {}
    for (const a of target.animals) animalsByType[a.type] = (animalsByType[a.type] ?? 0) + 1

    return json({
      restricted: false,
      user: {
        id: target.id, username: target.username, farmName: target.farmName, avatar: target.avatar,
        levelName: numericLevel(target.xp), xp: target.xp, coins: target.coins, gems: target.gems,
        vipUntil: target.vipUntil?.toISOString() ?? null,
        lastSeenAt: target.lastSeenAt.toISOString(), createdAt: target.createdAt.toISOString(),
      },
      farm: {
        coopLevel: target.farm?.coopLevel ?? 1,
        landLevel: target.farm?.landLevel ?? 1,
        storageLevel: target.farm?.storageLevel ?? 1,
        shelterLevel: target.farm?.shelterLevel ?? 0,
        health: target.farm?.lastFedAt ? 'Fed' : 'Hungry',
      },
      hensByType, animalsByType,
      totalHens: target.hens.length, totalAnimals: target.animals.length,
      clan: target.clanMember ? { name: target.clanMember.clan.name, tag: target.clanMember.clan.tag, emblem: target.clanMember.clan.emblem } : null,
    })
  }

  // ── friends list ──
  const friendRows = await db.friend.findMany({
    where: { OR: [{ userId: user.id }, { friendId: user.id }] },
    orderBy: { createdAt: 'desc' },
  })

  const friendUserIds = friendRows.flatMap(r => (r.userId === user.id ? [r.friendId] : [r.userId]))
  const friendUsers = friendUserIds.length
    ? await db.user.findMany({
        where: { id: { in: friendUserIds } },
        select: { id: true, username: true, farmName: true, avatar: true, xp: true, lastSeenAt: true, vipUntil: true },
      })
    : []

  const uMap = new Map(friendUsers.map(u => [u.id, u]))
  const today = new Date().toISOString().slice(0, 10)

  const friends = friendRows
    .filter(r => r.status === 'accepted')
    .map(r => {
      const otherId = r.userId === user.id ? r.friendId : r.userId
      const u = uMap.get(otherId)
      if (!u) return null
      const canGift = r.userId === user.id
        ? !r.lastGiftAt || r.lastGiftAt.toISOString().slice(0, 10) !== today
        : true
      return {
        userId: u.id, username: u.username, farmName: u.farmName, avatar: u.avatar,
        level: numericLevel(u.xp), vip: !!(u.vipUntil && u.vipUntil > new Date()),
        online: (Date.now() - u.lastSeenAt.getTime()) / 60000 < 15,
        canGift, direction: r.userId === user.id ? 'out' : 'in', rowId: r.id,
      }
    })
    .filter(Boolean)

  const requests = friendRows
    .filter(r => r.status === 'pending' && r.friendId === user.id)
    .map(r => {
      const u = uMap.get(r.userId)
      return u ? { rowId: r.id, userId: u.id, username: u.username, farmName: u.farmName, avatar: u.avatar } : null
    })
    .filter(Boolean)

  const sentPending = friendRows
    .filter(r => r.status === 'pending' && r.userId === user.id)
    .map(r => {
      const u = uMap.get(r.friendId)
      return u ? { rowId: r.id, username: u.username, farmName: u.farmName } : null
    })
    .filter(Boolean)

  // ── my clan ──
  const myMember = await db.clanMember.findUnique({
    where: { userId: user.id },
    include: {
      clan: { include: { members: { orderBy: { contribution: 'desc' }, take: 60 } } },
    },
  })

  let clan: ClanView | null = null
  if (myMember) {
    const level = clanLevelOf(myMember.clan.xp)
    const memberIds = myMember.clan.members.map(m => m.userId)
    const memberUsers = await db.user.findMany({
      where: { id: { in: memberIds } },
      select: { id: true, username: true, farmName: true, avatar: true },
    })
    const muMap = new Map(memberUsers.map(u => [u.id, u]))
    clan = {
      id: myMember.clan.id, name: myMember.clan.name, tag: myMember.clan.tag,
      emblem: myMember.clan.emblem, description: myMember.clan.description,
      level, xp: myMember.clan.xp, nextLevelXp: CLAN_LEVEL_XP[level] ?? null,
      treasury: myMember.clan.treasury,
      memberCap: CLAN_MAX_MEMBERS[Math.min(level, CLAN_MAX_MEMBERS.length) - 1] ?? 20,
      weeklyReward: CLAN_WEEKLY_REWARD[Math.min(level, CLAN_WEEKLY_REWARD.length) - 1] ?? 200,
      myRole: myMember.role, myContribution: myMember.contribution,
      lastClaimAt: myMember.lastClaimAt?.toISOString() ?? null,
      members: myMember.clan.members.map(m => ({
        userId: m.userId, username: muMap.get(m.userId)?.username ?? '?',
        farmName: muMap.get(m.userId)?.farmName ?? '?',
        avatar: muMap.get(m.userId)?.avatar ?? '🧑‍🌾',
        role: m.role, contribution: m.contribution,
        joinedAt: m.joinedAt.toISOString(),
      })),
    }
  }

  // ── clan leaderboard (top 15) ──
  const clans = await db.clan.findMany({
    orderBy: { xp: 'desc' },
    take: 15,
    include: { members: { select: { id: true } } },
  })
  const clanList = clans.map((c, i) => ({
    id: c.id, rank: i + 1, name: c.name, tag: c.tag, emblem: c.emblem,
    level: clanLevelOf(c.xp), xp: c.xp, treasury: c.treasury,
    memberCount: c.members.length,
    leaderName: c.leaderName,
  }))

  return json({
    friends, requests, sentPending,
    giftAmount: GIFT_AMOUNT,
    clan,
    clanList,
  })
}
