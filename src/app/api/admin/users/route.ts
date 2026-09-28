import { db } from '@/lib/db'
import { requireAdmin, err, json, hashPassword } from '@/lib/auth'
import { levelInfo, numericLevel } from '@/lib/game'
import { can, roleLabel, isSuper, PERM, checkAdminRate } from '@/lib/security'

// Admin balance edits are a currency mint/burn. Bounded so a single
// mis-click cannot inject an unbounded amount into the economy.
const MAX_ADJUST = 1_000_000

export async function GET(req: Request) {
  const admin = await requireAdmin(req)
  if (!admin) return err('Admin access required', 403)
  if (!can(admin.adminRole, PERM.USERS_VIEW)) return err(`Your role (${roleLabel(admin.adminRole)}) cannot view users`, 403)

  const url = new URL(req.url)
  const search = url.searchParams.get('q')?.trim() ?? ''

  const users = await db.user.findMany({
    where: search
      ? { OR: [{ username: { contains: search } }, { farmName: { contains: search } }] }
      : {},
    orderBy: { createdAt: 'desc' },
    take: 60,
    select: {
      id: true, username: true, email: true, farmName: true, avatar: true,
      coins: true, gems: true, xp: true, isAdmin: true, isBlocked: true,
      referralCode: true, createdAt: true, lastSeenAt: true,
      flagged: true, flagReason: true, adminRole: true, vipUntil: true,
      hens: { select: { id: true } },
      animals: { select: { id: true } },
      farm: { select: { totalEarned: true, totalEggsHatch: true, coopLevel: true } },
      _count: { select: { transactions: true } },
    },
  })

  return json({
    // lets the UI disable controls the signed-in admin cannot use
    myRole: admin.adminRole,
    isSuper: isSuper(admin.adminRole),
    users: users.map(u => ({
      id: u.id,
      username: u.username,
      email: u.email,
      farmName: u.farmName,
      avatar: u.avatar,
      coins: u.coins,
      gems: u.gems,
      levelName: levelInfo(u.xp).name,
      xp: u.xp,
      isAdmin: u.isAdmin,
      isBlocked: u.isBlocked,
      adminRole: u.adminRole,
      roleLabel: u.isAdmin ? roleLabel(u.adminRole) : null,
      flagged: u.flagged,
      flagReason: u.flagReason,
      vipActive: !!(u.vipUntil && u.vipUntil > new Date()),
      numericLevel: numericLevel(u.xp),
      referralCode: u.referralCode,
      createdAt: u.createdAt,
      lastSeenAt: u.lastSeenAt,
      hens: u.hens.length,
      animals: u.animals.length,
      coopLevel: u.farm?.coopLevel ?? 1,
      totalEarned: u.farm?.totalEarned ?? 0,
      totalEggsHatch: u.farm?.totalEggsHatch ?? 0,
      txCount: u._count.transactions,
    })),
  })
}

export async function POST(req: Request) {
  const admin = await requireAdmin(req)
  if (!admin) return err('Admin access required', 403)

  const body = await req.json().catch(() => null)
  if (!body?.userId || !body?.action) return err('Missing parameters')
  const { userId, action } = body as { userId: string; action: string }

  // Per-action permission table. Authorisation is decided by what the
  // action can do, not by which screen it lives on. Previously every
  // action shared one coarse 'users' gate, which let a Support Manager
  // mint unlimited currency and take over any account.
  const AREA_FOR: Record<string, string> = {
    block: PERM.USERS_BAN,
    unblock: PERM.USERS_BAN,
    grant_hen: PERM.USERS_GIFT,
    unflag: PERM.SECURITY_UNFLAG,
    adjust: PERM.USERS_BALANCE,
    reset_password: PERM.USERS_PASSWORD,
    freeze_farm: PERM.USERS_BAN,
    set_role: '*', // super-only, checked via isSuper
  }
  const area = AREA_FOR[action]
  if (!area) return err('Unknown action')
  if (area === '*') {
    if (!isSuper(admin.adminRole)) {
      return err(`Only the Super Admin can assign roles (you are ${roleLabel(admin.adminRole)})`, 403)
    }
  } else if (!can(admin.adminRole, area)) {
    return err(`Your role (${roleLabel(admin.adminRole)}) cannot perform "${action}"`, 403)
  }

  const rate = checkAdminRate(admin.id, action)
  if (!rate.ok) return err(`Too many "${action}" actions. Try again in ${rate.retryAfterSec}s.`, 429)

  async function logAdmin(a: string, detail: string) {
    await db.adminLog.create({ data: { adminId: admin!.id, adminName: admin!.username, action: a, detail } })
  }

  const user = await db.user.findUnique({ where: { id: userId } })
  if (!user) return err('User not found', 404)

  if (action === 'block' || action === 'unblock') {
    if (user.isAdmin) return err('Cannot block an admin account')
    await db.user.update({ where: { id: userId }, data: { isBlocked: action === 'block' } })
    await logAdmin(action, `@${user.username}`)
    if (action === 'block') {
      await db.session.deleteMany({ where: { userId } })
      await db.notification.create({
        data: { userId, title: '⛔ Account blocked', body: 'Your account has been blocked by administration. Contact support for help.' },
      })
    }
    return json({ ok: true, message: `User ${user.username} ${action === 'block' ? 'blocked' : 'unblocked'}` })
  }

  if (action === 'unflag') {
    await db.user.update({ where: { id: userId }, data: { flagged: false, flagReason: null } })
    await logAdmin('unflag', `@${user.username} was: ${user.flagReason ?? 'flagged'}`)
    return json({ ok: true, message: `Flag cleared for ${user.username}` })
  }

  if (action === 'set_role') {
    const role = String(body.role ?? '') // super | finance | game | support | none
    const valid = ['super', 'finance', 'game', 'support', 'none']
    if (!valid.includes(role)) return err('Invalid role')
    if (user.id === admin.id && role !== 'super') {
      return err('You cannot remove your own Super Admin access', 400)
    }
    if (role === 'none') {
      await db.user.update({ where: { id: userId }, data: { isAdmin: false, adminRole: null } })
      await logAdmin('set_role', `@${user.username} → revoked admin`)
      return json({ ok: true, message: `Admin access revoked for ${user.username}` })
    }
    await db.user.update({ where: { id: userId }, data: { isAdmin: true, adminRole: role } })
    await logAdmin('set_role', `@${user.username} → ${role}`)
    await db.notification.create({
      data: { userId, title: '🛡️ Staff role assigned', body: `You have been granted the "${roleLabel(role)}" role in the admin panel.` },
    })
    return json({ ok: true, message: `${user.username} is now ${roleLabel(role)}` })
  }

  if (action === 'adjust') {
    const coins = Math.floor(Number(body.coins ?? 0))
    const gems = Math.floor(Number(body.gems ?? 0))
    if (!Number.isFinite(coins) || !Number.isFinite(gems)) return err('Amounts must be numbers')
    if (!coins && !gems) return err('Enter an amount to adjust')
    if (Math.abs(coins) > MAX_ADJUST || Math.abs(gems) > MAX_ADJUST) {
      return err(`Amounts are capped at ${MAX_ADJUST.toLocaleString()} per adjustment`, 400)
    }
    // Never let an adjustment drive a balance negative.
    if (coins < 0 && user.coins + coins < 0) {
      return err(`${user.username} only has ${user.coins.toLocaleString()} coins`, 400)
    }
    if (gems < 0 && user.gems + gems < 0) {
      return err(`${user.username} only has ${user.gems} gems`, 400)
    }

    await db.user.update({
      where: { id: userId },
      data: { coins: { increment: coins }, gems: { increment: gems } },
    })
    if (coins !== 0) {
      await db.transaction.create({
        data: { userId, type: 'admin', amount: coins, currency: 'coins', description: `Admin adjustment by ${admin.username}` },
      })
    }
    if (gems !== 0) {
      await db.transaction.create({
        data: { userId, type: 'admin', amount: gems, currency: 'gems', description: `Admin adjustment by ${admin.username}` },
      })
    }
    await db.notification.create({
      data: {
        userId,
        title: coins >= 0 || gems >= 0 ? '🎁 Balance updated' : '⚠️ Balance adjusted',
        body: `An administrator ${coins >= 0 ? 'added' : 'deducted'} ${Math.abs(coins)} coins${gems ? ` and ${Math.abs(gems)} gems` : ''} ${coins >= 0 ? 'to' : 'from'} your wallet.`,
      },
    })
    await logAdmin('adjust', `@${user.username} coins=${coins} gems=${gems}`)
    return json({ ok: true, message: `Balance updated for ${user.username}` })
  }

  if (action === 'grant_hen') {
    const type = String(body.henType ?? 'normal')
    await db.hen.create({ data: { userId, type, name: 'Gift Hen' } })
    await db.notification.create({
      data: { userId, title: '🐔 Gift received!', body: `The farm admins gifted you a hen. Check your coop!` },
    })
    await logAdmin('grant_hen', `@${user.username} type=${type}`)
    return json({ ok: true, message: `Gifted ${type} hen to ${user.username}` })
  }

  if (action === 'reset_password') {
    // Super Admin only — this is a full account takeover primitive, so
    // it is deliberately not exposed in the admin UI. It exists for
    // manual account recovery, and every use is audited.
    const newPassword = String(body.newPassword ?? '')
    if (newPassword.length < 8) return err('New password must be at least 8 characters')
    if (user.isAdmin && !isSuper(admin.adminRole)) return err('Cannot reset another admin account', 403)
    await db.user.update({ where: { id: userId }, data: { password: await hashPassword(newPassword) } })
    await db.session.deleteMany({ where: { userId } })
    await logAdmin('reset_password', `@${user.username} (${user.isAdmin ? 'ADMIN ' : ''}all sessions revoked)`)
    return json({ ok: true, message: `Password reset for ${user.username} — all their sessions were signed out` })
  }

  if (action === 'freeze_farm') {
    await db.farm.updateMany({ where: { userId }, data: { buffType: null, buffExpiresAt: null } })
    await db.hen.updateMany({ where: { userId, status: 'active' }, data: { status: 'retired' } })
    await logAdmin('freeze_farm', `@${user.username} — active hens retired, buffs cleared`)
    return json({ ok: true, message: `Farm frozen for ${user.username} — all hens retired, buffs cleared` })
  }

  return err('Unknown action')
}
