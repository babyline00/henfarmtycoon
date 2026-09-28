import { randomBytes, scrypt as scryptCb, timingSafeEqual, createHash } from 'crypto'
import { promisify } from 'util'
import { db } from '@/lib/db'
import type { User } from '@prisma/client'

const scrypt = promisify(scryptCb) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
  options: { N: number; r: number; p: number; maxmem: number },
) => Promise<Buffer>

// ── password hashing ───────────────────────────────────────────
// scrypt is memory-hard and ships in Node core, so this adds no
// dependency while still being far stronger than a bare digest.
// Stored format: scrypt$N$r$p$<salt hex>$<hash hex>
const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64, maxmem: 64 * 1024 * 1024 }
const LEGACY_PREFIX = 'henfarm::'

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16)
  const hash = await scrypt(password.normalize('NFKC'), salt, SCRYPT.keylen, SCRYPT)
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString('hex')}$${hash.toString('hex')}`
}

// Constant-time compare that never throws on length mismatch.
function safeEqual(a: Buffer, b: Buffer): boolean {
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  if (!stored) return false
  const candidate = password.normalize('NFKC')

  // legacy accounts: single salted SHA-256, migrated to scrypt on next login
  if (stored.startsWith(LEGACY_PREFIX) || /^[a-f0-9]{64}$/.test(stored)) {
    const legacy = createHash('sha256').update(LEGACY_PREFIX + candidate).digest('hex')
    if (!safeEqual(Buffer.from(legacy, 'hex'), Buffer.from(stored, 'hex'))) return false
    return true
  }

  const parts = stored.split('$')
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false
  const N = Number(parts[1]); const r = Number(parts[2]); const p = Number(parts[3])
  if (!Number.isInteger(N) || !Number.isInteger(r) || !Number.isInteger(p)) return false
  // A corrupt or tampered row must fail closed, never throw into the
  // request handler (which would surface as a 500 instead of a 401).
  if (N < 2 || N > 1_048_576 || r < 1 || r > 32 || p < 1 || p > 16) return false
  let salt: Buffer; let expected: Buffer
  try {
    salt = Buffer.from(parts[4], 'hex')
    expected = Buffer.from(parts[5], 'hex')
  } catch {
    return false
  }
  if (salt.length === 0 || expected.length === 0 || expected.length > 1024) return false
  try {
    const actual = await scrypt(candidate, salt, expected.length, { N, r, p, maxmem: SCRYPT.maxmem })
    return safeEqual(actual, expected)
  } catch {
    return false
  }
}

/** True when a stored hash predates scrypt and should be upgraded after a successful login. */
export function needsRehash(stored: string): boolean {
  return !(stored.startsWith('scrypt$'))
}

// ── password policy ───────────────────────────────────────────
// One rule, used by registration, by a player's own password change, and by
// an admin reset. It lived only in the auth route, so the admin reset
// accepted any 8 characters while registration demanded two character
// classes — the weakest door into an account had the loosest lock.
export const MIN_PASSWORD = 8

export function passwordProblem(pw: string): string | null {
  if (!pw) return 'A password is required'
  if (pw.length < MIN_PASSWORD) return `Password must be at least ${MIN_PASSWORD} characters`
  if (pw.length > 200) return 'Password is too long'
  const classes = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter(r => r.test(pw)).length
  if (classes < 2) return 'Password must mix letters, numbers or symbols (e.g. 2 of 3 classes)'
  return null
}

export function makeToken(): string {
  return randomBytes(32).toString('hex')
}

export function makeReferralCode(username: string): string {
  return `${username.slice(0, 6).toUpperCase()}${Math.floor(1000 + Math.random() * 9000)}`
}

export async function createSession(userId: string): Promise<string> {
  // Opportunistic cleanup. Expired rows were accumulating without bound
  // (372 rows, every one of them dead) because nothing ever deleted them,
  // which slowed the session lookup on every authenticated request and
  // grew the database for no benefit. 1-in-N so the write is not on the
  // hot path for every single login.
  if (Math.random() < 0.05) {
    try {
      await db.session.deleteMany({ where: { expiresAt: { lt: new Date() } } })
    } catch { /* housekeeping must never block a login */ }
  }
  const token = makeToken()
  const expiresAt = new Date(Date.now() + 30 * 86400000)
  await db.session.create({ data: { id: token, userId, expiresAt } })
  return token
}

/**
 * Delete every session for a user except (optionally) the one making the
 * request. Used by the player's own password change and by an admin
 * force-logout, so a compromised token cannot outlive the response to
 * either.
 */
export async function revokeSessions(userId: string, exceptToken?: string): Promise<number> {
  const res = await db.session.deleteMany({
    where: { userId, ...(exceptToken ? { NOT: { id: exceptToken } } : {}) },
  })
  return res.count
}

export async function getUserFromRequest(req: Request): Promise<User | null> {
  const token = req.headers.get('x-auth-token')
  if (!token) return null
  const session = await db.session.findUnique({ where: { id: token } })
  if (!session || session.expiresAt < new Date()) return null
  // Explicit column list. The password hash is only ever needed by the
  // login route, so selecting the whole row dragged it across SQLite on
  // every authenticated request in the app.
  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true, username: true, email: true, password: true, avatar: true,
      farmName: true, coins: true, gems: true, xp: true,
      isAdmin: true, isBlocked: true, referralCode: true, referredBy: true,
      loginStreak: true, lastDailyClaim: true, lastSeenAt: true, createdAt: true,
      vipUntil: true, vipPlan: true, vipLastClaim: true, levelRewardClaimed: true,
      flagged: true, flagReason: true, adminRole: true,
      gameEnergy: true, energyUpdatedAt: true,
      savedAccount: true, savedBank: true, savedTitle: true,
    },
  })
  if (!user || user.isBlocked) return null
  return user
}

export async function requireAdmin(req: Request): Promise<User | null> {
  const user = await getUserFromRequest(req)
  if (!user || !user.isAdmin) return null
  return user
}

export function json(data: unknown, status = 200) {
  return Response.json(data, { status })
}

export function err(message: string, status = 400) {
  return Response.json({ error: message }, { status })
}
