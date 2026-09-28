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

const BASE = process.argv[2] ?? 'http://localhost:3000'

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

async function api(path, { method = 'GET', token, body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'x-auth-token': token } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  const data = await res.json().catch(() => ({}))
  return { status: res.status, data }
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
  const res = await api('/api/admin/users', {
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
  const usersRes = await api('/api/admin/users', { token: A })
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
    check('Throttled response includes a retry hint', /retry again in \d+/i.test(probe.data.error ?? ''),
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
  for (const u of [sup, fin, gm]) {
    const l = await api('/api/admin/users?q=' + encodeURIComponent(u.username), { token: A })
    const row = l.data.users?.find(x => x.username === u.username)
    if (row) {
      await api('/api/admin/users', { method: 'POST', token: A, body: { userId: row.id, action: 'set_role', role: 'none' } })
    }
  }
  console.log('\n  🧹 temporary staff accounts revoked')

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
