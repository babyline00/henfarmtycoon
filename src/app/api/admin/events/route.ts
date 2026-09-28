import { db } from '@/lib/db'
import { requireAdmin, err, json } from '@/lib/auth'
import { can, roleLabel, PERM } from '@/lib/security'

export async function GET(req: Request) {
  const admin = await requireAdmin(req)
  if (!admin) return err('Admin access required', 403)
  if (!can(admin.adminRole, PERM.EVENTS)) return err(`Your role (${roleLabel(admin.adminRole)}) cannot manage events`, 403)

  const events = await db.gameEvent.findMany({ orderBy: { createdAt: 'desc' } })
  return json({ events })
}

export async function POST(req: Request) {
  const admin = await requireAdmin(req)
  if (!admin) return err('Admin access required', 403)
  if (!can(admin.adminRole, PERM.EVENTS)) return err(`Your role (${roleLabel(admin.adminRole)}) cannot manage events`, 403)

  const body = await req.json().catch(() => null)
  const action = body?.action

  if (action === 'create') {
    const name = String(body.name ?? '').trim()
    const description = String(body.description ?? '').trim()
    const multiplier = Math.min(500, Math.max(100, Number(body.multiplier ?? 150)))
    const days = Math.max(1, Number(body.days ?? 3))
    if (!name) return err('Event name is required')

    const endsAt = new Date(Date.now() + days * 86400000)
    const ev = await db.gameEvent.create({
      data: { name, description, multiplier, endsAt, active: true },
    })

    // notify all users
    const users = await db.user.findMany({ select: { id: true } })
    await db.notification.createMany({
      data: users.map(u => ({
        userId: u.id,
        title: `🎉 Event Started: ${name}`,
        body: `${description || 'A new event is live!'} All production x${(multiplier / 100).toFixed(1)} for ${days} days!`,
      })),
    })

    return json({ ok: true, event: ev, message: `Event "${name}" is live and players notified!` })
  }

  if (action === 'toggle') {
    const id = String(body.id)
    const ev = await db.gameEvent.findUnique({ where: { id } })
    if (!ev) return err('Event not found', 404)
    await db.gameEvent.update({ where: { id }, data: { active: !ev.active } })
    return json({ ok: true, message: `Event "${ev.name}" ${!ev.active ? 'activated' : 'deactivated'}` })
  }

  if (action === 'delete') {
    const id = String(body.id)
    await db.gameEvent.delete({ where: { id } })
    return json({ ok: true, message: 'Event deleted' })
  }

  return err('Unknown action')
}
