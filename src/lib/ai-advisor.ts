// ═════════════════════════════════════════════════════════════
// PHASE 27 — AI Farm Assistant
// A deterministic, server-side expert system that inspects the
// live game state and produces prioritized recommendations plus
// conversational answers. No external LLM dependency — every
// insight is computed from real player data so it can never
// hallucinate a reward or mislead a player.
// ═════════════════════════════════════════════════════════════

export interface Advice {
  icon: string
  title: string
  detail: string
  priority: number // 0 = most urgent
  tag: 'urgent' | 'tip' | 'growth' | 'economy'
}

export interface FarmFacts {
  health: number
  buffType: string | null
  lastFedHoursAgo: number | null
  activeHens: number
  retiredHens: number
  totalPendingEggs: number
  eggsInInventory: number
  incubatingCount: number
  incubatorCap: number
  readyEggs: number
  coins: number
  gems: number
  coopLevel: number
  coopCap: number
  landLevel: number
  incubatorLevel: number
  feedFactoryLevel: number
  storageLevel: number
  numericLevel: number
  energy: number
  maxEnergy: number
  canClaimDaily: boolean
  vipName: string | null
  vipHoursLeft: number | null
  clanName: string | null
  medicineQty: number
  animals: number
  canBreed: number // hens off cooldown
}

export function buildRecommendations(f: FarmFacts): Advice[] {
  const out: Advice[] = []

  if (f.readyEggs > 0) {
    out.push({
      icon: '🐣', tag: 'urgent', priority: 0,
      title: `${f.readyEggs} egg(s) are ready to hatch!`,
      detail: 'Hatched eggs can reveal rare chicks, coins, gems or even farm animals. Open them in the incubator room now — eggs waiting in the incubator produce nothing.',
    })
  }
  if (f.health <= 70) {
    if (f.medicineQty > 0) {
      out.push({
        icon: '💉', tag: 'urgent', priority: 0,
        title: `Farm health is ${f.health}% — use your Farm Medicine`,
        detail: 'Low health directly cuts egg production. You own medicine in your barn: use it to instantly restore 100% health.',
      })
    } else {
      out.push({
        icon: '🌽', tag: 'urgent', priority: 0,
        title: `Farm health is ${f.health}% — feed your hens`,
        detail: 'Your flock has not been fed for a while and production is dropping. Feeding restores health; a Feed Sack (barn or shop, 100 coins) also feeds for free.',
      })
    }
  } else if (f.lastFedHoursAgo !== null && f.lastFedHoursAgo >= 20) {
    out.push({
      icon: '⏰', tag: 'tip', priority: 1,
      title: 'Hens are getting hungry',
      detail: `Last feeding was ${Math.round(f.lastFedHoursAgo)}h ago. Health decays 10% per day without food — feed soon to keep production at 100%.`,
    })
  }
  if (!f.buffType && f.activeHens > 0 && f.coins >= 20) {
    out.push({
      icon: '🌾', tag: 'tip', priority: 2,
      title: 'No production buff is active',
      detail: 'Corn Feed (+20% for 4h, 20 coins) or Premium Feed (+50% for 8h, 60 coins) pays for itself within hours. Premium Feed is the best coins-per-hour value.',
    })
  }
  if (f.eggsInInventory >= 3 && f.incubatingCount < f.incubatorCap) {
    out.push({
      icon: '🥚', tag: 'growth', priority: 1,
      title: `${f.eggsInInventory} egg(s) idle in storage`,
      detail: `You have ${f.incubatorCap - f.incubatingCount} free incubator slot(s). Idle eggs earn nothing — incubate them to start the hatch timer.`,
    })
  }
  if (f.incubatingCount === 0 && f.eggsInInventory === 0 && f.activeHens === 0) {
    out.push({
      icon: '🐔', tag: 'urgent', priority: 0,
      title: 'Your farm has no active hens!',
      detail: 'Hens are your only egg source. Buy a Normal Hen (200 coins) in the Shop to restart production.',
    })
  }
  if (f.coins >= 800 && f.activeHens >= 1 && f.coopCap - f.activeHens - f.retiredHens >= 1) {
    const nextHen = f.coins >= 8000 ? 'a Magic Hen (legendary output)' : f.coins >= 2500 ? 'a Royal Hen (epic output)' : 'a Golden Hen (rare output)'
    out.push({
      icon: '🛒', tag: 'growth', priority: 3,
      title: `You can afford ${nextHen}`,
      detail: `Wallet: ${f.coins.toLocaleString()} coins. Every hen compounds your passive income — reinvesting profits is the fastest growth path.`,
    })
  }
  if (f.totalPendingEggs >= 5) {
    out.push({
      icon: '🧺', tag: 'economy', priority: 1,
      title: `${f.totalPendingEggs} eggs waiting on hens`,
      detail: 'Collect them now — storage caps how long production accumulates while you are away, and uncollected eggs stop counting once the cap is hit.',
    })
  }
  if (f.activeHens >= f.coopCap - 2 && f.activeHens > 0) {
    const nextPrice = [0, 2000, 10000, 40000, 150000][f.coopLevel] ?? null
    out.push({
      icon: '🏠', tag: 'growth', priority: 2,
      title: 'Chicken House is nearly full',
      detail: `${f.activeHens}/${f.coopCap} hens.${nextPrice ? ` Upgrading the coop costs ${nextPrice.toLocaleString()} coins and unlocks room for more layers.` : ''}`,
    })
  }
  if (f.incubatorLevel < 3 && f.coins >= 3000) {
    out.push({
      icon: '🏹', tag: 'growth', priority: 3,
      title: 'Consider upgrading the Incubator Room',
      detail: 'A bigger incubator hatches more eggs in parallel — the bottleneck for turning eggs into rare chicks and coins.',
    })
  }
  if (f.feedFactoryLevel === 0 && f.numericLevel >= 8 && f.coins >= 1500) {
    out.push({
      icon: '🏭', tag: 'growth', priority: 3,
      title: 'Build the Feed Factory',
      detail: 'Unlocked at level 8. It gives up to 30% feed discount plus free daily feed — permanent savings forever after.',
    })
  }
  if (f.energy >= f.maxEnergy * 0.9) {
    out.push({
      icon: '🎮', tag: 'tip', priority: 2,
      title: 'Arcade energy is nearly full',
      detail: 'Chicken Run and Road Crossing convert energy into coins, eggs, gems and mystery items. Play a round so the energy regenerates into rewards instead of capping out.',
    })
  }
  if (f.canClaimDaily) {
    out.push({
      icon: '🎁', tag: 'economy', priority: 1,
      title: 'Daily reward is unclaimed',
      detail: 'The 7-day streak calendar pays up to 500 coins on day 7 — claim it in the Quests tab before it resets.',
    })
  }
  if (f.vipName && f.vipHoursLeft !== null && f.vipHoursLeft <= 48) {
    out.push({
      icon: '👑', tag: 'economy', priority: 1,
      title: `${f.vipName} expires in ${Math.ceil(f.vipHoursLeft)}h`,
      detail: 'VIP boosts production by up to +75%, doubles arcade energy regen and adds market slots. Renew before it lapses.',
    })
  }
  if (!f.clanName && f.numericLevel >= 6) {
    out.push({
      icon: '🛡️', tag: 'growth', priority: 3,
      title: 'Join a clan for +production',
      detail: 'Clans add up to +8% production, weekly coin rewards and a treasury. The Social tab lists open clans.',
    })
  }
  if (f.retiredHens >= 3) {
    out.push({
      icon: '🔄', tag: 'economy', priority: 2,
      title: `${f.retiredHens} retired hens in the coop`,
      detail: 'Retired hens stop laying but still occupy coop space. Sell them on the Market or make room for young layers.',
    })
  }

  return out.sort((a, b) => a.priority - b.priority).slice(0, 6)
}

// ── conversational Q&A (keyword-matched, state-aware) ─────────

export function advisorReply(q: string, f: FarmFacts): string {
  const s = q.toLowerCase()

  if (/(egg|hatch|incubat)/.test(s)) {
    const pending = f.incubatingCount
    return [
      `🥚 Egg status: ${f.eggsInInventory} in storage · ${pending}/${f.incubatorCap} incubating · ${f.readyEggs} ready to hatch.`,
      pending > 0
        ? 'Incubating eggs hatch automatically — Golden Eggs take 12h, most others 24h. A 💎 gem speedup can finish one instantly.'
        : f.eggsInInventory > 0
          ? 'You have eggs sitting idle — place them in the incubator so the hatch timer starts.'
          : f.activeHens > 0
            ? 'No eggs in storage yet. Collect from your hens, then incubate.'
            : 'Buy a hen in the Shop to start producing eggs.',
      f.readyEggs > 0 ? '⚠️ You have hatched eggs waiting — open them now!' : '',
    ].filter(Boolean).join(' ')
  }
  if (/(feed|food|hungry|health|medicine)/.test(s)) {
    return [
      `❤️ Farm health: ${f.health}%. Last fed: ${f.lastFedHoursAgo === null ? 'never' : `${Math.round(f.lastFedHoursAgo)}h ago`}.`,
      f.health < 80
        ? 'Feed right now — health below 80% is actively cutting your production. Corn Feed is cheapest; a Feed Sack feeds for free.'
        : 'Health is fine. Feed every day to stay at 100%; the Feed Factory (from level 8) discounts feed up to 30%.',
    ].join(' ')
  }
  if (/(gem|diamond|premium)/.test(s)) {
    return [
      '💎 Ways to earn gems: hatch rare eggs, win Road Crossing (up to 2 per run), claim VIP daily gems, level-up milestones, and the 💎 exchange (1 gem = 100 coins, so gems are worth saving).',
      'Gems are best spent on Golden Feed (+100% production) and hatch speedups when an egg gates your growth.',
    ].join(' ')
  }
  if (/(coin|money|rich|earn|income|profit)/.test(s)) {
    const perHen = f.activeHens > 0 ? Math.round((f.totalPendingEggs * 10) / Math.max(1, f.activeHens)) : 0
    return [
      `🪙 Wallet: ${f.coins.toLocaleString()} coins. Main income = laying eggs (10 each) → sell or hatch.`,
      f.activeHens > 0
        ? `Each active hen is currently averaging roughly ${perHen} pending egg(s). Reinvest coins into more/better hens — a Golden Hen (800) pays itself back in a few days.`
        : 'Start with a Normal Hen (200 coins) — the fastest road to passive income.',
      'Arcade games (🎮 Games tab) are a pure coin bonus on top of farming.',
    ].join(' ')
  }
  if (/(breed|baby|chick|trait|genetic)/.test(s)) {
    return [
      '🧬 Breeding needs 2 adult hens off cooldown + 500 coins. Offspring inherit a mix of both parents, with a 20% chance to jump a tier and a 10% legendary-mutation chance.',
      'Pro tip: breed your two highest-tier hens — a Royal + Royal pairing can produce a Magic Hen chick.',
    ].join(' ')
  }
  if (/(upgrade|building|coop|barn|incubator|factory|shelter|storage)/.test(s)) {
    return [
      `🏗️ Current: Chicken House Lv${f.coopLevel} (${f.coopCap} cap) · Land Lv${f.landLevel} · Storage Lv${f.storageLevel} · Incubator Lv${f.incubatorLevel} · Feed Factory Lv${f.feedFactoryLevel}.`,
      f.activeHens >= f.coopCap - 2
        ? 'Your coop is close to full — upgrade it first.'
        : f.incubatingCount >= f.incubatorCap
          ? 'The incubator is your bottleneck — more slots means more parallel hatches.'
          : 'Storage matters if you play rarely: higher storage keeps producing while you are away (up to its hour cap).',
    ].join(' ')
  }
  if (/(market|sell|trade|list)/.test(s)) {
    return [
      '🏪 The P2P market sells hens, animals & eggs to other players (5% platform fee).',
      'Check the recent-trades price hints before listing — prices outside 25%–600% of reference value are rejected as anti-fraud.',
    ].join(' ')
  }
  if (/(vip|subscribe|premium pass)/.test(s)) {
    return [
      f.vipName
        ? `👑 You have ${f.vipName}${f.vipHoursLeft !== null ? ` — ${Math.ceil(f.vipHoursLeft)}h remaining` : ''}.`
        : '👑 VIP grants up to +75% production, daily gems, ×2 arcade energy regen and extra market slots.',
      'It pays for itself if you collect at least twice a day. See the Shop → Premium tab.',
    ].join(' ')
  }
  if (/(weather|storm|rain|sunny)/.test(s)) {
    return [
      '🌦️ Weather changes daily and swings production ±25%.',
      'A Scarecrow (500 coins, Shop → Items) permanently shields your farm from Storm penalties — a great one-time buy.',
    ].join(' ')
  }
  if (/(game|arcade|play|energy|ticket)/.test(s)) {
    return [
      `🎮 Arcade energy: ${f.energy}/${f.maxEnergy}. Chicken Run costs 10 ⚡, Road Crossing 15 ⚡ — regen is ${f.energy >= f.maxEnergy ? 'capped, spend some!' : '20/hour (×2 with VIP)'}.`,
      'Rewards scale with your farmer level tier — at higher levels the same run pays up to ×3.',
    ].join(' ')
  }
  if (/(help|start|guide|how|what should|what do)/.test(s)) {
    const top = buildRecommendations(f)[0]
    return [
      '🌾 Daily loop: collect eggs → feed → incubate → claim quests → play an arcade round.',
      top ? `Right now I would: ${top.title.replace(/^[^\w]+/, '')}` : '',
    ].filter(Boolean).join(' ')
  }

  return [
    '🤖 I can advise on: eggs & hatching, feeding & health, coins & income, gems, breeding, buildings & upgrades, the market, VIP, weather, and arcade games.',
    'Ask me something like "how do I earn more coins?"',
  ].join(' ')
}
