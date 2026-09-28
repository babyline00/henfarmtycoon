// Dev utility: reset arcade state for a player (energy refill + unflag)
// Usage: bun run scripts/reset-arcade.ts [username]
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()
const username = process.argv[2] ?? 'demo'

const user = await db.user.findUnique({ where: { username } })
if (!user) { console.error(`user ${username} not found`); process.exit(1) }

await db.user.update({
  where: { id: user.id },
  data: { gameEnergy: 100, energyUpdatedAt: new Date(), flagged: false, flagReason: null },
})

console.log(`♻️  ${username}: energy refilled to 100, flags cleared.`)
await db.$disconnect()
