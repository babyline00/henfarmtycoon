'use client'

import{ useCallback, useEffect, useState} from'react'
import{ AnimatePresence, motion} from'framer-motion'
import{ useGame, api} from'@/lib/store'
import{ EGG_TYPES, HEN_TYPES, ANIMAL_TYPES } from'@/lib/game'
import{ Button} from'@/components/ui/button'
import{ Input} from'@/components/ui/input'
import{ Label} from'@/components/ui/label'
import{ GameCard, EmptyState} from'./shared'
import{ cn} from'@/lib/utils'

interface Listing{
  id: string; sellerId: string; sellerName: string; itemType: string; subType: string title: string; detail?: string| null price: number; ageDays: number}

interface TradeRow{
  id:string; title:string; price:number; buyerName:string; sellerName: string; itemType:string; subType:string; createdAt: string}

interface PriceStat{ avg:number; count:number; last: number}

type Tab= 'browse' | 'mine' | 'sell'

export function MarketView() {
  const{ state, act, loading, showFlash} = useGame()
  const [tab, setTab]= useState<Tab>('browse')
  const [filter, setFilter]= useState<'all' | 'hens' | 'animals' | 'eggs'>('all')
  const [listings, setListings]= useState<Listing[]>([])
  const [myListings, setMyListings]= useState<Listing[]>([])
  const [trades, setTrades]= useState<TradeRow[]>([])
  const [priceStats, setPriceStats]= useState<Record<string, PriceStat>>({})
  const [fee, setFee]= useState(5)
  const [sellModal, setSellModal]= useState(false)
  const [reloadKey, setReloadKey]= useState(0)

  useEffect(() => {
    let cancelled= false;(async() => {
      try{
        const res= await api<{
          listings:Listing[]; myListings:Listing[]; marketFeePct: number; recentTrades:TradeRow[]; priceStats:Record<string, PriceStat>
        }>(`/api/market?filter=${filter}`)
        if(cancelled) return setListings(res.listings)
        setMyListings(res.myListings)
        setFee(res.marketFeePct)
        setTrades(res.recentTrades?? [])
        setPriceStats(res.priceStats?? {})
      } catch(e) {
        if(!cancelled) showFlash(e instanceof Error? e.message :'Failed to loadmarket', 'error')
      }
    })()
    return() => { cancelled= true}
  }, [filter, reloadKey, showFlash])

  const reload= useCallback(() => setReloadKey(k=> k+ 1), [])

  if(!state) return null const{ user, hens, animals, eggInventory} = state async function handleBuy(l:Listing) {
    const res= await act('buy_market', { listingId: l.id})
    if(res) reload()
  }

  async function handleCancel(l:Listing) {
    const res= await act('cancel_market', { listingId: l.id})
    if(res) reload()
  }

  return(
    <div className="space-y-3 px-3 pb-4">
      <div className="rounded-3xl border border-stone-200 bg-gradient-to-r from-teal-50 to-white p-4shadow-sm">
        <p className="text-lg font-blacktext-stone-800">🏪 FarmersMarket</p>
        <p className="text-xstext-stone-500">Tradehens, animals& eggs with other farmers.Market fee:{fee}%.Your balance:🪙 {user.coins.toLocaleString()}</p>
      </div>

      <div className="grid grid-cols-3 gap-1 rounded-2xl bg-stone-100  p-1">
        {(['browse', 'mine', 'sell'] asTab[]).map(t=> (
          <button key={t}
            onClick={() => setTab(t)}
            className={cn(
              'rounded-xl py-2 text-xs font-extrabold transition-all',
              tab=== t? 'bg-white text-teal-700shadow' :'text-stone-600'
            )}
          >
            {t=== 'browse' ? '🔎 Browse' : t=== 'mine' ? `📦 MyListings${myListings.length? ` (${myListings.length})` :''}` :'💰 Sell'}
          </button>
        ))}
      </div>

      {tab=== 'browse' && (
        <>
          <div className="grid grid-cols-4 gap-1">
            {(['all', 'hens', 'animals', 'eggs'] asconst).map(f=> (
              <button key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  'rounded-full border px-2 py-1 text-[11px] font-bold capitalize',
                  filter=== f? 'border-teal-400 bg-teal-50  text-teal-700' :'border-stone-200 bg-whitetext-stone-600'
                )}
              >
                {f=== 'all' ? '✨ All' : f=== 'hens' ? '🐔 Hens' : f=== 'animals' ? '🐄 Animals' :'🥚 Eggs'}
              </button>
            ))}
          </div>

          {/* Phase 13: recent trades ticker*/}
          {trades.length> 0&& (
            <div className="overflow-hidden rounded-2xl border border-teal-200 bg-teal-50/60 px-3 py-2">
              <p className="text-[9px] font-black uppercase tracking-widetext-teal-600">📈 Livetrades</p>
              <div className="mt-1 space-y-0.5">
                {trades.slice(0, 4).map(t=> (
                  <pkey={t.id} className="truncate text-[10px] font-boldtext-teal-800">
                    {t.title} → 🪙 {t.price.toLocaleString()} <span className="font-normaltext-teal-500">({t.sellerName} → {t.buyerName})</span>
                  </p>
                ))}
              </div>
            </div>
          )}

          {listings.length=== 0? (
            <GameCard><EmptyStateemoji="🏪" title="Nolistings" sub="Check anothercategory" /></GameCard>
          ) :(
            <div className="space-y-2">
              {listings.map(l=> {
                const stat= priceStats[`${l.itemType}:${l.subType}`] return(
                  <GameCard key={l.id}>
                    <div className="flex items-start gap-3">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-stone-200 bg-stone-50  text-2xl">
                        {listingEmoji(l)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-blacktext-stone-800">{l.title}</p>
                        {l.detail&& <p className="truncate text-[11px]text-stone-600">{l.detail}</p>}
                        <p className="mt-0.5 text-[10px] font-boldtext-teal-600">⚑ {l.sellerName}</p>
                        {stat&& stat.count>= 2&& (
                          <p className="text-[9px] font-boldtext-stone-600">
                            📊 avg🪙 {stat.avg.toLocaleString()} over{stat.count} trades{l.price> stat.avg* 1.3? '· ⚠️ abovemarket' : l.price< stat.avg* 0.7? '· 💚 belowmarket' :''}
                          </p>
                        )}
                      </div>
                      <div className="shrink-0text-right">
                        <p className="text-sm font-blacktext-amber-600">🪙 {l.price.toLocaleString()}</p>
                        {l.sellerId=== user.id? (
                          <span className="text-[10px] font-boldtext-stone-600">Yourlisting</span>
                        ) :(
                          <Buttonsize="sm"
                            onClick={() => handleBuy(l)}
                            disabled={loading|| user.coins< l.price}
                            className="mt-1 h-8 rounded-full bg-teal-600 px-3 text-xs font-extrabold text-white active:scale-95 disabled:opacity-40"
                          >
                            {user.coins< l.price? 'Toopricey' :'Buy'}
                          </Button>
                        )}
                      </div>
                    </div>
                  </GameCard>
                )
              })}
            </div>
          )}
        </>
      )}

      {tab=== 'mine' && (
        myListings.length=== 0? (
          <GameCard><EmptyStateemoji="📦" title="No activelistings" sub="Sell your items in theSelltab" /></GameCard>
        ) :(
          <div className="space-y-2">
            {myListings.map(l=> (
              <GameCard key={l.id}>
                <div className="flex items-start gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-stone-200 bg-stone-50  text-2xl">
                    {listingEmoji(l)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-blacktext-stone-800">{l.title}</p>
                    <p className="text-[11px]text-stone-600">{l.detail}</p>
                    <p className="text-sm font-blacktext-amber-600">🪙 {l.price.toLocaleString()}</p>
                  </div>
                  <Buttonsize="sm"
                    var iant="outline"
                    onClick={() => handleCancel(l)}
                    disabled={loading}
                    className="h-8 rounded-full px-3 text-xs font-bold"
                  >
                    Cancel</Button>
                </div>
              </GameCard>
            ))}
          </div>
        )
      )}

      {tab=== 'sell' && (
        <div className="space-y-2">
          <p className="rounded-xl bg-teal-50 px-3 py-2 text-[11px] font-boldtext-teal-700">
            💡 Listed items stop producing.On sale you receive price minus{fee}% market fee.Anti-fraud rules keep prices between25% and600% of reference value.</p>

          {hens.map(h=> (
            <SellRow key={`h-${h.id}`}
              emoji={h.emoji}
              title={`${h.name} (${HEN_TYPES[h.type].name})`}
              sub={h.status=== 'retired' ? 'Retired' :`${h.ageDays}d old· ${HEN_TYPES[h.type].rarity}`}
              suggestion={Math.round(HEN_TYPES[h.type].price* (h.status=== 'active' ? 0.9 :0.2))}
              disabled={loading}
              onSell={async(price) => {
                const res= await act('list_market', { itemType:'hen', itemId:h.id, price})
                if(res) reload()
              }}
            />
          ))}
          {animals.map(a=> (
            <SellRow key={`a-${a.id}`}
              emoji={a.emoji}
              title={`${a.name} (${ANIMAL_TYPES[a.type].name})`}
              sub={ANIMAL_TYPES[a.type].desc}
              suggestion={Math.round(ANIMAL_TYPES[a.type].price* 0.9)}
              disabled={loading}
              onSell={async(price) => {
                const res= await act('list_market', { itemType:'animal', itemId:a.id, price})
                if(res) reload()
              }}
            />
          ))}
          {Object.entries(eggInventory).filter(([, n]) => n> 0).map(([type, n]) => (
            <SellRow key={`e-${type}`}
              emoji={EGG_TYPES[type].emoji}
              title={`${EGG_TYPES[type].name} ×${n}`}
              sub={`Sell value${EGG_TYPES[type].sellValue} each`}
              suggestion={EGG_TYPES[type].buyPrice?? EGG_TYPES[type].sellValue}
              disabled={loading}
              onSell={async(price) => {
                const res= await act('list_market', { itemType:'egg', subType:type, price})
                if(res) reload()
              }}
            />
          ))}
          {hens.length=== 0&& animals.length=== 0&& Object.values(eggInventory).every(n=> n=== 0) && (
            <GameCard><EmptyStateemoji="🪹" title="Nothing to sellyet" sub="Buy hens and collect eggsfirst" /></GameCard>
          )}
        </div>
      )}

      <AnimatePresence>
        {sellModal&& (
          <motion.div initial={{ opacity: 0}} animate={{ opacity: 1}} exit={{ opacity: 0}}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40p-6"
            onClick={() => setSellModal(false)}
          >
            <div className="rounded-2xl bg-white p-5" onClick={e=> e.stopPropagation()}>
              <p className="font-black">Use theSell tab👆</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function SellRow({ emoji, title, sub, suggestion, disabled, onSell}:{
  emoji:string; title:string; sub:string; suggestion:number; disabled: boolean; onSell:(price:number) => Promise<void>
}) {
  const [price, setPrice]= useState(String(suggestion))
  const [busy, setBusy]= useState(false)

  return(
    <GameCard>
      <div className="flex items-center gap-2">
        <span className="text-2xl">{emoji}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-blacktext-stone-800">{title}</p>
          <p className="truncate text-[10px]text-stone-600">{sub}</p>
        </div>
      </div>
      <div className="mt-2 flex items-end gap-2">
        <div className="flex-1">
          <Label className="text-[10px] font-boldtext-stone-600">Price(coins)</Label>
          <Input type="number" min={1} value={price}
            onChange={e=> setPrice(e.target.value)}
            className="h-9 rounded-lg border-stone-200bg-stone-50"
          />
        </div>
        <Buttonsize="sm"
          disabled={disabled|| busy|| !Number(price)}
          onClick={async() => {
            setBusy(true)
            await onSell(Math.max(1, Math.floor(Number(price))))
            setBusy(false)
          }}
          className="h-9 rounded-lg bg-teal-600 px-4 text-xs font-extrabold text-white"
        >
          {busy? '...' :'Listit'}
        </Button>
      </div>
    </GameCard>
  )
}

function listingEmoji(l:Listing): string{
  if(l.itemType=== 'hen') return HEN_TYPES[l.subType]?.emoji?? '🐔'
  if(l.itemType=== 'animal') return ANIMAL_TYPES[l.subType]?.emoji?? '🐄'
  return EGG_TYPES[l.subType]?.emoji?? '🥚'
}
