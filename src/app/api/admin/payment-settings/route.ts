import { requireAdmin, err, json } from '@/lib/auth'
import { can, roleLabel, PERM } from '@/lib/security'
import {
  PAY_METHOD_DEFS, getPayMethods, savePayMethods,
  type PayMethodsConfig,
} from '@/lib/payment'

// Admin-managed payment account details (bank accounts, mobile wallets, USDT address)
// stored as a JSON string in GameConfig — separate from the numeric economy knobs.

export async function GET(req: Request) {
  const admin = await requireAdmin(req)
  if (!admin) return err('Admin access required', 403)
  if (!can(admin.adminRole, PERM.PAYMENTS)) return err(`Your role (${roleLabel(admin.adminRole)}) cannot edit payment settings`, 403)

  const methods = await getPayMethods()
  return json({ methods, defs: PAY_METHOD_DEFS })
}

export async function POST(req: Request) {
  const admin = await requireAdmin(req)
  if (!admin) return err('Admin access required', 403)
  if (!can(admin.adminRole, PERM.PAYMENTS)) return err(`Your role (${roleLabel(admin.adminRole)}) cannot edit payment settings`, 403)

  const body = await req.json().catch(() => null)
  if (!body?.methods || typeof body.methods !== 'object') return err('Missing methods')

  const incoming = body.methods as PayMethodsConfig
  const clean: PayMethodsConfig = {}
  for (const def of PAY_METHOD_DEFS) {
    const m = incoming[def.key]
    if (!m) { clean[def.key] = { enabled: false }; continue }
    const fields: Record<string, unknown> = { enabled: !!m.enabled }
    for (const f of def.fields) {
      if (m[f.key] !== undefined) fields[f.key] = String(m[f.key]).slice(0, 120)
    }
    clean[def.key] = { ...fields, enabled: !!m.enabled }
  }

  await savePayMethods(clean)
  return json({ ok: true, message: '💳 Payment settings saved. Players see the new accounts immediately.' })
}
