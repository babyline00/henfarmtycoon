import { db } from '@/lib/db'
import { getUserFromRequest, json, err } from '@/lib/auth'
import { checkRate } from '@/lib/security'

// ══════════ Phase 25 — Customer Support Center (player side) ══════════

export async function GET(req: Request) {
  const user = await getUserFromRequest(req)
  if (!user) return err('Unauthorized', 401)

  const url = new URL(req.url)
  const ticketId = url.searchParams.get('ticketId')

  if (ticketId) {
    const ticket = await db.ticket.findUnique({
      where: { id: ticketId },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    })
    if (!ticket || ticket.userId !== user.id) return err('Ticket not found', 404)
    return json({ ticket })
  }

  const tickets = await db.ticket.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: 'desc' },
    include: { messages: { orderBy: { createdAt: 'desc' }, take: 1 } },
  })

  return json({
    tickets: tickets.map(t => ({
      id: t.id, subject: t.subject, category: t.category, status: t.status,
      assignedTo: t.assignedTo, createdAt: t.createdAt, updatedAt: t.updatedAt,
      lastMessage: t.messages[0] ? { sender: t.messages[0].sender, body: t.messages[0].body.slice(0, 120) } : null,
      messageCount: 0,
    })),
  })
}

export async function POST(req: Request) {
  const user = await getUserFromRequest(req)
  if (!user) return err('Unauthorized', 401)
  const body = await req.json().catch(() => null)
  const action = body?.action

  // ── create ticket ──
  if (action === 'create') {
    const rate = checkRate(user.id, 'ticket_create')
    if (!rate.ok) return err(`Please wait ${rate.retryAfterSec}s before creating another ticket`, 429)

    const subject = String(body.subject ?? '').trim()
    const message = String(body.message ?? '').trim()
    const category = ['bug', 'account', 'payment', 'market', 'other'].includes(String(body.category))
      ? String(body.category) : 'other'
    if (subject.length < 5) return err('Subject must be at least 5 characters')
    if (message.length < 10) return err('Please describe your issue in at least 10 characters')

    const ticket = await db.ticket.create({
      data: {
        userId: user.id, username: user.username,
        subject: subject.slice(0, 120), category,
        messages: { create: { sender: 'user', senderName: user.username, body: message.slice(0, 2000) } },
      },
    })
    return json({ ok: true, ticketId: ticket.id, message: '🎫 Ticket created! Our support team will reply soon.' })
  }

  // ── reply to ticket ──
  if (action === 'reply') {
    checkRate(user.id, 'ticket_reply')
    const ticketId = String(body.ticketId ?? '')
    const message = String(body.message ?? '').trim()
    if (message.length < 1) return err('Message cannot be empty')

    const ticket = await db.ticket.findUnique({ where: { id: ticketId } })
    if (!ticket || ticket.userId !== user.id) return err('Ticket not found', 404)
    if (ticket.status === 'closed') return err('This ticket is closed — create a new one if you still need help')

    await db.ticketMessage.create({
      data: { ticketId: ticket.id, sender: 'user', senderName: user.username, body: message.slice(0, 2000) },
    })
    await db.ticket.update({ where: { id: ticket.id }, data: { status: 'open' } })
    return json({ ok: true, message: 'Reply sent!' })
  }

  // ── close own ticket ──
  if (action === 'close') {
    const ticketId = String(body.ticketId ?? '')
    const ticket = await db.ticket.findUnique({ where: { id: ticketId } })
    if (!ticket || ticket.userId !== user.id) return err('Ticket not found', 404)
    await db.ticket.update({ where: { id: ticket.id }, data: { status: 'closed' } })
    return json({ ok: true, message: 'Ticket closed. Glad we could help! 🐔' })
  }

  return err('Unknown action')
}
