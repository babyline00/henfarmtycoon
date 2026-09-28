'useclient'

import{ useCallback, useEffect, useState} from'react'
import{ motion} from'framer-motion'
import{ useGame, api} from'@/lib/store'
import{ Button} from'@/components/ui/button'
import{ Input} from'@/components/ui/input'
import{ Label} from'@/components/ui/label'
import{ GameCard, EmptyState, LoadingSpinner} from'./shared'
import{ cn} from'@/lib/utils'
import{
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, PieChart, Pie, Cell, Legend,
} from'recharts'

typeTab= 'dashboard' | 'users' | 'withdrawals' | 'finance' | 'economy' | 'events' | 'broadcast' | 'analytics' | 'security' | 'games' | 'support'

interfaceStats{
  stats:{
    totalUsers:number; activeToday:number; newToday: numbertotalHens:number; totalAnimals: numbertotalEggsHatched:number; totalEggsInInventory: numbercoinsInCirculation:number; gemsInCirculation: numberpendingWithdrawals:number; totalWithdrawn: numbertotalTransactions:number; marketSales:number; serverStatus: stringrevenueCents:number; purchaseCount:number; vipCount:number; todayRevenueCents: number //Phase 34— wallettotalDepositCents:number; depositCount:number; pendingDeposits:number; wdFeesCollected: number}
  growth:{ date:string; users: number}[]topHolders:{ username:string; coins: number}[]txByType:Record<string, number>
  events:{ id:string; name:string; active:boolean; multiplier:number; endsAt: string}[]}

interfaceAnalyticsData{
  dauSeries:{ date:string; dau:number; newUsers: number}[]economySeries:{ date:string; generated:number; spent:number; marketVolume: number}[]revenueSeries:{ date:string; revenueCents: number}[]eggSeries:{ date:string; laid:number; hatched: number}[] retention:{ d1:number; d3:number; sessionsPerUser:number; totalSessions7d: number}
  topSpenders:{ userId:string; username:string; cents:number; count: number}[]revenueBySku:{ sku:string; count:number; cents: number}[]economyHealth:{ totalGenerated14d:number; totalSpent14d:number; netCoinFlow:number; signal: string}
  vipCount: numbertodayRevenueCents: number}

interfaceSecurityData{
  events:{ id:string; kind:string; detail:string; createdAt:string; username:string; farmName:string; userId: string}[] flagged:{ id:string; username:string; farmName:string; avatar:string; flagReason:string; coins:number; isBlocked: boolean}[] logs:{ id:string; adminName:string; action:string; detail:string; createdAt: string}[] summary:{ rateLimitedCount:number; priceAbuseCount:number; flaggedCount:number; adminCount: number}
  admins:{ id:string; username:string; farmName:string; role:string; roleLabel:string; lastSeenAt: string}[]roleMatrix:{ role:string; roleLabel:string; perms: string[]}[] me:{ id:string; role:string; roleLabel: string}
}

interfaceMiniGamesData{
  games:{ id:string; key:string; name:string; emoji:string; description:string; enabled:boolean; energyCost:number; plays:number; wins:number; losses:number; rejected: number}[] totals:{ totalPlays:number; coinsAwarded:number; xpAwarded:number; metersRan:number; playsToday:number; cheatedCount: number}
  cheated:{ id:string; gameKey:string; createdAt:string; username:string; farmName:string; flagged: boolean}[] recent:{ id:string; gameKey:string; username:string; avatar:string; score:number; distance:number; coins:number; result:string; cheated:boolean; createdAt: string}[] season:{
    rewards:{ rank:number; prize:string; emoji:string; detail: string}[]monthKey:string; paid: boolean top3:{ rank:number; userId:string; username:string; avatar:string; totalScore:number; reward: string}[]}
}

interfaceSupportData{
  counts:{ open:number; answered:number; closed: number}
  tickets:{
    id:string; userId:string; username:string; subject:string; category: string status:string; assignedTo: string| null; createdAt:string; updatedAt: string messages:{ id:string; sender:string; senderName:string; body:string; createdAt: string}[]}[]}

interfaceAdminUser{
  id:string; username:string; email?: string| null; farmName:string; avatar: string coins:number; gems:number; levelName:string; xp: numberisAdmin:boolean; isBlocked:boolean; referralCode: stringadminRole: string| null; roleLabel: string| null flagged:boolean; flagReason: string| null; vipActive:boolean; numericLevel: number hens:number; animals:number; coopLevel: numbertotalEarned:number; totalEggsHatch: numbercreatedAt:string; lastSeenAt: string}

interfaceWd{
  id:string; userId:string; username:string; amount: number method:string; address:string; accountTitle:string; bankName: string fee:number; status: stringcreatedAt:string; note?: string| null}

//Phase 34— wallet interfaceDep{
  id:string; userId:string; username:string; amountCents: number method:string; senderName:string; reference:string; proof?: string| null coins:number; bonusCoins:number; status:string; note?: string| nullcreatedAt:string; processedAt?: string| null; processedBy?: string| null}
interfaceDepStats{ totalApprovedCents:number; coinsIssued:number; pendingCount: number}
interfacePayField{ key:string; label:string; placeholder:string; copyable?: boolean}
interfacePayMethodDef{ key:string; name:string; emoji:string; instructions:string; fields:PayField[]}
interfacePayMethodAcc{ enabled:boolean; [k: string]: unknown}

constUSD = (c:number) => `$${(c /100).toFixed(2)}`

constPIE_COLORS = ['#16a34a', '#eab308', '#f97316', '#ec4899', '#14b8a6', '#a855f7', '#84cc16', '#ef4444'] export functionAdminPanel() {
  const{ setAdminOpen, refresh, showFlash} = useGame()
  const[tab, setTab]= useState<Tab>('dashboard')
  const[stats, setStats]= useState<Stats| null>(null)
  const[users, setUsers]= useState<AdminUser[]>([])
  const[search, setSearch]= useState('')
  const[wds, setWds]= useState<Wd[]>([])
  const[deposits, setDeposits]= useState<Dep[]>([])
  const[depStats, setDepStats]= useState<DepStats| null>(null)
  const[depFilter, setDepFilter]= useState<'pending' | 'approved' | 'rejected' | 'all'>('pending')
  const[proofView, setProofView]= useState<Dep| null>(null)
  const[depNote, setDepNote]= useState('')
  const[payDefs, setPayDefs]= useState<PayMethodDef[]>([])
  const[payMethods, setPayMethods]= useState<Record<string, PayMethodAcc>>({})
  const[config, setConfig]= useState<Record<string, string>>({})
  const[events, setEvents]= useState<{ id:string; name:string; description:string; multiplier:number; endsAt:string; active: boolean}[]>([])
  const[evName, setEvName]= useState('')
  const[evDesc, setEvDesc]= useState('')
  const[evMult, setEvMult]= useState('150')
  const[evDays, setEvDays]= useState('3')
  const[bcTitle, setBcTitle]= useState('')
  const[bcMsg, setBcMsg]= useState('')
  const[busy, setBusy]= useState(false)
  const[analytics, setAnalytics]= useState<AnalyticsData| null>(null)
  const[security, setSecurity]= useState<SecurityData| null>(null)
  const[miniGames, setMiniGames]= useState<MiniGamesData| null>(null)
  const[support, setSupport]= useState<SupportData| null>(null)
  const[supportFilter, setSupportFilter]= useState('open')
  const[ticketReply, setTicketReply]= useState<Record<string, string>>({})

  constloadAll= useCallback(async() => {
    try{
      const[s, u, w, c, e]= awaitPromise.all([api<Stats>('/api/admin/stats'),
        api<{ users:AdminUser[]}>(`/api/admin/users?q=${encodeURIComponent(search)}`),
        api<{ withdrawals:Wd[]}>('/api/admin/withdrawals'),
        api<{ config:Record<string, string> }>('/api/admin/config'),
        api<{ events: typeof events}>('/api/admin/events'),
      ])
      setStats(s); setUsers(u.users); setWds(w.withdrawals); setConfig(c.config); setEvents(e.events)
    } catch(e) {
      showFlash(e instanceofError? e.message :'Failed to load admindata', 'error')
    }
  }, [search, showFlash])

  constloadAnalytics= useCallback(async() => {
    try{
      setAnalytics(awaitapi<AnalyticsData>('/api/admin/analytics'))
    } catch(e) {
      showFlash(e instanceofError? e.message :'Failed to loadanalytics', 'error')
    }
  }, [showFlash])

  constloadSecurity= useCallback(async() => {
    try{
      setSecurity(awaitapi<SecurityData>('/api/admin/security'))
    } catch(e) {
      showFlash(e instanceofError? e.message :'Failed to load securitydata', 'error')
    }
  }, [showFlash])

  useEffect(() => { loadAll() }, [loadAll, tab])
  useEffect(() => { if(tab=== 'analytics') loadAnalytics() }, [tab, loadAnalytics])
  useEffect(() => { if(tab=== 'security') loadSecurity() }, [tab, loadSecurity])

  constloadFinance= useCallback(async() => {
    try{
      const[d, p]= awaitPromise.all([api<{ deposits:Dep[]; stats:DepStats}>(`/api/admin/deposits${depFilter=== 'all' ? '' :`?status=${depFilter}`}`),
        api<{ methods:Record<string, PayMethodAcc>; defs:PayMethodDef[]}>('/api/admin/payment-settings'),
      ])
      setDeposits(d.deposits); setDepStats(d.stats); setPayMethods(p.methods); setPayDefs(p.defs)
    } catch(e) {
      showFlash(e instanceofError? e.message :'Failed to load financedata', 'error')
    }
  }, [depFilter, showFlash])

  useEffect(() => { if(tab=== 'finance') loadFinance() }, [tab, loadFinance])

  constloadMiniGames= useCallback(async() => {
    try{
      setMiniGames(awaitapi<MiniGamesData>('/api/admin/minigames'))
    } catch(e) {
      showFlash(e instanceofError? e.message :'Failed to load minigames', 'error')
    }
  }, [showFlash])

  constloadSupport= useCallback(async(filter:string) => {
    try{
      setSupport(awaitapi<SupportData>(`/api/admin/support?status=${filter}`))
    } catch(e) {
      showFlash(e instanceofError? e.message :'Failed to loadtickets', 'error')
    }
  }, [showFlash])

  useEffect(() => { if(tab=== 'games') loadMiniGames() }, [tab, loadMiniGames])
  useEffect(() => { if(tab=== 'support') loadSupport(supportFilter) }, [tab, supportFilter, loadSupport])

  async functiongameAdmin(action:string, extra?:Record<string, unknown>) {
    setBusy(true)
    try{
      const res= awaitapi<{ message: string}>('/api/admin/minigames', { method:'POST', body:{ action, ...extra} })
      showFlash(res.message)
      awaitloadMiniGames()
    } catch(e) {
      showFlash(e instanceofError? e.message :'Failed', 'error')
    } finally{ setBusy(false) }
  }

  async functionticketAdmin(ticketId:string, action:string, message?:string) {
    setBusy(true)
    try{
      const res= awaitapi<{ message: string}>('/api/admin/support', { method:'POST', body:{ ticketId, action, message} })
      showFlash(res.message)
      awaitloadSupport(supportFilter)
    } catch(e) {
      showFlash(e instanceofError? e.message :'Failed', 'error')
    } finally{ setBusy(false) }
  }

  async functionuserAction(userId:string, action:string, extra?:Record<string, unknown>) {
    setBusy(true)
    try{
      const res= awaitapi<{ message: string}>('/api/admin/users', {
        method:'POST', body:{ userId, action, ...extra},
      })
      showFlash(res.message)
      awaitloadAll()
      awaitrefresh()
    } catch(e) {
      showFlash(e instanceofError? e.message :'Failed', 'error')
    } finally{
      setBusy(false)
    }
  }

  async functionwdAction(id:string, action:string) {
    setBusy(true)
    try{
      const res= awaitapi<{ message: string}>('/api/admin/withdrawals', {
        method:'POST', body:{ id, action},
      })
      showFlash(res.message)
      awaitloadAll()
    } catch(e) {
      showFlash(e instanceofError? e.message :'Failed', 'error')
    } finally{
      setBusy(false)
    }
  }

  //Phase 34— deposits verification async functiondepAction(id:string, action:'approve' | 'reject') {
    setBusy(true)
    try{
      const res= awaitapi<{ message: string}>('/api/admin/deposits', {
        method:'POST', body:{ id, action, note:depNote|| undefined},
      })
      showFlash(res.message)
      setDepNote('')
      awaitloadFinance()
      awaitloadAll()
      awaitrefresh()
    } catch(e) {
      showFlash(e instanceofError? e.message :'Failed', 'error')
    } finally{
      setBusy(false)
    }
  }

  async functionsavePaySettings() {
    setBusy(true)
    try{
      const res= awaitapi<{ message: string}>('/api/admin/payment-settings', {
        method:'POST', body:{ methods:payMethods},
      })
      showFlash(res.message)
    } catch(e) {
      showFlash(e instanceofError? e.message :'Failed', 'error')
    } finally{
      setBusy(false)
    }
  }

  async functionsaveConfig() {
    setBusy(true)
    try{
      const res= awaitapi<{ message: string}>('/api/admin/config', { method:'POST', body:{ config} })
      showFlash(res.message)
    } catch(e) {
      showFlash(e instanceofError? e.message :'Failed', 'error')
    } finally{ setBusy(false) }
  }

  //Phase 26— instant single-switch save for emergency controls async functionsaveConfigQuick(key:string, value:number) {
    setConfig(c=> ({ ...c, [key]:String(value) }))
    setBusy(true)
    try{
      awaitapi('/api/admin/config', { method:'POST', body:{ config:{ [key]: value} } })
      showFlash(`⚙️ ${key} → ${value=== 1? 'ENABLED' :'disabled'}`)
      awaitrefresh()
    } catch(e) {
      showFlash(e instanceofError? e.message :'Failed', 'error')
    } finally{ setBusy(false) }
  }

  async functioncreateEvent() {
    setBusy(true)
    try{
      const res= awaitapi<{ message: string}>('/api/admin/events', {
        method:'POST',
        body:{ action:'create', name:evName, description:evDesc, multiplier:Number(evMult), days:Number(evDays) },
      })
      showFlash(res.message)
      setEvName(''); setEvDesc('')
      awaitloadAll()
      awaitrefresh()
    } catch(e) {
      showFlash(e instanceofError? e.message :'Failed', 'error')
    } finally{ setBusy(false) }
  }

  async functioneventAction(id:string, action:string) {
    setBusy(true)
    try{
      const res= awaitapi<{ message: string}>('/api/admin/events', { method:'POST', body:{ action, id} })
      showFlash(res.message)
      awaitloadAll()
      awaitrefresh()
    } catch(e) {
      showFlash(e instanceofError? e.message :'Failed', 'error')
    } finally{ setBusy(false) }
  }

  async functionbroadcast() {
    setBusy(true)
    try{
      const res= awaitapi<{ message: string}>('/api/admin/broadcast', {
        method:'POST', body:{ title:bcTitle, message:bcMsg},
      })
      showFlash(res.message)
      setBcTitle(''); setBcMsg('')
    } catch(e) {
      showFlash(e instanceofError? e.message :'Failed', 'error')
    } finally{ setBusy(false) }
  }

  return(
    <motion.divinitial={{ x:'100%' }} animate={{ x: 0}}
      className="fixed inset-0 z-50 flex flex-colbg-stone-100"
    >
      {/* header*/}
      <div className="flex items-center gap-2 border-b border-stone-200 bg-gradient-to-r from-red-600 to-rose-700 px-4 py-3 text-white  shadow-lg">
        <button onClick={() => setAdminOpen(false)}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-lg font-blackactive:scale-95"
          aria-label="Close adminpanel"
        >
          ✕
        </button>
        <div className="flex-1">
          <p className="text-sm font-black">🛡️ SUPER ADMIN</p>
          <p className="text-[10px]text-red-100">HenFarmTycoonControlCenter</p>
        </div>
        <span className={cn(
          'rounded-full px-2 py-1 text-[9px] font-black uppercase',
          stats?.stats.serverStatus=== 'healthy' ? 'bg-green-900/20text-green-200' :'bg-red-400/20'
        )}>
          ● {stats?.stats.serverStatus?? '...'}
        </span>
      </div>

      {/* tabs*/}
      <div className="flex gap-1 overflow-x-auto border-b border-stone-200 bg-white px-2 py-2">
        {([['dashboard', '📊 Dash'],
          ['analytics', '📈 Analytics'],
          ['games', '🎮 Games'],
          ['support', `🎫 Support${support?.counts.open? ` (${support.counts.open})` :''}`],
          ['users', '👥 Users'],
          ['withdrawals', `💸 Payouts${stats?.stats.pendingWithdrawals? ` (${stats.stats.pendingWithdrawals})` :''}`],
          ['finance', `📥 Deposits${stats?.stats.pendingDeposits? ` (${stats.stats.pendingDeposits})` :''}`],
          ['economy', '💰 Economy'],
          ['events', '🎉 Events'],
          ['broadcast', '📢 Notify'],
          ['security', '🔐 Security'],
        ] as[Tab, string][]).map(([t, label]) => (
          <buttonkey={t}
            onClick={() => setTab(t)}
            className={cn(
              'shrink-0 rounded-full px-3 py-1.5 text-[11px] font-extrabold transition-all',
              tab=== t? 'bg-red-600 text-white  shadow' :'bg-stone-100  text-stone-500'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-3 pb-8">
        {/* ════════ DASHBOARD ════════ */}
        {tab=== 'dashboard' && (!stats? <LoadingSpinnerlabel="Loading platformdata..." /> :(
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <StatCardicon="👥" label="TotalUsers" value={stats.stats.totalUsers} tone="green" sub={`+${stats.stats.newToday} today`} />
              <StatCardicon="🟢" label="ActiveToday" value={stats.stats.activeToday} tone="teal" />
              <StatCardicon="🐔" label="HensOwned" value={stats.stats.totalHens} tone="amber" />
              <StatCardicon="🐄" label="Animals" value={stats.stats.totalAnimals} tone="lime" />
              <StatCardicon="🐣" label="EggsHatched" value={stats.stats.totalEggsHatched} tone="orange" sub={`${stats.stats.totalEggsInInventory} instorage/incubators`} />
              <StatCardicon="🏪" label="MarketSales" value={stats.stats.marketSales} tone="purple" />
              <StatCardicon="🪙" label="Coins inCirculation" value={stats.stats.coinsInCirculation} tone="amber" sub={`💎 ${stats.stats.gemsInCirculation} gems`} />
              <StatCardicon="💸" label="Withdrawn(approved)" value={stats.stats.totalWithdrawn} tone="red" sub={`${stats.stats.pendingWithdrawals} pending`} />
              <StatCardicon="💳" label="TotalRevenue" value={Math.round(stats.stats.revenueCents /100)} tone="pink" sub={`$${(stats.stats.todayRevenueCents /100).toFixed(2)} today· ${stats.stats.purchaseCount} orders`} />
              <StatCardicon="👑" label="VIP Members" value={stats.stats.vipCount} tone="amber" sub="activesubscriptions" />
              <StatCardicon="📥" label="TotalDeposits" value={Math.round(stats.stats.totalDepositCents /100)} tone="green" sub={`${stats.stats.depositCount} verified· ${stats.stats.pendingDeposits} pending`} />
              <StatCardicon="🏷️" label="W/D FeesCollected" value={stats.stats.wdFeesCollected} tone="red" sub="coins kept as processingfee" />
            </div>

            <GameCard>
              <p className="mb-2 text-xs font-blacktext-stone-700">📈 NewUsers(last 14days)</p>
              <div className="h-44">
                <ResponsiveContainerwidth="100%" height="100%">
                  <LineChartdata={stats.growth}>
                    <CartesianGridstrokeDasharray="33" stroke="#e7e5e4" />
                    <XAxisdataKey="date" tick={{ fontSize: 10}} />
                    <YAxistick={{ fontSize: 10}} allowDecimals={false} />
                    <TooltipcontentStyle={{ fontSize:12, borderRadius: 12}} />
                    <Linetype="monotone" dataKey="users" stroke="#16a34a" strokeWidth={3} dot={{ r: 3}} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </GameCard>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <GameCard>
                <p className="mb-2 text-xs font-blacktext-stone-700">💰 TopCoinHolders</p>
                <div className="h-40">
                  <ResponsiveContainerwidth="100%" height="100%">
                    <BarChartdata={stats.topHolders} layout="vertical">
                      <XAxistype="number" hide/>
                      <YAxisdataKey="username" type="category" tick={{ fontSize: 10}} width={80} />
                      <TooltipcontentStyle={{ fontSize:12, borderRadius: 12}} />
                      <BardataKey="coins" fill="#eab308" radius={[0, 8, 8, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </GameCard>

              <GameCard>
                <p className="mb-2 text-xs font-blacktext-stone-700">📊 CoinFlow byType(7d)</p>
                <div className="h-40">
                  <ResponsiveContainerwidth="100%" height="100%">
                    <PieChart>
                      <Piedata={Object.entries(stats.txByType).map(([k, v]) => ({ name:k, value: v}))}
                        dataKey="value" nameKey="name" innerRadius={30} outerRadius={60}
                        paddingAngle={2}
                      >
                        {Object.entries(stats.txByType).map((_, i) => (
                          <Cellkey={i} fill={PIE_COLORS[i% PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <TooltipcontentStyle={{ fontSize:11, borderRadius: 12}} />
                      <LegendwrapperStyle={{ fontSize: 9}} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </GameCard>
            </div>

            <GameCard>
              <p className="text-xs font-blacktext-stone-700">🖥️ System</p>
              <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] font-boldtext-stone-500">
                <p>Total transactions:<b className="text-stone-700">{stats.stats.totalTransactions.toLocaleString()}</b></p>
                <p>Server:<b className="text-green-600">operational</b></p>
                <p>Database:<b className="text-green-600">SQLite· healthy</b></p>
                <p>Uptime:<b className="text-stone-700">stable</b></p>
              </div>
            </GameCard>
          </div>
        ))}

        {/* ════════ USERS ════════ */}
        {tab=== 'users' && (
          <div className="space-y-2">
            <Inputvalue={search}
              onChange={e=> setSearch(e.target.value)}
              placeholder="🔍 Search by username or farmname..."
              className="h-10 rounded-xl border-stone-200bg-white"
            />
            {users.map(u=> (
              <UserRowkey={u.id} u={u} busy={busy} onAction={userAction} onDone={loadAll} />
            ))}
            {users.length=== 0&& <GameCard><EmptyStateemoji="🔍" title="No usersfound" /></GameCard>}
          </div>
        )}

        {/* ════════ WITHDRAWALS (payoutqueue) ════════ */}
        {tab=== 'withdrawals' && (
          wds.length=== 0? (
            <GameCard><EmptyStateemoji="💸" title="No withdrawalrequests" sub="Player payout requests appearhere" /></GameCard>
          ) :(
            <div className="space-y-2">
              {wds.map(w=> (
                <GameCardkey={w.id} className={cn(w.status=== 'pending' && 'border-amber-300bg-amber-50/50')}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-blacktext-stone-800">🪙 {w.amount.toLocaleString()} · {w.method.toUpperCase()}</p>
                      <p className="text-[11px]text-stone-500">@{w.username}</p>
                      <p className="text-[11px] font-boldtext-stone-600">👤 {w.accountTitle|| '—'}{w.bankName? ` · 🏦 ${w.bankName}` :''}</p>
                      <p className="truncate text-[10px]text-stone-600">📍 {w.address}</p>
                      <p className="text-[10px] font-boldtext-green-700">Payout after fee:🪙 {(w.amount -w.fee).toLocaleString()} (fee🪙 {w.fee.toLocaleString()})</p>
                      <p className="text-[9px]text-stone-600">{newDate(w.createdAt).toLocaleString()}</p>
                    </div>
                    <span className={cn(
                      'shrink-0 rounded-full px-2 py-0.5 text-[9px] font-black uppercase',
                      w.status=== 'approved' ? 'bg-green-100  text-green-700'
                        : w.status=== 'rejected' ? 'bg-red-100  text-red-600'
                        : w.status=== 'hold' ? 'bg-amber-200  text-amber-800'
                        :'bg-stone-200  text-stone-500'
                    )}>
                      {w.status}
                    </span>
                  </div>
                  {(w.status=== 'pending' || w.status=== 'hold') && (
                    <div className="mt-2 flex gap-1.5">
                      <Buttonsize="sm" disabled={busy} onClick={() => wdAction(w.id, 'approve')}
                        className="h-8 flex-1 rounded-lg bg-green-700 text-[11px] font-extrabold text-white">
                        ✅ Approve</Button>
                      <Buttonsize="sm" variant="outline" disabled={busy} onClick={() => wdAction(w.id, 'hold')}
                        className="h-8 flex-1 rounded-lg text-[11px] font-bold">
                        ⏸ Hold</Button>
                      <Buttonsize="sm" disabled={busy} onClick={() => wdAction(w.id, 'reject')}
                        className="h-8 flex-1 rounded-lg bg-red-700 text-[11px] font-extrabold text-white">
                        ❌ Reject</Button>
                    </div>
                  )}
                </GameCard>
              ))}
            </div>
          )
        )}

        {/* ════════ FINANCE — deposits verification+ payment accounts(Phase34) ════════ */}
        {tab=== 'finance' && (
          <div className="space-y-2">
            {/* finance stat cards*/}
            <div className="grid grid-cols-2 gap-2">
              <StatCardicon="📥" label="DepositsApproved" value={USD(depStats?.totalApprovedCents?? 0)} tone="green" sub="real moneyin" />
              <StatCardicon="⏳" label="PendingDeposits" value={depStats?.pendingCount?? 0} tone="orange" sub="awaitingverification" />
              <StatCardicon="🪙" label="CoinsIssued" value={(depStats?.coinsIssued?? 0).toLocaleString()} tone="amber" sub="incl. depositbonuses" />
              <StatCardicon="🏷️" label="W/D FeesCollected" value={(stats?.stats.wdFeesCollected?? 0).toLocaleString()} tone="red" sub="processing feerevenue" />
            </div>

            {/* deposit verification queue*/}
            <GameCard>
              <div className="flex items-center justify-between">
                <p className="text-sm font-blacktext-stone-800">📥 DepositVerification</p>
                <div className="flex gap-1">
                  {(['pending', 'approved', 'rejected', 'all'] asconst).map(f=> (
                    <buttonkey={f}
                      onClick={() => setDepFilter(f)}
                      className={cn('rounded-full px-2 py-1 text-[9px] font-black uppercase', depFilter=== f? 'bg-red-600  text-white' :'bg-stone-100  text-stone-500')}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>
              <p className="mt-0.5 text-[11px]text-stone-500">Verify the receipt reference+ payment proof against the deposit account beforeapproving.</p>
            </GameCard>

            {deposits.length=== 0&& (
              <GameCard><EmptyStateemoji="📥" title="No depositshere" sub="Player manual payments appear in thisqueue" /></GameCard>
            )}
            {deposits.map(d=> (
              <GameCardkey={d.id} className={cn(d.status=== 'pending' && 'border-amber-300bg-amber-50/50')}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-blacktext-stone-800">{USD(d.amountCents)} → 🪙 {(d.coins+ d.bonusCoins).toLocaleString()}</p>
                    <p className="text-[11px]text-stone-500">@{d.username} · {d.method.toUpperCase()}</p>
                    <p className="text-[11px] font-boldtext-stone-600">👤 Sender:{d.senderName}</p>
                    <p className="truncate text-[10px]text-stone-600">🔖 Ref:{d.reference}</p>
                    {d.bonusCoins> 0&& <p className="text-[10px] font-boldtext-green-700">Includes+{d.bonusCoins.toLocaleString()} bonuscoins</p>}
                    {d.note&& <p className="text-[10px]text-red-400">Note:{d.note}</p>}
                    <p className="text-[9px]text-stone-600">{newDate(d.createdAt).toLocaleString()}{d.processedBy? ` · by${d.processedBy}` :''}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className={cn(
                      'rounded-full px-2 py-0.5 text-[9px] font-black uppercase',
                      d.status=== 'approved' ? 'bg-green-100  text-green-700'
                        : d.status=== 'rejected' ? 'bg-red-100  text-red-600'
                        :'bg-amber-100  text-amber-700'
                    )}>
                      {d.status}
                    </span>
                    {d.proof&& (
                      <button onClick={() => setProofView(d)}
                        className="rounded-full bg-stone-100 px-2 py-1 text-[9px] font-black text-stone-600active:scale-95"
                      >
                        🖼️ View proof</button>
                    )}
                  </div>
                </div>
                {d.proof&& d.proof.length< 400_000&& (
                  <button onClick={() => setProofView(d)} className="mt-2 block w-full">
                    <imgsrc={d.proof} alt="Paymentproof" className="h-28 w-full rounded-lg border border-stone-200object-cover" />
                  </button>
                )}
                {d.status=== 'pending' && (
                  <div className="mt-2 space-y-1.5">
                    <Inputvalue={depNote} onChange={e=> setDepNote(e.target.value)} placeholder="Note on reject(optional, sent toplayer)" className="h-8 rounded-lg bg-stone-50  text-[11px]" />
                    <div className="flex gap-1.5">
                      <Buttonsize="sm" disabled={busy} onClick={() => depAction(d.id, 'approve')}
                        className="h-8 flex-1 rounded-lg bg-green-600 text-[11px] font-extrabold text-white">
                        ✅ Verify& Credit</Button>
                      <Buttonsize="sm" disabled={busy} onClick={() => depAction(d.id, 'reject')}
                        className="h-8 flex-1 rounded-lg bg-red-500 text-[11px] font-extrabold text-white">
                        ❌ Reject</Button>
                    </div>
                  </div>
                )}
              </GameCard>
            ))}

            {/* payment accounts editor*/}
            <GameCard>
              <p className="text-sm font-blacktext-stone-800">🏦 DepositAccountDetails</p>
              <p className="mb-2 text-[11px]text-stone-500">Players copy these accounts when paying.Toggle methods on/offanytime.</p>
              <div className="space-y-2">
                {payDefs.map(def=> {
                  const acc= payMethods[def.key]?? { enabled: false}
                  return(
                    <divkey={def.key} className={cn('rounded-xl borderp-2.5', acc.enabled? 'border-green-200bg-green-50/50' :'border-stone-200bg-stone-50')}>
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-blacktext-stone-700">{def.emoji} {def.name}</p>
                        <button onClick={() => setPayMethods(m=> ({ ...m, [def.key]:{ ...acc, enabled:!acc.enabled} }))}
                          className={cn('rounded-full px-3 py-1 text-[9px] font-black uppercase',
                            acc.enabled? 'bg-green-700  text-white' :'bg-stone-300  text-stone-600')}
                        >
                          {acc.enabled? 'enabled' :'disabled'}
                        </button>
                      </div>
                      <div className="mt-1.5 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                        {def.fields.map(f=> (
                          <divkey={f.key}>
                            <Label className="text-[9px] font-boldtext-stone-500">{f.label}</Label>
                            <Inputvalue={String(acc[f.key]?? '')}
                              onChange={e=> setPayMethods(m=> ({ ...m, [def.key]:{ ...acc, [f.key]: e.target.value} }))}
                              className="mt-0.5 h-8 rounded-lg border-stone-200 bg-white text-[11px]"
                              placeholder={f.placeholder}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
              <Button onClick={savePaySettings} disabled={busy} className="mt-3 h-10 w-full rounded-xl bg-green-700 font-extrabold text-white">
                💾 SavePaymentAccounts</Button>
            </GameCard>
          </div>
        )}

        {/* ════════ ECONOMY ════════ */}
        {tab=== 'economy' && (
          <div className="space-y-2">
            {/* Phase 26— EmergencyMode*/}
            <GameCard className="border-red-200bg-red-50/60">
              <p className="text-sm font-blacktext-red-700">🚨 EmergencyMode</p>
              <p className="mb-2 text-[11px]text-red-500">Live control center— switches apply instantly forALL players.</p>
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                <button onClick={() => saveConfigQuick('maintenanceMode', config.maintenanceMode=== '1' ? 0 :1)}
                  className={cn('rounded-xl border-2 px-2 py-2 text-[10px] font-black leading-tight',
                    config.maintenanceMode=== '1' ? 'border-red-500 bg-red-700  text-white' :'border-stone-200 bg-whitetext-stone-500')}
                >
                  🛠️ Maintenance<br/>{config.maintenanceMode=== '1' ? 'ON' :'OFF'}
                </button>
                <button onClick={() => saveConfigQuick('withdrawalsDisabled', config.withdrawalsDisabled=== '1' ? 0 :1)}
                  className={cn('rounded-xl border-2 px-2 py-2 text-[10px] font-black leading-tight',
                    config.withdrawalsDisabled=== '1' ? 'border-red-500 bg-red-700  text-white' :'border-stone-200 bg-whitetext-stone-500')}
                >
                  💸 StopWithdrawals<br/>{config.withdrawalsDisabled=== '1' ? 'STOPPED' :'ALLOWED'}
                </button>
                <button onClick={() => saveConfigQuick('marketplaceDisabled', config.marketplaceDisabled=== '1' ? 0 :1)}
                  className={cn('rounded-xl border-2 px-2 py-2 text-[10px] font-black leading-tight',
                    config.marketplaceDisabled=== '1' ? 'border-red-500 bg-red-700  text-white' :'border-stone-200 bg-whitetext-stone-500')}
                >
                  🏪 FreezeMarket<br/>{config.marketplaceDisabled=== '1' ? 'FROZEN' :'OPEN'}
                </button>
                <button onClick={() => saveConfigQuick('depositsDisabled', config.depositsDisabled=== '1' ? 0 :1)}
                  className={cn('rounded-xl border-2 px-2 py-2 text-[10px] font-black leading-tight',
                    config.depositsDisabled=== '1' ? 'border-red-500 bg-red-700  text-white' :'border-stone-200 bg-whitetext-stone-500')}
                >
                  📥 StopDeposits<br/>{config.depositsDisabled=== '1' ? 'STOPPED' :'ALLOWED'}
                </button>
              </div>
            </GameCard>

            <GameCard>
              <p className="text-sm font-blacktext-stone-800">💰 EconomySettings</p>
              <p className="mb-3 text-[11px]text-stone-500">Changes apply instantly across the wholeplatform.</p>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(config).map(([key, value]) => (
                  <divkey={key}>
                    <Label className="text-[10px] font-boldtext-stone-500">{key}</Label>
                    <Inputtype="number"
                      value={value}
                      onChange={e=> setConfig(c=> ({ ...c, [key]: e.target.value}))}
                      className="mt-0.5 h-9 rounded-lg border-stone-200 bg-stone-50  text-xs"
                    />
                  </div>
                ))}
              </div>
              <Button onClick={saveConfig} disabled={busy} className="mt-3 h-10 w-full rounded-xl bg-green-600 font-extrabold text-white">
                💾 SaveSettings</Button>
            </GameCard>

            <GameCard>
              <p className="text-sm font-blacktext-stone-800">🧮 EconomyRulesReference</p>
              <ul className="mt-2 space-y-1 text-[11px]text-stone-500">
                <li>• <b>startingBalance</b> — coins given to new farmers onregistration</li>
                <li>• <b>globalProduction</b> — % multiplier on all egg& animal production(100= normal)</li>
                <li>• <b>marketFeePct</b> — platform fee taken from marketplacesales</li>
                <li>• <b>withdrawalMin</b> — minimum coins a player must request towithdraw</li>
                <li>• <b>gemToCoins</b> — exchange rate: 1💎 = N 🪙</li>
                <li>• <b>referralBonus</b> — coins granted to both parties on a newreferral</li>
                <li>• <b>maintenanceMode</b> — 1= game paused for players(adminsunaffected)</li>
                <li>• <b>withdrawalsDisabled</b> — 1= payout requests blocked(emergencymode)</li>
                <li>• <b>marketplaceDisabled</b> — 1= market listing& buyingblocked</li>
                <li>• <b>arcadeRewardsEnabled</b> — 0= mini games pay 0 rewards(killswitch)</li>
                <li>• <b>coinsPerUsd</b> — conversion rate for cash deposits($1= N coins)</li>
                <li>• <b>depositMinCents /depositMaxCents</b> — deposit limits inUSD cents</li>
                <li>• <b>firstDepositBonusPct</b> — extra bonus% on aplayer's firstdeposit</li>
                <li>• <b>wdFeePct</b> — withdrawal processing fee in basis points(200= 2%)</li>
                <li>• <b>wdMaxCoins</b> — max coins per withdrawalrequest</li>
                <li>• <b>depositsDisabled</b> — 1= deposit submissions blocked(emergencymode)</li>
              </ul>
            </GameCard>
          </div>
        )}

        {/* ════════ EVENTS ════════ */}
        {tab=== 'events' && (
          <div className="space-y-2">
            <GameCard>
              <p className="text-sm font-blacktext-stone-800">🎉 CreateEvent</p>
              <p className="text-[11px]text-stone-500">All farmers get notified when an event goeslive.</p>
              <div className="mt-2 space-y-2">
                <Inputvalue={evName} onChange={e=> setEvName(e.target.value)} placeholder="Event name e.g.DoubleEggWeekend" className="h-9 rounded-lg bg-stone-50  text-xs" />
                <Inputvalue={evDesc} onChange={e=> setEvDesc(e.target.value)} placeholder="Shortdescription" className="h-9 rounded-lg bg-stone-50  text-xs" />
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-[10px] font-boldtext-stone-500">Multiplier% (100-500)</Label>
                    <Inputtype="number" value={evMult} onChange={e=> setEvMult(e.target.value)} className="mt-0.5 h-9 rounded-lg bg-stone-50  text-xs" />
                  </div>
                  <div>
                    <Label className="text-[10px] font-boldtext-stone-500">Duration(days)</Label>
                    <Inputtype="number" value={evDays} onChange={e=> setEvDays(e.target.value)} className="mt-0.5 h-9 rounded-lg bg-stone-50  text-xs" />
                  </div>
                </div>
                <Button onClick={createEvent} disabled={busy|| !evName} className="h-10 w-full rounded-xl bg-amber-800 font-extrabold text-white">
                  🚀 LaunchEvent</Button>
              </div>
            </GameCard>

            {events.map(ev=> (
              <GameCardkey={ev.id} className={cn(!ev.active&& 'opacity-60')}>
                <div className="flex items-start justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-blacktext-stone-800">{ev.name}</p>
                    <p className="text-[11px]text-stone-500">{ev.description}</p>
                    <p className="mt-0.5 text-[10px] font-boldtext-amber-600">×{(ev.multiplier /100).toFixed(1)} · ends{newDate(ev.endsAt).toLocaleDateString()}</p>
                  </div>
                  <div className="flex shrink-0 flex-colgap-1">
                    <span className={cn('rounded-full px-2 py-0.5 text-center text-[9px] font-black uppercase', ev.active? 'bg-green-100  text-green-700' :'bg-stone-200  text-stone-500')}>
                      {ev.active? 'live' :'off'}
                    </span>
                    <button onClick={() => eventAction(ev.id, 'toggle')} disabled={busy}
                      className="rounded-full bg-stone-100 px-2 py-0.5 text-[9px] font-boldtext-stone-600">
                      {ev.active? 'Stop' :'Start'}
                    </button>
                    <button onClick={() => eventAction(ev.id, 'delete')} disabled={busy}
                      className="rounded-full bg-red-50 px-2 py-0.5 text-[9px] font-boldtext-red-500">
                      Delete</button>
                  </div>
                </div>
              </GameCard>
            ))}
          </div>
        )}

        {/* ════════ BROADCAST ════════ */}
        {tab=== 'broadcast' && (
          <div className="space-y-2">
            <GameCard>
              <p className="text-sm font-blacktext-stone-800">📢 BroadcastNotification</p>
              <p className="text-[11px]text-stone-500">Sends an in-game alert to every farmerinstantly.</p>
              <div className="mt-2 space-y-2">
                <Inputvalue={bcTitle} onChange={e=> setBcTitle(e.target.value)} placeholder="Title e.g.🎁 Free gemstoday!" className="h-9 rounded-lg bg-stone-50  text-xs" />
                <textareavalue={bcMsg}
                  onChange={e=> setBcMsg(e.target.value)}
                  placeholder="Messagebody..."
                  rows={3}
                  className="w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-xs focus:outline-none focus:ring-2focus:ring-green-500"
                />
                <Button onClick={broadcast} disabled={busy|| !bcTitle|| !bcMsg} className="h-10 w-full rounded-xl bg-red-600 font-extrabold text-white">
                  📤 Send toAllFarmers</Button>
              </div>
            </GameCard>
          </div>
        )}

        {/* ════════ ANALYTICS (Phase18) ════════ */}
        {tab=== 'analytics' && (!analytics? <LoadingSpinnerlabel="Crunchingnumbers..." /> :(
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <StatCardicon="🔁" label="D1Retention" value={analytics.retention.d1} tone="green" sub="% of new users returning nextday" />
              <StatCardicon="📅" label="D3Retention" value={analytics.retention.d3} tone="teal" sub="% active3+ days afterjoining" />
              <StatCardicon="📱" label="Sessions / user(7d)" value={analytics.retention.sessionsPerUser} tone="lime" sub={`${analytics.retention.totalSessions7d} sessionstotal`} />
              <StatCardicon="👑" label="VIP Members" value={analytics.vipCount} tone="amber" />
              <StatCardicon="🪙" label="CoinsGenerated14d" value={analytics.economyHealth.totalGenerated14d} tone="orange" />
              <StatCardicon="🔥" label="CoinsBurned14d" value={analytics.economyHealth.totalSpent14d} tone="red" sub={
                analytics.economyHealth.signal=== 'inflation-warning' ? '⚠️ inflationrisk'
                  :analytics.economyHealth.signal=== 'deflation' ? '❄️ deflation'
                  :'✅ balancedflow'
              } />
            </div>

            <GameCard>
              <p className="mb-2 text-xs font-blacktext-stone-700">👥 DailyActiveUsers(14d)</p>
              <div className="h-44">
                <ResponsiveContainerwidth="100%" height="100%">
                  <LineChartdata={analytics.dauSeries}>
                    <CartesianGridstrokeDasharray="33" stroke="#e7e5e4" />
                    <XAxisdataKey="date" tick={{ fontSize: 10}} />
                    <YAxistick={{ fontSize: 10}} allowDecimals={false} />
                    <TooltipcontentStyle={{ fontSize:12, borderRadius: 12}} />
                    <LegendwrapperStyle={{ fontSize: 9}} />
                    <Linetype="monotone" dataKey="dau" stroke="#0d9488" strokeWidth={3} dot={{ r: 2}} name="DAU" />
                    <Linetype="monotone" dataKey="newUsers" stroke="#16a34a" strokeWidth={2} dot={{ r: 2}} name="Newusers" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </GameCard>

            <GameCard>
              <p className="mb-2 text-xs font-blacktext-stone-700">💰 CoinFlow:Generated vsSpent(14d)</p>
              <div className="h-44">
                <ResponsiveContainerwidth="100%" height="100%">
                  <BarChartdata={analytics.economySeries}>
                    <CartesianGridstrokeDasharray="33" stroke="#e7e5e4" />
                    <XAxisdataKey="date" tick={{ fontSize: 10}} />
                    <YAxistick={{ fontSize: 10}} />
                    <TooltipcontentStyle={{ fontSize:12, borderRadius: 12}} />
                    <LegendwrapperStyle={{ fontSize: 9}} />
                    <BardataKey="generated" fill="#22c55e" radius={[4, 4, 0, 0]} name="Generated" />
                    <BardataKey="spent" fill="#ef4444" radius={[4, 4, 0, 0]} name="Spent" />
                    <BardataKey="marketVolume" fill="#8b5cf6" radius={[4, 4, 0, 0]} name="Marketvolume" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </GameCard>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <GameCard>
                <p className="mb-2 text-xs font-blacktext-stone-700">💳 Revenue(14d, USD)</p>
                <div className="h-40">
                  <ResponsiveContainerwidth="100%" height="100%">
                    <BarChartdata={analytics.revenueSeries}>
                      <CartesianGridstrokeDasharray="33" stroke="#e7e5e4" />
                      <XAxisdataKey="date" tick={{ fontSize: 9}} />
                      <YAxistick={{ fontSize: 10}} />
                      <TooltipcontentStyle={{ fontSize:12, borderRadius: 12}} formatter={(v:number) => [`$${(v /100).toFixed(2)}`, 'revenue']} />
                      <BardataKey="revenueCents" fill="#ec4899" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </GameCard>

              <GameCard>
                <p className="mb-2 text-xs font-blacktext-stone-700">🥚 EggEconomy(14d)</p>
                <div className="h-40">
                  <ResponsiveContainerwidth="100%" height="100%">
                    <LineChartdata={analytics.eggSeries}>
                      <CartesianGridstrokeDasharray="33" stroke="#e7e5e4" />
                      <XAxisdataKey="date" tick={{ fontSize: 9}} />
                      <YAxistick={{ fontSize: 10}} />
                      <TooltipcontentStyle={{ fontSize:12, borderRadius: 12}} />
                      <LegendwrapperStyle={{ fontSize: 9}} />
                      <Linetype="monotone" dataKey="laid" stroke="#eab308" strokeWidth={2} dot={false} name="Laid" />
                      <Linetype="monotone" dataKey="hatched" stroke="#f97316" strokeWidth={2} dot={false} name="Hatched" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </GameCard>
            </div>

            <GameCard>
              <p className="text-xs font-blacktext-stone-700">🏆 TopSpenders(14d)</p>
              {analytics.topSpenders.length=== 0? (
                <p className="mt-2 text-[11px]text-stone-600">No purchases yet— revenue charts fill in as players buygems/VIP.</p>
              ) :(
                <div className="mt-2 space-y-1">
                  {analytics.topSpenders.map((s, i) => (
                    <divkey={s.userId} className="flex items-center justify-between rounded-lg bg-stone-50 px-2 py-1.5 text-[11px]">
                      <span className="font-blacktext-stone-600">{i+ 1}.@{s.username}</span>
                      <span className="font-boldtext-stone-500">{s.count} orders· <b className="text-pink-600">${(s.cents /100).toFixed(2)}</b></span>
                    </div>
                  ))}
                </div>
              )}
            </GameCard>

            <GameCard>
              <p className="text-xs font-blacktext-stone-700">📦 Revenue bySKU</p>
              <div className="mt-2 space-y-1">
                {analytics.revenueBySku.length=== 0? (
                  <p className="text-[11px]text-stone-600">No datayet.</p>
                ) :analytics.revenueBySku.map(s=> (
                  <divkey={s.sku} className="flex items-center justify-between rounded-lg bg-stone-50 px-2 py-1.5 text-[11px]">
                    <span className="font-blacktext-stone-600">{s.sku}</span>
                    <span className="font-boldtext-stone-500">×{s.count} · ${(s.cents /100).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </GameCard>
          </div>
        ))}

        {/* ════════ SECURITY (Phase16) ════════ */}
        {tab=== 'security' && (!security? <LoadingSpinnerlabel="Checkingsecurity..." /> :(
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <StatCardicon="🚩" label="FlaggedAccounts" value={security.summary.flaggedCount} tone="red" />
              <StatCardicon="🤖" label="Rate-limitHits" value={security.summary.rateLimitedCount} tone="amber" />
              <StatCardicon="🏷️" label="PriceAbuseBlocks" value={security.summary.priceAbuseCount} tone="purple" />
              <StatCardicon="🛡️" label="StaffAccounts" value={security.summary.adminCount} tone="teal" />
            </div>

            <GameCard className="bg-gradient-to-r from-red-50to-white">
              <p className="text-xs font-blacktext-stone-700">🔐 My role:{security.me.roleLabel}</p>
              <p className="mt-1 text-[10px] font-boldtext-stone-500">Permissionmatrix:</p>
              <div className="mt-1 space-y-0.5">
                {security.roleMatrix.map(r=> (
                  <pkey={r.role} className={cn('text-[10px] font-bold', r.role=== security.me.role? 'text-red-700' :'text-stone-600')}>
                    {r.roleLabel}:{r.perms.includes('*') ? 'ALL permissions' :r.perms.join(', ')}
                  </p>
                ))}
              </div>
            </GameCard>

            {security.flagged.length> 0&& (
              <GameCard className="border-red-300bg-red-50/50">
                <p className="text-xs font-blacktext-red-700">🚩 FlaggedAccounts</p>
                <div className="mt-2 space-y-1">
                  {security.flagged.map(f=> (
                    <divkey={f.id} className="flex items-center justify-between rounded-lg bg-white px-2 py-1.5 text-[11px]">
                      <div className="min-w-0">
                        <p className="truncate font-blacktext-stone-700">{f.avatar} {f.farmName} <span className="font-normaltext-stone-600">@{f.username}</span></p>
                        <p className="truncate text-[10px]text-red-500">{f.flagReason}</p>
                      </div>
                      <button onClick={async() => { awaituserAction(f.id, 'unflag'); loadSecurity() }}
                        className="shrink-0 rounded-full bg-green-100 px-2 py-1 text-[9px] font-blacktext-green-700"
                      >
                        Clear flag</button>
                    </div>
                  ))}
                </div>
              </GameCard>
            )}

            <GameCard>
              <p className="text-xs font-blacktext-stone-700">👥 StaffRoles</p>
              <p className="text-[10px]text-stone-600">Assign roles in theUsers tab(SuperAdminonly).</p>
              <div className="mt-2 space-y-1">
                {security.admins.map(a=> (
                  <divkey={a.id} className="flex items-center justify-between rounded-lg bg-stone-50 px-2 py-1.5 text-[11px]">
                    <span className="font-blacktext-stone-600">{a.farmName} <span className="font-normaltext-stone-600">@{a.username}</span></span>
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-[9px] font-blacktext-red-700">{a.roleLabel}</span>
                  </div>
                ))}
              </div>
            </GameCard>

            <GameCard>
              <p className="text-xs font-blacktext-stone-700">📋 SecurityEvents</p>
              {security.events.length=== 0? (
                <p className="mt-2 text-[11px]text-stone-600">No security events— all clean✅</p>
              ) :(
                <div className="mt-2 space-y-1">
                  {security.events.map(ev=> (
                    <divkey={ev.id} className="rounded-lg bg-stone-50 px-2 py-1.5 text-[10px]">
                      <p className="font-blacktext-stone-600">
                        <span className={cn(
                          'mr-1 rounded px-1 py-0.5 text-[8px] font-black uppercase',
                          ev.kind=== 'bot_suspect' ? 'bg-red-200  text-red-700'
                            : ev.kind=== 'price_abuse' ? 'bg-purple-200  text-purple-700'
                            :'bg-amber-200  text-amber-700'
                        )}>
                          {ev.kind}
                        </span>
                        @{ev.username}
                      </p>
                      <p className="text-stone-600">{ev.detail} · {newDate(ev.createdAt).toLocaleString()}</p>
                    </div>
                  ))}
                </div>
              )}
            </GameCard>

            <GameCard>
              <p className="text-xs font-blacktext-stone-700">🧾 AdminActivityLog</p>
              {security.logs.length=== 0? (
                <p className="mt-2 text-[11px]text-stone-600">No admin actions loggedyet.</p>
              ) :(
                <div className="mt-2 space-y-1">
                  {security.logs.map(l=> (
                    <divkey={l.id} className="rounded-lg bg-stone-50 px-2 py-1.5 text-[10px]">
                      <p className="font-blacktext-stone-600">🛡️ {l.adminName} · {l.action}</p>
                      <p className="text-stone-600">{l.detail} · {newDate(l.createdAt).toLocaleString()}</p>
                    </div>
                  ))}
                </div>
              )}
            </GameCard>
          </div>
        ))}

        {/* ════════ MINI GAMES (Phase33) ════════ */}
        {tab=== 'games' && (!miniGames? <LoadingSpinnerlabel="Loading arcadecontrol..." /> :(
          <div className="space-y-2">
            <div className="grid grid-cols-3 gap-2">
              <StatCardicon="🎮" label="TotalPlays" value={miniGames.totals.totalPlays} tone="purple" sub={`+${miniGames.totals.playsToday} today`} />
              <StatCardicon="🪙" label="CoinsAwarded" value={miniGames.totals.coinsAwarded} tone="amber" sub={`+${miniGames.totals.xpAwarded.toLocaleString()} XP`} />
              <StatCardicon="🚨" label="CheatAlerts" value={miniGames.totals.cheatedCount} tone="red" sub="rejectedsessions" />
            </div>

            {miniGames.games.map(g=> (
              <GameCardkey={g.id} className={cn(!g.enabled&& 'opacity-60')}>
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{g.emoji}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-blacktext-stone-800">{g.name}</p>
                    <p className="text-[10px]text-stone-600">
                      {g.plays} plays· ✅ {g.wins} wins· ❌ {g.losses} losses{g.rejected> 0&& <span className="font-boldtext-red-500"> · 🚨 {g.rejected} rejected</span>}
                    </p>
                  </div>
                  <button onClick={() => gameAdmin('toggle_game', { gameId: g.id})}
                    disabled={busy}
                    className={cn(
                      'rounded-full px-3 py-1.5 text-[10px] font-black text-white  disabled:opacity-40',
                      g.enabled? 'bg-red-500' :'bg-green-600'
                    )}
                  >
                    {g.enabled? '⏸ Disable' :'▶ Enable'}
                  </button>
                </div>
                <div className="mt-2 flex items-end gap-1.5">
                  <div className="w-28">
                    <Label className="text-[9px] font-boldtext-stone-600">Entry cost(⚡ energy)</Label>
                    <Inputtype="number" min={1} max={50} defaultValue={g.energyCost}
                      id={`cost-${g.id}`}
                      className="mt-0.5 h-8 rounded-lg bg-stone-50  text-xs"
                    />
                  </div>
                  <button onClick={() => {
                      const el= document.getElementById(`cost-${g.id}`) asHTMLInputElement| nullgameAdmin('set_energy_cost', { gameId:g.id, energyCost:Number(el?.value?? g.energyCost) })
                    }}
                    disabled={busy}
                    className="h-8 rounded-lg bg-stone-700 px-3 text-[10px] font-black text-white  disabled:opacity-40"
                  >
                    Save cost</button>
                </div>
              </GameCard>
            ))}

            {/* season payout*/}
            <GameCard className="bg-gradient-to-r from-amber-50to-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-blacktext-stone-800">🏆 Season{miniGames.season.monthKey} — ChampionPayout</p>
                  <p className="text-[10px]text-stone-600">Top 3 farmers by total arcade score thismonth</p>
                </div>
                <button onClick={() => gameAdmin('season_payout')}
                  disabled={busy|| miniGames.season.paid|| miniGames.season.top3.length=== 0}
                  className={cn(
                    'rounded-full px-3 py-1.5 text-[10px] font-black text-white  disabled:opacity-40',
                    miniGames.season.paid? 'bg-stone-700' :'bg-amber-800'
                  )}
                >
                  {miniGames.season.paid? '✅ Paid' :'💰 PayRewards'}
                </button>
              </div>
              <div className="mt-2 space-y-1">
                {miniGames.season.top3.length=== 0? (
                  <p className="text-[11px]text-stone-600">No arcade scores recorded this monthyet.</p>
                ) :miniGames.season.top3.map(r=> (
                  <divkey={r.userId} className="flex items-center gap-2 rounded-lg bg-white px-2 py-1.5 text-[11px]shadow-sm">
                    <span>{['🥇', '🥈', '🥉'][r.rank -1]}</span>
                    <span>{r.avatar}</span>
                    <span className="flex-1 font-blacktext-stone-700">@{r.username}</span>
                    <span className="font-bold text-purple-600tabular-nums">{r.totalScore.toLocaleString()} pts</span>
                    <span className="text-[10px]text-stone-600">→ {r.reward}</span>
                  </div>
                ))}
              </div>
            </GameCard>

            {/* cheat monitor*/}
            {miniGames.cheated.length> 0&& (
              <GameCard className="border-red-200bg-red-50/50">
                <p className="text-xs font-blacktext-red-700">🚨 CheatMonitor— ImpossibleSessions</p>
                <div className="mt-2 space-y-1">
                  {miniGames.cheated.map(c=> (
                    <divkey={c.id} className="rounded-lg bg-white px-2 py-1.5 text-[10px]">
                      <p className="font-blacktext-stone-600">
                        {c.gameKey=== 'chicken_run' ? '🏃' :'🚦'} @{c.username} {c.flagged&& <span className="rounded bg-amber-900 px-1 text-[8px] font-black text-white">🚩 FLAGGED</span>}
                      </p>
                      <p className="text-stone-600">{newDate(c.createdAt).toLocaleString()}</p>
                    </div>
                  ))}
                </div>
              </GameCard>
            )}

            {/* recent sessions*/}
            <GameCard>
              <p className="text-xs font-blacktext-stone-700">🕹️ RecentSessions</p>
              <div className="mt-2 space-y-1">
                {miniGames.recent.map(s=> (
                  <divkey={s.id} className="flex items-center gap-2 rounded-lg bg-stone-50 px-2 py-1.5 text-[10px]">
                    <span>{s.avatar}</span>
                    <span className="flex-1 truncate font-boldtext-stone-600">@{s.username}</span>
                    <span className="text-stone-600">{s.gameKey=== 'chicken_run' ? `${s.distance}m` :`${s.score} roads`}</span>
                    <span className="font-boldtext-amber-600">🪙{s.coins}</span>
                    <span className={cn(
                      'rounded px-1 text-[8px] font-black uppercase',
                      s.cheated? 'bg-red-200  text-red-700'
                        : s.result=== 'win' ? 'bg-green-200  text-green-700'
                        : s.result=== 'rejected' ? 'bg-red-200  text-red-700'
                        :'bg-stone-200  text-stone-500'
                    )}>{s.cheated? 'CHEAT' :s.result}</span>
                  </div>
                ))}
              </div>
            </GameCard>
          </div>
        ))}

        {/* ════════ SUPPORT (Phase25) ════════ */}
        {tab=== 'support' && (!support? <LoadingSpinnerlabel="Loadingtickets..." /> :(
          <div className="space-y-2">
            <div className="grid grid-cols-3 gap-2">
              <StatCardicon="📬" label="Open" value={support.counts.open} tone="amber" />
              <StatCardicon="✅" label="Answered" value={support.counts.answered} tone="green" />
              <StatCardicon="🗄️" label="Closed" value={support.counts.closed} tone="teal" />
            </div>

            <div className="flex gap-1">
              {(['open', 'answered', 'closed'] asconst).map(f=> (
                <buttonkey={f} onClick={() => setSupportFilter(f)}
                  className={cn('rounded-full px-3 py-1.5 text-[11px] font-extrabold capitalize',
                    supportFilter=== f? 'bg-red-600 text-white  shadow' :'bg-stone-100  text-stone-500')}>
                  {f}
                </button>
              ))}
            </div>

            {support.tickets.length=== 0? (
              <EmptyStateemoji="🎫" title={`No${supportFilter} tickets`} sub="Player tickets appear here in realtime" />
            ) :support.tickets.map(t=> (
              <GameCardkey={t.id} className={cn(t.status=== 'open' && 'border-amber-300')}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-blacktext-stone-800">{t.subject}</p>
                    <p className="text-[10px]text-stone-600">
                      @{t.username} · {t.category}{t.assignedTo? ` · assigned:${t.assignedTo}` :''} · {newDate(t.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <span className={cn(
                    'shrink-0 rounded-full px-2 py-0.5 text-[9px] font-black uppercase',
                    t.status=== 'open' ? 'bg-amber-100  text-amber-700'
                      : t.status=== 'answered' ? 'bg-green-100  text-green-700'
                      :'bg-stone-200  text-stone-500'
                  )}>{t.status}</span>
                </div>

                {/* thread*/}
                <div className="mt-2 max-h-40 space-y-1.5 overflow-y-auto rounded-xl bg-stone-50  p-2">
                  {t.messages.map(m=> (
                    <divkey={m.id} className={cn('flex', m.sender=== 'staff' ? 'justify-start' :'justify-end')}>
                      <div className={cn(
                        'max-w-[85%] rounded-xl px-2 py-1.5 text-[10px]',
                        m.sender=== 'staff' ? 'bg-green-100' :'bg-stone-200'
                      )}>
                        <p className="text-[8px] font-black uppercasetext-stone-600">{m.sender=== 'staff' ? `🛡️ ${m.senderName}` :m.senderName}</p>
                        {m.body}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-2 flex gap-1.5">
                  <Inputvalue={ticketReply[t.id]?? ''}
                    onChange={e=> setTicketReply(r=> ({ ...r, [t.id]: e.target.value}))}
                    placeholder="Reply asstaff..."
                    className="h-9 flex-1 rounded-lg bg-stone-50  text-xs"
                  />
                  <button onClick={() => { ticketAdmin(t.id, 'reply', ticketReply[t.id]); setTicketReply(r=> ({ ...r, [t.id]:'' })) }}
                    disabled={busy|| !ticketReply[t.id]?.trim()}
                    className="h-9 rounded-lg bg-green-700 px-3 text-[10px] font-black text-white  disabled:opacity-40"
                  >
                    Reply</button>
                  <button onClick={() => ticketAdmin(t.id, t.status=== 'closed' ? 'reopen' :'close')}
                    disabled={busy}
                    className="h-9 rounded-lg bg-stone-200 px-3 text-[10px] font-black text-stone-600disabled:opacity-40"
                  >
                    {t.status=== 'closed' ? 'Reopen' :'Close'}
                  </button>
                </div>
              </GameCard>
            ))}
          </div>
        ))}
      </div>

      {/* ════════ PAYMENT PROOF VIEWER (Phase34) ════════ */}
      {proofView&& (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70p-4"
          onClick={() => setProofView(null)}
        >
          <div className="max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-2xl bg-white p-3shadow-2xl"
            onClick={e=> e.stopPropagation()}
          >
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-blacktext-stone-800">🖼️ PaymentProof</p>
              <button onClick={() => setProofView(null)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-stone-100 text-sm font-blacktext-stone-500"
                aria-label="Close proofviewer"
              >
                ✕
              </button>
            </div>
            <p className="text-[11px] font-boldtext-stone-600">
              {USD(proofView.amountCents)} · {proofView.method.toUpperCase()} · @{proofView.username}
            </p>
            <p className="text-[10px]text-stone-600">
              Sender:{proofView.senderName} · Ref:{proofView.reference}
            </p>
            {proofView.proof? (
              <imgsrc={proofView.proof} alt="Paymentproof" className="mt-2 w-full rounded-xl borderborder-stone-200" />
            ) :(
              <p className="mt-2 rounded-lg bg-stone-50 px-3 py-4 text-center text-[11px] font-boldtext-stone-600">No proofattached</p>
            )}
            {proofView.status=== 'pending' && (
              <div className="mt-2 flex gap-1.5">
                <Buttonsize="sm" disabled={busy} onClick={() => { depAction(proofView.id, 'approve'); setProofView(null) }}
                  className="h-9 flex-1 rounded-lg bg-green-700 text-[11px] font-extrabold text-white">
                  ✅ Verify& Credit</Button>
                <Buttonsize="sm" disabled={busy} onClick={() => { depAction(proofView.id, 'reject'); setProofView(null) }}
                  className="h-9 flex-1 rounded-lg bg-red-700 text-[11px] font-extrabold text-white">
                  ❌ Reject</Button>
              </div>
            )}
          </div>
        </div>
      )}
    </motion.div>
  )
}

functionStatCard({ icon, label, value, tone, sub}:{ icon:string; label:string; value: number| string; tone:string; sub?: string}) {
  const tones:Record<string, string> = {
    green:'from-green-50 to-whiteborder-green-200',
    teal:'from-teal-50 to-whiteborder-teal-200',
    amber:'from-amber-50 to-whiteborder-amber-200',
    lime:'from-lime-50 to-whiteborder-lime-200',
    orange:'from-orange-50 to-whiteborder-orange-200',
    purple:'from-purple-50 to-whiteborder-purple-200',
    red:'from-red-50 to-whiteborder-red-200',
    pink:'from-pink-50 to-whiteborder-pink-200',
  }
  return(
    <div className={cn('rounded-2xl border bg-gradient-to-br p-3shadow-sm', tones[tone]?? tones.green)}>
      <p className="text-[10px] font-black uppercase tracking-widetext-stone-600">{icon} {label}</p>
      <p className="text-xl font-black tabular-numstext-stone-800">{typeof value=== 'number' ? value.toLocaleString() :value}</p>
      {sub&& <p className="text-[9px] font-boldtext-stone-600">{sub}</p>}
    </div>
  )
}

functionUserRow({ u, busy, onAction, onDone}:{ u:AdminUser; busy:boolean; onAction:(id:string, action:string, extra?:Record<string, unknown>) => Promise<void>; onDone:() => void}) {
  const[open, setOpen]= useState(false)
  const[adjCoins, setAdjCoins]= useState('')
  const[adjGems, setAdjGems]= useState('')
  const[role, setRole]= useState<string>(u.adminRole?? (u.isAdmin? 'super' :'none'))

  return(
    <GameCard className={cn(u.isBlocked&& 'border-red-200bg-red-50/40', u.flagged&& !u.isBlocked&& 'border-amber-400bg-amber-50/40')}>
      <div className="flex items-center gap-2" onClick={() => setOpen(v=> !v)}>
        <span className="text-2xl">{u.avatar}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-blacktext-stone-800">
            {u.farmName} {u.isAdmin&& <span className="rounded bg-red-100 px-1 text-[9px] font-blacktext-red-600">{u.roleLabel?? 'ADMIN'}</span>}
            {u.isBlocked&& <span className="rounded bg-red-700 px-1 text-[9px] font-black text-white">BLOCKED</span>}
            {u.flagged&& !u.isBlocked&& <span className="rounded bg-amber-900 px-1 text-[9px] font-black text-white">🚩 FLAG</span>}
            {u.vipActive&& <spantitle="VIP">👑</span>}
          </p>
          <p className="text-[10px]text-stone-600">@{u.username} · {u.levelName} (Lv{u.numericLevel}) · 🐔{u.hens} 🐄{u.animals} · CoopLv{u.coopLevel}</p>
        </div>
        <div className="shrink-0text-right">
          <p className="text-[11px] font-black tabular-numstext-amber-600">🪙 {u.coins.toLocaleString()}</p>
          <p className="text-[10px] font-bold tabular-numstext-pink-500">💎 {u.gems}</p>
        </div>
      </div>

      {open&& (
        <div className="mt-2 space-y-2 border-t border-stone-100pt-2">
          <p className="text-[9px]text-stone-600">
            Joined{newDate(u.createdAt).toLocaleDateString()} · Last seen{newDate(u.lastSeenAt).toLocaleString()} · Ref:{u.referralCode} · Earned:🪙{u.totalEarned.toLocaleString()} · Eggs:{u.totalEggsHatch}
          </p>
          {u.flagged&& (
            <p className="rounded-lg bg-amber-50 px-2 py-1 text-[10px] font-boldtext-amber-700">
              🚩 Flagged:{u.flagReason}
              <button onClick={() => onAction(u.id, 'unflag').then(onDone)} className="ml-2 rounded-full bg-green-100 px-2 py-0.5 text-[9px] font-blacktext-green-700">Clear</button>
            </p>
          )}
          {/* Phase 16: role management(super only— enforcedserver-side) */}
          <div className="flex items-end gap-1.5">
            <div className="flex-1">
              <Label className="text-[9px] font-boldtext-stone-600">Admin role(SuperAdminonly)</Label>
              <selectvalue={role}
                onChange={e=> setRole(e.target.value)}
                className="mt-0.5 h-8 w-full rounded-lg border border-stone-200 bg-stone-50 text-xs font-bold"
              >
                <optionvalue="none">— No admin access—</option>
                <optionvalue="super">SuperAdmin(fullcontrol)</option>
                <optionvalue="finance">FinanceManager(payouts/economy)</option>
                <optionvalue="game">GameManager(events/users)</option>
                <optionvalue="support">SupportManager(users/broadcast)</option>
              </select>
            </div>
            <buttondisabled={busy}
              onClick={async() => { awaitonAction(u.id, 'set_role', { role}); onDone() }}
              className="h-8 rounded-lg bg-red-600 px-3 text-[10px] font-black text-white  disabled:opacity-40"
            >
              Set role</button>
          </div>
          <div className="flex flex-wrapgap-1.5">
            {!u.isAdmin&& (
              <buttondisabled={busy}
                onClick={() => onAction(u.id, u.isBlocked? 'unblock' :'block')}
                className={cn(
                  'rounded-full px-3 py-1.5 text-[10px] font-black text-white',
                  u.isBlocked? 'bg-green-700' :'bg-red-700'
                )}
              >
                {u.isBlocked? '✅ Unblock' :'⛔ Block'}
              </button>
            )}
            <buttondisabled={busy}
              onClick={() => onAction(u.id, 'grant_hen', { henType:'golden' })}
              className="rounded-full bg-amber-400 px-3 py-1.5 text-[10px] font-black text-white"
            >
              🐔 GiftGoldenHen</button>
            <buttondisabled={busy}
              onClick={() => onAction(u.id, 'freeze_farm')}
              className="rounded-full bg-stone-200 px-3 py-1.5 text-[10px] font-blacktext-stone-600"
            >
              🧊 FreezeFarm</button>
          </div>
          <div className="flex items-end gap-1.5">
            <div className="flex-1">
              <Label className="text-[9px] font-boldtext-stone-600">Coins+/-</Label>
              <Inputtype="number" value={adjCoins} onChange={e=> setAdjCoins(e.target.value)} className="h-8 rounded-lg bg-stone-50  text-xs" placeholder="e.g. 500 /-200" />
            </div>
            <div className="w-24">
              <Label className="text-[9px] font-boldtext-stone-600">Gems+/-</Label>
              <Inputtype="number" value={adjGems} onChange={e=> setAdjGems(e.target.value)} className="h-8 rounded-lg bg-stone-50  text-xs" placeholder="e.g.5" />
            </div>
            <buttondisabled={busy|| (!adjCoins&& !adjGems)}
              onClick={() => onAction(u.id, 'adjust', { coins:Number(adjCoins) || 0, gems:Number(adjGems) || 0})}
              className="h-8 rounded-lg bg-green-700 px-3 text-[10px] font-black text-white  disabled:opacity-40"
            >
              Apply</button>
          </div>
        </div>
      )}
    </GameCard>
  )
}
