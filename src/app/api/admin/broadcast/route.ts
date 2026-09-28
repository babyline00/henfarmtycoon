import { db } from '@/lib/db'
import { requireAdmin, err, json } from '@/lib/auth'
import { can, roleLabel, PERM } from '@/lib/security'

export async function POST(req: Request) {
  const admin = await requireAdmin(req)
  if (!admin) return err('Admin access required', 403)
  if (!can(admin.adminRole, PERM.BROADCAST)) return err(`Your role (${roleLabel(admin.adminRole)}) cannot send broadcasts`, 403)

  const body = await req.json().catch(() => null)
  const title = String(body?.title ?? '').trim()
  const message = String(body?.message ?? '').trim()
  if (!title || !message) return err('Title and message are required')

  const users = await db.user.findMany({ select: { id: true } })
  await db.notification.createMany({
    data: users.map(u => ({ userId: u.id, title, body: message })),
  })

  return json({ ok: true, message: `📢 Broadcast sent to ${users.length} farmers!` })
}
