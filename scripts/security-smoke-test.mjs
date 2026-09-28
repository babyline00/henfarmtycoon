#!/usr/bin/env node
// ═════════════════════════════════════════════════════════════
// Phase 35 — Authorization & Auth Hardening Regression Test
// Run against a live dev server:
//   node scripts/security-smoke-test.mjs [baseUrl]
//
// These assertions cover FAILURE MODES, not just the happy path.
// Every one of them corresponds to a defect found in review:
//   • reset_password reachable by any 'users' holder  → account takeover
//   • adjust reachable by Support                    → unlimited minting
//   • unflag reachable by any admin                  → silences anti-cheat
//   • /api/admin/stats had zero permission checks    → revenue to Support
//   • can() returned true for a null role            → fail-open
//   • payment-settings shared the 'config' area      → payout redirection
//   • money config keys shared the 'config' area     → conversion-rate edit
//   • login had no rate limit                        → unthrottled brute force
//   • SHA-256 password hashing                       → no memory hardness
// ═════════════════════════════════════════════════════════════

const BASE = process.env.SMOKE_BASE_URL ?? process.argv[2] ?? 'http://localhost:3000'

let passed = 0
let failed = 0
const failures = []

function check(name, cond, extra = '') {
  if (cond) {
    passed++
    console.log(`  ✅ ${name}`)
  } else {
    failed++
    failures.push(name)
    console.log(`  ❌ ${name} ${extra}`)
  }
}

async function api(path, { method = 'GET', token, body, headers = {} } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'x-auth-token': token } : {}),
      ...headers,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  const data = await res.json().catch(() => ({}))
  return { status: res.status, data }
}

/**
 * Wait out a 429 using the server's own retry hint.
 *
 * Admin actions are rate limited per admin id, and this suite performs
 * several of them (promote staff, revoke staff) in a single pass, so
 * running it twice in quick succession legitimately hits the ceiling. The
 * limit is working as designed, so the suite waits rather than the limit
 * being loosened. A fixed 5s guess was not enough; the server says exactly
 * how long, so use that.
 */
async function apiRetry(path, opts, tries = 4) {
  let out = await api(path, opts)
  for (let i = 0; out.status === 429 && i < tries; i++) {
    const hint = Number(/in (\d+)s/.exec(out.data?.error ?? '')?.[1] ?? 5)
    await new Promise(r => setTimeout(r, (Number.isFinite(hint) ? hint : 5) * 1000 + 500))
    out = await api(path, opts)
  }
  return out
}

const stamp = () => Date.now().toString().slice(-7)
const uniq = (p) => `${p}${stamp()}`

async function registerPlayer(prefix) {
  const username = uniq(prefix).slice(0, 20)
  const res = await api('/api/auth', {
    method: 'POST',
    body: { action: 'register', username, password: 'Testpass123', farmName: 'Audit Farm' },
  })
  if (res.status !== 200) throw new Error(`register ${username} failed: ${JSON.stringify(res.data)}`)
  return { username, token: res.data.token }
}

/** Promote a player to a staff role using the super-admin token. */
async function makeStaff(adminToken, username, role) {
  const list = await api('/api/admin/users?q=' + encodeURIComponent(username), { token: adminToken })
  const row = list.data.users?.find(u => u.username === username)
  if (!row) throw new Error(`could not find ${username} in admin search`)
  const res = await apiRetry('/api/admin/users', {
    method: 'POST', token: adminToken,
    body: { userId: row.id, action: 'set_role', role },
  })
  if (res.status !== 200) throw new Error(`set_role ${username}→${role} failed: ${JSON.stringify(res.data)}`)
  return row.id
}

async function main() {
  console.log(`\n🔐 HenFarmTycoon security regression → ${BASE}\n`)

  // ── super admin ──
  const adminLogin = await api('/api/auth', {
    method: 'POST', body: { action: 'login', username: 'admin', password: 'admin123' },
  })
  check('Super admin can log in (legacy SHA-256 hash verified + upgraded)', adminLogin.status === 200 && !!adminLogin.data.token,
    JSON.stringify(adminLogin.data))
  if (adminLogin.status !== 200) {
    console.log('\nCannot continue without an admin session.\n')
    return
  }
  const A = adminLogin.data.token

  // Legacy admin rows must have been backfilled, otherwise can() now
  // fails closed and the operator is locked out of their own console.
  // Query by name: the unfiltered list is capped at the newest 60 users,
  // so `admin` scrolls out of it as soon as the suite is re-run.
  const usersRes = await api('/api/admin/users?q=admin', { token: A })
  const adminRow = usersRes.data.users?.find(u => u.username === 'admin')
  check('Seeded admin has an explicit adminRole (no null-role lockout)', adminRow?.adminRole === 'super', `got ${adminRow?.adminRole}`)

  // ═══ 1. the backdoor ═══
  console.log('\n  ── Support Manager: must not reach account or money primitives')
  const sup = await registerPlayer('sup')
  await makeStaff(A, sup.username, 'support')
  const victim = await registerPlayer('vic')

  const supList = await api('/api/admin/users', { token: sup.token })
  check('Support CAN list users (users_view)', supList.status === 200, `status ${supList.status}`)

  const vIdSupport = supList.data.users?.find(u => u.username === victim.username)?.id
  check('Support can resolve the victim user id (target exists)', !!vIdSupport)

  const supReset = await api('/api/admin/users', {
    method: 'POST', token: sup.token,
    body: { userId: vIdSupport, action: 'reset_password', newPassword: 'Pwned12345' },
  })
  check('Support BLOCKED from reset_password (was full account takeover)', supReset.status === 403,
    `status ${supReset.status} ${JSON.stringify(supReset.data)}`)

  const supAdjust = await api('/api/admin/users', {
    method: 'POST', token: sup.token,
    body: { userId: vIdSupport, action: 'adjust', coins: 999999 },
  })
  check('Support BLOCKED from adjust (was unlimited minting)', supAdjust.status === 403,
    `status ${supAdjust.status} ${JSON.stringify(supAdjust.data)}`)

  const supUnflag = await api('/api/admin/users', {
    method: 'POST', token: sup.token,
    body: { userId: vIdSupport, action: 'unflag' },
  })
  check('Support BLOCKED from unflag (silences anti-cheat)', supUnflag.status === 403, `status ${supUnflag.status}`)

  const supStats = await api('/api/admin/stats', { token: sup.token })
  check('Support BLOCKED from stats (revenue/coins-in-circulation)', supStats.status === 403, `status ${supStats.status}`)

  const supAnalytics = await api('/api/admin/analytics', { token: sup.token })
  check('Support BLOCKED from analytics (revenue series, top spenders)', supAnalytics.status === 403, `status ${supAnalytics.status}`)

  const supWithdrawals = await api('/api/admin/withdrawals', { token: sup.token })
  check('Support BLOCKED from withdrawal payout queue', supWithdrawals.status === 403, `status ${supWithdrawals.status}`)

  const supDeposits = await api('/api/admin/deposits', { token: sup.token })
  check('Support BLOCKED from deposit approval', supDeposits.status === 403, `status ${supDeposits.status}`)

  const supTickets = await api('/api/admin/support', { token: sup.token })
  check('Support CAN open the ticket queue (tickets)', supTickets.status === 200, `status ${supTickets.status}`)

  // victim password must be untouched by the blocked attempts
  const victimLogin = await api('/api/auth', {
    method: 'POST', body: { action: 'login', username: victim.username, password: 'Testpass123' },
  })
  check('Victim account still logs in with original password (no takeover)', victimLogin.status === 200,
    `status ${victimLogin.status}`)

  // ═══ 2. finance vs game separation ═══
  console.log('\n  ── Finance Manager: money routes only, no payout redirection')
  const fin = await registerPlayer('fin')
  await makeStaff(A, fin.username, 'finance')

  const finWd = await api('/api/admin/withdrawals', { token: fin.token })
  check('Finance CAN view withdrawal payouts', finWd.status === 200, `status ${finWd.status}`)

  const finPay = await api('/api/admin/payment-settings', { token: fin.token })
  check('Finance CAN view payment destination', finPay.status === 200, `status ${finPay.status}`)

  const finEvents = await api('/api/admin/events', { method: 'POST', token: fin.token, body: { title: 'x' } })
  check('Finance BLOCKED from creating events', finEvents.status === 403, `status ${finEvents.status}`)

  console.log('\n  ── Game Manager: no money, no payout destination')
  const gm = await registerPlayer('gmg')
  await makeStaff(A, gm.username, 'game')

  const gmPay = await api('/api/admin/payment-settings', {
    method: 'POST', token: gm.token, body: { methods: { bank: { enabled: false } } },
  })
  check('Game BLOCKED from editing payment destination (payout redirection)', gmPay.status === 403,
    `status ${gmPay.status} ${JSON.stringify(gmPay.data)}`)

  const gmWd = await api('/api/admin/withdrawals', { token: gm.token })
  check('Game BLOCKED from withdrawal payouts', gmWd.status === 403, `status ${gmWd.status}`)

  const gmStats = await api('/api/admin/stats', { token: gm.token })
  check('Game CAN view dashboard stats', gmStats.status === 200, `status ${gmStats.status}`)

  // game role may tweak gameplay knobs but not the coin conversion rate
  const gmCfg = await api('/api/admin/config', { token: gm.token })
  check('Game CAN read config with an editable-key allow-list', gmCfg.status === 200 && Array.isArray(gmCfg.data.editable),
    `status ${gmCfg.status}`)
  const editable = gmCfg.data.editable ?? []
  check('Editable list EXCLUDES money keys (coinsPerUsd/wdFeePct/...)',
    !editable.includes('coinsPerUsd') && !editable.includes('wdFeePct') && !editable.includes('withdrawalMin'),
    `got [${editable.slice(0, 8)}]`)
  check('Editable list still INCLUDES gameplay keys (globalProduction)', editable.includes('globalProduction'),
    `got [${editable.slice(0, 8)}]`)

  // A money-ONLY write must be refused outright.
  const gmMoneyOnly = await api('/api/admin/config', {
    method: 'POST', token: gm.token, body: { config: { coinsPerUsd: 999999 } },
  })
  check('Game REFUSED a money-only config write', gmMoneyOnly.status === 403,
    `status ${gmMoneyOnly.status} ${JSON.stringify(gmMoneyOnly.data)}`)

  // A mixed write is a partial success: the gameplay key lands, the money
  // key does not, and the refusal is reported back rather than hidden.
  const gmMixed = await api('/api/admin/config', {
    method: 'POST', token: gm.token, body: { config: { coinsPerUsd: 999999, globalProduction: 110 } },
  })
  check('Game mixed config write saves the gameplay key only', gmMixed.status === 200,
    `status ${gmMixed.status} ${JSON.stringify(gmMixed.data)}`)
  check('Game is told which key was refused', String(gmMixed.data.warning ?? '').includes('coinsPerUsd'),
    `warning=${gmMixed.data.warning}`)

  // confirm the refused write really did not land
  const cfgAfter = await api('/api/admin/config', { token: A })
  check('Refused money key was not persisted', cfgAfter.data.config?.coinsPerUsd !== '999999',
    `coinsPerUsd=${cfgAfter.data.config?.coinsPerUsd}`)

  // ═══ 3. super admin retains full power, with bounds ═══
  console.log('\n  ── Super Admin: full access, bounded amounts')
  const vList = await api('/api/admin/users?q=' + encodeURIComponent(victim.username), { token: A })
  const vId = vList.data.users.find(u => u.username === victim.username).id

  const bigAdjust = await api('/api/admin/users', {
    method: 'POST', token: A, body: { userId: vId, action: 'adjust', coins: 99_999_999 },
  })
  check('Super adjust is capped at 1,000,000', bigAdjust.status === 400, `status ${bigAdjust.status}`)

  const negAdjust = await api('/api/admin/users', {
    method: 'POST', token: A, body: { userId: vId, action: 'adjust', coins: -99_999_999 },
  })
  check('Super cannot drive a balance negative', negAdjust.status === 400, `status ${negAdjust.status}`)

  const okAdjust = await api('/api/admin/users', {
    method: 'POST', token: A, body: { userId: vId, action: 'adjust', coins: 50 },
  })
  check('Super CAN adjust a valid amount', okAdjust.status === 200, `status ${okAdjust.status}`)

  // recovery primitive still works, for Super only, and is audited
  const supReset2 = await api('/api/admin/users', {
    method: 'POST', token: sup.token, body: { userId: vId, action: 'reset_password', newPassword: 'Whatever123' },
  })
  check('Support still BLOCKED from reset_password after promotion', supReset2.status === 403, `status ${supReset2.status}`)

  const adminLogs = await api('/api/admin/security', { token: A })
  check('Super CAN read the security/audit surface', adminLogs.status === 200, `status ${adminLogs.status}`)

  // ═══ 4. password policy + hashing ═══
  console.log('\n  ── Password policy and hashing')
  const weak = await api('/api/auth', {
    method: 'POST', body: { action: 'register', username: uniq('weak').slice(0, 20), password: '1234', farmName: 'F' },
  })
  check('Registration rejects a 4-char password', weak.status === 400, `status ${weak.status}`)

  const weak2 = await api('/api/auth', {
    method: 'POST', body: { action: 'register', username: uniq('wkw').slice(0, 20), password: 'aaaaaaaa', farmName: 'F' },
  })
  check('Registration rejects a single-class password', weak2.status === 400, `status ${weak2.status}`)

  const good = await registerPlayer('pwok')
  check('Registration accepts a strong password', !!good.token)

  // ═══ 4b. one password policy on every door ═══
  // The admin reset used to accept any 8 characters while registration
  // demanded two character classes — the weakest door had the loosest lock.
  console.log('\n  ── One password policy everywhere')
  const resetV = await registerPlayer('pv')
  const pvList = await api('/api/admin/users?q=' + encodeURIComponent(resetV.username), { token: A })
  const pvId = pvList.data.users.find(u => u.username === resetV.username).id

  const weakReset = await api('/api/admin/users', {
    method: 'POST', token: A, body: { userId: pvId, action: 'reset_password', newPassword: 'aaaaaaaa' },
  })
  check('Admin reset rejects a single-class password (same rule as register)', weakReset.status === 400,
    `status ${weakReset.status} ${JSON.stringify(weakReset.data)}`)

  const okReset = await api('/api/admin/users', {
    method: 'POST', token: A, body: { userId: pvId, action: 'reset_password', newPassword: 'Recovery123' },
  })
  check('Admin reset accepts a strong password', okReset.status === 200, `status ${okReset.status}`)

  // A reset that does not kill the old sessions is not a recovery.
  const afterReset = await api('/api/game/state', { token: resetV.token })
  check('Admin reset revokes the target\'s existing sessions', afterReset.status === 401,
    `status ${afterReset.status}`)
  const oldPw = await api('/api/auth', {
    method: 'POST', body: { action: 'login', username: resetV.username, password: 'Testpass123' },
  })
  check('Old password no longer works after an admin reset', oldPw.status === 401, `status ${oldPw.status}`)
  const newPw = await api('/api/auth', {
    method: 'POST', body: { action: 'login', username: resetV.username, password: 'Recovery123' },
  })
  check('New password works after an admin reset', newPw.status === 200, `status ${newPw.status}`)

  // ═══ 4c. session revocation ═══
  console.log('\n  ── Session revocation')
  const rev = await registerPlayer('rv')
  const second = await api('/api/auth', {
    method: 'POST', body: { action: 'login', username: rev.username, password: 'Testpass123' },
  })
  check('Second device gets a session', second.status === 200 && !!second.data.token, `status ${second.status}`)
  const rvList = await api('/api/admin/users?q=' + encodeURIComponent(rev.username), { token: A })
  const rvId = rvList.data.users.find(u => u.username === rev.username).id

  const supRevoke = await api('/api/admin/users', {
    method: 'POST', token: sup.token, body: { userId: rvId, action: 'revoke_sessions' },
  })
  check('Support BLOCKED from revoking sessions', supRevoke.status === 403, `status ${supRevoke.status}`)

  const okRevoke = await api('/api/admin/users', {
    method: 'POST', token: A, body: { userId: rvId, action: 'revoke_sessions' },
  })
  check('Super CAN revoke a user\'s sessions', okRevoke.status === 200, `status ${okRevoke.status}`)
  const deadSession = await api('/api/game/state', { token: second.data.token })
  check('Revoked token no longer authenticates', deadSession.status === 401, `status ${deadSession.status}`)

  // ═══ 4d. player can change their own password ═══
  console.log('\n ── Player password change')
  const chg = await registerPlayer('chg')
  const noAuth = await api('/api/auth', {
    method: 'POST', body: { action: 'change_password', currentPassword: 'Testpass123', newPassword: 'Brandnew123' },
  })
  check('Password change requires a session', noAuth.status === 401, `status ${noAuth.status}`)

  const wrongCur = await api('/api/auth', {
    method: 'POST', token: chg.token, body: { action: 'change_password', currentPassword: 'Wrongpass123', newPassword: 'Brandnew123' },
  })
  check('Password change rejects a wrong current password', wrongCur.status === 401, `status ${wrongCur.status}`)

  const weakNew = await api('/api/auth', {
    method: 'POST', token: chg.token, body: { action: 'change_password', currentPassword: 'Testpass123', newPassword: 'aaaaaaaa' },
  })
  check('Password change enforces the strength policy', weakNew.status === 400, `status ${weakNew.status}`)

  const samePw = await api('/api/auth', {
    method: 'POST', token: chg.token, body: { action: 'change_password', currentPassword: 'Testpass123', newPassword: 'Testpass123' },
  })
  check('Password change refuses to reuse the current password', samePw.status === 400, `status ${samePw.status}`)

  // a second device must be killed by the change, and the changer survives
  const chgSecond = await api('/api/auth', {
    method: 'POST', body: { action: 'login', username: chg.username, password: 'Testpass123' },
  })
  const okChange = await api('/api/auth', {
    method: 'POST', token: chg.token, body: { action: 'change_password', currentPassword: 'Testpass123', newPassword: 'Brandnew123' },
  })
  check('Player CAN change their own password', okChange.status === 200, `status ${okChange.status} ${JSON.stringify(okChange.data)}`)
  const killedOther = await api('/api/game/state', { token: chgSecond.data.token })
  check('Changing the password kills other sessions', killedOther.status === 401, `status ${killedOther.status}`)
  const selfAlive = await api('/api/game/state', { token: chg.token })
  check('The changing session stays alive', selfAlive.status === 200, `status ${selfAlive.status}`)

  const oldChg = await api('/api/auth', {
    method: 'POST', body: { action: 'login', username: chg.username, password: 'Testpass123' },
  })
  check('Old password rejected after a self-service change', oldChg.status === 401, `status ${oldChg.status}`)

  const allOut = await api('/api/auth', { method: 'POST', token: chg.token, body: { action: 'logout_all' } })
  check('Sign out everywhere succeeds', allOut.status === 200, `status ${allOut.status}`)
  const afterAll = await api('/api/game/state', { token: chg.token })
  check('Sign out everywhere ends the current session too', afterAll.status === 401, `status ${afterAll.status}`)

  // ═══ 4e. username identity ═══
  // SQLite compares TEXT case-sensitively, so without folding "Demo" and
  // "demo" were two accounts with two passwords.
  console.log('\n  ── Username identity')
  const mixed = uniq('case').slice(0, 20)
  const reg1 = await api('/api/auth', {
    method: 'POST', body: { action: 'register', username: mixed, password: 'Testpass123', farmName: 'A' },
  })
  check('Registration stores a case-folded username', reg1.status === 200 && reg1.data.username === mixed.toLowerCase(),
    `got ${reg1.data?.username} want ${mixed.toLowerCase()}`)

  const dupe = await api('/api/auth', {
    method: 'POST', body: { action: 'register', username: mixed.toUpperCase(), password: 'Testpass123', farmName: 'B' },
  })
  check('A differently-cased duplicate is rejected', dupe.status === 400 && /taken/i.test(dupe.data.error ?? ''),
    `status ${dupe.status} ${JSON.stringify(dupe.data)}`)

  const upperLogin = await api('/api/auth', {
    method: 'POST', body: { action: 'login', username: mixed.toUpperCase(), password: 'Testpass123' },
  })
  check('Login is case-insensitive for the same identity', upperLogin.status === 200, `status ${upperLogin.status}`)

  // ═══ 4f. login rate limit cannot be spoofed away ═══
  // X-Forwarded-For used to be trusted unconditionally, so a fresh header
  // per request gave unlimited login attempts and the brute-force limit
  // never fired. It is now only read when TRUST_PROXY=1.
  console.log('\n  ── Login rate limiting vs header spoofing')
  const spoofTarget = uniq('atk').slice(0, 20)
  let sawRateLimit = false
  const codes = []
  for (let i = 0; i < 12; i++) {
    const res = await api('/api/auth', {
      method: 'POST',
      body: { action: 'login', username: spoofTarget, password: `wrong${i}` },
      // a fresh forwarded address on every single attempt
      headers: { 'x-forwarded-for': `203.0.113.${i}` },
    })
    codes.push(res.status)
    if (res.status === 429) { sawRateLimit = true; break }
  }
  check('Spoofing X-Forwarded-For does not buy unlimited attempts', sawRateLimit,
    `codes: ${codes.join(',')}`)

  const wrong = await api('/api/auth', {
    method: 'POST', body: { action: 'login', username: good.username, password: 'Wrongpass123' },
  })
  check('Wrong password is rejected with 401', wrong.status === 401, `status ${wrong.status}`)

  const unknown = await api('/api/auth', {
    method: 'POST', body: { action: 'login', username: 'definitely__nope__9999', password: 'Testpass123' },
  })
  check('Unknown user also returns 401 (no user enumeration)', unknown.status === 401, `status ${unknown.status}`)

  // ═══ 5. brute force throttle ═══
  console.log('\n  ── Login abuse limit')
  // The effective ceiling is server-side config (AUTH_LOGIN_RATE), which
  // the test process cannot read. So probe for it: hammer until a 429
  // appears, within a bounded budget, and report the threshold found.
  // Exact boundary behaviour (window refill, per-IP isolation) is
  // covered precisely by scripts/auth.test.ts.
  const BUDGET = 40
  let throttledAt = 0
  for (let i = 1; i <= BUDGET; i++) {
    const r = await api('/api/auth', {
      method: 'POST', body: { action: 'login', username: good.username, password: `guess${i}x` },
    })
    if (r.status === 429) { throttledAt = i; break }
  }
  if (throttledAt) {
    check(`Login rate limit engages (429 after ${throttledAt} failed attempts)`, true)
  } else {
    console.log(`     ⏭  no 429 within ${BUDGET} attempts — server limit is configured higher than the probe budget`)
    console.log('        (expected while .env raises AUTH_LOGIN_RATE for the other suites)')
    console.log('        → exact boundary assertions live in `bun test scripts/auth.test.ts`')
  }
  // whatever the ceiling is, a throttled client must be told to wait
  const probe = await api('/api/auth', {
    method: 'POST', body: { action: 'login', username: good.username, password: 'guess429' },
  })
  if (probe.status === 429) {
    // The requirement is that a throttled client is told how long to wait,
    // not that the message uses one exact phrasing.
    check('Throttled response includes a retry hint', /\b\d+\s*s(ec)?\b/.test(probe.data.error ?? ''),
      `error=${probe.data.error}`)
  }

  // ═══ 6. non-admin isolation ═══
  console.log('\n  ── Player cannot reach any admin surface')
  const adminRoutes = ['/api/admin/stats', '/api/admin/users', '/api/admin/withdrawals',
    '/api/admin/deposits', '/api/admin/analytics', '/api/admin/security',
    '/api/admin/payment-settings', '/api/admin/support', '/api/admin/events', '/api/admin/minigames']
  let leaks = []
  for (const route of adminRoutes) {
    const r = await api(route, { token: victim.token })
    if (r.status !== 401 && r.status !== 403) leaks.push(`${route}→${r.status}`)
  }
  check('All 10 admin GET routes reject a normal player', leaks.length === 0, `leaked: ${leaks.join(', ')}`)

  const playerPost = await api('/api/admin/users', {
    method: 'POST', token: victim.token, body: { userId: vId, action: 'adjust', coins: 1000 },
  })
  check('Player cannot POST to an admin route', playerPost.status === 401 || playerPost.status === 403,
    `status ${playerPost.status}`)

  // ── cleanup: revoke the temporary staff accounts ──
  // Hygiene, not an assertion. If the set_role ceiling is still in force the
  // revoke waits it out, and if it cannot, the run is still a pass — these
  // are throwaway accounts and leaving one promoted is not a security
  // finding about the product.
  let revoked = 0
  for (const u of [sup, fin, gm]) {
    const l = await api('/api/admin/users?q=' + encodeURIComponent(u.username), { token: A })
    const row = l.data.users?.find(x => x.username === u.username)
    if (!row) continue
    const res = await apiRetry('/api/admin/users', {
      method: 'POST', token: A, body: { userId: row.id, action: 'set_role', role: 'none' },
    }, 2)
    if (res.status === 200) revoked++
  }
  console.log(`\n  🧹 temporary staff accounts revoked: ${revoked}/3`)

  console.log(`\n${'═'.repeat(54)}`)
  console.log(`RESULT: ${passed} passed, ${failed} failed`)
  if (failed) {
    console.log(`\nFailures:\n${failures.map(f => `  • ${f}`).join('\n')}\n`)
    process.exitCode = 1
  } else {
    console.log('🛡️  All authorization + auth hardening checks passed\n')
  }
}

main().catch(e => { console.error('\n💥 security test crashed:', e); process.exitCode = 1 })
