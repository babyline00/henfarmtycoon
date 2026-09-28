// ═════════════════════════════════════════════════════════════
// Phase 35 — unit tests for the auth/security primitives.
//
//   bun test scripts/auth.test.ts
//
// These cover the pieces that HTTP-level smoke tests cannot reach
// precisely: hash format, tamper resistance, legacy migration, and
// the sliding-window limiter's exact boundary behaviour.
// ═════════════════════════════════════════════════════════════
import { test, expect } from 'bun:test'
import { hashPassword, verifyPassword, needsRehash } from '../src/lib/auth'
import { checkAnonRate, checkAdminRate, can, isSuper, priceSanityOk } from '../src/lib/security'

test('hashPassword produces a self-describing scrypt digest, not a bare hash', async () => {
  const h = await hashPassword('correct horse battery staple')
  expect(h.startsWith('scrypt$')).toBe(true)
  // format: scrypt$N$r$p$salt$hash  → 6 fields
  expect(h.split('$').length).toBe(6)
  // must NOT be a plain 64-char sha256 hex string
  expect(/^[a-f0-9]{64}$/.test(h)).toBe(false)
})

test('the same password hashes differently every time (per-hash salt)', async () => {
  const a = await hashPassword('same-password')
  const b = await hashPassword('same-password')
  expect(a).not.toBe(b)
  expect(await verifyPassword('same-password', a)).toBe(true)
  expect(await verifyPassword('same-password', b)).toBe(true)
})

test('verifyPassword accepts the right password and rejects the wrong one', async () => {
  const h = await hashPassword('MyRealPassword1!')
  expect(await verifyPassword('MyRealPassword1!', h)).toBe(true)
  expect(await verifyPassword('myrealpassword1!', h)).toBe(false)
  expect(await verifyPassword('MyRealPassword1! ', h)).toBe(false)
  expect(await verifyPassword('', h)).toBe(false)
})

test('verifyPassword survives a malformed or hostile stored value', async () => {
  for (const bad of ['', 'null', 'scrypt$', 'scrypt$a$b$c$d$e', 'scrypt$1$2$3$zz$yy', 'scrypt$99999999$8$1$00$00']) {
    expect(await verifyPassword('anything', bad)).toBe(false)
  }
})

test('legacy SHA-256 rows still verify, and are flagged for rehash', async () => {
  // matches the pre-Phase-35 format: sha256("henfarm::" + password)
  const { createHash } = await import('crypto')
  const legacy = createHash('sha256').update('henfarm::oldpass123').digest('hex')
  expect(await verifyPassword('oldpass123', legacy)).toBe(true)
  expect(await verifyPassword('wrongpass123', legacy)).toBe(false)
  expect(needsRehash(legacy)).toBe(true)
  expect(needsRehash(await hashPassword('x'))).toBe(false)
})

test('a scrypt hash from one user never validates against another salt', async () => {
  const a = await hashPassword('alpha')
  const b = await hashPassword('beta')
  expect(await verifyPassword('alpha', b)).toBe(false)
  expect(await verifyPassword('beta', a)).toBe(false)
})

test('checkAnonRate allows up to the limit then blocks, and recovers after the window', async () => {
  const ip = '10.0.0.1'
  const limit = 3
  const window = 60_000
  expect(checkAnonRate(ip, 'login', limit, window).ok).toBe(true)  // 1
  expect(checkAnonRate(ip, 'login', limit, window).ok).toBe(true)  // 2
  expect(checkAnonRate(ip, 'login', limit, window).ok).toBe(true)  // 3
  const blocked = checkAnonRate(ip, 'login', limit, window)        // 4 → denied
  expect(blocked.ok).toBe(false)
  expect(blocked.retryAfterSec).toBeGreaterThan(0)
  // a different action key is counted independently
  expect(checkAnonRate(ip, 'register', limit, window).ok).toBe(true)
  // a different address is independent too
  expect(checkAnonRate('10.0.0.2', 'login', limit, window).ok).toBe(true)

  // once the sliding window has genuinely elapsed, the bucket refills
  const shortIp = '10.0.0.3'
  expect(checkAnonRate(shortIp, 'login', 1, 30).ok).toBe(true)
  expect(checkAnonRate(shortIp, 'login', 1, 30).ok).toBe(false)
  await new Promise(r => setTimeout(r, 50))
  expect(checkAnonRate(shortIp, 'login', 1, 30).ok).toBe(true)
})

test('checkAdminRate throttles repeated money actions', () => {
  const id = 'admin-1'
  for (let i = 0; i < 3; i++) expect(checkAdminRate(id, 'season_payout').ok).toBe(true)
  expect(checkAdminRate(id, 'season_payout').ok).toBe(false)
  // separate budget per action
  expect(checkAdminRate(id, 'adjust').ok).toBe(true)
})

test('can() fails closed for a missing, null or unknown role', () => {
  // The pre-Phase-35 bug: `role ?? 'super'` turned any NULL-role admin
  // into a wildcard Super Admin.
  expect(can(null, 'withdrawals')).toBe(false)
  expect(can(undefined, 'withdrawals')).toBe(false)
  expect(can('', 'withdrawals')).toBe(false)
  expect(can('super', 'withdrawals')).toBe(true)
  expect(isSuper(null)).toBe(false)
  expect(isSuper('super')).toBe(true)
  expect(isSuper('support')).toBe(false)
})

test('a support manager cannot reach money or credential primitives', () => {
  expect(can('support', 'withdrawals')).toBe(false)
  expect(can('support', 'deposits')).toBe(false)
  expect(can('support', 'purchases')).toBe(false)
  expect(can('support', 'payments')).toBe(false)
  expect(can('support', 'config_money')).toBe(false)
  expect(can('support', 'users_balance')).toBe(false)
  expect(can('support', 'users_password')).toBe(false)
  expect(can('support', 'security_unflag')).toBe(false)
  expect(can('support', 'analytics')).toBe(false)
  // but support work still works
  expect(can('support', 'tickets')).toBe(true)
  expect(can('support', 'users_view')).toBe(true)
  expect(can('support', 'broadcast')).toBe(true)
})

test('a game manager cannot move money', () => {
  expect(can('game', 'events')).toBe(true)
  expect(can('game', 'config_game')).toBe(true)
  expect(can('game', 'withdrawals')).toBe(false)
  expect(can('game', 'payments')).toBe(false)
  expect(can('game', 'config_money')).toBe(false)
  expect(can('game', 'purchases')).toBe(false)
  expect(can('game', 'users_password')).toBe(false)
})

test('a finance manager cannot edit the live game or grant items', () => {
  expect(can('finance', 'withdrawals')).toBe(true)
  expect(can('finance', 'deposits')).toBe(true)
  expect(can('finance', 'config_money')).toBe(true)
  expect(can('finance', 'analytics')).toBe(true)
  expect(can('finance', 'events')).toBe(false)
  expect(can('finance', 'config_game')).toBe(false)
  expect(can('finance', 'users_gift')).toBe(false)
})

test('priceSanityOk rejects non-numeric, zero and out-of-band prices', () => {
  expect(priceSanityOk(100, 100)).toBe(true)
  expect(priceSanityOk(0, 100)).toBe(false)
  expect(priceSanityOk(-5, 100)).toBe(false)
  expect(priceSanityOk(NaN, 100)).toBe(false)
  expect(priceSanityOk(Infinity, 100)).toBe(false)
  // 25% floor / 600% ceiling
  expect(priceSanityOk(25, 100)).toBe(true)
  expect(priceSanityOk(24, 100)).toBe(false)
  expect(priceSanityOk(600, 100)).toBe(true)
  expect(priceSanityOk(601, 100)).toBe(false)
})
