import { db } from '@/lib/db'

// ═════════════════════════════════════════════════════════════
// PHASE 16 — Anti-Cheat & Security
//  • server-side rate limiting (sliding window, per user+action)
//  • bot detection heuristics (super-human action cadence)
//  • marketplace price sanity (anti money-laundering / dupe abuse)
//  • security event log + user flagging
// All reward math is computed server-side only (never trust client).
// ═════════════════════════════════════════════════════════════

type Window = { hits: number[] }
const buckets = new Map<string, Window>()

// periodic cleanup to avoid memory growth
let lastSweep = Date.now()
function sweep() {
  const now = Date.now()
  if (now - lastSweep < 60000) return
  lastSweep = now
  for (const [k, w] of buckets) {
    if (w.hits.length === 0 || now - w.hits[w.hits.length - 1] > 300000) buckets.delete(k)
  }
}

export interface RateRule {
  limit: number
  windowMs: number
}

// action-specific rules; default applies to any unmatched action
const RULES: Record<string, RateRule> = {
  collect_hens: { limit: 20, windowMs: 60000 },
  collect_animals: { limit: 20, windowMs: 60000 },
  feed: { limit: 15, windowMs: 60000 },
  buy: { limit: 30, windowMs: 60000 },
  buy_item: { limit: 30, windowMs: 60000 },
  use_item: { limit: 15, windowMs: 60000 },
  sell_eggs: { limit: 20, windowMs: 60000 },
  incubate: { limit: 12, windowMs: 60000 },
  open_egg: { limit: 12, windowMs: 60000 },
  speedup: { limit: 10, windowMs: 60000 },
  breed: { limit: 8, windowMs: 60000 },
  claim_daily: { limit: 3, windowMs: 60000 },
  claim_mission: { limit: 10, windowMs: 60000 },
  claim_level_reward: { limit: 5, windowMs: 60000 },
  claim_vip_daily: { limit: 3, windowMs: 60000 },
  purchase_gems: { limit: 6, windowMs: 60000 },
  purchase_vip: { limit: 3, windowMs: 60000 },
  list_market: { limit: 12, windowMs: 60000 },
  buy_market: { limit: 15, windowMs: 60000 },
  cancel_market: { limit: 12, windowMs: 60000 },
  friend_add: { limit: 8, windowMs: 60000 },
  gift_friend: { limit: 6, windowMs: 60000 },
  clan_donate: { limit: 10, windowMs: 60000 },
  withdraw: { limit: 5, windowMs: 60000 },
  exchange_gems: { limit: 6, windowMs: 60000 },
  // Phase 34 — wallet
  deposit: { limit: 8, windowMs: 300000 }, // max 8 deposit submissions / 5 min
  save_payment_profile: { limit: 5, windowMs: 60000 },
  // Phase 33 — mini games
  mini_start: { limit: 6, windowMs: 60000 },
  mini_finish: { limit: 10, windowMs: 60000 },
  // Phase 25 — support
  ticket_create: { limit: 3, windowMs: 300000 },
  ticket_reply: { limit: 15, windowMs: 60000 },
}
const DEFAULT_RULE: RateRule = { limit: 40, windowMs: 60000 }

// Admin routes move real money, so they get their own tighter budget.
// Kept separate from the player rules: an admin acting on the payout
// queue is not the same trust decision as a player collecting eggs.
const ADMIN_RULES: Record<string, RateRule> = {
  adjust: { limit: 30, windowMs: 60000 },
  // 10/min rather than 5: this is a takeover primitive, so the real
  // controls are the permission gate and the audit log, not this ceiling —
  // and a rate limit does not stop a determined insider anyway. But it
  // does block legitimate incident response, where an admin recovering
  // several locked-out players in a row is exactly the intended use.
  reset_password: { limit: 10, windowMs: 60000 },
  approve: { limit: 40, windowMs: 60000 },
  reject: { limit: 40, windowMs: 60000 },
  hold: { limit: 20, windowMs: 60000 },
  season_payout: { limit: 3, windowMs: 60000 },
  set_role: { limit: 10, windowMs: 60000 },
  broadcast: { limit: 10, windowMs: 60000 },
  save_config: { limit: 30, windowMs: 60000 },
  freeze_farm: { limit: 15, windowMs: 60000 },
  grant_hen: { limit: 30, windowMs: 60000 },
  unflag: { limit: 20, windowMs: 60000 },
  revoke_sessions: { limit: 10, windowMs: 60000 },
}

export function checkAdminRate(adminId: string, action: string): RateResult {
  sweep()
  const rule = ADMIN_RULES[action] ?? { limit: 30, windowMs: 60000 }
  const key = `admin:${adminId}:${action}`
  const now = Date.now()
  const win = buckets.get(key) ?? { hits: [] }
  win.hits = win.hits.filter(t => now - t < rule.windowMs)
  if (win.hits.length >= rule.limit) {
    const oldest = win.hits[0]
    buckets.set(key, win)
    return { ok: false, retryAfterSec: Math.ceil((rule.windowMs - (now - oldest)) / 1000), remaining: 0 }
  }
  win.hits.push(now)
  buckets.set(key, win)
  return { ok: true, retryAfterSec: 0, remaining: rule.limit - win.hits.length }
}

// Unauthenticated abuse guard for login/register, keyed by client
// address because there is no user id to key on yet.
const anonBuckets = new Map<string, number[]>()

export function checkAnonRate(ip: string, action: string, limit: number, windowMs: number): RateResult {
  const now = Date.now()
  const key = `${action}:${ip}`
  const hits = (anonBuckets.get(key) ?? []).filter(t => now - t < windowMs)
  if (hits.length >= limit) {
    anonBuckets.set(key, hits)
    return { ok: false, retryAfterSec: Math.ceil((windowMs - (now - hits[0])) / 1000), remaining: 0 }
  }
  hits.push(now)
  anonBuckets.set(key, hits)
  // bounded sweep so a flood of distinct addresses cannot grow the map forever
  if (anonBuckets.size > 5000) {
    for (const [k, v] of anonBuckets) {
      if (v.length === 0 || now - v[v.length - 1] > windowMs) anonBuckets.delete(k)
    }
  }
  return { ok: true, retryAfterSec: 0, remaining: limit - hits.length }
}

export interface RateResult {
  ok: boolean
  retryAfterSec: number
  remaining: number
}

export function checkRate(userId: string, action: string): RateResult {
  sweep()
  const rule = RULES[action] ?? DEFAULT_RULE
  const key = `${userId}:${action}`
  const now = Date.now()
  const win = buckets.get(key) ?? { hits: [] }
  win.hits = win.hits.filter(t => now - t < rule.windowMs)
  if (win.hits.length >= rule.limit) {
    const oldest = win.hits[0]
    buckets.set(key, win)
    return { ok: false, retryAfterSec: Math.ceil((rule.windowMs - (now - oldest)) / 1000), remaining: 0 }
  }
  win.hits.push(now)
  buckets.set(key, win)
  return { ok: true, retryAfterSec: 0, remaining: rule.limit - win.hits.length }
}

// ── bot detection: track a short window of ALL actions per user ──
const botScan = new Map<string, number[]>()

export async function botCheck(userId: string, action: string): Promise<boolean> {
  // only gameplay actions count toward cadence
  if (!RULES[action]) return false
  const now = Date.now()
  const hits = (botScan.get(userId) ?? []).filter(t => now - t < 60000)
  hits.push(now)
  botScan.set(userId, hits)
  if (hits.length > 90) {
    // super-human cadence: >90 gameplay actions/min
    await logSecurityEvent(userId, 'bot_suspect', `${hits.length} gameplay actions in 60s (action: ${action})`)
    await flagUser(userId, 'Unnatural action cadence (possible bot/automation)')
    return true
  }
  return false
}

export async function logSecurityEvent(userId: string, kind: string, detail: string) {
  try {
    await db.securityEvent.create({ data: { userId, kind, detail } })
  } catch { /* logging must never break gameplay */ }
}

export async function flagUser(userId: string, reason: string) {
  try {
    await db.user.update({
      where: { id: userId },
      data: { flagged: true, flagReason: reason },
    })
  } catch { /* ignore */ }
}

export async function clearFlag(userId: string) {
  await db.user.update({ where: { id: userId }, data: { flagged: false, flagReason: null } })
}

// ── marketplace price sanity (anti-fraud) ────────────────────
// Reference values keep listed prices within a sane band so the
// market can't be used for coin laundering via fake trades.
export const PRICE_FLOOR_PCT = 0.25 // min 25% of reference
export const PRICE_CEIL_PCT = 6 // max 600% of reference

export function referencePrice(itemType: string, subType: string, level = 1): number {
  // lazy import avoidance: use small local tables mirroring shop prices
  const hens: Record<string, number> = { normal: 200, golden: 800, royal: 2500, magic: 8000 }
  const animals: Record<string, number> = { cow: 1500, sheep: 1200, duck: 600, dog: 800, cat: 800, horse: 2000 }
  const eggs: Record<string, number> = { normal: 30, golden: 400, royal: 500, magic: 1200, diamond: 1000, mystery: 250 }
  if (itemType === 'hen') return (hens[subType] ?? 200) + (level - 1) * 50
  if (itemType === 'animal') return animals[subType] ?? 800
  if (itemType === 'item') return 500
  return eggs[subType] ?? 50
}

export function priceSanityOk(price: number, ref: number): boolean {
  if (!Number.isFinite(price) || price < 1) return false
  return price >= Math.round(ref * PRICE_FLOOR_PCT) && price <= Math.round(ref * PRICE_CEIL_PCT)
}

// ── admin permission gates (Phase 16, hardened Phase 35) ──────
// Permissions are split by blast radius, not by screen. A single
// coarse 'users' area used to let a Support Manager mint unlimited
// currency and reset any account's password, so each money- or
// account-takeover-capable action now has its own area.
//
//   super    → everything
//   finance  → money movement only (payouts, deposits, premium
//              payouts, payout destination) + revenue analytics
//   game     → live game configuration, events, player moderation
//   support  → player communication and tickets, no money, no
//              account credentials, no payout destination
export type AdminRole = 'super' | 'finance' | 'game' | 'support'

// read-only areas
export const PERM = {
  STATS: 'stats',
  ANALYTICS: 'analytics',
  SECURITY_VIEW: 'security_view',
  USERS_VIEW: 'users_view',
  TICKETS: 'tickets',
  // money
  WITHDRAWALS: 'withdrawals',
  DEPOSITS: 'deposits',
  PURCHASES: 'purchases',
  PAYMENTS: 'payments',
  // configuration
  CONFIG_GAME: 'config_game',
  CONFIG_MONEY: 'config_money',
  // live game
  EVENTS: 'events',
  BROADCAST: 'broadcast',
  // player moderation
  USERS_BAN: 'users_ban',
  USERS_GIFT: 'users_gift',
  // high-blast-radius, super-only
  USERS_BALANCE: 'users_balance',
  USERS_PASSWORD: 'users_password',
  SECURITY_UNFLAG: 'security_unflag',
} as const

export const ROLE_PERMS: Record<AdminRole, string[]> = {
  super: ['*'],
  finance: [
    PERM.WITHDRAWALS, PERM.DEPOSITS, PERM.PURCHASES, PERM.PAYMENTS,
    PERM.CONFIG_MONEY, PERM.ANALYTICS, PERM.STATS,
  ],
  game: [
    PERM.EVENTS, PERM.CONFIG_GAME, PERM.BROADCAST,
    PERM.USERS_VIEW, PERM.USERS_BAN, PERM.USERS_GIFT,
    PERM.SECURITY_VIEW, PERM.STATS, PERM.ANALYTICS,
  ],
  support: [
    PERM.TICKETS, PERM.BROADCAST, PERM.USERS_VIEW,
    PERM.USERS_BAN, PERM.USERS_GIFT,
  ],
}

// Areas that must only ever be reachable by a named role. Used by the
// admin UI to hide controls the signed-in admin cannot use, instead of
// rendering them enabled behind a "requires Super Admin" label.
export const ROLE_AREAS: Record<AdminRole, string[]> = ROLE_PERMS

export function can(role: string | null | undefined, area: string): boolean {
  // Fail closed. A NULL role is an unbackfilled/legacy admin row and
  // must NOT silently become a wildcard Super Admin.
  if (!role) return false
  const perms = ROLE_PERMS[role as AdminRole]
  if (!perms) return false
  return perms.includes('*') || perms.includes(area)
}

export function isSuper(role: string | null | undefined): boolean {
  return can(role, '*')
}

export function roleLabel(role: string | null | undefined): string {
  switch (role) {
    case 'super': return 'Super Admin'
    case 'finance': return 'Finance Manager'
    case 'game': return 'Game Manager'
    case 'support': return 'Support Manager'
    default: return 'Super Admin'
  }
}
