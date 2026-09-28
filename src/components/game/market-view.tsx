'use client'

import { useCallback, useEffect, useState } from 'react'
import { useGame, api } from '@/lib/store'
import { EGG_TYPES, HEN_TYPES, ANIMAL_TYPES } from '@/lib/game'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { GameCard, EmptyState } from './shared'
import { cn } from '@/lib/utils'

interface Listing {
  id: string
  sellerId: string
  sellerName: string
  itemType: string
  subType: string
  title: string
  detail?: string | null
  price: number
  ageDays: number
}

interface TradeRow {
  id: string
  title: string
  price: number
  buyerName: string
  sellerName: string
  itemType: string
  subType: string
  createdAt: string
}

interface PriceStat { avg: number; count: number; last: number }

type Tab = 'browse' | 'mine' | 'sell'
type Filter = 'all' | 'hens' | 'animals' | 'eggs'

export function MarketView() {
  const { state, act, loading, showFlash } = useGame()
  const [tab, setTab] = useState<Tab>('browse')
  const [filter, setFilter] = useState<Filter>('all')
  const [listings, setListings] = useState<Listing[]>([])
  const [myListings, setMyListings] = useState<Listing[]>([])
  const [trades, setTrades] = useState<TradeRow[]>([])
  const [priceStats, setPriceStats] = useState<Record<string, PriceStat>>({})
  const [fee, setFee] = useState(5)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await api<{
          listings: Listing[]
          myListings: Listing[]
          marketFeePct: number
          recentTrades: TradeRow[]
          priceStats: Record<string, PriceStat>
        }>(`/api/market?filter=${filter}`)
        if (cancelled) return
        setListings(res.listings)
        setMyListings(res.myListings)
        setFee(res.marketFeePct)
        setTrades(res.recentTrades ?? [])
        setPriceStats(res.priceStats ?? {})
      } catch (e) {
        if (!cancelled) showFlash(e instanceof Error ? e.message : 'Failed to load market', 'error')
      }
    })()
    return () => { cancelled = true }
  }, [filter, reloadKey, showFlash])

  const reload = useCallback(() => setReloadKey(k => k + 1), [])

  if (!state) return null

  const { user, hens, animals, eggInventory } = state

  async function handleBuy(l: Listing) {
    const res = await act('buy_market', { listingId: l.id })
    if (res) reload()
  }

  async function handleCancel(l: Listing) {
    const res = await act('cancel_market', { listingId: l.id })
    if (res) reload()
  }

  return (
    <div className="space-y-3 px-3 pb-4">
      <div className="rounded-3xl border border-stone-200 bg-gradient-to-r from-teal-50 to-white p-4 shadow-sm">
        <p className="text-lg font-black text-stone-800">🏪 Farmers Market</p>
        <p className="text-xs text-stone-600">
          Trade hens, animals &amp; eggs with other farmers. Market fee: {fee}%. Your balance: 🪙 {user.coins.toLocaleString()}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-1 rounded-2xl bg-stone-100 p-1" role="tablist" aria-label="Market section">
        {(['browse', 'mine', 'sell'] as Tab[]).map(t => (
          <button key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={cn(
              'min-h-9 rounded-xl py-2 text-xs font-extrabold transition-all',
              tab === t ? 'bg-white text-teal-700 shadow' : 'text-stone-600',
            )}
          >
            {t === 'browse' ? '🔎 Browse' : t === 'mine' ? `📦 My Listings${myListings.length ? ` (${myListings.length})` : ''}` : '💰 Sell'}
          </button>
        ))}
      </div>

      {tab === 'browse' && (
        <>
          <div className="grid grid-cols-4 gap-1">
            {(['all', 'hens', 'animals', 'eggs'] as const).map(f => (
              <button key={f}
                onClick={() => setFilter(f)}
                aria-pressed={filter === f}
                className={cn(
                  'min-h-9 rounded-full border px-2 py-1 text-[11px] font-bold capitalize',
                  filter === f ? 'border-teal-500 bg-teal-50 text-teal-700' : 'border-stone-200 bg-white text-stone-600',
                )}
              >
                {f === 'all' ? '✨ All' : f === 'hens' ? '🐔 Hens' : f === 'animals' ? '🐄 Animals' : '🥚 Eggs'}
              </button>
            ))}
          </div>

          {/* Phase 13: recent trades ticker */}
          {trades.length > 0 && (
            <div className="overflow-hidden rounded-2xl border border-teal-200 bg-teal-50/60 px-3 py-2">
              <p className="text-[9px] font-black uppercase tracking-wide text-teal-700">📈 Live trades</p>
              <div className="mt-1 space-y-0.5">
                {trades.slice(0, 4).map(t => (
                  <p key={t.id} className="truncate text-[10px] font-bold text-teal-800">
                    {t.title} → 🪙 {t.price.toLocaleString()}{' '}
                    <span className="font-normal text-teal-600">({t.sellerName} → {t.buyerName})</span>
                  </p>
                ))}
              </div>
            </div>
          )}

          {listings.length === 0 ? (
            <GameCard><EmptyState emoji="🏪" title="No listings" sub="Check another category" /></GameCard>
          ) : (
            <div className="space-y-2">
              {listings.map(l => {
                const stat = priceStats[`${l.itemType}:${l.subType}`]
                const tooDear = user.coins < l.price
                return (
                  <GameCard key={l.id}>
                    <div className="flex items-start gap-3">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-stone-200 bg-stone-50 text-2xl">
                        <span aria-hidden="true">{listingEmoji(l)}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-black text-stone-800">{l.title}</p>
                        {l.detail && <p className="truncate text-[11px] text-stone-600">{l.detail}</p>}
                        <p className="mt-0.5 text-[10px] font-bold text-teal-700">⚑ {l.sellerName}</p>
                        {stat && stat.count >= 2 && (
                          <p className="text-[9px] font-bold text-stone-600">
                            📊 avg 🪙 {stat.avg.toLocaleString()} over {stat.count} trades
                            {l.price > stat.avg * 1.3 ? ' · ⚠️ above market' : l.price < stat.avg * 0.7 ? ' · 💚 below market' : ''}
                          </p>
                        )}
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-black text-amber-700">🪙 {l.price.toLocaleString()}</p>
                        {l.sellerId === user.id ? (
                          <span className="text-[10px] font-bold text-stone-600">Your listing</span>
                        ) : (
                          <Button size="sm"
                            onClick={() => handleBuy(l)}
                            disabled={loading || tooDear}
                            aria-label={`Buy ${l.title} for ${l.price} coins`}
                            className="mt-1 min-h-9 rounded-full bg-teal-700 px-3 text-xs font-extrabold text-white active:scale-95 disabled:opacity-40"
                          >
                            {tooDear ? 'Too pricey' : 'Buy'}
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

      {tab === 'mine' && (
        myListings.length === 0 ? (
          <GameCard><EmptyState emoji="📦" title="No active listings" sub="Sell your items in the Sell tab" /></GameCard>
        ) : (
          <div className="space-y-2">
            {myListings.map(l => (
              <GameCard key={l.id}>
                <div className="flex items-start gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-stone-200 bg-stone-50 text-2xl">
                    <span aria-hidden="true">{listingEmoji(l)}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-black text-stone-800">{l.title}</p>
                    <p className="text-[11px] text-stone-600">{l.detail}</p>
                    <p className="text-sm font-black text-amber-700">🪙 {l.price.toLocaleString()}</p>
                  </div>
                  <Button size="sm"
                    variant="outline"
                    onClick={() => handleCancel(l)}
                    disabled={loading}
                    aria-label={`Cancel listing: ${l.title}`}
                    className="min-h-9 shrink-0 rounded-full px-3 text-xs font-bold"
                  >
                    Cancel
                  </Button>
                </div>
              </GameCard>
            ))}
          </div>
        )
      )}

      {tab === 'sell' && (
        <div className="space-y-2">
          <p className="rounded-xl bg-teal-50 px-3 py-2 text-[11px] font-bold text-teal-700">
            💡 Listed items stop producing. On sale you receive price minus {fee}% market fee.
            Anti-fraud rules keep prices between 25% and 600% of reference value.
          </p>

          {hens.map(h => (
            <SellRow key={`h-${h.id}`}
              id={`h-${h.id}`}
              emoji={h.emoji}
              title={`${h.name} (${HEN_TYPES[h.type].name})`}
              sub={h.status === 'retired' ? 'Retired' : `${h.ageDays}d old · ${HEN_TYPES[h.type].rarity}`}
              suggestion={Math.round(HEN_TYPES[h.type].price * (h.status === 'active' ? 0.9 : 0.2))}
              disabled={loading}
              onSell={async (price) => {
                const res = await act('list_market', { itemType: 'hen', itemId: h.id, price })
                if (res) reload()
              }}
            />
          ))}
          {animals.map(a => (
            <SellRow key={`a-${a.id}`}
              id={`a-${a.id}`}
              emoji={a.emoji}
              title={`${a.name} (${ANIMAL_TYPES[a.type].name})`}
              sub={ANIMAL_TYPES[a.type].desc}
              suggestion={Math.round(ANIMAL_TYPES[a.type].price * 0.9)}
              disabled={loading}
              onSell={async (price) => {
                const res = await act('list_market', { itemType: 'animal', itemId: a.id, price })
                if (res) reload()
              }}
            />
          ))}
          {Object.entries(eggInventory).filter(([, n]) => n > 0).map(([type, n]) => (
            <SellRow key={`e-${type}`}
              id={`e-${type}`}
              emoji={EGG_TYPES[type].emoji}
              title={`${EGG_TYPES[type].name} ×${n}`}
              sub={`Sell value ${EGG_TYPES[type].sellValue} each`}
              suggestion={EGG_TYPES[type].buyPrice ?? EGG_TYPES[type].sellValue}
              disabled={loading}
              onSell={async (price) => {
                const res = await act('list_market', { itemType: 'egg', subType: type, price })
                if (res) reload()
              }}
            />
          ))}
          {hens.length === 0 && animals.length === 0 && Object.values(eggInventory).every(n => n === 0) && (
            <GameCard><EmptyState emoji="🪹" title="Nothing to sell yet" sub="Buy hens and collect eggs first" /></GameCard>
          )}
        </div>
      )}
    </div>
  )
}

function SellRow({
  id, emoji, title, sub, suggestion, disabled, onSell,
}: {
  id: string
  emoji: string
  title: string
  sub: string
  suggestion: number
  disabled: boolean
  onSell: (price: number) => Promise<void>
}) {
  const [price, setPrice] = useState(String(suggestion))
  const [busy, setBusy] = useState(false)

  return (
    <GameCard>
      <div className="flex items-center gap-2">
        <span className="text-2xl" aria-hidden="true">{emoji}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-black text-stone-800">{title}</p>
          <p className="truncate text-[10px] text-stone-600">{sub}</p>
        </div>
      </div>
      <div className="mt-2 flex items-end gap-2">
        <div className="flex-1">
          {/* `id` ties the label to the field so repeated "Price (coins)"
              rows on one screen are individually addressable. */}
          <Label htmlFor={`price-${id}`} className="text-[10px] font-bold text-stone-600">Price (coins)</Label>
          <Input id={`price-${id}`} type="number" min={1} value={price}
            onChange={e => setPrice(e.target.value)}
            className="h-9 rounded-lg border-stone-200 bg-stone-50"
          />
        </div>
        <Button size="sm"
          disabled={disabled || busy || !Number(price)}
          onClick={async () => {
            setBusy(true)
            try {
              await onSell(Math.max(1, Math.floor(Number(price))))
            } finally {
              setBusy(false)
            }
          }}
          className="min-h-9 rounded-lg bg-teal-700 px-4 text-xs font-extrabold text-white"
        >
          {busy ? '…' : 'List it'}
        </Button>
      </div>
    </GameCard>
  )
}

function listingEmoji(l: Listing): string {
  if (l.itemType === 'hen') return HEN_TYPES[l.subType]?.emoji ?? '🐔'
  if (l.itemType === 'animal') return ANIMAL_TYPES[l.subType]?.emoji ?? '🐄'
  return EGG_TYPES[l.subType]?.emoji ?? '🥚'
}
