import { db } from '@/lib/db'
import {
  hashPassword, verifyPassword, needsRehash, passwordProblem,
  createSession, err, json, makeReferralCode, getUserFromRequest,
} from '@/lib/auth'
import { getConfig } from '@/lib/economy'
import { checkAnonRate, logSecurityEvent } from '@/lib/security'

// Reverse-proxy awareness, and why it is opt-in.
//
// X-Forwarded-For / X-Real-IP are attacker-controlled unless a proxy that
// OVERWRITES them is genuinely deployed in front of this process. Reading
// them unconditionally let a single client mint an unlimited number of
// login attempts by sending a fresh header per request, which defeated the
// brute-force limit completely — verified before this change: nine failed
// logins across three spoofed addresses never returned 429.
//
// So the headers are only consulted when TRUST_PROXY=1. Otherwise every
// request lands in one shared bucket. That is deliberately the safe
// direction: a shared bucket can inconvenience everyone behind one NAT,
// whereas a spoofable bucket silently disables the limit. Per-account
// limiting (see LOGIN_ACCOUNT_LIMIT) is what actually protects a password,
// so the shared bucket does not have to be tight.
const TRUST_PROXY = process.env.TRUST_PROXY === '1'
const UNKNOWN_CLIENT = 'unknown'

export function clientIp(req: Request): string {
  if (!TRUST_PROXY) return UNKNOWN_CLIENT
  const fwd = req.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0].trim() || UNKNOWN_CLIENT
  return req.headers.get('x-real-ip') ?? UNKNOWN_CLIENT
}

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
// Failed-attempt limit for a single account. The per-IP bucket stops one
// host spraying many usernames; this stops one account being sprayed from
// many hosts — including every host behind one NAT when the client address
// is unknown. It counts failures only, so it cannot be triggered by a
// player signing in normally.
const LOGIN_ACCOUNT_LIMIT = numEnv('AUTH_LOGIN_ACCOUNT_RATE', 10)
const REGISTER_LIMIT = numEnv('AUTH_REGISTER_RATE', 20)
const REGISTER_WINDOW = numEnv('AUTH_REGISTER_WINDOW_MS', 10 * 60 * 1000)

/**
 * Usernames are case-folded to a single canonical form.
 *
 * SQLite compares TEXT case-sensitively, so without this "Demo" and
 * "demo" were two different accounts with two different passwords — anyone
 * could register a near-copy of a real player and answer to a similar name
 * in chat and the leaderboards. Folding at both write and read time makes
 * the name a genuine identity. farmName keeps its original casing, so the
 * display name the player chose is unaffected.
 */
export function canonicalUsername(raw: string): string {
  return raw.trim().toLowerCase()
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  if (!body) return err('Invalid request')
  const { action, username, password, farmName, referralCode } = body as {
    action: string; username?: string; password?: string; farmName?: string; referralCode?: string
  }

  // ── abuse limits on the unauthenticated surface ──
  if (action === 'login') {
    // Per-IP: counts every attempt, which is what stops one host spraying
    // many usernames.
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
    const uname = canonicalUsername(username)
    if (uname.length < 3) return err('Username must be at least 3 characters')
    if (uname.length > 24) return err('Username must be 24 characters or fewer')
    const pwProblem = passwordProblem(password)
    if (pwProblem) return err(pwProblem)
    if (!/^[a-z0-9_]+$/.test(uname)) return err('Username can only contain letters, numbers and _')

    const exists = await db.user.findUnique({ where: { username: uname } })
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
        username: uname,
        password: await hashPassword(password),
        farmName: String(farmName).slice(0, 40),
        coins: cfg.startingBalance,
        gems: cfg.startingGems,
        referralCode: makeReferralCode(uname),
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
    const uname = canonicalUsername(username)
    const user = await db.user.findUnique({ where: { username: uname } })

    // Verify against a dummy hash when the user is unknown so the
    // response time does not reveal whether an account exists.
    const stored = user?.password ?? '$scrypt$16384$8$1$00000000000000000000000000000000$' + '0'.repeat(128)
    const ok = await verifyPassword(password, stored)

    if (!user || !ok) {
      if (user) await logSecurityEvent(user.id, 'login_failed', `Failed login for @${user.username}`)
      // Per-ACCOUNT, and only for FAILED attempts. Keyed on the account
      // being targeted rather than the source address, so the limit still
      // holds when the client IP is unknown or shared by many hosts. It
      // deliberately does not count successes: a bucket that counted them
      // would lock out a player who signs in repeatedly, which is a
      // self-inflicted denial of service.
      const a = checkAnonRate(`${clientIp(req)}#${uname}`, 'login_failed_account', LOGIN_ACCOUNT_LIMIT, LOGIN_WINDOW)
      if (!a.ok) {
        return err(`Too many failed sign-in attempts for this account. Try again in ${a.retryAfterSec}s.`, 429)
      }
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

  // ── change password ──
  // The one capability a player genuinely needs and previously had no way
  // to reach at all: there was no way to change your own password. The
  // current password is required, the new one is held to the same strength
  // rule as registration, and every OTHER session is destroyed so a stolen
  // token cannot outlive the change.
  if (action === 'change_password') {
    const me = await getUserFromRequest(req)
    if (!me) return err('Unauthorized', 401)
    const currentPw = String((body as { currentPassword?: string }).currentPassword ?? '')
    const newPw = String((body as { newPassword?: string }).newPassword ?? '')
    if (!currentPw || !newPw) return err('Current and new password are required')
    if (!(await verifyPassword(currentPw, me.password))) {
      await logSecurityEvent(me.id, 'login_failed', 'Password change rejected: wrong current password')
      return err('Your current password is incorrect', 401)
    }
    const problem = passwordProblem(newPw)
    if (problem) return err(problem)
    if (await verifyPassword(newPw, me.password)) return err('New password must be different from the current one')

    const keep = req.headers.get('x-auth-token') ?? ''
    await db.$transaction([
      db.user.update({ where: { id: me.id }, data: { password: await hashPassword(newPw) } }),
      db.session.deleteMany({ where: { userId: me.id, NOT: { id: keep } } }),
    ])
    await logSecurityEvent(me.id, 'password_changed', 'Password changed; other sessions revoked')
    await db.notification.create({
      data: { userId: me.id, title: '🔐 Password changed', body: 'Your password was changed and all other devices were signed out.' },
    })
    return json({ ok: true })
  }

  // ── sign out everywhere ──
  if (action === 'logout_all') {
    const me = await getUserFromRequest(req)
    if (!me) return err('Unauthorized', 401)
    const removed = await db.session.deleteMany({ where: { userId: me.id } })
    await logSecurityEvent(me.id, 'logout_all', `Revoked ${removed.count} session(s)`)
    return json({ ok: true, revoked: removed.count })
  }

  return err('Unknown action')
}
