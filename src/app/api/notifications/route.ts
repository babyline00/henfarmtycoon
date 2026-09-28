import { db } from '@/lib/db'
import { getUserFromRequest, json, err } from '@/lib/auth'

export async function GET(req: Request) {
  const user = await getUserFromRequest(req)
  if (!user) return err('Unauthorized', 401)

  const notifications = await db.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    take: 30,
  })

  const unread = notifications.filter(n => !n.read).length
  return json({ notifications, unread })
}

export async function POST(req: Request) {
  const user = await getUserFromRequest(req)
  if (!user) return err('Unauthorized', 401)

  const body = await req.json().catch(() => null)
  if (body?.action === 'mark_read') {
    await db.notification.updateMany({ where: { userId: user.id, read: false }, data: { read: true } })
    return json({ ok: true })
  }
  return err('Unknown action')
}
