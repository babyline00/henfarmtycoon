'use client'

import{ useCallback, useEffect, useState} from'react'
import{ useGame, api} from'@/lib/store'
import{ Button} from'@/components/ui/button'
import{ Input} from'@/components/ui/input'
import{ GameCard, EmptyState, SectionTitle, ProgressBar, ErrorState, LoadingSpinner} from'./shared'
import{ SupportCenter} from'./support-center'
import{ WalletView} from'./wallet-view'
import{ cn} from'@/lib/utils'

interface Tx{
  id:string; type:string; amount:number; currency: string description:string; createdAt: string}
interface Notif{ id:string; title:string; body:string; read:boolean; createdAt: string}

const MONEY_TYPES = new Set(['deposit', 'withdraw', 'refund', 'purchase', 'vip'])

export function ProfileView() {
  const{ state, act, loading, logout, setAdminOpen, showFlash, refresh} = useGame()
  const [tab, setTab]= useState<'wallet' | 'txs' | 'notifs' | 'support'>('wallet')
  const [txs, setTxs]= useState<Tx[]>([])
  const [txFilter, setTxFilter]= useState<'all' | 'money' | 'gameplay'>('all')
  const [notifs, setNotifs]= useState<Notif[]>([])
  const [gemQty, setGemQty]= useState(1)
  const [reloadKey, setReloadKey]= useState(0)
  //History silently failing to load left empty lists with noexplanation,
  // so a player could not tell"no transactionsyet" from"requestfailed". const[histError, setHistError]= useState<string| null>(null)
  const [histLoading, setHistLoading]= useState(false)

  useEffect(() => {
    if(!state) return let cancelled= falsesetHistLoading(true)
    ;(async() => {
      try{
        const [wallet, notes]= await Promise.all([api<{ transactions:Tx[]}>('/api/wallet'),
          api<{ notifications:Notif[]}>('/api/notifications'),
        ])
        if(cancelled) return setTxs(wallet.transactions)
        setNotifs(notes.notifications)
        setHistError(null)
      } catch(e) {
        if(cancelled) return setHistError(e instanceof Error? e.message :'Could not load yourhistory')
      } finally{
        if(!cancelled) setHistLoading(false)
      }
    })()
    return() => { cancelled= true}
  }, [state, tab, reloadKey])

  const reload= useCallback(() => setReloadKey(k=> k+ 1), [])

  if(!state) return null const{ user, config} = state async function handleExchange() {
    const res= await act('exchange_gems', { gems:gemQty})
    if(res) reload()
  }

  async function markRead() {
    await api('/api/notifications', { method:'POST', body:{ action:'mark_read' } })
    showFlash('All notifications marked asread')
    await refresh()
    reload()
  }

  return(
    <div className="space-y-3 px-3 pb-4">
      {/* ── profile card── */}
      <GameCard className="bg-gradient-to-r from-green-50to-lime-50">
        <div className="flex items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border-2 border-amber-300 bg-white text-3xl shadow">
            {user.avatar}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-blacktext-stone-800">
              {user.farmName} {user.vip&& <span title="VIP member">👑</span>}
            </p>
            <p className="text-xstext-stone-500">@{user.username} · ⭐ {user.levelName} · Lv{user.numericLevel}</p>
            <p className="mt-0.5 text-[10px]text-stone-600">
              Joined{new Date(user.createdAt).toLocaleDateString()} · Referral code:<b className="text-green-700">{user.referralCode}</b>
            </p>
          </div>
        </div>
        {/* numeric level progress*/}
        <div className="mt-2">
          <div className="mb-1 flex justify-between text-[10px] font-boldtext-stone-600">
            <span>Level{user.numericLevel} → {user.numericLevel+ 1}</span>
            <span>XP {user.xp.toLocaleString()} /{user.numericLevelNextXp.toLocaleString()}</span>
          </div>
          <ProgressBarpct={user.numericLevelPct} className="h-1.5" />
        </div>
      </GameCard>

      {/* ── VIP card(Phase15) ── */}
      {user.vip? (
        <GameCard className="bg-gradient-to-r from-amber-100 via-yellow-50to-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-blacktext-stone-800">👑 {user.vip.name} Active</p>
              <p className="text-[11px]text-stone-500">Until{new Date(user.vip.until).toLocaleDateString()} · 💎 {user.vip.dailyGems}/dayclaimable</p>
            </div>
            <Buttonsize="sm"
              onClick={() => act('claim_vip_daily')}
              disabled={loading|| !user.vip?.canClaimGems}
              className="h-9 rounded-full bg-gradient-to-r from-amber-500 to-yellow-500 px-4 text-xs font-extrabold text-white shadow active:scale-95 disabled:opacity-40"
            >
              {user.vip.canClaimGems? `Claim💎 ${user.vip.dailyGems}` :'✓ Claimed'}
            </Button>
          </div>
        </GameCard>
      ) :(
        <GameCard className="flex items-center gap-2 bg-gradient-to-r from-amber-50to-white">
          <span className="text-2xl">👑</span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-blacktext-stone-800">GoVIP</p>
            <p className="text-[11px]text-stone-500">+50% production, daily gems& golden name from$9.99/mo</p>
          </div>
          <Buttonsize="sm"
            onClick={() => showFlash('FindVIP plans inShop→ Premium👑', 'info')}
            className="h-8 rounded-full bg-amber-800 px-3 text-xs font-extrabold text-white"
          >
            See plans</Button>
        </GameCard>
      )}

      {/* ── level milestone rewards(Phase9) ── */}
      <Secti onTitleright={
        user.claimableLevelRewards> 0? (
          <Buttonsize="sm"
            onClick={() => act('claim_level_reward')}
            disabled={loading}
            className="h-8 rounded-full bg-purple-700 px-3 text-xs font-extrabold text-white shadowactive:scale-95"
          >
            🎁 Claim({user.claimableLevelRewards})
          </Button>
        ) : undefined}>
        ⭐ LevelMilestones</SectionTitle>
      <div className="space-y-1.5">
        {user.levelRewards.map(rw=> (
          <GameCard key={rw.level} className={cn(
            'flex items-center gap-2 py-2',
            rw.reached&& !rw.claimed&& 'border-purple-400bg-purple-50/50'
          )}>
            <span className={cn(
              'flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-black',
              rw.claimed? 'bg-green-100  text-green-700' : rw.reached? 'bg-purple-100  text-purple-700' :'bg-stone-100  text-stone-600'
            )}>
              {rw.claimed? '✓' :`L${rw.level}`}
            </span>
            <div className="min-w-0 flex-1">
              <p className={cn('text-xs font-black', rw.reached? 'text-stone-700' :'text-stone-600')}>
                Level{rw.level} {rw.unlock? `· ${rw.unlock}` :''}
              </p>
              <p className="text-[10px]text-stone-600">🪙 {rw.coins.toLocaleString()}{rw.gems? ` + 💎 ${rw.gems}` :''}</p>
            </div>
            {!rw.reached&& <span className="text-[10px] font-boldtext-stone-600">🔒 locked</span>}
          </GameCard>
        ))}
      </div>

      {/* ── wallet cards── */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-100 to-amber-50p-3">
          <p className="text-[10px] font-black uppercasetext-amber-600">GoldCoins</p>
          <p className="text-xl font-black tabular-numstext-amber-800">🪙 {user.coins.toLocaleString()}</p>
        </div>
        <div className="rounded-2xl border border-pink-200 bg-gradient-to-br from-pink-100 to-pink-50p-3">
          <p className="text-[10px] font-black uppercasetext-pink-500">PremiumGems</p>
          <p className="text-xl font-black tabular-numstext-pink-700">💎 {user.gems.toLocaleString()}</p>
        </div>
      </div>

      {/* ── tabs── */}
      <div className="grid grid-cols-4 gap-1 rounded-2xl bg-stone-100  p-1">
        {(['wallet', 'txs', 'notifs', 'support'] asconst).map(t=> (
          <button key={t}
            onClick={() => setTab(t)}
            className={cn(
              'relative rounded-xl py-2 text-xs font-extrabold transition-all',
              tab=== t? 'bg-white text-green-700shadow' :'text-stone-600'
            )}
          >
            {t=== 'wallet' ? '💳 Wallet' : t=== 'txs' ? '📜 History' : t=== 'notifs' ? '🔔 Alerts' :'🎫 Support'}
            {t=== 'notifs' && state.unreadNotifs> 0&& (
              <span className="absolute right-1 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-black text-white">
                {state.unreadNotifs}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── wallet tab(Phase 34— complete walletsystem) ── */}
      {tab=== 'wallet' && (
        <div className="space-y-2">
          <WalletView/>

          {/* gems exchange*/}
          <GameCard>
            <p className="text-sm font-blacktext-stone-800">💎 GemExchange</p>
            <p className="text-[11px]text-stone-500">1 gem= 🪙 {config.gemToCoins} coins</p>
            <div className="mt-2 flex items-center gap-2">
              <input type="range" min={1} max={Math.max(1, user.gems)} value={gemQty}
                onChange={e=> setGemQty(Number(e.target.value))}
                className="h-2 flex-1accent-pink-500"
              />
              <span className="w-8 text-center font-black tabular-nums">{gemQty}</span>
              <span className="text-xs font-boldtext-amber-600">→ 🪙 {gemQty* config.gemToCoins}</span>
              <Buttonsize="sm" onClick={handleExchange} disabled={loading|| user.gems< 1}
                className="h-8 rounded-full bg-pink-500 px-3 text-xs font-extrabold text-white"
              >
                Swap</Button>
            </div>
          </GameCard>
        </div>
      )}

      {/* ── transactions── */}
      {tab=== 'txs' && (
        histError? (
          <GameCard>
            <ErrorState title="Couldn't load yourhistory" message={histError} onRetry={() => reload()} />
          </GameCard>
        ) :histLoading&& txs.length=== 0? (
          <GameCard><LoadingSpinnerlabel="Loadinghistory..." /></GameCard>
        ) : txs.length=== 0? (
          <GameCard><EmptyStateemoji="📜" title="No transactionsyet" /></GameCard>
        ) :(
          <div className="space-y-1.5">
            <div className="grid grid-cols-3 gap-1 rounded-xl bg-stone-100  p-1">
              {([['all', '🗂️ All'], ['money', '💰 Money'], ['gameplay', '🎮 Gameplay']] asconst).map(([f, label]) => (
                <button key={f}
                  onClick={() => setTxFilter(f)}
                  className={cn('rounded-lg py-1.5 text-[10px] font-extrabold', txFilter=== f? 'bg-white text-green-700shadow' :'text-stone-600')}
                >
                  {label}
                </button>
              ))}
            </div>
            {txs.filter(t=> txFilter=== 'all' || (txFilter=== 'money' ? MONEY_TYPES.has(t.type) :!MONEY_TYPES.has(t.type)))
              .map(t=> (
              <GameCard key={t.id} className="flex items-center gap-2 py-2">
                <span className="text-lg">{txIcon(t.type)}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[11px] font-boldtext-stone-700">{t.description}</p>
                  <p className="text-[9px]text-stone-600">{new Date(t.createdAt).toLocaleString()}</p>
                </div>
                <span className={cn(
                  'shrink-0 text-xs font-black tabular-nums',
                  t.amount>= 0? 'text-green-600' :'text-red-500'
                )}>
                  {t.amount>= 0? '+' :''}{t.amount.toLocaleString()} {t.currency=== 'gems' ? '💎' :'🪙'}
                </span>
              </GameCard>
            ))}
          </div>
        )
      )}

      {/* ── notifications── */}
      {tab=== 'notifs' && (
        histError? (
          <GameCard>
            <ErrorState title="Couldn't loadnotifications" message={histError} onRetry={() => reload()} />
          </GameCard>
        ) :histLoading&& notifs.length=== 0? (
          <GameCard><LoadingSpinnerlabel="Loadingnotifications..." /></GameCard>
        ) : notifs.length=== 0? (
          <GameCard><EmptyStateemoji="🔔" title="Nonotifications" /></GameCard>
        ) :(
          <div className="space-y-2">
            {state.unreadNotifs> 0&& (
              <Buttonsize="sm" var iant="outline" onClick={markRead} className="h-8 w-full rounded-full text-xs font-bold">
                Mark all as read({state.unreadNotifs})
              </Button>
            )}
            {notifs.map(n=> (
              <GameCard key={n.id} className={cn('py-2.5', !n.read&& 'border-l-4 border-l-green-500bg-green-50/40')}>
                <p className="text-xs font-blacktext-stone-800">{n.title}</p>
                <p className="mt-0.5 text-[11px] leading-snugtext-stone-500">{n.body}</p>
                <p className="mt-1 text-[9px]text-stone-600">{new Date(n.createdAt).toLocaleString()}</p>
              </GameCard>
            ))}
          </div>
        )
      )}

      {/* ── support center(Phase25) ── */}
      {tab=== 'support' && <SupportCenter/>}

      {/* ── actions── */}
      <Secti onTitle>⚙️ Account</SectionTitle>
      {user.isAdmin&& (
        <Button onClick={() => setAdminOpen(true)}
          className="h-12 w-full rounded-2xl bg-gradient-to-r from-red-500 to-rose-600 text-sm font-extrabold text-white shadow-lgactive:scale-[0.98]"
        >
          🛡️ OpenSuperAdminPanel</Button>
      )}
      <Button onClick={logout}
        var iant="outline"
        className="h-11 w-full rounded-2xl border-stone-300 text-sm font-boldtext-stone-600"
      >
        🚪 Logout</Button>
      <p className="pb-2 text-center text-[10px]text-stone-600">HenFarmTycoon v1.0· Virtual farmingfun</p>
    </div>
  )
}

function txIcon(type:string): string{
  const map:Record<string, string> = {
    buy:'🛒', sell:'💰', production:'🥚', daily:'🎁', mission:'🎯',
    referral:'👥', admin:'🛡️', withdraw:'💸', refund:'↩️', exchange:'🔁',
    market:'🏪', upgrade:'🏗️', hatch:'🐣', fee:'🏷️', deposit:'📥',
    breed:'🧬', gift:'🎁', help:'🧑‍🌾', clan:'🛡️', level:'⭐',
    purchase:'💳', vip:'👑', item:'🎒', arcade:'🎮', season:'🏆',
  }
  return map[type]?? '📄'
}
