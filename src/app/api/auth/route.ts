import { db } from '@/lib/db'
import {
  hashPassword, verifyPassword, needsRehash,
  createSession, err, json, makeReferralCode,
} from '@/lib/auth'
import { getConfig } from '@/lib/economy'
import { checkAnonRate, logSecurityEvent } from '@/lib/security'

// Reverse-proxy aware client address. Falls back to a constant so an
// unset header cannot be used to sidestep the abuse limits.
export function clientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0].trim()
  return req.headers.get('x-real-ip') ?? 'unknown'
}

const MIN_PASSWORD = 8

// Abuse limits. The login ceiling is deliberately tight (that is the
// brute-force vector). The register ceiling is looser because a whole
// office, campus or mobile carrier can sit behind one NAT address —
// blocking those would reject real players, not abusers. Ops can tune
// both without a redeploy; the automated suites raise them.
function numEnv(name: string, fallback: number): number {
  const v = Number(process.env[name])
  return Number.isFinite(v) && v > 0 ? v : fallback
}
const LOGIN_LIMIT = numEnv('AUTH_LOGIN_RATE', 10)
const LOGIN_WINDOW = numEnv('AUTH_LOGIN_WINDOW_MS', 5 * 60 * 1000)
const REGISTER_LIMIT = numEnv('AUTH_REGISTER_RATE', 20)
const REGISTER_WINDOW = numEnv('AUTH_REGISTER_WINDOW_MS', 10 * 60 * 1000)

// Password strength: length plus a mix of classes. Keeps the rule
// explainable in the error message instead of an opaque score.
function passwordProblem(pw: string): string | null {
  if (pw.length < MIN_PASSWORD) return `Password must be at least ${MIN_PASSWORD} characters`
  if (pw.length > 200) return 'Password is too long'
  const classes = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter(r => r.test(pw)).length
  if (classes < 2) return 'Password must mix letters, numbers or symbols (e.g. 2 of 3 classes)'
  return null
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  if (!body) return err('Invalid request')
  const { action, username, password, farmName, referralCode } = body as {
    action: string; username?: string; password?: string; farmName?: string; referralCode?: string
  }

  // ── abuse limits on the unauthenticated surface ──
  if (action === 'login') {
    const r = checkAnonRate(clientIp(req), action, LOGIN_LIMIT, LOGIN_WINDOW)
    if (!r.ok) {
      return err(`Too many login attempts. Try again in ${r.retryAfterSec}s.`, 429)
    }
  }
  if (action === 'register') {
    const r = checkAnonRate(clientIp(req), action, REGISTER_LIMIT, REGISTER_WINDOW)
    if (!r.ok) {
      return err(`Too many accounts created from this network. Try again in ${r.retryAfterSec}s.`, 429)
    }
  }

  if (action === 'register') {
    if (!username || !password || !farmName) return err('Username, password and farm name are required')
    if (username.length < 3) return err('Username must be at least 3 characters')
    if (username.length > 24) return err('Username must be 24 characters or fewer')
    const pwProblem = passwordProblem(password)
    if (pwProblem) return err(pwProblem)
    if (!/^[a-zA-Z0-9_]+$/.test(username)) return err('Username can only contain letters, numbers and _')

    const exists = await db.user.findUnique({ where: { username: username.trim() } })
    if (exists) return err('Username already taken, choose another')

    const cfg = await getConfig()

    // referral
    let refBy: string | null = null
    if (referralCode) {
      const ref = await db.user.findUnique({ where: { referralCode: referralCode.trim().toUpperCase() } })
      if (ref) refBy = ref.id
      else return err('Referral code not found')
      if (refBy === ref.id) return err('You cannot use your own referral code')
    }

    const user = await db.user.create({
      data: {
        username: username.trim(),
        password: await hashPassword(password),
        farmName: String(farmName).slice(0, 40),
        coins: cfg.startingBalance,
        gems: cfg.startingGems,
        referralCode: makeReferralCode(username),
        referredBy: refBy,
        farm: { create: {} },
      },
    })

    await db.transaction.create({
      data: { userId: user.id, type: 'admin', amount: cfg.startingBalance, currency: 'coins', description: 'Welcome starter bonus' },
    })

    if (refBy) {
      const bonus = cfg.referralBonus
      await db.user.update({ where: { id: refBy }, data: { coins: { increment: bonus } } })
      await db.transaction.create({ data: { userId: refBy, type: 'referral', amount: bonus, currency: 'coins', description: `Referral bonus: ${username} joined` } })
      await db.notification.create({
        data: { userId: refBy, title: '👥 New referral!', body: `${username} joined using your code. You earned ${bonus} coins!` },
      })
      await db.transaction.create({ data: { userId: user.id, type: 'referral', amount: bonus, currency: 'coins', description: 'Referral join bonus' } })
      await db.user.update({ where: { id: user.id }, data: { coins: { increment: bonus } } })
    }

    await db.notification.create({
      data: { userId: user.id, title: 'Welcome to Hen Farm! 🐔', body: `Your farm "${String(farmName).slice(0, 40)}" is ready. Buy hens, collect eggs and become a Legend Farmer!` },
    })

    const token = await createSession(user.id)
    return json({ token, username: user.username, isAdmin: user.isAdmin })
  }

  if (action === 'login') {
    if (!username || !password) return err('Username and password required')
    const uname = username.trim()
    const user = await db.user.findUnique({ where: { username: uname } })

    // Verify against a dummy hash when the user is unknown so the
    // response time does not reveal whether an account exists.
    const stored = user?.password ?? '$scrypt$16384$8$1$00000000000000000000000000000000$' + '0'.repeat(128)
    const ok = await verifyPassword(password, stored)

    if (!user || !ok) {
      if (user) await logSecurityEvent(user.id, 'login_failed', `Failed login for @${user.username}`)
      return err('Invalid username or password', 401)
    }
    if (user.isBlocked) return err('Your account has been blocked. Contact support.', 403)

    // Transparent upgrade: legacy SHA-256 rows are rehashed on success.
    if (needsRehash(user.password)) {
      try {
        await db.user.update({ where: { id: user.id }, data: { password: await hashPassword(password) } })
      } catch { /* rehash is best-effort; never block a valid login */ }
    }

    await db.user.update({ where: { id: user.id }, data: { lastSeenAt: new Date() } })
    const token = await createSession(user.id)
    return json({ token, username: user.username, isAdmin: user.isAdmin })
  }

  if (action === 'logout') {
    const token = req.headers.get('x-auth-token')
    if (token) await db.session.deleteMany({ where: { id: token } })
    return json({ ok: true })
  }

  return err('Unknown action')
}
