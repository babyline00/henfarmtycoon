import { db } from '@/lib/db'
import { requireAdmin, err, json } from '@/lib/auth'
import { can, roleLabel, ROLE_PERMS, PERM } from '@/lib/security'

// Phase 16 — Security center: audit logs, flagged users, security events, roles
export async function GET(req: Request) {
  const admin = await requireAdmin(req)
  if (!admin) return err('Admin access required', 403)
  if (!can(admin.adminRole, PERM.SECURITY_VIEW)) return err(`Your role (${roleLabel(admin.adminRole)}) cannot view security`, 403)

  const [eventsRaw, flagged, logs, rateLimited, priceAbuse, eventUsers] = await Promise.all([
    db.securityEvent.findMany({
      orderBy: { createdAt: 'desc' },
      take: 40,
    }),
    db.user.findMany({
      where: { flagged: true },
      select: { id: true, username: true, farmName: true, avatar: true, flagReason: true, coins: true, lastSeenAt: true, isBlocked: true },
      take: 30,
    }),
    db.adminLog.findMany({ orderBy: { createdAt: 'desc' }, take: 40 }),
    db.securityEvent.count({ where: { kind: 'rate_limit' } }),
    db.securityEvent.count({ where: { kind: 'price_abuse' } }),
    db.user.findMany({
      where: { id: { in: (await db.securityEvent.findMany({ select: { userId: true }, take: 40, orderBy: { createdAt: 'desc' } })).map(e => e.userId) } },
      select: { id: true, username: true, farmName: true },
    }),
  ])

  const userMap = new Map(eventUsers.map(u => [u.id, u]))

  const admins = await db.user.findMany({
    where: { isAdmin: true },
    select: { id: true, username: true, farmName: true, adminRole: true, lastSeenAt: true },
  })

  return json({
    events: eventsRaw.map(e => ({
      id: e.id, kind: e.kind, detail: e.detail, createdAt: e.createdAt,
      username: userMap.get(e.userId)?.username ?? '?', farmName: userMap.get(e.userId)?.farmName ?? '?', userId: e.userId,
    })),
    flagged,
    logs,
    summary: {
      rateLimitedCount: rateLimited,
      priceAbuseCount: priceAbuse,
      flaggedCount: flagged.length,
      adminCount: admins.length,
    },
    admins: admins.map(a => ({
      id: a.id, username: a.username, farmName: a.farmName,
      role: a.adminRole ?? 'super', roleLabel: roleLabel(a.adminRole),
      lastSeenAt: a.lastSeenAt,
    })),
    roleMatrix: Object.entries(ROLE_PERMS).map(([role, perms]) => ({
      role, roleLabel: roleLabel(role), perms,
    })),
    me: { id: admin.id, role: admin.adminRole ?? 'super', roleLabel: roleLabel(admin.adminRole) },
  })
}
