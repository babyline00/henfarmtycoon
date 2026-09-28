import { db } from '@/lib/db'
import { requireAdmin, err, json } from '@/lib/auth'
import { can, roleLabel, PERM, checkAdminRate } from '@/lib/security'
import { adjustBalance, bumpDailyStat, notify } from '@/lib/economy'
import { usd } from '@/lib/payment'

export async function GET(req: Request) {
  const admin = await requireAdmin(req)
  if (!admin) return err('Admin access required', 403)
  if (!can(admin.adminRole, PERM.DEPOSITS)) return err(`Your role (${roleLabel(admin.adminRole)}) cannot manage deposits`, 403)

  const url = new URL(req.url)
  const status = url.searchParams.get('status') // pending | approved | rejected | null = all

  const [deposits, agg] = await Promise.all([
    db.deposit.findMany({
      ...(status ? { where: { status } } : {}),
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      take: 100,
    }),
    db.deposit.aggregate({ where: { status: 'approved' }, _sum: { amountCents: true, coins: true, bonusCoins: true } }),
  ])

  const pendingCount = await db.deposit.count({ where: { status: 'pending' } })

  return json({
    deposits,
    stats: {
      totalApprovedCents: agg._sum.amountCents ?? 0,
      coinsIssued: (agg._sum.coins ?? 0) + (agg._sum.bonusCoins ?? 0),
      pendingCount,
    },
  })
}

export async function POST(req: Request) {
  const admin = await requireAdmin(req)
  if (!admin) return err('Admin access required', 403)
  if (!can(admin.adminRole, PERM.DEPOSITS)) return err(`Your role (${roleLabel(admin.adminRole)}) cannot manage deposits`, 403)

  const body = await req.json().catch(() => null)
  if (!body?.id || !body?.action) return err('Missing parameters')
  const { id, action } = body as { id: string; action: string; note?: string }

  const rate = checkAdminRate(admin.id, action)
  if (!rate.ok) return err(`Too many payout actions. Try again in ${rate.retryAfterSec}s.`, 429)

  const dep = await db.deposit.findUnique({ where: { id } })
  if (!dep) return err('Deposit not found', 404)
  if (dep.status !== 'pending') return err('Already processed')

  if (action === 'approve') {
    // credit base + bonus coins and record revenue
    const total = dep.coins + dep.bonusCoins
    await adjustBalance(dep.userId, total, 0, 'deposit', `Deposit verified ${usd(dep.amountCents)} (${dep.method.toUpperCase()} · ref ${dep.reference})${dep.bonusCoins ? ` · incl. +${dep.bonusCoins} bonus` : ''}`)
    await bumpDailyStat({ revenueCents: dep.amountCents })
    await db.deposit.update({
      where: { id },
      data: { status: 'approved', processedAt: new Date(), processedBy: admin.username },
    })
    await notify(
      dep.userId,
      '✅ Deposit approved',
      `Your deposit of ${usd(dep.amountCents)} via ${dep.method.toUpperCase()} was verified. 🪙 ${total.toLocaleString()} coins have been added to your wallet!`
    )
    return json({ ok: true, message: `Approved ${usd(dep.amountCents)} — credited 🪙 ${total.toLocaleString()} coins to @${dep.username}` })
  }

  if (action === 'reject') {
    await db.deposit.update({
      where: { id },
      data: { status: 'rejected', processedAt: new Date(), processedBy: admin.username, note: body.note ?? null },
    })
    await notify(
      dep.userId,
      '❌ Deposit rejected',
      `Your deposit of ${usd(dep.amountCents)} (ref ${dep.reference}) could not be verified.${body.note ? ` Reason: ${body.note}` : ' Double-check the payment details and try again, or contact support.'}`
    )
    return json({ ok: true, message: `Rejected deposit from @${dep.username}` })
  }

  return err('Unknown action')
}
