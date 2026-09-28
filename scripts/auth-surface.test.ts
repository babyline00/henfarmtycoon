// Unit tests for the auth surface added while closing the login-rate-limit
// bypass, plus guards for the invariants those fixes depend on.
//
//   bun test scripts/auth-surface.test.ts

import { test, expect } from 'bun:test'

import {
  hashPassword, verifyPassword, needsRehash, passwordProblem,
  MIN_PASSWORD, makeReferralCode, makeToken,
} from '../src/lib/auth'
import { canonicalUsername } from '../src/app/api/auth/route'

// ── username identity ─────────────────────────────────────────
// SQLite compares TEXT case-sensitively, so folding is the only thing
// standing between "Demo" and "demo" being two accounts.

test('canonicalUsername folds case and trims', () => {
  expect(canonicalUsername('Demo')).toBe('demo')
  expect(canonicalUsername('  DEMO  ')).toBe('demo')
  expect(canonicalUsername('FarmerAli')).toBe('farmerali')
  expect(canonicalUsername('already_lower')).toBe('already_lower')
})

test('canonicalUsername is idempotent', () => {
  for (const raw of ['Demo', ' MiXeD ', 'UPPER']) {
    const once = canonicalUsername(raw)
    expect(canonicalUsername(once)).toBe(once)
  }
})

test('every differently-cased spelling of a name folds to one identity', () => {
  const spellings = ['demo', 'Demo', 'DEMO', 'dEmO', ' demo ', 'Demo ']
  const folded = new Set(spellings.map(canonicalUsername))
  expect(folded.size).toBe(1)
  expect([...folded][0]).toBe('demo')
})

// ── password policy ───────────────────────────────────────────
// The admin reset used to accept any 8 characters while registration
// demanded two character classes. One rule now covers all three doors.

test('passwordProblem enforces the shared minimum length', () => {
  expect(MIN_PASSWORD).toBe(8)
  expect(passwordProblem('short')).toMatch(/at least 8/)
  expect(passwordProblem('')).toMatch(/required/i)
  expect(passwordProblem('a'.repeat(201))).toMatch(/too long/i)
})

test('passwordProblem requires two character classes', () => {
  expect(passwordProblem('alllowercase')).toMatch(/mix/i)
  expect(passwordProblem('ALLUPPERCASE')).toMatch(/mix/i)
  expect(passwordProblem('12345678')).toMatch(/mix/i)
  expect(passwordProblem('!!!!!!!!')).toMatch(/mix/i)
  // two classes is enough
  expect(passwordProblem('abcd1234')).toBeNull()
  expect(passwordProblem('ABCD1234')).toBeNull()
  expect(passwordProblem('Test1234')).toBeNull()
  expect(passwordProblem('a'.repeat(9) + '!')).toBeNull()
})

test('passwordProblem accepts exactly the boundary length', () => {
  // 7 chars with two classes: still rejected, for length.
  expect(passwordProblem('abc1234')).toMatch(/at least 8/)
  // 8 chars with two classes: the shortest accepted password.
  expect(passwordProblem('abcd1234')).toBeNull()
  // 8 chars, one class: rejected for class mix, not length.
  expect(passwordProblem('abcdefgh')).toMatch(/mix/i)
})

test('passwordProblem result is null for every accepted shape', () => {
  for (const pw of ['abcd1234', 'Abcd1234', 'abcdABCD', 'abcd!!!!', 'ABCD1234', 'Passw0rd!']) {
    expect(passwordProblem(pw), `${pw} (${pw.length} chars) should be accepted`).toBeNull()
  }
})

// ── hashing ───────────────────────────────────────────────────

test('scrypt round-trips and is salted per call', async () => {
  const h1 = await hashPassword('Correct123')
  const h2 = await hashPassword('Correct123')
  expect(h1).not.toBe(h2) // different salt => different digest
  expect(await verifyPassword('Correct123', h1)).toBe(true)
  expect(await verifyPassword('Correct123', h2)).toBe(true)
})

test('a wrong password never verifies', async () => {
  const h = await hashPassword('Correct123')
  expect(await verifyPassword('correct123', h)).toBe(false)
  expect(await verifyPassword('Correct124', h)).toBe(false)
  expect(await verifyPassword('', h)).toBe(false)
})

test('a corrupt stored hash fails closed instead of throwing', async () => {
  for (const bad of ['', 'garbage', 'scrypt$1$2$3', 'scrypt$a$b$c$d$e', 'scrypt$99999999$8$1$aa$bb']) {
    expect(await verifyPassword('anything', bad), bad).toBe(false)
  }
})

test('legacy SHA-256 rows still verify and are flagged for rehash', async () => {
  // the exact shape the migration path exists for
  const { createHash } = await import('crypto')
  const legacy = createHash('sha256').update('henfarm::Legacy123').digest('hex')
  expect(await verifyPassword('Legacy123', legacy)).toBe(true)
  expect(await verifyPassword('Wrong123', legacy)).toBe(false)
  expect(needsRehash(legacy)).toBe(true)
  expect(needsRehash(await hashPassword('x'))).toBe(false)
})

test('needsRehash is true for anything that is not a scrypt digest', () => {
  expect(needsRehash('')).toBe(true)
  expect(needsRehash('abc')).toBe(true)
  expect(needsRehash('a'.repeat(64))).toBe(true) // bare sha256 hex
})

// ── tokens / referral codes ───────────────────────────────────

test('makeToken is long and unique', () => {
  const a = makeToken()
  const b = makeToken()
  expect(a).toHaveLength(64) // 32 bytes hex
  expect(a).not.toBe(b)
  expect(a).toMatch(/^[a-f0-9]{64}$/)
})

test('makeReferralCode is uppercase and derived from the username', () => {
  const code = makeReferralCode('farmerjoe')
  expect(code).toMatch(/^FARMER\d{4}$/)
  expect(code).toBe(code.toUpperCase())
})
