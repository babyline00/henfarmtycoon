'useclient'

import{ useEffect, useState} from'react'
import{ AnimatePresence, motion} from'framer-motion'
import{ useGame, typeGameState} from'@/lib/store'
import{ EGG_TYPES, HEN_TYPES, FEED_TYPES, ANIMAL_TYPES, TRAITS, FEED_FACTORY_DISCOUNT } from'@/lib/game'
import{ Button} from'@/components/ui/button'
import{ CoinPill, GemPill, GameCard, ProgressBar, RarityBadge, SectionTitle, EmptyState} from'./shared'
import{ cn} from'@/lib/utils'

functionuseTick(intervalMs= 1000) {
  const[, setTick]= useState(0)
  useEffect(() => {
    const t= setInterval(() => setTick(x=> x+ 1), intervalMs)
    return() => clearInterval(t)
  }, [intervalMs])
}

functioncountdown(iso:string): string{
  const ms= newDate(iso).getTime() -Date.now()
  if(ms<= 0) return'Ready!'
  const h= Math.floor(ms /3600000)
  const m= Math.floor((ms% 3600000) /60000)
  const s= Math.floor((ms% 60000) /1000)
  return h> 0? `${h}h${m}m` : m> 0? `${m}m${s}s` :`${s}s`
}

export functionFarmView() {
  const{ state, act, loading, setHatchResult} = useGame()
  const[sellType, setSellType]= useState<string| null>(null)
  const[breedPick, setBreedPick]= useState<string[]>([])
  useTick(1000)

  if(!state) return null const{ user, farm, hens, animals, eggInventory, incubators, items} = state constactiveHens= hens.filter(h=> h.status=== 'active')
  consttotalPendingEggs= hens.reduce((s, h) => s+ h.pendingEggs, 0)
  consttotalPendingCoins= animals.reduce((s, a) => s+ a.pendingCoins, 0)
  consttotalInvEggs= Object.values(eggInventory).reduce((s, n) => s+ n, 0)
  consteggCoins= activeHens.reduce((s, h) => s+ h.ratePerHour* 24* (EGG_TYPES[h.type]?.sellValue?? 0), 0)
  constanimalCoins= animals.reduce((s, a) => {
    constperHour= (ANIMAL_TYPES[a.type]?.coinsPerHour?? 0) * farm.productionMult return s+ perHour* 24}, 0)
  constdailyIncomeEstimate= Math.round(eggCoins+ animalCoins)

  // breeding candidates: prime/mature adults off cooldown const breedable= hens.filter(h=> h.status=== 'active' && (h.stage=== 'prime' || h.stage=== 'mature') && !h.breedCooldownUntil)

  functiontoggleBreedPick(id:string) {
    setBreedPick(prev=>
      prev.includes(id) ? prev.filter(x=> x!== id)
        : prev.length>= 2? [prev[1], id] :[...prev, id])
  }

  async functionhandleBreed() {
    if(breedPick.length!== 2) return const res= awaitact('breed', { henAId:breedPick[0], henBId:breedPick[1]})
    if(res?.hatch) setHatchResult(res.hatch asnever)
    setBreedPick([])
  }

  async functionhandleUseItem(key:string, henId?:string) {
    awaitact('use_item', { itemKey:key, henId})
  }

  async functionhandleCollectHens() {
    awaitact('collect_hens')
  }
  async functionhandleCollectAnimals() {
    awaitact('collect_animals')
  }
  async functionhandleOpen(eggId:string) {
    const res= awaitact('open_egg', { eggId})
    // hatch result already set by store via res.hatch if(res?.hatch) setHatchResult(res.hatch asnever)
  }
  async functionhandleSpeedUp(eggId:string) {
    awaitact('speedup', { eggId})
  }
  async functionhandleIncubate(type:string) {
    awaitact('incubate', { eggType: type})
  }
  async functionhandleSell(type:string, count:number) {
    awaitact('sell_eggs', { eggType:type, count})
    setSellType(null)
  }
  async functionhandleFeed(feedType:string) {
    awaitact('feed', { feedType})
  }

  return(
    <div className="space-y-3 px-3 pb-4">
      {/* ── farm scene banner── */}
      <div className="relative overflow-hidden rounded-3xl border border-green-200 bg-gradient-to-b from-sky-50 via-lime-50 to-green-100 p-4shadow-sm">
        <div className="pointer-events-none absolute right-2 top-2 flex flex-colitems-end">
          <motion.divanimate={{ rotate:[0, 8, -8, 0]}}
            transition={{ repeat:Infinity, duration: 4}}
            className="text-4xl"
          >
            {farm.weather.emoji}
          </motion.div>
          <span className={cn(
            'mt-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-black',
            farm.weather.pct> 0? 'bg-green-200  text-green-800' : farm.weather.pct< 0? 'bg-red-200  text-red-700' :'bg-stone-200  text-stone-600'
          )}>
            {farm.weather.name} {farm.weather.pct> 0? `+${farm.weather.pct}%` : farm.weather.pct!== 0? `${farm.weather.pct}%` :''}
          </span>
        </div>
        <div className="pointer-events-none absolute right-10 bottom-1 text-3xl">🌳</div>
        <div className="pointer-events-none absolute bottom-0 left-2 text-3xl">🏠</div>
        <div className="pointer-events-none absolute bottom-0 left-12 text-2xl">🐔</div>
        <div className="pointer-events-none absolute bottom-1 right-20 text-2xl">🐮</div>

        <div className="relative">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border-2 border-amber-300 bg-white text-2xlshadow">
              {user.avatar}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-lg font-blacktext-stone-800">{user.farmName}</p>
              <p className="text-xs font-boldtext-green-700">⭐ {user.levelName}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold uppercasetext-stone-600">FarmValue</p>
              <p className="text-lg font-black tabular-numstext-amber-600">🪙 {state.farmValue.toLocaleString()}</p>
            </div>
          </div>
          <div className="mt-3">
            <div className="mb-1 flex justify-between text-[10px] font-boldtext-stone-500">
              <span>XP {user.xp.toLocaleString()}{user.nextXp? ` /${user.nextXp.toLocaleString()}` :' · MAX'}</span>
              <span>{user.levelProgress}%</span>
            </div>
            <ProgressBarpct={user.levelProgress} />
          </div>

          <div className="mt-3 grid grid-cols-4 gap-2text-center">
            <MiniStaticon="🐔" label="Hens" value={`${activeHens.length}/${farm.coopCap}`} />
            <MiniStaticon="🥚" label="Hatched" value={farm.totalEggsHatch.toLocaleString()} />
            <MiniStaticon="🧺" label="InStore" value={totalInvEggs.toLocaleString()} />
            <MiniStaticon="⚡" label="Boost" value={`x${farm.productionMult}`} />
          </div>
          <p className="mt-1.5 text-center text-[10px] font-boldtext-stone-500">{farm.weather.desc}</p>
          <p className="mt-2 text-center text-[11px] font-boldtext-amber-700">
            ≈ 🪙 {dailyIncomeEstimate.toLocaleString()} estimated daily income</p>
        </div>
      </div>

      {/* ── event banner── */}
      {state.event&& (
        <div className="flex items-center gap-2 rounded-2xl border border-amber-300 bg-gradient-to-r from-amber-100 to-yellow-50 px-3 py-2">
          <span className="text-xl">🎉</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-blacktext-amber-800">{state.event.name} — x{(state.event.multiplier /100).toFixed(1)} PRODUCTION!</p>
            <p className="truncate text-[10px]text-amber-600">Ends{newDate(state.event.endsAt).toLocaleDateString()}</p>
          </div>
        </div>
      )}

      {/* ── buff / health bar── */}
      <GameCard className="flex items-center gap-2">
        <div className="text-2xl">{farm.health>= 90? '💚' : farm.health>= 60? '💛' :'🧡'}</div>
        <div className="min-w-0 flex-1">
          <div className="flex justify-between text-xs">
            <span className="font-boldtext-stone-600">FarmHealth</span>
            <span className="font-black tabular-numstext-stone-700">{farm.health}%</span>
          </div>
          <ProgressBarpct={farm.health} className="mt-1 h-1.5" />
          <p className="mt-1 text-[10px]text-stone-600">Feed daily to keep100% production· lower health cutsoutput</p>
        </div>
        {farm.buffType&& (
          <div className="rounded-xl bg-green-100 px-2 py-1text-center">
            {farm.buffType=== 'champion' ? (
              <>
                <p className="text-[10px] font-blacktext-green-700">🏅 +10%</p>
                <p className="text-[9px]text-green-600">{countdown(farm.buffExpiresAt!)}</p>
              </>
            ) :FEED_TYPES[farm.buffType]? (
              <>
                <p className="text-[10px] font-blacktext-green-700">{FEED_TYPES[farm.buffType].emoji} +{FEED_TYPES[farm.buffType].boostPct}%</p>
                <p className="text-[9px]text-green-600">{countdown(farm.buffExpiresAt!)}</p>
              </>
            ) :null}
          </div>
        )}
      </GameCard>

      {/* ── coop── */}
      <SectionTitleright={
          <Buttonsize="sm"
            onClick={handleCollectHens}
            disabled={loading|| totalPendingEggs=== 0}
            className="h-8 rounded-full bg-green-700 px-3 text-xs font-extrabold text-white shadow active:scale-95disabled:opacity-40"
          >
            🧺 CollectAll({totalPendingEggs})
          </Button>
        }
      >
        🏠 ChickenHouse· Lv{farm.coopLevel} ({activeHens.length}/{farm.coopCap})
      </SectionTitle>

      {hens.length=== 0? (
        <GameCard>
          <EmptyStateemoji="🐔" title="Your coop isempty!" sub="Visit theShop and buy your firsthen" />
        </GameCard>
      ) :(
        <div className="grid grid-cols-2 gap-2">
          {hens.map(hen=> (
            <GameCardkey={hen.id} className={cn('relative overflow-hidden', hen.status=== 'retired' && 'opacity-60')}>
              <div className="flex items-start justify-between">
                <span className="text-3xl">{hen.emoji}</span>
                <div className="flex items-center gap-1">
                  {hen.generation> 1&& (
                    <span className="rounded-full bg-purple-100 px-1.5 py-0.5 text-[9px] font-blacktext-purple-700">G{hen.generation}</span>
                  )}
                  <RarityBadgerarity={hen.rarity} />
                </div>
              </div>
              <p className="mt-1 truncate text-sm font-blacktext-stone-700">{hen.name}</p>
              <p className="text-[10px]text-stone-600">
                {hen.stageEmoji} {hen.stageName} · Lv{hen.level} · {hen.ageDays}d/{hen.lifespan}d</p>
              {hen.traits.length> 0&& (
                <div className="mt-1 flex flex-wrapgap-1">
                  {hen.traits.map(t=> (
                    <spankey={t} title={TRAITS[t]?.desc?? t} className="rounded-full bg-amber-50 px-1.5 py-0.5 text-[9px] font-boldtext-amber-700">
                      {TRAITS[t]?.emoji?? '✨'} {TRAITS[t]?.name?? t}
                    </span>
                  ))}
                </div>
              )}
              {hen.status=== 'active' && hen.pendingEggs> 0&& (
                <div className="absolute right-2 top-9 animate-bounce rounded-full bg-amber-900 px-1.5 py-0.5 text-[10px] font-black text-white  shadow">
                  🥚 {hen.pendingEggs}
                </div>
              )}
              {hen.status=== 'retired' && (
                <p className="mt-1 text-[10px] font-boldtext-stone-600">Sell atMarketplace</p>
              )}
            </GameCard>
          ))}
        </div>
      )}

      {/* ── 🧬 breeding nest── */}
      <SectionTitleright={<span className="text-[10px] font-boldtext-stone-600">🪙 500· 6hcooldown</span>}>
        🧬 BreedingNest</SectionTitle>
      <GameCard className="bg-gradient-to-r from-pink-50 via-purple-50to-white">
        <p className="text-[11px]text-stone-500">
          Pick<b>two grownhens</b> to breed.Chicks inherit traits and can jump a breed tier— with a10% chance of a🌟 <b>legendarymutation</b>!
        </p>
        {breedable.length< 2? (
          <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-[11px] font-boldtext-amber-700">
            🐣 You need at least 2 grown hens(Prime/Mature, not oncooldown) to breed.</p>
        ) :(
          <>
            <div className="mt-2 flex flex-wrapgap-1.5">
              {breedable.map(h=> (
                <buttonkey={h.id}
                  onClick={() => toggleBreedPick(h.id)}
                  className={cn(
                    'rounded-xl border px-2 py-1 text-[11px] font-bold transition-all',
                    breedPick.includes(h.id) ? 'border-pink-500 bg-pink-100  text-pink-800' :'border-stone-200 bg-whitetext-stone-600'
                  )}
                >
                  {h.emoji} {h.name} {h.traits.length> 0&& h.traits.map(t=> TRAITS[t]?.emoji).join('')}
                </button>
              ))}
            </div>
            <div className="mt-2 flex items-center justify-between">
              <p className="text-[11px] font-boldtext-stone-500">
                {breedPick.length=== 2? `${hens.find(h=> h.id=== breedPick[0])?.emoji} ${hens.find(h=> h.id=== breedPick[0])?.name} × ${hens.find(h=> h.id=== breedPick[1])?.emoji} ${hens.find(h=> h.id=== breedPick[1])?.name}`
                  :'Select 2parents'}
              </p>
              <Buttonsize="sm"
                onClick={handleBreed}
                disabled={loading|| breedPick.length!== 2|| user.coins< 500}
                className="h-9 rounded-full bg-pink-500 px-4 text-xs font-extrabold text-white active:scale-95disabled:opacity-40"
              >
                🧬 Breed(🪙 500)
              </Button>
            </div>
          </>
        )}
      </GameCard>

      {/* ── incubator── */}
      <SectionTitleright={<span className="text-[10px] font-boldtext-stone-600">🏹 RoomLv{farm.incubatorLevel}</span>}>
        🍼 Incubator({incubators.length}/{farm.incubatorCap})
      </SectionTitle>
      <div className="grid grid-cols-4 gap-2">
        {Array.from({ length:farm.incubatorCap}).map((_, i) => {
          const slot= incubators[i] if(!slot) {
            return(
              <divkey={i} className="flex h-28 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-stone-200 bg-white/50text-center">
                <span className="text-2xlopacity-30">🥚</span>
                <span className="mt-1 px-1 text-[9px]text-stone-600">Emptyslot</span>
              </div>
            )
          }
          const def= EGG_TYPES[slot.type] return(
            <divkey={slot.id} className={`flex h-28 flex-col items-center justify-center rounded-2xl border p-1 text-center shadow-sm${slot.ready? 'animate-pulse border-green-400bg-green-50' :'border-stone-200bg-white'}`}>
              <motion.spananimate={slot.ready? { scale:[1, 1.15, 1]} :{ rotate:[0, -5, 5, 0]}}
                transition={{ repeat:Infinity, duration: slot.ready? 1 : 2.5}}
                className="text-3xl"
              >
                {def.emoji}
              </motion.span>
              {slot.ready? (
                <Buttonsize="sm"
                  onClick={() => handleOpen(slot.id)}
                  disabled={loading}
                  className="mt-1 h-7 rounded-full bg-green-700 px-2 text-[10px] font-black text-white  active:scale-95"
                >
                  🐣 OPEN!
                </Button>
              ) :(
                <>
                  <p className="mt-1 text-[10px] font-black tabular-numstext-stone-600">{countdown(slot.hatchAt)}</p>
                  <button onClick={() => handleSpeedUp(slot.id)}
                    disabled={loading}
                    className="mt-0.5 rounded-full bg-pink-100 px-1.5 py-0.5 text-[9px] font-bold text-pink-800disabled:opacity-50"
                  >
                    ⚡ Speed up💎
                  </button>
                </>
              )}
            </div>
          )
        })}
      </div>

      {/* ── egg inventory── */}
      <SectionTitle>🧺 EggStorage</SectionTitle>
      {totalInvEggs=== 0? (
        <GameCard><EmptyStateemoji="🥚" title="No eggsyet" sub="Collect from your hensfirst" /></GameCard>
      ) :(
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(eggInventory).filter(([, n]) => n> 0).map(([type, n]) => {
            const def= EGG_TYPES[type] return(
              <GameCardkey={type} className="flex items-center gap-2">
                <span className="text-3xl">{def.emoji}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-blacktext-stone-700">{def.name} ×{n}</p>
                  <p className="text-[10px]text-stone-600">🪙 {def.sellValue}/ea· {def.hatchHours}hhatch</p>
                </div>
                <div className="flex flex-colgap-1">
                  <button onClick={() => handleIncubate(type)}
                    disabled={loading}
                    className="rounded-full bg-green-700 px-2 py-1 text-[10px] font-black text-white  disabled:opacity-50"
                  >
                    Hatch</button>
                  <button onClick={() => setSellType(type)}
                    disabled={loading}
                    className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-black text-amber-900disabled:opacity-50"
                  >
                    Sell</button>
                </div>
              </GameCard>
            )
          })}
        </div>
      )}

      {/* ── animal pens── */}
      <SectionTitleright={
          animals.some(a=> a.pendingCoins> 0) ? (
            <Buttonsize="sm"
              onClick={handleCollectAnimals}
              disabled={loading}
              className="h-8 rounded-full bg-green-700 px-3 text-xs font-extrabold text-white shadowactive:scale-95"
            >
              🧺 Harvest({totalPendingCoins})
            </Button>
          ) : undefined}
      >
        🌾 AnimalPens· Lv{farm.landLevel} ({animals.length}/{Math.max(farm.landCap, farm.shelterCap)})
      </SectionTitle>
      {farm.shelterLevel> 0&& (
        <p className="rounded-xl bg-orange-50 px-3 py-1.5 text-[10px] font-boldtext-orange-700">
          🏚️ AnimalShelterLv{farm.shelterLevel}: cap{farm.shelterCap} · +{farm.shelterBonus}% animal production</p>
      )}

      {animals.length=== 0? (
        <GameCard><EmptyStateemoji="🐄" title="No animalsyet" sub="Dogs boostproduction, cows makemilk" /></GameCard>
      ) :(
        <div className="grid grid-cols-2 gap-2">
          {animals.map(a=> (
            <GameCardkey={a.id} className="flex items-center gap-2">
              <span className="text-3xl">{a.emoji}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-blacktext-stone-700">{a.name}</p>
                <p className="truncate text-[10px]text-stone-600">
                  {a.passive? (a.pendingCoins> 0? `🪙 ${a.pendingCoins} ready` :'producing...') :`✨ ${a.effect} +${a.effectValue}%`}
                </p>
              </div>
            </GameCard>
          ))}
        </div>
      )}

      {/* ── 🎒 barn inventory── */}
      <SectionTitleright={<span className="text-[10px] font-boldtext-stone-600">buy more inShop→ Items</span>}>
        🎒 BarnInventory</SectionTitle>
      {items.length=== 0? (
        <GameCard><EmptyStateemoji="🎒" title="Your barn isempty" sub="Buymedicine, boosters& tools from theShop" /></GameCard>
      ) :(
        <div className="grid grid-cols-2 gap-2">
          {items.map(it=> (
            <GameCardkey={it.key} className="flexflex-col">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{it.emoji}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-blacktext-stone-700">{it.name} ×{it.qty}</p>
                  <p className="text-[9px] uppercase font-boldtext-stone-600">{it.kind}</p>
                </div>
              </div>
              <p className="mt-1 flex-1 text-[10px] leading-tighttext-stone-500">{it.desc}</p>
              {it.usable? (
                <button onClick={() => handleUseItem(it.key)}
                  disabled={loading}
                  className="mt-1.5 rounded-full bg-green-700 py-1.5 text-[10px] font-black text-white  disabled:opacity-50"
                >
                  ✨ Use one</button>
              ) :(
                <p className="mt-1.5 rounded-full bg-stone-100 py-1.5 text-center text-[10px] font-boldtext-stone-500">🛡️ Passiveeffect</p>
              )}
            </GameCard>
          ))}
        </div>
      )}

      {/* ── feed station── */}
      <SectionTitleright={farm.feedFactoryLevel> 0? <span className="text-[10px] font-boldtext-orange-600">🏭 Factory-{FEED_FACTORY_DISCOUNT[Math.min(farm.feedFactoryLevel, FEED_FACTORY_DISCOUNT.length -1)]}%</span> :undefined}>
        🌽 FeedStation</SectionTitle>
      <div className="grid grid-cols-2 gap-2">
        {Object.values(FEED_TYPES).map(f=> {
          constdiscountPct= FEED_FACTORY_DISCOUNT[Math.min(farm.feedFactoryLevel, FEED_FACTORY_DISCOUNT.length -1)]?? 0 consteffPrice= Math.max(1, Math.round(f.price* (1 -discountPct /100)))
          return(
          <GameCardkey={f.key} className="flex flex-col items-center p-3text-center">
            <span className="text-3xl">{f.emoji}</span>
            <p className="mt-1 text-xs font-blacktext-stone-700">{f.name}</p>
            <p className="text-[10px]text-stone-600">{f.desc}</p>
            <Buttonsize="sm"
              onClick={() => handleFeed(f.key)}
              disabled={loading|| user.coins< effPrice}
              className="mt-2 h-8 w-full rounded-full bg-amber-800 text-xs font-extrabold text-white active:scale-95disabled:opacity-40"
            >
              🪙 {effPrice}{discountPct> 0&& <span className="line-throughopacity-60"> {f.price}</span>} · Feed</Button>
          </GameCard>
          )
        })}
      </div>

      {/* ── sell dialog── */}
      <AnimatePresence>
        {sellType&& (
          <SellSheettype={sellType}
            count={eggInventory[sellType]?? 0}
            onClose={() => setSellType(null)}
            onSell={handleSell}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

functionMiniStat({ icon, label, value}:{ icon:string; label:string; value: string}) {
  return(
    <div className="rounded-xl border border-white bg-white/70py-1.5">
      <p className="text-sm">{icon}</p>
      <p className="text-xs font-black tabular-numstext-stone-700">{value}</p>
      <p className="text-[9px] font-bold uppercasetext-stone-600">{label}</p>
    </div>
  )
}

functionSellSheet({ type, count, onClose, onSell}:{ type:string; count:number; onClose:() => void; onSell:(t:string, n:number) => void}) {
  const def= EGG_TYPES[type] const[qty, setQty]= useState(count)
  return(
    <motion.divinitial={{ opacity: 0}} animate={{ opacity: 1}} exit={{ opacity: 0}}
      className="fixed inset-0 z-50 flex items-end justify-centerbg-black/40"
      onClick={onClose}
    >
      <motion.divinitial={{ y: 120}} animate={{ y: 0}} exit={{ y: 120}}
        onClick={e=> e.stopPropagation()}
        className="w-full max-w-md rounded-t-3xl bg-white p-5shadow-2xl"
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-fullbg-stone-300" />
        <div className="flex items-center gap-3">
          <span className="text-4xl">{def.emoji}</span>
          <div>
            <p className="font-blacktext-stone-800">Sell{def.name}</p>
            <p className="text-xstext-stone-600">You own{count} · 🪙 {def.sellValue} each</p>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <inputtype="range" min={1} max={count} value={qty}
            onChange={e=> setQty(Number(e.target.value))}
            className="h-2 flex-1accent-green-600"
          />
          <span className="w-10 text-center text-lg font-black tabular-numstext-stone-800">{qty}</span>
        </div>
        <p className="mt-2 text-center text-sm font-boldtext-amber-600">Total:🪙 {def.sellValue* qty}</p>

        <div className="mt-4 flex gap-2">
          <Buttonvariant="outline" onClick={onClose} className="h-11 flex-1 rounded-xl">Cancel</Button>
          <Button onClick={() => onSell(type, qty)}
            className="h-11 flex-1 rounded-xl bg-green-600 font-extrabold text-white"
          >
            💰 Sell{qty}
          </Button>
        </div>
      </motion.div>
    </motion.div>
  )
}
