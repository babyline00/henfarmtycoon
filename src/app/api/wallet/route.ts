import { db } from '@/lib/db'
import { getUserFromRequest, json, err } from '@/lib/auth'
import { getConfig } from '@/lib/economy'
import {
  PAY_METHOD_DEFS, getPayMethods, DEPOSIT_BONUS_TIERS,
} from '@/lib/payment'

export async function GET(req: Request) {
  const user = await getUserFromRequest(req)
  if (!user) return err('Unauthorized', 401)

  const url = new URL(req.url)
  const currency = url.searchParams.get('currency') // coins | gems | null

  const [txs, withdrawals, deposits, cfg, methods] = await Promise.all([
    db.transaction.findMany({
      where: { userId: user.id, ...(currency ? { currency } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 80,
    }),
    db.withdrawal.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 12,
    }),
    db.deposit.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 12,
      // never send other users' proofs back; own proof ok for status view
      select: { id: true, amountCents: true, method: true, reference: true, coins: true, bonusCoins: true, status: true, note: true, createdAt: true },
    }),
    getConfig(),
    getPayMethods(),
  ])

  const [depositSum, approvedDeposits, withdrawnSum] = await Promise.all([
    db.deposit.aggregate({ where: { userId: user.id, status: 'approved' }, _sum: { amountCents: true } }),
    db.deposit.count({ where: { userId: user.id, status: 'approved' } }),
    db.withdrawal.aggregate({ where: { userId: user.id, status: 'approved' }, _sum: { amount: true } }),
  ])

  // public-safe payment method info for the deposit form
  const payMethods = PAY_METHOD_DEFS.map(def => ({
    key: def.key, name: def.name, emoji: def.emoji,
    instructions: def.instructions,
    fields: def.fields,
    enabled: methods[def.key]?.enabled ?? false,
    account: methods[def.key]?.enabled
      ? Object.fromEntries(def.fields.map(f => [f.key, methods[def.key]?.[f.key] ?? '']))
      : {},
  }))

  return json({
    transactions: txs,
    withdrawals,
    deposits,
    payMethods,
    coins: user.coins,
    gems: user.gems,
    walletCfg: {
      coinsPerUsd: cfg.coinsPerUsd,
      depositMinCents: cfg.depositMinCents,
      depositMaxCents: cfg.depositMaxCents,
      wdFeePct: cfg.wdFeePct,
      wdMaxCoins: cfg.wdMaxCoins,
      withdrawalMin: cfg.withdrawalMin,
      firstDepositBonusPct: cfg.firstDepositBonusPct,
      bonusTiers: DEPOSIT_BONUS_TIERS,
    },
    savedProfile: {
      title: user.savedTitle, account: user.savedAccount, bank: user.savedBank,
      hasSaved: !!(user.savedTitle || user.savedAccount),
    },
    stats: {
      totalDepositedCents: depositSum._sum.amountCents ?? 0,
      approvedDeposits,
      totalWithdrawnCoins: withdrawnSum._sum.amount ?? 0,
      pendingDeposits: deposits.filter(d => d.status === 'pending').length,
    },
  })
}

export async function POST(req: Request) {
  const user = await getUserFromRequest(req)
  if (!user) return err('Unauthorized', 401)

  const body = await req.json().catch(() => null)
  if (!body?.action) return err('Missing action')

  // save / clear the payment profile used for one-tap withdrawal autofill
  if (body.action === 'save_payment_profile') {
    const title = String(body.title ?? '').trim()
    const account = String(body.account ?? '').trim()
    const bank = String(body.bank ?? '').trim()
    if (title.length < 3) return err('Account title too short')
    if (account.length < 6) return err('Account number too short')
    await db.user.update({
      where: { id: user.id },
      data: { savedTitle: title, savedAccount: account, savedBank: bank || null },
    })
    return json({ ok: true, message: '💳 Payment details saved for faster withdrawals' })
  }

  if (body.action === 'clear_payment_profile') {
    await db.user.update({
      where: { id: user.id },
      data: { savedTitle: null, savedAccount: null, savedBank: null },
    })
    return json({ ok: true, message: 'Saved payment details removed' })
  }

  return err('Unknown action')
}
