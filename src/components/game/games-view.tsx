'useclient'

import{ useCallback, useEffect, useState} from'react'
import{ motion} from'framer-motion'
import{ api, useGame} from'@/lib/store'
import{ GameCard, SectionTitle, LoadingSpinner, ProgressBar} from'./shared'
import{ ChickenRun} from'./chicken-run'
import{ RoadCrossing} from'./road-crossing'
import{ cn} from'@/lib/utils'

//══════════ Phase 33— MiniGamesHub══════════

interfaceEnergyState{
  energy:number; max:number; regenPerHour: numbernextEnergyInSec:number; vipFast: boolean}
interfaceTierInfo{
  key:string; name:string; reqLevel:number; mult: number desc:string; current:boolean; locked: boolean}
interfaceGameView{
  id:string; key:string; name:string; emoji:string; description: string enabled:boolean; energyCost:number; winTarget: numbermyBestScore:number; myBestDistance:number; totalPlays: number}
interfaceBoardRow{ userId:string; username:string; avatar:string; farmName:string; vip:boolean; value: number}
interfaceHubData{
  energy:EnergyState tier: numbertierInfo:TierInfo[]seasonRewards:{ rank:number; prize:string; emoji:string; detail: string}[] games:GameView[] leaderboards:Record<string, { daily:BoardRow[]; weekly:BoardRow[]; monthly:BoardRow[]}>
  recentSessions:{ id:string; gameKey:string; score:number; distance:number; coins:number; eggs:number; gems:number; xp:number; result:string; createdAt: string}[] stats:{ totalGames:number; wins:number; losses:number; highestScore:number; bestDistance:number; totalRewards:number; playTimeSec: number}
  arcadeRewardsEnabled: boolean}

export interfaceFinishResult{
  ok?: booleanrejected?: booleanreason?: stringresult?: stringcoins?:number; eggs?:number; gems?:number; xp?: numberduration?: numberlines?: string[]mysteryItems?: string[]championBuff?: booleanmessage?: string}

typeActiveGame= { key:'chicken_run' | 'road_crossing'; sessionId:string; tier:number; tierName:string; tierMult:number; speedMult:number; winTarget: number} | null constGAME_META:Record<string, { controls:string[]; objective: string}> = {
  chicken_run:{
    controls:['⬅️➡️ swipe / arrows= switchlane', '⬆️ swipe / space= jump', 'Jump clearsrocks, barriers& dogs— not cars& trees'],
    objective:'Run 1000m towin! Collect🥚🪙💎🎁 on theway.',
  },
  road_crossing:{
    controls:['⬆️⬇️⬅️➡️ swipe / arrows= hop', '🛡️ shield· 🧲 magnet· ⚡ speed· ❄️ freeze'],
    objective:'Cross 12 roads to reach the farmside!',
  },
}

export functionGamesView() {
  const{ showFlash, refresh} = useGame()
  const[hub, setHub]= useState<HubData| null>(null)
  const[board, setBoard]= useState<'daily' | 'weekly' | 'monthly'>('daily')
  const[active, setActive]= useState<ActiveGame>(null)
  const[result, setResult]= useState<FinishResult| null>(null)
  const[starting, setStarting]= useState<string| null>(null)
  const[tick, setTick]= useState(0)

  const load= useCallback(async() => {
    try{
      setHub(awaitapi<HubData>('/api/mini'))
    } catch(e) {
      showFlash(e instanceofError? e.message :'Failed to loadarcade', 'error')
    }
  }, [showFlash])

  useEffect(() => { load() }, [load])
  // energy tickeruseEffect(() => {
    const t= setInterval(() => setTick(x=> x+ 1), 1000)
    return() => clearInterval(t)
  }, [])

  async functionstartGame(game:GameView) {
    if(starting) returnsetStarting(game.key)
    try{
      const res= awaitapi<ActiveGame& { ok: boolean}>('/api/mini', {
        method:'POST',
        body:{ action:'start', gameKey: game.key},
      })
      setActive({
        key: game.key as'chicken_run' | 'road_crossing',
        sessionId:res.sessionId!, tier:res.tier!, tierName:res.tierName!,
        tierMult:res.tierMult!, speedMult:res.speedMult!, winTarget:res.winTarget!,
      })
    } catch(e) {
      showFlash(e instanceofError? e.message :'Cannot startgame', 'error')
    } finally{
      setStarting(null)
    }
  }

  constfinishGame= useCallback(async(sessionId:string, telemetry:Record<string, number>) => {
    try{
      const res= awaitapi<FinishResult>('/api/mini', {
        method:'POST',
        body:{ action:'finish', sessionId, ...telemetry},
      })
      setResult(res)
      if(res.rejected) showFlash(res.message?? 'Resultrejected', 'error')
      refresh()
    } catch(e) {
      showFlash(e instanceofError? e.message :'Failed to submitresult', 'error')
    } finally{
      setActive(null)
      load()
    }
  }, [load, refresh, showFlash])

  if(active) {
    if(active.key=== 'chicken_run') {
      return<ChickenRunsessionId={active.sessionId}
        tier={active.tier} tierName={active.tierName}
        speedMult={active.speedMult} winTarget={active.winTarget}
        onEnd={(tel) => finishGame(active.sessionId, tel)}
        onQuit={() => setActive(null)}
      />
    }
    return<RoadCrossingsessionId={active.sessionId}
      tier={active.tier} tierName={active.tierName}
      speedMult={active.speedMult} winTarget={active.winTarget}
      onEnd={(tel) => finishGame(active.sessionId, tel)}
      onQuit={() => setActive(null)}
    />
  }

  if(!hub) return<LoadingSpinnerlabel="Booting thearcade..." />

  const e= hub.energy constenergyPct= (e.energy /e.max) * 100 void tick // re-render every second to advance countdown return(
    <div className="px-3 pb-4">
      <SectionTitleright={
        <span className="rounded-full bg-purple-100 border border-purple-300 px-2 py-0.5 text-[10px] font-blacktext-purple-700">
          TIER:{hub.tierInfo[hub.tier]?.name?? 'Farm'} ×{hub.tierInfo[hub.tier]?.mult?? 1}
        </span>
      }>🎮 MiniGamesHub</SectionTitle>

      {/* ── energy card── */}
      <GameCard className="mb-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-blacktext-stone-800">⚡ ArcadeEnergy</p>
            <p className="text-[10px]text-stone-500">
              +{e.regenPerHour}/hour{e.vipFast? ' · 👑 VIP ×2boost' :''}
            </p>
          </div>
          <p className="text-lg font-black tabular-numstext-purple-700">{e.energy}/{e.max}</p>
        </div>
        <ProgressBarpct={energyPct} className="mt-2" />
        {e.energy< e.max&& (
          <p className="mt-1 text-right text-[10px] font-bold text-stone-600tabular-nums">
            next⚡ in{Math.floor(e.nextEnergyInSec /60)}:{String(e.nextEnergyInSec% 60).padStart(2, '0')}
          </p>
        )}
      </GameCard>

      {/* ── game cards── */}
      {hub.games.map(g=> {
        const meta= GAME_META[g.key]?? { controls:[], objective:'' }
        return(
          <GameCardkey={g.id} className={cn('mb-3', !g.enabled&& 'opacity-60')}>
            <div className="flex items-start gap-3">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-stone-200 bg-gradient-to-b from-stone-50 to-stone-100text-3xl">
                {g.emoji}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-blacktext-stone-800">{g.name}</p>
                  <span className="rounded-full bg-amber-100 border border-amber-300 px-1.5 py-0.5 text-[9px] font-blacktext-amber-700">⚡{g.energyCost}</span>
                  {!g.enabled&& <span className="rounded-full bg-red-100 border border-red-300 px-1.5 py-0.5 text-[9px] font-blacktext-red-600">OFFLINE</span>}
                </div>
                <p className="mt-0.5 text-[11px] leading-snugtext-stone-500">{g.description}</p>
                <p className="mt-1 text-[10px] font-boldtext-green-700">🎯 {meta.objective}</p>
                <div className="mt-1 flex gap-3 text-[10px] font-boldtext-stone-500">
                  <span>🏅 Best:{g.key=== 'chicken_run' ? `${g.myBestDistance}m` :`${g.myBestScore} roads`}</span>
                  <span>🌍 {g.totalPlays.toLocaleString()} plays</span>
                </div>
              </div>
            </div>
            <ul className="mt-2 space-y-0.5 rounded-xl bg-stone-50  p-2">
              {meta.controls.map((c, i) => <likey={i} className="text-[10px]text-stone-500">{c}</li>)}
            </ul>
            <button onClick={() => startGame(g)}
              disabled={starting=== g.key|| !g.enabled|| hub.energy.energy< g.energyCost}
              className={cn(
                'mt-2 h-11 w-full rounded-2xl text-sm font-extrabold text-white shadow-lg transition-allactive:scale-95',
                'bg-gradient-to-r from-purple-600to-fuchsia-600',
                (!g.enabled|| hub.energy.energy< g.energyCost) && 'from-stone-400to-stone-400'
              )}
            >
              {starting=== g.key? 'Loading...' :!g.enabled? 'Unavailable' : hub.energy.energy< g.energyCost? `Need⚡${g.energyCost}` :`▶ PlayNow(⚡${g.energyCost})`}
            </button>
          </GameCard>
        )
      })}

      {/* ── my arcade stats── */}
      <SectionTitle>📊 MyArcadeStats</SectionTitle>
      <GameCard className="mb-3">
        <div className="grid grid-cols-3 gap-2text-center">
          <div><p className="text-lg font-black text-stone-800tabular-nums">{hub.stats.totalGames}</p><p className="text-[9px] font-bold uppercasetext-stone-600">Games</p></div>
          <div><p className="text-lg font-black text-green-600tabular-nums">{hub.stats.wins}</p><p className="text-[9px] font-bold uppercasetext-stone-600">Wins</p></div>
          <div><p className="text-lg font-black text-amber-600tabular-nums">{hub.stats.totalRewards.toLocaleString()}</p><p className="text-[9px] font-bold uppercasetext-stone-600">🪙 Won</p></div>
          <div><p className="text-lg font-black text-purple-600tabular-nums">{hub.stats.highestScore}</p><p className="text-[9px] font-bold uppercasetext-stone-600">HighScore</p></div>
          <div><p className="text-lg font-black text-teal-600tabular-nums">{hub.stats.bestDistance}m</p><p className="text-[9px] font-bold uppercasetext-stone-600">BestRun</p></div>
          <div><p className="text-lg font-black text-stone-600tabular-nums">{Math.round(hub.stats.playTimeSec /60)}m</p><p className="text-[9px] font-bold uppercasetext-stone-600">PlayTime</p></div>
        </div>
      </GameCard>

      {/* ── leaderboards── */}
      <SectionTitleright={
        <div className="flex gap-1">
          {(['daily', 'weekly', 'monthly'] asconst).map(b=> (
            <buttonkey={b} onClick={() => setBoard(b)}
              className={cn('rounded-full px-2.5 py-1 text-[10px] font-extrabold capitalize transition-all',
                board=== b? 'bg-purple-700 text-white  shadow' :'bg-stone-100  text-stone-500')}>
              {b}
            </button>
          ))}
        </div>
      }>🏆 Leaderboards</SectionTitle>

      {hub.games.map(g=> {
        const rows= hub.leaderboards[g.key]?.[board]?? [] return(
          <GameCardkey={g.id} className="mb-3">
            <p className="mb-2 text-xs font-blacktext-stone-700">{g.emoji} {g.name} — {board=== 'daily' ? 'TopScore(today)' : board=== 'weekly' ? 'MostDistance(7d)' :'ChampionFarmer(month)'}</p>
            {rows.length=== 0? (
              <p className="py-3 text-center text-[11px]text-stone-600">No scores yet— be the firstchampion! 🐔</p>
            ) :(
              <div className="space-y-1.5">
                {rows.map((r, i) => (
                  <divkey={r.userId} className={cn('flex items-center gap-2 rounded-xl px-2 py-1.5', i=== 0&& 'bg-amber-50 borderborder-amber-200', i=== 1&& 'bg-stone-50', i=== 2&& 'bg-orange-50/60')}>
                    <span className="w-6 text-center text-xs font-black">{['🥇', '🥈', '🥉'][i]?? `${i+ 1}`}</span>
                    <span className="text-lg">{r.avatar}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[11px] font-blacktext-stone-700">
                        {r.username} {r.vip&& '👑'}
                      </p>
                      <p className="truncate text-[9px]text-stone-600">{r.farmName}</p>
                    </div>
                    <span className="text-xs font-black tabular-numstext-purple-700">
                      {g.key=== 'chicken_run'
                        ? (board=== 'weekly' ? `${r.value}m` :`${r.value}`)
                        :(board=== 'weekly' ? `${r.value}m` :`${r.value} rd`)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </GameCard>
        )
      })}

      {/* ── season rewards── */}
      <SectionTitle>🗓️ Season 1Rewards</SectionTitle>
      <GameCard className="mb-3">
        {hub.seasonRewards.map(r=> (
          <divkey={r.rank} className="flex items-center gap-3 border-b border-stone-100 py-2 last:border-0">
            <span className="text-2xl">{r.emoji}</span>
            <div className="flex-1">
              <p className="text-[11px] font-blacktext-stone-700">{['🥇 1st', '🥈 2nd', '🥉 3rd'][r.rank -1]} — {r.prize}</p>
              <p className="text-[10px]text-stone-600">{r.detail}</p>
            </div>
          </div>
        ))}
        <p className="mt-2 text-[10px]text-stone-600">Monthly champions are crowned by total arcade score.Admins pay out season rewards from the controlcenter.</p>
      </GameCard>

      {/* ── tier ladder── */}
      <SectionTitle>⚡ DifficultyTiers</SectionTitle>
      <GameCard className="mb-3">
        {hub.tierInfo.map(t=> (
          <divkey={t.key} className={cn('flex items-center gap-2 border-b border-stone-100 py-2 last:border-0', t.locked&& 'opacity-50')}>
            <span className="text-lg">{t.current? '📍' : t.locked? '🔒' :'✅'}</span>
            <div className="flex-1">
              <p className="text-[11px] font-blacktext-stone-700">{t.name} <span className="text-purple-600">×{t.mult}</span></p>
              <p className="text-[10px]text-stone-600">{t.desc} · requires farmer level{t.reqLevel}</p>
            </div>
          </div>
        ))}
      </GameCard>

      {/* ── recent sessions── */}
      {hub.recentSessions.length> 0&& (
        <>
          <SectionTitle>🕹️ RecentPlays</SectionTitle>
          <GameCard>
            {hub.recentSessions.map(s=> (
              <divkey={s.id} className="flex items-center gap-2 border-b border-stone-100 py-1.5 text-[11px] last:border-0">
                <span>{s.gameKey=== 'chicken_run' ? '🏃' :'🚦'}</span>
                <span className={cn('font-black', s.result=== 'win' ? 'text-green-600' :'text-stone-500')}>
                  {s.result=== 'win' ? 'WIN' :'LOSS'}
                </span>
                <span className="flex-1 text-stone-600tabular-nums">
                  {s.gameKey=== 'chicken_run' ? `${s.distance}m` :`${s.score} roads`} · {newDate(s.createdAt).toLocaleDateString()}
                </span>
                <span className="font-bold text-amber-600tabular-nums">🪙{s.coins}</span>
              </div>
            ))}
          </GameCard>
        </>
      )}

      {/* ── reward result modal── */}
      {result&& (
        <motion.divinitial={{ opacity: 0}} animate={{ opacity: 1}}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60p-6"
          onClick={() => setResult(null)}
        >
          <motion.divinitial={{ scale:0.7, y: 30}} animate={{ scale:1, y: 0}}
            transition={{ type:'spring', bounce: 0.45}}
            className={cn(
              'w-full max-w-xs rounded-3xl border-4 bg-gradient-to-b p-6 text-centershadow-2xl',
              result.rejected? 'border-red-300 from-red-50to-red-100'
                : result.result=== 'win' ? 'border-amber-300 from-yellow-50to-amber-100'
                :'border-stone-300 from-stone-50to-stone-100'
            )}
          >
            <motion.divanimate={{ scale:[1, 1.15, 1], rotate:[0, 8, -8, 0]}}
              transition={{ repeat:Infinity, duration: 1.8}}
              className="text-6xl"
            >
              {result.rejected? '🚨' : result.result=== 'win' ? '🏆' :'🐔'}
            </motion.div>
            <p className="mt-2 text-xl font-blacktext-stone-800">
              {result.rejected? 'ResultRejected' : result.result=== 'win' ? 'VICTORY!' :'GameOver'}
            </p>
            {result.rejected? (
              <p className="mt-1 text-xstext-red-600">{result.reason} — rewardsvoided.</p>
            ) :(
              <>
                <div className="mt-3 flex justify-center gap-3 text-lg font-black">
                  <span className="text-amber-600">🪙 {result.coins?? 0}</span>
                  {result.eggs? <span className="text-stone-500">🥚 {result.eggs}</span> :null}
                  {result.gems? <span className="text-pink-500">💎 {result.gems}</span> :null}
                  <span className="text-green-600">+{result.xp?? 0} XP</span>
                </div>
                {result.mysteryItems&& result.mysteryItems.length> 0&& (
                  <p className="mt-2 text-[11px] font-boldtext-purple-600">🎁 Mystery boxes:{result.mysteryItems.join(', ')}</p>
                )}
                {result.championBuff&& (
                  <p className="mt-1 text-[11px] font-blacktext-orange-500">🏅 Championbuff! +10% production for12h</p>
                )}
                {result.lines&& result.lines.length> 0&& (
                  <div className="mt-2 space-y-0.5 rounded-xl bg-white/70p-2">
                    {result.lines.map((l, i) => <pkey={i} className="text-[10px]text-stone-500">{l}</p>)}
                  </div>
                )}
              </>
            )}
            <button onClick={() => setResult(null)}
              className="mt-4 w-full rounded-2xl bg-purple-700 py-3 text-sm font-extrabold text-white shadow-lgactive:scale-95">
              Back toArcade🎮
            </button>
          </motion.div>
        </motion.div>
      )}
    </div>
  )
}
