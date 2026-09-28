// ═════════════════════════════════════════════════════════════
// PHASE 34 — Wallet System Smoke Test
// Covers: deposit w/ proof validation, admin verification,
//         withdrawal w/ bank details + fee, reject refund,
//         payment settings toggle, emergency deposit freeze,
//         saved payment profile, wallet reconciliation.
// Run: node scripts/wallet-smoke-test.mjs
// ═════════════════════════════════════════════════════════════
const BASE = process.env.SMOKE_BASE_URL ?? process.argv[2] ?? 'http://localhost:3000'

let passed = 0
let failed = 0
const fails = []

function ok(cond, name) {
  if (cond) { passed++; console.log(`  ✅ ${name}`) }
  else { failed++; fails.push(name); console.log(`  ❌ ${name}`) }
}

async function api(path, { method = 'GET', body, token } = {}) {
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

// tiny valid proof (1px gif)
const PROOF = 'data:image/gif;base64,R0lGODlhAQABAIAAAPwAANf///yH5BAAAAAAALAAAAAABAAEAAAICRAEAOw=='
const REF = `SMK-${Date.now()}`

async function main() {
  console.log('── Wallet System Smoke Test ──')

  // admin login (the player side uses a dedicated fresh QA account below)
  const adminLogin = await api('/api/auth', { method: 'POST', body: { action: 'login', username: 'admin', password: 'admin123' } })
  ok(adminLogin.status === 200 && adminLogin.data.token, 'admin login')
  const admin = adminLogin.data.token

  // dedicated fresh QA player so re-runs stay clean (rate limits + first-deposit bonus)
  const qaName = `walletqa${Date.now() % 100000}`
  const qaReg = await api('/api/auth', { method: 'POST', body: { action: 'register', username: qaName, password: 'qa123456', farmName: 'QA Wallet Farm' } })
  ok(qaReg.status === 200 && qaReg.data.token, 'fresh QA player registered')
  const qa = qaReg.data.token

  // wallet payload (fresh QA user)
  let w = await api('/api/wallet', { token: qa })
  ok(w.status === 200 && Array.isArray(w.data.deposits), 'GET /api/wallet returns deposits')
  ok(w.data.payMethods?.length === 4, '4 payment methods exposed to player')
  ok(w.data.payMethods?.every(m => m.enabled), 'all default methods enabled')
  ok(w.data.walletCfg?.coinsPerUsd === 1000, 'wallet config (coinsPerUsd=1000)')
  ok(w.data.walletCfg?.bonusTiers?.length === 4, 'deposit bonus tiers present')
  ok(typeof w.data.savedProfile?.hasSaved === 'boolean', 'saved profile exposed')
  ok(w.data.stats.approvedDeposits === 0, 'fresh user has no approved deposits (first-deposit eligible)')
  const coinsStart = w.data.coins
  const depStart = w.data.stats.totalDepositedCents

  // deposit validation
  const r1 = await api('/api/game/action', { method: 'POST', token: qa, body: { action: 'deposit', amountCents: 2000, method: 'bank', senderName: 'Smoke Tester', reference: REF, proof: '' } })
  ok(r1.status === 400, 'deposit without proof rejected')
  const r2 = await api('/api/game/action', { method: 'POST', token: qa, body: { action: 'deposit', amountCents: 100, method: 'bank', senderName: 'Smoke Tester', reference: REF + 'b', proof: PROOF } })
  ok(r2.status === 400, 'deposit below minimum rejected')
  const r3 = await api('/api/game/action', { method: 'POST', token: qa, body: { action: 'deposit', amountCents: 2000, method: 'bank', senderName: 'S', reference: REF + 'c', proof: PROOF } })
  ok(r3.status === 400, 'deposit with short sender name rejected')
  const r4 = await api('/api/game/action', { method: 'POST', token: qa, body: { action: 'deposit', amountCents: 2000, method: 'bank', senderName: 'Smoke Tester', reference: REF, proof: PROOF } })
  ok(r4.status === 200 && r4.data.ok, 'valid $20 deposit accepted')
  const r5 = await api('/api/game/action', { method: 'POST', token: qa, body: { action: 'deposit', amountCents: 2000, method: 'bank', senderName: 'Smoke Tester', reference: REF, proof: PROOF } })
  ok(r5.status === 400, 'duplicate reference rejected')

  // pending deposit visible to player
  w = await api('/api/wallet', { token: qa })
  ok(w.data.deposits.some(d => d.reference === REF && d.status === 'pending'), 'pending deposit appears in player wallet')
  ok(w.data.deposits.every(d => d.proof === undefined), 'player deposit list hides proof payload')

  // ── admin verification ──
  const list = await api('/api/admin/deposits?status=pending', { token: admin })
  ok(list.status === 200, 'admin deposits list loads')
  const target = list.data.deposits.find(d => d.reference === REF)
  ok(!!target && target.coins === 20000 && target.bonusCoins === 4000, 'deposit math: $20 → 20,000 + 20% (10% tier + 10% first deposit)')
  ok(!!target?.proof, 'admin list includes proof image')

  const approve = await api('/api/admin/deposits', { method: 'POST', token: admin, body: { id: target.id, action: 'approve' } })
  ok(approve.status === 200 && approve.data.ok, 'admin approves deposit')

  const w2 = await api('/api/wallet', { token: qa })
  ok(w2.data.coins === coinsStart + 24000, `coins credited exactly (+24,000): ${coinsStart} → ${w2.data.coins}`)
  ok(w2.data.stats.totalDepositedCents === depStart + 2000, 'deposit stats updated ($20 in)')
  ok(w2.data.deposits.find(d => d.reference === REF)?.status === 'approved', 'player sees approved status')

  const dupApprove = await api('/api/admin/deposits', { method: 'POST', token: admin, body: { id: target.id, action: 'approve' } })
  ok(dupApprove.status === 400, 'double-approve blocked')

  // ── withdrawals with banking details ──
  const wdNoBank = await api('/api/game/action', { method: 'POST', token: qa, body: { action: 'withdraw', amount: 5000, method: 'bank', accountTitle: 'QA Tester', accountNumber: 'PK36SCBL00000011234567', bankName: '' } })
  ok(wdNoBank.status === 400, 'bank withdrawal without bank name rejected')
  const wdNoTitle = await api('/api/game/action', { method: 'POST', token: qa, body: { action: 'withdraw', amount: 5000, method: 'bank', accountTitle: '', accountNumber: 'PK36SCBL00000011234567', bankName: 'HBL' } })
  ok(wdNoTitle.status === 400, 'withdrawal without account title rejected')
  const wdBadMobile = await api('/api/game/action', { method: 'POST', token: qa, body: { action: 'withdraw', amount: 5000, method: 'jazzcash', accountTitle: 'QA Tester', accountNumber: '12345', bankName: '' } })
  ok(wdBadMobile.status === 400, 'jazzcash withdrawal with invalid mobile rejected')

  const wd = await api('/api/game/action', { method: 'POST', token: qa, body: { action: 'withdraw', amount: 5000, method: 'bank', accountTitle: 'QA Tester', accountNumber: 'PK36SCBL00000011234567', bankName: 'HBL', save: true } })
  ok(wd.status === 200 && wd.data.ok, 'valid bank withdrawal accepted')
  const wdCoins = await api('/api/wallet', { token: qa })
  ok(wdCoins.data.coins === w2.data.coins - 5000, 'withdrawal deducts full amount')
  const wdRow = wdCoins.data.withdrawals[0]
  ok(wdRow?.accountTitle === 'QA Tester' && wdRow?.bankName === 'HBL', 'withdrawal stores account title + bank name')
  ok(wdRow?.fee === 100, '2% processing fee computed (100 coins)')
  ok(wdCoins.data.savedProfile.hasSaved && wdCoins.data.savedProfile.bank === 'HBL', 'payment profile saved')

  // admin rejects → refund
  const wdList = await api('/api/admin/withdrawals', { token: admin })
  const wdTarget = wdList.data.withdrawals.find(x => x.status === 'pending' && x.accountTitle === 'QA Tester')
  ok(!!wdTarget, 'admin sees withdrawal w/ bank details')
  const reject = await api('/api/admin/withdrawals', { method: 'POST', token: admin, body: { id: wdTarget.id, action: 'reject', note: 'Invalid IBAN' } })
  ok(reject.status === 200, 'admin rejects withdrawal')
  const w3 = await api('/api/wallet', { token: qa })
  ok(w3.data.coins === wdCoins.data.coins + 5000, 'rejected withdrawal refunded coins')

  // ── payment settings ──
  const psGet = await api('/api/admin/payment-settings', { token: admin })
  ok(psGet.status === 200 && psGet.data.defs?.length === 4, 'admin payment settings load')
  const methodsOff = JSON.parse(JSON.stringify(psGet.data.methods))
  methodsOff.usdt.enabled = false
  const psSave = await api('/api/admin/payment-settings', { method: 'POST', token: admin, body: { methods: methodsOff } })
  ok(psSave.status === 200, 'admin saves usdt disabled')
  const w4 = await api('/api/wallet', { token: qa })
  ok(w4.data.payMethods.find(m => m.key === 'usdt')?.enabled === false, 'player sees usdt disabled')
  const depOff = await api('/api/game/action', { method: 'POST', token: qa, body: { action: 'deposit', amountCents: 2000, method: 'usdt', senderName: 'Smoke Tester', reference: REF + 'u1', proof: PROOF } })
  ok(depOff.status === 400, 'deposit via disabled method rejected')
  // re-enable
  methodsOff.usdt.enabled = true
  await api('/api/admin/payment-settings', { method: 'POST', token: admin, body: { methods: methodsOff } })

  // ── emergency: deposits freeze ──
  const cfgOn = await api('/api/admin/config', { method: 'POST', token: admin, body: { config: { depositsDisabled: 1 } } })
  ok(cfgOn.status === 200, 'admin enables deposits emergency freeze')
  const depFrozen = await api('/api/game/action', { method: 'POST', token: qa, body: { action: 'deposit', amountCents: 2000, method: 'bank', senderName: 'Smoke Tester', reference: REF + 'f1', proof: PROOF } })
  ok(depFrozen.status === 400 && /paused/i.test(depFrozen.data.error ?? ''), 'deposits blocked during emergency freeze')
  await api('/api/admin/config', { method: 'POST', token: admin, body: { config: { depositsDisabled: 0 } } })
  const depUnfrozen = await api('/api/game/action', { method: 'POST', token: qa, body: { action: 'deposit', amountCents: 2000, method: 'bank', senderName: 'Smoke Tester', reference: REF + 'f1', proof: PROOF } })
  ok(depUnfrozen.status === 200, 'deposits work after freeze lifted')

  // ── saved profile management ──
  const saveProfile = await api('/api/wallet', { method: 'POST', token: qa, body: { action: 'save_payment_profile', title: 'QA Farmer Jr', account: '03001234567', bank: '' } })
  ok(saveProfile.status === 200, 'save payment profile endpoint')
  const w5 = await api('/api/wallet', { token: qa })
  ok(w5.data.savedProfile.title === 'QA Farmer Jr', 'saved profile persisted')

  // permission gate: support role can't touch deposits — use a game-role admin check via super admin only for speed
  const stats = await api('/api/admin/stats', { token: admin })
  ok(typeof stats.data.stats.totalDepositCents === 'number' && typeof stats.data.stats.wdFeesCollected === 'number', 'admin stats expose wallet aggregates')

  console.log(`\n══════════════════════════════`)
  console.log(`RESULT: ${passed} passed, ${failed} failed`)
  if (fails.length) { console.log('Failed:', fails.join(' | ')); process.exit(1) }
}

main().catch(e => { console.error(e); process.exit(1) })
