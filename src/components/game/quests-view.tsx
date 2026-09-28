'use client'

import { useEffect, useState } from 'react'
import { useGame, api } from '@/lib/store'
import { DAILY_REWARDS } from '@/lib/game'
import { Button } from '@/components/ui/button'
import { GameCard, ProgressBar, SectionTitle, ErrorState, LoadingSpinner, ScrollList } from './shared'
import { cn } from '@/lib/utils'

interface LbRow {
  id: string
  username: string
  farmName: string
  avatar?: string
  levelName: string
  xp: number
  farmValue: number
  totalHens: number
  totalEggs: number
  totalEarned: number
}

type LbCategory = 'value' | 'eggs' | 'earned'

const LB_CATEGORIES: { key: LbCategory; label: string }[] = [
  { key: 'value', label: '💰 Richest' },
  { key: 'eggs', label: '🥚 Eggs' },
  { key: 'earned', label: '📈 Earned' },
]

export function QuestsView() {
  const { state, act, loading } = useGame()
  const [lbCat, setLbCat] = useState<LbCategory>('value')
  const [lb, setLb] = useState<{ byValue: LbRow[]; byEggs: LbRow[]; byEarned: LbRow[]; myId: string } | null>(null)
  const [lbError, setLbError] = useState<string | null>(null)

  useEffect(() => {
    // A failed leaderboard fetch used to null the data, which rendered the
    // same "Loading rankings..." forever. Rankings are optional garnish —
    // a failure here must not look like a hang.
    api<{ byValue: LbRow[]; byEggs: LbRow[]; byEarned: LbRow[]; myId: string }>('/api/leaderboard')
      .then(d => { setLb(d); setLbError(null) })
      .catch((e: unknown) => setLbError(e instanceof Error ? e.message : 'Could not load rankings'))
  }, [state?.user.coins])

  if (!state) return null

  const { user, missions } = state
  const streakDay = user.dailyRewardDay
  const rows = lb ? (lbCat === 'value' ? lb.byValue : lbCat === 'eggs' ? lb.byEggs : lb.byEarned) : []

  return (
    <div className="space-y-3 px-3 pb-4">
      {/* ── daily reward ── */}
      <GameCard className="overflow-hidden bg-gradient-to-r from-amber-50 via-orange-50 to-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-base font-black text-stone-800">🎁 Daily Login Reward</p>
            <p className="text-[11px] text-stone-500">
              Login streak: {user.loginStreak} day{user.loginStreak === 1 ? '' : 's'} · Day 7 gives 💎 gems!
            </p>
          </div>
          <Button size="sm"
            onClick={() => act('claim_daily')}
            disabled={loading || !user.canClaimDaily}
            className="min-h-9 rounded-full bg-gradient-to-r from-amber-600 to-orange-600 px-4 text-xs font-extrabold text-white shadow active:scale-95 disabled:opacity-40"
          >
            {user.canClaimDaily ? 'Claim!' : '✓ Claimed'}
          </Button>
        </div>

        <ol className="mt-3 grid grid-cols-7 gap-1">
          {DAILY_REWARDS.map((r, i) => {
            const day = i + 1
            const isToday = user.canClaimDaily && day === streakDay
            const claimed = !user.canClaimDaily ? day < streakDay || day === streakDay : day < streakDay
            return (
              <li key={i}
                aria-current={isToday ? 'step' : undefined}
                className={cn(
                  'flex flex-col items-center rounded-xl border py-1.5',
                  isToday
                    ? 'animate-pulse border-amber-400 bg-amber-100 shadow motion-reduce:animate-none'
                    : claimed ? 'border-green-200 bg-green-50' : 'border-stone-200 bg-white',
                )}
              >
                <span className="text-[9px] font-black text-stone-600">D{day}</span>
                <span className="text-sm" aria-hidden="true">{day === 7 ? '💎' : '🪙'}</span>
                <span className="text-[9px] font-black tabular-nums text-stone-600">{r}</span>
                <span className="sr-only">
                  Day {day}: {r} coins{claimed ? ', claimed' : isToday ? ', available now' : ', locked'}
                </span>
              </li>
            )
          })}
        </ol>
      </GameCard>

      {/* ── daily missions ── */}
      <SectionTitle right={<span className="text-[10px] font-bold text-stone-600">resets daily · UTC</span>}>
        🎯 Daily Missions
      </SectionTitle>
      <div className="space-y-2">
        {missions.map(m => (
          <GameCard key={m.key}>
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-stone-200 bg-stone-50 text-xl">
                <span aria-hidden="true">{m.emoji}</span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-black text-stone-800">{m.title}</p>
                  <span className="shrink-0 text-[10px] font-black text-amber-700">
                    🪙 {m.rewardCoins}{m.rewardGems ? ` + 💎${m.rewardGems}` : ''}
                  </span>
                </div>
                <p className="text-[11px] text-stone-500">{m.desc}</p>
                <div className="mt-1.5 flex items-center gap-2">
                  <ProgressBar pct={(m.progress / m.target) * 100} label={`${m.title} progress`} className="h-1.5 flex-1" />
                  <span className="text-[10px] font-black tabular-nums text-stone-600">{m.progress}/{m.target}</span>
                </div>
              </div>
              <Button size="sm"
                onClick={() => act('claim_mission', { key: m.key })}
                disabled={loading || m.claimed || !m.complete}
                className={cn(
                  'min-h-9 shrink-0 rounded-full px-3 text-xs font-extrabold active:scale-95',
                  m.claimed ? 'bg-stone-200 text-stone-600'
                    : m.complete ? 'bg-green-700 text-white shadow'
                    : 'bg-stone-100 text-stone-600',
                )}
              >
                {m.claimed ? '✓ Done' : m.complete ? 'Claim!' : `${m.progress}/${m.target}`}
              </Button>
            </div>
          </GameCard>
        ))}
      </div>

      {/* ── leaderboard ── */}
      <SectionTitle>🏆 Leaderboard</SectionTitle>
      <div className="grid grid-cols-3 gap-1 rounded-2xl bg-stone-100 p-1" role="tablist" aria-label="Leaderboard category">
        {LB_CATEGORIES.map(c => (
          <button key={c.key}
            role="tab"
            aria-selected={lbCat === c.key}
            onClick={() => setLbCat(c.key)}
            className={cn(
              'min-h-9 rounded-xl py-2 text-[11px] font-extrabold transition-all',
              lbCat === c.key ? 'bg-white text-amber-700 shadow' : 'text-stone-600',
            )}
          >
            {c.label}
          </button>
        ))}
      </div>

      {lbError ? (
        <GameCard>
          <ErrorState title="Couldn't load rankings" message={lbError} />
        </GameCard>
      ) : !lb ? (
        <GameCard><LoadingSpinner label="Loading rankings…" /></GameCard>
      ) : rows.length === 0 ? (
        <GameCard>
          <p className="py-6 text-center text-xs font-bold text-stone-600">No farmers on this board yet.</p>
        </GameCard>
      ) : (
        // The board is server-capped but still far taller than a screen,
        // so it gets the same five-row viewport as the other rankings.
        <ScrollList count={rows.length} label={`${LB_CATEGORIES.find(c => c.key === lbCat)?.label ?? 'Leaderboard'} rankings`} visible={5} rowHeight={58}>
          {rows.map((r, i) => (
            <GameCard key={r.id}
              className={cn('flex items-center gap-3 py-2.5', r.id === lb.myId && 'border-amber-400 bg-amber-50')}>
              <span className={cn(
                'w-7 text-center text-sm font-black',
                i === 0 ? 'text-amber-500' : i === 1 ? 'text-stone-600' : i === 2 ? 'text-orange-700' : 'text-stone-600',
              )}>
                {i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1}
              </span>
              <span className="text-2xl" aria-hidden="true">{r.avatar ?? '🧑‍🌾'}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-black text-stone-800">
                  {r.farmName} {r.id === lb.myId && <span className="text-[9px] text-amber-700">(YOU)</span>}
                </p>
                <p className="truncate text-[10px] text-stone-600">@{r.username} · {r.levelName}</p>
              </div>
              <div className="shrink-0 text-right">
                {lbCat === 'value' && <p className="text-xs font-black tabular-nums text-amber-700">🪙 {r.farmValue.toLocaleString()}</p>}
                {lbCat === 'eggs' && <p className="text-xs font-black tabular-nums text-green-700">🥚 {r.totalEggs.toLocaleString()}</p>}
                {lbCat === 'earned' && <p className="text-xs font-black tabular-nums text-green-700">🪙 {r.totalEarned.toLocaleString()}</p>}
                <p className="text-[9px] text-stone-600">🐔 {r.totalHens}</p>
              </div>
            </GameCard>
          ))}
        </ScrollList>
      )}
    </div>
  )
}
