// Dev utility: reset arcade state for a player (energy refill + unflag)
// Usage: bun run scripts/reset-arcade.ts [username]
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()
// No default: there is no shared demo account any more, and silently
// editing whichever account happened to match would be a nasty surprise.
const username = process.argv[2]
if (!username) {
  console.error('usage: bun run scripts/reset-arcade.ts <username>')
  process.exit(1)
}

const user = await db.user.findUnique({ where: { username } })
if (!user) { console.error(`user ${username} not found`); process.exit(1) }

await db.user.update({
  where: { id: user.id },
  data: { gameEnergy: 100, energyUpdatedAt: new Date(), flagged: false, flagReason: null },
})

console.log(`♻️  ${username}: energy refilled to 100, flags cleared.`)
await db.$disconnect()
