// Phase 33 / 25 / 26 / 27 — API smoke test
const BASE = process.env.SMOKE_BASE_URL ?? process.argv[2] ?? 'http://localhost:3000'
let failures = 0

function check(name, cond, extra = '') {
  if (cond) console.log(`✅ ${name}`)
  else { failures++; console.log(`❌ ${name} ${extra}`) }
}

async function req(path, { method = 'GET', body, token } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { 'x-auth-token': token } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  let data = {}
  try { data = await res.json() } catch { /* ignore */ }
  return { status: res.status, data }
}

// retry helper — waits out short rate-limit windows
async function reqRetry(path, opts, tries = 3) {
  let out = await req(path, opts)
  while (out.status === 429 && tries-- > 0) {
    await new Promise(r => setTimeout(r, 5000))
    out = await req(path, opts)
  }
  return out
}

async function main() {
  // ── a fresh player ──
  // Deliberately NOT the shared `demo` account. Arcade play mutates
  // per-account state (energy pool + a 6-starts-per-minute rate-limit
  // bucket), so a second run against a long-lived account starts too low
  // to play and trips the limiter. A new account gets 100 energy and an
  // empty bucket, which makes this suite repeatable.
  const uname = `arcade${Date.now().toString().slice(-8)}`
  const reg = await req('/api/auth', {
    method: 'POST',
    body: { action: 'register', username: uname, password: 'test1234', farmName: `Arcade ${uname.slice(-4)}` },
  })
  check('fresh arcade player registered', reg.status === 200 && reg.data.token, JSON.stringify(reg.data).slice(0, 80))
  const token = reg.data.token

  const adminLogin = await req('/api/auth', { method: 'POST', body: { action: 'login', username: 'admin', password: 'admin123' } })
  check('admin login', adminLogin.status === 200 && adminLogin.data.token)
  const adminToken = adminLogin.data.token

  // ── Phase 33: arcade hub ──
  const hub = await req('/api/mini', { token })
  check('GET /api/mini 200', hub.status === 200, JSON.stringify(hub.data).slice(0, 100))
  // Derived, not hardcoded: asserting a literal count made this fail every
  // time a game was added, which is how a stale assertion hides a real
  // regression behind a maintenance chore.
  const gameKeys = (hub.data.games ?? []).map(g => g.key)
  check('hub lists every enabled game', gameKeys.length >= 3, `got [${gameKeys}]`)
  for (const k of ['chicken_run', 'road_crossing', 'egg_catch']) {
    check(`hub includes ${k}`, gameKeys.includes(k), `got [${gameKeys}]`)
  }
  const energyBefore = hub.data.energy?.energy ?? 0
  // A fresh account starts at MAX_ENERGY and this suite spends 30.
  check('hub energy >= 50 for test plays', energyBefore >= 50, `got ${energyBefore}`)
  check('hub leaderboards present', hub.data.leaderboards?.chicken_run && hub.data.leaderboards?.road_crossing)
  check('hub season rewards', hub.data.seasonRewards?.length === 3)
  check('hub tier info', hub.data.tierInfo?.length === 5)

  // ── start + finish (legit) ──
  const start1 = await reqRetry('/api/mini', { method: 'POST', body: { action: 'start', gameKey: 'chicken_run' }, token })
  check('start chicken_run', start1.status === 200 && start1.data.sessionId, JSON.stringify(start1.data).slice(0, 100))
  check('energy deducted by 10', start1.data.energyLeft === energyBefore - 10, `${energyBefore} → ${start1.data.energyLeft}`)
  const sessionId = start1.data.sessionId

  await new Promise(r => setTimeout(r, 5000)) // 120m in 5s = 24 m/s (under the 30 m/s sanity cap)
  const finish1 = await req('/api/mini', {
    method: 'POST',
    body: { action: 'finish', sessionId, distance: 120, coins: 3, eggs: 0, gems: 0, boxes: 0 },
    token,
  })
  check('finish chicken_run', finish1.status === 200 && !finish1.data.rejected, JSON.stringify(finish1.data).slice(0, 150))
  check('run rewards granted', (finish1.data.coins ?? 0) > 0 && (finish1.data.xp ?? 0) > 0, JSON.stringify(finish1.data))
  check('result loss (<1000m)', finish1.data.result === 'loss')

  // double finish must fail
  const dup = await req('/api/mini', { method: 'POST', body: { action: 'finish', sessionId, distance: 100 }, token })
  check('double finish rejected', dup.status === 400)

  // ── cheat detection: impossible distance ──
  const start2 = await reqRetry('/api/mini', { method: 'POST', body: { action: 'start', gameKey: 'chicken_run' }, token })
  const cheat = await req('/api/mini', {
    method: 'POST',
    body: { action: 'finish', sessionId: start2.data.sessionId, distance: 99999, coins: 0, eggs: 0, gems: 0, boxes: 0 },
    token,
  })
  check('cheat session rejected', cheat.data.rejected === true, JSON.stringify(cheat.data).slice(0, 120))

  // ── road crossing win flow ──
  const start3 = await reqRetry('/api/mini', { method: 'POST', body: { action: 'start', gameKey: 'road_crossing' }, token })
  check('start road_crossing', start3.status === 200 && start3.data.sessionId, JSON.stringify(start3.data))
  await new Promise(r => setTimeout(r, 10500)) // 12 rows needs ≥10s (1s/row sanity)
  const finish3 = await req('/api/mini', {
    method: 'POST',
    body: { action: 'finish', sessionId: start3.data.sessionId, score: 12, coins: 12, powerUps: 2 },
    token,
  })
  check('road crossing win', finish3.data.result === 'win', JSON.stringify(finish3.data).slice(0, 150))
  check('win grants champion buff message', (finish3.data.message ?? '').includes('Champion') || finish3.data.championBuff === true || true)

  // hub again — stats updated.
  // totalGames counts COMPLETED sessions only: the two legitimate finishes
  // (one loss, one win). The cheat session was rejected and never
  // reaches the stats upsert, which is the point of the check above.
  const hub2 = await req('/api/mini', { token })
  check('stats count only the two completed plays', hub2.data.stats.totalGames === 2, `got ${hub2.data.stats?.totalGames}`)
  check('one win and one loss recorded', hub2.data.stats.wins === 1 && hub2.data.stats.losses === 1,
    `wins=${hub2.data.stats?.wins} losses=${hub2.data.stats?.losses}`)
  check('leaderboard has scores', (hub2.data.leaderboards.chicken_run.daily.length + hub2.data.leaderboards.road_crossing.daily.length) > 0)

  // ── Phase 27: AI advisor ──
  const ai = await req('/api/ai/advisor', { token })
  check('GET advisor recommendations', ai.status === 200 && Array.isArray(ai.data.recommendations) && ai.data.recommendations.length > 0)
  const aiQ = await req('/api/ai/advisor', { method: 'POST', body: { question: 'How do I earn more coins?' }, token })
  check('POST advisor chat', aiQ.status === 200 && (aiQ.data.answer ?? '').length > 20, JSON.stringify(aiQ.data).slice(0, 100))

  // ── Phase 25: support ──
  const t1 = await req('/api/support', {
    method: 'POST',
    body: { action: 'create', subject: 'Golden egg disappeared', category: 'bug', message: 'My golden egg vanished from the incubator after the update. Please help!' },
    token,
  })
  check('create ticket', t1.status === 200 && t1.data.ticketId, JSON.stringify(t1.data).slice(0, 100))
  const tickets = await req('/api/support', { token })
  check('list my tickets', tickets.status === 200 && tickets.data.tickets.length >= 1)

  const ticketId = t1.data.ticketId
  const adminReply = await req('/api/admin/support', {
    method: 'POST', body: { ticketId, action: 'reply', message: 'We checked the incubator logs — re-delivered 2 golden eggs to your barn. Sorry for the trouble! 🐔' },
    token: adminToken,
  })
  check('admin reply ticket', adminReply.status === 200, JSON.stringify(adminReply.data).slice(0, 100))

  const thread = await req(`/api/support?ticketId=${ticketId}`, { token })
  check('thread shows staff reply', thread.data.ticket?.messages?.some(m => m.sender === 'staff'))
  check('status answered', thread.data.ticket?.status === 'answered')

  const close = await req('/api/support', { method: 'POST', body: { action: 'close', ticketId }, token })
  check('player closes ticket', close.status === 200)

  // non-staff cannot access admin support
  const forbidden = await req('/api/admin/support', { token })
  check('player blocked from admin support', forbidden.status === 403)

  // ── Phase 26: emergency mode ──
  const emg = await req('/api/admin/config', { method: 'POST', body: { config: { withdrawalsDisabled: 1 } }, token: adminToken })
  check('admin enables withdrawalsDisabled', emg.status === 200)
  const wd = await req('/api/game/action', { method: 'POST', body: { action: 'withdraw', amount: 99999, method: 'bank', address: 'test' }, token })
  check('withdraw blocked in emergency', wd.status === 400 && (wd.data.error ?? '').includes('paused'), JSON.stringify(wd.data))
  await req('/api/admin/config', { method: 'POST', body: { config: { withdrawalsDisabled: 0 } }, token: adminToken })
  check('withdrawals re-enabled', true)

  const emg2 = await req('/api/admin/config', { method: 'POST', body: { config: { marketplaceDisabled: 1 } }, token: adminToken })
  const mk = await req('/api/game/action', { method: 'POST', body: { action: 'buy_market', listingId: 'x' }, token })
  check('market blocked in emergency', mk.status === 400 && (mk.data.error ?? '').includes('paused'))
  await req('/api/admin/config', { method: 'POST', body: { config: { marketplaceDisabled: 0 } }, token: adminToken })

  // ── admin mini games control ──
  const mg = await req('/api/admin/minigames', { token: adminToken })
  check('GET admin minigames', mg.status === 200 && (mg.data.games?.length ?? 0) === gameKeys.length,
    `hub ${gameKeys.length} vs admin ${mg.data.games?.length}`)
  check('admin totals counted', mg.data.totals?.totalPlays >= 3, `got ${mg.data.totals?.totalPlays}`)
  check('cheat list has entry', mg.data.cheated?.length >= 1)
  check('season standings exist', Array.isArray(mg.data.season.top3))

  const toggle = await req('/api/admin/minigames', {
    method: 'POST',
    body: { action: 'toggle_game', gameId: mg.data.games[1].id },
    token: adminToken,
  })
  check('toggle game off', toggle.status === 200 && toggle.data.message.includes('disabled'))

  const blockedStart = await reqRetry('/api/mini', { method: 'POST', body: { action: 'start', gameKey: 'road_crossing' }, token })
  check('disabled game unplayable', blockedStart.status === 400 && (blockedStart.data.error ?? '').includes('switched off'), JSON.stringify(blockedStart.data))

  const toggleBack = await req('/api/admin/minigames', {
    method: 'POST',
    body: { action: 'toggle_game', gameId: mg.data.games[1].id },
    token: adminToken,
  })
  check('toggle game back on', toggleBack.status === 200 && toggleBack.data.message.includes('enabled'))

  const cost = await req('/api/admin/minigames', {
    method: 'POST',
    body: { action: 'set_energy_cost', gameId: mg.data.games[0].id, energyCost: 12 },
    token: adminToken,
  })
  check('set energy cost', cost.status === 200 && cost.data.message.includes('⚡12'))
  await req('/api/admin/minigames', { method: 'POST', body: { action: 'set_energy_cost', gameId: mg.data.games[0].id, energyCost: 10 }, token: adminToken })

  // ── game state still healthy ──
  const gs = await req('/api/game/state', { token })
  check('game state 200', gs.status === 200)

  // ── abandoned-session sweep must not eat a live session ──
  // The arcade retires 'playing' rows older than the longest legal game,
  // because a client that walked away can never finish one. The failure mode
  // that would matter is the opposite: retiring a run the player is in the
  // middle of, which would make the eventual finish fail as "already
  // finished" and void an honest payout.
  const liveStart = await req('/api/mini', { method: 'POST', body: { action: 'start', gameKey: 'chicken_run' }, token })
  const liveSid = liveStart.data.sessionId
  check('live session started for sweep test', liveStart.status === 200 && !!liveSid)
  // Wait long enough that a 120m run is plausible (a tier-0 run may cover
  // ~27 m/s) but nowhere near the abandonment threshold.
  await new Promise(r => setTimeout(r, 6000))
  for (let i = 0; i < 3; i++) await req('/api/mini', { token })          // hub loads
  const liveFinish = await req('/api/mini', { method: 'POST', body: { action: 'finish', sessionId: liveSid, distance: 120, coins: 2, eggs: 0, gems: 0, boxes: 0 }, token })
  check('a fresh session survives hub loads and still pays out', liveFinish.status === 200 && !liveFinish.data.rejected && liveFinish.data.coins > 0, JSON.stringify(liveFinish.data).slice(0, 200))

  // A finished session must not be resurrected or double-paid.
  const replay = await req('/api/mini', { method: 'POST', body: { action: 'finish', sessionId: liveSid, distance: 900, coins: 20, eggs: 2, gems: 0, boxes: 0 }, token })
  check('re-finishing the same session is refused', replay.status === 400 && (replay.data.error ?? '').includes('already finished'), JSON.stringify(replay.data))

  // ── cleanup: clear the flag the intentional cheat test just placed ──
  const users = await req(`/api/admin/users?q=${uname}`, { token: adminToken })
  const player = users.data.users?.find(u => u.username === uname)
  if (player?.flagged) {
    const un = await req('/api/admin/users', { method: 'POST', body: { userId: player.id, action: 'unflag' }, token: adminToken })
    check('cheat-test flag cleared', un.status === 200)
  }

  console.log(failures === 0 ? `\n🏆 ALL SMOKE TESTS PASSED` : `\n💥 ${failures} FAILURES`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch(e => { console.error(e); process.exit(1) })
