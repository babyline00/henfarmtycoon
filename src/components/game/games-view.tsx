'use client'

import { useCallback, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { api, useGame } from '@/lib/store'
import { GameCard, SectionTitle, LoadingSpinner, ProgressBar, EmptyState, ScrollList } from './shared'
import { ChickenRun } from './chicken-run'
import { RoadCrossing } from './road-crossing'
import { EggCatch } from './egg-catch'
import type { MiniGameKey } from '@/lib/mini-games'
import { cn } from '@/lib/utils'

// ══════════ Phase 33 — Mini Games Hub ══════════

interface EnergyState {
  energy: number
  max: number
  regenPerHour: number
  nextEnergyInSec: number
  vipFast: boolean
}
interface TierInfo {
  key: string
  name: string
  reqLevel: number
  mult: number
  desc: string
  current: boolean
  locked: boolean
}
interface GameView {
  id: string
  key: string
  name: string
  emoji: string
  description: string
  enabled: boolean
  energyCost: number
  winTarget: number
  myBestScore: number
  myBestDistance: number
  totalPlays: number
}
interface BoardRow { userId: string; username: string; avatar: string; farmName: string; vip: boolean; value: number }
interface HubData {
  energy: EnergyState
  tier: number
  tierInfo: TierInfo[]
  seasonRewards: { rank: number; prize: string; emoji: string; detail: string }[]
  games: GameView[]
  leaderboards: Record<string, { daily: BoardRow[]; weekly: BoardRow[]; monthly: BoardRow[] }>
  recentSessions: { id: string; gameKey: string; score: number; distance: number; coins: number; eggs: number; gems: number; xp: number; result: string; createdAt: string }[]
  stats: { totalGames: number; wins: number; losses: number; highestScore: number; bestDistance: number; totalRewards: number; playTimeSec: number }
  arcadeRewardsEnabled: boolean
}

export interface FinishResult {
  ok?: boolean
  rejected?: boolean
  reason?: string
  result?: string
  coins?: number
  eggs?: number
  gems?: number
  xp?: number
  duration?: number
  lines?: string[]
  mysteryItems?: string[]
  championBuff?: boolean
  message?: string
}

// Per-game presentation for the recent-sessions list. Keyed rather than
// nested ternaries so adding a game does not mean rewriting the chain.
const GAME_ICON: Record<string, string> = {
  chicken_run: '🏃', road_crossing: '🚦', egg_catch: '🥚',
}
const GAME_SCORE: Record<string, (s: { distance: number; score: number }) => string> = {
  chicken_run: (s) => `${s.distance}m`,
  road_crossing: (s) => `${s.score} roads`,
  egg_catch: (s) => `${s.score} eggs`,
}

type ActiveGame = {
  // Kept in step with MiniGameKey rather than repeating the union, so
  // adding a game does not silently exclude it from the dispatcher.
  key: MiniGameKey
  sessionId: string
  tier: number
  tierName: string
  tierMult: number
  speedMult: number
  winTarget: number
} | null

const GAME_META: Record<string, { controls: string[]; objective: string }> = {
  chicken_run: {
    controls: ['⬅️➡️ swipe / arrows = switch lane', '⬆️ swipe / space = jump', 'Jump clears rocks, barriers & dogs — not cars & trees'],
    objective: 'Run 1000m to win! Collect 🥚🪙💎🎁 on the way.',
  },
  road_crossing: {
    controls: ['⬆️⬇️⬅️➡️ swipe / arrows = hop', '🛡️ shield · 🧲 magnet · ⚡ speed · ❄️ freeze'],
    objective: 'Cross 12 roads to reach the farm side!',
  },
}

const BOARD_LABEL = {
  daily: 'Top score (today)',
  weekly: 'Most distance (7d)',
  monthly: 'Champion farmer (month)',
} as const

export function GamesView() {
  const { showFlash, refresh } = useGame()
  const [hub, setHub] = useState<HubData | null>(null)
  const [board, setBoard] = useState<'daily' | 'weekly' | 'monthly'>('daily')
  const [active, setActive] = useState<ActiveGame>(null)
  const [result, setResult] = useState<FinishResult | null>(null)
  const [starting, setStarting] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  const load = useCallback(async () => {
    try {
      setHub(await api<HubData>('/api/mini'))
    } catch (e) {
      showFlash(e instanceof Error ? e.message : 'Failed to load arcade', 'error')
    }
  }, [showFlash])

  useEffect(() => { load() }, [load])

  // energy ticker — re-renders once a second so the countdown advances
  useEffect(() => {
    const t = setInterval(() => setTick(x => x + 1), 1000)
    return () => clearInterval(t)
  }, [])

  async function startGame(game: GameView) {
    if (starting) return
    setStarting(game.key)
    try {
      const res = await api<ActiveGame & { ok: boolean }>('/api/mini', {
        method: 'POST',
        body: { action: 'start', gameKey: game.key },
      })
      setActive({
        key: game.key as MiniGameKey,
        sessionId: res.sessionId!, tier: res.tier!, tierName: res.tierName!,
        tierMult: res.tierMult!, speedMult: res.speedMult!, winTarget: res.winTarget!,
      })
    } catch (e) {
      showFlash(e instanceof Error ? e.message : 'Cannot start game', 'error')
    } finally {
      setStarting(null)
    }
  }

  const finishGame = useCallback(async (sessionId: string, telemetry: Record<string, number>) => {
    try {
      const res = await api<FinishResult>('/api/mini', {
        method: 'POST',
        body: { action: 'finish', sessionId, ...telemetry },
      })
      setResult(res)
      if (res.rejected) showFlash(res.message ?? 'Result rejected', 'error')
      refresh()
    } catch (e) {
      showFlash(e instanceof Error ? e.message : 'Failed to submit result', 'error')
    } finally {
      setActive(null)
      load()
    }
  }, [load, refresh, showFlash])

  if (active) {
    if (active.key === 'chicken_run') {
      return <ChickenRun sessionId={active.sessionId}
        tier={active.tier} tierName={active.tierName}
        speedMult={active.speedMult} winTarget={active.winTarget}
        onEnd={(tel) => finishGame(active.sessionId, tel)}
        onQuit={() => setActive(null)}
      />
    }
    if (active.key === 'egg_catch') {
      return <EggCatch sessionId={active.sessionId}
        tier={active.tier} tierName={active.tierName}
        speedMult={active.speedMult} winTarget={active.winTarget}
        onEnd={(tel) => finishGame(active.sessionId, tel)}
        onQuit={() => setActive(null)}
      />
    }
    return <RoadCrossing sessionId={active.sessionId}
      tier={active.tier} tierName={active.tierName}
      speedMult={active.speedMult} winTarget={active.winTarget}
      onEnd={(tel) => finishGame(active.sessionId, tel)}
      onQuit={() => setActive(null)}
    />
  }

  if (!hub) return <LoadingSpinner label="Booting the arcade…" />

  const e = hub.energy
  const energyPct = (e.energy / e.max) * 100
  void tick // re-render every second to advance the countdown

  return (
    <div className="px-3 pb-4">
      <SectionTitle right={
        <span className="rounded-full border border-purple-300 bg-purple-100 px-2 py-0.5 text-[10px] font-black text-purple-700">
          TIER: {hub.tierInfo[hub.tier]?.name ?? 'Farm'} ×{hub.tierInfo[hub.tier]?.mult ?? 1}
        </span>
      }>🎮 Mini Games Hub</SectionTitle>

      {/* ── energy card ── */}
      <GameCard className="mb-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-black text-stone-800">⚡ Arcade Energy</p>
            <p className="text-[10px] text-stone-500">
              +{e.regenPerHour}/hour{e.vipFast ? ' · 👑 VIP ×2 boost' : ''}
            </p>
          </div>
          <p className="text-lg font-black tabular-nums text-purple-700">{e.energy}/{e.max}</p>
        </div>
        <ProgressBar pct={energyPct} label="Arcade energy" className="mt-2" />
        {e.energy < e.max && (
          <p className="mt-1 text-right text-[10px] font-bold tabular-nums text-stone-600">
            next ⚡ in {Math.floor(e.nextEnergyInSec / 60)}:{String(e.nextEnergyInSec % 60).padStart(2, '0')}
          </p>
        )}
      </GameCard>

      {/* ── game cards ── */}
      {hub.games.length === 0 ? (
        <GameCard className="mb-3">
          <EmptyState emoji="🎮" title="No games enabled" sub="The arcade is closed right now — check back later" />
        </GameCard>
      ) : hub.games.map(g => {
        const meta = GAME_META[g.key] ?? { controls: [], objective: '' }
        const affordable = hub.energy.energy >= g.energyCost
        return (
          <GameCard key={g.id} className={cn('mb-3', !g.enabled && 'opacity-60')}>
            <div className="flex items-start gap-3">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-stone-200 bg-gradient-to-b from-stone-50 to-stone-100 text-3xl">
                <span aria-hidden="true">{g.emoji}</span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-black text-stone-800">{g.name}</p>
                  <span className="rounded-full border border-amber-300 bg-amber-100 px-1.5 py-0.5 text-[9px] font-black text-amber-700">⚡{g.energyCost}</span>
                  {!g.enabled && <span className="rounded-full border border-red-300 bg-red-100 px-1.5 py-0.5 text-[9px] font-black text-red-600">OFFLINE</span>}
                </div>
                <p className="mt-0.5 text-[11px] leading-snug text-stone-600">{g.description}</p>
                <p className="mt-1 text-[10px] font-bold text-green-700">🎯 {meta.objective}</p>
                <div className="mt-1 flex gap-3 text-[10px] font-bold text-stone-600">
                  <span>🏅 Best: {g.key === 'chicken_run' ? `${g.myBestDistance}m` : `${g.myBestScore} roads`}</span>
                  <span>🌍 {g.totalPlays.toLocaleString()} plays</span>
                </div>
              </div>
            </div>
            <ul className="mt-2 space-y-0.5 rounded-xl bg-stone-50 p-2">
              {meta.controls.map((c, i) => <li key={i} className="text-[10px] text-stone-600">{c}</li>)}
            </ul>
            <button onClick={() => startGame(g)}
              disabled={starting === g.key || !g.enabled || !affordable}
              className={cn(
                'mt-2 h-11 w-full rounded-2xl text-sm font-extrabold text-white shadow-lg transition-all active:scale-95 disabled:opacity-50',
                (!g.enabled || !affordable) ? 'bg-stone-400' : 'bg-gradient-to-r from-purple-700 to-fuchsia-700',
              )}
            >
              {starting === g.key ? 'Loading…' : !g.enabled ? 'Unavailable' : !affordable ? `Need ⚡${g.energyCost}` : `▶ Play Now (⚡${g.energyCost})`}
            </button>
          </GameCard>
        )
      })}

      {/* ── my arcade stats ── */}
      <SectionTitle>📊 My Arcade Stats</SectionTitle>
      <GameCard className="mb-3">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div><p className="text-lg font-black tabular-nums text-stone-800">{hub.stats.totalGames}</p><p className="text-[9px] font-bold uppercase text-stone-600">Games</p></div>
          <div><p className="text-lg font-black tabular-nums text-green-700">{hub.stats.wins}</p><p className="text-[9px] font-bold uppercase text-stone-600">Wins</p></div>
          <div><p className="text-lg font-black tabular-nums text-amber-700">{hub.stats.totalRewards.toLocaleString()}</p><p className="text-[9px] font-bold uppercase text-stone-600">🪙 Won</p></div>
          <div><p className="text-lg font-black tabular-nums text-purple-700">{hub.stats.highestScore}</p><p className="text-[9px] font-bold uppercase text-stone-600">High score</p></div>
          <div><p className="text-lg font-black tabular-nums text-teal-700">{hub.stats.bestDistance}m</p><p className="text-[9px] font-bold uppercase text-stone-600">Best run</p></div>
          <div><p className="text-lg font-black tabular-nums text-stone-600">{Math.round(hub.stats.playTimeSec / 60)}m</p><p className="text-[9px] font-bold uppercase text-stone-600">Play time</p></div>
        </div>
      </GameCard>

      {/* ── leaderboards ── */}
      <SectionTitle right={
        <div className="flex gap-1" role="group" aria-label="Leaderboard period">
          {(['daily', 'weekly', 'monthly'] as const).map(b => (
            <button key={b} onClick={() => setBoard(b)} aria-pressed={board === b}
              className={cn('min-h-9 rounded-full px-2.5 py-1 text-[10px] font-extrabold capitalize transition-all',
                board === b ? 'bg-purple-700 text-white shadow' : 'bg-stone-100 text-stone-600')}>
              {b}
            </button>
          ))}
        </div>
      }>🏆 Leaderboards</SectionTitle>

      {hub.games.map(g => {
        const rows = hub.leaderboards[g.key]?.[board] ?? []
        return (
          <GameCard key={g.id} className="mb-3">
            <p className="mb-2 text-xs font-black text-stone-700"><span aria-hidden="true">{g.emoji}</span> {g.name} — {BOARD_LABEL[board]}</p>
            {rows.length === 0 ? (
              <p className="py-3 text-center text-[11px] text-stone-600">No scores yet — be the first champion! 🐔</p>
            ) : (
              // Five rows, the rest one scroll away. A board of 200
              // entries used to bury every other control on the page.
              <ScrollList
                count={rows.length}
                label={`${g.name} ${BOARD_LABEL[board]} leaderboard`}
                visible={5}
                rowHeight={44}
              >
                <ol className="space-y-1.5">
                  {rows.map((r, i) => (
                    <li key={r.userId} className={cn('flex items-center gap-2 rounded-xl px-2 py-1.5', i === 0 && 'border border-amber-200 bg-amber-50', i === 1 && 'bg-stone-50', i === 2 && 'bg-orange-50/60')}>
                      <span className="w-6 text-center text-xs font-black">{['🥇', '🥈', '🥉'][i] ?? `${i + 1}`}</span>
                      <span className="text-lg" aria-hidden="true">{r.avatar}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[11px] font-black text-stone-700">
                          {r.username} {r.vip && '👑'}
                        </p>
                        <p className="truncate text-[9px] text-stone-600">{r.farmName}</p>
                      </div>
                      <span className="text-xs font-black tabular-nums text-purple-700">
                        {g.key === 'chicken_run'
                          ? (board === 'weekly' ? `${r.value}m` : `${r.value}`)
                          : (board === 'weekly' ? `${r.value}m` : `${r.value} rd`)}
                      </span>
                    </li>
                  ))}
                </ol>
              </ScrollList>
            )}
          </GameCard>
        )
      })}

      {/* ── season rewards ── */}
      <SectionTitle>🗓️ Season 1 Rewards</SectionTitle>
      <GameCard className="mb-3">
        {hub.seasonRewards.map(r => (
          <div key={r.rank} className="flex items-center gap-3 border-b border-stone-100 py-2 last:border-0">
            <span className="text-2xl" aria-hidden="true">{r.emoji}</span>
            <div className="flex-1">
              <p className="text-[11px] font-black text-stone-700">{['🥇 1st', '🥈 2nd', '🥉 3rd'][r.rank - 1]} — {r.prize}</p>
              <p className="text-[10px] text-stone-600">{r.detail}</p>
            </div>
          </div>
        ))}
        <p className="mt-2 text-[10px] text-stone-600">
          Monthly champions are crowned by total arcade score. Admins pay out season rewards from the control center.
        </p>
      </GameCard>

      {/* ── tier ladder ── */}
      <SectionTitle>⚡ Difficulty Tiers</SectionTitle>
      <GameCard className="mb-3">
        {hub.tierInfo.map(t => (
          <div key={t.key} className={cn('flex items-center gap-2 border-b border-stone-100 py-2 last:border-0', t.locked && 'opacity-50')}>
            <span className="text-lg" aria-hidden="true">{t.current ? '📍' : t.locked ? '🔒' : '✅'}</span>
            <div className="flex-1">
              <p className="text-[11px] font-black text-stone-700">{t.name} <span className="text-purple-700">×{t.mult}</span></p>
              <p className="text-[10px] text-stone-600">{t.desc} · requires farmer level {t.reqLevel}</p>
            </div>
          </div>
        ))}
      </GameCard>

      {/* ── recent sessions ── */}
      {hub.recentSessions.length > 0 && (
        <>
          <SectionTitle>🕹️ Recent Plays</SectionTitle>
          <GameCard>
            {hub.recentSessions.map(s => (
              <div key={s.id} className="flex items-center gap-2 border-b border-stone-100 py-1.5 text-[11px] last:border-0">
                <span aria-hidden="true">{GAME_ICON[s.gameKey] ?? '🎮'}</span>
                <span className={cn('font-black', s.result === 'win' ? 'text-green-700' : 'text-stone-600')}>
                  {s.result === 'win' ? 'WIN' : 'LOSS'}
                </span>
                <span className="flex-1 tabular-nums text-stone-600">
                  {GAME_SCORE[s.gameKey]?.(s) ?? `${s.score}`} · {new Date(s.createdAt).toLocaleDateString()}
                </span>
                <span className="font-bold tabular-nums text-amber-700">🪙{s.coins}</span>
              </div>
            ))}
          </GameCard>
        </>
      )}

      {/* ── reward result modal ── */}
      {result && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6"
          onClick={() => setResult(null)}
        >
          <motion.div initial={{ scale: 0.7, y: 30 }} animate={{ scale: 1, y: 0 }}
            transition={{ type: 'spring', bounce: 0.45 }}
            role="dialog"
            aria-modal="true"
            aria-label={result.rejected ? 'Result rejected' : result.result === 'win' ? 'Victory' : 'Game over'}
            className={cn(
              'w-full max-w-xs rounded-3xl border-4 bg-gradient-to-b p-6 text-center shadow-2xl',
              result.rejected ? 'border-red-300 from-red-50 to-red-100'
                : result.result === 'win' ? 'border-amber-300 from-yellow-50 to-amber-100'
                : 'border-stone-300 from-stone-50 to-stone-100',
            )}
          >
            <motion.div animate={{ scale: [1, 1.15, 1], rotate: [0, 8, -8, 0] }}
              transition={{ repeat: Infinity, duration: 1.8 }}
              className="text-6xl"
            >
              <span aria-hidden="true">{result.rejected ? '🚨' : result.result === 'win' ? '🏆' : '🐔'}</span>
            </motion.div>
            <p className="mt-2 text-xl font-black text-stone-800">
              {result.rejected ? 'Result Rejected' : result.result === 'win' ? 'VICTORY!' : 'Game Over'}
            </p>
            {result.rejected ? (
              <p className="mt-1 text-xs text-red-600">{result.reason} — rewards voided.</p>
            ) : (
              <>
                <div className="mt-3 flex justify-center gap-3 text-lg font-black">
                  <span className="text-amber-700">🪙 {result.coins ?? 0}</span>
                  {result.eggs ? <span className="text-stone-600">🥚 {result.eggs}</span> : null}
                  {result.gems ? <span className="text-pink-600">💎 {result.gems}</span> : null}
                  <span className="text-green-700">+{result.xp ?? 0} XP</span>
                </div>
                {result.mysteryItems && result.mysteryItems.length > 0 && (
                  <p className="mt-2 text-[11px] font-bold text-purple-700">🎁 Mystery boxes: {result.mysteryItems.join(', ')}</p>
                )}
                {result.championBuff && (
                  <p className="mt-1 text-[11px] font-black text-orange-600">🏅 Champion buff! +10% production for 12h</p>
                )}
                {result.lines && result.lines.length > 0 && (
                  <div className="mt-2 space-y-0.5 rounded-xl bg-white/70 p-2">
                    {result.lines.map((l, i) => <p key={i} className="text-[10px] text-stone-600">{l}</p>)}
                  </div>
                )}
              </>
            )}
            <button onClick={() => setResult(null)}
              className="mt-4 w-full rounded-2xl bg-purple-700 py-3 text-sm font-extrabold text-white shadow-lg active:scale-95">
              Back to Arcade 🎮
            </button>
          </motion.div>
        </motion.div>
      )}
    </div>
  )
}
