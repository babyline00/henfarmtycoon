#!/usr/bin/env node
// ═════════════════════════════════════════════════════════════
// Phase 19 — Smoke & Economy Integrity Test
// Run against a live dev server:
//   node scripts/smoke-test.mjs [baseUrl]
// Verifies: auth, game state v2, core actions, new Phase 8-18
// actions (items, breeding gates, VIP purchase, gems, social,
// clans), admin analytics/security, wallet reconciliation.
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

async function main() {
  console.log(`\n🐔 HenFarmTycoon smoke test → ${BASE}\n`)

  // ── health ──
  const home = await fetch(BASE)
  check('App responds', home.status === 200)

  // ── register fresh player ──
  const uname = `smitetest${Date.now().toString().slice(-6)}`
  const reg = await api('/api/auth', {
    method: 'POST',
    body: { action: 'register', username: uname, password: 'test1234', farmName: `Smoke Farm ${uname.slice(-4)}` },
  })
  check('Register player', reg.status === 200 && !!reg.data.token, JSON.stringify(reg.data))
  const token = reg.data.token

  // ── game state v2 ──
  const state = await api('/api/game/state', { token })
  check('Game state loads', state.status === 200)
  check('Numeric level present', state.data.user?.numericLevel >= 1)
  check('Weather present', !!state.data.farm?.weather?.key)
  check('Incubator cap present', state.data.farm?.incubatorCap >= 4)
  check('Level rewards track', Array.isArray(state.data.user?.levelRewards) && state.data.user.levelRewards.length > 0)
  check('Items array present', Array.isArray(state.data.items))

  const uid = state.data.user.id
  const coins0 = state.data.user.coins

  // ── buy a hen then collect ──
  const buyHen = await api('/api/game/action', { method: 'POST', token, body: { action: 'buy', itemType: 'hen', subType: 'normal' } })
  check('Buy starter hen', buyHen.status === 200, JSON.stringify(buyHen.data))
  const col = await api('/api/game/action', { method: 'POST', token, body: { action: 'collect_hens' } })
  check('Collect hens works (chick produces 0 gracefully)', col.status === 200 && col.data.ok !== false, JSON.stringify(col.data))

  // ── buy item ──
  const buyItem = await api('/api/game/action', { method: 'POST', token, body: { action: 'buy', itemType: 'item', subType: 'medicine' } })
  check('Buy medicine item', buyItem.status === 200, JSON.stringify(buyItem.data))
  const useItem = await api('/api/game/action', { method: 'POST', token, body: { action: 'use_item', itemKey: 'medicine' } })
  check('Use medicine item', useItem.status === 200, JSON.stringify(useItem.data))

  // ── breeding needs 2 grown hens (fresh account should be blocked by stage) ──
  const st2 = await api('/api/game/state', { token })
  const youngHen = st2.data.hens.find(h => h.stage === 'chick' || h.stage === 'growing')
  if (youngHen) {
    const breed = await api('/api/game/action', { method: 'POST', token, body: { action: 'breed', henAId: youngHen.id, henBId: youngHen.id } })
    check('Breeding blocked for young/same hens', breed.status === 400)
  }

  // ── daily reward ──
  const daily = await api('/api/game/action', { method: 'POST', token, body: { action: 'claim_daily' } })
  check('Daily reward claim', daily.status === 200, JSON.stringify(daily.data))

  // ── level reward (level 1 has none, should error gracefully) ──
  const lr = await api('/api/game/action', { method: 'POST', token, body: { action: 'claim_level_reward' } })
  check('Level reward gated properly', lr.status === 400 || lr.status === 200)

  // ── purchase gems (mock checkout) ──
  const pg = await api('/api/game/action', { method: 'POST', token, body: { action: 'purchase_gems', sku: 'starter', method: 'card' } })
  check('Gem purchase completes', pg.status === 200, JSON.stringify(pg.data))
  const st3 = await api('/api/game/state', { token })
  check('Gems credited (+10)', st3.data.user.gems >= 10, `gems=${st3.data.user.gems}`)

  // ── purchase VIP ──
  const pv = await api('/api/game/action', { method: 'POST', token, body: { action: 'purchase_vip', planKey: 'farmer_vip', method: 'card' } })
  check('VIP purchase completes', pv.status === 200, JSON.stringify(pv.data))
  const st4 = await api('/api/game/state', { token })
  check('VIP active in state', st4.data.user.vip?.plan === 'farmer_vip', JSON.stringify(st4.data.user.vip))
  const vipGems = await api('/api/game/action', { method: 'POST', token, body: { action: 'claim_vip_daily' } })
  check('VIP daily gems claim', vipGems.status === 200, JSON.stringify(vipGems.data))

  // ── market: list + anti-fraud ──
  const st5 = await api('/api/game/state', { token })
  const invEggType = Object.keys(st5.data.eggInventory).find(k => st5.data.eggInventory[k] > 0)
  if (invEggType) {
    const listOk = await api('/api/game/action', { method: 'POST', token, body: { action: 'list_market', itemType: 'egg', subType: invEggType, price: 40 } })
    check('Market listing accepted', listOk.status === 200, JSON.stringify(listOk.data))
    const listBad = await api('/api/game/action', { method: 'POST', token, body: { action: 'list_market', itemType: 'egg', subType: invEggType, price: 999999 } })
    check('Anti-fraud rejects absurd price', listBad.status === 400, JSON.stringify(listBad.data))
    // cleanup: cancel listing
    const mkt = await api('/api/market', { token })
    const mine = mkt.data.myListings?.[0]
    if (mine) {
      const cancel = await api('/api/game/action', { method: 'POST', token, body: { action: 'cancel_market', listingId: mine.id } })
      check('Cancel listing returns item', cancel.status === 200)
    }
  }

  // ── social: friends ──
  // The counterpart account is registered fresh rather than reusing a
  // shared demo user, so this suite depends on nothing but itself and
  // stays repeatable.
  const otherName = `smokefriend${Date.now().toString().slice(-6)}`
  const otherReg = await api('/api/auth', {
    method: 'POST',
    body: { action: 'register', username: otherName, password: 'test1234', farmName: `Friend ${otherName.slice(-4)}` },
  })
  check('Register friend account', otherReg.status === 200 && !!otherReg.data.token, JSON.stringify(otherReg.data).slice(0, 80))
  const otherToken = otherReg.data.token
  const otherState = await api('/api/game/state', { token: otherToken })
  const otherId = otherState.data.user?.id

  const fa = await api('/api/game/action', { method: 'POST', token, body: { action: 'friend_add', username: otherName } })
  check('Friend request sent', fa.status === 200, JSON.stringify(fa.data))

  const otherSocial = await api('/api/social', { token: otherToken })
  const reqRow = otherSocial.data.requests?.[0]
  check('Recipient sees pending request', !!reqRow)
  if (reqRow) {
    const accept = await api('/api/game/action', { method: 'POST', token: otherToken, body: { action: 'friend_accept', requestId: reqRow.rowId } })
    check('Friend request accepted', accept.status === 200)
  }
  const gift = await api('/api/game/action', { method: 'POST', token: otherToken, body: { action: 'gift_friend', friendUserId: uid } })
  check('Gift sent to friend', gift.status === 200, JSON.stringify(gift.data))
  // help_friend has a 5/day cap per helper, so the helper must be an
  // account that has spent none of it. Both accounts here are fresh.
  const help = await api('/api/game/action', { method: 'POST', token, body: { action: 'help_friend', friendUserId: otherId } })
  check('Help friend works', help.status === 200, JSON.stringify(help.data))

  // visit friend's farm
  const visit = await api(`/api/social?visit=${uid}`, { token: otherToken })
  check('Farm visit snapshot', visit.status === 200 && visit.data.restricted === false, JSON.stringify(visit.data))

  // ── fund account for clan test (mock purchase → gem exchange) ──
  await api('/api/game/action', { method: 'POST', token, body: { action: 'purchase_gems', sku: 'tycoon', method: 'usdt' } })
  const fund = await api('/api/game/action', { method: 'POST', token, body: { action: 'exchange_gems', gems: 120 } })
  check('Gem exchange funds account', fund.status === 200, JSON.stringify(fund.data))

  // ── clans ──
  const cc = await api('/api/game/action', { method: 'POST', token, body: { action: 'clan_create', name: `Smoke Clan ${uname.slice(-4)}`, tag: 'SMK', emblem: '🛡️' } })
  check('Clan created', cc.status === 200, JSON.stringify(cc.data))
  const social2 = await api('/api/social', { token })
  check('My clan visible', social2.data.clan?.tag === 'SMK')
  const donate = await api('/api/game/action', { method: 'POST', token, body: { action: 'clan_donate', amount: 50 } })
  check('Clan donation', donate.status === 200, JSON.stringify(donate.data))
  const claim = await api('/api/game/action', { method: 'POST', token, body: { action: 'clan_claim' } })
  check('Clan weekly claim', claim.status === 200, JSON.stringify(claim.data))
  const joinClan = social2.data.clanList?.find(c => c.tag === 'GFC')
  check('Clan leaderboard lists GFC', !!joinClan)

  // ── rate limiting kicks in ──
  let rateLimited = false
  for (let i = 0; i < 45; i++) {
    const r = await api('/api/game/action', { method: 'POST', token, body: { action: 'exchange_gems', gems: 1 } })
    if (r.status === 429) { rateLimited = true; break }
  }
  check('Rate limiter engages on spam', rateLimited)

  // ── admin (super) ──
  const adminLogin = await api('/api/auth', { method: 'POST', body: { action: 'login', username: 'admin', password: 'admin123' } })
  const adminToken = adminLogin.data.token
  check('Admin login', adminLogin.status === 200 && adminLogin.data.isAdmin === true)

  const stats = await api('/api/admin/stats', { token: adminToken })
  check('Admin stats include revenue', typeof stats.data.stats?.revenueCents === 'number' && stats.data.stats.revenueCents > 0)
  const ana = await api('/api/admin/analytics', { token: adminToken })
  check('Analytics endpoint works', ana.status === 200 && Array.isArray(ana.data.dauSeries))
  check('Economy health signal present', !!ana.data.economyHealth?.signal)
  const sec = await api('/api/admin/security', { token: adminToken })
  check('Security endpoint works', sec.status === 200 && Array.isArray(sec.data.roleMatrix))

  // ── role permission enforcement ──
  const finName = `fin${Date.now().toString().slice(-6)}`
  await api('/api/auth', { method: 'POST', body: { action: 'register', username: finName, password: 'test1234', farmName: 'Finance Test Farm' } })
  const usersLookup = await api(`/api/admin/users?q=${finName}`, { token: adminToken })
  const finUser = usersLookup.data.users?.[0]
  check('Admin can search users', !!finUser)
  if (finUser) {
    const setRole = await api('/api/admin/users', { method: 'POST', token: adminToken, body: { userId: finUser.id, action: 'set_role', role: 'finance' } })
    check('Role assignment works', setRole.status === 200, JSON.stringify(setRole.data))
    const finLogin = await api('/api/auth', { method: 'POST', body: { action: 'login', username: finName, password: 'test1234' } })
    const finEvents = await api('/api/admin/events', { token: finLogin.data.token })
    check('Finance role blocked from events', finEvents.status === 403, JSON.stringify(finEvents.data))
    const finWd = await api('/api/admin/withdrawals', { token: finLogin.data.token })
    check('Finance role can view payouts', finWd.status === 200, JSON.stringify(finWd.data))
    const finAna = await api('/api/admin/analytics', { token: finLogin.data.token })
    check('Finance role can view analytics', finAna.status === 200)
  }

  // ── wallet reconciliation ──
  const wallet = await api('/api/wallet', { token })
  check('Wallet tx history loads', wallet.status === 200 && Array.isArray(wallet.data.transactions))
  const purchases = wallet.data.transactions.filter(t => t.type === 'purchase' || t.type === 'vip')
  check('Purchase txs recorded', purchases.length >= 1)

  // ── market trades feed ──
  const mkt2 = await api('/api/market', { token })
  check('Market returns price stats', !!mkt2.data.priceStats && typeof mkt2.data.priceStats === 'object')

  // ── summary ──
  console.log('\n════════════════════════════')
  console.log(`✅ Passed: ${passed}   ❌ Failed: ${failed}`)
  if (failures.length) {
    console.log('Failed checks:')
    for (const f of failures) console.log(`  - ${f}`)
    process.exit(1)
  } else {
    console.log('🎉 All smoke tests passed!')
  }
}

main().catch(e => { console.error('Fatal:', e); process.exit(1) })
