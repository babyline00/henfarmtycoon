import { getUserFromRequest, json, err } from '@/lib/auth'
import { buildGameState, getConfig } from '@/lib/economy'

export async function GET(req: Request) {
  const user = await getUserFromRequest(req)
  if (!user) return err('Unauthorized', 401)

  const cfg = await getConfig()
  if (cfg.maintenanceMode === 1 && !user.isAdmin) {
    return json({ maintenance: true, message: 'The farm is under maintenance. Please come back soon! 🌱' })
  }

  const state = await buildGameState(user)
  return json(state)
}
