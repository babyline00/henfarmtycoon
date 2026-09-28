// Seed script for Hen Farming Game
// Run: bun run scripts/seed.ts
import { PrismaClient } from '@prisma/client'
import { createHash } from 'crypto'

const db = new PrismaClient()

function hash(password: string): string {
  return createHash('sha256').update(`henfarm::${password}`).digest('hex')
}

async function main() {
  console.log('🌱 Seeding Hen Farming Game...')

  // ── config ──
  const configDefaults: Record<string, string> = {
    startingBalance: '1000',
    startingGems: '5',
    globalProduction: '100',
    marketFeePct: '5',
    withdrawalMin: '5000',
    dailyRewardBase: '50',
    gemToCoins: '100',
    maintenanceMode: '0',
    referralBonus: '200',
    withdrawalsDisabled: '0',
    marketplaceDisabled: '0',
    arcadeRewardsEnabled: '1',
  }
  for (const [key, value] of Object.entries(configDefaults)) {
    await db.gameConfig.upsert({ where: { key }, update: { value }, create: { key, value } })
  }

  // ── admin ──
  // adminRole is set explicitly: can() fails closed on a null role, so a
  // super admin must be labelled or they lose every permission.
  const admin = await db.user.upsert({
    where: { username: 'admin' },
    update: { isAdmin: true, adminRole: 'super' },
    create: {
      username: 'admin',
      email: 'admin@henfarm.io',
      password: hash('admin123'),
      farmName: 'Sunrise HQ Farm',
      avatar: '🛡️',
      coins: 1_000_000,
      gems: 500,
      xp: 50000,
      isAdmin: true,
      adminRole: 'super',
      referralCode: 'ADMIN001',
      farm: { create: {} },
    },
  })

  // ── demo player ──
  const demo = await db.user.upsert({
    where: { username: 'demo' },
    update: {},
    create: {
      username: 'demo',
      email: 'demo@henfarm.io',
      password: hash('demo123'),
      farmName: 'Sunny Meadows',
      avatar: '🧑‍🌾',
      coins: 1500,
      gems: 8,
      xp: 120,
      referralCode: 'DEMO2026',
      farm: { create: { lastFedAt: new Date() } },
    },
  })

  // demo assets
  const demoHenCount = await db.hen.count({ where: { userId: demo.id } })
  if (demoHenCount === 0) {
    await db.hen.createMany({
      data: [
        { userId: demo.id, type: 'normal', name: 'Clucky', bornAt: new Date(Date.now() - 5 * 86400000), lastCollectedAt: new Date(Date.now() - 3 * 3600000) },
        { userId: demo.id, type: 'normal', name: 'Pip', bornAt: new Date(Date.now() - 4 * 86400000), lastCollectedAt: new Date(Date.now() - 5 * 3600000) },
        { userId: demo.id, type: 'normal', name: 'Nugget', bornAt: new Date(Date.now() - 3 * 86400000), lastCollectedAt: new Date(Date.now() - 2 * 3600000) },
        { userId: demo.id, type: 'golden', name: 'Ginger', bornAt: new Date(Date.now() - 2 * 86400000), lastCollectedAt: new Date(Date.now() - 4 * 3600000) },
      ],
    })
    await db.animal.create({ data: { userId: demo.id, type: 'dog', name: 'Rex', bornAt: new Date(Date.now() - 10 * 86400000) } })
    await db.animal.create({ data: { userId: demo.id, type: 'duck', name: 'Quackers', bornAt: new Date(Date.now() - 8 * 86400000), lastCollectedAt: new Date(Date.now() - 6 * 3600000) } })
    await db.egg.createMany({
      data: [
        { userId: demo.id, type: 'normal' },
        { userId: demo.id, type: 'normal' },
        { userId: demo.id, type: 'normal' },
        { userId: demo.id, type: 'normal' },
        { userId: demo.id, type: 'normal' },
        { userId: demo.id, type: 'normal' },
        { userId: demo.id, type: 'mystery' },
      ],
    })
    await db.transaction.createMany({
      data: [
        { userId: demo.id, type: 'admin', amount: 1000, currency: 'coins', description: 'Welcome bonus' },
        { userId: demo.id, type: 'buy', amount: -600, currency: 'coins', description: 'Bought 3 Normal Hens' },
        { userId: demo.id, type: 'buy', amount: -800, currency: 'coins', description: 'Bought Golden Hen' },
      ],
    })
  }

  // ── NPC users for leaderboard ──
  const npcs = [
    { username: 'farmer_ali', farmName: 'Ali Agro Valley', coins: 48200, gems: 120, xp: 12500, avatar: '👨‍🌾' },
    { username: 'eggqueen', farmName: 'Royal Egg Kingdom', coins: 39500, gems: 96, xp: 9800, avatar: '👩‍🌾' },
    { username: 'agro_khan', farmName: 'Khan Green Acres', coins: 31000, gems: 74, xp: 8200, avatar: '🧔' },
    { username: 'henry_hen', farmName: "Henry's Paradise", coins: 25800, gems: 60, xp: 6400, avatar: '👨‍🍳' },
    { username: 'mama_hen', farmName: 'Mama Coop', coins: 21400, gems: 55, xp: 5100, avatar: '👵' },
    { username: 'greenfields', farmName: 'Green Fields Estate', coins: 18900, gems: 41, xp: 4300, avatar: '👩‍🔬' },
    { username: 'coopking', farmName: 'Coop Kingdom', coins: 14200, gems: 30, xp: 3200, avatar: '🤴' },
    { username: 'eggsplorer', farmName: 'Eggsplorer Base', coins: 9800, gems: 22, xp: 2100, avatar: '🧑‍🚀' },
  ]
  for (const n of npcs) {
    await db.user.upsert({
      where: { username: n.username },
      update: {},
      create: {
        username: n.username,
        password: hash(Math.random().toString(36)),
        farmName: n.farmName,
        avatar: n.avatar,
        coins: n.coins,
        gems: n.gems,
        xp: n.xp,
        referralCode: `${n.username.slice(0, 5).toUpperCase()}${Math.floor(1000 + Math.random() * 9000)}`,
        farm: { create: { coopLevel: 3, landLevel: 2, storageLevel: 2, lastFedAt: new Date() } },
      },
    })
  }

  // ── NPC market listings ──
  const listingCount = await db.marketListing.count({ where: { sellerId: 'npc' } })
  if (listingCount === 0) {
    await db.marketListing.createMany({
      data: [
        { sellerId: 'npc', sellerName: 'Farmer Ali', itemType: 'hen', subType: 'golden', title: 'Golden Hen ♦ Proven Layer', detail: 'Healthy, 12 days old, high output', price: 950, level: 3, ageDays: 12 },
        { sellerId: 'npc', sellerName: 'EggQueen', itemType: 'hen', subType: 'royal', title: 'Royal Hen – Rare Bloodline', detail: 'Elite breeder, 20 days old', price: 3200, level: 5, ageDays: 20 },
        { sellerId: 'npc', sellerName: 'Agro Khan', itemType: 'animal', subType: 'cow', title: 'Milk Cow 🐄 High Yield', detail: '150 coins/day passive', price: 1650, ageDays: 30 },
        { sellerId: 'npc', sellerName: 'Mama Hen', itemType: 'animal', subType: 'sheep', title: 'Wool Sheep 🐑 Fluffy', detail: '120 coins/day wool', price: 1300, ageDays: 25 },
        { sellerId: 'npc', sellerName: 'CoopKing', itemType: 'animal', subType: 'horse', title: 'Farm Horse 🐎 Fast XP', detail: '+25% XP for whole farm', price: 2400, ageDays: 40 },
        { sellerId: 'npc', sellerName: 'GreenFields', itemType: 'egg', subType: 'diamond', title: 'Diamond Egg 💎 6h Hatch', detail: 'Epic hatch odds', price: 1150 },
        { sellerId: 'npc', sellerName: 'Eggsplorer', itemType: 'egg', subType: 'mystery', title: 'Mystery Egg 🎁', detail: 'Random surprise inside', price: 280 },
        { sellerId: 'npc', sellerName: 'EggQueen', itemType: 'hen', subType: 'normal', title: 'Normal Hen x Budget Deal', detail: 'Great for new farmers', price: 170, ageDays: 5 },
      ],
    })
  }

  // ── active event ──
  const evCount = await db.gameEvent.count()
  if (evCount === 0) {
    await db.gameEvent.create({
      data: {
        name: 'Golden Egg Festival',
        description: 'Double production weekend! All farms earn 2x eggs and coins.',
        multiplier: 200,
        startsAt: new Date(Date.now() - 86400000),
        endsAt: new Date(Date.now() + 3 * 86400000),
        active: true,
      },
    })
  }

  // ── welcome notification for demo ──
  const notifCount = await db.notification.count({ where: { userId: demo.id } })
  if (notifCount === 0) {
    await db.notification.create({
      data: {
        userId: demo.id,
        title: 'Welcome to Hen Farm! 🐔',
        body: 'Collect eggs, hatch rare hens and grow your farm empire. Your first mission awaits!',
      },
    })
  }

  // ── demo clan + memberships (Phase 12) ──
  const clanCount = await db.clan.count()
  if (clanCount === 0) {
    const clan = await db.clan.create({
      data: {
        name: 'Golden Farmers', tag: 'GFC', emblem: '👑',
        description: 'The richest farming family on the plains. Weekly treasury rewards!',
        leaderId: admin.id, leaderName: 'Admin HQ',
        xp: 3400, treasury: 18500,
      },
    })
    await db.clanMember.create({
      data: { clanId: clan.id, userId: admin.id, role: 'chief', contribution: 8200 },
    })
    // NPC members for leaderboard feel
    const npcMembers = await db.user.findMany({
      where: { username: { in: ['FarmerAli', 'EggQueen', 'AgroKhan', 'MamaHen', 'CoopKing'] } },
      select: { id: true },
    })
    for (const m of npcMembers) {
      await db.clanMember.create({
        data: { clanId: clan.id, userId: m.id, role: 'member', contribution: Math.floor(500 + Math.random() * 4000) },
      }).catch(() => { /* already member */ })
    }
    await db.clan.create({
      data: {
        name: 'Free Range Union', tag: 'FRU', emblem: '🌾',
        description: 'Casual farmers helping each other grow.',
        leaderId: 'npc', leaderName: 'Village Council',
        xp: 900, treasury: 3200,
      },
    }).catch(() => { /* dup */ })
  }

  // ── Phase 33: mini games ──
  await db.miniGame.upsert({
    where: { key: 'chicken_run' },
    update: {},
    create: {
      key: 'chicken_run', name: 'Chicken Run', emoji: '🏃',
      description: 'Endless runner — swipe between 3 lanes, jump obstacles, grab eggs, coins & mystery boxes.',
      enabled: true, energyCost: 10,
      rewardConfig: JSON.stringify({ coinsPerMeter: 0.5, winTarget: 1000 }),
    },
  })
  await db.miniGame.upsert({
    where: { key: 'road_crossing' },
    update: {},
    create: {
      key: 'road_crossing', name: 'Chicken Road Crossing', emoji: '🚦',
      description: 'Frogger-style crossing — dodge cars, trucks & tractors, grab power-ups and reach the farm side.',
      enabled: true, energyCost: 15,
      rewardConfig: JSON.stringify({ coinsPerRow: 40, winTarget: 12 }),
    },
  })

  // ── market trade history for price stats (Phase 13) ──
  const tradeCount = await db.marketTrade.count()
  if (tradeCount === 0) {
    await db.marketTrade.createMany({
      data: [
        { listingId: 'seed', itemType: 'hen', subType: 'golden', title: 'Golden Hen', price: 900, sellerId: 'npc', sellerName: 'Farmer Ali', buyerId: 'seed', buyerName: 'Trader Bot' },
        { listingId: 'seed', itemType: 'hen', subType: 'golden', title: 'Golden Hen', price: 860, sellerId: 'npc', sellerName: 'EggQueen', buyerId: 'seed', buyerName: 'Trader Bot' },
        { listingId: 'seed', itemType: 'hen', subType: 'golden', title: 'Golden Hen', price: 940, sellerId: 'npc', sellerName: 'Agro Khan', buyerId: 'seed', buyerName: 'Trader Bot' },
        { listingId: 'seed', itemType: 'egg', subType: 'diamond', title: 'Diamond Egg', price: 1100, sellerId: 'npc', sellerName: 'GreenFields', buyerId: 'seed', buyerName: 'Trader Bot' },
        { listingId: 'seed', itemType: 'egg', subType: 'diamond', title: 'Diamond Egg', price: 1050, sellerId: 'npc', sellerName: 'Eggsplorer', buyerId: 'seed', buyerName: 'Trader Bot' },
        { listingId: 'seed', itemType: 'animal', subType: 'cow', title: 'Milk Cow', price: 1600, sellerId: 'npc', sellerName: 'Mama Hen', buyerId: 'seed', buyerName: 'Trader Bot' },
        { listingId: 'seed', itemType: 'animal', subType: 'cow', title: 'Milk Cow', price: 1550, sellerId: 'npc', sellerName: 'CoopKing', buyerId: 'seed', buyerName: 'Trader Bot' },
        { listingId: 'seed', itemType: 'hen', subType: 'normal', title: 'Normal Hen', price: 180, sellerId: 'npc', sellerName: 'Farmer Ali', buyerId: 'seed', buyerName: 'Trader Bot' },
      ],
    })
  }

  // ── Phase 34: wallet — payment methods + demo deposit history ──
  const depCount = await db.deposit.count()
  if (depCount === 0) {
    const tinyProof =
      'data:image/gif;base64,R0lGODlhAQABAIAAAPwAANf///yH5BAAAAAAALAAAAAABAAEAAAICRAEAOw==' // 1px placeholder
    await db.deposit.createMany({
      data: [
        {
          userId: demo.id, username: demo.username,
          amountCents: 1000, method: 'jazzcash', senderName: 'Demo Farmer',
          reference: 'JC-88372619283', proof: tinyProof,
          coins: 10000, bonusCoins: 1000, status: 'approved',
          processedAt: new Date(), processedBy: 'admin',
        },
        {
          userId: demo.id, username: demo.username,
          amountCents: 500, method: 'bank', senderName: 'Demo Farmer',
          reference: 'BN-55120447712', proof: tinyProof,
          coins: 5000, bonusCoins: 250, status: 'pending',
        },
      ],
    })
    await db.notification.create({
      data: {
        userId: demo.id, title: '✅ Deposit approved',
        body: 'Your deposit of $10.00 via JAZZCASH was verified. 🪙 11,000 coins have been added to your wallet!',
      },
    }).catch(() => { /* dup ok */ })
  }

  console.log('✅ Seed complete.')
  console.log('   Admin login → username: admin / password: admin123')
  console.log('   Demo login  → username: demo / password: demo123')
  console.log(`   Admin id: ${admin.id}, Demo id: ${demo.id}`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => db.$disconnect())
