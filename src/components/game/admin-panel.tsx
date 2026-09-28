'use client'

import { useCallback, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useGame, api } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { GameCard, EmptyState, LoadingSpinner } from './shared'
import { cn } from '@/lib/utils'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, PieChart, Pie, Cell, Legend,
} from 'recharts'

type Tab = 'dashboard' | 'users' | 'withdrawals' | 'finance' | 'economy' | 'events' | 'broadcast' | 'analytics' | 'security' | 'games' | 'support'

interface Stats {
  stats: {
    totalUsers: number
    activeToday: number
    newToday: number
    totalHens: number
    totalAnimals: number
    totalEggsHatched: number
    totalEggsInInventory: number
    coinsInCirculation: number
    gemsInCirculation: number
    pendingWithdrawals: number
    totalWithdrawn: number
    totalTransactions: number
    marketSales: number
    serverStatus: string
    revenueCents: number
    purchaseCount: number
    vipCount: number
    todayRevenueCents: number
    // wallet
    totalDepositCents: number
    depositCount: number
    pendingDeposits: number
    wdFeesCollected: number
  }
  growth: { date: string; users: number }[]
  topHolders: { username: string; coins: number }[]
  txByType: Record<string, number>
  events: { id: string; name: string; active: boolean; multiplier: number; endsAt: string }[]
}

interface AnalyticsData {
  dauSeries: { date: string; dau: number; newUsers: number }[]
  economySeries: { date: string; generated: number; spent: number; marketVolume: number }[]
  revenueSeries: { date: string; revenueCents: number }[]
  eggSeries: { date: string; laid: number; hatched: number }[]
  retention: { d1: number; d3: number; sessionsPerUser: number; totalSessions7d: number }
  topSpenders: { userId: string; username: string; cents: number; count: number }[]
  revenueBySku: { sku: string; count: number; cents: number }[]
  economyHealth: { totalGenerated14d: number; totalSpent14d: number; netCoinFlow: number; signal: string }
  vipCount: number
  todayRevenueCents: number
}

interface SecurityData {
  events: { id: string; kind: string; detail: string; createdAt: string; username: string; farmName: string; userId: string }[]
  flagged: { id: string; username: string; farmName: string; avatar: string; flagReason: string; coins: number; isBlocked: boolean }[]
  logs: { id: string; adminName: string; action: string; detail: string; createdAt: string }[]
  summary: { rateLimitedCount: number; priceAbuseCount: number; flaggedCount: number; adminCount: number }
  admins: { id: string; username: string; farmName: string; role: string; roleLabel: string; lastSeenAt: string }[]
  roleMatrix: { role: string; roleLabel: string; perms: string[] }[]
  me: { id: string; role: string; roleLabel: string }
}

interface MiniGamesData {
  games: { id: string; key: string; name: string; emoji: string; description: string; enabled: boolean; energyCost: number; plays: number; wins: number; losses: number; rejected: number }[]
  totals: { totalPlays: number; coinsAwarded: number; xpAwarded: number; metersRan: number; playsToday: number; cheatedCount: number }
  analytics: { gameKey: string; plays: number; wins: number; losses: number; winRate: number; uniquePlayers: number; playsPerPlayer: number; avgDurationSec: number; avgScore: number; avgCoins: number; avgXp: number; coinsPerMinute: number }[]
  cheated: { id: string; gameKey: string; createdAt: string; username: string; farmName: string; flagged: boolean }[]
  recent: { id: string; gameKey: string; username: string; avatar: string; score: number; distance: number; coins: number; result: string; cheated: boolean; createdAt: string }[]
  season: {
    rewards: { rank: number; prize: string; emoji: string; detail: string }[]
    monthKey: string
    paid: boolean
    top3: { rank: number; userId: string; username: string; avatar: string; totalScore: number; reward: string }[]
  }
}

interface SupportData {
  counts: { open: number; answered: number; closed: number }
  tickets: {
    id: string
    userId: string
    username: string
    subject: string
    category: string
    status: string
    assignedTo: string | null
    createdAt: string
    updatedAt: string
    messages: { id: string; sender: string; senderName: string; body: string; createdAt: string }[]
  }[]
}

interface AdminUser {
  id: string
  username: string
  email?: string | null
  farmName: string
  avatar: string
  coins: number
  gems: number
  levelName: string
  xp: number
  isAdmin: boolean
  isBlocked: boolean
  referralCode: string
  adminRole: string | null
  roleLabel: string | null
  flagged: boolean
  flagReason: string | null
  vipActive: boolean
  numericLevel: number
  hens: number
  animals: number
  coopLevel: number
  totalEarned: number
  totalEggsHatch: number
  createdAt: string
  lastSeenAt: string
}

interface Wd {
  id: string
  userId: string
  username: string
  amount: number
  method: string
  address: string
  accountTitle: string
  bankName: string
  fee: number
  status: string
  createdAt: string
  note?: string | null
}

// ── wallet ──
interface Dep {
  id: string
  userId: string
  username: string
  amountCents: number
  method: string
  senderName: string
  reference: string
  proof?: string | null
  coins: number
  bonusCoins: number
  status: string
  note?: string | null
  createdAt: string
  processedAt?: string | null
  processedBy?: string | null
}
interface DepStats { totalApprovedCents: number; coinsIssued: number; pendingCount: number }
interface PayField { key: string; label: string; placeholder: string; copyable?: boolean }
interface PayMethodDef { key: string; name: string; emoji: string; instructions: string; fields: PayField[] }
interface PayMethodAcc { enabled: boolean; [k: string]: unknown }

const USD = (c: number) => `$${(c / 100).toFixed(2)}`

// Per-game display names, keyed so a new game is a one-line addition
// rather than another nested ternary in the table.
const GAME_LABELS: Record<string, string> = {
  chicken_run: '🏃 Chicken Run',
  road_crossing: '🚦 Road Crossing',
  egg_catch: '🥚 Egg Catch',
}

const PIE_COLORS = ['#16a34a', '#eab308', '#f97316', '#ec4899', '#14b8a6', '#a855f7', '#84cc16', '#ef4444']

const failMessage = (e: unknown, what: string) =>
  e instanceof Error ? e.message : `Failed to load ${what}`

export function AdminPanel() {
  const { setAdminOpen, refresh, showFlash } = useGame()
  const [tab, setTab] = useState<Tab>('dashboard')
  const [stats, setStats] = useState<Stats | null>(null)
  const [users, setUsers] = useState<AdminUser[]>([])
  const [search, setSearch] = useState('')
  const [wds, setWds] = useState<Wd[]>([])
  const [deposits, setDeposits] = useState<Dep[]>([])
  const [depStats, setDepStats] = useState<DepStats | null>(null)
  const [depFilter, setDepFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending')
  const [proofView, setProofView] = useState<Dep | null>(null)
  const [depNote, setDepNote] = useState('')
  const [payDefs, setPayDefs] = useState<PayMethodDef[]>([])
  const [payMethods, setPayMethods] = useState<Record<string, PayMethodAcc>>({})
  const [config, setConfig] = useState<Record<string, string>>({})
  const [events, setEvents] = useState<{ id: string; name: string; description: string; multiplier: number; endsAt: string; active: boolean }[]>([])
  const [evName, setEvName] = useState('')
  const [evDesc, setEvDesc] = useState('')
  const [evMult, setEvMult] = useState('150')
  const [evDays, setEvDays] = useState('3')
  const [bcTitle, setBcTitle] = useState('')
  const [bcMsg, setBcMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
  const [security, setSecurity] = useState<SecurityData | null>(null)
  const [miniGames, setMiniGames] = useState<MiniGamesData | null>(null)
  const [support, setSupport] = useState<SupportData | null>(null)
  const [supportFilter, setSupportFilter] = useState('open')
  const [ticketReply, setTicketReply] = useState<Record<string, string>>({})

  const loadAll = useCallback(async () => {
    try {
      const [s, u, w, c, e] = await Promise.all([api<Stats>('/api/admin/stats'),
        api<{ users: AdminUser[] }>(`/api/admin/users?q=${encodeURIComponent(search)}`),
        api<{ withdrawals: Wd[] }>('/api/admin/withdrawals'),
        api<{ config: Record<string, string> }>('/api/admin/config'),
        api<{ events: typeof events }>('/api/admin/events'),
      ])
      setStats(s); setUsers(u.users); setWds(w.withdrawals); setConfig(c.config); setEvents(e.events)
    } catch (e) {
      showFlash(failMessage(e, 'admin data'), 'error')
    }
  }, [search, showFlash])

  const loadAnalytics = useCallback(async () => {
    try {
      setAnalytics(await api<AnalyticsData>('/api/admin/analytics'))
    } catch (e) {
      showFlash(failMessage(e, 'analytics'), 'error')
    }
  }, [showFlash])

  const loadSecurity = useCallback(async () => {
    try {
      setSecurity(await api<SecurityData>('/api/admin/security'))
    } catch (e) {
      showFlash(failMessage(e, 'security data'), 'error')
    }
  }, [showFlash])

  useEffect(() => { loadAll() }, [loadAll, tab])
  useEffect(() => { if (tab === 'analytics') loadAnalytics() }, [tab, loadAnalytics])
  useEffect(() => { if (tab === 'security') loadSecurity() }, [tab, loadSecurity])

  const loadFinance = useCallback(async () => {
    try {
      const [d, p] = await Promise.all([api<{ deposits: Dep[]; stats: DepStats }>(`/api/admin/deposits${depFilter === 'all' ? '' : `?status=${depFilter}`}`),
        api<{ methods: Record<string, PayMethodAcc>; defs: PayMethodDef[] }>('/api/admin/payment-settings'),
      ])
      setDeposits(d.deposits); setDepStats(d.stats); setPayMethods(p.methods); setPayDefs(p.defs)
    } catch (e) {
      showFlash(failMessage(e, 'finance data'), 'error')
    }
  }, [depFilter, showFlash])

  useEffect(() => { if (tab === 'finance') loadFinance() }, [tab, loadFinance])

  const loadMiniGames = useCallback(async () => {
    try {
      setMiniGames(await api<MiniGamesData>('/api/admin/minigames'))
    } catch (e) {
      showFlash(failMessage(e, 'mini-games data'), 'error')
    }
  }, [showFlash])

  const loadSupport = useCallback(async (filter: string) => {
    try {
      setSupport(await api<SupportData>(`/api/admin/support?status=${filter}`))
    } catch (e) {
      showFlash(failMessage(e, 'tickets'), 'error')
    }
  }, [showFlash])

  useEffect(() => { if (tab === 'games') loadMiniGames() }, [tab, loadMiniGames])
  useEffect(() => { if (tab === 'support') loadSupport(supportFilter) }, [tab, supportFilter, loadSupport])

  async function gameAdmin(action: string, extra?: Record<string, unknown>) {
    setBusy(true)
    try {
      const res = await api<{ message: string }>('/api/admin/minigames', { method: 'POST', body: { action, ...extra } })
      showFlash(res.message)
      await loadMiniGames()
    } catch (e) {
      showFlash(e instanceof Error ? e.message : 'Request failed', 'error')
    } finally { setBusy(false) }
  }

  async function ticketAdmin(ticketId: string, action: string, message?: string) {
    setBusy(true)
    try {
      const res = await api<{ message: string }>('/api/admin/support', { method: 'POST', body: { ticketId, action, message } })
      showFlash(res.message)
      await loadSupport(supportFilter)
    } catch (e) {
      showFlash(e instanceof Error ? e.message : 'Request failed', 'error')
    } finally { setBusy(false) }
  }

  async function userAction(userId: string, action: string, extra?: Record<string, unknown>) {
    setBusy(true)
    try {
      const res = await api<{ message: string }>('/api/admin/users', {
        method: 'POST', body: { userId, action, ...extra },
      })
      showFlash(res.message)
      await loadAll()
      await refresh()
    } catch (e) {
      showFlash(e instanceof Error ? e.message : 'Request failed', 'error')
    } finally {
      setBusy(false)
    }
  }

  async function wdAction(id: string, action: string) {
    setBusy(true)
    try {
      const res = await api<{ message: string }>('/api/admin/withdrawals', {
        method: 'POST', body: { id, action },
      })
      showFlash(res.message)
      await loadAll()
    } catch (e) {
      showFlash(e instanceof Error ? e.message : 'Request failed', 'error')
    } finally {
      setBusy(false)
    }
  }

  // ── deposits verification ──
  async function depAction(id: string, action: 'approve' | 'reject') {
    setBusy(true)
    try {
      const res = await api<{ message: string }>('/api/admin/deposits', {
        method: 'POST', body: { id, action, note: depNote || undefined },
      })
      showFlash(res.message)
      setDepNote('')
      await loadFinance()
      await loadAll()
      await refresh()
    } catch (e) {
      showFlash(e instanceof Error ? e.message : 'Request failed', 'error')
    } finally {
      setBusy(false)
    }
  }

  async function savePaySettings() {
    setBusy(true)
    try {
      const res = await api<{ message: string }>('/api/admin/payment-settings', {
        method: 'POST', body: { methods: payMethods },
      })
      showFlash(res.message)
    } catch (e) {
      showFlash(e instanceof Error ? e.message : 'Request failed', 'error')
    } finally {
      setBusy(false)
    }
  }

  async function saveConfig() {
    setBusy(true)
    try {
      const res = await api<{ message: string }>('/api/admin/config', { method: 'POST', body: { config } })
      showFlash(res.message)
    } catch (e) {
      showFlash(e instanceof Error ? e.message : 'Request failed', 'error')
    } finally { setBusy(false) }
  }

  // instant single-switch save for emergency controls
  async function saveConfigQuick(key: string, value: number) {
    setConfig(c => ({ ...c, [key]: String(value) }))
    setBusy(true)
    try {
      await api('/api/admin/config', { method: 'POST', body: { config: { [key]: value } } })
      showFlash(`⚙️ ${key} → ${value === 1 ? 'ENABLED' : 'disabled'}`)
      await refresh()
    } catch (e) {
      showFlash(e instanceof Error ? e.message : 'Request failed', 'error')
    } finally { setBusy(false) }
  }

  async function createEvent() {
    setBusy(true)
    try {
      const res = await api<{ message: string }>('/api/admin/events', {
        method: 'POST',
        body: { action: 'create', name: evName, description: evDesc, multiplier: Number(evMult), days: Number(evDays) },
      })
      showFlash(res.message)
      setEvName(''); setEvDesc('')
      await loadAll()
      await refresh()
    } catch (e) {
      showFlash(e instanceof Error ? e.message : 'Request failed', 'error')
    } finally { setBusy(false) }
  }

  async function eventAction(id: string, action: string) {
    setBusy(true)
    try {
      const res = await api<{ message: string }>('/api/admin/events', { method: 'POST', body: { action, id } })
      showFlash(res.message)
      await loadAll()
      await refresh()
    } catch (e) {
      showFlash(e instanceof Error ? e.message : 'Request failed', 'error')
    } finally { setBusy(false) }
  }

  async function broadcast() {
    setBusy(true)
    try {
      const res = await api<{ message: string }>('/api/admin/broadcast', {
        method: 'POST', body: { title: bcTitle, message: bcMsg },
      })
      showFlash(res.message)
      setBcTitle(''); setBcMsg('')
    } catch (e) {
      showFlash(e instanceof Error ? e.message : 'Request failed', 'error')
    } finally { setBusy(false) }
  }

  const TABS: [Tab, string][] = [
    ['dashboard', '📊 Dash'],
    ['analytics', '📈 Analytics'],
    ['games', '🎮 Games'],
    ['support', `🎫 Support${support?.counts.open ? ` (${support.counts.open})` : ''}`],
    ['users', '👥 Users'],
    ['withdrawals', `💸 Payouts${stats?.stats.pendingWithdrawals ? ` (${stats.stats.pendingWithdrawals})` : ''}`],
    ['finance', `📥 Deposits${stats?.stats.pendingDeposits ? ` (${stats.stats.pendingDeposits})` : ''}`],
    ['economy', '💰 Economy'],
    ['events', '🎉 Events'],
    ['broadcast', '📢 Notify'],
    ['security', '🔐 Security'],
  ]

  const isOn = (key: string) => config[key] === '1'

  return (
    <motion.div initial={{ x: '100%' }} animate={{ x: 0 }}
      role="dialog"
      aria-modal="true"
      aria-label="Super admin control center"
      className="fixed inset-0 z-50 flex flex-col bg-stone-100"
    >
      {/* header */}
      <div className="flex items-center gap-2 border-b border-stone-200 bg-gradient-to-r from-red-700 to-rose-800 px-4 py-3 text-white shadow-lg">
        <button onClick={() => setAdminOpen(false)}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/20 text-lg font-black active:scale-95"
          aria-label="Close admin panel"
        >
          ✕
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black">🛡️ SUPER ADMIN</p>
          <p className="text-[10px] text-red-100">HenFarmTycoon Control Center</p>
        </div>
        <span className={cn(
          'shrink-0 rounded-full px-2 py-1 text-[9px] font-black uppercase',
          stats?.stats.serverStatus === 'healthy' ? 'bg-green-900/30 text-green-100' : 'bg-red-950/40 text-red-100',
        )}>
          ● {stats?.stats.serverStatus ?? '…'}
        </span>
      </div>

      {/* tabs */}
      <div className="flex gap-1 overflow-x-auto border-b border-stone-200 bg-white px-2 py-2 lg:px-6 lg:py-2.5" role="tablist" aria-label="Admin sections">
        {TABS.map(([t, label]) => (
          <button key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={cn(
              'min-h-9 shrink-0 rounded-full px-3 py-1.5 text-[11px] font-extrabold transition-all',
              tab === t ? 'bg-red-700 text-white shadow' : 'bg-stone-100 text-stone-600',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* The panel is full-screen at every size, so on a desktop the 2-column
          dashboard stretched into two enormous cards with a single stat
          each. The body is width-capped and the stat grid goes to 4 columns
          from lg, which is what makes the numbers scannable side by side. */}
      <div className="flex-1 overflow-y-auto p-3 pb-8 lg:p-6">
        {/* ════════ DASHBOARD ════════ */}
        {tab === 'dashboard' && (!stats ? <LoadingSpinner label="Loading platform data…" /> : (
          <div className="mx-auto max-w-7xl space-y-3">
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
              <StatCard icon="👥" label="Total users" value={stats.stats.totalUsers} tone="green" sub={`+${stats.stats.newToday} today`} />
              <StatCard icon="🟢" label="Active today" value={stats.stats.activeToday} tone="teal" />
              <StatCard icon="🐔" label="Hens owned" value={stats.stats.totalHens} tone="amber" />
              <StatCard icon="🐄" label="Animals" value={stats.stats.totalAnimals} tone="lime" />
              <StatCard icon="🐣" label="Eggs hatched" value={stats.stats.totalEggsHatched} tone="orange" sub={`${stats.stats.totalEggsInInventory} in storage / incubators`} />
              <StatCard icon="🏪" label="Market sales" value={stats.stats.marketSales} tone="purple" />
              <StatCard icon="🪙" label="Coins in circulation" value={stats.stats.coinsInCirculation} tone="amber" sub={`💎 ${stats.stats.gemsInCirculation} gems`} />
              <StatCard icon="💸" label="Withdrawn (approved)" value={stats.stats.totalWithdrawn} tone="red" sub={`${stats.stats.pendingWithdrawals} pending`} />
              <StatCard icon="💳" label="Total revenue" value={Math.round(stats.stats.revenueCents / 100)} tone="pink" sub={`$${(stats.stats.todayRevenueCents / 100).toFixed(2)} today · ${stats.stats.purchaseCount} orders`} />
              <StatCard icon="👑" label="VIP members" value={stats.stats.vipCount} tone="amber" sub="active subscriptions" />
              <StatCard icon="📥" label="Total deposits" value={Math.round(stats.stats.totalDepositCents / 100)} tone="green" sub={`${stats.stats.depositCount} verified · ${stats.stats.pendingDeposits} pending`} />
              <StatCard icon="🏷️" label="W/D fees collected" value={stats.stats.wdFeesCollected} tone="red" sub="coins kept as processing fee" />
            </div>

            <GameCard>
              <p className="mb-2 text-xs font-black text-stone-700">📈 New users (last 14 days)</p>
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={stats.growth}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 12 }} />
                    <Line type="monotone" dataKey="users" stroke="#16a34a" strokeWidth={3} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </GameCard>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <GameCard>
                <p className="mb-2 text-xs font-black text-stone-700">💰 Top coin holders</p>
                <div className="h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.topHolders} layout="vertical">
                      <XAxis type="number" hide />
                      <YAxis dataKey="username" type="category" tick={{ fontSize: 10 }} width={80} />
                      <Tooltip contentStyle={{ fontSize: 12, borderRadius: 12 }} />
                      <Bar dataKey="coins" fill="#ca8a04" radius={[0, 8, 8, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </GameCard>

              <GameCard>
                <p className="mb-2 text-xs font-black text-stone-700">📊 Coin flow by type (7d)</p>
                <div className="h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={Object.entries(stats.txByType).map(([k, v]) => ({ name: k, value: v }))}
                        dataKey="value" nameKey="name" innerRadius={30} outerRadius={60}
                        paddingAngle={2}
                      >
                        {Object.entries(stats.txByType).map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ fontSize: 11, borderRadius: 12 }} />
                      <Legend wrapperStyle={{ fontSize: 9 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </GameCard>
            </div>

            <GameCard>
              <p className="text-xs font-black text-stone-700">🖥️ System</p>
              <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] font-bold text-stone-600">
                <p>Total transactions: <b className="text-stone-800">{stats.stats.totalTransactions.toLocaleString()}</b></p>
                <p>Server: <b className="text-green-700">operational</b></p>
                <p>Database: <b className="text-green-700">SQLite · healthy</b></p>
                <p>Uptime: <b className="text-stone-800">stable</b></p>
              </div>
            </GameCard>
          </div>
        ))}

        {/* ════════ USERS ════════ */}
        {tab === 'users' && (
          <div className="space-y-2">
            <Input value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="🔍 Search by username or farm name…"
              aria-label="Search users by username or farm name"
              className="h-10 rounded-xl border-stone-200 bg-white"
            />
            {users.map(u => (
              <UserRow key={u.id} u={u} busy={busy} onAction={userAction} onDone={loadAll} />
            ))}
            {users.length === 0 && <GameCard><EmptyState emoji="🔍" title="No users found" sub="Try a different search" /></GameCard>}
          </div>
        )}

        {/* ════════ WITHDRAWALS (payout queue) ════════ */}
        {tab === 'withdrawals' && (
          wds.length === 0 ? (
            <GameCard><EmptyState emoji="💸" title="No withdrawal requests" sub="Player payout requests appear here" /></GameCard>
          ) : (
            <div className="space-y-2">
              {wds.map(w => (
                <GameCard key={w.id} className={cn(w.status === 'pending' && 'border-amber-300 bg-amber-50/50')}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-black text-stone-800">🪙 {w.amount.toLocaleString()} · {w.method.toUpperCase()}</p>
                      <p className="text-[11px] text-stone-600">@{w.username}</p>
                      <p className="text-[11px] font-bold text-stone-600">👤 {w.accountTitle || '—'}{w.bankName ? ` · 🏦 ${w.bankName}` : ''}</p>
                      <p className="truncate text-[10px] text-stone-600">📍 {w.address}</p>
                      <p className="text-[10px] font-bold text-green-700">Payout after fee: 🪙 {(w.amount - w.fee).toLocaleString()} (fee 🪙 {w.fee.toLocaleString()})</p>
                      <p className="text-[9px] text-stone-600">{new Date(w.createdAt).toLocaleString()}</p>
                    </div>
                    <span className={cn(
                      'shrink-0 rounded-full px-2 py-0.5 text-[9px] font-black uppercase',
                      w.status === 'approved' ? 'bg-green-100 text-green-700'
                        : w.status === 'rejected' ? 'bg-red-100 text-red-700'
                          : w.status === 'hold' ? 'bg-amber-200 text-amber-800'
                            : 'bg-stone-200 text-stone-600',
                    )}>
                      {w.status}
                    </span>
                  </div>
                  {(w.status === 'pending' || w.status === 'hold') && (
                    <div className="mt-2 flex gap-1.5">
                      <Button size="sm" disabled={busy} onClick={() => wdAction(w.id, 'approve')}
                        aria-label={`Approve withdrawal for ${w.username}`}
                        className="min-h-9 flex-1 rounded-lg bg-green-700 text-[11px] font-extrabold text-white">
                        ✅ Approve
                      </Button>
                      <Button size="sm" variant="outline" disabled={busy} onClick={() => wdAction(w.id, 'hold')}
                        aria-label={`Put withdrawal for ${w.username} on hold`}
                        className="min-h-9 flex-1 rounded-lg text-[11px] font-bold">
                        ⏸ Hold
                      </Button>
                      <Button size="sm" disabled={busy} onClick={() => wdAction(w.id, 'reject')}
                        aria-label={`Reject withdrawal for ${w.username}`}
                        className="min-h-9 flex-1 rounded-lg bg-red-700 text-[11px] font-extrabold text-white">
                        ❌ Reject
                      </Button>
                    </div>
                  )}
                </GameCard>
              ))}
            </div>
          )
        )}

        {/* ════════ FINANCE — deposits verification + payment accounts ════════ */}
        {tab === 'finance' && (
          <div className="space-y-2">
            {/* finance stat cards */}
            <div className="grid grid-cols-2 gap-2">
              <StatCard icon="📥" label="Deposits approved" value={USD(depStats?.totalApprovedCents ?? 0)} tone="green" sub="real money in" />
              <StatCard icon="⏳" label="Pending deposits" value={depStats?.pendingCount ?? 0} tone="orange" sub="awaiting verification" />
              <StatCard icon="🪙" label="Coins issued" value={(depStats?.coinsIssued ?? 0).toLocaleString()} tone="amber" sub="incl. deposit bonuses" />
              <StatCard icon="🏷️" label="W/D fees collected" value={(stats?.stats.wdFeesCollected ?? 0).toLocaleString()} tone="red" sub="processing fee revenue" />
            </div>

            {/* deposit verification queue */}
            <GameCard>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-black text-stone-800">📥 Deposit verification</p>
                <div className="flex gap-1" role="group" aria-label="Filter deposits by status">
                  {(['pending', 'approved', 'rejected', 'all'] as const).map(f => (
                    <button key={f}
                      onClick={() => setDepFilter(f)}
                      aria-pressed={depFilter === f}
                      className={cn('min-h-9 rounded-full px-2 py-1 text-[9px] font-black uppercase',
                        depFilter === f ? 'bg-red-700 text-white' : 'bg-stone-100 text-stone-600')}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>
              <p className="mt-0.5 text-[11px] text-stone-600">Verify the receipt reference and payment proof against the deposit account before approving.</p>
            </GameCard>

            {deposits.length === 0 && (
              <GameCard><EmptyState emoji="📥" title="No deposits here" sub="Player manual payments appear in this queue" /></GameCard>
            )}
            {deposits.map(d => (
              <GameCard key={d.id} className={cn(d.status === 'pending' && 'border-amber-300 bg-amber-50/50')}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-black text-stone-800">{USD(d.amountCents)} → 🪙 {(d.coins + d.bonusCoins).toLocaleString()}</p>
                    <p className="text-[11px] text-stone-600">@{d.username} · {d.method.toUpperCase()}</p>
                    <p className="text-[11px] font-bold text-stone-600">👤 Sender: {d.senderName}</p>
                    <p className="truncate text-[10px] text-stone-600">🔖 Ref: {d.reference}</p>
                    {d.bonusCoins > 0 && <p className="text-[10px] font-bold text-green-700">Includes +{d.bonusCoins.toLocaleString()} bonus coins</p>}
                    {d.note && <p className="text-[10px] text-red-700">Note: {d.note}</p>}
                    <p className="text-[9px] text-stone-600">{new Date(d.createdAt).toLocaleString()}{d.processedBy ? ` · by ${d.processedBy}` : ''}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className={cn(
                      'rounded-full px-2 py-0.5 text-[9px] font-black uppercase',
                      d.status === 'approved' ? 'bg-green-100 text-green-700'
                        : d.status === 'rejected' ? 'bg-red-100 text-red-700'
                          : 'bg-amber-100 text-amber-700',
                    )}>
                      {d.status}
                    </span>
                    {d.proof && (
                      <button onClick={() => setProofView(d)}
                        className="min-h-9 rounded-full bg-stone-100 px-2 py-1 text-[9px] font-black text-stone-600 active:scale-95"
                      >
                        🖼️ View proof
                      </button>
                    )}
                  </div>
                </div>
                {d.proof && d.proof.length < 400_000 && (
                  <button onClick={() => setProofView(d)} className="mt-2 block w-full" aria-label={`Enlarge payment proof for ${d.username}`}>
                    <img src={d.proof} alt={`Payment proof for ${d.username}`} className="h-28 w-full rounded-lg border border-stone-200 object-cover" />
                  </button>
                )}
                {d.status === 'pending' && (
                  <div className="mt-2 space-y-1.5">
                    <Input value={depNote}
                      onChange={e => setDepNote(e.target.value)}
                      placeholder="Note on reject (optional, sent to player)"
                      aria-label={`Rejection note for ${d.username}`}
                      className="h-9 rounded-lg bg-stone-50 text-[11px]"
                    />
                    <div className="flex gap-1.5">
                      <Button size="sm" disabled={busy} onClick={() => depAction(d.id, 'approve')}
                        aria-label={`Verify and credit ${d.username}'s deposit`}
                        className="min-h-9 flex-1 rounded-lg bg-green-700 text-[11px] font-extrabold text-white">
                        ✅ Verify &amp; credit
                      </Button>
                      <Button size="sm" disabled={busy} onClick={() => depAction(d.id, 'reject')}
                        aria-label={`Reject ${d.username}'s deposit`}
                        className="min-h-9 flex-1 rounded-lg bg-red-700 text-[11px] font-extrabold text-white">
                        ❌ Reject
                      </Button>
                    </div>
                  </div>
                )}
              </GameCard>
            ))}

            {/* payment accounts editor */}
            <GameCard>
              <p className="text-sm font-black text-stone-800">🏦 Deposit account details</p>
              <p className="mb-2 text-[11px] text-stone-600">Players copy these accounts when paying. Toggle methods on or off any time.</p>
              <div className="space-y-2">
                {payDefs.map(def => {
                  const acc = payMethods[def.key] ?? { enabled: false }
                  return (
                    <div key={def.key} className={cn('rounded-xl border p-2.5', acc.enabled ? 'border-green-200 bg-green-50/50' : 'border-stone-200 bg-stone-50')}>
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-black text-stone-700">{def.emoji} {def.name}</p>
                        <button onClick={() => setPayMethods(m => ({ ...m, [def.key]: { ...acc, enabled: !acc.enabled } }))}
                          aria-pressed={acc.enabled}
                          aria-label={`${acc.enabled ? 'Disable' : 'Enable'} ${def.name} deposits`}
                          className={cn('min-h-9 rounded-full px-3 py-1 text-[9px] font-black uppercase',
                            acc.enabled ? 'bg-green-700 text-white' : 'bg-stone-300 text-stone-600')}
                        >
                          {acc.enabled ? 'enabled' : 'disabled'}
                        </button>
                      </div>
                      <div className="mt-1.5 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                        {def.fields.map(f => {
                          const fid = `pay-${def.key}-${f.key}`
                          return (
                            <div key={f.key}>
                              <Label htmlFor={fid} className="text-[9px] font-bold text-stone-600">{f.label}</Label>
                              <Input id={fid} value={String(acc[f.key] ?? '')}
                                onChange={e => setPayMethods(m => ({ ...m, [def.key]: { ...acc, [f.key]: e.target.value } }))}
                                className="mt-0.5 h-9 rounded-lg border-stone-200 bg-white text-[11px]"
                                placeholder={f.placeholder}
                              />
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
              <Button onClick={savePaySettings} disabled={busy}
                className="mt-3 h-10 w-full rounded-xl bg-green-700 font-extrabold text-white"
              >
                💾 Save payment accounts
              </Button>
            </GameCard>
          </div>
        )}

        {/* ════════ ECONOMY ════════ */}
        {tab === 'economy' && (
          <div className="space-y-2">
            {/* Emergency mode */}
            <GameCard className="border-red-200 bg-red-50/60">
              <p className="text-sm font-black text-red-700">🚨 Emergency mode</p>
              <p className="mb-2 text-[11px] text-red-700">Live control center — switches apply instantly for all players.</p>
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                <button onClick={() => saveConfigQuick('maintenanceMode', isOn('maintenanceMode') ? 0 : 1)}
                  aria-pressed={isOn('maintenanceMode')}
                  className={cn('rounded-xl border-2 px-2 py-2 text-[10px] font-black leading-tight',
                    isOn('maintenanceMode') ? 'border-red-700 bg-red-700 text-white' : 'border-stone-200 bg-white text-stone-600')}
                >
                  🛠️ Maintenance<br />{isOn('maintenanceMode') ? 'ON' : 'OFF'}
                </button>
                <button onClick={() => saveConfigQuick('withdrawalsDisabled', isOn('withdrawalsDisabled') ? 0 : 1)}
                  aria-pressed={isOn('withdrawalsDisabled')}
                  className={cn('rounded-xl border-2 px-2 py-2 text-[10px] font-black leading-tight',
                    isOn('withdrawalsDisabled') ? 'border-red-700 bg-red-700 text-white' : 'border-stone-200 bg-white text-stone-600')}
                >
                  💸 Stop withdrawals<br />{isOn('withdrawalsDisabled') ? 'STOPPED' : 'ALLOWED'}
                </button>
                <button onClick={() => saveConfigQuick('marketplaceDisabled', isOn('marketplaceDisabled') ? 0 : 1)}
                  aria-pressed={isOn('marketplaceDisabled')}
                  className={cn('rounded-xl border-2 px-2 py-2 text-[10px] font-black leading-tight',
                    isOn('marketplaceDisabled') ? 'border-red-700 bg-red-700 text-white' : 'border-stone-200 bg-white text-stone-600')}
                >
                  🏪 Freeze market<br />{isOn('marketplaceDisabled') ? 'FROZEN' : 'OPEN'}
                </button>
                <button onClick={() => saveConfigQuick('depositsDisabled', isOn('depositsDisabled') ? 0 : 1)}
                  aria-pressed={isOn('depositsDisabled')}
                  className={cn('rounded-xl border-2 px-2 py-2 text-[10px] font-black leading-tight',
                    isOn('depositsDisabled') ? 'border-red-700 bg-red-700 text-white' : 'border-stone-200 bg-white text-stone-600')}
                >
                  📥 Stop deposits<br />{isOn('depositsDisabled') ? 'STOPPED' : 'ALLOWED'}
                </button>
              </div>
            </GameCard>

            <GameCard>
              <p className="text-sm font-black text-stone-800">💰 Economy settings</p>
              <p className="mb-3 text-[11px] text-stone-600">Changes apply instantly across the whole platform.</p>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(config).map(([key, value]) => (
                  <div key={key}>
                    <Label htmlFor={`cfg-${key}`} className="text-[10px] font-bold text-stone-600">{key}</Label>
                    <Input id={`cfg-${key}`} type="number"
                      value={value}
                      onChange={e => setConfig(c => ({ ...c, [key]: e.target.value }))}
                      className="mt-0.5 h-9 rounded-lg border-stone-200 bg-stone-50 text-xs"
                    />
                  </div>
                ))}
              </div>
              <Button onClick={saveConfig} disabled={busy}
                className="mt-3 h-10 w-full rounded-xl bg-green-700 font-extrabold text-white"
              >
                💾 Save settings
              </Button>
            </GameCard>

            <GameCard>
              <p className="text-sm font-black text-stone-800">🧮 Economy rules reference</p>
              <ul className="mt-2 space-y-1 text-[11px] text-stone-600">
                <li>• <b>startingBalance</b> — coins given to new farmers on registration</li>
                <li>• <b>globalProduction</b> — % multiplier on all egg &amp; animal production (100 = normal)</li>
                <li>• <b>marketFeePct</b> — platform fee taken from marketplace sales</li>
                <li>• <b>withdrawalMin</b> — minimum coins a player must request to withdraw</li>
                <li>• <b>gemToCoins</b> — exchange rate: 1💎 = N 🪙</li>
                <li>• <b>referralBonus</b> — coins granted to both parties on a new referral</li>
                <li>• <b>maintenanceMode</b> — 1 = game paused for players (admins unaffected)</li>
                <li>• <b>withdrawalsDisabled</b> — 1 = payout requests blocked (emergency mode)</li>
                <li>• <b>marketplaceDisabled</b> — 1 = market listing &amp; buying blocked</li>
                <li>• <b>arcadeRewardsEnabled</b> — 0 = mini games pay 0 rewards (kill switch)</li>
                <li>• <b>coinsPerUsd</b> — conversion rate for cash deposits ($1 = N coins)</li>
                <li>• <b>depositMinCents / depositMaxCents</b> — deposit limits in USD cents</li>
                <li>• <b>firstDepositBonusPct</b> — extra bonus % on a player's first deposit</li>
                <li>• <b>wdFeePct</b> — withdrawal processing fee in basis points (200 = 2%)</li>
                <li>• <b>wdMaxCoins</b> — max coins per withdrawal request</li>
                <li>• <b>depositsDisabled</b> — 1 = deposit submissions blocked (emergency mode)</li>
              </ul>
            </GameCard>
          </div>
        )}

        {/* ════════ EVENTS ════════ */}
        {tab === 'events' && (
          <div className="space-y-2">
            <GameCard>
              <p className="text-sm font-black text-stone-800">🎉 Create event</p>
              <p className="text-[11px] text-stone-600">All farmers get notified when an event goes live.</p>
              <div className="mt-2 space-y-2">
                <div>
                  <Label htmlFor="ev-name" className="text-[10px] font-bold text-stone-600">Event name</Label>
                  <Input id="ev-name" value={evName} onChange={e => setEvName(e.target.value)} placeholder="e.g. Double Egg Weekend" className="mt-0.5 h-9 rounded-lg bg-stone-50 text-xs" />
                </div>
                <div>
                  <Label htmlFor="ev-desc" className="text-[10px] font-bold text-stone-600">Description</Label>
                  <Input id="ev-desc" value={evDesc} onChange={e => setEvDesc(e.target.value)} placeholder="Short description" className="mt-0.5 h-9 rounded-lg bg-stone-50 text-xs" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label htmlFor="ev-mult" className="text-[10px] font-bold text-stone-600">Multiplier % (100–500)</Label>
                    <Input id="ev-mult" type="number" value={evMult} onChange={e => setEvMult(e.target.value)} className="mt-0.5 h-9 rounded-lg bg-stone-50 text-xs" />
                  </div>
                  <div>
                    <Label htmlFor="ev-days" className="text-[10px] font-bold text-stone-600">Duration (days)</Label>
                    <Input id="ev-days" type="number" value={evDays} onChange={e => setEvDays(e.target.value)} className="mt-0.5 h-9 rounded-lg bg-stone-50 text-xs" />
                  </div>
                </div>
                <Button onClick={createEvent} disabled={busy || !evName}
                  className="h-10 w-full rounded-xl bg-amber-800 font-extrabold text-white"
                >
                  🚀 Launch event
                </Button>
              </div>
            </GameCard>

            {events.map(ev => (
              <GameCard key={ev.id} className={cn(!ev.active && 'opacity-60')}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-black text-stone-800">{ev.name}</p>
                    <p className="text-[11px] text-stone-600">{ev.description}</p>
                    <p className="mt-0.5 text-[10px] font-bold text-amber-700">×{(ev.multiplier / 100).toFixed(1)} · ends {new Date(ev.endsAt).toLocaleDateString()}</p>
                  </div>
                  <div className="flex shrink-0 flex-col gap-1">
                    <span className={cn('rounded-full px-2 py-0.5 text-center text-[9px] font-black uppercase', ev.active ? 'bg-green-100 text-green-700' : 'bg-stone-200 text-stone-600')}>
                      {ev.active ? 'live' : 'off'}
                    </span>
                    <button onClick={() => eventAction(ev.id, 'toggle')} disabled={busy}
                      aria-label={`${ev.active ? 'Stop' : 'Start'} event ${ev.name}`}
                      className="min-h-9 rounded-full bg-stone-100 px-2 py-0.5 text-[9px] font-bold text-stone-600">
                      {ev.active ? 'Stop' : 'Start'}
                    </button>
                    <button onClick={() => eventAction(ev.id, 'delete')} disabled={busy}
                      aria-label={`Delete event ${ev.name}`}
                      className="min-h-9 rounded-full bg-red-50 px-2 py-0.5 text-[9px] font-bold text-red-700">
                      Delete
                    </button>
                  </div>
                </div>
              </GameCard>
            ))}
          </div>
        )}

        {/* ════════ BROADCAST ════════ */}
        {tab === 'broadcast' && (
          <div className="space-y-2">
            <GameCard>
              <p className="text-sm font-black text-stone-800">📢 Broadcast notification</p>
              <p className="text-[11px] text-stone-600">Sends an in-game alert to every farmer instantly.</p>
              <div className="mt-2 space-y-2">
                <div>
                  <Label htmlFor="bc-title" className="text-[10px] font-bold text-stone-600">Title</Label>
                  <Input id="bc-title" value={bcTitle} onChange={e => setBcTitle(e.target.value)} placeholder="e.g. 🎁 Free gems today!" className="mt-0.5 h-9 rounded-lg bg-stone-50 text-xs" />
                </div>
                <div>
                  <Label htmlFor="bc-msg" className="text-[10px] font-bold text-stone-600">Message</Label>
                  <textarea id="bc-msg" value={bcMsg}
                    onChange={e => setBcMsg(e.target.value)}
                    placeholder="Message body…"
                    rows={3}
                    className="w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-green-600"
                  />
                </div>
                <Button onClick={broadcast} disabled={busy || !bcTitle || !bcMsg}
                  className="h-10 w-full rounded-xl bg-red-700 font-extrabold text-white"
                >
                  📤 Send to all farmers
                </Button>
              </div>
            </GameCard>
          </div>
        )}

        {/* ════════ ANALYTICS ════════ */}
        {tab === 'analytics' && (!analytics ? <LoadingSpinner label="Crunching numbers…" /> : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <StatCard icon="🔁" label="D1 retention" value={analytics.retention.d1} tone="green" sub="% of new users returning next day" />
              <StatCard icon="📅" label="D3 retention" value={analytics.retention.d3} tone="teal" sub="% active 3+ days after joining" />
              <StatCard icon="📱" label="Sessions / user (7d)" value={analytics.retention.sessionsPerUser} tone="lime" sub={`${analytics.retention.totalSessions7d} sessions total`} />
              <StatCard icon="👑" label="VIP members" value={analytics.vipCount} tone="amber" />
              <StatCard icon="🪙" label="Coins generated (14d)" value={analytics.economyHealth.totalGenerated14d} tone="orange" />
              <StatCard icon="🔥" label="Coins burned (14d)" value={analytics.economyHealth.totalSpent14d} tone="red" sub={
                analytics.economyHealth.signal === 'inflation-warning' ? '⚠️ inflation risk'
                  : analytics.economyHealth.signal === 'deflation' ? '❄️ deflation'
                    : '✅ balanced flow'
              } />
            </div>

            <GameCard>
              <p className="mb-2 text-xs font-black text-stone-700">👥 Daily active users (14d)</p>
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={analytics.dauSeries}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 9 }} />
                    <Line type="monotone" dataKey="dau" stroke="#0d9488" strokeWidth={3} dot={{ r: 2 }} name="DAU" />
                    <Line type="monotone" dataKey="newUsers" stroke="#16a34a" strokeWidth={2} dot={{ r: 2 }} name="New users" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </GameCard>

            <GameCard>
              <p className="mb-2 text-xs font-black text-stone-700">💰 Coin flow: generated vs spent (14d)</p>
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analytics.economySeries}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 9 }} />
                    <Bar dataKey="generated" fill="#16a34a" radius={[4, 4, 0, 0]} name="Generated" />
                    <Bar dataKey="spent" fill="#dc2626" radius={[4, 4, 0, 0]} name="Spent" />
                    <Bar dataKey="marketVolume" fill="#7c3aed" radius={[4, 4, 0, 0]} name="Market volume" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </GameCard>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <GameCard>
                <p className="mb-2 text-xs font-black text-stone-700">💳 Revenue (14d, USD)</p>
                <div className="h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analytics.revenueSeries}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                      <XAxis dataKey="date" tick={{ fontSize: 9 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip contentStyle={{ fontSize: 12, borderRadius: 12 }} formatter={(v: number) => [`$${(v / 100).toFixed(2)}`, 'revenue']} />
                      <Bar dataKey="revenueCents" fill="#be185d" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </GameCard>

              <GameCard>
                <p className="mb-2 text-xs font-black text-stone-700">🥚 Egg economy (14d)</p>
                <div className="h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={analytics.eggSeries}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                      <XAxis dataKey="date" tick={{ fontSize: 9 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip contentStyle={{ fontSize: 12, borderRadius: 12 }} />
                      <Legend wrapperStyle={{ fontSize: 9 }} />
                      <Line type="monotone" dataKey="laid" stroke="#ca8a04" strokeWidth={2} dot={false} name="Laid" />
                      <Line type="monotone" dataKey="hatched" stroke="#ea580c" strokeWidth={2} dot={false} name="Hatched" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </GameCard>
            </div>

            <GameCard>
              <p className="text-xs font-black text-stone-700">🏆 Top spenders (14d)</p>
              {analytics.topSpenders.length === 0 ? (
                <p className="mt-2 text-[11px] text-stone-600">No purchases yet — revenue charts fill in as players buy gems or VIP.</p>
              ) : (
                <div className="mt-2 space-y-1">
                  {analytics.topSpenders.map((s, i) => (
                    <div key={s.userId} className="flex items-center justify-between rounded-lg bg-stone-50 px-2 py-1.5 text-[11px]">
                      <span className="font-black text-stone-600">{i + 1}. @{s.username}</span>
                      <span className="font-bold text-stone-600">{s.count} orders · <b className="text-pink-700">${(s.cents / 100).toFixed(2)}</b></span>
                    </div>
                  ))}
                </div>
              )}
            </GameCard>

            <GameCard>
              <p className="text-xs font-black text-stone-700">📦 Revenue by SKU</p>
              <div className="mt-2 space-y-1">
                {analytics.revenueBySku.length === 0 ? (
                  <p className="text-[11px] text-stone-600">No data yet.</p>
                ) : analytics.revenueBySku.map(s => (
                  <div key={s.sku} className="flex items-center justify-between rounded-lg bg-stone-50 px-2 py-1.5 text-[11px]">
                    <span className="font-black text-stone-600">{s.sku}</span>
                    <span className="font-bold text-stone-600">×{s.count} · ${(s.cents / 100).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </GameCard>
          </div>
        ))}

        {/* ════════ SECURITY ════════ */}
        {tab === 'security' && (!security ? <LoadingSpinner label="Checking security…" /> : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <StatCard icon="🚩" label="Flagged accounts" value={security.summary.flaggedCount} tone="red" />
              <StatCard icon="🤖" label="Rate-limit hits" value={security.summary.rateLimitedCount} tone="amber" />
              <StatCard icon="🏷️" label="Price-abuse blocks" value={security.summary.priceAbuseCount} tone="purple" />
              <StatCard icon="🛡️" label="Staff accounts" value={security.summary.adminCount} tone="teal" />
            </div>

            <GameCard className="bg-gradient-to-r from-red-50 to-white">
              <p className="text-xs font-black text-stone-700">🔐 My role: {security.me.roleLabel}</p>
              <p className="mt-1 text-[10px] font-bold text-stone-600">Permission matrix:</p>
              <div className="mt-1 space-y-0.5">
                {security.roleMatrix.map(r => (
                  <p key={r.role} className={cn('text-[10px] font-bold', r.role === security.me.role ? 'text-red-700' : 'text-stone-600')}>
                    {r.roleLabel}: {r.perms.includes('*') ? 'ALL permissions' : r.perms.join(', ')}
                  </p>
                ))}
              </div>
            </GameCard>

            {security.flagged.length > 0 && (
              <GameCard className="border-red-300 bg-red-50/50">
                <p className="text-xs font-black text-red-700">🚩 Flagged accounts</p>
                <div className="mt-2 space-y-1">
                  {security.flagged.map(f => (
                    <div key={f.id} className="flex items-center justify-between gap-2 rounded-lg bg-white px-2 py-1.5 text-[11px]">
                      <div className="min-w-0">
                        <p className="truncate font-black text-stone-700">{f.avatar} {f.farmName} <span className="font-normal text-stone-600">@{f.username}</span></p>
                        <p className="truncate text-[10px] text-red-700">{f.flagReason}</p>
                      </div>
                      <button onClick={async () => { await userAction(f.id, 'unflag'); loadSecurity() }}
                        aria-label={`Clear flag on ${f.username}`}
                        className="min-h-9 shrink-0 rounded-full bg-green-100 px-2 py-1 text-[9px] font-black text-green-700"
                      >
                        Clear flag
                      </button>
                    </div>
                  ))}
                </div>
              </GameCard>
            )}

            <GameCard>
              <p className="text-xs font-black text-stone-700">👥 Staff roles</p>
              <p className="text-[10px] text-stone-600">Assign roles in the Users tab (SuperAdmin only).</p>
              <div className="mt-2 space-y-1">
                {security.admins.map(a => (
                  <div key={a.id} className="flex items-center justify-between rounded-lg bg-stone-50 px-2 py-1.5 text-[11px]">
                    <span className="font-black text-stone-600">{a.farmName} <span className="font-normal text-stone-600">@{a.username}</span></span>
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-[9px] font-black text-red-700">{a.roleLabel}</span>
                  </div>
                ))}
              </div>
            </GameCard>

            <GameCard>
              <p className="text-xs font-black text-stone-700">📋 Security events</p>
              {security.events.length === 0 ? (
                <p className="mt-2 text-[11px] text-stone-600">No security events — all clean ✅</p>
              ) : (
                <div className="mt-2 space-y-1">
                  {security.events.map(ev => (
                    <div key={ev.id} className="rounded-lg bg-stone-50 px-2 py-1.5 text-[10px]">
                      <p className="font-black text-stone-600">
                        <span className={cn(
                          'mr-1 rounded px-1 py-0.5 text-[8px] font-black uppercase',
                          ev.kind === 'bot_suspect' ? 'bg-red-200 text-red-700'
                            : ev.kind === 'price_abuse' ? 'bg-purple-200 text-purple-700'
                              : 'bg-amber-200 text-amber-700',
                        )}>
                          {ev.kind}
                        </span>
                        @{ev.username}
                      </p>
                      <p className="text-stone-600">{ev.detail} · {new Date(ev.createdAt).toLocaleString()}</p>
                    </div>
                  ))}
                </div>
              )}
            </GameCard>

            <GameCard>
              <p className="text-xs font-black text-stone-700">🧾 Admin activity log</p>
              {security.logs.length === 0 ? (
                <p className="mt-2 text-[11px] text-stone-600">No admin actions logged yet.</p>
              ) : (
                <div className="mt-2 space-y-1">
                  {security.logs.map(l => (
                    <div key={l.id} className="rounded-lg bg-stone-50 px-2 py-1.5 text-[10px]">
                      <p className="font-black text-stone-600">🛡️ {l.adminName} · {l.action}</p>
                      <p className="text-stone-600">{l.detail} · {new Date(l.createdAt).toLocaleString()}</p>
                    </div>
                  ))}
                </div>
              )}
            </GameCard>
          </div>
        ))}

        {/* ════════ MINI GAMES ════════ */}
        {tab === 'games' && (!miniGames ? <LoadingSpinner label="Loading arcade control…" /> : (
          <div className="space-y-2">
            <div className="grid grid-cols-3 gap-2">
              <StatCard icon="🎮" label="Total plays" value={miniGames.totals.totalPlays} tone="purple" sub={`+${miniGames.totals.playsToday} today`} />
              <StatCard icon="🪙" label="Coins awarded" value={miniGames.totals.coinsAwarded} tone="amber" sub={`+${miniGames.totals.xpAwarded.toLocaleString()} XP`} />
              <StatCard icon="🚨" label="Cheat alerts" value={miniGames.totals.cheatedCount} tone="red" sub="rejected sessions" />
            </div>

            {miniGames.games.map(g => (
              <GameCard key={g.id} className={cn(!g.enabled && 'opacity-60')}>
                <div className="flex items-center gap-2">
                  <span className="text-2xl" aria-hidden="true">{g.emoji}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-black text-stone-800">{g.name}</p>
                    <p className="text-[10px] text-stone-600">
                      {g.plays} plays · ✅ {g.wins} wins · ❌ {g.losses} losses{g.rejected > 0 && <span className="font-bold text-red-700"> · 🚨 {g.rejected} rejected</span>}
                    </p>
                  </div>
                  <button onClick={() => gameAdmin('toggle_game', { gameId: g.id })}
                    disabled={busy}
                    aria-label={`${g.enabled ? 'Disable' : 'Enable'} ${g.name}`}
                    className={cn(
                      'min-h-9 shrink-0 rounded-full px-3 py-1.5 text-[10px] font-black text-white disabled:opacity-40',
                      g.enabled ? 'bg-red-700' : 'bg-green-700',
                    )}
                  >
                    {g.enabled ? '⏸ Disable' : '▶ Enable'}
                  </button>
                </div>
                <div className="mt-2 flex items-end gap-1.5">
                  <div className="w-28">
                    <Label htmlFor={`cost-${g.id}`} className="text-[9px] font-bold text-stone-600">Entry cost (⚡ energy)</Label>
                    <Input type="number" min={1} max={50} defaultValue={g.energyCost}
                      id={`cost-${g.id}`}
                      className="mt-0.5 h-9 rounded-lg bg-stone-50 text-xs"
                    />
                  </div>
                  <button onClick={() => {
                    const el = document.getElementById(`cost-${g.id}`) as HTMLInputElement | null
                    gameAdmin('set_energy_cost', { gameId: g.id, energyCost: Number(el?.value ?? g.energyCost) })
                  }}
                    disabled={busy}
                    aria-label={`Save energy cost for ${g.name}`}
                    className="min-h-9 rounded-lg bg-stone-700 px-3 text-[10px] font-black text-white disabled:opacity-40"
                  >
                    Save cost
                  </button>
                </div>
              </GameCard>
            ))}

            {/* season payout */}
            <GameCard className="bg-gradient-to-r from-amber-50 to-white">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-black text-stone-800">🏆 Season {miniGames.season.monthKey} — champion payout</p>
                  <p className="text-[10px] text-stone-600">Top 3 farmers by total arcade score this month</p>
                </div>
                <button onClick={() => gameAdmin('season_payout')}
                  disabled={busy || miniGames.season.paid || miniGames.season.top3.length === 0}
                  aria-label="Pay season rewards to the top 3 players"
                  className={cn(
                    'min-h-9 rounded-full px-3 py-1.5 text-[10px] font-black text-white disabled:opacity-40',
                    miniGames.season.paid ? 'bg-stone-700' : 'bg-amber-800',
                  )}
                >
                  {miniGames.season.paid ? '✅ Paid' : '💰 Pay rewards'}
                </button>
              </div>
              <div className="mt-2 space-y-1">
                {miniGames.season.top3.length === 0 ? (
                  <p className="text-[11px] text-stone-600">No arcade scores recorded this month yet.</p>
                ) : miniGames.season.top3.map(r => (
                  <div key={r.userId} className="flex items-center gap-2 rounded-lg bg-white px-2 py-1.5 text-[11px] shadow-sm">
                    <span>{['🥇', '🥈', '🥉'][r.rank - 1]}</span>
                    <span aria-hidden="true">{r.avatar}</span>
                    <span className="flex-1 font-black text-stone-700">@{r.username}</span>
                    <span className="font-bold tabular-nums text-purple-700">{r.totalScore.toLocaleString()} pts</span>
                    <span className="text-[10px] text-stone-600">→ {r.reward}</span>
                  </div>
                ))}
              </div>
            </GameCard>

            {/* per-game health — the panel showed flat lifetime counters,
                which never answer "is this game actually any good" */}
            {miniGames.analytics.length > 0 && (
              <GameCard>
                <p className="text-xs font-black text-stone-700">📈 Per-game health</p>
                <p className="mt-0.5 text-[10px] text-stone-600">
                  Win rate, typical run and payout per game. Coins/min is the honest
                  read on whether a game is worth its energy cost.
                </p>
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full min-w-[520px] text-left text-[11px]">
                    <thead>
                      <tr className="border-b border-stone-200 text-[9px] font-black uppercase tracking-wide text-stone-600">
                        <th scope="col" className="py-1 pr-2">Game</th>
                        <th scope="col" className="py-1 pr-2 text-right">Plays</th>
                        <th scope="col" className="py-1 pr-2 text-right">Players</th>
                        <th scope="col" className="py-1 pr-2 text-right">Win %</th>
                        <th scope="col" className="py-1 pr-2 text-right">Avg</th>
                        <th scope="col" className="py-1 pr-2 text-right">Avg 🪙</th>
                        <th scope="col" className="py-1 text-right">🪙/min</th>
                      </tr>
                    </thead>
                    <tbody>
                      {miniGames.analytics.map(a => (
                        <tr key={a.gameKey} className="border-b border-stone-100 last:border-0">
                          <th scope="row" className="py-1.5 pr-2 font-black text-stone-700">
                            {GAME_LABELS[a.gameKey] ?? a.gameKey}
                          </th>
                          <td className="py-1.5 pr-2 text-right tabular-nums text-stone-700">{a.plays.toLocaleString()}</td>
                          <td className="py-1.5 pr-2 text-right tabular-nums text-stone-700">
                            {a.uniquePlayers.toLocaleString()}
                            <span className="ml-1 text-[9px] text-stone-500">×{a.playsPerPlayer}</span>
                          </td>
                          <td className={cn(
                            'py-1.5 pr-2 text-right font-black tabular-nums',
                            a.winRate >= 50 ? 'text-green-700' : a.winRate >= 20 ? 'text-amber-700' : 'text-red-700',
                          )}>
                            {a.winRate}
                          </td>
                          <td className="py-1.5 pr-2 text-right tabular-nums text-stone-700">{a.avgScore.toLocaleString()}</td>
                          <td className="py-1.5 pr-2 text-right tabular-nums text-stone-700">{a.avgCoins.toLocaleString()}</td>
                          <td className="py-1.5 text-right font-black tabular-nums text-stone-800">{a.coinsPerMinute.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </GameCard>
            )}

            {/* cheat monitor */}
            {miniGames.cheated.length > 0 && (
              <GameCard className="border-red-200 bg-red-50/50">
                <p className="text-xs font-black text-red-700">🚨 Cheat monitor — impossible sessions</p>
                <div className="mt-2 space-y-1">
                  {miniGames.cheated.map(c => (
                    <div key={c.id} className="rounded-lg bg-white px-2 py-1.5 text-[10px]">
                      <p className="font-black text-stone-600">
                        {c.gameKey === 'chicken_run' ? '🏃' : '🚦'} @{c.username} {c.flagged && <span className="rounded bg-amber-800 px-1 text-[8px] font-black text-white">🚩 FLAGGED</span>}
                      </p>
                      <p className="text-stone-600">{new Date(c.createdAt).toLocaleString()}</p>
                    </div>
                  ))}
                </div>
              </GameCard>
            )}

            {/* recent sessions */}
            <GameCard>
              <p className="text-xs font-black text-stone-700">🕹️ Recent sessions</p>
              <div className="mt-2 space-y-1">
                {miniGames.recent.map(s => (
                  <div key={s.id} className="flex items-center gap-2 rounded-lg bg-stone-50 px-2 py-1.5 text-[10px]">
                    <span aria-hidden="true">{s.avatar}</span>
                    <span className="flex-1 truncate font-bold text-stone-600">@{s.username}</span>
                    <span className="text-stone-600">{s.gameKey === 'chicken_run' ? `${s.distance}m` : `${s.score} roads`}</span>
                    <span className="font-bold text-amber-700">🪙{s.coins}</span>
                    <span className={cn(
                      'rounded px-1 text-[8px] font-black uppercase',
                      s.cheated ? 'bg-red-200 text-red-700'
                        : s.result === 'win' ? 'bg-green-200 text-green-700'
                          : s.result === 'rejected' ? 'bg-red-200 text-red-700'
                            : 'bg-stone-200 text-stone-600',
                    )}>{s.cheated ? 'CHEAT' : s.result}</span>
                  </div>
                ))}
              </div>
            </GameCard>
          </div>
        ))}

        {/* ════════ SUPPORT ════════ */}
        {tab === 'support' && (!support ? <LoadingSpinner label="Loading tickets…" /> : (
          <div className="space-y-2">
            <div className="grid grid-cols-3 gap-2">
              <StatCard icon="📬" label="Open" value={support.counts.open} tone="amber" />
              <StatCard icon="✅" label="Answered" value={support.counts.answered} tone="green" />
              <StatCard icon="🗄️" label="Closed" value={support.counts.closed} tone="teal" />
            </div>

            <div className="flex gap-1" role="group" aria-label="Filter tickets by status">
              {(['open', 'answered', 'closed'] as const).map(f => (
                <button key={f} onClick={() => setSupportFilter(f)}
                  aria-pressed={supportFilter === f}
                  className={cn('min-h-9 rounded-full px-3 py-1.5 text-[11px] font-extrabold capitalize',
                    supportFilter === f ? 'bg-red-700 text-white shadow' : 'bg-stone-100 text-stone-600')}>
                  {f}
                </button>
              ))}
            </div>

            {support.tickets.length === 0 ? (
              <EmptyState emoji="🎫" title={`No ${supportFilter} tickets`} sub="Player tickets appear here in real time" />
            ) : support.tickets.map(t => (
              <GameCard key={t.id} className={cn(t.status === 'open' && 'border-amber-300')}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-black text-stone-800">{t.subject}</p>
                    <p className="text-[10px] text-stone-600">
                      @{t.username} · {t.category}{t.assignedTo ? ` · assigned: ${t.assignedTo}` : ''} · {new Date(t.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <span className={cn(
                    'shrink-0 rounded-full px-2 py-0.5 text-[9px] font-black uppercase',
                    t.status === 'open' ? 'bg-amber-100 text-amber-700'
                      : t.status === 'answered' ? 'bg-green-100 text-green-700'
                        : 'bg-stone-200 text-stone-600',
                  )}>{t.status}</span>
                </div>

                {/* thread */}
                <div className="mt-2 max-h-40 space-y-1.5 overflow-y-auto rounded-xl bg-stone-50 p-2">
                  {t.messages.map(m => (
                    <div key={m.id} className={cn('flex', m.sender === 'staff' ? 'justify-start' : 'justify-end')}>
                      <div className={cn(
                        'max-w-[85%] rounded-xl px-2 py-1.5 text-[10px]',
                        m.sender === 'staff' ? 'bg-green-100' : 'bg-stone-200',
                      )}>
                        <p className="text-[8px] font-black uppercase text-stone-600">{m.sender === 'staff' ? `🛡️ ${m.senderName}` : m.senderName}</p>
                        {m.body}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-2 flex gap-1.5">
                  <Input value={ticketReply[t.id] ?? ''}
                    onChange={e => setTicketReply(r => ({ ...r, [t.id]: e.target.value }))}
                    placeholder="Reply as staff…"
                    aria-label={`Reply to ticket from ${t.username}`}
                    className="h-9 flex-1 rounded-lg bg-stone-50 text-xs"
                  />
                  <button onClick={() => { ticketAdmin(t.id, 'reply', ticketReply[t.id]); setTicketReply(r => ({ ...r, [t.id]: '' })) }}
                    disabled={busy || !ticketReply[t.id]?.trim()}
                    aria-label={`Send reply to ${t.username}`}
                    className="min-h-9 rounded-lg bg-green-700 px-3 text-[10px] font-black text-white disabled:opacity-40"
                  >
                    Reply
                  </button>
                  <button onClick={() => ticketAdmin(t.id, t.status === 'closed' ? 'reopen' : 'close')}
                    disabled={busy}
                    aria-label={`${t.status === 'closed' ? 'Reopen' : 'Close'} ticket from ${t.username}`}
                    className="min-h-9 rounded-lg bg-stone-200 px-3 text-[10px] font-black text-stone-600 disabled:opacity-40"
                  >
                    {t.status === 'closed' ? 'Reopen' : 'Close'}
                  </button>
                </div>
              </GameCard>
            ))}
          </div>
        ))}
      </div>

      {/* ════════ PAYMENT PROOF VIEWER ════════ */}
      {proofView && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4"
          onClick={() => setProofView(null)}
        >
          <div className="max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-2xl bg-white p-3 shadow-2xl"
            onClick={e => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={`Payment proof from ${proofView.username}`}
          >
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-black text-stone-800">🖼️ Payment proof</p>
              <button onClick={() => setProofView(null)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-stone-100 text-sm font-black text-stone-600"
                aria-label="Close proof viewer"
              >
                ✕
              </button>
            </div>
            <p className="text-[11px] font-bold text-stone-600">
              {USD(proofView.amountCents)} · {proofView.method.toUpperCase()} · @{proofView.username}
            </p>
            <p className="text-[10px] text-stone-600">
              Sender: {proofView.senderName} · Ref: {proofView.reference}
            </p>
            {proofView.proof ? (
              <img src={proofView.proof} alt={`Payment proof from ${proofView.username}`} className="mt-2 w-full rounded-xl border border-stone-200" />
            ) : (
              <p className="mt-2 rounded-lg bg-stone-50 px-3 py-4 text-center text-[11px] font-bold text-stone-600">No proof attached</p>
            )}
            {proofView.status === 'pending' && (
              <div className="mt-2 flex gap-1.5">
                <Button size="sm" disabled={busy} onClick={() => { depAction(proofView.id, 'approve'); setProofView(null) }}
                  aria-label={`Verify and credit ${proofView.username}'s deposit`}
                  className="min-h-9 flex-1 rounded-lg bg-green-700 text-[11px] font-extrabold text-white">
                  ✅ Verify &amp; credit
                </Button>
                <Button size="sm" disabled={busy} onClick={() => { depAction(proofView.id, 'reject'); setProofView(null) }}
                  aria-label={`Reject ${proofView.username}'s deposit`}
                  className="min-h-9 flex-1 rounded-lg bg-red-700 text-[11px] font-extrabold text-white">
                  ❌ Reject
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </motion.div>
  )
}

function StatCard({ icon, label, value, tone, sub }: { icon: string; label: string; value: number | string; tone: string; sub?: string }) {
  const tones: Record<string, string> = {
    green: 'from-green-50 to-white border-green-200',
    teal: 'from-teal-50 to-white border-teal-200',
    amber: 'from-amber-50 to-white border-amber-200',
    lime: 'from-lime-50 to-white border-lime-200',
    orange: 'from-orange-50 to-white border-orange-200',
    purple: 'from-purple-50 to-white border-purple-200',
    red: 'from-red-50 to-white border-red-200',
    pink: 'from-pink-50 to-white border-pink-200',
  }
  return (
    <div className={cn('rounded-2xl border bg-gradient-to-br p-3 shadow-sm', tones[tone] ?? tones.green)}>
      <p className="text-[10px] font-black uppercase tracking-wide text-stone-600"><span aria-hidden="true">{icon}</span> {label}</p>
      <p className="text-xl font-black tabular-nums text-stone-800">{typeof value === 'number' ? value.toLocaleString() : value}</p>
      {sub && <p className="text-[9px] font-bold text-stone-600">{sub}</p>}
    </div>
  )
}

function UserRow({ u, busy, onAction, onDone }: { u: AdminUser; busy: boolean; onAction: (id: string, action: string, extra?: Record<string, unknown>) => Promise<void>; onDone: () => void }) {
  const [open, setOpen] = useState(false)
  const [adjCoins, setAdjCoins] = useState('')
  const [adjGems, setAdjGems] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [role, setRole] = useState<string>(u.adminRole ?? (u.isAdmin ? 'super' : 'none'))

  return (
    <GameCard className={cn(u.isBlocked && 'border-red-200 bg-red-50/40', u.flagged && !u.isBlocked && 'border-amber-400 bg-amber-50/40')}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        aria-label={`${open ? 'Collapse' : 'Expand'} ${u.farmName} (@${u.username}) admin controls`}
        className="flex w-full items-center gap-2 text-left"
      >
        <span className="text-2xl" aria-hidden="true">{u.avatar}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-black text-stone-800">
            {u.farmName} {u.isAdmin && <span className="rounded bg-red-100 px-1 text-[9px] font-black text-red-700">{u.roleLabel ?? 'ADMIN'}</span>}
            {u.isBlocked && <span className="rounded bg-red-700 px-1 text-[9px] font-black text-white">BLOCKED</span>}
            {u.flagged && !u.isBlocked && <span className="rounded bg-amber-800 px-1 text-[9px] font-black text-white">🚩 FLAG</span>}
            {u.vipActive && <span title="VIP">👑</span>}
          </p>
          <p className="text-[10px] text-stone-600">@{u.username} · {u.levelName} (Lv{u.numericLevel}) · 🐔{u.hens} 🐄{u.animals} · Coop Lv{u.coopLevel}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[11px] font-black tabular-nums text-amber-700">🪙 {u.coins.toLocaleString()}</p>
          <p className="text-[10px] font-bold tabular-nums text-pink-700">💎 {u.gems}</p>
        </div>
        <span className="shrink-0 text-stone-500" aria-hidden="true">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="mt-2 space-y-2 border-t border-stone-100 pt-2">
          <p className="text-[9px] text-stone-600">
            Joined {new Date(u.createdAt).toLocaleDateString()} · Last seen {new Date(u.lastSeenAt).toLocaleString()} · Ref: {u.referralCode} · Earned: 🪙{u.totalEarned.toLocaleString()} · Eggs: {u.totalEggsHatch}
          </p>
          {u.flagged && (
            <div className="flex items-center gap-2 rounded-lg bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-700">
              <span>🚩 Flagged: {u.flagReason}</span>
              <button onClick={() => onAction(u.id, 'unflag').then(onDone)}
                aria-label={`Clear flag on ${u.username}`}
                className="min-h-9 rounded-full bg-green-100 px-2 py-0.5 text-[9px] font-black text-green-700"
              >
                Clear
              </button>
            </div>
          )}
          {/* role management (SuperAdmin only — enforced server-side) */}
          <div className="flex items-end gap-1.5">
            <div className="flex-1">
              <Label htmlFor={`role-${u.id}`} className="text-[9px] font-bold text-stone-600">Admin role (SuperAdmin only)</Label>
              <select id={`role-${u.id}`} value={role}
                onChange={e => setRole(e.target.value)}
                className="mt-0.5 h-9 w-full rounded-lg border border-stone-200 bg-stone-50 text-xs font-bold"
              >
                <option value="none">— No admin access —</option>
                <option value="super">SuperAdmin (full control)</option>
                <option value="finance">FinanceManager (payouts/economy)</option>
                <option value="game">GameManager (events/users)</option>
                <option value="support">SupportManager (users/broadcast)</option>
              </select>
            </div>
            <button disabled={busy}
              onClick={async () => { await onAction(u.id, 'set_role', { role }); onDone() }}
              aria-label={`Set admin role for ${u.username}`}
              className="min-h-9 rounded-lg bg-red-700 px-3 text-[10px] font-black text-white disabled:opacity-40"
            >
              Set role
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {!u.isAdmin && (
              <button disabled={busy}
                onClick={() => onAction(u.id, u.isBlocked ? 'unblock' : 'block')}
                aria-label={`${u.isBlocked ? 'Unblock' : 'Block'} ${u.username}`}
                className={cn(
                  'min-h-9 rounded-full px-3 py-1.5 text-[10px] font-black text-white',
                  u.isBlocked ? 'bg-green-700' : 'bg-red-700',
                )}
              >
                {u.isBlocked ? '✅ Unblock' : '⛔ Block'}
              </button>
            )}
            <button disabled={busy}
              onClick={() => onAction(u.id, 'grant_hen', { henType: 'golden' })}
              aria-label={`Gift a golden hen to ${u.username}`}
              className="min-h-9 rounded-full bg-amber-700 px-3 py-1.5 text-[10px] font-black text-white"
            >
              🐔 Gift golden hen
            </button>
            <button disabled={busy}
              onClick={() => onAction(u.id, 'freeze_farm')}
              aria-label={`Freeze ${u.username}'s farm`}
              className="min-h-9 rounded-full bg-stone-700 px-3 py-1.5 text-[10px] font-black text-white"
            >
              🧊 Freeze farm
            </button>
            <button disabled={busy}
              onClick={() => onAction(u.id, 'revoke_sessions')}
              aria-label={`Sign ${u.username} out on all devices`}
              className="min-h-9 rounded-full bg-purple-700 px-3 py-1.5 text-[10px] font-black text-white disabled:opacity-40"
            >
              🚪 Sign out everywhere
            </button>
          </div>

          {/* Account recovery. The server has supported an admin password
              reset since Phase 16, but nothing in this panel ever called it,
              so a locked-out player could only be helped by hand in the
              database. Revoking every session at the same time is what makes
              the reset actually take effect. */}
          <div className="flex items-end gap-1.5">
            <div className="flex-1">
              <Label htmlFor={`reset-pw-${u.id}`} className="text-[9px] font-bold text-stone-600">
                Reset password (signs out every device)
              </Label>
              <Input
                id={`reset-pw-${u.id}`}
                type="text"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="New password — e.g. 8+ chars, 2 classes"
                autoComplete="off"
                className="h-9 rounded-lg bg-stone-50 text-xs"
              />
            </div>
            <button
              disabled={busy || newPassword.length < 8}
              onClick={async () => {
                await onAction(u.id, 'reset_password', { newPassword })
                setNewPassword('')
              }}
              aria-label={`Reset the password for ${u.username}`}
              className="min-h-9 rounded-lg bg-red-700 px-3 text-[10px] font-black text-white disabled:opacity-40"
            >
              🔑 Reset
            </button>
          </div>
          <div className="flex items-end gap-1.5">
            <div className="flex-1">
              <Label htmlFor={`adj-coins-${u.id}`} className="text-[9px] font-bold text-stone-600">Coins +/−</Label>
              <Input id={`adj-coins-${u.id}`} type="number" value={adjCoins}
                onChange={e => setAdjCoins(e.target.value)}
                className="h-9 rounded-lg bg-stone-50 text-xs"
                placeholder="e.g. 500 / −200"
              />
            </div>
            <div className="w-24">
              <Label htmlFor={`adj-gems-${u.id}`} className="text-[9px] font-bold text-stone-600">Gems +/−</Label>
              <Input id={`adj-gems-${u.id}`} type="number" value={adjGems}
                onChange={e => setAdjGems(e.target.value)}
                className="h-9 rounded-lg bg-stone-50 text-xs"
                placeholder="e.g. 5"
              />
            </div>
            <button disabled={busy || (!adjCoins && !adjGems)}
              onClick={() => onAction(u.id, 'adjust', { coins: Number(adjCoins) || 0, gems: Number(adjGems) || 0 })}
              aria-label={`Apply balance adjustment for ${u.username}`}
              className="min-h-9 rounded-lg bg-green-700 px-3 text-[10px] font-black text-white disabled:opacity-40"
            >
              Apply
            </button>
          </div>
        </div>
      )}
    </GameCard>
  )
}
