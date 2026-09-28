import { db } from '@/lib/db'
import { requireAdmin, err, json } from '@/lib/auth'
import { can, roleLabel, PERM, checkAdminRate } from '@/lib/security'

export async function GET(req: Request) {
  const admin = await requireAdmin(req)
  if (!admin) return err('Admin access required', 403)
  if (!can(admin.adminRole, PERM.WITHDRAWALS)) return err(`Your role (${roleLabel(admin.adminRole)}) cannot manage withdrawal payouts`, 403)

  const withdrawals = await db.withdrawal.findMany({
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    take: 100,
  })

  return json({ withdrawals })
}

export async function POST(req: Request) {
  const admin = await requireAdmin(req)
  if (!admin) return err('Admin access required', 403)
  if (!can(admin.adminRole, PERM.WITHDRAWALS)) return err(`Your role (${roleLabel(admin.adminRole)}) cannot manage withdrawal payouts`, 403)

  const body = await req.json().catch(() => null)
  if (!body?.id || !body?.action) return err('Missing parameters')
  const { id, action } = body as { id: string; action: string; note?: string }

  const rate = checkAdminRate(admin.id, action)
  if (!rate.ok) return err(`Too many payout actions. Try again in ${rate.retryAfterSec}s.`, 429)

  const w = await db.withdrawal.findUnique({ where: { id } })
  if (!w) return err('Withdrawal not found', 404)
  if (w.status !== 'pending' && w.status !== 'hold') return err('Already processed')

  if (action === 'approve') {
    await db.withdrawal.update({
      where: { id },
      data: { status: 'approved', processedAt: new Date(), processedBy: admin.username, note: body.note ?? null },
    })
    await db.notification.create({
      data: {
        userId: w.userId,
        title: '✅ Withdrawal approved',
        body: `Your withdrawal of ${w.amount} coins via ${w.method.toUpperCase()} has been approved and is being processed.`,
      },
    })
    return json({ ok: true, message: `Approved ${w.amount} coins for ${w.username}` })
  }

  if (action === 'reject') {
    // refund coins
    await db.user.update({ where: { id: w.userId }, data: { coins: { increment: w.amount } } })
    await db.transaction.create({
      data: { userId: w.userId, type: 'refund', amount: w.amount, currency: 'coins', description: 'Withdrawal rejected — coins refunded' },
    })
    await db.withdrawal.update({
      where: { id },
      data: { status: 'rejected', processedAt: new Date(), processedBy: admin.username, note: body.note ?? null },
    })
    await db.notification.create({
      data: {
        userId: w.userId,
        title: '❌ Withdrawal rejected',
        body: `Your withdrawal of ${w.amount} coins was rejected. Coins have been refunded to your wallet.${body.note ? ` Note: ${body.note}` : ''}`,
      },
    })
    return json({ ok: true, message: `Rejected & refunded ${w.amount} coins to ${w.username}` })
  }

  if (action === 'hold') {
    await db.withdrawal.update({
      where: { id },
      data: { status: 'hold', note: body.note ?? null },
    })
    return json({ ok: true, message: `Held for review: ${w.username}` })
  }

  return err('Unknown action')
}
