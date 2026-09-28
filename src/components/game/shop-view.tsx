'useclient'

import{ useState} from'react'
import{ useGame} from'@/lib/store'
import{
  HEN_TYPES, ANIMAL_TYPES, EGG_TYPES, UPGRADES, FARMER_LEVELS,
  ITEM_TYPES, GEM_PACKS, VIP_PLANS,
} from'@/lib/game'
import{ Button} from'@/components/ui/button'
import{ GameCard, RarityBadge} from'./shared'
import{ cn} from'@/lib/utils'

typeTab= 'hens' | 'eggs' | 'animals' | 'items' | 'upgrades' | 'premium'

constHEN_REQ_LEVEL:Record<string, number> = { normal:0, golden:1, royal:2, magic: 3}

// building defs(server holds authoritativeprices)
constBUILDINGS = [{
    key:'incubator', name:'IncubatorRoom', emoji:'🏹',
    levelField:'incubatorLevel' asconst, maxLevel:2,
    prices:[0, 3000, 12000],
    effectFor:(lvl:number) => `${[4, 6, 8][lvl]} incubatorslots`,
  },
  {
    key:'feedFactory', name:'FeedFactory', emoji:'🏭',
    levelField:'feedFactoryLevel' asconst, maxLevel:3,
    prices:[0, 1500, 5000, 15000],
    effectFor:(lvl:number) => lvl=== 0? 'Unlock feeddiscounts' :`-${[0, 10, 20, 30][lvl]}% feedprice`,
  },
  {
    key:'shelter', name:'AnimalShelter', emoji:'🏚️',
    levelField:'shelterLevel' asconst, maxLevel:3,
    prices:[0, 2500, 8000, 20000],
    effectFor:(lvl:number) => lvl=== 0? 'Bigger animal cap+ production' :`${[6, 10, 16, 24][lvl]} animal cap· +${[0, 5, 10, 15][lvl]}% animaloutput`,
  },
] constPAY_METHODS = [{ key:'card', label:'💳 Card' },
  { key:'bank', label:'🏦 Bank' },
  { key:'usdt', label:'💵 USDT' },
] export functionShopView() {
  const{ state, act, loading} = useGame()
  const[tab, setTab]= useState<Tab>('hens')
  const[payMethod, setPayMethod]= useState('card')

  if(!state) return null const{ user, farm, hens, animals} = state constlevelIdx= user.levelIdx async functionbuy(itemType:string, subType:string) {
    awaitact('buy', { itemType, subType})
  }

  return(
    <div className="space-y-3 px-3 pb-4">
      <div className="rounded-3xl border border-amber-200 bg-gradient-to-r from-amber-50 to-white p-4shadow-sm">
        <p className="text-lg font-blacktext-stone-800">🛒 FarmShop</p>
        <p className="text-xstext-stone-500">Spend coins to grow your empire.Higher farmer levels unlock rarerbreeds.</p>
      </div>

      {/* tabs*/}
      <div className="grid grid-cols-3 gap-1 rounded-2xl bg-stone-100  p-1">
        {(['hens', 'eggs', 'animals', 'items', 'upgrades', 'premium'] asTab[]).map(t=> (
          <buttonkey={t}
            onClick={() => setTab(t)}
            className={cn(
              'rounded-xl py-2 text-xs font-extrabold capitalize transition-all',
              tab=== t? 'bg-white text-green-700shadow' :'text-stone-600'
            )}
          >
            {t=== 'hens' ? '🐔 Hens' : t=== 'eggs' ? '🥚 Eggs' : t=== 'animals' ? '🐄 Animals'
              : t=== 'items' ? '🎒 Items' : t=== 'upgrades' ? '🏗️ Build' :'👑 Premium'}
          </button>
        ))}
      </div>

      {/* ── hens── */}
      {tab=== 'hens' && (
        <div className="space-y-2">
          {Object.values(HEN_TYPES).map(def=> {
            const locked= levelIdx< (HEN_REQ_LEVEL[def.key]?? 0)
            const affordable= user.coins>= def.price const full= hens.length>= farm.coopCap constreqName= FARMER_LEVELS[HEN_REQ_LEVEL[def.key]]?.name return(
              <GameCardkey={def.key} className={cn(locked&& 'opacity-75')}>
                <div className="flex items-start gap-3">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-stone-200 bg-stone-50  text-3xl">
                    {def.emoji}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="truncate font-blacktext-stone-800">{def.name}</p>
                      <RarityBadgerarity={def.rarity} />
                    </div>
                    <p className="text-[11px] leading-tighttext-stone-500">{def.desc}</p>
                    <div className="mt-1 flex flex-wrap gap-x-3 text-[10px] font-boldtext-stone-600">
                      <span>🥚 {(def.eggsPerHour* 24).toFixed(0)} eggs/day</span>
                      <span>⏳ {def.lifespanDays}dlife</span>
                    </div>
                  </div>
                  <div className="shrink-0text-right">
                    <p className="text-sm font-blacktext-amber-600">🪙 {def.price.toLocaleString()}</p>
                    {locked? (
                      <div className="mt-1 rounded-full bg-stone-200 px-2 py-1 text-[10px] font-boldtext-stone-500">
                        🔒 {reqName}
                      </div>
                    ) :(
                      <Buttonsize="sm"
                        onClick={() => buy('hen', def.key)}
                        disabled={loading|| !affordable|| full}
                        className="mt-1 h-8 rounded-full bg-green-700 px-3 text-xs font-extrabold text-white active:scale-95disabled:opacity-40"
                      >
                        {full? 'CoopFull' :!affordable? 'Needcoins' :'Buy'}
                      </Button>
                    )}
                  </div>
                </div>
              </GameCard>
            )
          })}
        </div>
      )}

      {/* ── eggs── */}
      {tab=== 'eggs' && (
        <div className="space-y-2">
          <p className="rounded-xl bg-lime-50 px-3 py-2 text-[11px] font-boldtext-lime-700">
            💡 Hen-laid eggs are free fromcollecting! These premium eggs have faster hatch times& better rewards.</p>
          {Object.values(EGG_TYPES).filter(e=> e.purchasable).map(def=> {
            const affordable= user.coins>= (def.buyPrice?? 0)
            return(
              <GameCardkey={def.key}>
                <div className="flex items-start gap-3">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-stone-200 bg-stone-50  text-3xl">
                    {def.emoji}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-blacktext-stone-800">{def.name}</p>
                    <p className="text-[11px] leading-tighttext-stone-500">{def.desc}</p>
                    <p className="mt-1 text-[10px] font-boldtext-stone-600">⏱ Hatches in{def.hatchHours}h</p>
                  </div>
                  <div className="shrink-0text-right">
                    <p className="text-sm font-blacktext-amber-600">🪙 {def.buyPrice?.toLocaleString()}</p>
                    <Buttonsize="sm"
                      onClick={() => buy('egg', def.key)}
                      disabled={loading|| !affordable}
                      className="mt-1 h-8 rounded-full bg-green-700 px-3 text-xs font-extrabold text-white active:scale-95disabled:opacity-40"
                    >
                      {!affordable? 'Needcoins' :'Buy'}
                    </Button>
                  </div>
                </div>
                <div className="mt-2 rounded-xl bg-stone-50  p-2">
                  <p className="text-[10px] font-black uppercasetext-stone-600">Possiblerewards</p>
                  <div className="mt-1 flex flex-wrapgap-1">
                    {def.hatchTable.map(r=> (
                      <spankey={r.reward} className="rounded-full border border-stone-200 bg-white px-1.5 py-0.5 text-[9px] font-boldtext-stone-500">
                        {rewardLabel(r.reward)} · {r.chance}%
                      </span>
                    ))}
                  </div>
                </div>
              </GameCard>
            )
          })}
        </div>
      )}

      {/* ── animals── */}
      {tab=== 'animals' && (
        <div className="space-y-2">
          {Object.values(ANIMAL_TYPES).map(def=> {
            const affordable= user.coins>= def.price const full= animals.length>= Math.max(farm.landCap, farm.shelterCap)
            return(
              <GameCardkey={def.key}>
                <div className="flex items-start gap-3">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-stone-200 bg-stone-50  text-3xl">
                    {def.emoji}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-blacktext-stone-800">{def.name}</p>
                    <p className="text-[11px] leading-tighttext-stone-500">{def.desc}</p>
                    {def.coinsPerHour> 0&& (
                      <p className="mt-1 text-[10px] font-boldtext-green-600">🪙 +{Math.round(def.coinsPerHour* 24)}/daypassive</p>
                    )}
                  </div>
                  <div className="shrink-0text-right">
                    <p className="text-sm font-blacktext-amber-600">🪙 {def.price.toLocaleString()}</p>
                    <Buttonsize="sm"
                      onClick={() => buy('animal', def.key)}
                      disabled={loading|| !affordable|| full}
                      className="mt-1 h-8 rounded-full bg-green-700 px-3 text-xs font-extrabold text-white active:scale-95disabled:opacity-40"
                    >
                      {full? 'PensFull' :!affordable? 'Needcoins' :'Buy'}
                    </Button>
                  </div>
                </div>
              </GameCard>
            )
          })}
        </div>
      )}

      {/* ── items(Phase10) ── */}
      {tab=== 'items' && (
        <div className="space-y-2">
          <p className="rounded-xl bg-sky-50 px-3 py-2 text-[11px] font-boldtext-sky-700">
            🎒 Items are stored in yourBarn(Farmtab).Use them anytime forboosts, healing& instant growth.</p>
          {Object.values(ITEM_TYPES).map(def=> {
            const gem= !!def.gemPrice const affordable= gem? user.gems>= def.gemPrice! : user.coins>= def.price return(
              <GameCardkey={def.key}>
                <div className="flex items-start gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-stone-200 bg-stone-50  text-2xl">
                    {def.emoji}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-blacktext-stone-800">{def.name}</p>
                    <p className="text-[11px] leading-tighttext-stone-500">{def.desc}</p>
                  </div>
                  <div className="shrink-0text-right">
                    <p className={cn('text-sm font-black', gem? 'text-pink-600' :'text-amber-600')}>
                      {gem? `💎 ${def.gemPrice}` :`🪙 ${def.price.toLocaleString()}`}
                    </p>
                    <Buttonsize="sm"
                      onClick={() => buy('item', def.key)}
                      disabled={loading|| !affordable}
                      className="mt-1 h-8 rounded-full bg-green-700 px-3 text-xs font-extrabold text-white active:scale-95disabled:opacity-40"
                    >
                      {!affordable? 'Needfunds' :'Buy'}
                    </Button>
                  </div>
                </div>
              </GameCard>
            )
          })}
        </div>
      )}

      {/* ── buildings& upgrades(Phase11) ── */}
      {tab=== 'upgrades' && (
        <div className="space-y-2">
          {Object.values(UPGRADES).map(def=> {
            constcurLevel= def.key=== 'coop' ? farm.coopLevel : def.key=== 'land' ? farm.landLevel :farm.storageLevel const maxed= curLevel>= def.levels.length const next= def.levels[curLevel] const affordable= user.coins>= (next?.price?? 0)
            return(
              <GameCardkey={def.key}>
                <div className="flex items-start gap-3">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-stone-200 bg-stone-50  text-3xl">
                    {def.emoji}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="font-blacktext-stone-800">{def.name}</p>
                      <span className="rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-blacktext-green-700">Lv{curLevel}</span>
                    </div>
                    <p className="text-[11px] leading-tighttext-stone-500">{def.desc}</p>
                    <div className="mt-1 flex flex-wrap gap-x-3 text-[10px] font-boldtext-stone-600">
                      <span>Now:{def.levels[curLevel -1]?.cap}{def.key=== 'storage' ? 'h' :''}</span>
                      {!maxed&& <span>Next:{next.cap}{def.key=== 'storage' ? 'h' :''}</span>}
                    </div>
                  </div>
                  <div className="shrink-0text-right">
                    {maxed? (
                      <span className="mt-1 inline-block rounded-full bg-stone-200 px-3 py-1.5 text-[10px] font-blacktext-stone-500">MAX</span>
                    ) :(
                      <>
                        <p className="text-sm font-blacktext-amber-600">🪙 {next.price.toLocaleString()}</p>
                        <Buttonsize="sm"
                          onClick={() => buy('upgrade', def.key)}
                          disabled={loading|| !affordable}
                          className="mt-1 h-8 rounded-full bg-amber-800 px-3 text-xs font-extrabold text-white active:scale-95disabled:opacity-40"
                        >
                          {!affordable? 'Needcoins' :'Upgrade'}
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </GameCard>
            )
          })}

          <p className="pt-2 text-center text-[10px] font-black uppercase tracking-widetext-stone-600">🏗️ FarmBuildings</p>
          {BUILDINGS.map(b=> {
            constcurLevel= farm[b.levelField] const maxed= curLevel>= b.maxLevel const price= b.prices[Math.min(curLevel+ 1, b.prices.length -1)] const affordable= user.coins>= price return(
              <GameCardkey={b.key}>
                <div className="flex items-start gap-3">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-stone-200 bg-stone-50  text-3xl">
                    {b.emoji}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="font-blacktext-stone-800">{b.name}</p>
                      <span className={cn(
                        'rounded-full px-1.5 py-0.5 text-[10px] font-black',
                        curLevel> 0? 'bg-green-100  text-green-700' :'bg-stone-200  text-stone-500'
                      )}>
                        {curLevel=== 0? 'Notbuilt' :`Lv${curLevel}`}
                      </span>
                    </div>
                    <p className="text-[11px] leading-tighttext-stone-500">Now:{b.effectFor(curLevel)}</p>
                    {!maxed&& <p className="text-[10px] font-boldtext-stone-600">Next:{b.effectFor(curLevel+ 1)}</p>}
                  </div>
                  <div className="shrink-0text-right">
                    {maxed? (
                      <span className="mt-1 inline-block rounded-full bg-stone-200 px-3 py-1.5 text-[10px] font-blacktext-stone-500">MAX</span>
                    ) :(
                      <>
                        <p className="text-sm font-blacktext-amber-600">🪙 {price.toLocaleString()}</p>
                        <Buttonsize="sm"
                          onClick={() => buy('building', b.key)}
                          disabled={loading|| !affordable}
                          className="mt-1 h-8 rounded-full bg-amber-800 px-3 text-xs font-extrabold text-white active:scale-95disabled:opacity-40"
                        >
                          {!affordable? 'Needcoins' :curLevel=== 0? 'Build' :'Upgrade'}
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </GameCard>
            )
          })}

          <GameCard className="bg-gradient-to-r from-purple-50to-white">
            <p className="text-xs font-blacktext-stone-700">⭐ LevelRoadmap</p>
            <div className="mt-2 space-y-1.5">
              {FARMER_LEVELS.map((l, i) => {
                const unlocked= levelIdx>= i return(
                  <divkey={l.name} className="flex items-center gap-2">
                    <span className={cn('text-sm', !unlocked&& 'grayscaleopacity-50')}>{unlocked? '✅' :'🔒'}</span>
                    <span className={cn('flex-1 text-[11px] font-bold', unlocked? 'text-stone-700' :'text-stone-600')}>
                      {l.name} <span className="font-normal">· {l.xp.toLocaleString()} XP · {l.unlock}</span>
                    </span>
                  </div>
                )
              })}
            </div>
          </GameCard>
        </div>
      )}

      {/* ── premium(Phase15) ── */}
      {tab=== 'premium' && (
        <div className="space-y-3">
          <p className="rounded-xl bg-pink-50 px-3 py-2 text-[11px] font-boldtext-pink-700">
            👑 Real-money purchases are processed by a mock payment gateway for this demo— no card is charged.</p>

          {/* payment method*/}
          <GameCard>
            <p className="text-xs font-blacktext-stone-700">💳 Paymentmethod</p>
            <div className="mt-2 grid grid-cols-3 gap-1">
              {PAY_METHODS.map(m=> (
                <buttonkey={m.key}
                  onClick={() => setPayMethod(m.key)}
                  className={cn(
                    'rounded-xl border py-2 text-[11px] font-black',
                    payMethod=== m.key? 'border-pink-500 bg-pink-50  text-pink-700' :'border-stone-200text-stone-600'
                  )}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </GameCard>

          {/* gem packs*/}
          <p className="text-center text-[10px] font-black uppercase tracking-widetext-stone-600">💎 GemPacks</p>
          <div className="grid grid-cols-2 gap-2">
            {GEM_PACKS.map(p=> (
              <GameCardkey={p.key} className={cn('relativetext-center', p.tag=== 'BEST VALUE' && 'border-pink-400bg-pink-50/50')}>
                {p.tag&& (
                  <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 rounded-full bg-pink-500 px-2 py-0.5 text-[8px] font-black text-white">
                    {p.tag}
                  </span>
                )}
                <p className="mt-1 text-2xl">💎</p>
                <p className="text-lg font-black tabular-numstext-pink-700">{p.gems}</p>
                <p className="text-[10px] font-boldtext-stone-500">{p.name}</p>
                {p.bonusPct> 0&& <p className="text-[9px] font-blacktext-green-600">+{p.bonusPct}% bonus</p>}
                <Buttonsize="sm"
                  onClick={async() => { awaitact('purchase_gems', { sku:p.key, method:payMethod}) }}
                  disabled={loading}
                  className="mt-2 h-8 w-full rounded-full bg-pink-500 text-xs font-extrabold text-white  active:scale-95"
                >
                  ${(p.priceCents /100).toFixed(2)}
                </Button>
              </GameCard>
            ))}
          </div>

          {/* VIP plans*/}
          <p className="pt-2 text-center text-[10px] font-black uppercase tracking-widetext-stone-600">👑 VIP Subscriptions</p>
          {Object.values(VIP_PLANS).map(v=> {
            constisCurrent= state.user.vip?.plan=== v.key return(
              <GameCardkey={v.key} className="bg-gradient-to-r from-amber-50 via-yellow-50to-white">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-blacktext-stone-800">{v.name} <span className="text-[10px] font-boldtext-amber-600">· {v.days} days</span></p>
                    <ul className="mt-1 space-y-0.5">
                      {v.perks.map(p=> (
                        <likey={p} className="text-[11px] font-boldtext-stone-500">✓ {p}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="shrink-0text-right">
                    <p className="text-lg font-blacktext-amber-600">${(v.priceCents /100).toFixed(2)}</p>
                    {isCurrent? (
                      <span className="mt-1 inline-block rounded-full bg-green-100 px-3 py-1.5 text-[10px] font-blacktext-green-700">
                        ✓ Active</span>
                    ) :(
                      <Buttonsize="sm"
                        onClick={async() => { awaitact('purchase_vip', { planKey:v.key, method:payMethod}) }}
                        disabled={loading}
                        className="mt-1 h-9 rounded-full bg-gradient-to-r from-amber-500 to-yellow-500 px-4 text-xs font-extrabold text-white shadowactive:scale-95"
                      >
                        Subscribe</Button>
                    )}
                  </div>
                </div>
              </GameCard>
            )
          })}
        </div>
      )}
    </div>
  )
}

functionrewardLabel(reward:string): string{
  const[kind, arg]= reward.split(':')
  if(kind=== 'chick' || kind=== 'mutation') return`${HEN_TYPES[arg]?.emoji?? ' chick'} ${HEN_TYPES[arg]?.name?? 'Chick'}`
  if(kind=== 'coins') return`🪙 ${arg}`
  if(kind=== 'gems') return`💎 ${arg}`
  if(kind=== 'animal') return`${ANIMAL_TYPES[arg]?.emoji?? '🐾'} ${ANIMAL_TYPES[arg]?.name?? 'Pet'}`
  return reward}
