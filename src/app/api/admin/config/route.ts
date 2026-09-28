import { db } from '@/lib/db'
import { requireAdmin, err, json } from '@/lib/auth'
import { can, roleLabel, PERM, checkAdminRate } from '@/lib/security'
import { CONFIG_DEFAULTS, MONEY_CONFIG_KEYS } from '@/lib/economy'

export async function GET(req: Request) {
  const admin = await requireAdmin(req)
  if (!admin) return err('Admin access required', 403)
  if (!can(admin.adminRole, PERM.CONFIG_GAME) && !can(admin.adminRole, PERM.CONFIG_MONEY)) {
    return err(`Your role (${roleLabel(admin.adminRole)}) cannot view economy config`, 403)
  }

  const rows = await db.gameConfig.findMany()
  const config: Record<string, string> = { ...Object.fromEntries(Object.entries(CONFIG_DEFAULTS).map(([k, v]) => [k, String(v)])) }
  for (const r of rows) config[r.key] = r.value

  // Tell the client which keys this admin is allowed to write, so the
  // UI can lock the money knobs instead of relying on a failed save.
  const canGame = can(admin.adminRole, PERM.CONFIG_GAME)
  const canMoney = can(admin.adminRole, PERM.CONFIG_MONEY)

  return json({ config, editable: Object.keys(CONFIG_DEFAULTS).filter(k => (MONEY_CONFIG_KEYS.has(k) ? canMoney : canGame)) })
}

export async function POST(req: Request) {
  const admin = await requireAdmin(req)
  if (!admin) return err('Admin access required', 403)
  if (!can(admin.adminRole, PERM.CONFIG_GAME) && !can(admin.adminRole, PERM.CONFIG_MONEY)) {
    return err(`Your role (${roleLabel(admin.adminRole)}) cannot edit economy config`, 403)
  }

  const rate = checkAdminRate(admin.id, 'save_config')
  if (!rate.ok) return err(`Too many config saves. Try again in ${rate.retryAfterSec}s.`, 429)

  const body = await req.json().catch(() => null)
  if (!body?.config) return err('Missing config')

  const canGame = can(admin.adminRole, PERM.CONFIG_GAME)
  const canMoney = can(admin.adminRole, PERM.CONFIG_MONEY)

  const updates = body.config as Record<string, string | number>
  const accepted: string[] = []
  const denied: string[] = []
  const values: { key: string; value: string }[] = []

  for (const [key, value] of Object.entries(updates)) {
    if (!(key in CONFIG_DEFAULTS)) continue
    const allowed = MONEY_CONFIG_KEYS.has(key) ? canMoney : canGame
    if (!allowed) { denied.push(key); continue }
    const num = Number(value)
    if (Number.isNaN(num) || !Number.isFinite(num)) continue
    accepted.push(key)
    values.push({ key, value: String(num) })
  }

  if (values.length === 0) {
    return err(
      denied.length
        ? `Your role cannot change: ${denied.join(', ')}`
        : 'No valid settings to save',
      403,
    )
  }

  await db.$transaction(
    values.map(v => db.gameConfig.upsert({
      where: { key: v.key },
      update: { value: v.value },
      create: v,
    })),
  )

  await db.adminLog.create({
    data: {
      adminId: admin.id, adminName: admin.username, action: 'save_config',
      detail: `${accepted.length} key(s): ${accepted.join(', ')}${denied.length ? ` | refused: ${denied.join(', ')}` : ''}`,
    },
  })

  return json({
    ok: true,
    message: `Economy settings saved (${accepted.length}). Changes apply immediately.`,
    ...(denied.length ? { warning: `Ignored keys your role cannot change: ${denied.join(', ')}` } : {}),
  })
}
