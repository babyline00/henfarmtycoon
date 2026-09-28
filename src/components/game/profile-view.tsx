'use client'

import { useCallback, useEffect, useState } from 'react'
import { useGame, api } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { GameCard, EmptyState, SectionTitle, ProgressBar, ErrorState, LoadingSpinner } from './shared'
import { AudioSettings } from './audio-settings'
import { getMusicMood } from '@/lib/music'
import { SupportCenter } from './support-center'
import { WalletView } from './wallet-view'
import { cn } from '@/lib/utils'

interface Tx {
  id: string
  type: string
  amount: number
  currency: string
  description: string
  createdAt: string
}
interface Notif { id: string; title: string; body: string; read: boolean; createdAt: string }

const MONEY_TYPES = new Set(['deposit', 'withdraw', 'refund', 'purchase', 'vip'])

type Tab = 'wallet' | 'txs' | 'notifs' | 'support'
type TxFilter = 'all' | 'money' | 'gameplay'

export function ProfileView() {
  const { state, act, loading, logout, setAdminOpen, showFlash, refresh } = useGame()
  const [tab, setTab] = useState<Tab>('wallet')
  const [txs, setTxs] = useState<Tx[]>([])
  const [txFilter, setTxFilter] = useState<TxFilter>('all')
  const [notifs, setNotifs] = useState<Notif[]>([])
  const [gemQty, setGemQty] = useState(1)
  const [reloadKey, setReloadKey] = useState(0)

  // History silently failing to load left empty lists with no explanation,
  // so a player could not tell "no transactions yet" from "request failed".
  const [histError, setHistError] = useState<string | null>(null)
  const [histLoading, setHistLoading] = useState(false)

  useEffect(() => {
    if (!state) return
    let cancelled = false
    setHistLoading(true)
    ;(async () => {
      try {
        const [wallet, notes] = await Promise.all([
          api<{ transactions: Tx[] }>('/api/wallet'),
          api<{ notifications: Notif[] }>('/api/notifications'),
        ])
        if (cancelled) return
        setTxs(wallet.transactions)
        setNotifs(notes.notifications)
        setHistError(null)
      } catch (e) {
        if (cancelled) return
        setHistError(e instanceof Error ? e.message : 'Could not load your history')
      } finally {
        if (!cancelled) setHistLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [state, tab, reloadKey])

  const reload = useCallback(() => setReloadKey(k => k + 1), [])

  if (!state) return null

  const { user, config } = state

  async function handleExchange() {
    const res = await act('exchange_gems', { gems: gemQty })
    if (res) reload()
  }

  async function markRead() {
    await api('/api/notifications', { method: 'POST', body: { action: 'mark_read' } })
    showFlash('All notifications marked as read')
    await refresh()
    reload()
  }

  return (
    <div className="space-y-3 px-3 pb-4">
      {/* ── profile card ── */}
      <GameCard className="bg-gradient-to-r from-green-50 to-lime-50">
        <div className="flex items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border-2 border-amber-300 bg-white text-3xl shadow">
            <span aria-hidden="true">{user.avatar}</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-black text-stone-800">
              {user.farmName} {user.vip && <span title="VIP member">👑</span>}
            </p>
            <p className="text-xs text-stone-600">@{user.username} · ⭐ {user.levelName} · Lv{user.numericLevel}</p>
            <p className="mt-0.5 text-[10px] text-stone-600">
              Joined {new Date(user.createdAt).toLocaleDateString()} · Referral code:{' '}
              <b className="text-green-700">{user.referralCode}</b>
            </p>
          </div>
        </div>
        {/* numeric level progress */}
        <div className="mt-2">
          <div className="mb-1 flex justify-between text-[10px] font-bold text-stone-600">
            <span>Level {user.numericLevel} → {user.numericLevel + 1}</span>
            <span>XP {user.xp.toLocaleString()} / {user.numericLevelNextXp.toLocaleString()}</span>
          </div>
          <ProgressBar pct={user.numericLevelPct} label={`Level ${user.numericLevel} progress`} className="h-1.5" />
        </div>
      </GameCard>

      {/* ── VIP card (Phase 15) ── */}
      {user.vip ? (
        <GameCard className="bg-gradient-to-r from-amber-100 via-yellow-50 to-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-black text-stone-800">👑 {user.vip.name} Active</p>
              <p className="text-[11px] text-stone-600">
                Until {new Date(user.vip.until).toLocaleDateString()} · 💎 {user.vip.dailyGems}/day claimable
              </p>
            </div>
            <Button size="sm"
              onClick={() => act('claim_vip_daily')}
              disabled={loading || !user.vip?.canClaimGems}
              className="min-h-9 rounded-full bg-gradient-to-r from-amber-600 to-yellow-600 px-4 text-xs font-extrabold text-white shadow active:scale-95 disabled:opacity-40"
            >
              {user.vip.canClaimGems ? `Claim 💎 ${user.vip.dailyGems}` : '✓ Claimed'}
            </Button>
          </div>
        </GameCard>
      ) : (
        <GameCard className="flex items-center gap-2 bg-gradient-to-r from-amber-50 to-white">
          <span className="text-2xl" aria-hidden="true">👑</span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-black text-stone-800">Go VIP</p>
            <p className="text-[11px] text-stone-600">+50% production, daily gems &amp; golden name from $9.99/mo</p>
          </div>
          <Button size="sm"
            onClick={() => showFlash('Find VIP plans in Shop → Premium 👑', 'info')}
            className="min-h-9 shrink-0 rounded-full bg-amber-800 px-3 text-xs font-extrabold text-white"
          >
            See plans
          </Button>
        </GameCard>
      )}

      {/* ── level milestone rewards (Phase 9) ── */}
     

      {/* ── wallet cards ── */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-100 to-amber-50 p-3">
          <p className="text-[10px] font-black uppercase text-amber-700">Gold Coins</p>
          <p className="text-xl font-black tabular-nums text-amber-800">🪙 {user.coins.toLocaleString()}</p>
        </div>
        <div className="rounded-2xl border border-pink-200 bg-gradient-to-br from-pink-100 to-pink-50 p-3">
          <p className="text-[10px] font-black uppercase text-pink-700">Premium Gems</p>
          <p className="text-xl font-black tabular-nums text-pink-700">💎 {user.gems.toLocaleString()}</p>
        </div>
      </div>

      {/* ── tabs ── */}
      <div className="grid grid-cols-4 gap-1 rounded-2xl bg-stone-100 p-1" role="tablist" aria-label="Profile section">
        {(['wallet', 'txs', 'notifs', 'support'] as const).map(t => (
          <button key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={cn(
              'relative min-h-9 rounded-xl py-2 text-xs font-extrabold transition-all',
              tab === t ? 'bg-white text-green-700 shadow' : 'text-stone-600',
            )}
          >
            {t === 'wallet' ? '💳 Wallet' : t === 'txs' ? '📜 History' : t === 'notifs' ? '🔔 Alerts' : '🎫 Support'}
            {t === 'notifs' && state.unreadNotifs > 0 && (
              <span className="absolute right-1 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-700 px-1 text-[9px] font-black text-white">
                <span className="sr-only">{state.unreadNotifs} unread</span>
                <span aria-hidden="true">{state.unreadNotifs}</span>
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── wallet tab (Phase 34 — complete wallet system) ── */}
      {tab === 'wallet' && (
        <div className="space-y-2">
          <WalletView />

          {/* gems exchange */}
          <GameCard>
            <p className="text-sm font-black text-stone-800">💎 Gem Exchange</p>
            <p className="text-[11px] text-stone-600">1 gem = 🪙 {config.gemToCoins} coins</p>
            <div className="mt-2 flex items-center gap-2">
              <input
                type="range"
                min={1}
                max={Math.max(1, user.gems)}
                value={gemQty}
                onChange={e => setGemQty(Number(e.target.value))}
                aria-label="Gems to exchange"
                aria-valuetext={`${gemQty} gem${gemQty === 1 ? '' : 's'} = ${gemQty * config.gemToCoins} coins`}
                className="h-2 min-h-9 flex-1 accent-pink-600"
              />
              <span className="w-8 text-center font-black tabular-nums">{gemQty}</span>
              <span className="text-xs font-bold text-amber-700">→ 🪙 {gemQty * config.gemToCoins}</span>
              <Button size="sm" onClick={handleExchange} disabled={loading || user.gems < 1}
                className="min-h-9 rounded-full bg-pink-600 px-3 text-xs font-extrabold text-white"
              >
                Swap
              </Button>
            </div>
          </GameCard>
        </div>
      )}

      {/* ── transactions ── */}
      {tab === 'txs' && (
        histError ? (
          <GameCard>
            <ErrorState title="Couldn't load your history" message={histError} onRetry={() => reload()} />
          </GameCard>
        ) : histLoading && txs.length === 0 ? (
          <GameCard><LoadingSpinner label="Loading history…" /></GameCard>
        ) : txs.length === 0 ? (
          <GameCard><EmptyState emoji="📜" title="No transactions yet" /></GameCard>
        ) : (
          <div className="space-y-1.5">
            <div className="grid grid-cols-3 gap-1 rounded-xl bg-stone-100 p-1" role="group" aria-label="Transaction filter">
              {([['all', '🗂️ All'], ['money', '💰 Money'], ['gameplay', '🎮 Gameplay']] as const).map(([f, label]) => (
                <button key={f}
                  onClick={() => setTxFilter(f)}
                  aria-pressed={txFilter === f}
                  className={cn('min-h-9 rounded-lg py-1.5 text-[10px] font-extrabold', txFilter === f ? 'bg-white text-green-700 shadow' : 'text-stone-600')}
                >
                  {label}
                </button>
              ))}
            </div>
            {txs
              .filter(t => txFilter === 'all' || (txFilter === 'money' ? MONEY_TYPES.has(t.type) : !MONEY_TYPES.has(t.type)))
              .map(t => (
                <GameCard key={t.id} className="flex items-center gap-2 py-2">
                  <span className="text-lg" aria-hidden="true">{txIcon(t.type)}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11px] font-bold text-stone-700">{t.description}</p>
                    <p className="text-[9px] text-stone-600">{new Date(t.createdAt).toLocaleString()}</p>
                  </div>
                  <span className={cn(
                    'shrink-0 text-xs font-black tabular-nums',
                    t.amount >= 0 ? 'text-green-700' : 'text-red-600',
                  )}>
                    {t.amount >= 0 ? '+' : ''}{t.amount.toLocaleString()} {t.currency === 'gems' ? '💎' : '🪙'}
                  </span>
                </GameCard>
              ))}
          </div>
        )
      )}

      {/* ── notifications ── */}
      {tab === 'notifs' && (
        histError ? (
          <GameCard>
            <ErrorState title="Couldn't load notifications" message={histError} onRetry={() => reload()} />
          </GameCard>
        ) : histLoading && notifs.length === 0 ? (
          <GameCard><LoadingSpinner label="Loading notifications…" /></GameCard>
        ) : notifs.length === 0 ? (
          <GameCard><EmptyState emoji="🔔" title="No notifications" /></GameCard>
        ) : (
          <div className="space-y-2">
            {state.unreadNotifs > 0 && (
              <Button size="sm" variant="outline" onClick={markRead} className="min-h-9 w-full rounded-full text-xs font-bold">
                Mark all as read ({state.unreadNotifs})
              </Button>
            )}
            {notifs.map(n => (
              <GameCard key={n.id} className={cn('py-2.5', !n.read && 'border-l-4 border-l-green-600 bg-green-50/40')}>
                <p className="text-xs font-black text-stone-800">{n.title}</p>
                <p className="mt-0.5 text-[11px] leading-snug text-stone-600">{n.body}</p>
                <p className="mt-1 text-[9px] text-stone-600">{new Date(n.createdAt).toLocaleString()}</p>
              </GameCard>
            ))}
          </div>
        )
      )}

      {/* ── support center (Phase 25) ── */}
      {tab === 'support' && <SupportCenter />}

       <SectionTitle right={
        user.claimableLevelRewards > 0 ? (
          <Button size="sm"
            onClick={() => act('claim_level_reward')}
            disabled={loading}
            className="min-h-9 rounded-full bg-purple-700 px-3 text-xs font-extrabold text-white shadow active:scale-95"
          >
            🎁 Claim ({user.claimableLevelRewards})
          </Button>
        ) : undefined}>
        ⭐ Level Milestones
      </SectionTitle>
      <div className="space-y-1.5">
        {user.levelRewards.map(rw => (
          <GameCard key={rw.level} className={cn(
            'flex items-center gap-2 py-2',
            rw.reached && !rw.claimed && 'border-purple-400 bg-purple-50/50',
          )}>
            <span className={cn(
              'flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-black',
              rw.claimed ? 'bg-green-100 text-green-700' : rw.reached ? 'bg-purple-100 text-purple-700' : 'bg-stone-100 text-stone-600',
            )}>
              {rw.claimed ? '✓' : `L${rw.level}`}
            </span>
            <div className="min-w-0 flex-1">
              <p className={cn('text-xs font-black', rw.reached ? 'text-stone-700' : 'text-stone-600')}>
                Level {rw.level} {rw.unlock ? `· ${rw.unlock}` : ''}
              </p>
              <p className="text-[10px] text-stone-600">🪙 {rw.coins.toLocaleString()}{rw.gems ? ` + 💎 ${rw.gems}` : ''}</p>
            </div>
            {!rw.reached && <span className="text-[10px] font-bold text-stone-600">🔒 locked</span>}
          </GameCard>
        ))}
      </div>


      {/* ── audio ── */}
      <SectionTitle>🔊 Audio</SectionTitle>
      <AudioSettings currentMood={getMusicMood()} />

      {/* ── actions ── */}
      <SectionTitle>⚙️ Account</SectionTitle>
      {user.isAdmin && (
        <Button onClick={() => setAdminOpen(true)}
          className="h-12 w-full rounded-2xl bg-gradient-to-r from-red-600 to-rose-700 text-sm font-extrabold text-white shadow-lg active:scale-[0.98]"
        >
          🛡️ Open Super Admin Panel
        </Button>
      )}
      <Button onClick={logout}
        variant="outline"
        className="h-11 w-full rounded-2xl border-stone-300 text-sm font-bold text-stone-600"
      >
        🚪 Logout
      </Button>
      <p className="pb-2 text-center text-[10px] text-stone-600">Hen Farm Tycoon v1.0 · Virtual farming fun</p>
    </div>
  )
}

function txIcon(type: string): string {
  const map: Record<string, string> = {
    buy: '🛒', sell: '💰', production: '🥚', daily: '🎁', mission: '🎯',
    referral: '👥', admin: '🛡️', withdraw: '💸', refund: '↩️', exchange: '🔁',
    market: '🏪', upgrade: '🏗️', hatch: '🐣', fee: '🏷️', deposit: '📥',
    breed: '🧬', gift: '🎁', help: '🧑‍🌾', clan: '🛡️', level: '⭐',
    purchase: '💳', vip: '👑', item: '🎒', arcade: '🎮', season: '🏆',
  }
  return map[type] ?? '📄'
}
