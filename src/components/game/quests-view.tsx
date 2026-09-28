'useclient'

import{ useEffect, useState} from'react'
import{ useGame, api} from'@/lib/store'
import{ DAILY_REWARDS } from'@/lib/game'
import{ Button} from'@/components/ui/button'
import{ GameCard, ProgressBar, SectionTitle, EmptyState, ErrorState, LoadingSpinner} from'./shared'
import{ cn} from'@/lib/utils'

interfaceLbRow{
  id:string; username:string; farmName:string; avatar?: stringlevelName:string; xp:number; farmValue: numbertotalHens:number; totalEggs:number; totalEarned: number}

export functionQuestsView() {
  const{ state, act, loading} = useGame()
  const[lbCat, setLbCat]= useState<'value' | 'eggs' | 'earned'>('value')
  const[lb, setLb]= useState<{ byValue:LbRow[]; byEggs:LbRow[]; byEarned:LbRow[]; myId: string} | null>(null)
  const[lbError, setLbError]= useState<string| null>(null)

  useEffect(() => {
    //A failed leaderboard fetch used to null thedata, which rendered the // same"Loadingrankings..." forever.Rankings are optional garnish—
    // a failure here must not look like a hang.api<{ byValue:LbRow[]; byEggs:LbRow[]; byEarned:LbRow[]; myId: string}>('/api/leaderboard')
      .then(d=> { setLb(d); setLbError(null) })
      .catch((e:unknown) => setLbError(e instanceofError? e.message :'Could not loadrankings'))
  }, [state?.user.coins])

  if(!state) return null const{ user, missions} = state conststreakDay= user.dailyRewardDay const rows= lb? (lbCat=== 'value' ? lb.byValue :lbCat=== 'eggs' ? lb.byEggs :lb.byEarned) : [] return(
    <div className="space-y-3 px-3 pb-4">
      {/* ── daily reward── */}
      <GameCard className="overflow-hidden bg-gradient-to-r from-amber-50 via-orange-50to-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-base font-blacktext-stone-800">🎁 DailyLoginReward</p>
            <p className="text-[11px]text-stone-500">Login streak:{user.loginStreak} day{user.loginStreak=== 1? '' :'s'} · Day 7 gives💎 gems!</p>
          </div>
          <Buttonsize="sm"
            onClick={() => act('claim_daily')}
            disabled={loading|| !user.canClaimDaily}
            className="h-9 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-4 text-xs font-extrabold text-white shadow active:scale-95disabled:opacity-40"
          >
            {user.canClaimDaily? 'Claim!' :'✓ Claimed'}
          </Button>
        </div>

        <div className="mt-3 grid grid-cols-7 gap-1">
          {DAILY_REWARDS.map((r, i) => {
            const day= i+ 1 constisToday= user.canClaimDaily&& day=== streakDay const claimed= !user.canClaimDaily? day< streakDay|| day=== streakDay : day< streakDay return(
              <divkey={i}
                className={cn(
                  'flex flex-col items-center rounded-xl borderpy-1.5',
                  isToday? 'animate-pulse border-amber-400 bg-amber-100  shadow' : claimed? 'border-green-200bg-green-50' :'border-stone-200bg-white'
                )}
              >
                <span className="text-[9px] font-blacktext-stone-600">D{day}</span>
                <span className="text-sm">{day=== 7? '💎' :'🪙'}</span>
                <span className="text-[9px] font-black tabular-numstext-stone-600">{r}</span>
              </div>
            )
          })}
        </div>
      </GameCard>

      {/* ── daily missions── */}
      <SectionTitleright={<span className="text-[10px] font-boldtext-stone-600">resets daily· UTC</span>}>
        🎯 DailyMissions</SectionTitle>
      <div className="space-y-2">
        {missions.map(m=> (
          <GameCardkey={m.key}>
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-stone-200 bg-stone-50  text-xl">
                {m.emoji}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-blacktext-stone-800">{m.title}</p>
                  <span className="shrink-0 text-[10px] font-blacktext-amber-600">
                    🪙 {m.rewardCoins}{m.rewardGems? ` +💎${m.rewardGems}` :''}
                  </span>
                </div>
                <p className="text-[11px]text-stone-500">{m.desc}</p>
                <div className="mt-1.5 flex items-center gap-2">
                  <ProgressBarpct={(m.progress /m.target) * 100} className="h-1.5 flex-1" />
                  <span className="text-[10px] font-black tabular-numstext-stone-500">{m.progress}/{m.target}</span>
                </div>
              </div>
              <Buttonsize="sm"
                onClick={() => act('claim_mission', { key: m.key})}
                disabled={loading|| m.claimed|| !m.complete}
                className={cn(
                  'h-8 shrink-0 rounded-full px-3 text-xs font-extraboldactive:scale-95',
                  m.claimed? 'bg-stone-200  text-stone-600' : m.complete? 'bg-green-700 text-white  shadow' :'bg-stone-100  text-stone-600'
                )}
              >
                {m.claimed? '✓ Done' : m.complete? 'Claim!' :`${m.progress}/${m.target}`}
              </Button>
            </div>
          </GameCard>
        ))}
      </div>

      {/* ── leaderboard── */}
      <SectionTitle>🏆 Leaderboard</SectionTitle>
      <div className="grid grid-cols-3 gap-1 rounded-2xl bg-stone-100  p-1">
        {(['value', 'eggs', 'earned'] asconst).map(c=> (
          <buttonkey={c}
            onClick={() => setLbCat(c)}
            className={cn(
              'rounded-xl py-2 text-[11px] font-extrabold transition-all',
              lbCat=== c? 'bg-white text-amber-700shadow' :'text-stone-600'
            )}
          >
            {c=== 'value' ? '💰 Richest' : c=== 'eggs' ? '🥚 Eggs' :'📈 Earned'}
          </button>
        ))}
      </div>

      {lbError? (
        <GameCard>
          <ErrorStatetitle="Couldn't loadrankings" message={lbError} />
        </GameCard>
      ) :!lb? (
        <GameCard><LoadingSpinnerlabel="Loadingrankings..." /></GameCard>
      ) :(
        <div className="space-y-1.5">
          {rows.map((r, i) => (
            <GameCardkey={r.id} className={cn('flex items-center gap-3 py-2.5', r.id=== lb.myId&& 'border-amber-400bg-amber-50')}>
              <span className={cn(
                'w-7 text-center text-sm font-black',
                i=== 0? 'text-amber-500' : i=== 1? 'text-stone-600' : i=== 2? 'text-orange-700' :'text-stone-600'
              )}>
                {i< 3? ['🥇', '🥈', '🥉'][i] : i+ 1}
              </span>
              <span className="text-2xl">{r.avatar?? '🧑‍🌾'}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-blacktext-stone-800">
                  {r.farmName} {r.id=== lb.myId&& <span className="text-[9px]text-amber-600">(YOU)</span>}
                </p>
                <p className="truncate text-[10px]text-stone-600">@{r.username} · {r.levelName}</p>
              </div>
              <div className="shrink-0text-right">
                {lbCat=== 'value' && <p className="text-xs font-black tabular-numstext-amber-600">🪙 {r.farmValue.toLocaleString()}</p>}
                {lbCat=== 'eggs' && <p className="text-xs font-black tabular-numstext-green-700">🥚 {r.totalEggs.toLocaleString()}</p>}
                {lbCat=== 'earned' && <p className="text-xs font-black tabular-numstext-green-700">🪙 {r.totalEarned.toLocaleString()}</p>}
                <p className="text-[9px]text-stone-600">🐔 {r.totalHens}</p>
              </div>
            </GameCard>
          ))}
        </div>
      )}
    </div>
  )
}
