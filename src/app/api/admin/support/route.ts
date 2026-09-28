import { db } from '@/lib/db'
import { requireAdmin, json, err } from '@/lib/auth'
import { can, roleLabel, PERM } from '@/lib/security'
import { notify } from '@/lib/economy'

// ══════════ Phase 25 — Admin Support Console ══════════

export async function GET(req: Request) {
  const admin = await requireAdmin(req)
  if (!admin) return err('Admin access required', 403)
  if (!can(admin.adminRole, PERM.TICKETS)) return err(`Your role (${roleLabel(admin.adminRole)}) cannot view support tickets`, 403)

  const url = new URL(req.url)
  const filter = url.searchParams.get('status') ?? 'all'

  const [tickets, summary] = await Promise.all([
    db.ticket.findMany({
      where: filter === 'all' ? {} : { status: filter },
      orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
      include: { messages: { orderBy: { createdAt: 'asc' } } },
      take: 100,
    }),
    db.ticket.groupBy({ by: ['status'], _count: true }),
  ])

  const counts = { open: 0, answered: 0, closed: 0 }
  for (const s of summary) counts[s.status as keyof typeof counts] = s._count

  return json({
    counts,
    tickets: tickets.map(t => ({
      id: t.id, userId: t.userId, username: t.username,
      subject: t.subject, category: t.category, status: t.status,
      assignedTo: t.assignedTo, createdAt: t.createdAt, updatedAt: t.updatedAt,
      messages: t.messages.map(m => ({
        id: m.id, sender: m.sender, senderName: m.senderName, body: m.body, createdAt: m.createdAt,
      })),
    })),
  })
}

export async function POST(req: Request) {
  const admin = await requireAdmin(req)
  if (!admin) return err('Admin access required', 403)
  if (!can(admin.adminRole, PERM.TICKETS)) return err(`Your role (${roleLabel(admin.adminRole)}) cannot manage support tickets`, 403)

  const body = await req.json().catch(() => null)
  const action = body?.action
  const ticketId = String(body?.ticketId ?? '')
  const ticket = await db.ticket.findUnique({ where: { id: ticketId } })
  if (!ticket) return err('Ticket not found', 404)

  // ── reply ──
  if (action === 'reply') {
    const message = String(body.message ?? '').trim()
    if (!message) return err('Reply message required')
    await db.ticketMessage.create({
      data: { ticketId: ticket.id, sender: 'staff', senderName: admin.username, body: message.slice(0, 2000) },
    })
    await db.ticket.update({ where: { id: ticket.id }, data: { status: 'answered', assignedTo: admin.username } })
    await notify(ticket.userId, '💬 Support replied', `${admin.username} answered your ticket "${ticket.subject}". Check the Support Center!`)
    return json({ ok: true, message: 'Reply sent & player notified' })
  }

  // ── assign ──
  if (action === 'assign') {
    await db.ticket.update({ where: { id: ticket.id }, data: { assignedTo: admin.username } })
    return json({ ok: true, message: `Ticket assigned to ${admin.username}` })
  }

  // ── close / reopen ──
  if (action === 'close' || action === 'reopen') {
    const status = action === 'close' ? 'closed' : 'open'
    await db.ticket.update({ where: { id: ticket.id }, data: { status } })
    return json({ ok: true, message: `Ticket ${action === 'close' ? 'closed' : 'reopened'}` })
  }

  return err('Unknown action')
}
