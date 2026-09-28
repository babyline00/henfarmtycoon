'use client'

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useGame, setToken } from '@/lib/store'
import { AuthScreen } from '@/components/game/auth-screen'
import { FarmView } from '@/components/game/farm-view'
import { ShopView } from '@/components/game/shop-view'
import { MarketView } from '@/components/game/market-view'
import { SocialView } from '@/components/game/social-view'
import { QuestsView } from '@/components/game/quests-view'
import { ProfileView } from '@/components/game/profile-view'
import { GamesView } from '@/components/game/games-view'
import { AiAssistant } from '@/components/game/ai-assistant'
import { AdminPanel } from '@/components/game/admin-panel'
import { cn } from '@/lib/utils'

type View = 'farm' | 'games' | 'shop' | 'market' | 'social' | 'quests' | 'profile'

const NAV: { key: View; emoji: string; label: string }[] = [
  { key: 'farm', emoji: '🏡', label: 'Farm' },
  { key: 'games', emoji: '🎮', label: 'Games' },
  { key: 'shop', emoji: '🛒', label: 'Shop' },
  { key: 'market', emoji: '🏪', label: 'Market' },
  { key: 'social', emoji: '🤝', label: 'Social' },
  { key: 'quests', emoji: '🎯', label: 'Quests' },
  { key: 'profile', emoji: '👤', label: 'Me' },
]

export default function Page() {
  const { state, booting, boot, refresh, flash, hatchResult, setHatchResult, adminOpen, showFlash, bootError, retryBoot, clearBootError } = useGame()
  const [view, setView] = useState<View>('farm')
  const lastUnreadRef = useRef<number | null>(null)

  useEffect(() => { boot() }, [boot])

  // periodic refresh (production accumulates server-side)
  useEffect(() => {
    if (!state) return
    const t = setInterval(() => refresh(), 30000)
    return () => clearInterval(t)
  }, [state?.user.id, refresh])

  // Phase 17: push-style toast when new notifications arrive between refreshes
  useEffect(() => {
    if (!state) { lastUnreadRef.current = null; return }
    const prev = lastUnreadRef.current
    const cur = state.unreadNotifs
    if (prev !== null && cur > prev && !state.config.maintenanceMode) {
      showFlash('🔔 New farm notification — check your alerts!', 'info')
    }
    lastUnreadRef.current = cur
  }, [state?.unreadNotifs, state?.config.maintenanceMode, state, showFlash])

  if (booting) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-gradient-to-b from-lime-50 to-green-100">
        <div className="text-center" role="status" aria-live="polite">
          <div className="animate-bounce text-6xl motion-reduce:animate-none" aria-hidden="true">🐔</div>
          <p className="mt-3 text-sm font-bold text-green-800">Waking up the farm…</p>
        </div>
      </div>
    )
  }

  // A failed load used to drop the player straight onto the login screen,
  // indistinguishable from being signed out. Give them the real reason and
  // a way back, and keep the session so a retry can succeed.
  if (bootError) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-gradient-to-b from-lime-50 to-green-100 px-6">
        <div className="w-full max-w-sm rounded-2xl border border-stone-200 bg-white p-6 text-center shadow-xl">
          <div className="text-5xl" aria-hidden="true">📡</div>
          <h1 className="mt-3 text-lg font-black text-stone-800">Can&apos;t reach your farm</h1>
          <p role="alert" className="mt-2 text-sm text-stone-600">{bootError}</p>
          <div className="mt-5 flex flex-col gap-2">
            <button onClick={() => retryBoot()}
              className="min-h-11 w-full rounded-xl bg-green-700 px-4 py-3 text-sm font-black text-white transition-colors hover:bg-green-800"
            >
              Try again
            </button>
            <button onClick={() => { clearBootError(); setToken(null); setView('farm') }}
              className="min-h-11 w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-sm font-bold text-stone-700 transition-colors hover:bg-stone-50"
            >
              Sign in as someone else
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!state) return <AuthScreen />

  // ── maintenance screen (non-admin) ──
  if (state.config.maintenanceMode && !state.user.isAdmin) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-gradient-to-b from-amber-50 to-lime-100 px-6 text-center">
        <div className="text-7xl" aria-hidden="true">🚜</div>
        <h1 className="mt-4 text-2xl font-black text-stone-800">Farm Under Maintenance</h1>
        <p className="mt-2 text-sm text-stone-500">
          {state.config.maintenanceMode ? 'The barn is being cleaned and upgraded. Come back soon!' : ''}
        </p>
      </div>
    )
  }

  const readyEggs = state.incubators.filter(i => i.ready).length
  const claimable = state.missions.filter(m => m.complete && !m.claimed).length
  const canDaily = state.user.canClaimDaily
  const socialBadge = state.pendingFriendRequests + state.user.claimableLevelRewards

  return (
    <div className="min-h-dvh bg-stone-200">
      <div className="relative mx-auto flex min-h-dvh w-full max-w-md flex-col bg-gradient-to-b from-lime-50 via-amber-50/40 to-green-50 shadow-2xl">

        {/* ── top bar ── */}
        <header className="sticky top-0 z-30 border-b border-stone-200/70 bg-white/85 px-3 py-2 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-amber-200 bg-amber-50 text-lg">
              <span aria-hidden="true">{state.user.avatar}</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-black leading-tight text-stone-800">{state.user.farmName}</p>
              <p className="text-[9px] font-bold leading-tight text-green-700">⭐ {state.user.levelName}</p>
            </div>
            <div className="flex items-center gap-1">
              <span className="flex items-center gap-1 rounded-full border border-amber-300 bg-amber-100 px-2 py-1 text-[11px] font-black tabular-nums text-amber-800">
                <span aria-hidden="true">🪙</span> {state.user.coins.toLocaleString()}
              </span>
              <span className="flex items-center gap-1 rounded-full border border-pink-300 bg-pink-100 px-2 py-1 text-[11px] font-black tabular-nums text-pink-700">
                <span aria-hidden="true">💎</span> {state.user.gems.toLocaleString()}
              </span>
              <button
                onClick={() => setView('profile')}
                className="relative flex h-11 w-11 items-center justify-center rounded-full border border-stone-200 bg-white text-sm transition-colors hover:bg-stone-50"
                aria-label={state.unreadNotifs > 0
                  ? `Open profile, ${state.unreadNotifs} unread notification${state.unreadNotifs === 1 ? '' : 's'}`
                  : 'Open profile and alerts'}
              >
                <span aria-hidden="true">🔔</span>
                {state.unreadNotifs > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-700 px-1 text-[8px] font-black text-white">
                    {state.unreadNotifs}
                  </span>
                )}
              </button>
            </div>
          </div>
        </header>

        {/* ── content ── */}
        <main className="flex-1 pb-24 pt-2">
          {/* The authenticated shell had no h1 at all, so assistive tech saw a
              flat run of section headings with no page boundary. */}
          <h1 className="sr-only">{state.user.farmName} — Hen Farm Tycoon</h1>
          <AnimatePresence mode="wait">
            <motion.div key={view}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
            >
              {view === 'farm' && <FarmView />}
              {view === 'games' && <GamesView />}
              {view === 'shop' && <ShopView />}
              {view === 'market' && <MarketView />}
              {view === 'social' && <SocialView />}
              {view === 'quests' && <QuestsView />}
              {view === 'profile' && <ProfileView />}
            </motion.div>
          </AnimatePresence>
        </main>

        {/* ── bottom nav ── */}
        <nav
          aria-label="Primary"
          className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-md border-t border-stone-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md"
        >
          <div className="mx-auto grid max-w-sm grid-cols-7">
            {NAV.map(n => {
              const active = view === n.key
              const badge =
                n.key === 'farm' ? readyEggs
                  : n.key === 'games' ? 0
                  : n.key === 'quests' ? claimable + (canDaily ? 1 : 0)
                  : n.key === 'social' ? socialBadge
                  : n.key === 'profile' ? state.user.claimableLevelRewards
                  : 0
              return (
                <button key={n.key}
                  onClick={() => setView(n.key)}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'relative flex min-h-14 flex-col items-center justify-center gap-0.5 px-0.5 py-1.5 transition-colors',
                    active ? 'text-green-700' : 'text-stone-500 hover:text-stone-700',
                  )}
                >
                  <span aria-hidden="true" className={cn('text-xl transition-transform', active && 'scale-110')}>{n.emoji}</span>
                  <span className="text-[10px] font-bold leading-none">{n.label}</span>
                  {active && <span aria-hidden="true" className="absolute inset-x-2 top-0 h-0.5 rounded-full bg-green-600" />}
                  {badge > 0 && (
                    <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-700 px-1 text-[9px] font-black leading-none text-white">
                      <span className="sr-only">{badge} new</span>
                      <span aria-hidden="true">{badge > 99 ? '99+' : badge}</span>
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </nav>

        {/* ── flash toast ──
            The centering lives on a plain wrapper on purpose: framer-motion
            writes an inline `transform` on the animated element, which
            silently overrode the -translate-x-1/2 utility when both were on
            the same node, so the toast rendered off the right edge.
            role=status announces the result of every action to screen
            readers — this is the app's only feedback channel. */}
        <AnimatePresence>
          {flash && (
            <div className="pointer-events-none fixed inset-x-0 top-14 z-50 flex justify-center px-4">
              <motion.div role="status"
                aria-live="polite"
                aria-atomic="true"
                initial={{ opacity: 0, y: -16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.18 }}
                className={cn(
                  'w-full max-w-sm rounded-2xl px-4 py-2.5 text-center text-xs font-bold shadow-xl',
                  flash.type === 'success' && 'bg-green-700 text-white',
                  flash.type === 'error' && 'bg-red-700 text-white',
                  flash.type === 'info' && 'bg-stone-800 text-white',
                )}
              >
                {flash.message}
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* ── hatch celebration modal ── */}
        <AnimatePresence>
          {hatchResult && (
            <motion.div initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6"
              onClick={() => setHatchResult(null)}
            >
              <motion.div initial={{ scale: 0.6, rotate: -6 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', bounce: 0.5 }}
                role="dialog"
                aria-modal="true"
                aria-label={hatchResult.title}
                className="relative w-full max-w-xs rounded-3xl border-4 border-amber-300 bg-gradient-to-b from-yellow-50 to-amber-100 p-6 text-center shadow-2xl"
              >
                <div className="pointer-events-none absolute -top-2 left-4 text-2xl" aria-hidden="true">✨</div>
                <div className="pointer-events-none absolute -top-2 right-4 text-2xl" aria-hidden="true">🎉</div>
                <div className="pointer-events-none absolute bottom-8 left-2 text-xl" aria-hidden="true">🌟</div>
                <div className="pointer-events-none absolute bottom-8 right-2 text-xl" aria-hidden="true">💫</div>
                <motion.div animate={{ scale: [1, 1.2, 1], rotate: [0, 10, -10, 0] }}
                  transition={{ repeat: Infinity, duration: 1.6 }}
                  className="text-7xl"
                >
                  <span aria-hidden="true">{hatchResult.emoji}</span>
                </motion.div>
                <p className="mt-3 text-lg font-black text-stone-800">{hatchResult.title}</p>
                <p className="mt-1 text-xs text-stone-500">{hatchResult.detail}</p>
                <button onClick={() => setHatchResult(null)}
                  className="mt-4 w-full rounded-2xl bg-green-700 py-3 text-sm font-extrabold text-white shadow-lg active:scale-95"
                >
                  Awesome! 🎊
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── admin overlay ── */}
        {adminOpen && <AdminPanel />}

        {/* ── Phase 27: AI farm assistant ── */}
        <AiAssistant />
      </div>
    </div>
  )
}
